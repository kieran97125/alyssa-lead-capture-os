import "server-only";

import { getGoogleSheetsOAuthAccessToken } from "@/lib/integrations/googleSheetsOAuth";

const GOOGLE_SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const DEFAULT_MAX_ROWS = 5_000;
const MAX_LEAD_ROWS = 50_000;

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
  const configuredLastColumn = stringValue(configuration.lastColumn) || "V";
  const lastColumn = /^[A-Z]{1,3}$/i.test(configuredLastColumn)
    ? configuredLastColumn.toUpperCase()
    : "V";

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
