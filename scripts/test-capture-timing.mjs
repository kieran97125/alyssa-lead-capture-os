import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const before = readFileSync(process.argv[2], "utf8");
const after = readFileSync(process.argv[3], "utf8");
const scenarios = ["new", "existing", "duplicate", "empty", "busy", "backoff", "source-changed", "ledger-changed", "index-timeout", "append-timeout", "cursor-failure", "log-failure"];
function execute(source, mode) {
  const calls = [], logs = [], props = new Map(), appended = [];
  let reads = 0, ledgerReads = 0;
  const fixed = 1791200000000;
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [fixed])); } static now() { return fixed; } }
  if (mode === "backoff") props.set("OMNI_CAPTURE_RETRY_AFTER", String(fixed + 10000));
  const invoke = (name, value) => { calls.push(name); return value; };
  const record = ["synthetic-private-phone", "synthetic-private-customer"];
  const sheet = {
    getLastRow: () => invoke("source.bounds", mode === "empty" ? 1 : mode === "duplicate" ? 3 : 2),
    getRange: (...args) => { invoke(`source.range:${args.join(",")}`); return {
      getValues: () => { invoke("source.values"); reads++; return mode === "source-changed" && reads > 1 ? [["changed"]] : mode === "duplicate" ? [record, record] : [record]; },
    }; },
  };
  const ledger = { getLastRow: () => { ledgerReads++; return invoke("ledger.bounds", mode === "ledger-changed" && ledgerReads > 1 ? 3 : 2); } };
  const spreadsheet = { getSheetByName: (name) => invoke(`source.lookup:${name}`, sheet) };
  const context = vm.createContext({
    Date: Clock, Set, Map, JSON, console: { log(text) {
      const entry = JSON.parse(text.startsWith("{") ? text : "{}");
      if (entry.phase) { if (mode === "log-failure") throw Error("logger failed"); logs.push(entry); }
    } },
    LockService: { getDocumentLock: () => { invoke("lock.get"); return {
      tryLock: (ms) => invoke(`lock.try:${ms}`, mode !== "busy"), releaseLock: () => invoke("lock.release"),
    }; } },
    PropertiesService: { getScriptProperties: () => { invoke("props.get"); return {
      getProperty: (key) => invoke(`props.read:${key}`, props.get(key)),
      setProperty: (key, value) => { invoke(`props.write:${key}`); if (mode === "cursor-failure" && key.includes("CURSOR")) throw Error("cursor failed"); props.set(key, value); },
    }; } },
    SpreadsheetApp: { getActiveSpreadsheet: () => invoke("spreadsheet.active", spreadsheet) },
  });
  vm.runInContext(source, context);
  Object.assign(context, {
    getOmniColumns_: () => invoke("source.headers", { CREATED_AT: 1 }), leadDataWidth_: () => 2,
    rowRecord_: () => ({ createdAt: "2026-10-01", status: "lead" }), stableIdentity_: () => "synthetic-identity",
    ensureEventSheet_: () => invoke("ledger.headers", ledger),
    getEventIndex_: () => { invoke("ledger.index"); if (mode === "index-timeout") throw Error("Service Spreadsheets timed out"); return new Set(mode === "existing" ? ["synthetic-identity|lead"] : []); },
    buildEventRow_: () => ["synthetic-event"], clean_: (v) => v, today_: () => "2026-10-05",
    appendOmniEventsWithIndex_: (_, rows) => { invoke("ledger.append"); appended.push(...rows); if (mode === "append-timeout") throw Error("Service Spreadsheets timed out"); return rows.length; },
  });
  let result, error;
  try { result = context.captureMissingLeadEvents(); } catch (caught) { error = caught.message; }
  for (const log of logs) {
    assert.ok(["admission", "source_lookup", "source_headers", "source_bounds", "source_read", "source_verify", "ledger_headers", "ledger_bounds", "ledger_index", "ledger_verify", "append", "cursor_write"].includes(log.phase));
    assert.ok(Object.keys(log).every((key) => ["handler", "phase", "state", "durationMs", "elapsedMs", "reason"].includes(key)));
    assert.doesNotMatch(JSON.stringify(log), /synthetic-private|Alyssa|phone|customer/);
  }
  return { business: JSON.parse(JSON.stringify({ calls, props: [...props], appended, result, error })), logs };
}
for (const mode of scenarios) {
  const original = execute(before, mode), timed = execute(after, mode);
  assert.deepEqual(timed.business, original.business, `${mode}: observable business behavior must stay identical`);
  if (mode !== "log-failure") assert.ok(timed.logs.length > 0);
}
console.log(`PASS: ${scenarios.length} differential capture scenarios; service calls, locks, append/cursor/backoff, errors and static-log privacy`);
