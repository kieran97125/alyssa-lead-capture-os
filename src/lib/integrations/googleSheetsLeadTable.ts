import "server-only";

import { getGoogleSheetsOAuthAccessToken } from "@/lib/integrations/googleSheetsOAuth";
import {
  leadSheetFieldKeys,
  resolveLeadSheetColumns,
} from "@/lib/marketing/googleSheetsMetricParser";

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
  const columnMap = resolveLeadSheetColumns(headers);
  const selectedIndexes = Array.from(
    new Set(
      leadSheetFieldKeys
        .map((field) => columnMap[field])
        .filter((index) => index >= 0)
    )
  ).sort((left, right) => left - right);

  const dataResponse = await batchGetValues({
    accessToken,
    spreadsheetId: sourceSpreadsheetId,
    ranges: selectedIndexes.map((index) => {
      const column = columnFromIndex(index);
      return `${quoteSheetName(sourceTabName)}!${column}${
        headerRow + 1
      }:${column}${maxRows}`;
    }),
  });
  const columnValues = selectedIndexes.map(
    (_, index) => dataResponse.valueRanges?.[index]?.values ?? []
  );
  const rowCount = Math.max(0, ...columnValues.map((values) => values.length));
  const rows = Array.from({ length: rowCount }, (_, rowIndex) => {
    const row: unknown[] = [];
    selectedIndexes.forEach((columnIndex, selectedIndex) => {
      row[columnIndex] = columnValues[selectedIndex]?.[rowIndex]?.[0] ?? "";
    });
    return row;
  });

  return { headers, rows };
}
