import "server-only";

import { GoogleAuth } from "google-auth-library";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getHkMonthContext } from "@/lib/marketing/pacing";
import {
  aggregateDailySpendRows,
  aggregateLeadFunnelColumns,
} from "@/lib/marketing/googleSheetsMetricParser";

const SHEETS_READONLY_SCOPE =
  "https://www.googleapis.com/auth/spreadsheets.readonly";
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
  message: string;
};

function env(name: string) {
  return process.env[name]?.trim() || "";
}

export function getGoogleSheetsMarketingCredentialStatus() {
  const email = env("GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL");
  const privateKey = env("GOOGLE_SHEETS_SERVICE_ACCOUNT_PRIVATE_KEY");
  return {
    ready: Boolean(email && privateKey),
    serviceAccountEmail: email || null,
    emailPresent: Boolean(email),
    privateKeyPresent: Boolean(privateKey),
  };
}

function getCredentialConfiguration() {
  const status = getGoogleSheetsMarketingCredentialStatus();
  if (!status.ready || !status.serviceAccountEmail) {
    throw new Error(
      "Google Sheets service account 尚未設定；請先加入伺服器憑證。"
    );
  }

  return {
    client_email: status.serviceAccountEmail,
    private_key: env("GOOGLE_SHEETS_SERVICE_ACCOUNT_PRIVATE_KEY").replace(
      /\\n/g,
      "\n"
    ),
  };
}

async function getGoogleAccessToken() {
  const auth = new GoogleAuth({
    credentials: getCredentialConfiguration(),
    scopes: [SHEETS_READONLY_SCOPE],
  });
  const accessToken = await auth.getAccessToken();
  if (!accessToken) {
    throw new Error("Google Sheets 認證失敗，未能取得短期 access token。");
  }
  return accessToken;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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
        "未能讀取 Google Sheet；請確認文件已分享畀系統 Service Account。"
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
  const dateColumn = normalizeColumn(configuration.dateColumn, "A");
  const spendColumn = normalizeColumn(configuration.spendColumn, "N");
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
  const columns = {
    createdAt: normalizeColumn(configuration.createdAtColumn, "A"),
    followStatus: normalizeColumn(configuration.followStatusColumn, "B"),
    brand: normalizeColumn(configuration.brandColumn, "C"),
    bookingDate: normalizeColumn(configuration.bookingDateColumn, "J"),
    confirmationDate: normalizeColumn(
      configuration.confirmationDateColumn,
      "L"
    ),
  };
  const orderedColumns = [
    columns.createdAt,
    columns.followStatus,
    columns.brand,
    columns.bookingDate,
    columns.confirmationDate,
  ];
  const response = await batchGetValues({
    spreadsheetId: spreadsheetId(configuration),
    ranges: orderedColumns.map(
      (column) =>
        `${quoteSheetName(tabName)}!${column}${headerRow + 1}:${column}${maxRows}`
    ),
  });
  const columnValues = orderedColumns.map(
    (_, index) => response.valueRanges?.[index]?.values ?? []
  );
  const timestamp = new Date().toISOString();
  return aggregateLeadFunnelColumns({
    createdAtValues: columnValues[0],
    followStatusValues: columnValues[1],
    brandValues: columnValues[2],
    confirmationDateValues: columnValues[4],
    brands,
    sourceBrandId: source.brand_id,
    throughDate,
  }).map((aggregate) => {
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
    const metrics =
      dataset === "daily_spend"
        ? await collectDailySpendMetrics(source, configuration, throughDate)
        : await collectLeadFunnelMetrics(
            source,
            configuration,
            brands,
            throughDate
          );
    await reconcileMetrics(source, dataset, metrics);

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
        throughDate,
      },
    });

    return {
      ok: true,
      sourceId: source.id,
      sourceName: source.display_name,
      dataset,
      metricRows: metrics.length,
      message: `同步完成，共更新 ${metrics.length} 個每日指標。`,
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
      message,
    };
  }
}

export async function syncAllMarketingGoogleSheets(
  options: { actorIdentifier?: string } = {}
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("marketing_data_sources")
    .select("id")
    .eq("provider_key", "google_sheets")
    .neq("status", "paused")
    .limit(20);
  if (error) throw error;

  return Promise.all(
    (data ?? []).map((source) =>
      syncMarketingDataSource(source.id, options)
    )
  );
}
