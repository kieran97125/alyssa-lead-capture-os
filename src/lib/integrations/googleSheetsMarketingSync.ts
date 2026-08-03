import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getGoogleSheetsOAuthAccessToken } from "@/lib/integrations/googleSheetsOAuth";
import { getHkMonthContext } from "@/lib/marketing/pacing";
import {
  aggregateDailySpendRows,
  aggregateLeadSheetPerformance,
  leadSheetFieldKeys,
  resolveLeadSheetColumns,
  type LeadSheetPerformanceDiagnostics,
  type LeadSheetTreatmentAlias,
} from "@/lib/marketing/googleSheetsMetricParser";
import {
  resolveMonthlyOverviewColumns,
  shouldSyncReportingSource,
} from "@/lib/marketing/monthlyReportingWorkbooks";

const GOOGLE_SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const DEFAULT_MAX_ROWS = 5000;
const MAX_CONFIGURED_ROWS = 20000;

type DataSourceRow = {
  id: string;
  brand_id: string | null;
  display_name: string;
  provider_key: string;
  status: string;
  configuration: Record<string, unknown> | null;
  provides_metrics: string[] | null;
  last_sync_at: string | null;
  reporting_workbook_id?: string | null;
};

type BrandRow = {
  id: string;
  name: string;
  slug: string;
};

type DailyMetricUpsert = {
  brand_id: string;
  metric_date: string;
  source_key: string;
  data_source_id: string;
  spend: number;
  leads: number;
  bookings: number;
  shows: number;
  revenue: number;
  source_updated_at: string;
  imported_at: string;
  updated_at: string;
};

type TreatmentPerformanceMetricUpsert = {
  data_source_id: string;
  brand_id: string;
  metric_date: string;
  metric_kind: "lead" | "book" | "show" | "no_show" | "pending_show";
  dimension_key: string;
  brand_label: string;
  treatment_label: string;
  source_label: string;
  campaign_label: string;
  branch_label: string;
  metric_count: number;
  source_updated_at: string;
  imported_at: string;
  sync_run_id: string;
};

type BatchGetResponse = {
  valueRanges?: Array<{
    range?: string;
    majorDimension?: string;
    values?: unknown[][];
  }>;
};

export type MarketingSyncResult = {
  ok: boolean;
  sourceId: string;
  sourceName: string;
  dataset: string;
  metricRows: number;
  analysisRows: number;
  message: string;
};

async function getGoogleAccessToken() {
  return getGoogleSheetsOAuthAccessToken();
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function recordValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringRecord(value: unknown) {
  return Object.fromEntries(
    Object.entries(recordValue(value))
      .filter(
        (entry): entry is [string, string] =>
          typeof entry[1] === "string" &&
          Boolean(entry[0].trim() && entry[1].trim())
      )
      .map(([key, target]) => [key.trim(), target.trim()])
  );
}

function treatmentAliases(value: unknown): LeadSheetTreatmentAlias[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const record = recordValue(item);
    const label = stringValue(record.label);
    const keywords = Array.isArray(record.keywords)
      ? record.keywords.map(stringValue).filter(Boolean)
      : [];
    if (!label || keywords.length === 0) return [];
    return [
      {
        label,
        keywords,
        brand: stringValue(record.brand) || null,
      },
    ];
  });
}

function integerValue(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), MAX_CONFIGURED_ROWS);
}

function normalizeColumn(value: unknown, fallback: string) {
  const column = stringValue(value).toUpperCase();
  return /^[A-Z]{1,3}$/.test(column) ? column : fallback;
}

function columnIndex(column: string) {
  let value = 0;
  for (const character of column) {
    value = value * 26 + character.charCodeAt(0) - 64;
  }
  return value - 1;
}

function columnFromIndex(index: number) {
  let value = index + 1;
  let column = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    value = Math.floor((value - 1) / 26);
  }
  return column;
}

function addIsoDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function quoteSheetName(value: string) {
  if (!value || value.length > 100) {
    throw new Error("Google Sheet 工作表名稱無效。");
  }
  return `'${value.replace(/'/g, "''")}'`;
}

function spreadsheetId(configuration: Record<string, unknown>) {
  const value =
    stringValue(configuration.spreadsheetId) ||
    stringValue(configuration.sheetId);
  if (!/^[A-Za-z0-9_-]{20,}$/.test(value)) {
    throw new Error("Google Sheet ID 無效。");
  }
  return value;
}

async function batchGetValues(input: {
  spreadsheetId: string;
  ranges: string[];
}) {
  const accessToken = await getGoogleAccessToken();
  const query = new URLSearchParams({
    majorDimension: "ROWS",
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  input.ranges.forEach((range) => query.append("ranges", range));

  const response = await fetch(
    `${GOOGLE_SHEETS_API_BASE}/${encodeURIComponent(
      input.spreadsheetId
    )}/values:batchGet?${query.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    }
  );
  if (!response.ok) {
    if (response.status === 403 || response.status === 404) {
      throw new Error(
        "未能讀取 Google Sheet；請確認已授權嘅公司 Gmail 本身擁有文件存取權。"
      );
    }
    throw new Error(`Google Sheets API 暫時失敗（HTTP ${response.status}）。`);
  }

  return (await response.json()) as BatchGetResponse;
}

function sourceDataset(configuration: Record<string, unknown>) {
  const dataset = stringValue(configuration.dataset);
  if (dataset === "daily_spend" || dataset === "lead_funnel") return dataset;
  throw new Error("資料來源未設定有效 Dataset Profile。");
}

function sourceKey(source: DataSourceRow, dataset: string) {
  return `google_sheets:${source.id}:${dataset}`;
}

function emptyMetric(input: {
  brandId: string;
  date: string;
  source: DataSourceRow;
  dataset: string;
  timestamp: string;
}): DailyMetricUpsert {
  return {
    brand_id: input.brandId,
    metric_date: input.date,
    source_key: sourceKey(input.source, input.dataset),
    data_source_id: input.source.id,
    spend: 0,
    leads: 0,
    bookings: 0,
    shows: 0,
    revenue: 0,
    source_updated_at: input.timestamp,
    imported_at: input.timestamp,
    updated_at: input.timestamp,
  };
}

async function collectDailySpendMetrics(
  source: DataSourceRow,
  configuration: Record<string, unknown>,
  throughDate: string
) {
  if (!source.brand_id) {
    throw new Error("每日廣告費來源必須指定一個品牌。");
  }
  const tabName = stringValue(configuration.tabName);
  const headerRow = integerValue(configuration.headerRow, 3);
  const maxRows = integerValue(configuration.maxRows, DEFAULT_MAX_ROWS);
  let dateColumn = normalizeColumn(configuration.dateColumn, "A");
  let spendColumn = normalizeColumn(configuration.spendColumn, "N");
  if (stringValue(configuration.schemaProfile) === "monthly_overview_v1") {
    const headerResponse = await batchGetValues({
      spreadsheetId: spreadsheetId(configuration),
      ranges: [`${quoteSheetName(tabName)}!A${headerRow}:BN${headerRow}`],
    });
    const headers = headerResponse.valueRanges?.[0]?.values?.[0] ?? [];
    const resolved = resolveMonthlyOverviewColumns(headers);
    if (!resolved.valid) {
      throw new Error(
        `${tabName} 分頁欠缺 Date 或「累計廣告費」Header，請檢查月份數據表格式。`
      );
    }
    dateColumn = resolved.dateColumn;
    spendColumn = resolved.spendColumn;
  }
  const finalColumn = columnFromIndex(
    Math.max(columnIndex(dateColumn), columnIndex(spendColumn))
  );
  const dateIndex = columnIndex(dateColumn);
  const spendIndex = columnIndex(spendColumn);
  const response = await batchGetValues({
    spreadsheetId: spreadsheetId(configuration),
    ranges: [
      `${quoteSheetName(tabName)}!A${headerRow + 1}:${finalColumn}${maxRows}`,
    ],
  });
  const rows = response.valueRanges?.[0]?.values ?? [];
  const timestamp = new Date().toISOString();
  return aggregateDailySpendRows({
    rows,
    brandId: source.brand_id,
    throughDate,
    dateIndex,
    spendIndex,
  }).map((aggregate) => {
    const metric = emptyMetric({
      brandId: aggregate.brandId,
      date: aggregate.date,
      source,
      dataset: "daily_spend",
      timestamp,
    });
    metric.spend = aggregate.spend;
    return metric;
  });
}

async function collectLeadFunnelMetrics(
  source: DataSourceRow,
  configuration: Record<string, unknown>,
  brands: BrandRow[],
  throughDate: string
) {
  const tabName = stringValue(configuration.tabName) || "lead";
  const headerRow = integerValue(configuration.headerRow, 1);
  const maxRows = integerValue(configuration.maxRows, DEFAULT_MAX_ROWS);
  const finalColumn = normalizeColumn(configuration.lastColumn, "V");
  const headerResponse = await batchGetValues({
    spreadsheetId: spreadsheetId(configuration),
    ranges: [
      `${quoteSheetName(tabName)}!A${headerRow}:${finalColumn}${headerRow}`,
    ],
  });
  const headers = headerResponse.valueRanges?.[0]?.values?.[0] ?? [];
  const columnMap = resolveLeadSheetColumns(headers);
  const selectedIndexes = Array.from(
    new Set(
      leadSheetFieldKeys
        .map((field) => columnMap[field])
        .filter((index) => index >= 0)
    )
  ).sort((left, right) => left - right);
  const response = await batchGetValues({
    spreadsheetId: spreadsheetId(configuration),
    ranges: selectedIndexes.map((index) => {
      const column = columnFromIndex(index);
      return `${quoteSheetName(tabName)}!${column}${
        headerRow + 1
      }:${column}${maxRows}`;
    }),
  });
  const columnValues = selectedIndexes.map(
    (_, index) => response.valueRanges?.[index]?.values ?? []
  );
  const rowCount = Math.max(0, ...columnValues.map((values) => values.length));
  const rows = Array.from({ length: rowCount }, (_, rowIndex) => {
    const row: unknown[] = [];
    selectedIndexes.forEach((columnIndex, selectedIndex) => {
      row[columnIndex] = columnValues[selectedIndex]?.[rowIndex]?.[0] ?? "";
    });
    return row;
  });
  const timestamp = new Date().toISOString();
  const month = getHkMonthContext();
  const parsed = aggregateLeadSheetPerformance({
    headers,
    rows,
    brands,
    sourceBrandId: source.brand_id,
    brandAliases: stringRecord(configuration.brandAliases),
    treatmentAliases: treatmentAliases(configuration.treatmentAliases),
    dailyThroughDate: throughDate,
    activityThroughDate: month.today,
    pendingThroughDate: addIsoDays(month.today, 400),
  });
  const dailyMetrics = parsed.dailyMetrics.map((aggregate) => {
    const metric = emptyMetric({
      brandId: aggregate.brandId,
      date: aggregate.date,
      source,
      dataset: "lead_funnel",
      timestamp,
    });
    metric.leads = aggregate.leads;
    metric.bookings = aggregate.bookings;
    metric.shows = aggregate.shows;
    return metric;
  });
  const treatmentMetrics = parsed.metricFacts.map((fact) => ({
    data_source_id: source.id,
    brand_id: fact.brandId,
    metric_date: fact.metricDate,
    metric_kind: fact.metricKind,
    dimension_key: createHash("sha256")
      .update(
        JSON.stringify([
          fact.brandId,
          fact.treatmentLabel,
          fact.sourceLabel,
          fact.campaignLabel,
          fact.branchLabel,
        ])
      )
      .digest("hex"),
    brand_label: fact.brandLabel,
    treatment_label: fact.treatmentLabel,
    source_label: fact.sourceLabel,
    campaign_label: fact.campaignLabel,
    branch_label: fact.branchLabel,
    metric_count: fact.count,
    source_updated_at: timestamp,
    imported_at: timestamp,
    sync_run_id: "",
  })) satisfies TreatmentPerformanceMetricUpsert[];

  return {
    dailyMetrics,
    treatmentMetrics,
    diagnostics: parsed.diagnostics,
  };
}

async function reconcileMetrics(
  source: DataSourceRow,
  dataset: string,
  metrics: DailyMetricUpsert[]
) {
  const supabase = createSupabaseAdminClient();
  const key = sourceKey(source, dataset);
  const { data: existingRows, error: existingError } = await supabase
    .from("marketing_daily_metrics")
    .select("brand_id,metric_date")
    .eq("data_source_id", source.id)
    .eq("source_key", key)
    .limit(MAX_CONFIGURED_ROWS);
  if (existingError) throw existingError;

  const currentKeys = new Set(
    metrics.map((row) => `${row.brand_id}:${row.metric_date}`)
  );
  const timestamp = new Date().toISOString();
  for (const existing of existingRows ?? []) {
    const metricKey = `${existing.brand_id}:${existing.metric_date}`;
    if (currentKeys.has(metricKey)) continue;
    metrics.push(
      emptyMetric({
        brandId: existing.brand_id,
        date: existing.metric_date,
        source,
        dataset,
        timestamp,
      })
    );
  }

  for (let index = 0; index < metrics.length; index += 500) {
    const batch = metrics.slice(index, index + 500);
    if (batch.length === 0) continue;
    const { error } = await supabase
      .from("marketing_daily_metrics")
      .upsert(batch, {
        onConflict: "brand_id,metric_date,source_key",
      });
    if (error) throw error;
  }
}

async function reconcileTreatmentPerformanceMetrics(
  source: DataSourceRow,
  metrics: TreatmentPerformanceMetricUpsert[]
) {
  const supabase = createSupabaseAdminClient();
  const syncRunId = randomUUID();
  const rows = metrics.map((metric) => ({
    ...metric,
    sync_run_id: syncRunId,
  }));

  for (let index = 0; index < rows.length; index += 500) {
    const batch = rows.slice(index, index + 500);
    const { error } = await supabase
      .from("marketing_treatment_performance_daily")
      .upsert(batch, {
        onConflict:
          "data_source_id,metric_date,metric_kind,dimension_key",
      });
    if (error) throw error;
  }

  let deleteQuery = supabase
    .from("marketing_treatment_performance_daily")
    .delete()
    .eq("data_source_id", source.id);
  if (rows.length > 0) {
    deleteQuery = deleteQuery.neq("sync_run_id", syncRunId);
  }
  const { error: staleDeleteError } = await deleteQuery;
  if (staleDeleteError) throw staleDeleteError;
}

function safeErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.slice(0, 240);
  }
  return "Google Sheet 同步失敗。";
}

export async function syncMarketingDataSource(
  dataSourceId: string,
  options: { actorIdentifier?: string } = {}
): Promise<MarketingSyncResult> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("marketing_data_sources")
    .select(
      "id,brand_id,display_name,provider_key,status,configuration,provides_metrics,last_sync_at"
    )
    .eq("id", dataSourceId)
    .single();
  if (error || !data) {
    return {
      ok: false,
      sourceId: dataSourceId,
      sourceName: "未找到資料來源",
      dataset: "unknown",
      metricRows: 0,
      analysisRows: 0,
      message: "找不到指定資料來源。",
    };
  }

  const source = data as DataSourceRow;
  const configuration = source.configuration ?? {};
  let dataset = "unknown";
  const startedAt = new Date().toISOString();
  const staleBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: claimedSource, error: claimError } = await supabase
    .from("marketing_data_sources")
    .update({
      status: "syncing",
      last_sync_at: startedAt,
      last_error_summary: null,
      updated_at: startedAt,
    })
    .eq("id", source.id)
    .neq("status", "paused")
    .or(
      `status.neq.syncing,last_sync_at.is.null,last_sync_at.lt.${staleBefore}`
    )
    .select("id")
    .maybeSingle();

  if (claimError) {
    return {
      ok: false,
      sourceId: source.id,
      sourceName: source.display_name,
      dataset,
      metricRows: 0,
      analysisRows: 0,
      message: "未能鎖定同步工作，請稍後再試。",
    };
  }
  if (!claimedSource) {
    return {
      ok: false,
      sourceId: source.id,
      sourceName: source.display_name,
      dataset,
      metricRows: 0,
      analysisRows: 0,
      message:
        source.status === "paused"
          ? "資料來源已暫停。"
          : "另一輪同步正在進行中，請稍後再試。",
    };
  }

  try {
    if (source.provider_key !== "google_sheets") {
      throw new Error("呢個同步器只支援 Google Sheets 資料來源。");
    }
    if (source.status === "paused") {
      throw new Error("資料來源已暫停，請先重新啟用。");
    }
    dataset = sourceDataset(configuration);
    const { data: brandData, error: brandError } = await supabase
      .from("brands")
      .select("id,name,slug")
      .order("name", { ascending: true });
    if (brandError) throw brandError;
    const brands = (brandData ?? []) as BrandRow[];
    const throughDate = getHkMonthContext().throughDate;
    let metrics: DailyMetricUpsert[];
    let treatmentMetrics: TreatmentPerformanceMetricUpsert[] = [];
    let diagnostics: LeadSheetPerformanceDiagnostics | null = null;
    if (dataset === "daily_spend") {
      metrics = await collectDailySpendMetrics(
        source,
        configuration,
        throughDate
      );
    } else {
      const leadFunnel = await collectLeadFunnelMetrics(
        source,
        configuration,
        brands,
        throughDate
      );
      metrics = leadFunnel.dailyMetrics;
      treatmentMetrics = leadFunnel.treatmentMetrics;
      diagnostics = leadFunnel.diagnostics;
    }
    await reconcileMetrics(source, dataset, metrics);
    if (dataset === "lead_funnel") {
      await reconcileTreatmentPerformanceMetrics(source, treatmentMetrics);
    }

    const completedAt = new Date().toISOString();
    const { error: sourceUpdateError } = await supabase
      .from("marketing_data_sources")
      .update({
        status: "connected",
        last_sync_at: completedAt,
        last_success_at: completedAt,
        last_error_summary: null,
        updated_at: completedAt,
      })
      .eq("id", source.id);
    if (sourceUpdateError) throw sourceUpdateError;
    await supabase.from("marketing_command_center_audit").insert({
      actor_email: options.actorIdentifier || "google_sheets_sync",
      action: "data_source.synced",
      entity_type: "marketing_data_source",
      entity_id: source.id,
      brand_id: source.brand_id,
      after_json: {
        dataset,
        metricRows: metrics.length,
        treatmentMetricRows: treatmentMetrics.length,
        throughDate,
        diagnostics,
      },
    });

    return {
      ok: true,
      sourceId: source.id,
      sourceName: source.display_name,
      dataset,
      metricRows: metrics.length,
      analysisRows: treatmentMetrics.length,
      message:
        dataset === "lead_funnel"
          ? `同步完成，共更新 ${metrics.length} 個每日指標及 ${treatmentMetrics.length} 個療程成效組合。`
          : `同步完成，共更新 ${metrics.length} 個每日指標。`,
    };
  } catch (syncError) {
    const message = safeErrorMessage(syncError);
    const failedAt = new Date().toISOString();
    await supabase
      .from("marketing_data_sources")
      .update({
        status: "error",
        last_sync_at: failedAt,
        last_error_summary: message,
        updated_at: failedAt,
      })
      .eq("id", source.id);
    return {
      ok: false,
      sourceId: source.id,
      sourceName: source.display_name,
      dataset,
      metricRows: 0,
      analysisRows: 0,
      message,
    };
  }
}

export async function syncAllMarketingGoogleSheets(
  options: { actorIdentifier?: string } = {}
) {
  const supabase = createSupabaseAdminClient();
  const month = getHkMonthContext();
  const { data: activeWorkbook, error: workbookError } = await supabase
    .from("marketing_reporting_workbooks")
    .select("id")
    .eq("provider_key", "google_sheets")
    .eq("reporting_month", month.monthStart)
    .eq("status", "active")
    .maybeSingle();
  if (workbookError) throw workbookError;
  const { data, error } = await supabase
    .from("marketing_data_sources")
    .select("id,reporting_workbook_id")
    .eq("provider_key", "google_sheets")
    .neq("status", "paused")
    .limit(50);
  if (error) throw error;

  const sourceRows = (data ?? []).filter(
    (source) =>
      shouldSyncReportingSource({
        sourceReportingWorkbookId: source.reporting_workbook_id,
        activeCurrentWorkbookId: activeWorkbook?.id,
      })
  );

  return Promise.all(
    sourceRows.map((source) =>
      syncMarketingDataSource(source.id, options)
    )
  );
}
