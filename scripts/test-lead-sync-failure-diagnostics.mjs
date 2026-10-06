import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

// Exercise the real persistent failure recorder without contacting a database.
const native = createRequire(import.meta.url), inserted = [];
const database = { from(table) {
  let row;
  const query = {
    insert(value) { row = value; inserted.push({ table, row }); return query; },
    select() { return query; },
    single() { return Promise.resolve({ data: { id: "synthetic-run" }, error: null }); },
    then(resolve, reject) { return Promise.resolve({ data: row, error: null }).then(resolve, reject); },
  };
  return query;
} };
const source = readFileSync(new URL("../src/lib/marketing/leadSheetAudit.ts", import.meta.url), "utf8");
const module = { exports: {} };
new Function("require", "module", "exports", ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)((name) => {
  if (name === "server-only" || name === "@/lib/marketing/leadSheetAuditContract") return {};
  if (name === "@/lib/supabase/admin") return { createSupabaseAdminClient: () => database };
  return native(name);
}, module, module.exports);
const diagnostic = { reason: "arrival_coverage", phase: "projection_validation", elapsedMs: 4200,
  counts: { sourceGroups: 10, projectionGroups: 9, missingGroups: 1 },
  readAttempts: [{ attempt: 1, elapsedMs: 1800, reason: "arrival_coverage", counts: { missingGroups: 1 } },
    { attempt: 2, elapsedMs: 1400, reason: "arrival_coverage", counts: { missingGroups: 1 } }] };
await module.exports.recordLeadSheetAuditFailure({ dataSourceId: "synthetic-source", startedAt: "2026-10-01T00:00:00Z", error: new Error("Synthetic safe failure"), diagnostic });
assert.deepEqual(inserted[0].row.summary_json.syncFailure, diagnostic, "Reason and both attempt timings must survive in persistent audit storage");
assert.equal(inserted[0].row.status, "failed");
assert.equal(inserted[1].row.risk_code, "sync_failed");
await module.exports.recordLeadSheetAuditFailure({ dataSourceId: "synthetic-source", startedAt: "2026-10-01T00:00:00Z", error: new Error("Synthetic safe failure") });
assert.deepEqual(inserted[2].row.summary_json, {}, "Legacy failure callers remain supported");
console.log("PASS: failed sync audit persists classified reason, counts and both attempt timings without a schema change; legacy callers supported");
