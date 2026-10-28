import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url), cache = new Map();
let authMode = "ok", authCalls = [];
const mocks = {
  "server-only": {},
  "@/lib/integrations/googleSheetsOAuth": {
    getGoogleSheetsOAuthAccessToken: async options => {
      authCalls.push(options);
      return authMode === "stalled" ? new Promise(() => {}) : "synthetic-token";
    },
  },
  "@/lib/integrations/metaLeadFormSheetNormalizer": { normalizeMetaLeadFormRows: () => ({}) },
};
function load(path) {
  if (cache.has(path)) return cache.get(path).exports;
  const module = { exports: {} }; cache.set(path, module);
  const compiled = ts.transpileModule(readFileSync(new URL("../" + path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "module", "exports", compiled)(
    name => mocks[name] ?? (name.startsWith("@/") ? load("src/" + name.slice(2) + ".ts") : require(name)), module, module.exports);
  return module.exports;
}
const reader = load("src/lib/integrations/googleSheetsLeadTable.ts");
const { ARRIVAL_REVENUE_HEADERS } = load("src/lib/reports/arrivalRevenue.ts");
const { REPORT_TREATMENT_HEADERS, buildReportTreatmentClassifier } = load("src/lib/reports/treatmentCategories.ts");
const config = { sourceProfile: "alyssa_workspace_lead_funnel", spreadsheetId: "synthetic_workbook_123456789" };
const positions = [0, 6, 7, 10, 13, 22, 31, 32, 33];
const arrivalHeaders = Array(38).fill("");
positions.forEach((col, i) => arrivalHeaders[col] = ARRIVAL_REVENUE_HEADERS[i]);
const arrivalRows = [["GOS Beauty", "已到店", 46298, "GOS Beauty", "Synthetic abdomen offer", "synthetic-appointment", 100, 900, 1000]];
const categoryHeaders = ["Lookup Key", "Account", "Brand", "Original Treatment", "Dashboard 技術分類"];
const categoryRows = [
  ["synthetic-breast", "GOS Beauty", "GOS Beauty", "Synthetic breast offer", "BTL EXILIS 胸"],
  ["synthetic-abdomen", "GOS Beauty", "GOS Beauty", "Synthetic abdomen offer", "BTL EXILIS 腹"],
];
const arrivalHeaderRange = "'到店紀錄'!A7:AL7", categoryHeaderRange = "'_dashboard_treatment_map'!A1:E1";
const arrivalRanges = positions.map(col => {
  let name = "";
  for (let n = col + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + (n - 1) % 26) + name;
  return "'到店紀錄'!" + name + "8:" + name + "766";
});
const categoryRanges = ["B", "D", "E"].map(col => "'_dashboard_treatment_map'!" + col + "2:" + col + "5000");

const original = { fetch: globalThis.fetch, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
let calls = [], mode = "ok", now = 0, sequence = 0, timers = new Map(), held = [];
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
function observe(promise) {
  const result = { state: "pending" };
  result.done = promise.then(value => { result.state = "resolved"; result.value = value; }, error => { result.state = "rejected"; result.error = error; });
  return result;
}
async function advance(ms) {
  now += ms;
  for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.run(); await flush(); }
  await flush();
}
function reset(next = "ok") {
  assert.equal(timers.size, 0, "Every completed read releases its deadline");
  calls = []; authCalls = []; authMode = "ok"; now = 0; mode = next; held = [];
}
function reply(url) {
  if (!url.pathname.endsWith("values:batchGet")) return {
    sheets: [
      { properties: { title: "到店紀錄", gridProperties: { rowCount: 766, columnCount: 38 } } },
      { properties: { title: "_dashboard_treatment_map", gridProperties: { rowCount: 5000, columnCount: 5 } } },
    ],
  };
  const ranges = url.searchParams.getAll("ranges"), dataRead = ranges.some(range => arrivalRanges.includes(range) || categoryRanges.includes(range));
  const valueRanges = ranges.map(range => {
    if (range === arrivalHeaderRange) return { values: [arrivalHeaders] };
    if (range === categoryHeaderRange) return { values: [mode === "changed" && dataRead ? [...categoryHeaders, "changed"] : categoryHeaders] };
    const arrivalIndex = arrivalRanges.indexOf(range);
    if (arrivalIndex >= 0) return { values: arrivalRows.map(row => [row[arrivalIndex]]) };
    const categoryIndex = categoryRanges.indexOf(range);
    if (categoryIndex >= 0) return { values: categoryRows.map(row => [row[[1, 3, 4][categoryIndex]]]) };
    throw Error("Unexpected range: " + range);
  });
  return { valueRanges: mode === "truncated" && dataRead ? valueRanges.slice(1) : valueRanges };
}
try {
  globalThis.setTimeout = (run, ms, ...args) => {
    const id = ++sequence; timers.set(id, { at: now + ms, run: () => run(...args) }); return id;
  };
  globalThis.clearTimeout = id => timers.delete(id);
  globalThis.fetch = async (url, init) => {
    const parsed = new URL(url); calls.push({ url: parsed, init });
    if (mode === "stalled") return new Promise(() => {});
    const response = { ok: true, json: async () => {
      if (mode === "body-stall") return new Promise(() => {});
      return reply(parsed);
    } };
    if (mode === "slow-first" && calls.length === 1 || mode === "phases") return new Promise(resolve => held.push(() => resolve(response)));
    return response;
  };

  reset("slow-first");
  const slow = observe(reader.readLiveReportTreatmentTable(config)); await flush();
  await advance(25_000);
  assert.equal(slow.state, "pending", "A healthy 25-second report source read must survive the old 15-second widget deadline");
  held.shift()(); await slow.done;
  assert.equal(slow.state, "resolved");
  assert.deepEqual(slow.value.rows, categoryRows.map(row => [row[1], row[3], row[4]]));

  reset();
  const arrival = await reader.readLiveArrivalRevenueTable(config);
  assert.deepEqual(arrival.headers, [...ARRIVAL_REVENUE_HEADERS]); assert.deepEqual(arrival.rows, arrivalRows);
  assert.equal(calls.length, 3); assert.deepEqual(calls[2].url.searchParams.getAll("ranges"), [...arrivalRanges, arrivalHeaderRange]);

  reset();
  const both = await reader.readLiveReportTables(config);
  assert.equal(calls.length, 3, "Two report sources share metadata, header discovery and a single evaluated data snapshot");
  assert.equal(authCalls.length, 1); assert.equal(authCalls[0].recordHealth, false);
  assert.deepEqual(calls[1].url.searchParams.getAll("ranges"), [arrivalHeaderRange, categoryHeaderRange]);
  assert.deepEqual(calls[2].url.searchParams.getAll("ranges"), [...arrivalRanges, ...categoryRanges, arrivalHeaderRange, categoryHeaderRange]);
  assert.deepEqual(both.arrivalRevenue.rows, arrivalRows);
  assert.deepEqual(both.treatmentCategories.headers, [...REPORT_TREATMENT_HEADERS]);
  assert.deepEqual(both.treatmentCategories.rows, categoryRows.map(row => [row[1], row[3], row[4]]));
  assert.equal(both.arrivalRevenue.readAt, both.treatmentCategories.readAt);
  const classify = buildReportTreatmentClassifier(both.treatmentCategories);
  assert.equal(classify("GOS Beauty", "Synthetic breast offer"), "BTL EXILIS 胸");
  assert.equal(classify("GOS Beauty", "Synthetic abdomen offer"), "BTL EXILIS 腹");
  assert.ok(calls.every(call => call.init.cache === "no-store" && call.init.signal === authCalls[0].signal));
  assert.ok(calls.every(call => (call.init.method ?? "GET") === "GET"));
  assert.equal(calls[2].url.searchParams.get("valueRenderOption"), "UNFORMATTED_VALUE");
  assert.equal(calls[2].init.headers["Accept-Encoding"], "gzip");

  const before = calls.length;
  await assert.rejects(reader.readLiveReportTables({ ...config, sourceProfile: "other" }));
  await assert.rejects(reader.readLiveReportTables({ ...config, spreadsheetId: "https://untrusted.invalid" }));
  assert.equal(calls.length, before);
  for (const failure of ["changed", "truncated"]) {
    reset(failure);
    await assert.rejects(reader.readLiveReportTables(config), /讀取期間有變|讀取不完整/);
  }

  reset("phases");
  const phased = observe(reader.readLiveReportTables(config)); await flush();
  await advance(20_000); held.shift()(); await flush();
  await advance(20_000); held.shift()(); await flush();
  assert.equal(calls.length, 3);
  await advance(19_999); assert.equal(phased.state, "pending");
  await advance(1); await phased.done;
  assert.equal(phased.error.reason, "managed_read_timeout");
  assert.deepEqual(phased.error.counts, { timeoutMs: 60_000 });
  assert.ok(calls.every(call => call.init.signal.aborted), "The shared deadline never resets for the next source or provider stage");

  for (const stalled of ["stalled", "body-stall", "auth-stall"]) {
    reset(stalled === "auth-stall" ? "ok" : stalled);
    if (stalled === "auth-stall") authMode = "stalled";
    const result = observe(reader.readLiveReportTables(config)); await flush();
    await advance(59_999); assert.equal(result.state, "pending");
    await advance(1); await result.done;
    assert.equal(result.error.reason, "managed_read_timeout");
    assert.equal(authCalls[0].signal.aborted, true, "Token refresh, fetch and response bodies all share the deadline");
    if (stalled === "auth-stall") assert.equal(calls.length, 0);
  }

  reset("stalled");
  const parent = new AbortController(), cancelled = observe(reader.readLiveReportTables(config, { signal: parent.signal })); await flush();
  parent.abort(); await cancelled.done;
  assert.equal(cancelled.state, "rejected"); assert.equal(calls[0].init.signal.aborted, true);
  assert.equal(timers.size, 0);
} finally {
  globalThis.fetch = original.fetch; globalThis.setTimeout = original.setTimeout; globalThis.clearTimeout = original.clearTimeout;
}
console.log("PASS: report sources share three GETs and one complete financial/category snapshot; 25s success, 60s OAuth/fetch/body deadline, caller cancellation, schema-race and incomplete-response rejection; no customer/phone/CS reads or writes");

