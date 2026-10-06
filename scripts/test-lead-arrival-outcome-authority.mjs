import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const nativeRequire = createRequire(import.meta.url), modules = new Map();
let rewrite = false, calls = [], payload, providerMode = "ok";
const mocks = {
  "server-only": {},
  "@/lib/integrations/googleSheetsOAuth": { getGoogleSheetsOAuthAccessToken: async () => "synthetic-token" },
  "@/lib/integrations/metaLeadFormSheetNormalizer": {
    normalizeMetaLeadFormRows: (input) => ({ rows: input.rows, rewrites: rewrite ? [{ rowNumber: 2, values: Array(23).fill("") }] : [] }),
  },
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
const parser = load("src/lib/marketing/googleSheetsMetricParser.ts");
const pending = load("src/lib/marketing/leadPendingAppointmentAuthority.ts");
const table = load("src/lib/integrations/googleSheetsLeadTable.ts");
const headers = ["最後更新日期", "Created At", "跟進狀態", "品牌", "Account", "電話", "預約日期", "確認到店日期", "療程項目"];
const rows = [["2026-10-02", "2026-10-01", "no show", "GOS Beauty", "GOS Beauty", "10000001", "2026-10-03", "", "Synthetic treatment"]];
const brands = [{ id: "gos", name: "GOS Beauty", slug: "gos-beauty" }];
const fact = ["GOS Beauty|p:10000001", "GOS Beauty", "GOS Beauty", "Synthetic treatment", "2026-10-01", "2026-10-02", "2026-10-04", "", 0, 0, 0, 2];
const projection = (...facts) => [Array.from(authority.ARRIVAL_METRIC_HEADERS), ...facts];
const parsedAuthority = authority.parseLeadArrivalOutcomeAuthority(projection(fact));
const input = { headers, rows, brands, sourceBrandId: null };
const legacy = parser.buildLeadSheetGroups(input).groups[0];
const managed = parser.buildLeadSheetGroups({ ...input, arrivalOutcomeAuthority: parsedAuthority }).groups[0];
assert.equal(legacy.showDate, null); assert.equal(legacy.noShowDate, "2026-10-03");
assert.deepEqual(managed, { ...legacy, showDate: "2026-10-04", noShowDate: null });
assert.equal(managed.firstTouchDate, "2026-10-01"); assert.equal(managed.bookDate, "2026-10-02");
assert.ok(Object.isFrozen(parsedAuthority));

let rejected = 0;
for (const values of [[], [["Identity"], fact], projection(fact, fact), projection([...fact.slice(0, 11)]),
  projection(fact.map((v, i) => i === 1 ? "GOS" : v)),
  projection(fact.map((v, i) => i === 6 ? "2026-02-30" : v)),
  projection(fact.map((v, i) => i === 6 ? 46000.5 : v)),
  projection(fact.map((v, i) => i === 8 ? "0" : v)),
  projection(fact.map((v, i) => i === 3 ? "#REF!" : v)),
  projection(fact.map((v, i) => i === 11 ? NaN : v)),
]) { assert.throws(() => authority.parseLeadArrivalOutcomeAuthority(values), /暫時未能確認/); rejected++; }
assert.throws(() => parser.buildLeadSheetGroups({ ...input, arrivalOutcomeAuthority: authority.parseLeadArrivalOutcomeAuthority(projection()) }), /暫時未能確認/);
assert.throws(() => authority.applyLeadArrivalOutcomeAuthority([legacy, legacy], parsedAuthority), /暫時未能確認/);
assert.throws(() => parser.buildLeadSheetGroups({ ...input, rows: [rows[0].map((v, i) => i === 3 ? "Unknown" : v)], arrivalOutcomeAuthority: parsedAuthority }), /暫時未能確認/);
const metadataOnly = ["2026-10-05", "2026-10-05", "", "GOS Beauty", "GOS Beauty"];
assert.equal(parser.buildLeadSheetGroups({ ...input, rows: [...rows, metadataOnly], arrivalOutcomeAuthority: parsedAuthority }).groups.length, 1);
const noPhone = fact.map((v, i) => i === 0 ? "GOS Beauty|r:2" : v);
assert.equal(parser.buildLeadSheetGroups({ ...input, rows: [rows[0].map((v, i) => i === 5 ? "" : v)], arrivalOutcomeAuthority: authority.parseLeadArrivalOutcomeAuthority(projection(noPhone)) }).groups[0].showDate, "2026-10-04");
assert.throws(() => authority.parseLeadArrivalOutcomeAuthority(projection(noPhone.map((v, i) => i === 11 ? 3 : v))), /暫時未能確認/);
const future = { ...input, arrivalOutcomeAuthority: parsedAuthority, dailyThroughDate: "2026-10-02", activityThroughDate: "2026-10-02", pendingThroughDate: "2026-12-31" };
assert.equal(parser.aggregateLeadSheetPerformance(future).metricFacts.filter((f) => f.metricKind === "show").length, 0);
assert.equal(parser.aggregateLeadSheetPerformance({ ...future, retainAllAuthoritativeArrivalDates: true }).metricFacts.filter((f) => f.metricKind === "show").length, 1);
assert.throws(() => parser.aggregateLeadSheetPerformance({ ...future, arrivalOutcomeAuthority: undefined, retainAllAuthoritativeArrivalDates: true }), /暫時未能確認/);

const originalFetch = globalThis.fetch, originalTimeout = globalThis.setTimeout;
globalThis.fetch = async (url, init) => {
  calls.push({ url: new URL(url), init });
  if (providerMode === "stalled-fetch") return new Promise(() => {});
  return { ok: true, json: () => providerMode === "stalled-body" ? new Promise(() => {}) : Promise.resolve(payload) };
};
const config = { spreadsheetId: "synthetic_sheet_id_12345", sourceProfile: "alyssa_workspace_lead_funnel", headerRow: 1, tabName: "lead", maxRows: 30000 };
payload = { valueRanges: [{ values: [headers] }, { values: rows }, { values: projection(fact) }, { values: [pending.PENDING_BRIDGE_HEADERS, ["source_1","GOS Beauty|p:10000001",2,true,"",true,true,true]] }, {values:[pending.PENDING_REGISTRY_HEADERS]}] };
try {
  const live = await table.readLiveLeadTable(config);
  assert.deepEqual(calls[0].url.searchParams.getAll("ranges"), ["'lead'!A1:Y1", "'lead'!A2:Y30000", "'_funnel_metrics'!A1:L30000", "'_metric_identity_bridge'!A1:H30000", "'_appointment_registry'!A1:AA30000"]);
  assert.equal(calls.length, 1); assert.equal(calls[0].url.searchParams.get("dateTimeRenderOption"), "SERIAL_NUMBER");
  assert.equal(calls[0].url.searchParams.get("valueRenderOption"), "UNFORMATTED_VALUE");
  const normalized = await table.normalizeMetaLeadRowsInLiveTable({ configuration: config, liveTable: live, brands, writeBack: true });
  assert.equal(normalized.arrivalOutcomeAuthority, live.arrivalOutcomeAuthority);
  rewrite = true;
  await assert.rejects(table.normalizeMetaLeadRowsInLiveTable({ configuration: config, liveTable: live, brands, writeBack: true }), /暫時未能確認/);
  assert.equal(calls.length, 1, "No managed normalization write on incoherent source/projection"); rewrite = false;
  for (const changed of [{ headerRow: 2 }, { tabName: "other" }, { maxRows: 5000 }]) {
    await assert.rejects(table.readLiveLeadTable({ ...config, ...changed }), /暫時未能確認/);
  }
  payload.valueRanges[2].values[0][0] = "Identity";
  await assert.rejects(table.readLiveLeadTable(config), /暫時未能確認/);
  payload.valueRanges.pop();
  await assert.rejects(table.readLiveLeadTable(config), /暫時未能確認/);
  // Legacy callers retain their original two-range contract.
  await table.readLiveLeadTable({ ...config, sourceProfile: "legacy" });
  assert.equal(calls.at(-1).url.searchParams.getAll("ranges").length, 2);
  globalThis.setTimeout = (callback, ms, ...args) => originalTimeout(callback, ms === 15000 ? 1 : ms, ...args);
  for (const mode of ["stalled-fetch", "stalled-body"]) {
    providerMode = mode;
    await assert.rejects(table.readLiveLeadTable(config), (error) => error.reason === "managed_read_timeout" && error.counts.timeoutMs === 15000);
    assert.equal(calls.at(-1).init.signal.aborted, true);
  }
} finally { globalThis.fetch = originalFetch; globalThis.setTimeout = originalTimeout; }
console.log(`PASS: registry authority, Lead/Book preservation, ${rejected} malformed projections, exact identity coverage, metadata/no-phone rows, future dates, managed gateway, no unsafe writeback and bounded fetch/body`);
