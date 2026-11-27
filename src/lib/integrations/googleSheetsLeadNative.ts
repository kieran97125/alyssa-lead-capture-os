import "server-only";

import { gosLeadSheetCells } from "@/lib/integrations/gosLeadSheetCells";

import {
  getGoogleSheetsOAuthAccessToken,
  getGoogleSheetsOAuthStatus,
} from "@/lib/integrations/googleSheetsOAuth";
import {
  alignLeadRowToDestinationHeaders,
  type GoogleSheetsLeadWebhookPayload,
} from "@/lib/integrations/googleSheetsLeadSync";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";

const GOOGLE_SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const DEFAULT_HEADER_ROW = 1;
const MAX_HEADER_COLUMNS = 200;

type LeadDestination = {
  id: string;
  brand_id: string | null;
  display_name: string;
  configuration: Record<string, unknown>;
};

export type NativeLeadAppendResult =
  | {
      attempted: false;
      reason:
        | "database_unavailable"
        | "destination_missing"
        | "destination_ambiguous"
        | "oauth_write_scope_missing";
      missing: string[];
    }
  | {
      attempted: true;
      sourceId: string;
      sourceName: string;
      updatedRange: string | null;
      updatedRows: number;
    };

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function headerRowValue(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 100
    ? parsed
    : DEFAULT_HEADER_ROW;
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

function tabName(configuration: Record<string, unknown>) {
  const value = stringValue(configuration.tabName) || "lead";
  if (!value || value.length > 100) {
    throw new Error("Google Sheet 工作表名稱無效。");
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

function sourceDataset(configuration: Record<string, unknown>) {
  return stringValue(configuration.dataset);
}

function normalized(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type WebsiteAccountRoute = {
  tabName: string;
  account: string;
  brand: string;
  medicalBrand?: string;
  medicalKeywords?: string[];
};

function configuredWebsiteAccountRoute(
  configuration: Record<string, unknown>,
  sourceBrand: string
): WebsiteAccountRoute | null {
  const raw = configuration.websiteAccountRoutes;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const routes = raw as Record<string, unknown>;
  const matchedEntry = Object.entries(routes).find(
    ([key]) => normalized(key) === normalized(sourceBrand)
  );
  if (!matchedEntry) return null;
  const value = matchedEntry[1];
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const tab = stringValue(record.tabName);
  const account = stringValue(record.account);
  const brand = stringValue(record.brand);
  if (!tab || !account || !brand) return null;
  return {
    tabName: tab,
    account,
    brand,
    medicalBrand: stringValue(record.medicalBrand) || undefined,
    medicalKeywords: Array.isArray(record.medicalKeywords)
      ? record.medicalKeywords.map(stringValue).filter(Boolean)
      : undefined,
  };
}

function defaultWebsiteAccountRoute(sourceBrand: string): WebsiteAccountRoute | null {
  const brand = normalized(sourceBrand);
  if (brand === "alyssa") {
    return {
      tabName: "Alyssa Aesthetics",
      account: "Alyssa Aesthetics",
      brand: "Alyssa Aesthetics",
      medicalBrand: "Aesthetics Medical",
      medicalKeywords: ["julaine", "juläine", "xeomin", "麗珠", "緻麗顏"],
    };
  }
  if (brand === "aesthetics" || brand === "aesthetics medical") {
    return {
      tabName: "Alyssa Aesthetics",
      account: "Alyssa Aesthetics",
      brand: "Aesthetics Medical",
    };
  }
  if (
    brand === "am" ||
    brand === "alyssa medical" ||
    brand === "alyssa-medical"
  ) {
    return {
      tabName: "Alyssa Medical",
      account: "Alyssa Medical",
      brand: "Alyssa Medical",
    };
  }
  if (brand === "gos" || brand === "gos beauty") {
    return { tabName: "GOS Beauty", account: "GOS Beauty", brand: "GOS Beauty" };
  }
  if (brand === "ineffable" || brand === "ineffable beauty") {
    return { tabName: "Ineffable", account: "Ineffable", brand: "Ineffable Beauty" };
  }
  if (["skin light", "skinlight", "skin light beauty"].includes(brand)) {
    return { tabName: "Skin Light", account: "Skin Light", brand: "Skin Light" };
  }
  return null;
}

function routePayload(
  configuration: Record<string, unknown>,
  payload: GoogleSheetsLeadWebhookPayload
) {
  const route =
    configuredWebsiteAccountRoute(configuration, payload.brand) ||
    defaultWebsiteAccountRoute(payload.brand);
  if (!route) {
    throw new Error(`未設定 ${payload.brand || "未知品牌"} 嘅 Omni Account 寫入路由。`);
  }

  const treatmentText = normalized(
    [payload.treatmentOffer, payload.treatmentItem].filter(Boolean).join(" ")
  );
  const useMedicalBrand = Boolean(
    route.medicalBrand &&
      route.medicalKeywords?.some((keyword) =>
        treatmentText.includes(normalized(keyword))
      )
  );
  const sheetBrand = useMedicalBrand ? route.medicalBrand! : route.brand;
  const rowValues = [...payload.rowValues];
  const brandIndex = payload.headers.indexOf("品牌");
  const accountIndex = payload.headers.indexOf("Account");
  if (brandIndex >= 0) rowValues[brandIndex] = sheetBrand;
  if (accountIndex >= 0) rowValues[accountIndex] = route.account;

  return {
    route,
    payload: {
      ...payload,
      brand: sheetBrand,
      account: route.account,
      rowValues,
    } satisfies GoogleSheetsLeadWebhookPayload,
  };
}


async function getLeadDestination(brandId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("marketing_data_sources")
    .select("id,brand_id,display_name,status,configuration")
    .eq("provider_key", "google_sheets")
    .neq("status", "paused")
    .limit(20);

  if (error) throw error;

  const candidates = ((data ?? []) as Array<Record<string, unknown>>)
    .map((row) => ({
      id: String(row.id ?? ""),
      brand_id:
        typeof row.brand_id === "string" && row.brand_id
          ? row.brand_id
          : null,
      display_name: String(row.display_name ?? "Google Lead Sheet"),
      configuration:
        row.configuration &&
        typeof row.configuration === "object" &&
        !Array.isArray(row.configuration)
          ? (row.configuration as Record<string, unknown>)
          : {},
    }))
    .filter(
      (row) =>
        row.id &&
        sourceDataset(row.configuration) === "lead_funnel" &&
        (row.brand_id === brandId || row.brand_id === null)
    );

  const brandSpecific = candidates.filter((row) => row.brand_id === brandId);
  const preferred = brandSpecific.length > 0 ? brandSpecific : candidates;

  if (preferred.length === 0) {
    return { destination: null, ambiguous: false };
  }
  if (preferred.length > 1) {
    return { destination: null, ambiguous: true };
  }
  return {
    destination: preferred[0] satisfies LeadDestination,
    ambiguous: false,
  };
}

async function readHeaderRow(input: {
  accessToken: string;
  spreadsheetId: string;
  tabName: string;
  headerRow: number;
}) {
  const range = `${quoteSheetName(input.tabName)}!${input.headerRow}:${input.headerRow}`;
  const query = new URLSearchParams({
    majorDimension: "ROWS",
    valueRenderOption: "FORMATTED_VALUE",
  });
  const response = await fetch(
    `${GOOGLE_SHEETS_API_BASE}/${encodeURIComponent(
      input.spreadsheetId
    )}/values/${encodeURIComponent(range)}?${query.toString()}`,
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
        "未能寫入 Google Sheet；請確認公司 Gmail 對文件具編輯權限，並重新連接 Google Sheets。"
      );
    }
    if (response.status === 404) {
      throw new Error("找不到指定 Google Sheet 或工作表，請檢查資料來源設定。");
    }
    throw new Error(`Google Sheets header 讀取失敗（HTTP ${response.status}）。`);
  }

  const body = (await response.json()) as { values?: unknown[][] };
  const headers = (body.values?.[0] ?? []).map((value) => String(value ?? ""));
  if (headers.length === 0) {
    throw new Error("Google Sheet header row 為空，Lead 寫入已安全停止。");
  }
  if (headers.length > MAX_HEADER_COLUMNS) {
    throw new Error("Google Sheet header 欄位過多，Lead 寫入已安全停止。");
  }
  return headers;
}

type GosAppendInput = {
  spreadsheetId: string;
  tabName: string;
  headerRow: number;
  accessToken: string;
  headers: string[];
  values: string[];
  identityIndex: number;
  sheetId: number;
  cells: ReturnType<typeof gosLeadSheetCells>;
};

// Request only the identity column back in the same atomic append. The row address
// comes from Sheets even when other registrations are appended concurrently.
async function appendGosTypedRow(input: GosAppendInput) {
  const idColumn = columnFromIndex(input.identityIndex);
  const tab = quoteSheetName(input.tabName);
  const fields = "updatedSpreadsheet(sheets(properties(sheetId),data(startRow,rowData(values(userEnteredValue(stringValue))))))";
  const response = await fetch(
    `${GOOGLE_SHEETS_API_BASE}/${encodeURIComponent(input.spreadsheetId)}:batchUpdate?fields=${encodeURIComponent(fields)}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${input.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [{ appendCells: {
          sheetId: input.sheetId,
          rows: [{ values: input.cells }],
          fields: "userEnteredValue,userEnteredFormat.numberFormat",
        } }],
        includeSpreadsheetInResponse: true,
        responseIncludeGridData: true,
        responseRanges: [`${tab}!${idColumn}${input.headerRow + 1}:${idColumn}`],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    }
  );
  if (!response.ok) return response;
  type GridBlock = { startRow?: number; rowData?: Array<{values?: Array<{ userEnteredValue?: { stringValue?: string } }>}> };
  const body = await response.json() as { updatedSpreadsheet?: { sheets?: Array<{ properties?: { sheetId?: number }; data?: GridBlock[] }> } };
  const block = body.updatedSpreadsheet?.sheets?.find(entry => (entry.properties?.sheetId ?? 0) === input.sheetId)?.data?.[0];
  const key = input.values[input.identityIndex];
  const matches = (block?.rowData ?? []).flatMap((row, index) =>
    row.values?.[0]?.userEnteredValue?.stringValue === key ? [(block?.startRow ?? 0) + index + 1] : []
  );
  if (matches.length !== 1) return Response.json({ updates: {} });
  const row = matches[0];
  return Response.json({ updates: { updatedRows: 1, updatedRange: `${tab}!A${row}:${columnFromIndex(input.values.length - 1)}${row}` } });
}

function gosIdentityColumn(tab: string, headers: string[]) {
  return tab === "GOS Beauty" ? headers.findIndex(header => header.trim().toLowerCase() === "omni lead id") : -1;
}

async function appendRow(input: {
  accessToken: string;
  spreadsheetId: string;
  tabName: string;
  headerRow: number;
  values: string[];
  headers: string[];
}) {
  const identityIndex = gosIdentityColumn(input.tabName, input.headers);
  if (identityIndex >= 0) {
    const metadata = await fetch(`${GOOGLE_SHEETS_API_BASE}/${encodeURIComponent(input.spreadsheetId)}?fields=sheets(properties(sheetId,title))`, {
      headers: { Authorization: `Bearer ${input.accessToken}` }, cache: "no-store", signal: AbortSignal.timeout(10000),
    });
    if (!metadata.ok) throw new Error(`Google Sheets metadata read failed (HTTP ${metadata.status})`);
    const body = await metadata.json() as { sheets: Array<{properties: {title: string; sheetId: number}}> };
    const sheet = body.sheets.find(entry => entry.properties.title === input.tabName);
    if (!sheet) throw new Error("Google Sheets destination tab missing");
    const written = await appendGosTypedRow({ ...input, identityIndex, sheetId: sheet.properties.sheetId, cells: gosLeadSheetCells(input.headers, input.values) });
    if (!written.ok) throw new Error(`Google Sheets append failed (HTTP ${written.status})`);
    const receipt = await written.json() as {updates?: {updatedRows?: number; updatedRange?: string}};
    if (receipt.updates?.updatedRows !== 1) throw new Error("Google Sheets append receipt incomplete");
    return receipt;
  }
  const lastColumn = columnFromIndex(input.values.length - 1);
  const range = `${quoteSheetName(input.tabName)}!A${input.headerRow}:${lastColumn}`;
  const query = new URLSearchParams({
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    includeValuesInResponse: "false",
  });
  const response = await fetch(
    `${GOOGLE_SHEETS_API_BASE}/${encodeURIComponent(
      input.spreadsheetId
    )}/values/${encodeURIComponent(range)}:append?${query.toString()}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        majorDimension: "ROWS",
        values: [input.values],
      }),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    if ([401, 403].includes(response.status)) {
      throw new Error(
        "未能寫入 Google Sheet；請確認公司 Gmail 對文件具編輯權限，並重新連接 Google Sheets。"
      );
    }
    if (response.status === 404) {
      throw new Error("找不到指定 Google Sheet 或工作表，請檢查資料來源設定。");
    }
    throw new Error(`Google Sheets Lead 寫入失敗（HTTP ${response.status}）。`);
  }

  return (await response.json()) as {
    updates?: {
      updatedRange?: string;
      updatedRows?: number;
    };
  };
}

async function updateDestinationHealth(
  destinationId: string,
  update: {
    status: "connected" | "error";
    lastErrorSummary?: string | null;
  }
) {
  try {
    const timestamp = new Date().toISOString();
    const payload: Record<string, unknown> = {
      updated_at: timestamp,
    };
    // Lead delivery is not a metric refresh. Preserve the metric sync cursor,
    // failure, successful refresh timestamp and lease when an unrelated website
    // Lead arrives concurrently. Delivery success does not publish report data.
    if (update.status === "error") {
      payload.status = "error";
      payload.last_error_summary = update.lastErrorSummary ?? null;
    }
    await createSupabaseAdminClient()
      .from("marketing_data_sources")
      .update(payload)
      .eq("id", destinationId)
      .neq("status", "syncing");
  } catch (error) {
    console.warn("google_sheets_lead_destination_status_update_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
  }
}

export async function appendLeadViaNativeGoogleSheets(input: {
  brandId: string;
  payload: GoogleSheetsLeadWebhookPayload;
}): Promise<NativeLeadAppendResult> {
  if (!hasSupabaseAdminEnv()) {
    return {
      attempted: false,
      reason: "database_unavailable",
      missing: ["Supabase connection"],
    };
  }

  const [{ destination, ambiguous }, oauthStatus] = await Promise.all([
    getLeadDestination(input.brandId),
    getGoogleSheetsOAuthStatus(),
  ]);

  if (ambiguous) {
    return {
      attempted: false,
      reason: "destination_ambiguous",
      missing: ["只保留一個相符 Lead Funnel destination"],
    };
  }
  if (!destination) {
    return {
      attempted: false,
      reason: "destination_missing",
      missing: ["Google Sheets Lead Funnel data source"],
    };
  }
  if (!oauthStatus.writeEnabled) {
    return {
      attempted: false,
      reason: "oauth_write_scope_missing",
      missing: ["Google Sheets write authorization"],
    };
  }

  const configuration = destination.configuration;
  const destinationSpreadsheetId = spreadsheetId(configuration);
  const routed = routePayload(configuration, input.payload);
  const destinationTabName = routed.route.tabName || tabName(configuration);
  const destinationHeaderRow = headerRowValue(configuration.headerRow);

  try {
    const accessToken = await getGoogleSheetsOAuthAccessToken({
      requireWrite: true,
    });
    const headers = await readHeaderRow({
      accessToken,
      spreadsheetId: destinationSpreadsheetId,
      tabName: destinationTabName,
      headerRow: destinationHeaderRow,
    });
    const values = alignLeadRowToDestinationHeaders(headers, routed.payload);
    const result = await appendRow({
      accessToken,
      spreadsheetId: destinationSpreadsheetId,
      tabName: destinationTabName,
      headerRow: destinationHeaderRow,
      headers, values,
    });
    await updateDestinationHealth(destination.id, {
      status: "connected",
      lastErrorSummary: null,
    });
    return {
      attempted: true,
      sourceId: destination.id,
      sourceName: destination.display_name,
      updatedRange: result.updates?.updatedRange ?? null,
      updatedRows: result.updates?.updatedRows ?? 1,
    };
  } catch (error) {
    await updateDestinationHealth(destination.id, {
      status: "error",
      lastErrorSummary:
        error instanceof Error
          ? error.message.slice(0, 240)
          : "Google Sheets Lead 寫入失敗。",
    });
    throw error;
  }
}

// Durable intake delivery uses an explicit identity/reconciliation contract.
// Keep the legacy caller above unchanged until its own consumers are migrated.
export async function deliverCapturedLeadToNativeSheet(input: {
  brandId: string;
  payload: GoogleSheetsLeadWebhookPayload;
  allowEmptyPhone?: boolean;
  pinnedTarget: import("@/lib/capture/deliveryPolicy").PublicLeadDeliveryTarget | null;
  reconcileOnly: boolean;
  beforeAppend: (target: import("@/lib/capture/deliveryPolicy").PublicLeadDeliveryTarget) => Promise<boolean>;
}): Promise<import("@/lib/capture/deliveryPolicy").PublicLeadDeliveryOutcome> {
  const { deliveryIdentityMatches, classifyAppendResponse } = await import("@/lib/capture/deliveryPolicy");
  const { normalizePhone } = await import("@/lib/attribution/classify");
  const timeoutMs = 10_000;
  const maxLookupRows = 50_000;
  let target = input.pinnedTarget;
  let appendIssued = false;
  async function googleJson(url: string) {
    const accessToken = await getGoogleSheetsOAuthAccessToken({ requireWrite: true });
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      cache: "no-store", signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`sheet_read_${response.status}`);
    return await response.json() as Record<string, unknown>;
  }
  try {
    if (!hasSupabaseAdminEnv()) return { status: "retry", code: "database_unavailable", safeToRetry: true };
    const oauthStatus = await getGoogleSheetsOAuthStatus();
    if (!oauthStatus.writeEnabled) return { status: "blocked", code: "oauth_write_scope_missing", safeToRetry: true };
    let payload = input.payload;
    if (!target) {
      const { destination, ambiguous } = await getLeadDestination(input.brandId);
      if (ambiguous || !destination) return { status: "blocked", code: ambiguous ? "destination_ambiguous" : "destination_missing", safeToRetry: true };
      const routed = routePayload(destination.configuration, payload);
      payload = routed.payload;
      target = { sourceId: destination.id, spreadsheetId: spreadsheetId(destination.configuration), tabName: routed.route.tabName || tabName(destination.configuration), headerRow: headerRowValue(destination.configuration.headerRow), sheetBrand: routed.payload.brand, account: routed.payload.account };
    }
    if (input.pinnedTarget) {
      const rowValues = [...payload.rowValues];
      const brandIndex = payload.headers.indexOf("品牌");
      const accountIndex = payload.headers.indexOf("Account");
      if (brandIndex >= 0) rowValues[brandIndex] = target.sheetBrand;
      if (accountIndex >= 0) rowValues[accountIndex] = target.account;
      payload = { ...payload, brand: target.sheetBrand, account: target.account, rowValues };
    }
    const base = `${GOOGLE_SHEETS_API_BASE}/${encodeURIComponent(target.spreadsheetId)}`;
    const headerRange = `${quoteSheetName(target.tabName)}!${target.headerRow}:${target.headerRow}`;
    const [metadata, headerBody] = await Promise.all([
      googleJson(`${base}?fields=${encodeURIComponent("sheets(properties(sheetId,title,gridProperties(rowCount)))")}`),
      googleJson(`${base}/values/${encodeURIComponent(headerRange)}?valueRenderOption=FORMATTED_VALUE`),
    ]);
    const sheets = Array.isArray(metadata.sheets) ? metadata.sheets as Array<{properties?: {sheetId?: number;title?: string;gridProperties?: {rowCount?: number}}}> : [];
    const sheet = sheets.find((entry) => entry.properties?.title === target!.tabName);
    const rowCount = sheet?.properties?.gridProperties?.rowCount;
    if (!Number.isInteger(rowCount) || !rowCount || rowCount > maxLookupRows) return { status: "blocked", code: "destination_lookup_incomplete", target, safeToRetry: true };
    const rows = Array.isArray(headerBody.values) ? headerBody.values as unknown[][] : [];
    const headers = (rows[0] ?? []).map((entry) => String(entry ?? ""));
    if (headers.length === 0 || headers.length > MAX_HEADER_COLUMNS) return { status: "blocked", code: "destination_header_invalid", target, safeToRetry: true };
    let values: string[];
    try { values = alignLeadRowToDestinationHeaders(headers, payload); }
    catch { return { status: "blocked", code: "destination_header_mismatch", target, safeToRetry: true }; }
    const identityColumns = headers.flatMap((header, index) => header.trim().toLowerCase() === "omni lead id" ? [index] : []);
    const phoneColumns = headers.flatMap((header, index) => header.trim() === "電話" ? [index] : []);
    if (identityColumns.length !== 1 || phoneColumns.length !== 1) return { status: "blocked", code: "destination_stable_identity_missing", target, safeToRetry: true };
    const idColumn = columnFromIndex(identityColumns[0]);
    const firstRow = target.headerRow + 1;
    const identityRange = `${quoteSheetName(target.tabName)}!${idColumn}${firstRow}:${idColumn}${rowCount}`;
    const identityBody = rowCount >= firstRow ? await googleJson(`${base}/values/${encodeURIComponent(identityRange)}?valueRenderOption=UNFORMATTED_VALUE`) : {};
    const identityValues = Array.isArray(identityBody.values) ? identityBody.values as unknown[][] : [];
    const matches = deliveryIdentityMatches(identityValues, payload.leadKey);
    if (matches.length > 1) return { status: "blocked", code: "destination_duplicate_identity", target };
    if (matches.length === 1) {
      const row = firstRow + matches[0];
      const phoneColumn = columnFromIndex(phoneColumns[0]);
      const phoneBody = await googleJson(`${base}/values/${encodeURIComponent(`${quoteSheetName(target.tabName)}!${phoneColumn}${row}:${phoneColumn}${row}`)}?valueRenderOption=UNFORMATTED_VALUE`);
      const foundPhone = String((phoneBody.values as unknown[][] | undefined)?.[0]?.[0] ?? "");
      if (normalizePhone(foundPhone).replace(/^\+/, "") !== normalizePhone(payload.phone).replace(/^\+/, "")) return { status: "blocked", code: "destination_identity_phone_mismatch", target };
      return { status: "delivered", code: "sheet_delivery_reconciled", target, updatedRange: `${quoteSheetName(target.tabName)}!A${row}:${columnFromIndex(headers.length - 1)}${row}` };
    }
    if (input.reconcileOnly) return { status: "uncertain", code: "sheet_append_not_confirmed", target };
    const gosIndex = gosIdentityColumn(target.tabName, headers);
    const sheetId = sheet?.properties?.sheetId;
    if (gosIndex >= 0 && typeof sheetId !== "number") return { status: "blocked", code: "destination_header_invalid", target, safeToRetry: true };
    let typedCells: ReturnType<typeof gosLeadSheetCells> | undefined;
    if (gosIndex >= 0) {
      try { typedCells = gosLeadSheetCells(headers, values, input.allowEmptyPhone); }
      catch { return { status: "blocked", code: "destination_cell_value_invalid", target, safeToRetry: true }; }
    }
    // Persist target + append intent with the current lease before issuing a write.
    // A failure here is ambiguous from the journal's perspective; recovery reads only.
    if (!await input.beforeAppend(target)) return { status: "blocked", code: "delivery_lease_lost", target };
    const accessToken = await getGoogleSheetsOAuthAccessToken({ requireWrite: true });
    const range = `${quoteSheetName(target.tabName)}!A${target.headerRow}:${columnFromIndex(values.length - 1)}`;
    const query = new URLSearchParams({ valueInputOption: "RAW", insertDataOption: "INSERT_ROWS", includeValuesInResponse: "false" });
    appendIssued = true;
    const response = typedCells && typeof sheetId === "number"
      ? await appendGosTypedRow({ spreadsheetId: target.spreadsheetId, tabName: target.tabName, headerRow: target.headerRow, accessToken, headers, values, identityIndex: gosIndex, sheetId, cells: typedCells })
      : await fetch(`${base}/values/${encodeURIComponent(range)}:append?${query.toString()}`, {
      method: "POST", headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ majorDimension: "ROWS", values: [values] }), cache: "no-store", signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return { ...classifyAppendResponse(response.status), target };
    const result = await response.json() as {updates?: {updatedRows?: number;updatedRange?: string}};
    if (result.updates?.updatedRows !== 1 || !result.updates.updatedRange) return { status: "uncertain", code: "sheet_append_receipt_incomplete", target };
    return { status: "delivered", code: "sheet_delivery_appended", target, updatedRange: result.updates.updatedRange };
  } catch {
    return { status: appendIssued || input.reconcileOnly ? "uncertain" : "retry", code: appendIssued ? "sheet_append_network_uncertain" : "sheet_delivery_read_failed", target: target ?? undefined, safeToRetry: !appendIssued && !input.reconcileOnly };
  }
}
