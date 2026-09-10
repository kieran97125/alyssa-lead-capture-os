from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")

def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8")

def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)

# -----------------------------------------------------------------------------
# Parser: keep current-status display logic, but make historical funnel events
# immutable by applying the dedicated event ledger. Legacy/no-ledger rows retain
# the old historical ownership rules.
# -----------------------------------------------------------------------------
parser_path = "src/lib/marketing/googleSheetsMetricParser.ts"
parser = read(parser_path)
if not parser.startswith('import {\n  applyLeadFunnelEventLedger'):
    parser = (
        'import {\n'
        '  applyLeadFunnelEventLedger,\n'
        '  type LeadFunnelEventLedgerTable,\n'
        '} from "@/lib/marketing/leadFunnelEventLedger";\n\n'
        + parser
    )

parser = replace_once(
    parser,
    '  usesStageDateContract: boolean;\n  currentStatus: LeadSheetStatus;',
    '  usesStageDateContract: boolean;\n  usesEventLedger: boolean;\n  currentStatus: LeadSheetStatus;',
    "group ledger flag",
)
parser = replace_once(
    parser,
    '  bookDateSource: "last_updated" | "legacy_created_at" | null;',
    '  bookDateSource: "last_updated" | "legacy_created_at" | "event_ledger" | null;',
    "book date source union",
)

old_event_block = '''    const bookDate =
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
      : legacyNoShowDate;'''
new_event_block = '''    const bookedRows = rows.filter((row) => row.status !== "lead");
    const earliestStageBookDate =
      bookedRows
        .map((row) => row.lastUpdatedDate)
        .filter((value): value is string => Boolean(value))
        .sort()[0] ?? null;
    const bookDate =
      bookedRows.length === 0
        ? null
        : earliestStageBookDate ?? first.row.createdDate;
    const bookDateSource =
      bookDate === null
        ? null
        : earliestStageBookDate
          ? "last_updated"
          : "legacy_created_at";
    // No-ledger fallback deliberately keeps the pre-v4 historical ownership:
    // Show comes from confirmed-show date and No Show from appointment date.
    // Once a Lead has any valid `_funnel_events` row, the immutable ledger
    // overrides all three operational event dates below.
    const showDate =
      rows
        .filter((row) => row.status === "show" && row.confirmationDate)
        .map((row) => row.confirmationDate as string)
        .sort()[0] ?? null;
    const noShowDate =
      rows
        .filter((row) => row.status === "no_show" && row.appointmentDate)
        .map((row) => row.appointmentDate as string)
        .sort()[0] ?? null;'''
parser = replace_once(parser, old_event_block, new_event_block, "legacy fallback event block")
parser = replace_once(
    parser,
    '      usesStageDateContract,\n      currentStatus,',
    '      usesStageDateContract,\n      usesEventLedger: false,\n      currentStatus,',
    "group return ledger flag",
)

aggregate_signature = '''  treatmentAliases?: LeadSheetTreatmentAlias[];
  dailyThroughDate: string;'''
parser = replace_once(
    parser,
    aggregate_signature,
    '''  treatmentAliases?: LeadSheetTreatmentAlias[];
  eventLedger?: LeadFunnelEventLedgerTable | null;
  dailyThroughDate: string;''',
    "aggregate ledger input",
)
old_parsed = '''  const parsed = buildLeadSheetGroups({
    ...input,
    appsScriptContract: false,
    dedupeByIdentity: false,
  });'''
new_parsed = '''  const baseParsed = buildLeadSheetGroups({
    ...input,
    appsScriptContract: false,
    dedupeByIdentity: true,
  });
  const parsed = {
    ...baseParsed,
    groups: applyLeadFunnelEventLedger({
      groups: baseParsed.groups,
      eventLedger: input.eventLedger,
      brands: input.brands,
      brandAliases: input.brandAliases,
    }),
  };'''
parser = replace_once(parser, old_parsed, new_parsed, "aggregate ledger application")
write(parser_path, parser)

# -----------------------------------------------------------------------------
# Google Sheets reader: read the hidden immutable event ledger from the same
# workbook. Missing ledger is a safe rollout fallback; auth/provider failures are
# not silently swallowed.
# -----------------------------------------------------------------------------
table_path = "src/lib/integrations/googleSheetsLeadTable.ts"
table = read(table_path)
table = replace_once(
    table,
    'const META_RAW_TAIL_LAST_COLUMN = "BN";',
    'const META_RAW_TAIL_LAST_COLUMN = "BN";\nconst FUNNEL_EVENT_LEDGER_SHEET_NAME = "_funnel_events";\nconst FUNNEL_EVENT_LEDGER_LAST_COLUMN = "O";',
    "ledger constants",
)
ledger_reader = r'''

export async function readLeadFunnelEventLedger(
  configuration: LeadTableSourceConfiguration
): Promise<{ headers: unknown[]; rows: unknown[][] }> {
  const accessToken = await getGoogleSheetsOAuthAccessToken();
  const sourceSpreadsheetId = spreadsheetId(configuration);
  const query = new URLSearchParams({
    majorDimension: "ROWS",
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  query.append(
    "ranges",
    `${quoteSheetName(FUNNEL_EVENT_LEDGER_SHEET_NAME)}!A1:${FUNNEL_EVENT_LEDGER_LAST_COLUMN}${MAX_LEAD_ROWS}`
  );
  const response = await fetch(
    `${GOOGLE_SHEETS_API_BASE}/${encodeURIComponent(
      sourceSpreadsheetId
    )}/values:batchGet?${query.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    }
  );

  // During the rollout the hidden ledger may not exist yet. Treat only the
  // provider's missing/invalid-range statuses as an empty ledger so production
  // can safely deploy before the Sheet cutover.
  if ([400, 404].includes(response.status)) {
    return { headers: [], rows: [] };
  }
  if (!response.ok) {
    if ([401, 403].includes(response.status)) {
      throw new Error(
        "未能讀取 Lead Funnel Event Ledger；請重新連接公司 Google 帳戶。"
      );
    }
    throw new Error(
      `Lead Funnel Event Ledger 暫時讀取失敗（HTTP ${response.status}）。`
    );
  }

  const payload = (await response.json()) as {
    valueRanges?: GoogleValueRange[];
  };
  const values = payload.valueRanges?.[0]?.values ?? [];
  return {
    headers: values[0] ?? [],
    rows: values.slice(1),
  };
}
'''
if "export async function readLeadFunnelEventLedger(" not in table:
    table = table.rstrip() + ledger_reader + "\n"
write(table_path, table)

# -----------------------------------------------------------------------------
# Live Dashboard: load and apply the ledger to the deduplicated Lead groups.
# -----------------------------------------------------------------------------
dashboard_path = "src/lib/marketing/leadDashboard.ts"
dashboard = read(dashboard_path)
dashboard = replace_once(
    dashboard,
    '''  normalizeMetaLeadRowsInLiveTable,
  readLiveLeadTable,''',
    '''  normalizeMetaLeadRowsInLiveTable,
  readLeadFunnelEventLedger,
  readLiveLeadTable,''',
    "dashboard reader import",
)
if 'from "@/lib/marketing/leadFunnelEventLedger";' not in dashboard:
    dashboard = dashboard.replace(
        'import {\n  buildLeadSheetGroups,',
        'import { applyLeadFunnelEventLedger } from "@/lib/marketing/leadFunnelEventLedger";\nimport {\n  buildLeadSheetGroups,',
        1,
    )

dashboard = replace_once(
    dashboard,
    '    const rawLiveTable = await readLiveLeadTable(source.configuration);',
    '''    const [rawLiveTable, eventLedger] = await Promise.all([
      readLiveLeadTable(source.configuration),
      readLeadFunnelEventLedger(source.configuration),
    ]);''',
    "dashboard parallel ledger read",
)
old_live_parse = '''    const parsed = buildLeadSheetGroups({
      ...liveTable,
      brands,
      sourceBrandId: null,
      brandAliases: stringRecord(source.configuration.brandAliases),
      treatmentAliases: aliases,
      appsScriptContract: true,
      dedupeByIdentity: true,
    });'''
new_live_parse = '''    const baseParsed = buildLeadSheetGroups({
      ...liveTable,
      brands,
      sourceBrandId: null,
      brandAliases: stringRecord(source.configuration.brandAliases),
      treatmentAliases: aliases,
      appsScriptContract: true,
      dedupeByIdentity: true,
    });
    const parsed = {
      ...baseParsed,
      groups: applyLeadFunnelEventLedger({
        groups: baseParsed.groups,
        eventLedger,
        brands,
        brandAliases: stringRecord(source.configuration.brandAliases),
      }),
    };'''
dashboard = replace_once(dashboard, old_live_parse, new_live_parse, "dashboard ledger apply")
write(dashboard_path, dashboard)

# -----------------------------------------------------------------------------
# Scheduled Marketing sync: persist the same ledger-governed dates into daily
# metrics and treatment/source/campaign facts.
# -----------------------------------------------------------------------------
sync_path = "src/lib/integrations/googleSheetsMarketingSync.ts"
sync = read(sync_path)
sync = replace_once(
    sync,
    '''  normalizeMetaLeadRowsInLiveTable,
  readLiveLeadTable,''',
    '''  normalizeMetaLeadRowsInLiveTable,
  readLeadFunnelEventLedger,
  readLiveLeadTable,''',
    "sync reader import",
)
sync = replace_once(
    sync,
    '  const rawLiveTable = await readLiveLeadTable(configuration);',
    '''  const [rawLiveTable, eventLedger] = await Promise.all([
    readLiveLeadTable(configuration),
    readLeadFunnelEventLedger(configuration),
  ]);''',
    "sync parallel ledger read",
)
sync = replace_once(
    sync,
    '''    treatmentAliases: leadTreatmentAliases,
    dailyThroughDate: throughDate,''',
    '''    treatmentAliases: leadTreatmentAliases,
    eventLedger,
    dailyThroughDate: throughDate,''',
    "sync ledger aggregate input",
)
write(sync_path, sync)

# -----------------------------------------------------------------------------
# User-facing metric definitions.
# -----------------------------------------------------------------------------
panel_path = "src/components/command-center/LeadDashboardPanel.tsx"
panel = read(panel_path)
panel = replace_once(
    panel,
    '同一品牌及電話只計一次；Lead 按 Created At；新 Lead 嘅 Book／Show／No Show 按最後更新日期＋目前跟進狀態。',
    '同一品牌及電話只計一次；Lead 按 Created At；Book／Show／No Show 按不可變 Funnel Event 紀錄日期。',
    "panel header copy",
)
panel = replace_once(
    panel,
    '''            Lead 按同品牌同電話尾 8 位嘅 Created At。新 Lead 以「最後更新日期＋目前跟進狀態」判斷：
            已預約＝Book 未 Show、已完成／已到店＝Show、No Show＝當日 No Show、待跟進＝未 Book。
            Book 仍包括已預約、Show 及 No Show；舊 Lead 保留原有日期口徑。同期間比率係營運事件流量比率，唔係固定 cohort。''',
    '''            Lead 按同品牌同電話尾 8 位嘅 Created At；新版 Lead 嘅 Book、Show、No Show 由隱藏 Funnel Event Ledger 保存首次事件日期，
            所以之後狀態再轉變都唔會搬走之前嘅 Book。舊 Lead 未有 Event Ledger 時保留原有歷史日期口徑；
            C 欄「跟進狀態」仍然係目前狀態唯一主要來源。同期間比率係營運事件流量比率，唔係固定 cohort。''',
    "panel detailed copy",
)
write(panel_path, panel)

# -----------------------------------------------------------------------------
# Contract verifier.
# -----------------------------------------------------------------------------
verify_path = "scripts/verify-lead-sheet-book-date-contract.mjs"
write(
    verify_path,
    '''import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFile(`${root}${path}`, "utf8");
const [sync, table, normalizer, parser, ledger, dashboard, panel] = await Promise.all([
  read("src/lib/integrations/googleSheetsLeadSync.ts"),
  read("src/lib/integrations/googleSheetsLeadTable.ts"),
  read("src/lib/integrations/metaLeadFormSheetNormalizer.ts"),
  read("src/lib/marketing/googleSheetsMetricParser.ts"),
  read("src/lib/marketing/leadFunnelEventLedger.ts"),
  read("src/lib/marketing/leadDashboard.ts"),
  read("src/components/command-center/LeadDashboardPanel.tsx"),
]);

assert.match(sync, /GOOGLE_SHEETS_LEAD_SCHEMA_VERSION = "lead\\.v3"/);
assert.match(sync, /GOOGLE_SHEETS_LEAD_LEGACY_HEADERS/);
assert.match(sync, /"最後更新日期"/);
assert.match(sync, /lastUpdatedAt: createdAt/);
assert.match(table, /FUNNEL_EVENT_LEDGER_SHEET_NAME = "_funnel_events"/);
assert.match(table, /readLeadFunnelEventLedger/);
assert.match(table, /OPERATIONAL_LAST_COLUMN = "W"/);
assert.match(table, /\\[22, 23\\]\\.includes\\(contractWidth\\)/);
assert.match(normalizer, /operationalHeaderContract/);
assert.match(parser, /usesEventLedger/);
assert.match(parser, /dedupeByIdentity: true/);
assert.match(parser, /applyLeadFunnelEventLedger/);
assert.match(parser, /C 欄「跟進狀態」係唯一主要狀態來源/);
assert.match(ledger, /immutable `_funnel_events` ledger/);
assert.match(ledger, /bookDateSource: bookDate \\? \\("event_ledger" as const\\) : null/);
assert.match(dashboard, /readLeadFunnelEventLedger/);
assert.match(dashboard, /applyLeadFunnelEventLedger/);
assert.match(panel, /不可變 Funnel Event 紀錄日期/);
assert.match(panel, /之後狀態再轉變都唔會搬走之前嘅 Book/);

console.log("Lead Sheet v4 event-ledger ownership and legacy-safe fallback verified.");
''',
)

# -----------------------------------------------------------------------------
# Focused acceptance tests.
# -----------------------------------------------------------------------------
test_path = "e2e/lead-sheet-book-event-date.spec.ts"
write(
    test_path,
    '''import { expect, test } from "@playwright/test";
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
''',
)

# -----------------------------------------------------------------------------
# Rollout docs / reusable learning.
# -----------------------------------------------------------------------------
doc_path = ROOT / "docs/lead-sheet-v4-funnel-event-ledger-cutover.md"
doc_path.write_text(
    '''# Lead Sheet v4 — immutable funnel event ledger cutover\n\n## Contract\n\n- The visible operational `lead` sheet remains A:W.\n- `Created At` remains the immutable Lead/first-touch date.\n- `跟進狀態` is the authoritative current status. Legacy `Status` / `Show up` are used only when it is blank.\n- `最後更新日期` is reserved for true status-transition time.\n- Historical Book / Show / No Show events are stored in hidden `_funnel_events`; later status changes must not rewrite earlier events.\n- Existing Leads without ledger rows retain the historical fallback date model. No old month is backfilled during rollout.\n\n## Event ledger headers\n\n`Event ID | Event At | Event Date | Event Type | lead_key | Brand | Phone Last8 | Source Row | Status Before | Status After | Created At | Treatment | Source | Campaign | Branch`\n\nEvent types are `lead`, `book`, `show`, and `no_show`. A Lead becomes ledger-governed as soon as it has any valid ledger event.\n\n## Deployment order\n\n1. Deploy Growth OS ledger-aware reader and legacy-safe fallback.\n2. Create the hidden `_funnel_events` sheet and the four formula-driven brand views.\n3. Replace the bound Apps Script with the v4 script and run its installer/verification.\n4. Verify one test Lead through Lead → Book → Show and confirm the earlier Book event remains.\n5. Keep legacy A:W ingestion and Meta raw-row normalization enabled during the cutover.\n''',
    encoding="utf-8",
)
learning_dir = ROOT / "docs/product-learning/entries"
learning_dir.mkdir(parents=True, exist_ok=True)
(learning_dir / "2026-09-10-immutable-lead-funnel-events.md").write_text(
    '''# 2026-09-10 — Immutable funnel events\n\nA mutable current-status row cannot serve as historical funnel analytics. Store Lead/Book/Show/No Show as append-only events keyed to a stable Lead identity, while keeping current status separately for operations. During migration, make event-ledger presence opt a Lead into the new model and retain deterministic legacy fallback for rows without events. This prevents later stages from moving or deleting earlier conversion events and keeps daily, treatment, source, campaign, and cost metrics aligned.\n''',
    encoding="utf-8",
)

print("Implemented Lead Sheet v4 event-ledger support.")
