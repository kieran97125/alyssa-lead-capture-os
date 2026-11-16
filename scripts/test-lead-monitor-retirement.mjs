import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import ts from "typescript";

// Exercise the real quiet source capture, encryption, publication and reader.
// The in-memory provider implements the existing RPC's complete-entry/stale-run
// transaction contract; no Google request or application DB mutation is allowed.
const native = createRequire(import.meta.url);
const originalKey = process.env.LEAD_AUDIT_ENCRYPTION_KEY;
const originalFixtures = process.env.ALYSSA_E2E_FIXTURES;
const originalFetch = globalThis.fetch;
process.env.LEAD_AUDIT_ENCRYPTION_KEY = Buffer.alloc(32, 19).toString("base64");
delete process.env.ALYSSA_E2E_FIXTURES;
globalThis.fetch = async () => { throw new Error("Unexpected external request"); };
const headers = ["Created At", "最後更新日期", "品牌", "Account", "電話", "跟進狀態", "療程項目", "lead_key", "預約日期", "CS Remark", "確認到店日期"];
const row = (id) => ["2026-11-01", "2026-11-16", "GOS Beauty", "GOS Beauty", String(10000000 + id), "未聯絡", "Qualification treatment", `fixture-${id}`, "", "Synthetic private remark", ""];
const beforeRows = Array.from({ length: 20 }, (_, index) => row(index + 1));
const afterRows = [[...row(1)], row(2), row(999)];
afterRows[0][5] = "已預約";
afterRows[0][8] = "2026-11-17";
const brands = [{ id: "gos", name: "GOS Beauty", slug: "gos-beauty", primary_color: null }];
const configuration = { sourceProfile: "alyssa_workspace_lead_funnel", spreadsheetId: "synthetic-sheet", tabName: "lead" };
const completedAt = "2026-11-16T09:30:00.000Z";
const state = { runs: [], versions: new Map(), entries: new Map(), captures: [], reads: [], inserts: [], publications: 0,
  indexError: false, latestError: false, rpcError: false, pageCap: 7 };
const matches = (value, filters) => filters.every(([key, expected]) => value[key] === expected);

function database() {
  return {
    from(table) {
      let operation = "read", values, columns = "", publishedOnly = false, range;
      const filters = [];
      const query = {
        select(value) { columns = value; state.reads.push({ table, columns }); return query; },
        eq(key, value) { filters.push([key, value]); return query; },
        in() { return query; }, order() { return query; }, limit() { return query; },
        abortSignal() { return query; },
        not() { publishedOnly = true; return query; }, is() { return query; },
        insert(value) { operation = "insert"; values = value; return query; },
        update(value) { operation = "update"; values = value; return query; },
        maybeSingle() { return query; }, single() { return query; },
        range(from, through) {
          assert.equal(table, "lead_sheet_audit_snapshot_entries");
          assert.ok(!/payload_|subject_label|key_version/.test(columns), "Production refresh must not read/decrypt previous customer payloads");
          range = [from, through]; return query;
        },
        then(resolve, reject) {
          let result = { data: null, error: null };
          if (table === "marketing_data_sources") result.data = { id: "source", configuration, status: "connected", last_sync_at: completedAt, last_success_at: completedAt };
          else if (table === "lead_sheet_audit_snapshot_entries") {
            if (state.indexError) result.error = new Error("Synthetic optional index outage");
            else {
              const runId = filters.find(([key]) => key === "run_id")[1];
              result.data = (state.entries.get(runId) ?? []).slice(range[0], Math.min(range[1] + 1, range[0] + state.pageCap));
            }
          } else if (table === "lead_sheet_audit_runs" && operation === "read") {
            if (state.latestError) result.error = new Error("Synthetic primary storage outage");
            else result.data = [...state.runs].reverse().find((run) => matches(run, filters) && (!publishedOnly || run.summary_json.leadDashboardSnapshot)) ?? null;
          } else if (table === "lead_sheet_audit_runs" && operation === "update") {
            const run = state.runs.find((run) => matches(run, filters));
            if (!run || run.summary_json.leadDashboardSnapshot) result.error = new Error("Publication conflict");
            else { Object.assign(run, values); result.data = { id: run.id }; state.publications += 1; }
          } else if (operation === "insert") {
            state.inserts.push({ table, values });
            result.data = { id: "diagnostic-run" };
          } else throw new Error(`Unexpected provider operation ${table}/${operation}`);
          return Promise.resolve(result).then(resolve, reject);
        },
      };
      return query;
    },
    async rpc(name, input) {
      assert.equal(name, "commit_lead_sheet_audit_snapshot");
      state.captures.push(input);
      assert.deepEqual(input.p_changes, [], "No row addition, deletion or staff edit may generate a monitor alert");
      assert.equal(input.p_summary.rowChangeMonitoring, "retired");
      assert.ok(["baseline", "completed"].includes(input.p_status), "Ordinary edits must never quarantine a source");
      if (state.rpcError) return { data: null, error: new Error("Synthetic snapshot transaction failure") };
      assert.equal(input.p_previous_run_id, state.runs.at(-1)?.id ?? null, "The stale-run transaction guard remains authoritative");
      const versions = new Map(state.versions);
      for (const version of input.p_versions) versions.set(`${version.recordKey}:${version.contentHash}`, version);
      assert.equal(input.p_entries.length, input.p_row_count);
      for (const entry of input.p_entries) assert.ok(versions.has(`${entry.recordKey}:${entry.contentHash}`), "Every current entry must resolve to a complete encrypted version");
      const id = `run-${state.runs.length + 1}`;
      state.versions = versions;
      state.runs.push({ id, data_source_id: input.p_data_source_id, row_count: input.p_row_count, summary_json: input.p_summary, status: input.p_status });
      state.entries.set(id, input.p_entries.map((entry) => ({ record_key: entry.recordKey, record_version: { content_hash: entry.contentHash } })));
      return { data: { runId: id, openAlerts: 0, warningCount: 0, criticalCount: 0 }, error: null };
    },
  };
}

const modules = new Map();
function load(path) {
  if (modules.has(path)) return modules.get(path).exports;
  const compiledModule = { exports: {} }; modules.set(path, compiledModule);
  const compiled = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }, fileName: path,
  }).outputText;
  new Function("require", "module", "exports", compiled)((name) => {
    if (name === "server-only") return {};
    if (name === "@/lib/supabase/admin") return { createSupabaseAdminClient: database, hasSupabaseAdminEnv: () => true };
    if (name === "next/navigation") return { redirect: (path) => { throw new Error(`REDIRECT:${path}`); } };
    if (name.startsWith("@/")) {
      const base = `src/${name.slice(2)}`;
      return load([`${base}.ts`, `${base}.tsx`].find((candidate) => existsSync(new URL(`../${candidate}`, import.meta.url))));
    }
    return native(name);
  }, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}

try {
  const audit = load("src/lib/marketing/leadSheetAudit.ts");
  const snapshots = load("src/lib/marketing/leadDashboardSnapshotStore.ts");
  const parser = load("src/lib/marketing/googleSheetsMetricParser.ts");
  const contract = load("src/lib/marketing/leadSheetAuditContract.ts");
  const comparison = (rows) => contract.prepareLeadAuditRecords({ headers, rows,
    hashIdentity: (value) => createHash("sha256").update(value).digest("hex") }).records
    .map((record) => ({ ...record, contentHash: createHash("sha256").update(JSON.stringify(record.canonical)).digest("hex") }));
  assert.equal(contract.buildLeadAuditDiff({ previous: comparison(beforeRows), current: comparison(afterRows) }).quarantined, true,
    "This fixture must exercise the removed mass-change trigger, not an innocuous unchanged source");
  const capture = (rows) => audit.captureLeadSheetAuditSnapshot({ dataSourceId: "source", startedAt: completedAt, headers, rows, headerRow: 1, brands });
  const parsed = (rows) => {
    const value = parser.buildLeadSheetGroups({ headers, rows, brands, sourceBrandId: null, appsScriptContract: false, dedupeByIdentity: true });
    for (const group of value.groups) {
      const row = group.rows.find((row) => row.rowNumber === group.pendingRowNumber);
      group.pendingAppointment = row?.appointmentDate ? { rowNumber: row.rowNumber, appointmentDate: row.appointmentDate,
        brandId: group.brandId, brandLabel: group.brandLabel, treatmentLabel: group.treatmentLabel } : null;
    }
    return value;
  };
  const publish = (runId, rows, changes = {}) => snapshots.publishLeadDashboardSnapshot({ dataSourceId: "source", configuration, brands,
    runId, completedAt, capturedAt: completedAt, parsed: parsed(rows), ...changes });
  const read = () => snapshots.readPublishedLeadDashboardSnapshot({ dataSourceId: "source", configuration, brands });

  const first = await capture(beforeRows);
  assert.equal(first.status, "baseline");
  await publish(first.runId, beforeRows);
  assert.equal((await read()).diagnostics.acceptedRows, 20);
  const updated = await capture(afterRows);
  assert.equal(updated.status, "completed");
  assert.equal(updated.quarantined, false);
  assert.equal(updated.openAlerts, 0);
  assert.equal(state.captures.at(-1).p_versions.length, 2, "Unchanged encrypted versions remain deduplicated despite provider pagination");
  await publish(updated.runId, afterRows);
  assert.equal((await read()).diagnostics.acceptedRows, 3, "A staff bulk delete/edit/add must publish the valid new complete dataset");
  assert.equal(state.publications, 2);
  assert.equal(state.inserts.filter((write) => write.table === "lead_sheet_audit_changes").length, 0);

  state.indexError = true;
  const recovered = await capture(afterRows);
  assert.equal(state.captures.at(-1).p_versions.length, 3, "Unavailable optional index encrypts all current records rather than blocking staff edits");
  await publish(recovered.runId, afterRows);
  assert.equal((await read()).diagnostics.acceptedRows, 3);
  state.indexError = false;
  const previousEnvelope = JSON.stringify(state.runs.at(-1).summary_json.leadDashboardSnapshot);
  state.rpcError = true;
  await assert.rejects(capture(afterRows), /snapshot transaction failure/);
  state.rpcError = false;
  state.latestError = true;
  const beforeRpc = state.captures.length;
  await assert.rejects(capture(afterRows), /primary storage outage/);
  assert.equal(state.captures.length, beforeRpc, "Primary storage failure must not fabricate a successful new snapshot");
  state.latestError = false;
  assert.equal(JSON.stringify(state.runs.at(-1).summary_json.leadDashboardSnapshot), previousEnvelope);
  assert.equal((await read()).diagnostics.acceptedRows, 3);
  const invalid = parsed(afterRows); invalid.diagnostics.acceptedRows += 1;
  const publicationCount = state.publications;
  await assert.rejects(publish(recovered.runId, afterRows, { parsed: invalid }), /未有可核對/);
  assert.equal(state.publications, publicationCount, "Retirement must not weaken complete published-data validation");

  const diagnostics = { reason: "arrival_coverage", phase: "projection_validation", elapsedMs: 42, counts: { missingGroups: 1 }, readAttempts: [] };
  await audit.recordLeadSheetAuditFailure({ dataSourceId: "source", startedAt: completedAt, error: new Error("Synthetic true projection failure"), diagnostic: diagnostics });
  assert.equal(state.inserts.length, 1);
  assert.equal(state.inserts[0].table, "lead_sheet_audit_runs");
  assert.deepEqual(state.inserts[0].values.summary_json.syncFailure, diagnostics);
  assert.equal(state.inserts[0].values.status, "failed");
  const readCount = state.reads.length;
  process.env.ALYSSA_E2E_FIXTURES = "1";
  assert.equal(await load("src/lib/marketing/leadSheetAuditView.ts").getLeadAuditNavigationSummary({ accessLevel: "master" }), 0);
  assert.equal(state.reads.length, readCount, "Retired badges must not query historical alerts, even in fixtures");
  assert.throws(() => load("src/app/lead-audit/page.tsx").default(), /REDIRECT:\/dashboard/);
  await assert.rejects(load("src/app/lead-audit/actions.ts").reviewLeadAuditChangeAction(new FormData()), /REDIRECT:\/dashboard/);
  assert.equal(state.inserts.length, 1, "Old review actions must perform no audit mutations");
  const boundary = load("src/lib/security/routeBoundary.ts");
  const permissions = load("src/lib/security/workspacePermissions.ts");
  assert.equal(boundary.isInternalRoute("/lead-audit"), true, "Retired bookmarks remain authenticated");
  assert.equal(boundary.requiresMasterOrExplicitLeadAuditAccess("/lead-audit"), false);
  assert.equal(boundary.getInternalRouteModule("/lead-audit"), "dashboard");
  assert.equal(permissions.getWorkspaceModuleForPath("/lead-audit"), "dashboard");
  console.log("PASS: real bulk staff add/edit/delete publishes a complete encrypted snapshot without row alerts/quarantine; storage dedupe and fallback work; true storage/projection failures retain last-good publication; retired navigation/action/auth boundaries are inert.");
} finally {
  if (originalKey === undefined) delete process.env.LEAD_AUDIT_ENCRYPTION_KEY; else process.env.LEAD_AUDIT_ENCRYPTION_KEY = originalKey;
  if (originalFixtures === undefined) delete process.env.ALYSSA_E2E_FIXTURES; else process.env.ALYSSA_E2E_FIXTURES = originalFixtures;
  globalThis.fetch = originalFetch;
}
