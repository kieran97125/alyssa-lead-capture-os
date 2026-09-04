from pathlib import Path
import json
import re


def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


def regex_once(text: str, pattern: str, replacement: str, label: str, flags=0) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return updated


# ---------------------------------------------------------------------------
# 1. Outbound Google Sheets contract: v3 first, legacy compatible by headers.
# ---------------------------------------------------------------------------
sync_path = "src/lib/integrations/googleSheetsLeadSync.ts"
sync = read(sync_path)
old_header_block = '''export const GOOGLE_SHEETS_LEAD_SCHEMA_VERSION = "lead.v2";

export const GOOGLE_SHEETS_LEAD_HEADERS = [
  "Created At",
  "跟進狀態",
  "品牌",
  "分店",
  "客人姓名",
  "電話",
  "Email",
  "療程 / 優惠",
  "療程項目",
  "預約日期",
  "預約時間",
  "確認到店日期",
  "來源",
  "Campaign / 廣告",
  "Page URL",
  "最後跟進時間",
  "lead_key",
  "CS Remark",
  "具體派畀邊間分店+邊一位同事",
  "Remark(後續跟進情況)",
  "Status",
  "Show up",
] as const;'''
new_header_block = '''export const GOOGLE_SHEETS_LEAD_SCHEMA_VERSION = "lead.v3";

export const GOOGLE_SHEETS_LEAD_LEGACY_HEADERS = [
  "Created At",
  "跟進狀態",
  "品牌",
  "分店",
  "客人姓名",
  "電話",
  "Email",
  "療程 / 優惠",
  "療程項目",
  "預約日期",
  "預約時間",
  "確認到店日期",
  "來源",
  "Campaign / 廣告",
  "Page URL",
  "最後跟進時間",
  "lead_key",
  "CS Remark",
  "具體派畀邊間分店+邊一位同事",
  "Remark(後續跟進情況)",
  "Status",
  "Show up",
] as const;

export const GOOGLE_SHEETS_LEAD_HEADERS = [
  "最後更新日期",
  ...GOOGLE_SHEETS_LEAD_LEGACY_HEADERS,
] as const;'''
sync = replace_once(sync, old_header_block, new_header_block, "lead schema/header contract")
sync = replace_once(
    sync,
    '''  schemaVersion: typeof GOOGLE_SHEETS_LEAD_SCHEMA_VERSION;
  createdAt: string;''',
    '''  schemaVersion: typeof GOOGLE_SHEETS_LEAD_SCHEMA_VERSION;
  lastUpdatedAt: string;
  createdAt: string;''',
    "payload lastUpdatedAt type",
)
sync = replace_once(
    sync,
    '''  const touch = input.touch;
  const pageUrl = preferredPageUrl(touch) || input.pageUrl || "";
  const fields = {
    createdAt: formatHongKongDateTime(input.createdAt),''',
    '''  const touch = input.touch;
  const pageUrl = preferredPageUrl(touch) || input.pageUrl || "";
  const createdAt = formatHongKongDateTime(input.createdAt);
  const fields = {
    // New rows start with the same HKT timestamp in both columns. The Sheet
    // automation later locks this field to the first Book event date.
    lastUpdatedAt: createdAt,
    createdAt,''',
    "payload date fields",
)
sync = replace_once(
    sync,
    '''  const rowValues = [
    fields.createdAt,''',
    '''  const rowValues = [
    fields.lastUpdatedAt,
    fields.createdAt,''',
    "payload row value order",
)
write(sync_path, sync)


# ---------------------------------------------------------------------------
# 2. Meta native rows normalize to whichever live Sheet contract is present.
# ---------------------------------------------------------------------------
normalizer_path = "src/lib/integrations/metaLeadFormSheetNormalizer.ts"
normalizer = read(normalizer_path)
normalizer = replace_once(
    normalizer,
    '''  formatHongKongDateTime,
  GOOGLE_SHEETS_LEAD_HEADERS,''',
    '''  formatHongKongDateTime,
  GOOGLE_SHEETS_LEAD_HEADERS,
  GOOGLE_SHEETS_LEAD_LEGACY_HEADERS,''',
    "normalizer legacy import",
)
normalizer = regex_once(
    normalizer,
    r'''function hasOperationalLeadHeaders\(headers: unknown\[\]\) \{[\s\S]*?\n\}''',
    '''type LeadSheetHeaderContract = "legacy" | "v3";

function matchesOperationalHeaders(
  headers: unknown[],
  contract: readonly string[]
) {
  if (headers.length < contract.length) return false;
  return contract.every(
    (header, index) => canonicalHeader(headers[index]) === canonicalHeader(header)
  );
}

function operationalHeaderContract(
  headers: unknown[]
): LeadSheetHeaderContract | null {
  if (matchesOperationalHeaders(headers, GOOGLE_SHEETS_LEAD_HEADERS)) {
    return "v3";
  }
  if (matchesOperationalHeaders(headers, GOOGLE_SHEETS_LEAD_LEGACY_HEADERS)) {
    return "legacy";
  }
  return null;
}''',
    "normalizer header contract detector",
)
normalizer = replace_once(
    normalizer,
    '''  treatmentAliases: LeadSheetTreatmentAlias[];
}) {''',
    '''  treatmentAliases: LeadSheetTreatmentAlias[];
  contract: LeadSheetHeaderContract;
}) {''',
    "normalizer contract input",
)
normalizer = regex_once(
    normalizer,
    r'''  const values = \[\n    createdAt,[\s\S]*?\n  \];\n\n  return \{ leadId, values \};''',
    '''  const legacyValues = [
    createdAt,
    "待跟進",
    brand.name,
    "",
    customerName,
    phone,
    email,
    `Meta Lead Form · ${formName}`.slice(0, 240),
    treatmentItem.slice(0, 160),
    "",
    "",
    "",
    `Meta Lead Form / ${sourcePlatform}`,
    campaignAdLabel(campaignName, adName),
    "",
    "",
    `meta_lead:${leadId}`,
    metaAnswerSummary({ rawAnswers, customerName, phone, email }),
    "",
    "",
    "",
    "",
  ];
  const values =
    input.contract === "v3"
      ? [createdAt, ...legacyValues]
      : legacyValues;

  return { leadId, values };''',
    "normalizer contract-shaped values",
)
normalizer = replace_once(
    normalizer,
    '''  if (!hasOperationalLeadHeaders(input.headers)) {
    return { rows: input.rows, rewrites: [] };
  }

  const rows = input.rows.map((row) => [...row]);''',
    '''  const contract = operationalHeaderContract(input.headers);
  if (!contract) {
    return { rows: input.rows, rewrites: [] };
  }

  const rows = input.rows.map((row) => [...row]);''',
    "normalizer contract selection",
)
normalizer = replace_once(
    normalizer,
    '''      treatmentAliases: input.treatmentAliases ?? [],
    });''',
    '''      treatmentAliases: input.treatmentAliases ?? [],
      contract,
    });''',
    "normalizer contract forwarding",
)
write(normalizer_path, normalizer)


# ---------------------------------------------------------------------------
# 3. Read at least A:W and rewrite Meta rows safely for 22/23-column contracts.
# ---------------------------------------------------------------------------
table_path = "src/lib/integrations/googleSheetsLeadTable.ts"
table = read(table_path)
table = replace_once(
    table,
    '''const OPERATIONAL_LAST_COLUMN = "V";
const META_RAW_TAIL_LAST_COLUMN = "BN";''',
    '''const LEGACY_OPERATIONAL_LAST_COLUMN = "V";
const OPERATIONAL_LAST_COLUMN = "W";
const META_RAW_TAIL_LAST_COLUMN = "BN";''',
    "lead table operational columns",
)
table = regex_once(
    table,
    r'''function configuredLastColumn\(configuration: LeadTableSourceConfiguration\) \{[\s\S]*?\n\}''',
    '''function columnNumber(column: string) {
  return column
    .toUpperCase()
    .split("")
    .reduce((total, character) => total * 26 + character.charCodeAt(0) - 64, 0);
}

function configuredLastColumn(configuration: LeadTableSourceConfiguration) {
  const configured = stringValue(configuration.lastColumn) || OPERATIONAL_LAST_COLUMN;
  const valid = /^[A-Z]{1,3}$/i.test(configured)
    ? configured.toUpperCase()
    : OPERATIONAL_LAST_COLUMN;
  // A stored legacy `V` configuration must not truncate the new W / Show up
  // column. Reading A:W against an unchanged legacy Sheet is harmless.
  return columnNumber(valid) < columnNumber(OPERATIONAL_LAST_COLUMN)
    ? OPERATIONAL_LAST_COLUMN
    : valid;
}''',
    "lead table minimum W reader",
)
table = regex_once(
    table,
    r'''export async function rewriteMetaLeadFormRows\([\s\S]*?\n\}\n\nexport async function normalizeMetaLeadRowsInLiveTable''',
    '''export async function rewriteMetaLeadFormRows(
  configuration: LeadTableSourceConfiguration,
  rewrites: MetaLeadFormRowRewrite[]
) {
  if (rewrites.length === 0) return { updatedRows: 0 };

  const contractWidth = rewrites[0]?.values.length ?? 0;
  if (![22, 23].includes(contractWidth)) {
    throw new Error(
      "Meta Lead Form 自動整理只支援 legacy A:V 或 v3 A:W contract；已安全停止回寫。"
    );
  }
  const validRewrites = rewrites.filter(
    (rewrite) =>
      Number.isInteger(rewrite.rowNumber) &&
      rewrite.rowNumber >= 2 &&
      rewrite.values.length === contractWidth
  );
  if (validRewrites.length !== rewrites.length) {
    throw new Error("Meta Lead Form 自動整理偵測到無效 row payload；已安全停止回寫。");
  }

  const operationalLastColumn =
    contractWidth === 23 ? OPERATIONAL_LAST_COLUMN : LEGACY_OPERATIONAL_LAST_COLUMN;
  const rawTailStartColumn = contractWidth === 23 ? "X" : "W";
  const accessToken = await getGoogleSheetsOAuthAccessToken({
    requireWrite: true,
  });
  const sourceSpreadsheetId = spreadsheetId(configuration);
  const sourceTabName = tabName(configuration);
  const quotedTab = quoteSheetName(sourceTabName);

  const updateResponse = await fetch(
    `${GOOGLE_SHEETS_API_BASE}/${encodeURIComponent(
      sourceSpreadsheetId
    )}/values:batchUpdate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        valueInputOption: "RAW",
        includeValuesInResponse: false,
        data: validRewrites.map((rewrite) => ({
          range: `${quotedTab}!A${rewrite.rowNumber}:${operationalLastColumn}${rewrite.rowNumber}`,
          majorDimension: "ROWS",
          values: [rewrite.values],
        })),
      }),
      cache: "no-store",
    }
  );
  if (!updateResponse.ok) {
    throw new Error(
      `Meta Lead Form ${operationalLastColumn} contract 整理回寫失敗（HTTP ${updateResponse.status}）。`
    );
  }

  // Clear only the raw Meta tail after the detected governed contract. Normal
  // operational rows and legacy records are never position-shifted here.
  const clearResponse = await fetch(
    `${GOOGLE_SHEETS_API_BASE}/${encodeURIComponent(
      sourceSpreadsheetId
    )}/values:batchClear`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ranges: validRewrites.map(
          (rewrite) =>
            `${quotedTab}!${rawTailStartColumn}${rewrite.rowNumber}:${META_RAW_TAIL_LAST_COLUMN}${rewrite.rowNumber}`
        ),
      }),
      cache: "no-store",
    }
  );
  if (!clearResponse.ok) {
    throw new Error(
      `Meta Lead Form raw tail 清理失敗（HTTP ${clearResponse.status}）。`
    );
  }

  return { updatedRows: validRewrites.length };
}

export async function normalizeMetaLeadRowsInLiveTable''',
    "dual-contract Meta row rewrite",
)
write(table_path, table)


# ---------------------------------------------------------------------------
# 4. Parser owns the one-time Book event date while preserving legacy cohorts.
# ---------------------------------------------------------------------------
parser_path = "src/lib/marketing/googleSheetsMetricParser.ts"
parser = read(parser_path)
parser = replace_once(
    parser,
    '''export type LeadSheetGroupRow = {
  rowNumber: number;
  createdAt: unknown;
  createdDate: string | null;''',
    '''export type LeadSheetGroupRow = {
  rowNumber: number;
  lastUpdatedAt?: unknown;
  lastUpdatedDate?: string | null;
  createdAt: unknown;
  createdDate: string | null;''',
    "group row last update fields",
)
parser = replace_once(
    parser,
    '''  firstTouchDate: string | null;
  rows: LeadSheetGroupRow[];''',
    '''  firstTouchDate: string | null;
  bookDate?: string | null;
  bookDateSource?: "last_updated" | "legacy_created_at" | null;
  rows: LeadSheetGroupRow[];''',
    "group book date fields",
)
parser = replace_once(
    parser,
    '''export const leadSheetFieldKeys = [
  "createdAt",''',
    '''export const leadSheetFieldKeys = [
  "lastUpdatedAt",
  "createdAt",''',
    "field key last update",
)
parser = replace_once(
    parser,
    '''const LEAD_SHEET_HEADER_ALIASES: Record<LeadSheetFieldKey, string[]> = {
  createdAt:''',
    '''const LEAD_SHEET_HEADER_ALIASES: Record<LeadSheetFieldKey, string[]> = {
  lastUpdatedAt: [
    "最後更新日期",
    "Last Updated At",
    "Last Updated Date",
    "Booked At",
    "首次預約日期",
  ],
  createdAt:''',
    "header aliases last update",
)
parser = replace_once(
    parser,
    '''    const createdAt = valueAt(rawRow, "createdAt");
    const createdDate = parseGoogleSheetDate(createdAt);''',
    '''    const lastUpdatedAt = valueAt(rawRow, "lastUpdatedAt");
    const lastUpdatedDate = parseGoogleSheetDate(lastUpdatedAt);
    const createdAt = valueAt(rawRow, "createdAt");
    const createdDate = parseGoogleSheetDate(createdAt);''',
    "parse last update date",
)
parser = replace_once(
    parser,
    '''      row: {
        rowNumber,
        createdAt,
        createdDate,''',
    '''      row: {
        rowNumber,
        lastUpdatedAt,
        lastUpdatedDate,
        createdAt,
        createdDate,''',
    "store last update date",
)
old_group_map = '''  const groups = Array.from(groupedRows.entries()).map(([key, items]) => {
    items.sort((left, right) => left.sortValue.localeCompare(right.sortValue));
    const first = items[0];
    return {
      key,
      brandId: first.brand.id,
      brandLabel: first.brand.name,
      treatmentLabel: first.treatmentLabel,
      sourceLabel: first.sourceLabel,
      campaignLabel: first.campaignLabel,
      branchLabel: first.branchLabel,
      firstTouchDate: first.row.createdDate,
      rows: items.map((item) => item.row),
    } satisfies LeadSheetLeadGroup;
  });

  return { groups, diagnostics };
}'''
new_group_map = '''  const groups = Array.from(groupedRows.entries()).map(([key, items]) => {
    items.sort((left, right) => left.sortValue.localeCompare(right.sortValue));
    const first = items[0];
    const rows = items.map((item) => item.row);
    const bookedRows = rows.filter((row) => row.status !== "lead");
    const isV3Lead = Boolean(first.row.lastUpdatedDate);
    const lastUpdatedBookDate = bookedRows
      .map((row) => row.lastUpdatedDate)
      .filter((value): value is string => Boolean(value))
      .sort()[0] ?? null;
    const bookDate =
      bookedRows.length === 0
        ? null
        : isV3Lead
          ? lastUpdatedBookDate ?? first.row.createdDate
          : first.row.createdDate;
    const bookDateSource =
      bookDate === null
        ? null
        : isV3Lead && lastUpdatedBookDate
          ? "last_updated"
          : "legacy_created_at";
    return {
      key,
      brandId: first.brand.id,
      brandLabel: first.brand.name,
      treatmentLabel: first.treatmentLabel,
      sourceLabel: first.sourceLabel,
      campaignLabel: first.campaignLabel,
      branchLabel: first.branchLabel,
      firstTouchDate: first.row.createdDate,
      bookDate,
      bookDateSource,
      rows,
    } satisfies LeadSheetLeadGroup;
  });

  return { groups, diagnostics };
}

export function leadGroupBookDate(group: LeadSheetLeadGroup) {
  if (group.bookDate !== undefined) return group.bookDate;
  return group.rows.some((row) => row.status !== "lead")
    ? group.firstTouchDate
    : null;
}'''
parser = replace_once(parser, old_group_map, new_group_map, "group book date ownership")
old_aggregate_dates = '''    const isBook = group.rows.some((row) => row.status !== "lead");
    const createdDate = group.firstTouchDate;

    if (createdDate && createdDate <= input.dailyThroughDate) {
      const daily = getDailyMetric(group.brandId, createdDate);
      daily.leads += 1;
      if (isBook) daily.bookings += 1;
    }
    if (createdDate && createdDate <= input.activityThroughDate) {
      addFact({ ...dimensions, metricDate: createdDate, metricKind: "lead" });
      if (isBook) {
        addFact({ ...dimensions, metricDate: createdDate, metricKind: "book" });
      }
    }'''
new_aggregate_dates = '''    const createdDate = group.firstTouchDate;
    const bookDate = leadGroupBookDate(group);

    if (createdDate && createdDate <= input.dailyThroughDate) {
      getDailyMetric(group.brandId, createdDate).leads += 1;
    }
    if (bookDate && bookDate <= input.dailyThroughDate) {
      getDailyMetric(group.brandId, bookDate).bookings += 1;
    }
    if (createdDate && createdDate <= input.activityThroughDate) {
      addFact({ ...dimensions, metricDate: createdDate, metricKind: "lead" });
    }
    if (bookDate && bookDate <= input.activityThroughDate) {
      addFact({ ...dimensions, metricDate: bookDate, metricKind: "book" });
    }'''
parser = replace_once(parser, old_aggregate_dates, new_aggregate_dates, "aggregate Book event date")
parser = regex_once(
    parser,
    r'''export function aggregateLeadFunnelColumns\([\s\S]*?\n\}\s*$''',
    '''export function aggregateLeadFunnelColumns(input: {
  lastUpdatedValues?: unknown[][];
  createdAtValues: unknown[][];
  followStatusValues: unknown[][];
  brandValues: unknown[][];
  confirmationDateValues: unknown[][];
  brands: SheetBrandReference[];
  sourceBrandId: string | null;
  throughDate: string;
}) {
  const brandLookup = new Map<string, SheetBrandReference>();
  for (const brand of input.brands) {
    brandLookup.set(normalizeGoogleSheetBrandKey(brand.name), brand);
    brandLookup.set(normalizeGoogleSheetBrandKey(brand.slug), brand);
  }
  const rowCount = Math.max(
    input.lastUpdatedValues?.length ?? 0,
    input.createdAtValues.length,
    input.followStatusValues.length,
    input.brandValues.length,
    input.confirmationDateValues.length
  );
  const metrics = new Map<string, ParsedLeadFunnelMetric>();
  const getMetric = (brandId: string, date: string) => {
    const key = `${brandId}:${date}`;
    const existing = metrics.get(key);
    if (existing) return existing;
    const metric = {
      brandId,
      date,
      leads: 0,
      bookings: 0,
      shows: 0,
    };
    metrics.set(key, metric);
    return metric;
  };

  for (let index = 0; index < rowCount; index += 1) {
    const followStatus = stringValue(input.followStatusValues[index]?.[0]);
    const brand = input.sourceBrandId
      ? input.brands.find((item) => item.id === input.sourceBrandId)
      : brandLookup.get(
          normalizeGoogleSheetBrandKey(input.brandValues[index]?.[0])
        );
    if (!brand) continue;

    const createdDate = parseGoogleSheetDate(input.createdAtValues[index]?.[0]);
    if (createdDate && createdDate <= input.throughDate) {
      getMetric(brand.id, createdDate).leads += 1;
    }

    if (BOOKING_STATUSES.has(followStatus)) {
      const eventDate =
        parseGoogleSheetDate(input.lastUpdatedValues?.[index]?.[0]) ||
        createdDate;
      if (eventDate && eventDate <= input.throughDate) {
        getMetric(brand.id, eventDate).bookings += 1;
      }
    }

    const showDate = parseGoogleSheetDate(
      input.confirmationDateValues[index]?.[0]
    );
    if (
      followStatus === "已到店" &&
      showDate &&
      showDate <= input.throughDate
    ) {
      getMetric(brand.id, showDate).shows += 1;
    }
  }

  return Array.from(metrics.values());
}
''',
    "column funnel Book event date",
)
write(parser_path, parser)


# ---------------------------------------------------------------------------
# 5. Dashboard and trend use Book event date independently of Lead date.
# ---------------------------------------------------------------------------
math_path = "src/lib/marketing/leadDashboardMath.ts"
math = read(math_path)
math = replace_once(
    math,
    '''import type {
  LeadSheetLeadGroup,
  LeadSheetGroupRow,
  SheetBrandReference,
} from "@/lib/marketing/googleSheetsMetricParser";''',
    '''import {
  leadGroupBookDate,
  type LeadSheetLeadGroup,
  type LeadSheetGroupRow,
  type SheetBrandReference,
} from "@/lib/marketing/googleSheetsMetricParser";''',
    "dashboard Book helper import",
)
math = replace_once(
    math,
    '''          if (group.firstTouchDate === date) {
            base.leads += 1;
            if (group.rows.some((row) => row.status !== "lead")) base.bookings += 1;
          }''',
    '''          if (group.firstTouchDate === date) base.leads += 1;
          if (leadGroupBookDate(group) === date) base.bookings += 1;''',
    "dashboard trend Book date",
)
math = replace_once(
    math,
    '''    if (leadInRange) {
      leads += 1;
      if (group.rows.some((row) => row.status !== "lead")) bookings += 1;
    }''',
    '''    if (leadInRange) leads += 1;
    if (
      inRange(
        leadGroupBookDate(group),
        filters.startDate,
        filters.endDate
      )
    ) {
      bookings += 1;
    }''',
    "dashboard totals Book date",
)
write(math_path, math)


# ---------------------------------------------------------------------------
# 6. Honest UI definition: Book is an event flow, not forced onto Lead day.
# ---------------------------------------------------------------------------
panel_path = "src/components/command-center/LeadDashboardPanel.tsx"
panel = read(panel_path)
panel = replace_once(
    panel,
    '''            同一品牌及電話只計一次；Lead 同 Book 歸入首次查詢日期。''',
    '''            同一品牌及電話只計一次；Lead 按首次查詢日，Book 按首次預約更新日；舊 Lead 維持原有日期。''',
    "dashboard source definition",
)
panel = replace_once(
    panel,
    '''          meta={`${formatPercent(snapshot.totals.bookRate)} Book Rate`}''',
    '''          meta={`${formatPercent(snapshot.totals.bookRate)} · 按預約更新日`}''',
    "dashboard Book metric meta",
)
panel = replace_once(
    panel,
    '''            Lead／Book 按同品牌同電話尾 8 位嘅首次查詢日期；Show 按確認到店日期；
            No Show 同本月未 Show 按預約日期。Book 包括已預約、已到店及 No Show。''',
    '''            Lead 按同品牌同電話尾 8 位嘅首次查詢日期；新 Lead 嘅 Book 按「最後更新日期」鎖定首次預約日，
            舊 Lead 冇該日期時繼續按首次查詢日。Show 按確認到店日期；No Show 同本月未 Show 按預約日期。
            Book 包括已預約、已到店及 No Show；同期間 Book Rate 係事件流量比率，唔係固定 cohort。''',
    "dashboard detailed definition",
)
write(panel_path, panel)

lead_dashboard_path = "src/lib/marketing/leadDashboard.ts"
lead_dashboard = read(lead_dashboard_path)
lead_dashboard = lead_dashboard.replace(
    "行 Created At 無效，Lead／Book 暫未計入。",
    "行 Created At 無效，Lead 同舊格式 Book fallback 暫未計入。",
)
write(lead_dashboard_path, lead_dashboard)


# ---------------------------------------------------------------------------
# 7. Existing tests updated, plus dedicated cross-day and legacy tests.
# ---------------------------------------------------------------------------
sync_test_path = "e2e/google-sheets-lead-sync.spec.ts"
sync_test = read(sync_test_path)
sync_test = replace_once(
    sync_test,
    '''    expect(payload.rowValues).toEqual([
      "2026/7/29 上午 11:25:51",''',
    '''    expect(payload.rowValues).toEqual([
      "2026/7/29 上午 11:25:51",
      "2026/7/29 上午 11:25:51",''',
    "sync test v3 row prefix",
)
sync_test = replace_once(
    sync_test,
    '''    ).toMatchObject({
      品牌: "Alyssa",''',
    '''    ).toMatchObject({
      最後更新日期: "2026/7/29 上午 11:25:51",
      "Created At": "2026/7/29 上午 11:25:51",
      品牌: "Alyssa",''',
    "sync test date mapping",
)
legacy_test = '''

test("native writer stays compatible with the legacy A:V destination", () => {
  const payload = buildGoogleSheetsLeadPayload({
    brandId: "brand-test-123",
    leadKey: "lead-test-legacy",
    createdAt: "2026-07-29T03:25:51.000Z",
    customerName: "Legacy Header Test",
    phone: "85200000001",
    email: null,
    brandName: "Alyssa",
    formName: "Lead Form",
    treatmentName: "Facelift",
    packageName: "$988 Facelift",
    price: 988,
    branchName: "旺角",
    appointmentDate: null,
    appointmentTime: null,
    pageUrl: "https://example.com",
    touch: {},
  });
  const legacyHeaders = GOOGLE_SHEETS_LEAD_HEADERS.slice(1);
  const aligned = alignLeadRowToDestinationHeaders([...legacyHeaders], payload);
  expect(aligned).toHaveLength(22);
  expect(aligned[0]).toBe("2026/7/29 上午 11:25:51");
  expect(aligned[legacyHeaders.indexOf("lead_key")]).toBe("lead-test-legacy");
});
'''
sync_test += legacy_test
write(sync_test_path, sync_test)

normalizer_test_path = "e2e/meta-lead-form-normalizer.spec.ts"
normalizer_test = read(normalizer_test_path)
normalizer_test = replace_once(
    normalizer_test,
    '''  expect(result.rows[0]).toHaveLength(22);
  expect(result.rows[0]).toEqual([
    "2026/8/21 下午 11:25:49",''',
    '''  expect(result.rows[0]).toHaveLength(23);
  expect(result.rows[0]).toEqual([
    "2026/8/21 下午 11:25:49",
    "2026/8/21 下午 11:25:49",''',
    "normalizer v3 expected row",
)
normalizer_test = replace_once(
    normalizer_test,
    '''  const normalRow = [
    "2026/8/21 下午 11:25:49",''',
    '''  const normalRow = [
    "2026/8/21 下午 11:25:49",
    "2026/8/21 下午 11:25:49",''',
    "normalizer normal v3 row",
)
normalizer_test = replace_once(
    normalizer_test,
    '''  const changedHeaders = [...GOOGLE_SHEETS_LEAD_HEADERS];
  changedHeaders[5] = "Other Phone Header";''',
    '''  const changedHeaders = [...GOOGLE_SHEETS_LEAD_HEADERS];
  changedHeaders[changedHeaders.indexOf("電話")] = "Other Phone Header";''',
    "normalizer changed phone header",
)
normalizer_test = replace_once(
    normalizer_test,
    '''import { GOOGLE_SHEETS_LEAD_HEADERS } from "../src/lib/integrations/googleSheetsLeadSync";''',
    '''import {
  GOOGLE_SHEETS_LEAD_HEADERS,
  GOOGLE_SHEETS_LEAD_LEGACY_HEADERS,
} from "../src/lib/integrations/googleSheetsLeadSync";''',
    "normalizer legacy headers test import",
)
normalizer_test += '''

test("Meta raw leads remain normalizable while the live Sheet is still legacy A:V", () => {
  const rawRow = [
    "l:1000000000000002",
    "2026-08-22T10:25:49-05:00",
    "ag:120000000000000001",
    "GOS_demo",
    "as:120000000000000002",
    "GOS_demo",
    "c:120000000000000003",
    "GOS_脫毛_demo",
    "f:1800000000000001",
    "Simple form setup demo",
    "false",
    "fb",
    "激光脫毛方案",
    "Demo Chan",
    "p:+85261234568",
  ];
  const result = normalizeMetaLeadFormRows({
    headers: [...GOOGLE_SHEETS_LEAD_LEGACY_HEADERS],
    rows: [rawRow],
    headerRow: 1,
    brands,
    brandAliases,
    treatmentAliases,
  });
  expect(result.rewrites).toHaveLength(1);
  expect(result.rows[0]).toHaveLength(22);
  expect(result.rows[0][0]).toBe("2026/8/22 下午 11:25:49");
  expect(result.rows[0][1]).toBe("待跟進");
});
'''
write(normalizer_test_path, normalizer_test)

book_test = '''import { expect, test } from "@playwright/test";
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
'''
write("e2e/lead-sheet-book-event-date.spec.ts", book_test)


# ---------------------------------------------------------------------------
# 8. Build contract and cutover documentation.
# ---------------------------------------------------------------------------
contract = '''import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFile(`${root}${path}`, "utf8");
const [sync, table, normalizer, parser, dashboard, panel] = await Promise.all([
  read("src/lib/integrations/googleSheetsLeadSync.ts"),
  read("src/lib/integrations/googleSheetsLeadTable.ts"),
  read("src/lib/integrations/metaLeadFormSheetNormalizer.ts"),
  read("src/lib/marketing/googleSheetsMetricParser.ts"),
  read("src/lib/marketing/leadDashboardMath.ts"),
  read("src/components/command-center/LeadDashboardPanel.tsx"),
]);

assert.match(sync, /GOOGLE_SHEETS_LEAD_SCHEMA_VERSION = "lead\.v3"/);
assert.match(sync, /GOOGLE_SHEETS_LEAD_LEGACY_HEADERS/);
assert.match(sync, /"最後更新日期"/);
assert.match(sync, /lastUpdatedAt: createdAt/);
assert.match(table, /OPERATIONAL_LAST_COLUMN = "W"/);
assert.match(table, /\[22, 23\]\.includes\(contractWidth\)/);
assert.match(table, /rawTailStartColumn = contractWidth === 23 \? "X" : "W"/);
assert.match(normalizer, /operationalHeaderContract/);
assert.match(normalizer, /input\.contract === "v3"/);
assert.match(parser, /bookDateSource/);
assert.match(parser, /isV3Lead = Boolean\(first\.row\.lastUpdatedDate\)/);
assert.match(parser, /leadGroupBookDate/);
assert.match(dashboard, /leadGroupBookDate\(group\) === date/);
assert.match(panel, /Book 按首次預約更新日/);
assert.match(panel, /舊 Lead 冇該日期時繼續按首次查詢日/);

console.log("Lead Sheet v3 dual contract and Book event-date ownership verified.");
'''
write("scripts/verify-lead-sheet-book-date-contract.mjs", contract)

package_path = "package.json"
package = json.loads(read(package_path))
package["scripts"]["verify:lead-sheet-book-date-contract"] = (
    "node scripts/verify-lead-sheet-book-date-contract.mjs"
)
build = package["scripts"]["build"]
needle = "npm run verify:lead-audit-contract &&"
if needle not in build:
    raise RuntimeError("package build insertion anchor missing")
package["scripts"]["build"] = build.replace(
    needle,
    "npm run verify:lead-audit-contract && npm run verify:lead-sheet-book-date-contract &&",
    1,
)
write(package_path, json.dumps(package, ensure_ascii=False, indent=2) + "\n")

cutover = '''# Lead Sheet v3：最後更新日期／Book Event Date Cutover

## 目的

- Lead：繼續按 `Created At`。
- Book：新 Lead 按最左欄 `最後更新日期`，由首次進入已預約／已到店／No Show 時鎖定。
- Show：繼續按 `確認到店日期`。
- No Show：繼續按 `預約日期`。
- 舊 Lead：最左欄保持空白，系統自動 fallback 至原本 `Created At`，不重寫歷史。

## 安全次序

1. 先上線 Growth OS v3 dual-reader（同時支援 legacy A:V 及 v3 A:W）。
2. 將已核對 Apps Script 完整取代現有版本。
3. 執行一次 Sheet v3 安裝／檢查功能：只在 A1 原為 `Created At` 時插入新 A 欄。
4. 確認新 Header：A=`最後更新日期`、B=`Created At`、I=`療程 / 優惠`、J=`療程項目`、W=`Show up`。
5. 確認所有舊資料 A2:A 保持空白，沒有 backfill。
6. 新建測試 Lead：A/B 應同為建立時間。
7. 隔日將該 Lead 首次改成 `已預約`：只更新 A；B 不變。
8. 再改 CS Remark／已到店：A 不可再刷新；Show 仍按確認到店日期。
9. 在 Growth OS 按「同步最新數據」，核對 Lead 日不再增加 Book，預約日增加 Book。
10. 核對全期 Lead／Book／Show 總數與切換前一致，再結束 cutover。

## Apps Script 必守

- Header Array 共 23 欄，`最後更新日期` 後必須有逗號。
- `doPost`、手動 WhatsApp Lead 都要寫 23 個值；新 Lead A/B 初始相同。
- `OFFER_CONFIG.SOURCE_COL=9`、`OUTPUT_COL=10`。
- H→I 文案及提示改成 I→J。
- `onEdit` 要先處理 Book event，再處理療程 I→J；不可因療程欄早退而漏更新。
- 只有第一筆 row 本身屬 v3（A 初始有值）先可鎖 Book 日期；A 原本空白嘅舊 Lead永遠不可自動補。
- 只在由非 Book 狀態首次轉入 Book 狀態時更新 A；之後改到店、No Show、備註或分店都不可再覆蓋。
- 插欄及 Header migration 必須用 Script Lock，避免同時兩筆 Lead 重複插欄。
- 插欄後 A 欄設 HKT date-time format；不要改舊 Lead 內容。

## Rollback

Growth OS 可先回退程式而不改 Sheet；v3 Reader 對 legacy／v3 都兼容。若 Sheet 已插欄，不應直接刪 A 欄，先停止寫入並匯出備份，再按事件日期紀錄決定 rollback。
'''
write("docs/lead-sheet-v3-book-event-date-cutover.md", cutover)

learning = '''# Lead Sheet Book event-date ownership with legacy-safe cutover

## Problem

A Lead received on one day but first booked on a later day was previously counted as both Lead and Book on the first-touch date. Daily operational trends therefore hid the actual day on which CS converted the enquiry. A live Google Sheet also needed to move from 22 governed columns (A:V) to 23 (A:W) without rewriting existing Lead history or interrupting native/Meta ingestion.

## Decision

- Lead remains owned by first-touch `Created At`.
- New v3 Leads have a populated `最後更新日期` on their first row. Their one Book event is owned by the first valid last-updated date on a booked/show/no-show row.
- A Lead group is considered legacy when its first-touch row has no last-updated date. Legacy groups always keep Book on first-touch date, even if a later duplicate row appears after cutover.
- Show remains owned by confirmed-show date; No Show and pending-show remain owned by appointment date.
- Outbound native writes use `lead.v3`, but header-based alignment stays compatible with legacy destinations.
- The reader always reads at least A:W. Meta raw-row normalization detects and writes either the 22- or 23-column contract and clears the raw tail only after the detected boundary.
- Period Book counts become event-flow counts and are independent of whether the Lead was created inside the same period. Full-history unique Book totals remain unchanged.

## Guardrails

- Do not backfill the new column for old Leads.
- The Sheet automation must lock the timestamp only on the first transition into a Book state; later edits must not move the event date.
- First-touch row contract, not a hard-coded calendar cutoff, determines legacy versus v3 behaviour.
- One brand + phone-last-8 group still produces at most one Lead and one Book.
- Native writer, legacy webhook and Meta normalization remain available during the cutover window.
- Audit canonicalization remains header-based and does not reinterpret shifted column positions.
- No database schema migration or historical metric rewrite is required.

## Classification

- **Core**: separate event-date ownership for Lead, Book, Show and No Show; immutable legacy fallback; one-event-per-group semantics.
- **Configurable**: source header aliases and external-sheet contract version.
- **Enterprise Extension**: Google Sheets dual-contract bridge, Meta raw-row normalization and OAuth write alignment.
- **Client-specific and isolated**: spreadsheet IDs, Apps Script secret, actual Lead rows, brand names, phone data and operational Sheet access.

## Evidence

Source PR, verified commit, workflow, deployment and production smoke evidence are appended during release.

## Rollback

Revert the source PR. The parser remains legacy-safe; no database migration is involved. Do not delete a live v3 Sheet column without a separate backed-up Sheet migration.
'''
write(
    "docs/product-learning/entries/2026-09-04-lead-sheet-book-event-date.md",
    learning,
)

print("Implemented Lead Sheet v3 dual contract and Book event-date ownership.")
