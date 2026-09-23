import "server-only";

import {
  getGoogleSheetsOAuthAccessToken,
  getGoogleSheetsOAuthStatus,
} from "@/lib/integrations/googleSheetsOAuth";
import {
  alignLeadRowToDestinationHeaders,
  GOOGLE_SHEETS_LEAD_HEADERS,
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
  const brandIndex = GOOGLE_SHEETS_LEAD_HEADERS.indexOf("品牌");
  const accountIndex = GOOGLE_SHEETS_LEAD_HEADERS.indexOf("Account");
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

async function appendRow(input: {
  accessToken: string;
  spreadsheetId: string;
  tabName: string;
  headerRow: number;
  values: string[];
}) {
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
    lastSuccessAt?: string;
    lastErrorSummary?: string | null;
  }
) {
  try {
    const timestamp = new Date().toISOString();
    const payload: Record<string, unknown> = {
      status: update.status,
      last_sync_at: timestamp,
      last_error_summary: update.lastErrorSummary ?? null,
      updated_at: timestamp,
    };
    if (update.lastSuccessAt) {
      payload.last_success_at = update.lastSuccessAt;
    }
    await createSupabaseAdminClient()
      .from("marketing_data_sources")
      .update(payload)
      .eq("id", destinationId);
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
      values,
    });
    const timestamp = new Date().toISOString();
    await updateDestinationHealth(destination.id, {
      status: "connected",
      lastSuccessAt: timestamp,
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
