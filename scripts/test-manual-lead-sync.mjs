import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

// Exercise the real coordinator with offline providers. A last-good saved
// snapshot must only publish after authoritative parsing, audit and both fact
// stores succeed. None of these tests contact Google or the application DB.
const nativeRequire = createRequire(import.meta.url);
const modules = new Map();
const brands = [{ id: "gos", name: "GOS Beauty", slug: "gos-beauty" }];
const configuration = { dataset: "lead_funnel", sourceProfile: "alyssa_workspace_lead_funnel",
  spreadsheetId: "synthetic-sheet", tabName: "lead", headerRow: 1, maxRows: 30000 };
const source = { id: "synthetic-source", display_name: "Synthetic Sheet", provider_key: "google_sheets",
  brand_id: null, configuration, status: "connected", last_sync_at: null };
let mode, events, published, lastGood, requestedPurpose, lastQuery;
function reset(nextMode = "success") {
  mode = nextMode; events = []; published = []; lastGood = "previous-good";
}
function database() {
  return { from(table) {
    let operation = "read", values;
    const filters = [];
    const query = {
      select() { return query; }, limit() { return query; }, order() { return query; },
      eq(...args) { filters.push(["eq", ...args]); return query; },
      neq(...args) { filters.push(["neq", ...args]); return query; },
      or(value) { filters.push(["or", value]); return query; },
      update(value) { operation = "update"; values = value; return query; },
      upsert(value) { operation = "upsert"; values = value; return query; },
      insert(value) { operation = "insert"; values = value; return query; },
      delete() { operation = "delete"; return query; },
      single() { return query; }, maybeSingle() { return query; },
      then(resolve, reject) {
        let result = { data: null, error: null };
        if (table === "marketing_data_sources" && operation === "read") {
          if (filters.some(([kind, field]) => kind === "eq" && field === "provider_key")) {
            lastQuery = filters;
            result.data = [];
          } else result.data = source;
        } else if (table === "brands") result.data = brands;
        else if (table === "marketing_data_sources" && operation === "update") {
          events.push(values.status === "syncing" ? "claim" : `source:${values.status}`);
          result.data = { id: source.id };
          if (mode === "fail-source-completion" && values.status === "connected") result.error = new Error("Synthetic completion failure");
        } else if (table === "marketing_daily_metrics" && operation === "read") result.data = [];
        else if (operation === "upsert") {
          const step = table === "marketing_daily_metrics" ? "daily" : "analysis";
          events.push(step);
          assert.ok(values.length > 0);
          if (mode === `fail-${step}`) result.error = new Error(`Synthetic ${step} failure`);
        } else if (operation === "delete") events.push("delete-stale-analysis");
        else if (table === "marketing_command_center_audit") events.push("sync-log");
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    return query;
  } };
}
const headers = ["最後更新日期", "Created At", "跟進狀態", "品牌", "Account", "電話", "預約日期", "確認到店日期", "療程項目", "CS Remark"];
const rows = [["2026-10-02", "2026-10-01", "no show", "GOS Beauty", "GOS Beauty", "10000001", "2026-10-03", "", "Synthetic treatment", "Synthetic private remark"]];
const mocks = {
  "server-only": {},
  "@/lib/supabase/admin": { createSupabaseAdminClient: database },
  "@/lib/integrations/googleSheetsOAuth": { getGoogleSheetsOAuthAccessToken: async () => { throw new Error("Unexpected OAuth outside mocked table"); } },
  "@/lib/integrations/googleSheetsLeadTable": {
    readLiveLeadTable: async () => {
      events.push("google-read");
      return { headers, rows, headerRow: 1, arrivalOutcomeAuthority: makeAuthority(mode === "bad-coverage") };
    },
    normalizeMetaLeadRowsInLiveTable: async ({ liveTable }) => ({ ...liveTable, normalizedMetaLeadRows: 0, normalizationWriteBackOk: true }),
  },
  "@/lib/marketing/leadSheetAudit": {
    captureLeadSheetAuditSnapshot: async () => {
      events.push("audit");
      return { runId: "synthetic-run", status: mode === "quarantine" ? "quarantined" : "completed",
        openAlerts: 0, quarantined: mode === "quarantine", quarantineReason: "Synthetic quarantine" };
    },
    recordLeadSheetAuditFailure: async () => { events.push("audit-failure"); },
  },
  "@/lib/marketing/leadDashboardSnapshotStore": {
    publishLeadDashboardSnapshot: async (input) => {
      events.push("publish");
      assert.ok(events.indexOf("daily") < events.indexOf("publish"));
      assert.ok(events.indexOf("delete-stale-analysis") < events.indexOf("publish"));
      assert.ok(events.indexOf("source:connected") < events.indexOf("publish"));
      if (mode === "fail-publication") throw new Error("Synthetic publication failure");
      published.push(input);
      lastGood = input;
    },
  },
  "@/lib/marketing/pacing": { getHkMonthContext: () => ({ today: "2026-10-06", throughDate: "2026-10-05" }) },
  "@/lib/marketing/monthlyReportingWorkbooks": {},
  "next/server": { NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200 }) } },
};
function load(path) {
  if (modules.has(path)) return modules.get(path).exports;
  const loadedModule = { exports: {} }; modules.set(path, loadedModule);
  const compiled = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: path,
  });
  new Function("require", "module", "exports", compiled.outputText)(
    (name) => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith("@/") ? load(`src/${name.slice(2)}.ts`) : nativeRequire(name), loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
const authority = load("src/lib/marketing/leadArrivalOutcomeAuthority.ts");
function makeAuthority(empty) {
  return authority.parseLeadArrivalOutcomeAuthority([Array.from(authority.ARRIVAL_METRIC_HEADERS),
    ...(empty ? [] : [["GOS Beauty|p:10000001", "GOS Beauty", "GOS Beauty", "Synthetic treatment",
      "2026-10-01", "2026-10-02", "2026-10-04", "", 0, 0, 0, 2]])]);
}
const sync = load("src/lib/integrations/googleSheetsMarketingSync.ts");
reset();
const initial = await sync.syncMarketingDataSource(source.id);
assert.equal(initial.ok, true, initial.message);
assert.deepEqual(events, ["claim", "google-read", "audit", "daily", "analysis", "delete-stale-analysis", "source:connected", "publish", "sync-log"]);
assert.equal(published.length, 1);
assert.equal(published[0].parsed.groups.length, 1);
assert.equal(published[0].parsed.groups[0].firstTouchDate, "2026-10-01");
assert.equal(published[0].parsed.groups[0].bookDate, "2026-10-02");
assert.equal(published[0].parsed.groups[0].showDate, "2026-10-04");
assert.equal(published[0].parsed.groups[0].noShowDate, null, "Saved output must use registry authority, not the stale source no-show status");
assert.equal(published[0].parsed.groups[0].rows[0].csRemark, "Synthetic private remark");
for (const failure of ["bad-coverage", "quarantine", "fail-daily", "fail-analysis", "fail-source-completion", "fail-publication"]) {
  reset(failure);
  assert.equal((await sync.syncMarketingDataSource(source.id)).ok, false, failure);
  assert.equal(lastGood, "previous-good", `${failure}: retain last-good snapshot`);
  assert.equal(published.length, 0);
  if (failure !== "fail-publication") assert.ok(!events.includes("publish"));
  if (["bad-coverage", "quarantine"].includes(failure)) assert.ok(!events.includes("daily"));
}
await sync.syncAllMarketingGoogleSheets({ purpose: "scheduled" });
assert.ok(lastQuery.some(([kind, value]) => kind === "or" && value === "configuration->>sourceProfile.is.null,configuration->>sourceProfile.neq.alyssa_workspace_lead_funnel"), "Scheduled selection excludes only the managed source and retains other profiles/null");
await sync.syncAllMarketingGoogleSheets({ purpose: "manual" });
assert.ok(!lastQuery.some(([kind]) => kind === "or"), "Explicit manual updates may still select the managed source");

// The authenticated cron must opt into the scheduled exclusion; unauthenticated
// requests must never reach any sync coordinator.
mocks["@/lib/integrations/googleSheetsMarketingSync"] = {
  syncAllMarketingGoogleSheets: async (options) => { requestedPurpose = options.purpose; return []; },
};
const route = load("src/app/api/cron/marketing-data-sources/route.ts");
const priorSecret = process.env.CRON_SECRET;
process.env.CRON_SECRET = "synthetic-cron-secret";
try {
  assert.equal((await route.GET({ headers: new Headers() })).status, 401);
  assert.equal(requestedPurpose, undefined);
  assert.equal((await route.GET({ headers: new Headers({ authorization: "Bearer synthetic-cron-secret" }) })).status, 200);
  assert.equal(requestedPurpose, "scheduled");
} finally {
  if (priorSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = priorSecret;
}
console.log("PASS: manual sync reads once, validates arrival coverage, preserves dates/detail, publishes only after audit/facts, retains last-good on failure; scheduled managed reads excluded and cron authorization preserved");
