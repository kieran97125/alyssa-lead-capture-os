import type { TouchPayload } from "@/lib/attribution/types";
import {
  campaignDisplayLabel,
  contentDisplayLabel,
  preferredPageUrl,
  sourceDisplayLabel,
} from "@/lib/attribution/display";

type SyncStatus = "enabled" | "disabled" | "missing_config";

export type LeadSheetSyncInput = {
  brandId: string;
  leadKey: string;
  createdAt: Date | string | null;
  customerName: string;
  phone: string;
  email: string | null;
  brandName: string;
  formName: string;
  treatmentName: string;
  packageName: string;
  price: number | string;
  branchName: string;
  appointmentDate: string | null;
  appointmentTime: string | null;
  pageUrl: string | null;
  touch: TouchPayload;
};

export const GOOGLE_SHEETS_LEAD_SCHEMA_VERSION = "lead.v3";

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
] as const;

export type GoogleSheetsLeadWebhookPayload = {
  secret: string;
  schemaVersion: typeof GOOGLE_SHEETS_LEAD_SCHEMA_VERSION;
  lastUpdatedAt: string;
  createdAt: string;
  followUpStatus: string;
  brand: string;
  branch: string;
  customerName: string;
  phone: string;
  email: string;
  treatmentOffer: string;
  treatmentItem: string;
  appointmentDate: string;
  appointmentTime: string;
  confirmedShowDate: string;
  source: string;
  campaignAd: string;
  pageUrl: string;
  lastFollowUpAt: string;
  leadKey: string;
  csRemark: string;
  assignedTo: string;
  followUpRemark: string;
  status: string;
  showUp: string;
  headers: typeof GOOGLE_SHEETS_LEAD_HEADERS;
  rowValues: string[];
};

function env(name: string) {
  return process.env[name]?.trim() || "";
}

export function getGoogleSheetsLeadSyncStatus(): {
  status: SyncStatus;
  label: string;
  missing: string[];
} {
  if (env("GOOGLE_SHEETS_SYNC_ENABLED").toLowerCase() !== "true") {
    return { status: "disabled", label: "已停用", missing: [] };
  }
  return { status: "enabled", label: "已設定", missing: [] };
}

function formatMoney(price: number | string) {
  if (price === "" || price == null) return "";
  return `$${price}`;
}

export function formatHongKongDateTime(value: Date | string | null | undefined) {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).formatToParts(date);

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value || "";

  const year = part("year");
  const month = part("month");
  const day = part("day");
  const hour = part("hour");
  const minute = part("minute");
  const second = part("second");
  const hongKongHour24 = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Hong_Kong",
      hour: "numeric",
      hourCycle: "h23",
    }).format(date)
  );
  const dayPeriod =
    part("dayPeriod") ||
    (Number.isFinite(hongKongHour24) && hongKongHour24 >= 12 ? "下午" : "上午");

  if (!year || !month || !day || !hour || !minute || !second) {
    return "";
  }

  return `${year}/${month}/${day} ${dayPeriod} ${hour}:${minute}:${second}`;
}

function formatPricedLabel(
  name: string,
  fallbackName: string,
  price: number | string
) {
  const label = String(name || fallbackName || "").trim();
  const amount = formatMoney(price);

  if (!label) return amount;
  if (!amount || label.includes(amount)) return label;
  return `${amount} ${label}`;
}

function formatTreatmentOffer(
  formName: string,
  treatmentName: string,
  packageName: string,
  price: number | string
) {
  return (
    String(formName || "").trim() ||
    formatPricedLabel(packageName, treatmentName, price)
  );
}

function formatTreatmentItem(
  treatmentName: string,
  packageName: string,
  price: number | string
) {
  return formatPricedLabel(packageName, treatmentName, price);
}

function formatSource(touch: TouchPayload) {
  return sourceDisplayLabel(touch);
}

function formatCampaignAd(touch: TouchPayload) {
  return [campaignDisplayLabel(touch), contentDisplayLabel(touch)].join(" / ");
}

export function buildGoogleSheetsLeadPayload(
  input: LeadSheetSyncInput
): GoogleSheetsLeadWebhookPayload {
  const touch = input.touch;
  const pageUrl = preferredPageUrl(touch) || input.pageUrl || "";
  const createdAt = formatHongKongDateTime(input.createdAt);
  const fields = {
    // New rows start with the same HKT timestamp in both columns. The Sheet
    // automation later locks this field to the first Book event date.
    lastUpdatedAt: createdAt,
    createdAt,
    followUpStatus: "待跟進",
    brand: input.brandName,
    branch: input.branchName,
    customerName: input.customerName,
    phone: input.phone,
    email: input.email || "",
    treatmentOffer: formatTreatmentOffer(
      input.formName,
      input.treatmentName,
      input.packageName,
      input.price
    ),
    treatmentItem: formatTreatmentItem(
      input.treatmentName,
      input.packageName,
      input.price
    ),
    appointmentDate: input.appointmentDate || "",
    appointmentTime: input.appointmentTime || "",
    confirmedShowDate: "",
    source: formatSource(touch),
    campaignAd: formatCampaignAd(touch),
    pageUrl,
    lastFollowUpAt: "",
    leadKey: input.leadKey,
    csRemark: "",
    assignedTo: "",
    followUpRemark: "",
    status: "",
    showUp: "",
  };
  const rowValues = [
    fields.lastUpdatedAt,
    fields.createdAt,
    fields.followUpStatus,
    fields.brand,
    fields.branch,
    fields.customerName,
    fields.phone,
    fields.email,
    fields.treatmentOffer,
    fields.treatmentItem,
    fields.appointmentDate,
    fields.appointmentTime,
    fields.confirmedShowDate,
    fields.source,
    fields.campaignAd,
    fields.pageUrl,
    fields.lastFollowUpAt,
    fields.leadKey,
    fields.csRemark,
    fields.assignedTo,
    fields.followUpRemark,
    fields.status,
    fields.showUp,
  ];

  return {
    secret: env("GOOGLE_SHEETS_WEBHOOK_SECRET"),
    schemaVersion: GOOGLE_SHEETS_LEAD_SCHEMA_VERSION,
    ...fields,
    headers: GOOGLE_SHEETS_LEAD_HEADERS,
    rowValues,
  };
}

function canonicalHeader(value: string) {
  return value
    .trim()
    .replace(/\u00a0/g, " ")
    .replace(/[／⁄]/g, "/")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en");
}

const REQUIRED_OPERATIONAL_HEADERS = [
  "Created At",
  "跟進狀態",
  "品牌",
  "分店",
  "客人姓名",
  "電話",
  "療程 / 優惠",
  "療程項目",
  "預約日期",
  "預約時間",
  "來源",
  "lead_key",
] as const;

export function alignLeadRowToDestinationHeaders(
  destinationHeaders: string[],
  payload: GoogleSheetsLeadWebhookPayload
) {
  const valueByHeader = new Map(
    payload.headers.map((header, index) => [
      canonicalHeader(header),
      payload.rowValues[index] ?? "",
    ])
  );
  const normalizedDestinationHeaders = destinationHeaders.map(canonicalHeader);
  const duplicateHeaders = normalizedDestinationHeaders.filter(
    (header, index) =>
      header &&
      normalizedDestinationHeaders.indexOf(header) !== index &&
      valueByHeader.has(header)
  );
  if (duplicateHeaders.length > 0) {
    throw new Error(
      `Google Sheet 有重複受管理 header：${Array.from(
        new Set(duplicateHeaders)
      ).join("、")}。Lead 寫入已安全停止。`
    );
  }

  const destinationHeaderSet = new Set(normalizedDestinationHeaders);
  const missingHeaders = REQUIRED_OPERATIONAL_HEADERS.filter(
    (header) => !destinationHeaderSet.has(canonicalHeader(header))
  );
  if (missingHeaders.length > 0) {
    throw new Error(
      `Google Sheet 缺少必要 header：${missingHeaders.join(
        "、"
      )}。Lead 寫入已安全停止。`
    );
  }

  return normalizedDestinationHeaders.map(
    (header) => valueByHeader.get(header) ?? ""
  );
}

export async function appendLeadToGoogleSheet(input: LeadSheetSyncInput) {
  const status = getGoogleSheetsLeadSyncStatus();

  if (status.status !== "enabled") {
    return {
      ok: true,
      skipped: true,
      reason: status.status,
      missing: status.missing,
      webhookStatus: null,
      transport: null,
    };
  }

  const payload = buildGoogleSheetsLeadPayload(input);
  const { appendLeadViaNativeGoogleSheets } = await import(
    "@/lib/integrations/googleSheetsLeadNative"
  );
  const nativeResult = await appendLeadViaNativeGoogleSheets({
    brandId: input.brandId,
    payload,
  });

  if (nativeResult.attempted) {
    return {
      ok: true,
      skipped: false,
      reason: null,
      missing: [],
      webhookStatus: null,
      transport: "native_oauth" as const,
      sourceId: nativeResult.sourceId,
      updatedRange: nativeResult.updatedRange,
    };
  }

  const legacyStatus = getGoogleSheetsLegacyWebhookStatus();
  if (legacyStatus.status !== "enabled") {
    return {
      ok: true,
      skipped: true,
      reason: nativeResult.reason,
      missing: [...nativeResult.missing, ...legacyStatus.missing],
      webhookStatus: null,
      transport: null,
    };
  }

  const response = await fetch(env("GOOGLE_SHEETS_WEBHOOK_URL"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`google_sheets_webhook_failed:${response.status}`);
  }

  return {
    ok: true,
    skipped: false,
    reason: null,
    missing: [],
    webhookStatus: response.status,
    transport: "apps_script" as const,
  };
}

function getGoogleSheetsLegacyWebhookStatus(): {
  status: SyncStatus;
  missing: string[];
} {
  const missing: string[] = [];
  if (env("GOOGLE_SHEETS_SYNC_MODE").toLowerCase() !== "apps_script") {
    missing.push("GOOGLE_SHEETS_SYNC_MODE=apps_script");
  }
  for (const name of [
    "GOOGLE_SHEETS_WEBHOOK_URL",
    "GOOGLE_SHEETS_WEBHOOK_SECRET",
  ]) {
    if (!env(name)) missing.push(name);
  }
  return {
    status: missing.length > 0 ? "missing_config" : "enabled",
    missing,
  };
}
