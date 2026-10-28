import { parseLeadPendingAppointmentAuthority, type LeadPendingAppointmentAuthority } from "@/lib/marketing/leadPendingAppointmentAuthority";
import "server-only";
import { LeadSheetSyncError } from "@/lib/marketing/leadSheetSyncDiagnostics";
import { ARRIVAL_REVENUE_HEADERS, type ArrivalRevenueTable } from "@/lib/reports/arrivalRevenue";
import { REPORT_TREATMENT_HEADERS, type ReportTreatmentTable } from "@/lib/reports/treatmentCategories";

import { getGoogleSheetsOAuthAccessToken } from "@/lib/integrations/googleSheetsOAuth";
import {
  normalizeMetaLeadFormRows,
  type MetaLeadFormRowRewrite,
  type MetaLeadNormalizationBrand,
} from "@/lib/integrations/metaLeadFormSheetNormalizer";
import type { LeadSheetTreatmentAlias } from "@/lib/marketing/googleSheetsMetricParser";

import {
  parseLeadArrivalOutcomeAuthority, arrivalOutcomeAuthorityError,
  type LeadArrivalOutcomeAuthority,
} from "@/lib/marketing/leadArrivalOutcomeAuthority";

const MANAGED_PROFILE = "alyssa_workspace_lead_funnel";
const MANAGED_READ_TIMEOUT_MS = 15_000;
const SYNC_MANAGED_READ_TIMEOUT_MS = 60_000;
const REPORT_READ_TIMEOUT_MS = 60_000;
const GOOGLE_SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const DEFAULT_MAX_ROWS = 5_000;
const MAX_LEAD_ROWS = 50_000;
const DASHBOARD_READ_TIMEOUT_MS = 12_000;
const LEGACY_OPERATIONAL_LAST_COLUMN = "V";
const OPERATIONAL_LAST_COLUMN = "Y";
const META_RAW_TAIL_LAST_COLUMN = "BN";
const FUNNEL_EVENT_LEDGER_SHEET_NAME = "_funnel_events";
const FUNNEL_EVENT_LEDGER_LAST_COLUMN = "P";

type GoogleValueRange = {
  values?: unknown[][];
};

export type LeadTableSourceConfiguration = {
  spreadsheetId?: unknown;
  sheetId?: unknown;
  tabName?: unknown;
  headerRow?: unknown;
  maxRows?: unknown;
  lastColumn?: unknown;
  sourceProfile?: unknown;
};

export type LiveLeadTable = {
  headers: unknown[];
  rows: unknown[][];
  headerRow: number;
  arrivalOutcomeAuthority?: LeadArrivalOutcomeAuthority;
  pendingAppointmentAuthority?: LeadPendingAppointmentAuthority;
};

export type NormalizedLiveLeadTable = LiveLeadTable & {
  normalizedMetaLeadRows: number;
  normalizationWriteBackOk: boolean;
};

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function integerValue(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function spreadsheetId(configuration: LeadTableSourceConfiguration) {
  const value =
    stringValue(configuration.spreadsheetId) ||
    stringValue(configuration.sheetId);
  if (!/^[A-Za-z0-9_-]{20,}$/.test(value)) {
    throw new Error("Lead Sheet ID 無效，請到資料來源重新檢查設定。");
  }
  return value;
}

function tabName(configuration: LeadTableSourceConfiguration) {
  const value = stringValue(configuration.tabName) || "lead";
  if (!value || value.length > 100) {
    throw new Error("Lead Sheet 工作表名稱無效。");
  }
  return value;
}

function columnNumber(column: string) {
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
  // A stored legacy configuration must not truncate the Account-first A:Y contract.
  // Reading A:Y against an older Sheet is harmless because empty trailing cells are ignored.
  return columnNumber(valid) < columnNumber(OPERATIONAL_LAST_COLUMN)
    ? OPERATIONAL_LAST_COLUMN
    : valid;
}

function quoteSheetName(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

type ReportReadOptions = { signal?: AbortSignal };
type ReportColumnSource = { title: string; headerRow: number; headers: readonly string[] };
type LiveReportColumnTable = { headers: unknown[]; rows: unknown[][]; readAt: string };
const ARRIVAL_REPORT_COLUMNS: ReportColumnSource = { title: "到店紀錄", headerRow: 7, headers: ARRIVAL_REVENUE_HEADERS };
const TREATMENT_REPORT_COLUMNS: ReportColumnSource = { title: "_dashboard_treatment_map", headerRow: 1, headers: REPORT_TREATMENT_HEADERS };

/** Read financial fields only. Customer names, phones and CS cells are excluded. */
export async function readLiveArrivalRevenueTable(configuration: LeadTableSourceConfiguration, options: ReportReadOptions = {}): Promise<ArrivalRevenueTable> {
  return (await readManagedReportColumns(configuration, [ARRIVAL_REPORT_COLUMNS], options))[0];
}

/** Read the same evaluated classification projection used by Treatment Performance. */
export async function readLiveReportTreatmentTable(configuration: LeadTableSourceConfiguration, options: ReportReadOptions = {}): Promise<ReportTreatmentTable> {
  return (await readManagedReportColumns(configuration, [TREATMENT_REPORT_COLUMNS], options))[0];
}

/** One evaluated values snapshot for both report sources, with one shared deadline. */
export async function readLiveReportTables(configuration: LeadTableSourceConfiguration, options: ReportReadOptions = {}): Promise<{ arrivalRevenue: ArrivalRevenueTable; treatmentCategories: ReportTreatmentTable }> {
  const [arrivalRevenue, treatmentCategories] = await readManagedReportColumns(configuration, [ARRIVAL_REPORT_COLUMNS, TREATMENT_REPORT_COLUMNS], options);
  return { arrivalRevenue, treatmentCategories };
}

async function readManagedReportColumns(configuration: LeadTableSourceConfiguration, sources: readonly ReportColumnSource[], options: ReportReadOptions): Promise<LiveReportColumnTable[]> {
  if (configuration.sourceProfile !== MANAGED_PROFILE) throw new Error("報告資料只支援已核實嘅 Lead Sheet 來源。");
  const id = spreadsheetId(configuration);
  const column = (value: number) => { let result = ""; for (let n = value; n > 0; n = Math.floor((n - 1) / 26)) result = String.fromCharCode(65 + (n - 1) % 26) + result; return result; };
  return boundedManagedRead(async signal => {
    const accessToken = await getGoogleSheetsOAuthAccessToken({ signal, recordHealth: false });
    signal.throwIfAborted();
    const fields = "sheets(properties(title,gridProperties(rowCount,columnCount)))";
    const response = await fetch(`${GOOGLE_SHEETS_API_BASE}/${encodeURIComponent(id)}?${new URLSearchParams({ fields })}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }, cache: "no-store", signal,
    });
    if (!response.ok) throw new Error("未能讀取報告來源工作表。");
    const metadata = await response.json() as { sheets?: Array<{ properties?: { title?: string; gridProperties?: { rowCount?: number; columnCount?: number } } }> };
    const plans = sources.map(source => {
      const matches = metadata.sheets?.filter(s => s.properties?.title === source.title) ?? [];
      const grid = matches[0]?.properties?.gridProperties;
      if (matches.length !== 1 || !grid?.rowCount || !grid.columnCount || grid.rowCount <= source.headerRow || grid.rowCount > MAX_LEAD_ROWS || grid.columnCount > 200) throw new Error("報告來源工作表範圍無效。");
      return { source, rowCount: grid.rowCount, headerRange: `${quoteSheetName(source.title)}!A${source.headerRow}:${column(grid.columnCount)}${source.headerRow}` };
    });
    const headerRanges = plans.map(plan => plan.headerRange);
    const headerRead = await batchGetValues({ accessToken, spreadsheetId: id, ranges: headerRanges, signal });
    if (headerRead.valueRanges?.length !== plans.length) throw new Error("報告來源欄位讀取不完整。");
    let offset = 0;
    const resolved = plans.map((plan, i) => {
      const headers = headerRead.valueRanges![i].values?.[0];
      if (!Array.isArray(headers)) throw new Error("報告來源欄位讀取不完整。");
      const indices = plan.source.headers.map(header => {
        if (headers.filter(v => v === header).length !== 1) throw new Error("報告來源欄位缺少或重複。");
        return headers.indexOf(header);
      });
      const ranges = indices.map(index => `${quoteSheetName(plan.source.title)}!${column(index + 1)}${plan.source.headerRow + 1}:${column(index + 1)}${plan.rowCount}`);
      const start = offset;
      offset += ranges.length;
      return { ...plan, headers, ranges, start };
    });
    const ranges = resolved.flatMap(plan => plan.ranges);
    const data = await batchGetValues({ accessToken, spreadsheetId: id, ranges: [...ranges, ...headerRanges], signal });
    if (data.valueRanges?.length !== ranges.length + plans.length || data.valueRanges.some(range => range.values !== undefined && (!Array.isArray(range.values) || !range.values.every(Array.isArray)))) throw new Error("報告來源資料讀取不完整。");
    const readAt = new Date().toISOString();
    return resolved.map((plan, i) => {
      if (JSON.stringify(data.valueRanges![ranges.length + i].values?.[0] ?? []) !== JSON.stringify(plan.headers)) throw new Error("報告來源欄位讀取期間有變，請重新生成。");
      const columns = data.valueRanges!.slice(plan.start, plan.start + plan.ranges.length);
      const height = Math.max(0, ...columns.map(range => range.values?.length ?? 0));
      const rows = Array.from({ length: height }, (_, row) => columns.map(range => range.values?.[row]?.[0] ?? ""));
      return { headers: [...plan.source.headers], rows, readAt };
    });
  }, options.signal, REPORT_READ_TIMEOUT_MS);
}

async function batchGetValues(input: {
  accessToken: string;
  spreadsheetId: string;
  ranges: string[];
  signal?: AbortSignal;
}) {
  const query = new URLSearchParams({
    majorDimension: "ROWS",
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
    // Keep every requested cell while avoiding Google's default indented JSON
    // and unused envelope fields. This is still one complete snapshot read.
    prettyPrint: "false",
    fields: "valueRanges(values)",
  });
  input.ranges.forEach((range) => query.append("ranges", range));
  const response = await fetch(
    `${GOOGLE_SHEETS_API_BASE}/${encodeURIComponent(
      input.spreadsheetId
    )}/values:batchGet?${query.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        Accept: "application/json",
        // Google's gzip contract requires both headers. Node fetch transparently
        // decompresses the response before json(), within the same deadline.
        "Accept-Encoding": "gzip",
        "User-Agent": "alyssa-lead-capture-os (gzip)",
      },
      cache: "no-store",
      signal: input.signal,
    }
  );

  if (!response.ok) {
    if ([401, 403].includes(response.status)) {
      throw new Error(
        "未能讀取 Lead Sheet；請確認公司 Google 帳戶仍有文件權限並重新連接。"
      );
    }
    if (response.status === 404) {
      throw new Error("找不到已設定嘅 Lead Sheet 或 lead 分頁。");
    }
    if (response.status === 429 || response.status >= 500) {
      throw new LeadSheetSyncError("provider_transient", { httpStatus: response.status }, `Lead Sheet 暫時讀取失敗（HTTP ${response.status}）。`);
    }
    throw new Error(`Lead Sheet 暫時讀取失敗（HTTP ${response.status}）。`);
  }

  return (await response.json()) as { valueRanges?: GoogleValueRange[] };
}

export async function rewriteMetaLeadFormRows(
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

export async function normalizeMetaLeadRowsInLiveTable(input: {
  configuration: LeadTableSourceConfiguration;
  liveTable: LiveLeadTable;
  brands: MetaLeadNormalizationBrand[];
  brandAliases?: Record<string, string>;
  treatmentAliases?: LeadSheetTreatmentAlias[];
  writeBack?: boolean;
}): Promise<NormalizedLiveLeadTable> {
  const normalized = normalizeMetaLeadFormRows({
    ...input.liveTable,
    brands: input.brands,
    brandAliases: input.brandAliases,
    treatmentAliases: input.treatmentAliases,
  });

  // Do not move source rows while verifying a projection from the same read.
  if (input.configuration.sourceProfile === MANAGED_PROFILE &&
      (!input.liveTable.arrivalOutcomeAuthority || !input.liveTable.pendingAppointmentAuthority || normalized.rewrites.length > 0)) {
    throw arrivalOutcomeAuthorityError("source_normalization", { rewriteRows: normalized.rewrites.length });
  }
  let normalizationWriteBackOk = true;
  if (input.writeBack !== false && normalized.rewrites.length > 0) {
    try {
      await rewriteMetaLeadFormRows(input.configuration, normalized.rewrites);
    } catch (error) {
      normalizationWriteBackOk = false;
      console.warn("meta_lead_form_sheet_writeback_failed", {
        rows: normalized.rewrites.length,
        message: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  return {
    headers: input.liveTable.headers,
    rows: normalized.rows,
    headerRow: input.liveTable.headerRow,
    arrivalOutcomeAuthority: input.liveTable.arrivalOutcomeAuthority,
    pendingAppointmentAuthority: input.liveTable.pendingAppointmentAuthority,
    normalizedMetaLeadRows: normalized.rewrites.length,
    normalizationWriteBackOk,
  };
}

async function boundedManagedRead<T>(read: (signal: AbortSignal) => Promise<T>, parent?: AbortSignal, timeoutMs = MANAGED_READ_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const signal = parent ? AbortSignal.any([parent, controller.signal]) : controller.signal;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let aborted: (() => void) | undefined;
  try {
    const deadline = new Promise<never>((_, reject) => {
      aborted = () => reject(arrivalOutcomeAuthorityError("managed_read_timeout", { timeoutMs }));
      signal.addEventListener("abort", aborted, { once: true });
      timer = setTimeout(() => controller.abort(), timeoutMs);
      if (signal.aborted) aborted();
    });
    signal.throwIfAborted();
    return await Promise.race([read(signal), deadline]);
  } finally {
    if (timer) clearTimeout(timer);
    if (aborted) signal.removeEventListener("abort", aborted);
  }
}

export async function readLiveLeadTable(
  configuration: LeadTableSourceConfiguration,
  options: { readOnly?: boolean; signal?: AbortSignal } = {}
): Promise<LiveLeadTable> {
  // The dashboard's deadline covers the whole provider read, including token
  // refresh. Explicit sync callers retain their existing health/write policy.
  const signal = options.readOnly
    ? AbortSignal.any([
        AbortSignal.timeout(DASHBOARD_READ_TIMEOUT_MS),
        ...(options.signal ? [options.signal] : []),
      ])
    : options.signal;
  try {
    signal?.throwIfAborted();
    const accessToken = await getGoogleSheetsOAuthAccessToken({
      signal,
      ...(options.readOnly ? { recordHealth: false } : {}),
    });
    signal?.throwIfAborted();
    const sourceSpreadsheetId = spreadsheetId(configuration);
    const sourceTabName = tabName(configuration);
    const headerRow = Math.min(integerValue(configuration.headerRow, 1), 100);
    const configuredMaxRows = integerValue(
      configuration.maxRows,
      DEFAULT_MAX_ROWS
    );
    const maxRows = Math.min(configuredMaxRows, MAX_LEAD_ROWS);
    const lastColumn = configuredLastColumn(configuration);

    const managed = configuration.sourceProfile === MANAGED_PROFILE;
    if (managed && (configuration.headerRow !== 1 || sourceTabName !== "lead" || configuration.maxRows !== 30_000)) {
      throw arrivalOutcomeAuthorityError("managed_configuration");
    }
    const ranges = [
      `${quoteSheetName(sourceTabName)}!A${headerRow}:${lastColumn}${headerRow}`,
      `${quoteSheetName(sourceTabName)}!A${headerRow + 1}:${lastColumn}${maxRows}`,
      ...(managed ? ["'_funnel_metrics'!A1:L30000", "'_metric_identity_bridge'!A1:H30000", "'_appointment_registry'!A1:AA30000"] : []),
    ];
    const read = (readSignal?: AbortSignal) => batchGetValues({
      accessToken,
      spreadsheetId: sourceSpreadsheetId,
      ranges,
      signal: readSignal,
    });
    // Covers both fetch and JSON body, even if a provider ignores abort.
    let response: Awaited<ReturnType<typeof batchGetValues>>;
    try {
      // Manual and scheduled syncs must finish a full, growing Sheet instead of racing
      // a report-widget budget. Read-only dashboard calls retain their outer
      // 12 s deadline; explicit report sources use their own shared 60 s budget.
      response = managed ? await boundedManagedRead(read, signal,
        options.readOnly ? MANAGED_READ_TIMEOUT_MS : SYNC_MANAGED_READ_TIMEOUT_MS) : await read(signal);
    } catch (error) {
      if (managed && !signal?.aborted && (error instanceof TypeError || error instanceof SyntaxError)) {
        throw arrivalOutcomeAuthorityError("provider_transient");
      }
      throw error;
    }
    signal?.throwIfAborted();
    if (managed && (!response || !Array.isArray(response.valueRanges) || response.valueRanges.length !== 5 ||
        response.valueRanges.some((range) => !range || !Array.isArray(range.values) || !range.values.every(Array.isArray)))) {
      throw arrivalOutcomeAuthorityError("managed_response");
    }
    const headers = response.valueRanges?.[0]?.values?.[0] ?? [];
    const rows = response.valueRanges?.[1]?.values ?? [];

    if (managed && (headers.length === 0 || headers.filter((header) => header === "Account").length !== 1)) {
      throw arrivalOutcomeAuthorityError("source_headers");
    }
    return { headers, rows, headerRow, ...(managed ? {
      arrivalOutcomeAuthority: parseLeadArrivalOutcomeAuthority(response.valueRanges?.[2]?.values),
      pendingAppointmentAuthority: parseLeadPendingAppointmentAuthority(response.valueRanges?.[3]?.values, response.valueRanges?.[4]?.values),
    } : {}) };
  } catch (error) {
    if (signal?.aborted) {
      throw new Error("Lead Sheet 讀取逾時，請稍後重試；其他功能仍可使用。");
    }
    throw error;
  }
}

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

