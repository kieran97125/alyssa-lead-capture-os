import type { TouchPayload } from "@/lib/attribution/types";
import {
  campaignDisplayLabel,
  contentDisplayLabel,
  preferredPageUrl,
  sourceDisplayLabel,
} from "@/lib/attribution/display";

type SyncStatus = "enabled" | "disabled" | "missing_config";

type LeadSheetSyncInput = {
  createdAt: Date | string | null;
  customerName: string;
  phone: string;
  email: string | null;
  brandName: string;
  treatmentName: string;
  packageName: string;
  price: number | string;
  branchName: string;
  appointmentDate: string | null;
  appointmentTime: string | null;
  pageUrl: string | null;
  touch: TouchPayload;
};

export type GoogleSheetsLeadWebhookPayload = {
  secret: string;
  createdAt: string;
  followUpStatus: string;
  csOwner: string;
  brand: string;
  branch: string;
  customerName: string;
  phone: string;
  email: string;
  treatmentOffer: string;
  appointmentDate: string;
  appointmentTime: string;
  source: string;
  campaignAd: string;
  pageUrl: string;
  note: string;
  lastFollowUpAt: string;
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

  const missing: string[] = [];

  if (env("GOOGLE_SHEETS_SYNC_MODE").toLowerCase() !== "apps_script") {
    missing.push("GOOGLE_SHEETS_SYNC_MODE=apps_script");
  }

  for (const name of [
    "GOOGLE_SHEETS_WEBHOOK_URL",
    "GOOGLE_SHEETS_WEBHOOK_SECRET",
  ]) {
    if (!env(name)) {
      missing.push(name);
    }
  }

  if (missing.length > 0) {
    return { status: "missing_config", label: "未設定", missing };
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

function formatTreatmentOffer(
  treatmentName: string,
  packageName: string,
  price: number | string
) {
  const amount = formatMoney(price);
  const primaryName = treatmentName || packageName;
  const mainOffer = [amount, primaryName].filter(Boolean).join(" ");

  if (!mainOffer) {
    return packageName;
  }

  if (
    packageName &&
    primaryName &&
    packageName.toLowerCase() !== primaryName.toLowerCase()
  ) {
    return `${mainOffer} / ${packageName}`;
  }

  return mainOffer;
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
  const pageUrl =
    preferredPageUrl(touch) || input.pageUrl || "";

  return {
    secret: env("GOOGLE_SHEETS_WEBHOOK_SECRET"),
    createdAt: formatHongKongDateTime(input.createdAt),
    followUpStatus: "待跟進",
    csOwner: "",
    brand: input.brandName,
    branch: input.branchName,
    customerName: input.customerName,
    phone: input.phone,
    email: input.email || "",
    treatmentOffer: formatTreatmentOffer(
      input.treatmentName,
      input.packageName,
      input.price
    ),
    appointmentDate: input.appointmentDate || "",
    appointmentTime: input.appointmentTime || "",
    source: formatSource(touch),
    campaignAd: formatCampaignAd(touch),
    pageUrl,
    note: "",
    lastFollowUpAt: "",
  };
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
    };
  }

  const response = await fetch(env("GOOGLE_SHEETS_WEBHOOK_URL"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildGoogleSheetsLeadPayload(input)),
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
  };
}
