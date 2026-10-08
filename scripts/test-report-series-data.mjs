import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = fileURLToPath(new URL("../", import.meta.url));
const cache = new Map();
function load(path) {
  if (cache.has(path)) return cache.get(path);
  const source = readFileSync(`${root}${path}`, "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  cache.set(path, module.exports);
  vm.runInNewContext(output, {
    module, exports: module.exports,
    require(id) { return id.startsWith("@/") ? load(`src/${id.slice(2)}.ts`) : require(id); },
  }, { filename: path });
  return module.exports;
}
const { buildReportSeries } = load("src/lib/reports/seriesData.ts");
const brands = [
  { id: "a", name: "Alyssa Aesthetics", slug: "alyssa-aesthetics" },
  { id: "m", name: "Aesthetics Medical", slug: "am" },
  { id: "om", name: "Alyssa Medical", slug: "alyssa-medical" },
  { id: "g", name: "GOS Beauty", slug: "gos-beauty" },
  { id: "i", name: "Ineffable Beauty", slug: "ineffable" },
  { id: "s", name: "Skin Light", slug: "skin-light" },
];
function fact(brandId, brandLabel, accountLabel, metricKind, metricCount, metricDate = "2026-10-01", treatmentLabel = "Facelift") {
  return { brandId, brandLabel, accountLabel, sourceLabel: "WhatsApp", campaignLabel: "AD", metricKind, metricCount, metricDate, treatmentLabel };
}
const metricFacts = [
  fact("a", "Alyssa Aesthetics", "Alyssa Aesthetics", "lead", 10),
  fact("a", "Alyssa Aesthetics", "Alyssa Aesthetics", "book", 2),
  fact("a", "Alyssa Aesthetics", "Alyssa Aesthetics", "show", 1),
  // First-touch and first-Book Brand dimensions differ. Retain each stage's
  // persisted attribution rather than putting this Book back into Ads.
  fact("m", "Aesthetics Medical", "Alyssa Aesthetics", "book", 1, "2026-10-02", "Xeomin"),
  fact("m", "Aesthetics Medical", "Alyssa Aesthetics", "lead", 3),
  fact("om", "Alyssa Medical", "Alyssa Medical", "lead", 4),
  fact("om", "Alyssa Medical", "Alyssa Medical", "show", 2),
  fact("a", "Alyssa", "Alyssa Main", "lead", 5),
  fact("a", "Alyssa", "Alyssa Main", "show", 1),
  fact("g", "GOS Beauty", "gos-beauty", "lead", 6),
  fact("i", "Ineffable Beauty", "Ineffable", "lead", 7),
  fact("g", "GOS Beauty", "GOS Beauty", "lead", 99, "2026-09-30"),
  fact("unauthorized", "GOS Beauty", "GOS Beauty", "lead", 999),
];
const spendFacts = [
  { brandId: "a", spendDate: "2026-10-01", amount: 100 },
  { brandId: "m", spendDate: "2026-10-01", amount: 60 },
  { brandId: "om", spendDate: "2026-10-02", amount: 40 },
  { brandId: "g", spendDate: "2026-10-01", amount: 0 },
  { brandId: "unauthorized", spendDate: "2026-10-01", amount: 9999 },
];
const input = { brands, metricFacts, spendFacts, dates: ["2026-10-01", "2026-10-02"], sourceAvailable: true };
const series = buildReportSeries(input);
const group = key => series.groupRows.find(row => row.key === key);
assert.equal(series.groupRows.length, 6);
assert.equal(group("alyssa-ads").metrics.leads, 10);
assert.equal(group("alyssa-ads").metrics.bookings, 2);
assert.equal(group("alyssa-ads").metrics.spend, 100);
assert.equal(group("alyssa-medical-ads").metrics.leads, 7);
assert.equal(group("alyssa-medical-ads").metrics.bookings, 1);
assert.equal(group("alyssa-medical-ads").metrics.spend, 100);
assert.equal(group("kol-traffic").metrics.leads, 5);
assert.equal(group("kol-traffic").metrics.spend, null, "Paid Ads ledger must not be assigned to Main");
assert.equal(group("gos").metrics.leads, 6);
assert.equal(group("gos").metrics.spend, 0, "Explicit HK$0 differs from missing Spend");
assert.equal(group("ib").metrics.spend, null);
assert.equal(group("skin-light").available, true, "Authorized, accepted source + no facts is a real zero");
assert.equal(group("skin-light").metrics.leads, 0);
assert.equal(series.auditRows.filter(row => row.groupKey === "alyssa-medical-ads").length, 2, "Original medical Account/Brand dimensions remain independently auditable");
assert.equal(series.auditRows.reduce((total, row) => total + row.metrics.leads, 0), 35);
assert.ok(series.arrivalSourceRows.every(row => !row.available && row.shows === null), "Lead acquisition source must never become arrival AD/KOL/OG evidence");
for (const row of series.groupRows) {
  const daily = series.dailyRows.filter(item => item.groupKey === row.key);
  assert.equal(daily.reduce((total, item) => total + item.metrics.leads, 0), row.metrics.leads);
  assert.equal(daily.reduce((total, item) => total + item.metrics.bookings, 0), row.metrics.bookings);
  const treatment = series.treatmentRows.filter(item => item.groupKey === row.key);
  assert.equal(treatment.reduce((total, item) => total + item.metrics.leads, 0), row.metrics.leads);
  assert.ok(treatment.every(item => item.metrics.spend === null));
}
const restricted = buildReportSeries({ ...input, brands: brands.filter(brand => brand.id === "g") });
assert.equal(restricted.groupRows.find(row => row.key === "gos").metrics.leads, 6);
assert.ok(restricted.groupRows.filter(row => row.key !== "gos").every(row => !row.available));
assert.ok(restricted.auditRows.every(row => row.brandLabel === "GOS Beauty"));
assert.ok(restricted.dailyRows.every(row => row.groupKey === "gos"));
const missingAccount = buildReportSeries({ ...input, metricFacts: [...metricFacts, fact("a", "Alyssa Aesthetics", "", "lead", 1)] });
assert.ok(!missingAccount.groupRows.find(row => row.key === "alyssa-ads").available);
assert.ok(!missingAccount.groupRows.find(row => row.key === "kol-traffic").available);
assert.ok(missingAccount.warnings.length > 0);
const unavailable = buildReportSeries({ ...input, sourceAvailable: false });
assert.ok(!unavailable.available && unavailable.groupRows.every(row => !row.available));
assert.equal(unavailable.dailyRows.length, 0);
assert.equal(unavailable.treatmentRows.length, 0);
const serialized = JSON.stringify(series);
assert.ok(!/phone|customer_name|csRemark|crm_notes|1000000/.test(serialized));
// Exercise the real canonical parser, including its first-Book stage projection.
const parser = load("src/lib/marketing/googleSheetsMetricParser.ts");
const canonicalBrands = [
  { id: "a", name: "Alyssa", slug: "alyssa" },
  { id: "m", name: "Aesthetics Medical", slug: "aesthetics" },
];
const canonical = parser.aggregateLeadSheetPerformance({
  headers: ["最後更新日期", "Created At", "跟進狀態", "品牌", "Account", "電話", "療程項目", "預約日期", "確認到店日期"],
  rows: [
    ["2026-09-20", "2026-09-20", "待跟進", "Alyssa Aesthetics", "Alyssa Aesthetics", "10000001", "Facelift", "", ""],
    ["2026-10-02", "2026-10-02", "已預約", "Aesthetics Medical", "Alyssa Aesthetics", "10000001", "Xeomin", "2026-10-12", ""],
  ],
  brands: canonicalBrands, sourceBrandId: null, dedupeByIdentity: true,
  brandAliases: { "Alyssa Aesthetics": "alyssa", "Aesthetics Medical": "aesthetics" },
  dailyThroughDate: "2026-10-02", activityThroughDate: "2026-10-02", pendingThroughDate: "2026-10-31",
});
const projected = buildReportSeries({
  brands: canonicalBrands, dates: input.dates, sourceAvailable: true, spendFacts: [],
  metricFacts: canonical.metricFacts.map(({ count, ...row }) => ({ ...row, metricCount: count })),
});
assert.equal(projected.groupRows.find(row => row.key === "alyssa-ads").metrics.bookings, 0);
assert.equal(projected.groupRows.find(row => row.key === "alyssa-medical-ads").metrics.bookings, 1);
assert.equal(projected.groupRows.reduce((total, row) => total + row.metrics.leads, 0), 0, "An old Lead's new Book must not manufacture an in-period Lead");
console.log("PASS: six report-only groups, stage-specific Brand/Account attribution, Medical merge, scoped aggregate audit, daily/treatment parity, no duplicated Spend, missing-vs-zero, missing Account/source and honest arrival-source availability");
