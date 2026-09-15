import { expect, test } from "@playwright/test";
import {
  aggregateLeadSheetPerformance,
  buildLeadSheetGroups,
  type SheetBrandReference,
} from "../src/lib/marketing/googleSheetsMetricParser";
import { applyLeadFunnelEventLedger } from "../src/lib/marketing/leadFunnelEventLedger";
import { buildLeadDashboardModel, buildLeadDashboardTrend } from "../src/lib/marketing/leadDashboardMath";

// Synthetic identities only. Keep provider cell TYPES (numeric phone + serial
// dates), because string-only fixtures concealed a real ledger-join defect.
const headers = ["最後更新日期", "Created At", "跟進狀態", "品牌", "電話", "療程項目", "預約日期", "確認到店日期", "lead_key"];
const eventHeaders = ["Event ID", "Event At", "Event Date", "Event Type", "lead_key", "Brand", "Phone Last8", "Source Row"];
const brands: SheetBrandReference[] = [
  { id: "example-brand", name: "Example Beauty", slug: "example" },
  { id: "other-brand", name: "Other Beauty", slug: "other" },
];
const filters = { startDate: "2026-09-15", endDate: "2026-09-15", brandId: "example-brand", treatment: "" };
function row(phone: unknown, status = "待跟進", brand = "Example Beauty", leadKey = ""): unknown[] {
  return [46280.55, 46278.69, status, brand, phone, "", status === "已預約" ? 46281 : 46278, status === "已預約" ? 46281 : 46278, leadKey];
}
function event(id: string, type: string, phone: unknown, date = "2026-09-15"): unknown[] {
  // Deliberately unrelated Source Row: matching must use stable identity.
  return [id, `${date} 13:12:00`, date, type, "", "Example Beauty", phone, 900];
}
const events = [
  event("synthetic-lead-a", "lead", "60000001", "2026-09-13"),
  event("synthetic-no-show", "no_show", "60000001"),
  event("synthetic-lead-b", "lead", "60000002", "2026-09-13"),
  event("synthetic-book", "book", "60000002"),
];
function groupsFor(rows: unknown[][], appsScriptContract = true) {
  return buildLeadSheetGroups({ headers, rows, brands, sourceBrandId: null, appsScriptContract, dedupeByIdentity: true }).groups;
}
function joined(rows: unknown[][], ledgerRows = events) {
  return applyLeadFunnelEventLedger({ groups: groupsFor(rows), brands, eventLedger: { headers: eventHeaders, rows: ledgerRows } });
}

test("numeric provider phones join the ledger: one Book and one No Show, not two Book", () => {
  const rows = [row(60000001, "no show"), row(60000002, "已預約")];
  const before = JSON.stringify(rows);
  const groups = joined(rows);
  expect(groups.map(g => g.key)).toEqual(["example-brand|phone:60000001", "example-brand|phone:60000002"]);
  expect(groups.every(g => g.usesEventLedger)).toBe(true);
  expect(groups[0]).toMatchObject({ bookDate: null, noShowDate: "2026-09-15", currentStatus: "no_show" });
  expect(groups[1]).toMatchObject({ bookDate: "2026-09-15", noShowDate: null, bookDateSource: "event_ledger" });
  const model = buildLeadDashboardModel({ groups, brands, filters });
  expect(model.totals).toMatchObject({ leads: 0, bookings: 1, shows: 0, noShows: 1 });
  expect(model.brandRows[0]).toMatchObject({ bookings: 1, noShows: 1 });
  expect(model.treatmentRows[0]).toMatchObject({ bookings: 1, noShows: 1 });
  expect(model.campaignRows[0]).toMatchObject({ bookings: 1, noShows: 1 });
  expect(JSON.stringify(rows)).toBe(before);
});

test("numeric provider phones use the same dates in daily trend", () => {
  const groups = joined([row(60000001, "no show"), row(60000002, "已預約")]);
  const trend = buildLeadDashboardTrend({ groups, brands, filters, brandColors: {}, annotations: [] });
  expect(trend[0].points[0]).toMatchObject({ date: "2026-09-15", bookings: 1, noShows: 1 });
});

test("numeric provider phones reconcile the stored reporting aggregation", () => {
  const result = aggregateLeadSheetPerformance({
    headers, rows: [row(60000001, "no show"), row(60000002, "已預約")], brands,
    sourceBrandId: null, eventLedger: { headers: eventHeaders, rows: events },
    dailyThroughDate: "2026-09-15", activityThroughDate: "2026-09-15", pendingThroughDate: "2026-09-30",
  });
  expect(result.dailyMetrics.find(m => m.date === "2026-09-15")).toMatchObject({ bookings: 1, shows: 0 });
  const currentFacts = result.metricFacts.filter(f => f.metricDate === "2026-09-15");
  expect(currentFacts.find(f => f.metricKind === "book")?.count).toBe(1);
  expect(currentFacts.find(f => f.metricKind === "no_show")?.count).toBe(1);
  expect(result.metricFacts.some(f => f.metricKind === "no_show" && f.metricDate === "2026-09-13")).toBe(false);
});

test("numeric, text and country-code phones deduplicate to one brand identity", () => {
  for (const appsScriptContract of [true, false]) {
    const groups = groupsFor([row(60000001), row("60000001"), row("+852 6000 0001"), row(85260000001)], appsScriptContract);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("example-brand|phone:60000001");
    expect(groups[0].rows).toHaveLength(4);
  }
});

test("numeric phone remains authoritative when an unrelated lead_key is present", () => {
  const groups = joined([row(60000001, "no show", "Example Beauty", "synthetic-source-key")]);
  expect(groups[0]).toMatchObject({ key: "example-brand|phone:60000001", usesEventLedger: true, noShowDate: "2026-09-15" });
});

test("same numeric phone stays separated across brands", () => {
  const groups = groupsFor([row(60000001), row(60000001, "待跟進", "Other Beauty")]);
  expect(groups).toHaveLength(2);
  expect(new Set(groups.map(g => g.key)).size).toBe(2);
});

test("numeric phone retains first Book after a later Show event", () => {
  const r = row(60000002, "已到店");
  r[0] = 46282.5; // September 17; current row must not move the earlier Book.
  const groups = joined([r], [...events, event("synthetic-show", "show", 60000002, "2026-09-17")]);
  expect(groups[0]).toMatchObject({ bookDate: "2026-09-15", showDate: "2026-09-17", bookDateSource: "event_ledger" });
});

for (const [label, value] of [
  ["null", null], ["boolean", true], ["NaN", NaN], ["infinity", Infinity],
  ["fractional", 60000001.5], ["negative", -60000001], ["unsafe", Number.MAX_SAFE_INTEGER + 1],
] as const) {
  test(`invalid numeric phone ${label} does not manufacture an identity`, () => {
    expect(groupsFor([row(value, "待跟進", "Example Beauty", "synthetic-key")])[0].key).toBe("example-brand|lead:synthetic-key");
  });
}

test("blank phone and lead_key keep explicit row fallback", () => {
  expect(groupsFor([row("")])[0].key).toBe("example-brand|row:2");
});
