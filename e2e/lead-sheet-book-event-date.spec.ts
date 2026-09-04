import { expect, test } from "@playwright/test";
import {
  aggregateLeadSheetPerformance,
  buildLeadSheetGroups,
} from "../src/lib/marketing/googleSheetsMetricParser";
import {
  buildLeadDashboardModel,
  buildLeadDashboardTrend,
} from "../src/lib/marketing/leadDashboardMath";

const brands = [{ id: "brand-a", name: "Brand A", slug: "brand-a" }];
const headers = [
  "最後更新日期",
  "Created At",
  "跟進狀態",
  "品牌",
  "電話",
  "療程項目",
  "來源",
  "Campaign / 廣告",
  "預約日期",
  "確認到店日期",
  "分店",
];

function parsedGroups() {
  return buildLeadSheetGroups({
    headers,
    rows: [
      [
        "2026-09-02 10:00:00",
        "2026-09-01 09:00:00",
        "已預約",
        "Brand A",
        "91230001",
        "Treatment A",
        "Meta",
        "Campaign A",
        "2026-09-10",
        "",
        "Branch A",
      ],
      [
        "",
        "2026-09-03 09:00:00",
        "已預約",
        "Brand A",
        "91230002",
        "Treatment A",
        "Meta",
        "Campaign A",
        "2026-09-12",
        "",
        "Branch A",
      ],
      [
        "",
        "2026-08-20 09:00:00",
        "待跟進",
        "Brand A",
        "91230003",
        "Treatment A",
        "Meta",
        "Campaign A",
        "",
        "",
        "Branch A",
      ],
      [
        "2026-09-04 13:00:00",
        "2026-09-04 13:00:00",
        "已預約",
        "Brand A",
        "91230003",
        "Treatment A",
        "Meta",
        "Campaign A",
        "2026-09-20",
        "",
        "Branch A",
      ],
    ],
    brands,
    sourceBrandId: null,
    appsScriptContract: true,
    dedupeByIdentity: true,
  }).groups;
}

test("new Lead books on 最後更新日期 while legacy Lead keeps Created At", () => {
  const groups = parsedGroups();
  expect(groups).toHaveLength(3);
  const newLead = groups.find((group) => group.key.includes("91230001"));
  const legacyLead = groups.find((group) => group.key.includes("91230002"));
  const legacyWithLaterDuplicate = groups.find((group) =>
    group.key.includes("91230003")
  );

  expect(newLead).toMatchObject({
    firstTouchDate: "2026-09-01",
    bookDate: "2026-09-02",
    bookDateSource: "last_updated",
  });
  expect(legacyLead).toMatchObject({
    firstTouchDate: "2026-09-03",
    bookDate: "2026-09-03",
    bookDateSource: "legacy_created_at",
  });
  // The first row identifies this as an old Lead, so a later duplicate created
  // after cutover must not rewrite the historical cohort's Book date.
  expect(legacyWithLaterDuplicate).toMatchObject({
    firstTouchDate: "2026-08-20",
    bookDate: "2026-08-20",
    bookDateSource: "legacy_created_at",
  });
});

test("daily metrics move only new Book events without changing full-period totals", () => {
  const result = aggregateLeadSheetPerformance({
    headers,
    rows: [
      ["2026-09-02", "2026-09-01", "已預約", "Brand A", "91230001", "Treatment A", "Meta", "Campaign A", "2026-09-10", "", "Branch A"],
      ["", "2026-09-03", "已預約", "Brand A", "91230002", "Treatment A", "Meta", "Campaign A", "2026-09-12", "", "Branch A"],
    ],
    brands,
    sourceBrandId: null,
    dailyThroughDate: "2026-09-30",
    activityThroughDate: "2026-09-30",
    pendingThroughDate: "2027-12-31",
  });
  const byDate = Object.fromEntries(
    result.dailyMetrics.map((row) => [row.date, row])
  );
  expect(byDate["2026-09-01"]).toMatchObject({ leads: 1, bookings: 0 });
  expect(byDate["2026-09-02"]).toMatchObject({ leads: 0, bookings: 1 });
  expect(byDate["2026-09-03"]).toMatchObject({ leads: 1, bookings: 1 });
  expect(result.dailyMetrics.reduce((sum, row) => sum + row.leads, 0)).toBe(2);
  expect(result.dailyMetrics.reduce((sum, row) => sum + row.bookings, 0)).toBe(2);
});

test("Dashboard totals and trend use independent Lead and Book event dates", () => {
  const groups = parsedGroups().filter((group) => !group.key.includes("91230003"));
  const dayOne = buildLeadDashboardModel({
    groups,
    brands,
    filters: {
      startDate: "2026-09-01",
      endDate: "2026-09-01",
      brandId: "",
      treatment: "",
    },
  });
  const dayTwo = buildLeadDashboardModel({
    groups,
    brands,
    filters: {
      startDate: "2026-09-02",
      endDate: "2026-09-02",
      brandId: "",
      treatment: "",
    },
  });
  const full = buildLeadDashboardModel({
    groups,
    brands,
    filters: {
      startDate: "2026-09-01",
      endDate: "2026-09-03",
      brandId: "",
      treatment: "",
    },
  });
  expect(dayOne.totals).toMatchObject({ leads: 1, bookings: 0 });
  expect(dayTwo.totals).toMatchObject({ leads: 0, bookings: 1 });
  expect(full.totals).toMatchObject({ leads: 2, bookings: 2 });

  const trend = buildLeadDashboardTrend({
    groups,
    brands,
    filters: {
      startDate: "2026-09-01",
      endDate: "2026-09-03",
      brandId: "",
      treatment: "",
    },
    brandColors: { "brand-a": "#5a2348" },
    annotations: [],
  });
  expect(trend[0].points.find((point) => point.date === "2026-09-01"))
    .toMatchObject({ leads: 1, bookings: 0 });
  expect(trend[0].points.find((point) => point.date === "2026-09-02"))
    .toMatchObject({ leads: 0, bookings: 1 });
  expect(trend[0].points.find((point) => point.date === "2026-09-03"))
    .toMatchObject({ leads: 1, bookings: 1 });
});
