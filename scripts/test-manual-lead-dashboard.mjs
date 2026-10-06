import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

// This executes the real Dashboard reader and aggregation with synthetic saved
// data only. Any provider import, request or database write fails immediately.
const nativeRequire = createRequire(import.meta.url);
const originalFetch = globalThis.fetch;
const originalWarn = console.warn;
const originalFixtures = process.env.ALYSSA_E2E_FIXTURES;
delete process.env.ALYSSA_E2E_FIXTURES;
globalThis.fetch = async () => { throw new Error("Unexpected network request"); };
console.warn = () => {};

const brands = [
  { id: "gos", name: "GOS Beauty", slug: "gos-beauty", primary_color: null },
  { id: "alyssa", name: "Alyssa", slug: "alyssa", primary_color: null },
  { id: "medical", name: "Aesthetics Medical", slug: "aesthetics", primary_color: null },
  { id: "hidden", name: "Ineffable Beauty", slug: "ineffable", primary_color: null },
];
const configuration = {
  sourceProfile: "alyssa_workspace_lead_funnel",
  spreadsheetId: "synthetic-sheet-id",
  tabName: "lead",
  treatmentAliases: [
    { label: "GOS Catalog Option", brand: "GOS Beauty", keywords: ["catalog-only"] },
    { label: "Hidden Catalog Option", brand: "Ineffable Beauty", keywords: ["hidden-catalog"] },
  ],
};
const headers = ["最後更新日期", "Created At", "跟進狀態", "品牌", "Account", "電話",
  "確認到店日期", "預約日期", "預約時間", "療程項目", "分店", "CS Remark", "來源", "Campaign / 廣告"];
const rows = [
  ["2026-10-02", "2026-09-30", "已預約", "GOS Beauty", "GOS Beauty", "10000001", "", "2026-10-14", "14:30", "GOS First", "Synthetic Branch", "Synthetic follow-up", "Synthetic source", "Synthetic campaign"],
  ["2026-10-03", "2026-10-01", "已到店", "GOS Beauty", "GOS Beauty", "10000002", "2026-10-05", "2026-10-04", "15:00", "GOS Second"],
  ["2026-10-04", "2026-10-02", "no show", "GOS Beauty", "GOS Beauty", "10000003", "", "2026-10-06", "16:00", "GOS First"],
  ["2026-10-04", "2026-10-03", "未聯絡", "Alyssa", "Alyssa Main", "10000004", "", "", "", "Main Treatment"],
  ["2026-09-29", "2026-10-04", "已預約", "Alyssa", "Alyssa Aesthetics", "10000005", "", "2026-10-17", "17:00", "Facelift"],
  ["2026-10-06", "2026-09-29", "已到店", "Aesthetics Medical", "Alyssa Aesthetics", "10000006", "2026-09-30", "2026-10-06", "18:00", "Medical Treatment"],
  ["2026-10-03", "2026-10-02", "已預約", "Ineffable Beauty", "Ineffable", "10000007", "", "2026-10-08", "19:00", "Hidden Treatment", "Hidden Branch", "Hidden follow-up"],
];
const master = { source: "shared_password", accessLevel: "master" };
const restricted = { source: "supabase_auth", accessLevel: "admin", brandIds: ["gos"] };
const filters = { startDate: "2026-10-01", endDate: "2026-10-06" };
const savedAt = "2026-10-06T08:12:00.000Z";
let source;
let saved;
let savedError;
let sourceError;
let brandError;
let hasAdminEnv = true;
let access = master;
let calls;

function reset() {
  source = { id: "synthetic-source", display_name: "Synthetic Lead Sheet", status: "connected",
    // A subsequent unrelated source sync must not falsely freshen the saved lead
    // snapshot's data time.
    last_success_at: "2026-10-06T09:00:00.000Z", configuration };
  saved = { ...parsed, loadedAt: savedAt };
  savedError = null;
  sourceError = null;
  brandError = null;
  hasAdminEnv = true;
  access = master;
  calls = { admin: 0, queries: [], saved: [], spend: [], annotations: [], auth: 0 };
}
function database() {
  calls.admin++;
  return { from(table) {
    assert.ok(["marketing_data_sources", "brands"].includes(table), `Unexpected table: ${table}`);
    calls.queries.push(table);
    const query = {
      select() { return query; }, eq() { return query; }, neq() { return query; },
      order() { return query; }, maybeSingle() { return query; },
      then(resolve, reject) {
        return Promise.resolve(table === "brands"
          ? { data: brands, error: brandError }
          : { data: source, error: sourceError }).then(resolve, reject);
      },
    };
    return query;
  } };
}
const mocks = {
  "server-only": {},
  "@/lib/supabase/admin": { createSupabaseAdminClient: database, hasSupabaseAdminEnv: () => hasAdminEnv },
  "@/lib/security/internalAccessServer": { getCurrentInternalAccess: async () => { calls.auth++; return access; } },
  "@/lib/marketing/leadDashboardSnapshotStore": {
    readPublishedLeadDashboardSnapshot: async (input) => {
      calls.saved.push(input);
      if (savedError) throw savedError;
      return saved;
    },
  },
  "@/lib/marketing/operationalAnnotationStore": {
    getOperationalAnnotations: async (input) => { calls.annotations.push(input); return []; },
  },
  "@/lib/marketing/performanceCosts": {
    fetchDailySpendFacts: async (input) => {
      calls.spend.push(input);
      return brands.filter((brand) => !input.allowedBrandIds || input.allowedBrandIds.includes(brand.id))
        .map((brand) => ({ brandId: brand.id, spendDate: "2026-10-02", amount: brand.id === "gos" ? 120 : 300 }));
    },
  },
};
const modules = new Map();
function load(path) {
  if (modules.has(path)) return modules.get(path).exports;
  const loadedModule = { exports: {} };
  modules.set(path, loadedModule);
  const compiled = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: path,
  });
  const require = (name) => {
    assert.ok(!/googleSheets(?:LeadTable|OAuth)|google-auth-library/.test(name), `Dashboard must not import a Google provider: ${name}`);
    return Object.hasOwn(mocks, name) ? mocks[name]
      : name.startsWith("@/") ? load(`src/${name.slice(2)}.ts`) : nativeRequire(name);
  };
  new Function("require", "module", "exports", compiled.outputText)(require, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
const parsed = load("src/lib/marketing/googleSheetsMetricParser.ts").buildLeadSheetGroups({
  headers, rows, brands, sourceBrandId: null, appsScriptContract: false, dedupeByIdentity: true,
});
assert.equal(parsed.groups.length, 7, "Every synthetic identity must be retained in the saved canonical dataset");
const { getLeadDashboardSnapshot } = load("src/lib/marketing/leadDashboard.ts");
const counts = (snapshot) => [snapshot.totals.leads, snapshot.totals.bookings,
  snapshot.totals.shows, snapshot.totals.noShows, snapshot.totals.outstanding];
const sumTrend = (snapshot, key) => snapshot.trendSeries.flatMap((series) => series.points)
  .reduce((sum, point) => sum + point[key], 0);
function assertNoPrivateReads() {
  assert.equal(calls.admin, 0);
  assert.deepEqual(calls.queries, []);
  assert.deepEqual(calls.saved, []);
  assert.deepEqual(calls.spend, []);
  assert.deepEqual(calls.annotations, []);
}

async function verifyRealSnapshotStore() {
  const keyNames = ["LEAD_AUDIT_ENCRYPTION_KEY", "LEAD_AUDIT_ACTIVE_KEY_VERSION", "LEAD_AUDIT_DECRYPTION_KEYS_JSON"];
  const previousKeys = keyNames.map((name) => process.env[name]);
  process.env.LEAD_AUDIT_ENCRYPTION_KEY = "42".repeat(32);
  process.env.LEAD_AUDIT_ACTIVE_KEY_VERSION = "synthetic-test-v1";
  delete process.env.LEAD_AUDIT_DECRYPTION_KEYS_JSON;
  let state;
  const valueAt = (row, field) => field.split("->").reduce((value, key) => value?.[key], row);
  const databaseMock = () => ({ from(table) {
    assert.ok(["lead_sheet_audit_runs", "marketing_data_sources"].includes(table));
    const predicates = [];
    const orders = [];
    let payload;
    let maximum;
    const query = {
      select() { return query; },
      eq(field, value) { predicates.push((row) => valueAt(row, field) === value); return query; },
      in(field, values) { predicates.push((row) => values.includes(valueAt(row, field))); return query; },
      not(field, operator, value) {
        assert.equal(operator, "is"); assert.equal(value, null);
        predicates.push((row) => valueAt(row, field) != null); return query;
      },
      is(field, value) {
        assert.equal(value, null);
        predicates.push((row) => valueAt(row, field) == null); return query;
      },
      order(field, options) { orders.push([field, options.ascending]); return query; },
      limit(value) { maximum = value; return query; },
      single() { return query; }, maybeSingle() { return query; },
      update(value) { payload = value; return query; },
      then(resolve, reject) {
        if (state.databaseError) return Promise.resolve({ data: null, error: new Error("Synthetic DB failure") }).then(resolve, reject);
        let matching = (table === "lead_sheet_audit_runs" ? state.runs : [state.source])
          .filter((row) => predicates.every((predicate) => predicate(row)));
        matching.sort((left, right) => {
          for (const [field, ascending] of orders) {
            const comparison = String(left[field]).localeCompare(String(right[field]));
            if (comparison) return ascending ? comparison : -comparison;
          }
          return 0;
        });
        if (maximum !== undefined) matching = matching.slice(0, maximum);
        if (payload) {
          assert.equal(table, "lead_sheet_audit_runs", "Publication must not overwrite source records");
          state.writeAttempts++;
          if (state.casMiss) matching = [];
          if (matching[0]) Object.assign(matching[0], structuredClone(payload));
        }
        return Promise.resolve({ data: matching[0] ?? null, error: null }).then(resolve, reject);
      },
    };
    return query;
  } });
  const previousAdmin = mocks["@/lib/supabase/admin"];
  mocks["@/lib/supabase/admin"] = { createSupabaseAdminClient: databaseMock, hasSupabaseAdminEnv: () => true };
  try {
    const realStore = load("src/lib/marketing/leadDashboardSnapshotStore.ts");
    const encryption = load("src/lib/marketing/leadSheetAudit.ts");
    const context = { dataSourceId: "synthetic-source", configuration, brands };
    const version = realStore.LEAD_DASHBOARD_SNAPSHOT_VERSION;
    const payloadFor = (changes = {}) => ({ version, fingerprint: realStore.leadDashboardSnapshotFingerprint(context),
      capturedAt: "2026-10-06T08:11:00.000Z", publishedAt: savedAt, parsed, ...changes });
    const makeRun = (id, changes = {}, payload = payloadFor()) => ({
      id, data_source_id: context.dataSourceId, status: "completed", completed_at: savedAt,
      summary_json: { count: 7, leadDashboardSnapshot: { version, publishedAt: payload.publishedAt,
        ...encryption.encryptLeadDashboardPayload(JSON.stringify(payload), JSON.stringify([version, context.dataSourceId, id])) } },
      ...changes,
    });
    const resetStore = () => {
      state = { source: { id: context.dataSourceId, configuration, status: "connected",
        last_sync_at: "2026-10-06T08:16:00.000Z", last_success_at: "2026-10-06T08:16:00.000Z" },
        runs: [makeRun("good-run")], writeAttempts: 0, casMiss: false, databaseError: false };
    };
    const safeUnavailable = /未有可核對嘅已儲存 Lead 資料/;
    const read = (input = context) => realStore.readPublishedLeadDashboardSnapshot(input);
    resetStore();
    const restored = await read();
    assert.deepEqual(restored.groups, parsed.groups, "Encryption roundtrip must retain full groups, row details and dates");
    assert.deepEqual(restored.diagnostics, parsed.diagnostics);
    assert.equal(restored.loadedAt, savedAt);
    assert.equal(state.writeAttempts, 0, "Reading saved snapshots must have no persistence side effects");
    assert.equal(realStore.leadDashboardSnapshotFingerprint(context), realStore.leadDashboardSnapshotFingerprint({
      ...context, configuration: Object.fromEntries(Object.entries(configuration).reverse()), brands: [...brands].reverse(),
    }), "Object key and DB brand ordering must not invalidate a snapshot");
    for (const changed of [
      { ...context, configuration: { ...configuration, spreadsheetId: "another-sheet" } },
      { ...context, configuration: { ...configuration, treatmentAliases: [] } },
      { ...context, brands: brands.map((brand) => brand.id === "gos" ? { ...brand, slug: "changed-scope" } : brand) },
    ]) await assert.rejects(read(changed), safeUnavailable);

    // Audit-only and quarantined runs are never eligible, even if they are newer.
    resetStore();
    state.runs.push(makeRun("quarantined-run", { status: "quarantined", completed_at: "2026-10-06T12:00:00.000Z" }),
      { id: "audit-only", data_source_id: context.dataSourceId, status: "completed", completed_at: "2026-10-06T13:00:00.000Z", summary_json: { count: 99 } });
    assert.deepEqual((await read()).groups, parsed.groups);
    state.runs = state.runs.filter(({ id }) => id !== "good-run");
    await assert.rejects(read(), safeUnavailable);

    for (const corrupt of [
      (run) => { run.summary_json.leadDashboardSnapshot.version = "obsolete-v0"; },
      (run) => { run.id = "other-run"; },
      (run) => { run.data_source_id = "other-source"; },
      (run) => { run.summary_json.leadDashboardSnapshot.publishedAt = "2026-10-06T09:12:00.000Z"; },
      (run) => { run.summary_json.leadDashboardSnapshot.keyVersion = "unavailable-key-version"; },
      (run) => { run.summary_json.leadDashboardSnapshot.authTag = Buffer.alloc(16).toString("base64"); },
      (run) => { run.summary_json.leadDashboardSnapshot.ciphertext = Buffer.from("invalid ciphertext").toString("base64"); },
    ]) {
      resetStore();
      corrupt(state.runs[0]);
      await assert.rejects(read(), safeUnavailable, "Tampered/replayed/obsolete envelopes must fail closed with a safe message");
      assert.equal(state.writeAttempts, 0);
    }
    resetStore();
    // Rebinding the database source ID does not rebind AES-GCM associated data.
    state.runs[0].data_source_id = "other-source";
    await assert.rejects(read({ ...context, dataSourceId: "other-source" }), safeUnavailable);
    for (const changes of [
      { version: "obsolete-payload" }, { fingerprint: "incorrect" }, { capturedAt: "not-a-timestamp" },
      { parsed: { ...parsed, diagnostics: { ...parsed.diagnostics, acceptedRows: 0 } } },
    ]) {
      resetStore(); state.runs = [makeRun("good-run", {}, payloadFor(changes))];
      await assert.rejects(read(), safeUnavailable);
    }
    resetStore(); state.databaseError = true;
    await assert.rejects(read(), safeUnavailable);

    for (const mutate of [
      (value) => { value.groups.push(structuredClone(value.groups[0])); },
      (value) => { value.groups[0].bookDate = "2026-02-30"; },
      (value) => { value.groups[0].bookDateSource = "legacy_created_at"; },
      (value) => { value.groups[0].brandId = "not-configured"; },
      (value) => { value.groups[0].pendingRowNumber = 9999; },
      (value) => { value.groups[0].rows[0].status = "invalid"; },
    ]) {
      const corrupted = structuredClone(parsed); mutate(corrupted);
      assert.throws(() => realStore.validateLeadDashboardSavedGroups(corrupted, brands), safeUnavailable);
    }
    const missingUpdate = load("src/lib/marketing/googleSheetsMetricParser.ts").buildLeadSheetGroups({
      headers, rows: [["", "2026-10-01", "未聯絡", "GOS Beauty", "GOS Beauty", "10000008", "", "", "", "GOS First"]],
      brands, sourceBrandId: null, appsScriptContract: false, dedupeByIdentity: true,
    });
    assert.equal(missingUpdate.groups[0].usesStageDateContract, false);
    assert.equal(missingUpdate.groups[0].bookDate, null);
    realStore.validateLeadDashboardSavedGroups(missingUpdate, brands);
    resetStore(); state.runs = [makeRun("good-run", {}, payloadFor({ parsed: missingUpdate }))];
    assert.equal((await read()).groups[0].bookDate, null, "A Lead without A remains valid and must never acquire a Created At Book fallback");

    const publishInput = { ...context, runId: "new-run", completedAt: "2026-10-06T08:16:00.000Z",
      capturedAt: "2026-10-06T08:11:00.000Z", parsed };
    const preparePublication = () => {
      resetStore();
      state.runs.push({ id: "new-run", data_source_id: context.dataSourceId, status: "completed",
        completed_at: "2026-10-06T08:15:00.000Z", summary_json: { count: 7, auditMetadata: "preserve-this" } });
    };
    for (const changed of [
      () => { state.source.status = "paused"; },
      () => { state.source.status = "syncing"; },
      () => { state.source.last_sync_at = "different-owner"; },
      () => { state.source.last_success_at = "2026-10-06T08:15:00.000Z"; },
      () => { state.source.configuration = { ...configuration, tabName: "changed-source" }; },
      () => { state.runs[1].status = "quarantined"; },
      () => { state.casMiss = true; },
    ]) {
      preparePublication();
      const lastGood = structuredClone(state.runs[0]);
      changed();
      await assert.rejects(realStore.publishLeadDashboardSnapshot(publishInput), safeUnavailable);
      assert.deepEqual(state.runs[0], lastGood, "A failed or competing publication must preserve the last good snapshot");
      assert.equal(state.runs[1].summary_json.leadDashboardSnapshot, undefined);
    }
    preparePublication();
    const lastGood = structuredClone(state.runs[0]);
    state.source.last_sync_at = "2026-10-06T08:16:00+00:00";
    state.source.last_success_at = "2026-10-06T08:16:00+00:00";
    state.source.status = "warning";
    await realStore.publishLeadDashboardSnapshot(publishInput);
    assert.equal(state.writeAttempts, 1, "Equivalent Postgres timestamptz offsets must retain the valid sync lock");
    assert.deepEqual(state.runs[0], lastGood);
    assert.equal(state.runs[1].summary_json.auditMetadata, "preserve-this");
    const encoded = JSON.stringify(state.runs[1].summary_json);
    assert.ok(!encoded.includes("Synthetic follow-up") && !encoded.includes("10000001") && !encoded.includes("GOS First"), "Snapshot storage must encrypt row content and identity");
    const published = await read();
    assert.deepEqual(published.groups, parsed.groups);
    assert.equal(published.loadedAt, state.runs[1].summary_json.leadDashboardSnapshot.publishedAt);
    await assert.rejects(realStore.publishLeadDashboardSnapshot(publishInput), safeUnavailable, "An already published run must not be overwritten");
    assert.equal(state.writeAttempts, 1);
    console.log("PASS: real saved store encryption, context/AAD binding, accepted-run selection, malformed payloads, missing-A Lead, lock/config/quarantine/CAS failures and one-time atomic publication");
  } finally {
    mocks["@/lib/supabase/admin"] = previousAdmin;
    keyNames.forEach((name, index) => {
      if (previousKeys[index] === undefined) delete process.env[name];
      else process.env[name] = previousKeys[index];
    });
  }
}

try {
  reset();
  const complete = await getLeadDashboardSnapshot(filters, master);
  assert.equal(complete.live, true);
  assert.deepEqual(counts(complete), [5, 5, 1, 1, 3]);
  assert.equal(complete.loadedAt, savedAt);
  assert.equal(complete.lastSuccessAt, savedAt);
  assert.equal(calls.auth, 0, "An already verified page access context must not cause another auth lookup");
  assert.equal(calls.saved.length, 1);
  assert.equal(calls.saved[0].dataSourceId, "synthetic-source");
  assert.equal(calls.saved[0].configuration, configuration);
  assert.deepEqual(calls.saved[0].brands.map(({ id }) => id).sort(), brands.map(({ id }) => id).sort());
  assert.deepEqual([sumTrend(complete, "leads"), sumTrend(complete, "bookings"), sumTrend(complete, "shows"), sumTrend(complete, "noShows")], [5, 5, 1, 1]);
  const pending = complete.outstandingRows.find((row) => row.accountId === "gos-beauty");
  assert.equal(pending.appointmentDate, "2026-10-14", "Pending keeps its appointment date beyond the KPI end date within the selected month");
  assert.equal(pending.appointmentTime, "14:30");
  assert.equal(pending.branchLabel, "Synthetic Branch");
  assert.equal(pending.csRemark, "Synthetic follow-up");
  assert.equal(pending.sourceLabel, "Synthetic source");
  assert.equal(pending.campaignLabel, "Synthetic campaign");

  reset();
  const singleDay = await getLeadDashboardSnapshot({ startDate: "2026-10-02", endDate: "2026-10-02" }, master);
  assert.deepEqual(counts(singleDay), [2, 1, 0, 0, 3], "Lead uses Created At, Book uses last update, Show uses confirmed arrival; pending keeps monthly scope");
  reset();
  const showDay = await getLeadDashboardSnapshot({ startDate: "2026-10-05", endDate: "2026-10-05" }, master);
  assert.deepEqual(counts(showDay), [0, 0, 1, 0, 3], "Show must not use the appointment day or Book day");

  for (const [selected, expected] of [
    [{ accountId: "gos-beauty" }, [2, 3, 1, 1, 1]],
    [{ accountId: "alyssa-main" }, [1, 0, 0, 0, 0]],
    [{ accountId: "alyssa-aesthetics" }, [1, 1, 0, 0, 1]],
    [{ accountId: "alyssa-aesthetics", brandId: "medical" }, [0, 1, 0, 0, 0]],
    [{ accountId: "gos-beauty", treatment: "GOS First" }, [1, 2, 0, 1, 1]],
  ]) {
    reset();
    const scoped = await getLeadDashboardSnapshot({ ...filters, ...selected }, master);
    assert.equal(scoped.live, true);
    assert.deepEqual(counts(scoped), expected, JSON.stringify(selected));
  }

  reset();
  const scoped = await getLeadDashboardSnapshot(filters, restricted);
  assert.equal(scoped.live, true);
  assert.deepEqual(counts(scoped), [2, 3, 1, 1, 1]);
  assert.deepEqual(scoped.accountOptions.map(({ value }) => value), ["gos-beauty"]);
  assert.ok(scoped.treatmentOptions.some(({ value }) => value === "GOS Catalog Option"));
  assert.ok(!JSON.stringify(scoped).includes("Hidden"), "Saved cross-brand groups must be filtered from every returned dimension and pending row");
  assert.ok(scoped.trendSeries.every((series) => series.key === "gos-beauty"));
  assert.equal(scoped.costs.spend, 120);
  assert.deepEqual(calls.spend[0].allowedBrandIds, ["gos"]);
  assert.deepEqual(calls.annotations[0].brands.map(({ id }) => id), ["gos"]);
  reset();
  const unauthorizedAccount = await getLeadDashboardSnapshot({ ...filters, accountId: "ineffable" }, restricted);
  assert.deepEqual(counts(unauthorizedAccount), [0, 0, 0, 0, 0]);
  assert.equal(unauthorizedAccount.outstandingRows.length, 0);
  assert.equal(unauthorizedAccount.trendSeries.length, 0);

  for (const denied of [
    { source: "unauthenticated", accessLevel: "admin" },
    { source: "development_not_configured", accessLevel: "master" },
    { source: "supabase_auth", accessLevel: "admin", brandIds: [] },
  ]) {
    reset();
    const unavailable = await getLeadDashboardSnapshot(filters, denied);
    assert.equal(unavailable.live, false);
    assert.equal(unavailable.loadedAt, null);
    assertNoPrivateReads();
  }
  reset();
  access = { source: "unauthenticated", accessLevel: "admin" };
  assert.equal((await getLeadDashboardSnapshot(filters)).live, false);
  assert.equal(calls.auth, 1);
  assertNoPrivateReads();
  reset();
  hasAdminEnv = false;
  assert.equal((await getLeadDashboardSnapshot(filters, master)).live, false);
  assertNoPrivateReads();

  for (const reason of ["missing snapshot", "obsolete contract", "configuration changed", "snapshot cannot decrypt"]) {
    reset();
    savedError = new Error(`Synthetic unavailable: ${reason}`);
    const unavailable = await getLeadDashboardSnapshot(filters, master);
    assert.equal(unavailable.live, false, `${reason}: unavailable must never be a verified zero`);
    assert.equal(unavailable.loadedAt, null);
    assert.deepEqual(unavailable.trendSeries, []);
    assert.deepEqual(unavailable.outstandingRows, []);
  }
  for (const failure of ["missing source", "source query", "brands query"]) {
    reset();
    if (failure === "missing source") source = null;
    if (failure === "source query") sourceError = new Error("Synthetic source query failure");
    if (failure === "brands query") brandError = new Error("Synthetic brands query failure");
    const unavailable = await getLeadDashboardSnapshot(filters, master);
    assert.equal(unavailable.live, false);
    assert.equal(calls.saved.length, 0);
  }

  reset();
  saved = { groups: [], diagnostics: { ...parsed.diagnostics, sourceRows: 0, acceptedRows: 0 }, loadedAt: savedAt };
  const zero = await getLeadDashboardSnapshot(filters, master);
  assert.equal(zero.live, true, "A validated empty dataset is a real zero, unlike unavailable data");
  assert.deepEqual(counts(zero), [0, 0, 0, 0, 0]);
  assert.equal(zero.loadedAt, savedAt);

  reset();
  source.status = "error";
  const priorGood = await getLeadDashboardSnapshot(filters, master);
  assert.equal(priorGood.live, true, "A later provider refresh failure must retain the last published good data");
  assert.deepEqual(counts(priorGood), [5, 5, 1, 1, 3]);
  assert.equal(priorGood.loadedAt, savedAt);
  assert.ok(priorGood.warnings.length > 0, "The saved result must indicate the later source health failure");

  await verifyRealSnapshotStore();

  console.log("PASS: saved Dashboard loads without Google imports/network/writes; fail-closed auth, stage dates, filters, brand permissions, pending detail, freshness and unavailable versus true zero");
} finally {
  globalThis.fetch = originalFetch;
  console.warn = originalWarn;
  if (originalFixtures === undefined) delete process.env.ALYSSA_E2E_FIXTURES;
  else process.env.ALYSSA_E2E_FIXTURES = originalFixtures;
}
