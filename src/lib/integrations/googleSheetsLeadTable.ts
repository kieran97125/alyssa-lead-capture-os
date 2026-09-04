import "server-only";

import { getGoogleSheetsOAuthAccessToken } from "@/lib/integrations/googleSheetsOAuth";
import {
  normalizeMetaLeadFormRows,
  type MetaLeadFormRowRewrite,
  type MetaLeadNormalizationBrand,
} from "@/lib/integrations/metaLeadFormSheetNormalizer";
import type { LeadSheetTreatmentAlias } from "@/lib/marketing/googleSheetsMetricParser";

const GOOGLE_SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const DEFAULT_MAX_ROWS = 5_000;
const MAX_LEAD_ROWS = 50_000;
const LEGACY_OPERATIONAL_LAST_COLUMN = "V";
const OPERATIONAL_LAST_COLUMN = "W";
const META_RAW_TAIL_LAST_COLUMN = "BN";

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
};

export type LiveLeadTable = {
  headers: unknown[];
  rows: unknown[][];
  headerRow: number;
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
  // A stored legacy `V` configuration must not truncate the new W / Show up
  // column. Reading A:W against an unchanged legacy Sheet is harmless.
  return columnNumber(valid) < columnNumber(OPERATIONAL_LAST_COLUMN)
    ? OPERATIONAL_LAST_COLUMN
    : valid;
}

function quoteSheetName(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

async function batchGetValues(input: {
  accessToken: string;
  spreadsheetId: string;
  ranges: string[];
}) {
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
        Authorization: `Bearer ${input.accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
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
    normalizedMetaLeadRows: normalized.rewrites.length,
    normalizationWriteBackOk,
  };
}

export async function readLiveLeadTable(
  configuration: LeadTableSourceConfiguration
): Promise<LiveLeadTable> {
  const accessToken = await getGoogleSheetsOAuthAccessToken();
  const sourceSpreadsheetId = spreadsheetId(configuration);
  const sourceTabName = tabName(configuration);
  const headerRow = Math.min(integerValue(configuration.headerRow, 1), 100);
  const configuredMaxRows = integerValue(
    configuration.maxRows,
    DEFAULT_MAX_ROWS
  );
  const maxRows = Math.min(configuredMaxRows, MAX_LEAD_ROWS);
  const lastColumn = configuredLastColumn(configuration);

  const headerResponse = await batchGetValues({
    accessToken,
    spreadsheetId: sourceSpreadsheetId,
    ranges: [
      `${quoteSheetName(sourceTabName)}!A${headerRow}:${lastColumn}${headerRow}`,
    ],
  });
  const headers = headerResponse.valueRanges?.[0]?.values?.[0] ?? [];
  // Read the governed operational range once. Funnel aggregation continues to
  // consume only its approved fields, while the server-only audit pipeline can
  // compare the complete CS record without a second inconsistent provider read.
  const dataResponse = await batchGetValues({
    accessToken,
    spreadsheetId: sourceSpreadsheetId,
    ranges: [
      `${quoteSheetName(sourceTabName)}!A${headerRow + 1}:${lastColumn}${maxRows}`,
    ],
  });
  const rows = dataResponse.valueRanges?.[0]?.values ?? [];

  return { headers, rows, headerRow };
}
