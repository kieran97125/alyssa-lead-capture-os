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
const mocks = {
  "server-only": {},
  "@/lib/data/configuration": { getConfiguredBrands: async () => brands },
  "@/lib/supabase/admin": { hasSupabaseAdminEnv: () => false },
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
await assert.rejects(build(normalize({ brandScope: "g", accountIds: ["alyssa-aesthetics"] })), error => error.code === "brand_scope_denied");
assert.notEqual(selected.snapshotSha256, all.snapshotSha256);
console.log("PASS: PPTX default, invalid/unauthorized Account refusal, immutable selection, brand/date intersections, reconciled totals and KOL Spend isolation");
