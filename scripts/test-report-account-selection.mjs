import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
const brands = [
  { id: "a", name: "Alyssa", slug: "alyssa" },
  { id: "m", name: "Aesthetics Medical", slug: "aesthetics" },
  { id: "g", name: "GOS Beauty", slug: "gos-beauty" },
  { id: "i", name: "Ineffable", slug: "ineffable" },
];
let production = null;
let revenueRows = [], revenueFailure = false;
let categoryFailure = false;
let reportReadOptions, snapshotWrites = 0;
const categoryRows = [["Alyssa Main", "Sheet treatment", "Synthetic category"], ["Alyssa Main", "Synthetic treatment", "Synthetic category"]];
const metricQueries = [];
const mocks = {
  "@/lib/integrations/googleSheetsLeadTable": {
    readLiveReportTables: async (configuration, options) => {
      reportReadOptions = options;
      assert.equal(configuration.spreadsheetId,'synthetic_workbook_12345678');
      if(revenueFailure)throw Error('Synthetic read failure');
      return {
        treatmentCategories: { headers:["Account","Original Treatment","Dashboard 技術分類"], rows:categoryFailure?[]:categoryRows, readAt:"2026-10-07T04:00:00Z" },
        arrivalRevenue: { headers: ["品牌", "結果", "到店日期", "Account", "療程", "Appointment ID", "試做價", "開單金額", "總金額"], rows: revenueRows, readAt: "2026-10-07T04:00:00Z" }
      };
    }
  },
  "server-only": {},
  "@/lib/data/configuration": { getConfiguredBrands: async () => brands },
  "@/lib/supabase/admin": {
    hasSupabaseAdminEnv: () => production !== null,
    createSupabaseAdminClient: () => ({ from(table) {
      let ids = [], start = "", end = "";
      const query = {
        select() { return query; }, eq() { return query; }, order() { return query; }, limit() { return query; },
        in(_column, values) { ids = values; if (table === "marketing_treatment_performance_daily") metricQueries.push(values); return query; },
        gte(_column, value) { start = value; return query; }, lte(_column, value) { end = value; return query; },
        maybeSingle: async () => ({ data: production.missing ? null : { id: "synthetic-source", status: production.status ?? "connected", last_success_at: production.lastSuccessAt ?? null, display_name: "Synthetic Sheet", configuration: { sourceProfile: "alyssa_workspace_lead_funnel", spreadsheetId: "synthetic_workbook_12345678" } }, error: null }),
        insert: async () => { snapshotWrites += 1; return { error: null }; },
        range: async () => ({ data: (table === "marketing_treatment_performance_daily" ? production.metrics : production.spends)
          .filter(row => ids.includes(row.brand_id) && (row.metric_date ?? row.spend_date) >= start && (row.metric_date ?? row.spend_date) <= end), error: null }),
      };
      return query;
    } }),
  },
  "@/lib/security/internalAccessServer": { getCurrentInternalAccess: async () => ({ accessLevel: "master" }) },
  "@/lib/marketing/pacing": {
    getHkMonthContext: () => ({ throughDate: "2026-10-07" }),
    getCompletedHkReportRange: () => ({ startDate: "2026-10-01", endDate: "2026-10-07" }),
  },
};
const cache = new Map();
function load(path) {
  if (cache.has(path)) return cache.get(path);
  const module = { exports: {} }; cache.set(path, module.exports);
  const code = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "module", "exports", code)(id => mocks[id] ?? (id.startsWith("@/") ? load(`src/${id.slice(2)}.ts`) : require(id)), module, module.exports);
  return module.exports;
}
const { normalizeReportExportRequest: normalize, buildReportSnapshot: build, getReportGeneratorOptions } = load("src/lib/reports/snapshot.ts");
assert.equal(normalize({ format: "pptx" }).format, "pptx");
assert.equal(normalize({}).format, "pptx");
assert.equal(normalize({}).accountIds, null);
for (const accountIds of [[], "alyssa-main", ["invalid"], [null]]) {
  assert.throws(() => normalize({ accountIds }), error => error.code === "invalid_account_selection");
}
assert.deepEqual(normalize({ accountIds: ["GOS Beauty", "gos-beauty"] }).accountIds, ["gos-beauty"]);
const options = await getReportGeneratorOptions();
assert.ok(options.accountOptions.some(option => option.value === "alyssa-main"));
assert.ok(!options.accountOptions.some(option => option.value === "skin-light"));
const all = await build(normalize({ comparison: false }));
const selected = await build(normalize({ accountIds: ["gos-beauty"], comparison: true }));
assert.deepEqual(selected.selection.accountIds, ["gos-beauty"]);
assert.deepEqual(selected.selection.brands.map(brand => brand.id), ["g"]);
assert.ok(selected.series.auditRows.every(row => row.accountLabel === "GOS Beauty"));
assert.equal(selected.current.totals.leads, selected.series.groupRows[0].metrics.leads);
assert.equal(selected.daily.reduce((sum, row) => sum + row.metrics.bookings, 0), selected.current.totals.bookings);
assert.ok(selected.current.totals.leads < all.current.totals.leads);
assert.ok(selected.comparison);
assert.ok(selected.brandRows.every(row => row.brandId === "g"));
assert.ok(selected.treatmentRows.every(row => row.brandId === "g"));
const main = await build(normalize({ accountIds: ["alyssa-main"], comparison: false }));
assert.equal(main.current.totals.spend, null, "Paid brand Spend must not be assigned to KOL-only scope");
assert.equal(main.dataQuality.spendExpectedBrandDays, 0);
assert.ok(main.series.groupRows.every(row => row.key === "kol-traffic"));
await assert.rejects(build(normalize({ accountIds: ["skin-light"] })), error => error.code === "account_scope_denied");
const aesthetics = await build(normalize({ accountIds: ["alyssa-aesthetics"], comparison: false }));
const staleBrand = await build(normalize({ brandScope: "g", accountIds: ["alyssa-aesthetics"], comparison: false }));
assert.equal(staleBrand.selection.brandScope, "");
assert.deepEqual(staleBrand.selection.brands.map(brand => brand.id), ["a", "m"]);
assert.deepEqual(staleBrand.current.totals, aesthetics.current.totals, "An old client Brand filter cannot silently truncate selected Account metrics");
assert.ok(staleBrand.series.groupRows.some(row => row.key === "alyssa-ads"));
assert.ok(staleBrand.series.groupRows.some(row => row.key === "alyssa-medical-ads"));
const directRequest = await build({ ...normalize({ accountIds: ["alyssa-aesthetics"], comparison: false }), brandScope: "g" });
assert.deepEqual(directRequest.current.totals, aesthetics.current.totals, "Direct snapshot callers also use Account-only scope");
assert.notEqual(selected.snapshotSha256, all.snapshotSha256);
production = {
  metrics: [
    ...["a", "m", "g", "not-authorized"].map((id, i) => ({ brand_id: id, brand_label: brands.find(brand => brand.id === id)?.name ?? "Denied",
      account_label: "Alyssa Main", metric_date: "2026-10-02", metric_kind: "lead", treatment_label: "Sheet treatment", metric_count: i + 2 })),
    { brand_id: "a", brand_label: "Alyssa", account_label: "Alyssa Aesthetics", metric_date: "2026-10-02", metric_kind: "lead", metric_count: 99 },
  ],
  spends: ["a", "m", "g"].map(brand_id => ({ brand_id, spend_date: "2026-10-02", spend_type: "legacy_unclassified", amount: 100 })),
};
const mixedMain = await build(normalize({ accountIds: ["alyssa-main"], brandScope: "a", comparison: false }));
assert.deepEqual(metricQueries[0], ["a", "m", "g", "i"], "Query every authorized Brand before selecting Account");
assert.equal(mixedMain.current.totals.leads, 9, "Selected Account includes all its Brands, excludes other Accounts and denies unauthorized Brands");
assert.equal(mixedMain.series.groupRows[0].metrics.leads, 9);
assert.deepEqual(mixedMain.selection.brands.map(brand => brand.id), ["a", "m", "g"]);
assert.equal(mixedMain.current.totals.spend, null, "Including another Brand's Account facts never transfers paid Spend to KOL");
assert.equal(mixedMain.dataQuality.spendExpectedBrandDays, 0);
assert.deepEqual(mixedMain.series.treatmentRows.map(r=>r.label),['Synthetic category']);
assert.equal(mixedMain.series.treatmentRows[0].metrics.leads,9);
assert.equal(mixedMain.treatmentGrouping.version,'lead-sheet-treatment-categories-v1');
revenueRows=[['Alyssa','已到店','2026-10-02','Alyssa Main','Synthetic treatment','synthetic-main',100,900,1000],['GOS Beauty','已到店','2026-10-02','GOS Beauty','Synthetic treatment','synthetic-gos',100,0,100]];
const mainRevenue=await build(normalize({accountIds:['alyssa-main'],comparison:false}));
assert.equal(mainRevenue.arrivalRevenue.treatmentRows[0].label,'Synthetic category','Revenue and funnel breakdowns share the native category');
assert.deepEqual(mainRevenue.arrivalRevenue.accountRows.map(r=>r.accountId),['alyssa-main']);assert.equal(mainRevenue.arrivalRevenue.totals.totalRevenue,1000);assert.equal(mainRevenue.arrivalRevenue.totals.closeRate,1);assert.notEqual(mainRevenue.snapshotSha256,mixedMain.snapshotSha256);assert.equal(mainRevenue.current.totals.leads,mixedMain.current.totals.leads,'Financial data never changes Lead/Book/Show metrics');
const beforeFailures = snapshotWrites;
revenueFailure=true;await assert.rejects(build(normalize({accountIds:['alyssa-main']})),error=>error.code==='report_sources_unavailable'&&error.status===503);revenueFailure=false;revenueRows=[];
categoryFailure=true;await assert.rejects(build(normalize({accountIds:['alyssa-main']})),error=>error.code==='treatment_categories_unavailable'&&error.status===503);categoryFailure=false;
assert.equal(snapshotWrites, beforeFailures, 'Unverified report sources never publish a partial snapshot');
const controller = new AbortController();
await build(normalize({accountIds:['alyssa-main'],comparison:false}), {signal:controller.signal});
assert.equal(reportReadOptions.signal,controller.signal,'The export deadline reaches the shared provider read');
const beforeAbort = snapshotWrites;
controller.abort();
await assert.rejects(build(normalize({accountIds:['alyssa-main']}), {signal:controller.signal}), error=>error.name==='AbortError');
assert.equal(snapshotWrites,beforeAbort,'A cancelled export never persists a new snapshot');
production.status = "warning"; production.lastSuccessAt = "2026-10-07T04:00:00Z";
const validatedWarning = await build(normalize({ accountIds: ["alyssa-main"], comparison: false }));
assert.equal(validatedWarning.series.groupRows[0].available, true, "Validated source facts remain visible despite row-quality warnings");
assert.equal(validatedWarning.current.totals.leads, 9);
assert.ok(!validatedWarning.dataQuality.warnings.some(message => message.includes("尚未完成成功同步")));
production.lastSuccessAt = null;
const beforeUnavailable = snapshotWrites;
await assert.rejects(build(normalize({ accountIds: ["alyssa-main"], comparison: false })), error => error.code === "report_lead_source_unavailable" && error.status === 503, "Warning without a validated sync must not generate a partial report");
production.status = "error"; production.lastSuccessAt = "2026-10-01T04:00:00Z";
for (const format of ["pptx", "google_slides", "pdf", "txt"]) {
  await assert.rejects(build(normalize({ accountIds: ["alyssa-main"], comparison: false, format })), error => error.code === "report_lead_source_unavailable" && error.status === 503 && error.message.includes("先完成同步"), `Old success does not mask a failed refresh for ${format}`);
}
for (const status of ["draft", "disabled"]) {
  production.status = status;
  await assert.rejects(build(normalize({ accountIds: ["alyssa-main"], comparison: false })), error => error.code === "report_lead_source_unavailable" && error.status === 503, `${status} source cannot generate an incomplete report`);
}
production.missing = true;
await assert.rejects(build(normalize({ accountIds: ["alyssa-main"], comparison: false })), error => error.code === "report_lead_source_unavailable" && error.status === 503, "Missing source cannot generate an incomplete report");
assert.equal(snapshotWrites, beforeUnavailable, "No invalid snapshot is saved");
// Exercise the real export endpoint with the same synthetic source. All formats
// share the snapshot builder, and none may report success or start rendering
// when the source is unavailable.
production.missing = false;
production.status = "error";
mocks["@/lib/reports/snapshot"] = load("src/lib/reports/snapshot.ts");
mocks["@/lib/security/internalAccessServer"].requireModuleAccess = async () => ({ allowed: true });
mocks["next/server"] = { NextResponse: { json: (body, init) => Response.json(body, init) } };
const { POST } = load("src/app/api/internal/reports/export/route.ts");
for (const format of ["pptx", "google_slides", "pdf", "txt"]) {
  const response = await POST(new Request("https://example.invalid/api/internal/reports/export", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ format, accountIds: ["alyssa-main"], comparison: false }),
  }));
  assert.equal(response.status, 503, `${format} endpoint rejects an unavailable source`);
  const body = await response.json();
  assert.equal(body.code, "report_lead_source_unavailable");
  assert.match(body.message, /先完成同步/);
}
assert.equal(snapshotWrites, beforeUnavailable, "Failed exports never persist snapshots in any format");
production = null;
console.log("PASS: Account-only report selection includes every authorized Account Brand, ignores stale Brand filters, reconciles totals, rejects invalid/unauthorized Accounts and isolates KOL Spend");

