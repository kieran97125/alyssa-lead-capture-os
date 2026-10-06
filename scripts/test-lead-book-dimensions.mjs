import assert from "node:assert/strict";
import { loadTypeScript } from "./test-lead-metric-date-contract.mjs";

const parser = loadTypeScript("src/lib/marketing/googleSheetsMetricParser.ts");
const math = loadTypeScript("src/lib/marketing/leadDashboardMath.ts");
const brands = [
  { id: "a", name: "Alyssa", slug: "alyssa" },
  { id: "m", name: "Aesthetics Medical", slug: "aesthetics" },
];
const headers = ["最後更新日期", "Created At", "跟進狀態", "品牌", "Account", "電話", "療程項目", "預約日期", "確認到店日期"];
const row = (phone, updated, created, status, brand, treatment) =>
  [updated, created, status, brand, "Alyssa Aesthetics", phone, treatment, "2026-10-12", ""];
const rows = [
  ...Array.from({ length: 14 }, (_, i) => row(String(10000001 + i), "2026-10-02", "2026-10-01", "已預約", "Alyssa Aesthetics", "Facelift")),
  row("10000015", "2026-09-14", "2026-09-14", "待跟進", "Alyssa Aesthetics", "Facelift"),
  row("+852 1000 0015", "2026-10-03", "2026-10-03", "已預約", "Aesthetics Medical", "Xeomin"),
  row("10000016", "2026-10-06", "2026-10-06", "已預約", "Aesthetics Medical", "Xeomin"),
  row("10000017", "2026-07-24", "2026-07-24", "已預約", "Alyssa Aesthetics", "Facelift"),
  row("10000017", "2026-10-04", "2026-10-04", "已預約", "Alyssa Aesthetics", "Facelift"),
];
const input = { headers, rows, brands, sourceBrandId: null, dedupeByIdentity: true,
  brandAliases: { "Alyssa Aesthetics": "alyssa", "Aesthetics Medical": "aesthetics" } };
const parsed = parser.buildLeadSheetGroups(input);
const filters = { startDate: "2026-10-01", endDate: "2026-10-06", accountId: "alyssa-aesthetics", brandId: "", treatment: "" };
const modelFor = (extra = {}) => math.buildLeadDashboardModel({ groups: parsed.groups, brands, filters, ...extra });
const model = modelFor();
assert.equal(parsed.groups.length, 17);
assert.equal(model.totals.bookings, 16);
assert.equal(model.brandRows.find(r => r.brandId === "a").bookings, 14);
assert.equal(model.brandRows.find(r => r.brandId === "m").bookings, 2);
const cross = parsed.groups.find(g => g.key.endsWith("phone:10000015"));
assert.equal(cross.brandId, "a", "First-touch Brand must remain unchanged");
assert.equal(cross.firstTouchDate, "2026-09-14");
assert.equal(cross.bookDimensions.brandId, "m");
assert.equal(cross.bookDimensions.treatmentLabel, "Xeomin");
assert.equal(cross.bookDate, "2026-10-03", "A prior Lead's first booking today counts once");
assert.equal(parsed.groups.find(g => g.key.endsWith("phone:10000017")).bookDate, "2026-07-24",
  "A previous Book's rebooking does not become another first Book");
const medical = modelFor({ filters: { ...filters, brandId: "m", treatment: "Xeomin" } });
assert.deepEqual([medical.totals.leads, medical.totals.bookings], [1, 2]);
assert.equal(medical.totals.bookRate, 2);
const restricted = modelFor({ allowedBrandIds: ["m"] });
assert.equal(restricted.totals.bookings, 2, "Permission filtering uses Book Brand, not first-touch Brand");
assert.ok(restricted.campaignRows.every(r => r.brandId === "m"));
assert.equal(modelFor({ allowedBrandIds: ["a"] }).totals.bookings, 14);
assert.equal(modelFor({ filters: { ...filters, accountId: "alyssa-medical" } }).totals.bookings, 0);
const trend = math.buildLeadDashboardTrend({ groups: parsed.groups, brands,
  filters: { ...filters, brandId: "m", treatment: "Xeomin" }, brandColors: {}, annotations: [] });
assert.equal(trend.flatMap(s => s.points).reduce((n, p) => n + p.bookings, 0), 2);
const performance = parser.aggregateLeadSheetPerformance({ ...input, dailyThroughDate: "2026-10-06",
  activityThroughDate: "2026-10-06", pendingThroughDate: "2026-10-31" });
const period = f => f.metricDate >= filters.startDate && f.metricDate <= filters.endDate;
const facts = performance.metricFacts.filter(f => f.metricKind === "book" && period(f));
assert.equal(facts.reduce((n, f) => n + f.count, 0), 16);
assert.equal(facts.filter(f => f.brandId === "m" && f.treatmentLabel === "Xeomin").reduce((n, f) => n + f.count, 0), 2);
assert.equal(performance.dailyMetrics.filter(f => f.date >= filters.startDate && f.brandId === "m")
  .reduce((n, f) => n + f.bookings, 0), 2);
assert.equal(model.totals.outstanding, 17, "Legacy scheduling must survive Book projection");

const ties = parser.buildLeadSheetGroups({ ...input, rows: [
  row("20000001", "2026-10-02", "2026-09-01", "待跟進", "Alyssa Aesthetics", "Lead only"),
  row("20000001", "2026-10-03", "2026-10-01", "已預約", "Alyssa Aesthetics", "First booking"),
  row("20000001", "2026-10-03", "2026-09-30", "已到店", "Aesthetics Medical", "Same-day latest physical row"),
  row("20000001", "2026-10-04", "2026-09-02", "已預約", "Alyssa Aesthetics", "Later booking"),
] }).groups[0];
assert.equal(ties.bookDate, "2026-10-03");
assert.deepEqual(ties.bookDimensions, { rowNumber: 4, brandId: "m", brandLabel: "Aesthetics Medical",
  treatmentLabel: "Same-day latest physical row" }, "Match native Sheet's date/physical-row tie policy");
const projected = parser.projectLeadBookMetricGroups([ties]);
assert.equal(projected.filter(g => g.bookDate).length, 1);
assert.equal(projected.filter(g => g.firstTouchDate).length, 1);
const legacy = structuredClone(ties);
delete legacy.bookDimensions;
assert.deepEqual(parser.projectLeadBookMetricGroups([legacy]), [legacy], "Legacy saved payload stays usable until a successful refresh");
console.log("PASS: 16 unique Books, 14/2 booking Brand attribution, old Lead/new Book, historical rebooking exclusion, same-day physical-row ties, permission and Account/Treatment filters, facts and trends, legacy scheduling/snapshot compatibility");
