import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getGoogleSheetsOAuthAccessToken } from "@/lib/integrations/googleSheetsOAuth";
import { syncMarketingDataSource } from "@/lib/integrations/googleSheetsMarketingSync";
import { parseGoogleSheetDate } from "@/lib/marketing/googleSheetsMetricParser";
import {
  columnFromIndex,
  matchReportingWorkbookTabs,
  normalizeReportingMonth,
  parseGoogleSpreadsheetId,
  resolveMonthlyOverviewColumns,
  validateReportingMonthDates,
  type ReportingWorkbookBrand,
  type ReportingWorkbookBrandMapping,
  type ReportingWorkbookSheet,
} from "@/lib/marketing/monthlyReportingWorkbooks";

const GOOGLE_SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const MONTHLY_OVERVIEW_HEADER_ROW = 3;
const MONTHLY_OVERVIEW_LAST_COLUMN = "BN";
const MONTH_DATE_SCAN_ROWS = 40;

type SpreadsheetMetadataResponse = {
  spreadsheetId?: string;
  properties?: {
    title?: string;
    locale?: string;
    timeZone?: string;
  };
  sheets?: Array<{
    properties?: {
      sheetId?: number;
      title?: string;
      hidden?: boolean;
      gridProperties?: {
        rowCount?: number;
        columnCount?: number;
      };
    };
  }>;
};

type BatchGetResponse = {
  valueRanges?: Array<{
    range?: string;
    values?: unknown[][];
  }>;
};

type InspectedSourceMapping = ReportingWorkbookBrandMapping & {
  headerRow: number;
  dateColumn: string;
  spendColumn: string;
  dateCount: number;
};

export type MonthlyWorkbookInspection = {
  spreadsheetId: string;
  reportingMonth: string;
  title: string;
  locale: string | null;
  timeZone: string | null;
  sheets: ReportingWorkbookSheet[];
  sourceMappings: InspectedSourceMapping[];
  warnings: string[];
};

export type MonthlyWorkbookSyncSummary = {
  ok: boolean;
  workbookId: string;
  workbookTitle: string;
  reportingMonth: string;
  sourceCount: number;
  successCount: number;
  failedCount: number;
  message: string;
};

function quoteSheetName(value: string) {
  if (!value || value.length > 100) {
    throw new Error("Google Sheet 工作表名稱無效。");
  }
  return `'${value.replace(/'/g, "''")}'`;
}

function helperTab(value: string) {
  const normalized = value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, "");
  return new Set([
    "dailyoverview",
    "utm",
    "bybrand",
    "link",
    "brandtemplate",
  ]).has(normalized);
}

function safeGoogleError(status: number) {
  if (status === 401) {
    return "Google 授權已失效，請先喺資料來源重新連接 Google Sheets。";
  }
  if (status === 403 || status === 404) {
    return "未能讀取呢份 Google Sheet；請確認已授權嘅公司 Gmail 擁有文件權限。";
  }
  return `Google Sheets API 暫時失敗（HTTP ${status}）。`;
}

async function googleSheetsGet<T>(input: {
  spreadsheetId: string;
  path?: string;
  query?: URLSearchParams;
}) {
  const accessToken = await getGoogleSheetsOAuthAccessToken();
  const query = input.query?.toString();
  const response = await fetch(
    `${GOOGLE_SHEETS_API_BASE}/${encodeURIComponent(input.spreadsheetId)}${
      input.path ?? ""
    }${query ? `?${query}` : ""}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    }
  );
  if (!response.ok) throw new Error(safeGoogleError(response.status));
  return (await response.json()) as T;
}

async function batchGetValues(spreadsheetId: string, ranges: string[]) {
  const query = new URLSearchParams({
    majorDimension: "ROWS",
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  ranges.forEach((range) => query.append("ranges", range));
  return googleSheetsGet<BatchGetResponse>({
    spreadsheetId,
    path: "/values:batchGet",
    query,
  });
}

function spreadsheetMetadataSheets(response: SpreadsheetMetadataResponse) {
  return (response.sheets ?? []).flatMap((sheet) => {
    const properties = sheet.properties;
    if (
      typeof properties?.sheetId !== "number" ||
      typeof properties.title !== "string"
    ) {
      return [];
    }
    return [
      {
        sheetId: properties.sheetId,
        title: properties.title,
        hidden: properties.hidden === true,
        rowCount: Math.max(0, properties.gridProperties?.rowCount ?? 0),
        columnCount: Math.max(0, properties.gridProperties?.columnCount ?? 0),
      },
    ];
  });
}

export async function inspectMonthlyReportingWorkbook(input: {
  reportingMonth: string;
  spreadsheetInput: string;
  brands: ReportingWorkbookBrand[];
}): Promise<MonthlyWorkbookInspection> {
  const reportingMonth = normalizeReportingMonth(input.reportingMonth);
  const spreadsheetId = parseGoogleSpreadsheetId(input.spreadsheetInput);
  if (!reportingMonth) throw new Error("請選擇有效月份。");
  if (!spreadsheetId) {
    throw new Error("Google Sheet Link／ID 格式唔正確，請貼完整 Spreadsheet Link。");
  }
  if (input.brands.length === 0) {
    throw new Error("系統未有可接駁嘅品牌設定。");
  }

  const metadataQuery = new URLSearchParams({
    fields:
      "spreadsheetId,properties(title,locale,timeZone),sheets(properties(sheetId,title,hidden,gridProperties(rowCount,columnCount)))",
  });
  const metadata = await googleSheetsGet<SpreadsheetMetadataResponse>({
    spreadsheetId,
    query: metadataQuery,
  });
  const sheets = spreadsheetMetadataSheets(metadata);
  const visibleBusinessSheets = sheets.filter(
    (sheet) => !sheet.hidden && !helperTab(sheet.title)
  );
  const matched = matchReportingWorkbookTabs({
    brands: input.brands,
    sheets: visibleBusinessSheets,
  });
  if (matched.ambiguousBrands.length > 0) {
    throw new Error(
      `以下品牌有多個同名分頁，未能安全自動對位：${matched.ambiguousBrands
        .map((brand) => brand.name)
        .join("、")}。`
    );
  }
  if (matched.mappings.length === 0) {
    throw new Error("搵唔到任何可對應系統品牌嘅數據分頁。");
  }

  const headerResponse = await batchGetValues(
    spreadsheetId,
    matched.mappings.map(
      (mapping) =>
        `${quoteSheetName(mapping.tabName)}!A${MONTHLY_OVERVIEW_HEADER_ROW}:${MONTHLY_OVERVIEW_LAST_COLUMN}${MONTHLY_OVERVIEW_HEADER_ROW}`
    )
  );
  const resolvedMappings = matched.mappings.map((mapping, index) => {
    const headers = headerResponse.valueRanges?.[index]?.values?.[0] ?? [];
    const columns = resolveMonthlyOverviewColumns(headers);
    if (!columns.valid) {
      throw new Error(
        `${mapping.tabName} 分頁欠缺 Date 或「累計廣告費」Header，未能接駁。`
      );
    }
    return { mapping, columns };
  });

  const dateResponse = await batchGetValues(
    spreadsheetId,
    resolvedMappings.map(({ mapping, columns }) => {
      const sheet = sheets.find((item) => item.sheetId === mapping.sheetId);
      const endRow = Math.min(
        Math.max(sheet?.rowCount ?? 0, MONTHLY_OVERVIEW_HEADER_ROW + 1),
        MONTHLY_OVERVIEW_HEADER_ROW + MONTH_DATE_SCAN_ROWS
      );
      return `${quoteSheetName(mapping.tabName)}!${columns.dateColumn}${
        MONTHLY_OVERVIEW_HEADER_ROW + 1
      }:${columns.dateColumn}${endRow}`;
    })
  );
  const sourceMappings = resolvedMappings.map(
    ({ mapping, columns }, index): InspectedSourceMapping => {
      const dateValues = (dateResponse.valueRanges?.[index]?.values ?? []).map(
        (row) => row[0]
      );
      const validation = validateReportingMonthDates({
        values: dateValues,
        reportingMonth,
        parseDate: parseGoogleSheetDate,
      });
      if (!validation.valid) {
        const detail =
          validation.parsedDateCount === 0
            ? "搵唔到有效日期"
            : `發現其他月份日期：${validation.outsideDates.join("、")}`;
        throw new Error(
          `${mapping.tabName} 分頁同所選 ${reportingMonth.slice(
            0,
            7
          )} 月份不符（${detail}）。`
        );
      }
      return {
        ...mapping,
        headerRow: MONTHLY_OVERVIEW_HEADER_ROW,
        dateColumn: columnFromIndex(columns.dateIndex),
        spendColumn: columnFromIndex(columns.spendIndex),
        dateCount: validation.matchingDateCount,
      };
    }
  );

  const warnings: string[] = [];
  if (metadata.properties?.timeZone !== "Asia/Hong_Kong") {
    warnings.push(
      `Workbook 時區係 ${metadata.properties?.timeZone || "未設定"}，建議改為 Asia/Hong_Kong。`
    );
  }
  if (matched.unmatchedBrands.length > 0) {
    warnings.push(
      `未搵到以下品牌分頁：${matched.unmatchedBrands
        .map((brand) => brand.name)
        .join("、")}。`
    );
  }
  if (matched.unmatchedTabs.length > 0) {
    warnings.push(
      `以下可見分頁未有對應系統品牌，會保留但唔匯入：${matched.unmatchedTabs
        .map((sheet) => sheet.title)
        .join("、")}。`
    );
  }

  return {
    spreadsheetId,
    reportingMonth,
    title: metadata.properties?.title?.trim() || "未命名月份數據表",
    locale: metadata.properties?.locale?.trim() || null,
    timeZone: metadata.properties?.timeZone?.trim() || null,
    sheets,
    sourceMappings,
    warnings,
  };
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function syncMonthlyReportingWorkbook(input: {
  workbookId: string;
  actorIdentifier: string;
}): Promise<MonthlyWorkbookSyncSummary> {
  const supabase = createSupabaseAdminClient();
  const { data: workbookData, error: workbookError } = await supabase
    .from("marketing_reporting_workbooks")
    .select("id,title,reporting_month,status")
    .eq("id", input.workbookId)
    .single();
  if (workbookError || !workbookData) {
    throw new Error("搵唔到要同步嘅月份數據表。");
  }
  if (workbookData.status !== "active") {
    throw new Error("呢個月份版本已被取代或封存，唔會再同步。");
  }

  const startedAt = new Date().toISOString();
  await supabase
    .from("marketing_reporting_workbooks")
    .update({
      last_sync_status: "syncing",
      last_sync_at: startedAt,
      last_error_summary: null,
      updated_at: startedAt,
    })
    .eq("id", input.workbookId);

  const { data: sourceData, error: sourceError } = await supabase
    .from("marketing_data_sources")
    .select("id")
    .eq("reporting_workbook_id", input.workbookId)
    .neq("status", "paused")
    .order("display_name", { ascending: true });
  if (sourceError) {
    const failedAt = new Date().toISOString();
    await supabase
      .from("marketing_reporting_workbooks")
      .update({
        last_sync_status: "error",
        last_sync_at: failedAt,
        last_error_summary: "未能讀取月份數據表嘅品牌來源。",
        updated_at: failedAt,
      })
      .eq("id", input.workbookId);
    throw new Error("未能讀取月份數據表嘅品牌來源。");
  }
  const sourceIds = (sourceData ?? []).map((row) => String(row.id));
  if (sourceIds.length === 0) {
    const failedAt = new Date().toISOString();
    await supabase
      .from("marketing_reporting_workbooks")
      .update({
        last_sync_status: "error",
        last_sync_at: failedAt,
        last_error_summary: "月份數據表未有任何品牌資料來源。",
        updated_at: failedAt,
      })
      .eq("id", input.workbookId);
    throw new Error("呢個月份數據表未有任何品牌資料來源。");
  }

  let results;
  try {
    results = await Promise.all(
      sourceIds.map((sourceId) =>
        syncMarketingDataSource(sourceId, {
          actorIdentifier: input.actorIdentifier,
        })
      )
    );
  } catch (error) {
    const failedAt = new Date().toISOString();
    const message = safeMonthlyWorkbookError(error);
    await supabase
      .from("marketing_reporting_workbooks")
      .update({
        last_sync_status: "error",
        last_sync_at: failedAt,
        last_error_summary: message,
        updated_at: failedAt,
      })
      .eq("id", input.workbookId);
    throw error;
  }
  const successCount = results.filter((result) => result.ok).length;
  const failed = results.filter((result) => !result.ok);
  const completedAt = new Date().toISOString();
  const lastSyncStatus =
    successCount === results.length
      ? "success"
      : successCount > 0
        ? "partial"
        : "error";
  const lastErrorSummary = failed.length
    ? failed
        .map((result) => `${result.sourceName}：${result.message}`)
        .join("；")
        .slice(0, 500)
    : null;
  const workbookUpdate = {
    last_sync_status: lastSyncStatus,
    last_sync_at: completedAt,
    last_error_summary: lastErrorSummary,
    updated_at: completedAt,
    ...(successCount === results.length
      ? { last_success_at: completedAt }
      : {}),
  };
  const { error: workbookUpdateError } = await supabase
    .from("marketing_reporting_workbooks")
    .update(workbookUpdate)
    .eq("id", input.workbookId);
  if (workbookUpdateError) throw workbookUpdateError;
  await supabase.from("marketing_command_center_audit").insert({
    actor_email: input.actorIdentifier,
    action: "reporting_workbook.synced",
    entity_type: "marketing_reporting_workbook",
    entity_id: input.workbookId,
    after_json: {
      reportingMonth: workbookData.reporting_month,
      sourceCount: results.length,
      successCount,
      failedCount: failed.length,
      lastSyncStatus,
    },
  });

  return {
    ok: successCount === results.length,
    workbookId: String(workbookData.id),
    workbookTitle: String(workbookData.title),
    reportingMonth: String(workbookData.reporting_month),
    sourceCount: results.length,
    successCount,
    failedCount: failed.length,
    message:
      successCount === results.length
        ? `已同步 ${successCount} 個品牌分頁。`
        : `已同步 ${successCount}/${results.length} 個品牌；${failed.length} 個需要檢查。`,
  };
}

export async function registerMonthlyReportingWorkbook(input: {
  reportingMonth: string;
  spreadsheetInput: string;
  actorIdentifier: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { data: brandData, error: brandError } = await supabase
    .from("brands")
    .select("id,name,slug")
    .order("name", { ascending: true });
  if (brandError) throw brandError;

  const inspection = await inspectMonthlyReportingWorkbook({
    reportingMonth: input.reportingMonth,
    spreadsheetInput: input.spreadsheetInput,
    brands: (brandData ?? []) as ReportingWorkbookBrand[],
  });
  const sourceMappings = inspection.sourceMappings.map((mapping) => ({
    brandId: mapping.brandId,
    brandName: mapping.brandName,
    brandSlug: mapping.brandSlug,
    tabName: mapping.tabName,
    sheetId: mapping.sheetId,
    headerRow: mapping.headerRow,
    dateColumn: mapping.dateColumn,
    spendColumn: mapping.spendColumn,
  }));
  const sheetManifest = inspection.sheets.map((sheet) => ({
    sheetId: sheet.sheetId,
    title: sheet.title,
    hidden: sheet.hidden,
    rowCount: sheet.rowCount,
    columnCount: sheet.columnCount,
  }));
  const validationSummary = {
    warnings: inspection.warnings,
    matchedBrands: inspection.sourceMappings.map((mapping) => ({
      brandId: mapping.brandId,
      tabName: mapping.tabName,
      dateCount: mapping.dateCount,
    })),
  };
  const { data, error } = await supabase.rpc(
    "register_marketing_reporting_workbook",
    {
      p_reporting_month: inspection.reportingMonth,
      p_spreadsheet_id: inspection.spreadsheetId,
      p_title: inspection.title,
      p_locale: inspection.locale,
      p_time_zone: inspection.timeZone,
      p_sheet_manifest: sheetManifest,
      p_source_mappings: sourceMappings,
      p_validation_status:
        inspection.warnings.length > 0 ? "warning" : "valid",
      p_validation_summary: validationSummary,
      p_actor_email: input.actorIdentifier,
    }
  );
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") {
      throw new Error("月份數據表 migration 尚未套用，暫時未能登記。");
    }
    throw new Error(error.message || "月份數據表未能登記。");
  }
  const result = objectValue(data);
  const workbookId = String(result.workbookId ?? "");
  const sourceIds = stringArray(result.sourceIds);
  if (!workbookId || sourceIds.length === 0) {
    throw new Error("月份數據表已驗證，但建立品牌來源時未能完成。");
  }

  const sync = await syncMonthlyReportingWorkbook({
    workbookId,
    actorIdentifier: input.actorIdentifier,
  });
  return { inspection, sync };
}

export function safeMonthlyWorkbookError(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim().slice(0, 500);
  }
  return "月份數據表接駁失敗，請檢查 Link、月份及 Google 權限。";
}
