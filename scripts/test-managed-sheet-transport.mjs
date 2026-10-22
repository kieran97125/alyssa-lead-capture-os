import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { gzipSync } from "node:zlib";
import ts from "typescript";

// Offline virtual-clock tests: no Google, database, real waits or Sheet writes.
const nativeRequire = createRequire(import.meta.url), modules = new Map();
const mocks = {
  "server-only": {},
  "@/lib/integrations/googleSheetsOAuth": { getGoogleSheetsOAuthAccessToken: async () => "synthetic-token" },
  "@/lib/integrations/metaLeadFormSheetNormalizer": {},
};
function load(path) {
  if (modules.has(path)) return modules.get(path).exports;
  const module = { exports: {} }; modules.set(path, module);
  const compiled = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: path,
  });
  new Function("require", "module", "exports", compiled.outputText)(
    name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith("@/") ? load(`src/${name.slice(2)}.ts`) : nativeRequire(name), module, module.exports);
  return module.exports;
}
const table = load("src/lib/integrations/googleSheetsLeadTable.ts");
const arrival = load("src/lib/marketing/leadArrivalOutcomeAuthority.ts");
const pending = load("src/lib/marketing/leadPendingAppointmentAuthority.ts");
const config = { spreadsheetId: "synthetic_sheet_id_12345", sourceProfile: "alyssa_workspace_lead_funnel", headerRow: 1, tabName: "lead", maxRows: 30000 };
const headers = ["Account", "跟進狀態", "電話", "CS Remark"];
const rows = [["Alyssa Main", "待跟進", "10000001", "Synthetic remark\n繁體中文 / 0 false"]];
const fixture = { valueRanges: [
  { values: [headers] }, { values: rows },
  { values: [arrival.ARRIVAL_METRIC_HEADERS, ["Alyssa Main|p:10000001", "Alyssa Main", "Alyssa", "Synthetic treatment", "2026-10-01", "", "", "", 0, 0, 0, 2]] },
  { values: [pending.PENDING_BRIDGE_HEADERS, ["synthetic-source", "Alyssa Main|p:10000001", 2, true, "", true, true, true]] },
  { values: [pending.PENDING_REGISTRY_HEADERS] },
] };
const expectedRanges = ["'lead'!A1:Y1", "'lead'!A2:Y30000", "'_funnel_metrics'!A1:L30000", "'_metric_identity_bridge'!A1:H30000", "'_appointment_registry'!A1:AA30000"];
const original = { fetch: globalThis.fetch, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout, abortTimeout: AbortSignal.timeout };
let now = 0, sequence = 0, timers = new Map(), calls = [], completeFetch, completeBody, mode;
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
function reset(nextMode) {
  assert.equal(timers.size, 0, "Every prior deadline must be released");
  now = 0; calls = []; completeFetch = completeBody = undefined; mode = nextMode;
}
async function advance(milliseconds) {
  now += milliseconds;
  let ready;
  while ((ready = [...timers].filter(([, t]) => t.at <= now)).length) {
    for (const [id, timer] of ready) { timers.delete(id); timer.run(); }
    await flush();
  }
  await flush();
}
function observed(promise) {
  const result = { state: "pending" };
  result.done = promise.then(value => { result.state = "resolved"; result.value = value; }, error => { result.state = "rejected"; result.error = error; });
  return result;
}
function response() {
  return { ok: true, json: () => mode === "body-stall" ? new Promise(resolve => { completeBody = resolve; }) : Promise.resolve(structuredClone(fixture)) };
}
try {
  globalThis.setTimeout = (run, milliseconds, ...args) => {
    const id = ++sequence; timers.set(id, { at: now + milliseconds, run: () => run(...args) }); return id;
  };
  globalThis.clearTimeout = id => { timers.delete(id); };
  AbortSignal.timeout = milliseconds => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), milliseconds);
    // Native timeout signals do not expose their timer for early cancellation.
    controller.signal.addEventListener("abort", () => clearTimeout(id), { once: true });
    return controller.signal;
  };
  globalThis.fetch = async (url, init) => {
    calls.push({ url: new URL(url), init });
    if (mode === "fetch-stall" || mode === "slow-success") return new Promise(resolve => { completeFetch = resolve; });
    return response();
  };

  reset("slow-success");
  const slow = observed(table.readLiveLeadTable(config));
  await flush();
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].url.searchParams.getAll("ranges"), expectedRanges, "Transport tuning cannot truncate or split the complete snapshot");
  assert.equal(calls[0].url.searchParams.get("prettyPrint"), "false");
  assert.equal(calls[0].url.searchParams.get("fields"), "valueRanges(values)");
  assert.equal(calls[0].url.searchParams.get("valueRenderOption"), "UNFORMATTED_VALUE");
  assert.equal(calls[0].url.searchParams.get("dateTimeRenderOption"), "SERIAL_NUMBER");
  assert.equal(calls[0].init.headers["Accept-Encoding"], "gzip");
  assert.match(calls[0].init.headers["User-Agent"], /gzip/);
  assert.equal(calls[0].init.cache, "no-store");
  assert.equal(calls[0].init.method ?? "GET", "GET");
  await advance(25_000);
  assert.equal(slow.state, "pending", "Explicit complete refresh must survive the old 15 s widget deadline");
  assert.equal(calls[0].init.signal.aborted, false);
  completeFetch(response()); await slow.done;
  assert.equal(slow.state, "resolved");
  assert.deepEqual(slow.value.headers, headers);
  assert.deepEqual(slow.value.rows, rows, "Compact response must preserve every original scalar and remark");
  assert.equal(slow.value.arrivalOutcomeAuthority.rowCount, 1);

  for (const stalled of ["fetch-stall", "body-stall"]) {
    reset(stalled);
    const run = observed(table.readLiveLeadTable(config)); await flush();
    if (stalled === "body-stall") assert.equal(typeof completeBody, "function");
    await advance(59_999); assert.equal(run.state, "pending");
    await advance(1); await run.done;
    assert.equal(run.state, "rejected");
    assert.equal(run.error.reason, "managed_read_timeout");
    assert.deepEqual(run.error.counts, { timeoutMs: 60_000 });
    assert.equal(calls[0].init.signal.aborted, true, "Deadline aborts outstanding provider work, including ignored-abort bodies");
  }

  reset("fetch-stall");
  const readOnly = observed(table.readLiveLeadTable(config, { readOnly: true })); await flush();
  await advance(11_999); assert.equal(readOnly.state, "pending");
  await advance(1); await readOnly.done;
  assert.equal(readOnly.state, "rejected");
  assert.match(readOnly.error.message, /Lead Sheet 讀取逾時/);
  assert.equal(calls[0].init.signal.aborted, true, "Read-only dashboard keeps its 12 s whole-request deadline");

  reset("fetch-stall");
  const report = observed(table.readLiveReportTreatmentTable(config)); await flush();
  await advance(14_999); assert.equal(report.state, "pending");
  await advance(1); await report.done;
  assert.equal(report.state, "rejected");
  assert.equal(report.error.reason, "managed_read_timeout");
  assert.deepEqual(report.error.counts, { timeoutMs: 15_000 }, "Unrelated report helpers retain their existing budget");

  // Synthetic size evidence only: compressed compact JSON has identical data.
  const repeated = { valueRanges: [{ values: Array.from({ length: 1000 }, () => rows[0]) }] };
  const compact = JSON.stringify(repeated), pretty = JSON.stringify(repeated, null, 2);
  assert.deepEqual(JSON.parse(compact), JSON.parse(pretty));
  assert.ok(Buffer.byteLength(compact) < Buffer.byteLength(pretty));
  assert.ok(gzipSync(compact).length < Buffer.byteLength(compact));
  assert.equal(timers.size, 0);
} finally {
  globalThis.fetch = original.fetch; globalThis.setTimeout = original.setTimeout;
  globalThis.clearTimeout = original.clearTimeout; AbortSignal.timeout = original.abortTimeout;
}
console.log("PASS: compact gzip complete single-batch transport, unchanged cells/ranges, >15 s explicit success, 60 s fetch/body abort, 12 s dashboard and 15 s reports; virtual clock only");
