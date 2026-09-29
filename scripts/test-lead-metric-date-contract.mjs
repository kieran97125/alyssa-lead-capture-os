import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const nativeRequire = createRequire(import.meta.url);
const modules = new Map();
export function loadTypeScript(relativePath) {
  if (modules.has(relativePath)) return modules.get(relativePath).exports;
  const loadedModule = { exports: {} };
  modules.set(relativePath, loadedModule);
  const compiled = ts.transpileModule(readFileSync(`${root}${relativePath}`, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    fileName: relativePath,
  });
  const require = (specifier) => specifier.startsWith("@/")
    ? loadTypeScript(`src/${specifier.slice(2)}.ts`)
    : nativeRequire(specifier);
  new Function("require", "module", "exports", compiled.outputText)(require, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

const { buildLeadSheetGroups, aggregateLeadSheetPerformance, aggregateLeadFunnelColumns,
  parseGoogleSheetDate } = loadTypeScript("src/lib/marketing/googleSheetsMetricParser.ts");
const headers = ["最後更新日期", "Created At", "跟進狀態", "品牌", "CS同事名", "分店",
  "客人姓名", "電話", "Email", "療程 / 優惠", "療程項目", "預約日期", "預約時間",
  "確認到店日期", "Campaign / 廣告", "最後跟進時間", "CS Remark", "Remark", "Status",
  "Show up", "Account", "lead_key"];
const brands = [
  { id: "gos", name: "GOS Beauty", slug: "gos-beauty" },
  { id: "ib", name: "Ineffable Beauty", slug: "ineffable" },
];
const serial = (date) => (Date.parse(`${date}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86_400_000;
const row = (values = {}) => headers.map((header) => ({
  "品牌": "GOS Beauty", "Account": "GOS Beauty", "跟進狀態": "待跟進", ...values,
})[header] ?? "");
const input = (rows) => ({ headers, rows, brands, sourceBrandId: null });
const metricTotals = (parsed, date) => Object.fromEntries(["lead", "book", "show", "no_show"]
  .map((kind) => [kind, parsed.metricFacts.filter((fact) => fact.metricKind === kind &&
    (!date || fact.metricDate === date)).reduce((sum, fact) => sum + fact.count, 0)]));

// A valid first touch wins over an invalid B and later numeric B. Numeric and
// formatted phones join the same Account identity, even when Brand changes.
const duplicateRows = [
  row({ "電話": 61234567, "Created At": "invalid", "療程項目": "not first" }),
  row({ "電話": "+852 6123 4567", "Created At": "2026-09-01", "療程項目": "  Custom\u00a0  Treatment  ",
    "Campaign / 廣告": "facelift", "跟進狀態": "已預約", "最後更新日期": "2026-09-05" }),
  row({ "電話": 61234567, "Created At": serial("2026-09-02"), "品牌": "Ineffable Beauty",
    "療程項目": "changed treatment", "跟進狀態": "已到店", "最後更新日期": serial("2026-09-07"),
    "確認到店日期": "2026-09-09" }),
  row({ "電話": "61234567", "Created At": "2026-09-03", "跟進狀態": "no show",
    "最後更新日期": "2026-09-08", "預約日期": "2026-09-06" }),
];
const aliasInput = { ...input(duplicateRows), sourceBrandId: "ib", treatmentAliases: [
  { label: "Alias must not replace K", keywords: ["facelift"], brand: "Ineffable Beauty" },
] };
const parsedGroups = buildLeadSheetGroups({ ...aliasInput, appsScriptContract: false });
assert.equal(parsedGroups.groups.length, 1);
const group = parsedGroups.groups[0];
assert.deepEqual({ lead: group.firstTouchDate, book: group.bookDate, show: group.showDate,
  noShow: group.noShowDate, brand: group.brandId, treatment: group.treatmentLabel,
  source: group.bookDateSource }, {
  lead: "2026-09-01", book: "2026-09-05", show: "2026-09-09", noShow: "2026-09-06",
  brand: "gos", treatment: "Custom Treatment", source: "last_updated",
});
assert.deepEqual(buildLeadSheetGroups({ ...aliasInput, appsScriptContract: true }).groups,
  parsedGroups.groups, "Account-first attribution must not depend on legacy parser mode");

// Export synthetic rows so the same fixtures can be evaluated in native Sheets.
// Date-only grouping is insufficient: same-day first-touch attribution must
// prefer the earliest second, then source row, across numeric and string cells.
export const sameDayFirstTouchFixture = {
  headers,
  rows: [
    row({ "電話": "10000001", "Created At": serial("2026-09-01") + 0.5, "療程項目": "Later serial" }),
    row({ "電話": "10000001", "Created At": "2026-09-01T09:30:00", "療程項目": "Earlier ISO" }),
    row({ "電話": "10000002", "Created At": "2026-09-01 12:00:01", "療程項目": "Later ISO" }),
    row({ "電話": "10000002", "Created At": serial("2026-09-01") + 0.5, "療程項目": "Earlier serial" }),
    row({ "電話": "10000003", "Created At": "2026-09-01 09:00:01", "療程項目": "Tie first row" }),
    row({ "電話": "10000003", "Created At": serial("2026-09-01") + 32401 / 86400, "療程項目": "Tie later row" }),
  ],
  expected: [
    { phone: "10000001", date: "2026-09-01", treatment: "Earlier ISO", sourceRow: 3 },
    { phone: "10000002", date: "2026-09-01", treatment: "Earlier serial", sourceRow: 5 },
    { phone: "10000003", date: "2026-09-01", treatment: "Tie first row", sourceRow: 6 },
  ],
};
assert.deepEqual(buildLeadSheetGroups(input(sameDayFirstTouchFixture.rows)).groups.map((value) => ({
  phone: value.key.split("phone:")[1], date: value.firstTouchDate,
  treatment: value.treatmentLabel, sourceRow: value.rows[0].rowNumber,
})), sameDayFirstTouchFixture.expected);

// Main reporting ignores conflicting ledger dates rather than replacing A/N/L.
const reportingInput = { ...aliasInput, dailyThroughDate: "2026-09-29",
  activityThroughDate: "2026-09-29", pendingThroughDate: "2026-12-31" };
const ledger = { headers: ["Event ID", "Event Date", "Event Type", "Brand", "Phone Last8", "Account"],
  rows: ["book", "show", "no_show"].map((type) =>
    [`conflicting-${type}`, "2026-08-01", type, "GOS Beauty", 61234567, "GOS Beauty"]) };
const noLedger = aggregateLeadSheetPerformance(reportingInput);
assert.deepEqual(aggregateLeadSheetPerformance({ ...reportingInput, eventLedger: ledger }), noLedger);
assert.deepEqual(metricTotals(noLedger), { lead: 1, book: 1, show: 1, no_show: 1 });
assert.deepEqual(metricTotals(noLedger, "2026-09-05"), { lead: 0, book: 1, show: 0, no_show: 0 });

// Blank A never inherits B. N without a Show status is not a confirmed Show;
// No Show is owned by L, regardless of a different A or populated N.
const strictRows = [
  row({ "電話": "62222222", "Created At": "2026-09-01", "跟進狀態": "已預約" }),
  row({ "電話": "63333333", "Created At": "2026-09-02", "跟進狀態": "no show",
    "最後更新日期": "2026-09-10", "預約日期": "2026-09-12", "確認到店日期": "2026-09-13" }),
  row({ "電話": "64444444", "Created At": "2026-09-02", "跟進狀態": "已到店",
    "最後更新日期": "2026-09-10" }),
];
const strict = buildLeadSheetGroups(input(strictRows));
assert.equal(strict.groups[0].bookDate, null);
assert.equal(strict.groups[0].bookDateSource, null);
assert.equal(strict.groups[1].noShowDate, "2026-09-12");
assert.equal(strict.groups[1].showDate, null);
assert.equal(strict.groups[2].showDate, null);
assert.equal(strict.diagnostics.invalidShowDateRows, 1);
const columns = aggregateLeadFunnelColumns({ createdAtValues: [["2026-09-01"]],
  lastUpdatedValues: [[""]], followStatusValues: [["已預約"]], brandValues: [["GOS Beauty"]],
  confirmationDateValues: [[""]], brands, sourceBrandId: null, throughDate: "2026-09-30" });
assert.equal(columns.reduce((sum, value) => sum + value.bookings, 0), 0);

// No-phone rows stay distinct; K/J fallbacks keep Sheet-owned wording.
const noPhones = buildLeadSheetGroups(input([
  row({ "Created At": "2026-09-01", "lead_key": "shared", "療程 / 優惠": "  Offer   Name " }),
  row({ "Created At": "2026-09-01", "lead_key": "shared" }),
]));
assert.equal(noPhones.groups.length, 2);
assert.deepEqual(noPhones.groups.map((value) => value.treatmentLabel), ["Offer Name", "未分類療程"]);

// A source date on the exact cutoff remains in the day even with a time value;
// the next calendar day must not leak into the period.
const boundary = aggregateLeadSheetPerformance({ ...input([
  row({ "電話": "65555555", "Created At": serial("2026-09-29") + 0.99999,
    "最後更新日期": "2026-09-29 23:59:59", "跟進狀態": "已到店",
    "確認到店日期": serial("2026-09-29") + 0.99999 }),
  row({ "電話": "66666666", "Created At": "2026-09-30 00:00:00", "最後更新日期": "2026-09-30",
    "跟進狀態": "no show", "預約日期": "2026-09-30" }),
]), dailyThroughDate: "2026-09-29", activityThroughDate: "2026-09-29", pendingThroughDate: "2026-09-29" });
assert.deepEqual(metricTotals(boundary), { lead: 1, book: 1, show: 1, no_show: 0 });
assert.equal(parseGoogleSheetDate(Number.MAX_VALUE), null);
assert.equal(parseGoogleSheetDate("2026-02-30"), null);
assert.equal(parseGoogleSheetDate("not a date 2026-09-29"), null);
console.log("Lead metric behavior verified: B/A/N/L dates, Account identity, explicit attribution, no ledger override, and cutoff boundaries.");
