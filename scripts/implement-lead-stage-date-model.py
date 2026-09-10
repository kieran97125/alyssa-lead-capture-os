from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding='utf-8')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected 1 match, found {count}')
    return text.replace(old, new, 1)


# -----------------------------------------------------------------------------
# Parser / grouped event model
# -----------------------------------------------------------------------------
parser_path = 'src/lib/marketing/googleSheetsMetricParser.ts'
parser = read(parser_path)

parser = replace_once(
    parser,
    '''export type LeadSheetLeadGroup = {
  key: string;
  brandId: string;
  brandLabel: string;
  treatmentLabel: string;
  sourceLabel: string;
  campaignLabel: string;
  branchLabel: string;
  firstTouchDate: string | null;
  bookDate?: string | null;
  bookDateSource?: "last_updated" | "legacy_created_at" | null;
  rows: LeadSheetGroupRow[];
};''',
    '''export type LeadSheetLeadGroup = {
  key: string;
  brandId: string;
  brandLabel: string;
  treatmentLabel: string;
  sourceLabel: string;
  campaignLabel: string;
  branchLabel: string;
  firstTouchDate: string | null;
  usesStageDateContract: boolean;
  currentStatus: LeadSheetStatus;
  currentEventDate: string | null;
  currentRowNumber: number;
  bookDate: string | null;
  bookDateSource: "last_updated" | "legacy_created_at" | null;
  showDate: string | null;
  noShowDate: string | null;
  pendingRowNumber: number | null;
  rows: LeadSheetGroupRow[];
};''',
    'LeadSheetLeadGroup type',
)

status_pattern = re.compile(
    r'export function normalizeLeadSheetStatus\(input: \{[\s\S]*?\n\}\n\nfunction matchingTreatmentAlias',
    re.MULTILINE,
)
status_replacement = '''function normalizePrimaryLeadSheetStatus(value: unknown): LeadSheetStatus | null {
  const normalized = normalizeComparableText(value);
  if (!normalized) return null;
  if (["待跟進", "lead", "new lead", "未預約"].includes(normalized)) {
    return "lead";
  }
  if (
    ["已預約", "booked", "confirmed", "rescheduled", "requested"].includes(
      normalized
    )
  ) {
    return "booked";
  }
  if (
    [
      "已到店",
      "已完成",
      "完成療程",
      "show",
      "show up",
      "completed",
    ].includes(normalized)
  ) {
    return "show";
  }
  if (["no show", "noshow", "no-show", "未到店"].includes(normalized)) {
    return "no_show";
  }
  return null;
}

function normalizeLegacyLeadSheetStatus(input: {
  status?: unknown;
  showUp?: unknown;
}) {
  const joined = [input.status, input.showUp]
    .map(normalizeComparableText)
    .filter(Boolean)
    .join(" ");
  if (
    joined.includes("no show") ||
    joined.includes("noshow") ||
    joined.includes("no-show") ||
    joined.includes("未到店")
  ) {
    return "no_show" as const;
  }
  if (
    joined.includes("已到店") ||
    joined.includes("已完成") ||
    joined.includes("完成療程") ||
    joined === "show" ||
    joined.includes("show up") ||
    joined.includes("completed")
  ) {
    return "show" as const;
  }
  if (
    joined.includes("已預約") ||
    joined.includes("booked") ||
    joined.includes("confirmed") ||
    joined.includes("rescheduled") ||
    joined.includes("requested")
  ) {
    return "booked" as const;
  }
  return "lead" as const;
}

export function normalizeLeadSheetStatus(input: {
  followStatus: unknown;
  status?: unknown;
  showUp?: unknown;
}) {
  const followStatus = compactString(input.followStatus);

  // C 欄「跟進狀態」係唯一主要狀態來源。只有 C 真正空白，
  // 先會用 legacy Status / Show up 作兼容 fallback。
  if (followStatus) {
    return normalizePrimaryLeadSheetStatus(followStatus) ?? "lead";
  }
  return normalizeLegacyLeadSheetStatus(input);
}

function normalizeAppsScriptLeadSheetStatus(input: {
  followStatus: unknown;
  status?: unknown;
  showUp?: unknown;
}) {
  return normalizeLeadSheetStatus(input);
}

function matchingTreatmentAlias'''
parser, count = status_pattern.subn(status_replacement, parser, count=1)
if count != 1:
    raise RuntimeError(f'status normalization block: found {count}')

parser = replace_once(
    parser,
    '''    if (status === "show" && !confirmationDate) {
      diagnostics.invalidShowDateRows += 1;
    }
    const appointmentDate = parseGoogleSheetDate(
      valueAt(rawRow, "appointmentDate")
    );
    if (["booked", "no_show"].includes(status) && !appointmentDate) {
      diagnostics.invalidAppointmentDateRows += 1;
    }''',
    '''    if (status === "show" && !confirmationDate && !lastUpdatedDate) {
      diagnostics.invalidShowDateRows += 1;
    }
    const appointmentDate = parseGoogleSheetDate(
      valueAt(rawRow, "appointmentDate")
    );
    if (
      (status === "booked" && !appointmentDate) ||
      (status === "no_show" && !appointmentDate && !lastUpdatedDate)
    ) {
      diagnostics.invalidAppointmentDateRows += 1;
    }''',
    'stage-date diagnostics',
)

sort_pattern = re.compile(
    r'(function createdAtSortValue\(value: unknown, rowNumber: number\) \{[\s\S]*?\n\})\n\nexport function buildLeadSheetGroups',
    re.MULTILINE,
)
sort_helper = r'''\1

function stageEventSortValue(row: LeadSheetGroupRow) {
  if (row.lastUpdatedDate) {
    const raw = compactString(row.lastUpdatedAt);
    const timeMatch = raw.match(/(?:T|\s)(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    const time = timeMatch
      ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}:${
          timeMatch[3] || "00"
        }`
      : "00:00:00";
    return `${row.lastUpdatedDate} ${time}|${String(row.rowNumber).padStart(
      10,
      "0"
    )}`;
  }
  return createdAtSortValue(row.createdAt, row.rowNumber);
}

export function buildLeadSheetGroups'''
parser, count = sort_pattern.subn(sort_helper, parser, count=1)
if count != 1:
    raise RuntimeError(f'stage event sort insertion: found {count}')

group_pattern = re.compile(
    r'''    const bookedRows = rows\.filter\(\(row\) => row\.status !== "lead"\);[\s\S]*?    return \{\n      key,[\s\S]*?      rows,\n    \} satisfies LeadSheetLeadGroup;''',
    re.MULTILINE,
)
group_replacement = '''    const usesStageDateContract = Boolean(first.row.lastUpdatedDate);
    const currentRow = [...rows].sort((left, right) =>
      stageEventSortValue(left).localeCompare(stageEventSortValue(right))
    )[rows.length - 1];
    const currentStatus = currentRow.status;
    const currentEventDate = usesStageDateContract
      ? currentRow.lastUpdatedDate ?? currentRow.createdDate
      : null;
    const bookDate =
      currentStatus === "lead"
        ? null
        : usesStageDateContract
          ? currentEventDate
          : first.row.createdDate;
    const bookDateSource =
      bookDate === null
        ? null
        : usesStageDateContract
          ? "last_updated"
          : "legacy_created_at";
    const legacyShowDate = rows
      .filter((row) => row.status === "show" && row.confirmationDate)
      .map((row) => row.confirmationDate as string)
      .sort()[0] ?? null;
    const legacyNoShowDate = rows
      .filter((row) => row.status === "no_show" && row.appointmentDate)
      .map((row) => row.appointmentDate as string)
      .sort()[0] ?? null;
    const showDate = usesStageDateContract
      ? currentStatus === "show"
        ? currentEventDate
        : null
      : legacyShowDate;
    const noShowDate = usesStageDateContract
      ? currentStatus === "no_show"
        ? currentEventDate
        : null
      : legacyNoShowDate;
    const legacyPendingRow = rows
      .filter((row) => row.status === "booked" && row.appointmentDate)
      .sort(
        (left, right) =>
          String(left.appointmentDate).localeCompare(
            String(right.appointmentDate)
          ) || left.rowNumber - right.rowNumber
      )[0];
    const pendingRowNumber = usesStageDateContract
      ? currentStatus === "booked"
        ? currentRow.rowNumber
        : null
      : legacyPendingRow?.rowNumber ?? null;

    return {
      key,
      brandId: first.brand.id,
      brandLabel: first.brand.name,
      treatmentLabel: first.treatmentLabel,
      sourceLabel: first.sourceLabel,
      campaignLabel: first.campaignLabel,
      branchLabel: first.branchLabel,
      firstTouchDate: first.row.createdDate,
      usesStageDateContract,
      currentStatus,
      currentEventDate,
      currentRowNumber: currentRow.rowNumber,
      bookDate,
      bookDateSource,
      showDate,
      noShowDate,
      pendingRowNumber,
      rows,
    } satisfies LeadSheetLeadGroup;'''
parser, count = group_pattern.subn(group_replacement, parser, count=1)
if count != 1:
    raise RuntimeError(f'group stage derivation: found {count}')

helper_pattern = re.compile(
    r'''export function leadGroupBookDate\(group: LeadSheetLeadGroup\) \{[\s\S]*?\n\}\n\nexport function aggregateLeadSheetPerformance''',
    re.MULTILINE,
)
helper_replacement = '''export function leadGroupBookDate(group: LeadSheetLeadGroup) {
  return group.bookDate;
}

export function leadGroupShowDate(group: LeadSheetLeadGroup) {
  return group.showDate;
}

export function leadGroupNoShowDate(group: LeadSheetLeadGroup) {
  return group.noShowDate;
}

export function leadGroupCurrentBookedRow(group: LeadSheetLeadGroup) {
  if (group.pendingRowNumber === null) return null;
  return (
    group.rows.find((row) => row.rowNumber === group.pendingRowNumber) ?? null
  );
}

export function aggregateLeadSheetPerformance'''
parser, count = helper_pattern.subn(helper_replacement, parser, count=1)
if count != 1:
    raise RuntimeError(f'lead group helper block: found {count}')

aggregate_pattern = re.compile(
    r'''    const showDate = group\.rows[\s\S]*?    if \(pendingDate && pendingDate <= input\.pendingThroughDate\) \{[\s\S]*?    \}\n''',
    re.MULTILINE,
)
aggregate_replacement = '''    const showDate = leadGroupShowDate(group);
    if (showDate && showDate <= input.dailyThroughDate) {
      getDailyMetric(group.brandId, showDate).shows += 1;
    }
    if (showDate && showDate <= input.activityThroughDate) {
      addFact({ ...dimensions, metricDate: showDate, metricKind: "show" });
    }

    const noShowDate = leadGroupNoShowDate(group);
    if (noShowDate && noShowDate <= input.activityThroughDate) {
      addFact({
        ...dimensions,
        metricDate: noShowDate,
        metricKind: "no_show",
      });
    }

    const pendingRow = leadGroupCurrentBookedRow(group);
    const pendingDate = pendingRow?.appointmentDate ?? null;
    if (pendingDate && pendingDate <= input.pendingThroughDate) {
      addFact({
        ...dimensions,
        metricDate: pendingDate,
        metricKind: "pending_show",
      });
    }
'''
parser, count = aggregate_pattern.subn(aggregate_replacement, parser, count=1)
if count != 1:
    raise RuntimeError(f'aggregate state dates: found {count}')

write(parser_path, parser)

# -----------------------------------------------------------------------------
# Dashboard math
# -----------------------------------------------------------------------------
dashboard_path = 'src/lib/marketing/leadDashboardMath.ts'
dashboard = read(dashboard_path)
dashboard = replace_once(
    dashboard,
    '''import {
  leadGroupBookDate,
  type LeadSheetLeadGroup,''',
    '''import {
  leadGroupBookDate,
  leadGroupCurrentBookedRow,
  leadGroupNoShowDate,
  leadGroupShowDate,
  type LeadSheetLeadGroup,''',
    'dashboard helper imports',
)

dashboard = replace_once(
    dashboard,
    '''          if (
            group.rows.some(
              (row) => row.status === "show" && row.confirmationDate === date
            )
          ) base.shows += 1;
          if (
            group.rows.some(
              (row) => row.status === "no_show" && row.appointmentDate === date
            )
          ) base.noShows += 1;
          if (
            group.rows.some(
              (row) => row.status === "booked" && row.appointmentDate === date
            )
          ) base.pendingShows += 1;''',
    '''          if (leadGroupShowDate(group) === date) base.shows += 1;
          if (leadGroupNoShowDate(group) === date) base.noShows += 1;
          const pendingRow = leadGroupCurrentBookedRow(group);
          if (pendingRow?.appointmentDate === date) base.pendingShows += 1;''',
    'dashboard trend dates',
)

first_outstanding_pattern = re.compile(
    r'''function firstOutstandingRow\([\s\S]*?\n\}\n\nfunction statsForGroups''',
    re.MULTILINE,
)
first_outstanding_replacement = '''function firstOutstandingRow(
  group: LeadSheetLeadGroup,
  startDate: string,
  endDate: string
) {
  const row = leadGroupCurrentBookedRow(group);
  return row && inRange(row.appointmentDate, startDate, endDate) ? row : null;
}

function statsForGroups'''
dashboard, count = first_outstanding_pattern.subn(
    first_outstanding_replacement, dashboard, count=1
)
if count != 1:
    raise RuntimeError(f'first outstanding helper: found {count}')

stats_pattern = re.compile(
    r'''    if \(\n      group\.rows\.some\(\n        \(row\) =>\n          row\.status === "show"[\s\S]*?    \) \{\n      noShows \+= 1;\n    \}''',
    re.MULTILINE,
)
stats_replacement = '''    if (
      inRange(
        leadGroupShowDate(group),
        filters.startDate,
        filters.endDate
      )
    ) {
      shows += 1;
    }
    if (
      inRange(
        leadGroupNoShowDate(group),
        filters.startDate,
        filters.endDate
      )
    ) {
      noShows += 1;
    }'''
dashboard, count = stats_pattern.subn(stats_replacement, dashboard, count=1)
if count != 1:
    raise RuntimeError(f'dashboard stats dates: found {count}')
write(dashboard_path, dashboard)

# -----------------------------------------------------------------------------
# User-facing definitions
# -----------------------------------------------------------------------------
panel_path = 'src/components/command-center/LeadDashboardPanel.tsx'
panel = read(panel_path)
panel = replace_once(
    panel,
    '''            Lead 按首次查詢日；Book 按首次預約更新日。舊 Lead 冇該日期時繼續按首次查詢日。''',
    '''            Lead 按 Created At；新 Lead 嘅 Book／Show／No Show 按最後更新日期＋目前跟進狀態。舊 Lead 保留原有日期口徑。''',
    'dashboard panel header definition',
)
panel = panel.replace(
    'meta={`${formatPercent(snapshot.totals.bookRate)} Book Rate`}',
    'meta={`${formatPercent(snapshot.totals.bookRate)} 已進入預約流程`}',
    1,
)
panel = replace_once(
    panel,
    '''            Lead 按同品牌同電話尾 8 位嘅首次查詢日期；Book 按首次預約更新日，舊 Lead 冇該日期時沿用首次查詢日期；
            Show 按確認到店日期；No Show 同本月未 Show 按預約日期。Book 包括已預約、已到店及 No Show。''',
    '''            Lead 按同品牌同電話尾 8 位嘅 Created At。新 Lead 以「最後更新日期＋目前跟進狀態」判斷：
            已預約＝Book 未 Show、已完成／已到店＝Show、No Show＝當日 No Show、待跟進＝未 Book。Book 仍包括已預約、Show 及 No Show；舊 Lead 保留原有日期口徑。''',
    'dashboard panel detailed definition',
)
write(panel_path, panel)

# -----------------------------------------------------------------------------
# Focused acceptance tests
# -----------------------------------------------------------------------------
test_path = 'e2e/lead-sheet-book-event-date.spec.ts'
test_content = '''import { expect, test } from "@playwright/test";
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
'''
write(test_path, test_content)

contract_path = 'scripts/verify-lead-sheet-book-date-contract.mjs'
contract = read(contract_path)
contract = replace_once(
    contract,
    '''assert.match(parser, /bookDateSource/);
assert.match(parser, /isV3Lead = Boolean\(first\.row\.lastUpdatedDate\)/);
assert.match(parser, /leadGroupBookDate/);
assert.match(dashboard, /leadGroupBookDate\(group\) === date/);
assert.match(panel, /Book 按首次預約更新日/);
assert.match(panel, /舊 Lead 冇該日期時繼續按首次查詢日/);

console.log("Lead Sheet v3 dual contract and Book event-date ownership verified.");''',
    '''assert.match(parser, /usesStageDateContract/);
assert.match(parser, /currentStatus/);
assert.match(parser, /currentEventDate/);
assert.match(parser, /leadGroupBookDate/);
assert.match(parser, /leadGroupShowDate/);
assert.match(parser, /leadGroupNoShowDate/);
assert.match(parser, /C 欄「跟進狀態」係唯一主要狀態來源/);
assert.match(dashboard, /leadGroupShowDate\(group\) === date/);
assert.match(dashboard, /leadGroupNoShowDate\(group\) === date/);
assert.match(panel, /最後更新日期＋目前跟進狀態/);
assert.match(panel, /已預約＝Book 未 Show/);

console.log("Lead Sheet v3 dual contract and current-stage event-date ownership verified.");''',
    'stage-date build contract',
)
write(contract_path, contract)

cutover_path = 'docs/lead-sheet-v3-book-event-date-cutover.md'
cutover = read(cutover_path)
cutover = cutover.replace(
    '- Book：新 Lead 按最左欄 `最後更新日期`，由首次進入已預約／已到店／No Show 時鎖定。\n- Show：繼續按 `確認到店日期`。\n- No Show：繼續按 `預約日期`。',
    '- Book：新 Lead 由 `最後更新日期 + 目前跟進狀態` 判斷；已預約、已完成／已到店及 No Show 都代表曾進入預約流程。\n- Show：新 Lead 由 `最後更新日期 + 已完成／已到店` 判斷。\n- No Show：新 Lead 由 `最後更新日期 + No Show` 判斷。',
)
cutover = cutover.replace(
    '7. 隔日將該 Lead 首次改成 `已預約`：只更新 A；B 不變。\n8. 再改 CS Remark／已到店：A 不可再刷新；Show 仍按確認到店日期。',
    '7. 隔日將該 Lead 改成 `已預約`：A 更新為 Book 日期；B 不變。\n8. 再改 CS Remark：A 不變；再改成 `已完成／已到店` 或 `No Show`：A 更新為該次狀態日期。',
)
cutover = cutover.replace(
    '- 只在由非 Book 狀態首次轉入 Book 狀態時更新 A；之後改到店、No Show、備註或分店都不可再覆蓋。',
    '- 只有 C 欄 Funnel stage 真正改變先更新 A；備註、分店、電話、療程等非狀態修改不可更新 A。',
)
write(cutover_path, cutover)

learning_path = 'docs/product-learning/entries/2026-09-04-lead-sheet-book-event-date.md'
learning = read(learning_path)
learning = learning.replace('Book event-date ownership', 'current-stage event-date ownership')
learning += '''\n\n## 2026-09-10 clarification\n\nThe visible register is a current-state projection: `Created At` remains immutable first touch, while `最後更新日期` is the date of the current Funnel stage. For new-contract Leads, Book, Show and No Show therefore follow the current status plus that date; `跟進狀態` is authoritative and legacy Status / Show up fields are fallback-only. Historical Leads with a blank stage-date column retain the earlier date model.\n'''
write(learning_path, learning)

print('Implemented current-stage event-date model for Growth OS.')
