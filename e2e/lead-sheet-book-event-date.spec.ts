import { expect, test } from "@playwright/test";
import {
  aggregateLeadSheetPerformance,
  buildLeadSheetGroups,
  normalizeLeadSheetStatus,
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
  "Status",
  "Show up",
];

function groupsFor(rows: unknown[][]) {
  return buildLeadSheetGroups({
    headers,
    rows,
    brands,
    sourceBrandId: null,
    appsScriptContract: true,
    dedupeByIdentity: true,
  }).groups;
}

test("C 欄跟進狀態 overrides legacy Status / Show up", () => {
  expect(
    normalizeLeadSheetStatus({
      followStatus: "已完成",
      status: "",
      showUp: "no show",
    })
  ).toBe("show");
  expect(
    normalizeLeadSheetStatus({
      followStatus: "",
      status: "",
      showUp: "no show",
    })
  ).toBe("no_show");
});

test("new Lead uses current stage date while Created At stays first touch", () => {
  const [shown] = groupsFor([
    [
      "2026-09-05 12:00:00",
      "2026-09-01 09:00:00",
      "已完成",
      "Brand A",
      "91230001",
      "Treatment A",
      "Meta",
      "Campaign A",
      "2026-09-20",
      "2026-09-30",
      "Branch A",
      "",
      "no show",
    ],
  ]);

  expect(shown).toMatchObject({
    firstTouchDate: "2026-09-01",
    usesStageDateContract: true,
    currentStatus: "show",
    currentEventDate: "2026-09-05",
    bookDate: "2026-09-05",
    showDate: "2026-09-05",
    noShowDate: null,
  });
});

test("latest stage row controls a new deduped Lead", () => {
  const [group] = groupsFor([
    [
      "2026-09-02 10:00:00",
      "2026-09-01 09:00:00",
      "已預約",
      "Brand A",
      "91230002",
      "Treatment A",
      "Meta",
      "Campaign A",
      "2026-09-10",
      "",
      "Branch A",
      "",
      "",
    ],
    [
      "2026-09-06 18:00:00",
      "2026-09-01 09:00:00",
      "no show",
      "Brand A",
      "91230002",
      "Treatment A",
      "Meta",
      "Campaign A",
      "2026-09-10",
      "",
      "Branch A",
      "",
      "",
    ],
  ]);
  expect(group).toMatchObject({
    currentStatus: "no_show",
    currentEventDate: "2026-09-06",
    bookDate: "2026-09-06",
    showDate: null,
    noShowDate: "2026-09-06",
  });
});

test("legacy Lead remains on the old date model", () => {
  const [legacy] = groupsFor([
    [
      "",
      "2026-09-01 09:00:00",
      "已完成",
      "Brand A",
      "91230003",
      "Treatment A",
      "Meta",
      "Campaign A",
      "2026-09-10",
      "2026-09-07",
      "Branch A",
      "",
      "",
    ],
  ]);
  expect(legacy).toMatchObject({
    firstTouchDate: "2026-09-01",
    usesStageDateContract: false,
    bookDate: "2026-09-01",
    showDate: "2026-09-07",
    noShowDate: null,
  });
});

test("daily facts and Dashboard use stage date for Book Show and No Show", () => {
  const rows = [
    ["2026-09-05", "2026-09-01", "已完成", "Brand A", "91230001", "Treatment A", "Meta", "Campaign A", "2026-09-20", "2026-09-30", "Branch A", "", ""],
    ["2026-09-06", "2026-09-02", "no show", "Brand A", "91230002", "Treatment A", "Meta", "Campaign A", "2026-09-28", "", "Branch A", "", ""],
    ["2026-09-03", "2026-09-03", "已預約", "Brand A", "91230003", "Treatment A", "Meta", "Campaign A", "2026-09-12", "", "Branch A", "", ""],
  ];
  const groups = groupsFor(rows);
  const result = aggregateLeadSheetPerformance({
    headers,
    rows,
    brands,
    sourceBrandId: null,
    dailyThroughDate: "2026-09-30",
    activityThroughDate: "2026-09-30",
    pendingThroughDate: "2027-12-31",
  });
  const byDate = Object.fromEntries(result.dailyMetrics.map((row) => [row.date, row]));
  expect(byDate["2026-09-01"]).toMatchObject({ leads: 1, bookings: 0, shows: 0 });
  expect(byDate["2026-09-02"]).toMatchObject({ leads: 1, bookings: 0, shows: 0 });
  expect(byDate["2026-09-03"]).toMatchObject({ leads: 1, bookings: 1, shows: 0 });
  expect(byDate["2026-09-05"]).toMatchObject({ leads: 0, bookings: 1, shows: 1 });
  expect(byDate["2026-09-06"]).toMatchObject({ leads: 0, bookings: 1, shows: 0 });
  expect(
    result.metricFacts.find(
      (fact) => fact.metricKind === "no_show" && fact.metricDate === "2026-09-06"
    )
  ).toBeTruthy();

  const model = buildLeadDashboardModel({
    groups,
    brands,
    filters: {
      startDate: "2026-09-05",
      endDate: "2026-09-06",
      brandId: "",
      treatment: "",
    },
  });
  expect(model.totals).toMatchObject({
    leads: 0,
    bookings: 2,
    shows: 1,
    noShows: 1,
  });

  const trend = buildLeadDashboardTrend({
    groups,
    brands,
    filters: {
      startDate: "2026-09-05",
      endDate: "2026-09-06",
      brandId: "",
      treatment: "",
    },
    brandColors: { "brand-a": "#5a2348" },
    annotations: [],
  });
  expect(trend[0].points[0]).toMatchObject({ bookings: 1, shows: 1, noShows: 0 });
  expect(trend[0].points[1]).toMatchObject({ bookings: 1, shows: 0, noShows: 1 });
});
