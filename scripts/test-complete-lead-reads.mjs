import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const nativeRequire = createRequire(import.meta.url);
const cache = new Map();
let access = { source: "admin_password", accessLevel: "master" };
let failure = null;
let rowsByTable = {};
const calls = [];
const client = { from(table) {
  let filters = [], orders = [], max = 1000, exact = false, cursor = null;
  const q = {
    select(_fields, options) { exact = options?.count === "exact"; return q; },
    gte(key, value) { filters.push(row => row[key] >= value); return q; },
    lt(key, value) { filters.push(row => row[key] < value); return q; },
    lte(key, value) { filters.push(row => row[key] <= value); return q; },
    eq(key, value) { filters.push(row => row[key] === value); return q; },
    in(key, values) { assert.ok(values.length <= 100 || key === "brand_id", "related IN queries are bounded"); filters.push(row => values.includes(row[key])); return q; },
    order(key, options) { orders.push([key, options.ascending]); return q; },
    limit(value) { max = Math.min(1000, value); return q; },
    abortSignal(signal) { assert.ok(signal instanceof AbortSignal); return q; },
    or(value) {
      const match = value.match(/^created_at\.lt\.(.*),and\(created_at\.eq\.(.*),id\.lt\.(.*)\)$/);
      assert.ok(match, "compound cursor preserves tied timestamps");
      cursor = { created_at: match[1], id: match[3] };
      filters.push(row => Date.parse(row.created_at) < Date.parse(cursor.created_at) ||
        (Date.parse(row.created_at) === Date.parse(cursor.created_at) && row.id < cursor.id));
      return q;
    },
    then(resolve, reject) {
      calls.push({ table, cursor, exact });
      let values = (rowsByTable[table] ?? []).filter(row => filters.every(filter => filter(row)));
      values.sort((a, b) => { for (const [key, asc] of orders) { if (a[key] !== b[key]) return (a[key] < b[key] ? -1 : 1) * (asc ? 1 : -1); } return 0; });
      const count = exact ? values.length : null;
      if (failure === `truncate:${table}`) max = Math.min(max, 1);
      return Promise.resolve({ data: values.slice(0, max), count,
        error: failure === `error:${table}` ? { code: "synthetic_failure" } : null }).then(resolve, reject);
    },
  };
  return q;
} };
const mocks = {
  "server-only": {},
  "@/lib/supabase/admin": { createSupabaseAdminClient: () => client, hasSupabaseAdminEnv: () => true, getSupabaseAdminEnvStatus: () => ({ ready: true }) },
  "@/lib/security/internalAccessServer": { getCurrentInternalAccess: async () => access },
};
function load(path) {
  if (cache.has(path)) return cache.get(path).exports;
  const m = { exports: {} }; cache.set(path, m);
  const source = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "module", "exports", source)(id => mocks[id] ?? (id.startsWith("@/") ? load(`src/${id.slice(2)}.ts`) : nativeRequire(id)), m, m.exports);
  return m.exports;
}
const { getLeadRows, buildPerformance } = load("src/lib/data/businessMetrics.ts");
const { readCompletePages, withCompleteReadScope, CompleteReadError, compareReadTimestamps } = load("src/lib/data/completeRead.ts");
const { getCrmCasesBySourceLeadIds, getCrmBookingsByCaseIds } = load("src/lib/crm/store.ts");
const oldError = console.error;
console.error = () => {};
try {
  const makeId = (prefix, i) => `${prefix}-${String(i).padStart(6, "0")}`;
  rowsByTable = {
    leads: Array.from({ length: 6101 }, (_, i) => ({ id: makeId("lead", i), created_at: "2026-11-01T08:00:00+00:00", customer_name: "Synthetic", phone: String(20000000 + i), normalized_phone: String(20000000 + i), brand_id: "brand-a", contact_id: makeId("contact", i), source_snapshot_id: makeId("snapshot", i), treatment_id: "treatment-a", package_id: null, branch_id: null, form_id: null, price: 100, currency: "HKD", lead_status: "new" })),
    contacts: Array.from({ length: 6101 }, (_, i) => ({ id: makeId("contact", i), customer_name: "Synthetic", phone: String(20000000 + i), normalized_phone: String(20000000 + i) })),
    lead_source_snapshots: Array.from({ length: 6101 }, (_, i) => ({ id: makeId("snapshot", i), source_type: "reg_form_utm", utm_source: i === 0 ? "older-source" : "recent-source", utm_campaign: "synthetic" })),
    brands: [{ id: "brand-a", name: "Synthetic Brand" }], treatments: [{ id: "treatment-a", name: "Synthetic Treatment" }],
    bookings: Array.from({ length: 1201 }, (_, i) => ({ id: makeId("booking", i), lead_id: "lead-000000", created_at: `2026-11-02T08:${String(Math.floor(i / 60) % 60).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}+00:00`, booking_status: "booked" })),
  };
  let result = await getLeadRows("all", 500, { completeness: "complete", includeTestData: true });
  assert.equal(result.error, null);
  assert.equal(result.leads.length, 6101, "complete CRM scope exceeds both old limits and PostgREST cap");
  assert.equal(result.leads.at(-1).id, "lead-000000", "same timestamp pages retain final older identity");
  assert.equal(result.leads.filter(lead => lead.contact && lead.sourceSnapshot).length, 6101, "all relation chunks hydrated");
  assert.equal(buildPerformance(result.leads).brandPerformance[0].leads, 6101, "aggregate covers the scope, not the latest page");
  assert.equal(result.leads.at(-1).booking.id, "booking-001200", "multiple booking pages preserve latest ordering");
  assert.ok(calls.filter(call => call.table === "leads").length > 10);

  result = await getLeadRows("all", 500, { completeness: "complete", query: "20000000", includeTestData: true });
  assert.deepEqual(result.leads.map(lead => lead.id), ["lead-000000"], "older matching phone survives retrieval before filtering");
  result = await getLeadRows("all", 500, { completeness: "complete", source: "older-source", includeTestData: true });
  assert.deepEqual(result.leads.map(lead => lead.id), ["lead-000000"], "older matching source survives relation hydration");
  result = await getLeadRows("all", 250, { includeTestData: true });
  assert.equal(result.leads.length, 250, "explicit bounded callers retain their requested limit");

  access = { source: "supabase_auth", accessLevel: "member", brandIds: ["brand-b"] };
  const previousCalls = calls.length;
  result = await getLeadRows("all", 500, { completeness: "complete", brandIds: ["brand-a"], includeTestData: true });
  assert.equal(result.leads.length, 0); assert.equal(calls.length, previousCalls, "denied brand intersection never queries service-role rows");
  access = { source: "supabase_auth", accessLevel: "member", brandIds: ["brand-a"] };
  result = await getLeadRows("all", 500, { completeness: "complete", brandIds: ["brand-a", "brand-b"], includeTestData: true });
  assert.equal(result.leads.length, 6101);

  for (failure of ["truncate:leads", "error:leads", "truncate:contacts", "error:lead_source_snapshots", "error:bookings"]) {
    result = await getLeadRows("all", 500, { completeness: "complete", includeTestData: true });
    assert.ok(result.error instanceof CompleteReadError, failure);
    assert.deepEqual(result.leads, [], `${failure} cannot become partial/zero-valued success`);
  }
  failure = null;
  await assert.rejects(withCompleteReadScope(scope => readCompletePages(scope, async () => ({ data: [], count: 25001, error: null }))), error => error.reason === "capacity");
  await assert.rejects(withCompleteReadScope(scope => readCompletePages(scope, async () => ({ data: [], count: null, error: null }))), error => error.reason === "incomplete");
  assert.equal(compareReadTimestamps("2026-11-01T12:00:00.123900+00:00", "2026-11-01T12:00:00.123100+00:00"), 1);
  assert.equal(compareReadTimestamps("2026-11-01T20:00:00.123900+08:00", "2026-11-01T12:00:00.1239Z"), 0);
  const subMillisecondRows = [
    { id: "a", created_at: "2026-11-01T12:00:00.123900+00:00" },
    { id: "z", created_at: "2026-11-01T12:00:00.123100+00:00" },
  ];
  assert.deepEqual(await withCompleteReadScope(scope => readCompletePages(scope, async () => ({
    data: subMillisecondRows, count: 2, error: null,
  }))), subMillisecondRows, "distinct PostgreSQL microseconds must not become an invented ID tie");
  let pageCalls = 0;
  await assert.rejects(withCompleteReadScope(scope => readCompletePages(scope, async () => {
    pageCalls++;
    return pageCalls === 1
      ? { data: Array.from({ length: 500 }, (_, i) => ({ id: makeId("stable", 1000 - i), created_at: "2026-11-01T08:00:00Z" })), count: 501, error: null }
      : { data: [], count: 0, error: null };
  })), error => error.reason === "changed");
  await assert.rejects(withCompleteReadScope(async () => new Promise(() => {}), 5), error => error.reason === "deadline", "deadline also bounds transports ignoring cancellation");

  const ids = rowsByTable.leads.map(lead => lead.id);
  rowsByTable.crm_lead_cases = ids.map((id, i) => ({ id: makeId("case", i), source_lead_id: id, created_at: "2026-11-02T00:00:00Z", status: i === 0 ? "no_show" : "new" }));
  const cases = await getCrmCasesBySourceLeadIds(ids, { completeness: "complete" });
  assert.equal(cases.size, 6101, "CRM overlay also exceeds PostgREST cap safely");
  assert.equal(cases.get("lead-000000").status, "no_show");
  rowsByTable.crm_bookings = Array.from({ length: 1201 }, (_, i) => ({ id: makeId("crm-book", i), case_id: "case-000000", created_at: "2026-11-02T00:00:00Z", updated_at: i === 0 ? "2026-11-04T00:00:00Z" : "2026-11-03T00:00:00Z", status: i === 0 ? "no_show" : "booked" }));
  const bookings = await getCrmBookingsByCaseIds(["case-000000"], { completeness: "complete" });
  assert.equal(bookings.get("case-000000").id, "crm-book-000000", "latest updated outcome wins even in older created page");
  failure = "error:crm_lead_cases";
  await assert.rejects(getCrmCasesBySourceLeadIds(ids, { completeness: "complete" }), CompleteReadError);
  failure = "error:crm_bookings";
  await assert.rejects(getCrmBookingsByCaseIds(["case-000000"], { completeness: "complete" }), CompleteReadError);
} finally { console.error = oldError; }
console.log("PASS: complete scoped reads beyond500/5000, tied keyset pages, full relation and outcome hydration, older matches, permission intersections, bounded compatibility, changed/capped/failed reads and total deadline");
