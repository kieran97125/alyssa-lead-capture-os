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
const metricQueries = [];
const mocks = {
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
        maybeSingle: async () => ({ data: { id: "synthetic-source", status: production.status ?? "connected", last_success_at: production.lastSuccessAt ?? null, display_name: "Synthetic Sheet" }, error: null }),
        insert: async () => ({ error: null }),
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
production.status = "warning"; production.lastSuccessAt = "2026-10-07T04:00:00Z";
const validatedWarning = await build(normalize({ accountIds: ["alyssa-main"], comparison: false }));
assert.equal(validatedWarning.series.groupRows[0].available, true, "Validated source facts remain visible despite row-quality warnings");
assert.equal(validatedWarning.current.totals.leads, 9);
assert.ok(!validatedWarning.dataQuality.warnings.some(message => message.includes("尚未完成成功同步")));
production.lastSuccessAt = null;
const unverifiedWarning = await build(normalize({ accountIds: ["alyssa-main"], comparison: false }));
assert.equal(unverifiedWarning.series.groupRows[0].available, false, "Warning state without a successful refresh is unverified");
production.status = "error"; production.lastSuccessAt = "2026-10-01T04:00:00Z";
const failedSource = await build(normalize({ accountIds: ["alyssa-main"], comparison: false }));
assert.equal(failedSource.series.groupRows[0].available, false, "An old success never marks a failed current refresh as healthy");
production = null;
console.log("PASS: Account-only report selection includes every authorized Account Brand, ignores stale Brand filters, reconciles totals, rejects invalid/unauthorized Accounts and isolates KOL Spend");
