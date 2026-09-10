import { expect, test } from "@playwright/test";
import {
  aggregateLeadSheetPerformance,
  buildLeadSheetGroups,
  normalizeLeadSheetStatus,
} from "../src/lib/marketing/googleSheetsMetricParser";
import { applyLeadFunnelEventLedger } from "../src/lib/marketing/leadFunnelEventLedger";

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
  "lead_key",
  "Status",
  "Show up",
];
const eventHeaders = [
  "Event ID",
  "Event At",
  "Event Date",
  "Event Type",
  "lead_key",
  "Brand",
  "Phone Last8",
  "Source Row",
  "Status Before",
  "Status After",
  "Created At",
  "Treatment",
  "Source",
  "Campaign",
  "Branch",
];

function eventRow(input: {
  id: string;
  date: string;
  type: string;
  phone: string;
  leadKey: string;
}) {
  return [
    input.id,
    `${input.date} 10:00:00`,
    input.date,
    input.type,
    input.leadKey,
    "Brand A",
    input.phone,
    2,
    "",
    "",
    "2026-09-01 09:00:00",
    "Treatment A",
    "Meta",
    "Campaign A",
    "Branch A",
  ];
}

test("C 欄跟進狀態 is authoritative and legacy fields only fallback when C is blank", () => {
  expect(
    normalizeLeadSheetStatus({
      followStatus: "待跟進",
      status: "",
      showUp: "No Show",
    })
  ).toBe("lead");
  expect(
    normalizeLeadSheetStatus({
      followStatus: "",
      status: "",
      showUp: "No Show",
    })
  ).toBe("no_show");
});

test("immutable ledger preserves Book when current status later becomes Show", () => {
  const rows = [[
    "2026-09-08 10:00:00",
    "2026-09-01 09:00:00",
    "已完成",
    "Brand A",
    "91230001",
    "Treatment A",
    "Meta",
    "Campaign A",
    "2026-09-05",
    "2026-09-08",
    "Branch A",
    "lead-a",
    "",
    "",
  ]];
  const base = buildLeadSheetGroups({
    headers,
    rows,
    brands,
    sourceBrandId: null,
    appsScriptContract: true,
    dedupeByIdentity: true,
  });
  const groups = applyLeadFunnelEventLedger({
    groups: base.groups,
    brands,
    eventLedger: {
      headers: eventHeaders,
      rows: [
        eventRow({ id: "e1", date: "2026-09-01", type: "lead", phone: "91230001", leadKey: "lead-a" }),
        eventRow({ id: "e2", date: "2026-09-03", type: "book", phone: "91230001", leadKey: "lead-a" }),
        eventRow({ id: "e3", date: "2026-09-08", type: "show", phone: "91230001", leadKey: "lead-a" }),
      ],
    },
  });
  expect(groups[0]).toMatchObject({
    firstTouchDate: "2026-09-01",
    currentStatus: "show",
    usesEventLedger: true,
    bookDate: "2026-09-03",
    bookDateSource: "event_ledger",
    showDate: "2026-09-08",
    noShowDate: null,
  });
});

test("daily and treatment metrics use ledger dates and ignore appointment date for No Show", () => {
  const rows = [
    [
      "2026-09-08", "2026-09-01", "已完成", "Brand A", "91230001", "Treatment A",
      "Meta", "Campaign A", "2026-09-05", "2026-09-08", "Branch A", "lead-a", "", "",
    ],
    [
      "2026-09-09", "2026-09-02", "No Show", "Brand A", "91230002", "Treatment A",
      "Meta", "Campaign A", "2026-09-20", "", "Branch A", "lead-b", "", "",
    ],
  ];
  const eventLedger = {
    headers: eventHeaders,
    rows: [
      eventRow({ id: "a1", date: "2026-09-01", type: "lead", phone: "91230001", leadKey: "lead-a" }),
      eventRow({ id: "a2", date: "2026-09-03", type: "book", phone: "91230001", leadKey: "lead-a" }),
      eventRow({ id: "a3", date: "2026-09-08", type: "show", phone: "91230001", leadKey: "lead-a" }),
      eventRow({ id: "b1", date: "2026-09-02", type: "lead", phone: "91230002", leadKey: "lead-b" }),
      eventRow({ id: "b2", date: "2026-09-04", type: "book", phone: "91230002", leadKey: "lead-b" }),
      eventRow({ id: "b3", date: "2026-09-09", type: "no_show", phone: "91230002", leadKey: "lead-b" }),
      // Duplicate event rows must never inflate metrics.
      eventRow({ id: "b3-duplicate", date: "2026-09-09", type: "no_show", phone: "91230002", leadKey: "lead-b" }),
    ],
  };
  const result = aggregateLeadSheetPerformance({
    headers,
    rows,
    brands,
    sourceBrandId: null,
    eventLedger,
    dailyThroughDate: "2026-09-30",
    activityThroughDate: "2026-09-30",
    pendingThroughDate: "2027-12-31",
  });
  const byDate = Object.fromEntries(result.dailyMetrics.map((row) => [row.date, row]));
  expect(byDate["2026-09-01"]).toMatchObject({ leads: 1, bookings: 0, shows: 0 });
  expect(byDate["2026-09-02"]).toMatchObject({ leads: 1, bookings: 0, shows: 0 });
  expect(byDate["2026-09-03"]).toMatchObject({ leads: 0, bookings: 1, shows: 0 });
  expect(byDate["2026-09-04"]).toMatchObject({ leads: 0, bookings: 1, shows: 0 });
  expect(byDate["2026-09-08"]).toMatchObject({ leads: 0, bookings: 0, shows: 1 });
  expect(result.metricFacts).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ metricKind: "book", metricDate: "2026-09-03", count: 1 }),
      expect.objectContaining({ metricKind: "show", metricDate: "2026-09-08", count: 1 }),
      expect.objectContaining({ metricKind: "no_show", metricDate: "2026-09-09", count: 1 }),
    ])
  );
  expect(result.metricFacts).not.toEqual(
    expect.arrayContaining([
      expect.objectContaining({ metricKind: "no_show", metricDate: "2026-09-20" }),
    ])
  );
});

test("no-ledger rows keep legacy historical ownership", () => {
  const parsed = buildLeadSheetGroups({
    headers,
    rows: [[
      "2026-09-03", "2026-09-01", "已完成", "Brand A", "91230003", "Treatment A",
      "Meta", "Campaign A", "2026-09-05", "2026-09-08", "Branch A", "lead-c", "", "",
    ]],
    brands,
    sourceBrandId: null,
    appsScriptContract: true,
    dedupeByIdentity: true,
  });
  expect(parsed.groups[0]).toMatchObject({
    usesEventLedger: false,
    bookDate: "2026-09-03",
    bookDateSource: "last_updated",
    showDate: "2026-09-08",
  });
});

test("same brand and phone is counted once in synced aggregate", () => {
  const result = aggregateLeadSheetPerformance({
    headers,
    rows: [
      ["", "2026-09-01", "待跟進", "Brand A", "91230004", "Treatment A", "Meta", "Campaign A", "", "", "Branch A", "first", "", ""],
      ["", "2026-09-02", "待跟進", "Brand A", "91230004", "Treatment A", "Meta", "Campaign B", "", "", "Branch A", "duplicate", "", ""],
    ],
    brands,
    sourceBrandId: null,
    dailyThroughDate: "2026-09-30",
    activityThroughDate: "2026-09-30",
    pendingThroughDate: "2027-12-31",
  });
  expect(result.dailyMetrics.reduce((sum, row) => sum + row.leads, 0)).toBe(1);
});
