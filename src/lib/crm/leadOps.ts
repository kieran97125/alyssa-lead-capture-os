import {
  asNumber,
  campaignLabel,
  displayCustomerName,
  displayPhone,
  formatAppointment,
  formatDateTime,
  money,
  sourceLabel as businessSourceLabel,
  type LeadRow,
} from "@/lib/data/businessMetrics";

export type CrmSourceType =
  | "landing_form"
  | "whatsapp_ad"
  | "whatsapp_direct"
  | "manual"
  | "import"
  | "unknown";

export type CrmStatus =
  | "pending_follow_up"
  | "contacted"
  | "booked"
  | "showed"
  | "no_show"
  | "cancelled"
  | "no_reply"
  | "lost"
  | "new"
  | "contacting"
  | "confirmed"
  | "paid"
  | "invalid";

export const crmPipelineStatuses: Array<{ value: CrmStatus; label: string }> = [
  { value: "pending_follow_up", label: "待跟進" },
  { value: "contacted", label: "已聯絡" },
  { value: "booked", label: "已預約" },
  { value: "showed", label: "已到店" },
  { value: "no_show", label: "No-show" },
  { value: "cancelled", label: "已取消" },
  { value: "no_reply", label: "未回覆" },
  { value: "lost", label: "已流失" },
];

export type CrmCtwaFields = {
  ctwa_source_id: string | null;
  ctwa_source_url: string | null;
  ctwa_referral_headline: string | null;
  ctwa_referral_body: string | null;
  campaign_id: string | null;
  adset_id: string | null;
  ad_id: string | null;
  phone_number_id: string | null;
  whatsapp_business_account_id: string | null;
};

export type CrmLeadCase = {
  id: string;
  createdAt: string;
  lastActivityAt: string;
  createdLabel: string;
  lastActivityLabel: string;
  customerName: string;
  phone: string;
  normalizedPhone: string;
  email: string;
  brandName: string;
  brandSlug: string;
  canonicalIdentity: string;
  treatmentOffer: string;
  packagePrice: string;
  branchName: string;
  appointmentLabel: string;
  crmSourceType: CrmSourceType;
  sourceLabel: string;
  sourceTypeRaw: string;
  campaignLabel: string;
  adLabel: string;
  landingPageSlug: string | null;
  pageUrl: string | null;
  status: CrmStatus;
  statusLabel: string;
  assignedCsLabel: string;
  nextFollowUpLabel: string;
  nextFollowUpAt: string | null;
  whatsappUrl: string | null;
  ctwa: CrmCtwaFields;
};

const unknownLabel = "未有資料";

function value(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function slugify(input: string | null | undefined) {
  const slug = (input ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "unknown-brand";
}

function compact(values: Array<string | null | undefined>, separator = " / ") {
  return values.filter((item): item is string => Boolean(item)).join(separator);
}

function extractPathSlug(url: string | null | undefined) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const lpIndex = parts.indexOf("lp");
    return lpIndex >= 0 ? parts[lpIndex + 1] ?? null : parts.at(-1) ?? null;
  } catch {
    const parts = url.split("?")[0]?.split("/").filter(Boolean) ?? [];
    const lpIndex = parts.indexOf("lp");
    return lpIndex >= 0 ? parts[lpIndex + 1] ?? null : parts.at(-1) ?? null;
  }
}

function whatsappLink(phone: string, brandName: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;

  const message = `你好，我哋係 ${brandName || "品牌"} 團隊，收到你嘅登記，想同你確認預約安排。請問你方便 WhatsApp 跟進嗎？`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function getCtwa(lead: LeadRow): CrmCtwaFields {
  const snapshot = (lead.sourceSnapshot ?? {}) as Record<string, unknown>;
  return {
    ctwa_source_id:
      value(snapshot.whatsapp_referral_source_id) || value(snapshot.ctwa_id),
    ctwa_source_url: value(snapshot.meta_source_url),
    ctwa_referral_headline: value(snapshot.whatsapp_referral_headline),
    ctwa_referral_body: value(snapshot.whatsapp_referral_body),
    campaign_id: value(snapshot.meta_campaign_id),
    adset_id: value(snapshot.meta_adset_id),
    ad_id: value(snapshot.meta_ad_id),
    phone_number_id: value(snapshot.whatsapp_phone_number_id),
    whatsapp_business_account_id: value(snapshot.whatsapp_business_account_id),
  };
}

function hasCtwa(ctwa: CrmCtwaFields) {
  return Object.values(ctwa).some(Boolean);
}

export function mapCrmSourceType(lead: LeadRow, ctwa = getCtwa(lead)): CrmSourceType {
  const raw = (lead.source_type || lead.sourceSnapshot?.source_type || "").toLowerCase();
  const snapshot = lead.sourceSnapshot;

  if (raw === "manual") return "manual";
  if (raw === "imported") return "import";
  if (raw === "whatsapp_ctwa" || hasCtwa(ctwa)) return "whatsapp_ad";
  if (raw.includes("whatsapp")) return "whatsapp_direct";
  if (
    raw === "reg_form_utm" ||
    snapshot?.utm_source ||
    snapshot?.utm_medium ||
    snapshot?.landing_page_url ||
    snapshot?.current_page_url
  ) {
    return "landing_form";
  }
  return "unknown";
}

export function crmSourceTypeLabel(type: CrmSourceType) {
  const labels: Record<CrmSourceType, string> = {
    landing_form: "Landing Page / 登記表格",
    whatsapp_ad: "WhatsApp 廣告",
    whatsapp_direct: "WhatsApp 直接查詢",
    manual: "人手建立",
    import: "匯入資料",
    unknown: "未知來源",
  };
  return labels[type];
}

function crmDisplaySourceLabel(lead: LeadRow, type: CrmSourceType) {
  const source = businessSourceLabel(lead);

  if (type === "landing_form") return source;
  if (type === "unknown") return "直接 / 無追蹤";
  return crmSourceTypeLabel(type);
}

export function deriveInitialCrmStatusFromLead(lead: LeadRow): CrmStatus {
  const bookingStatus = lead.booking?.booking_status || lead.booking_status;
  const leadStatus = lead.lead_status;
  const appointmentDate = lead.booking?.appointment_date || lead.appointment_date;
  const appointmentTime = lead.booking?.appointment_time || lead.appointment_time;
  const hasAppointmentEvidence = Boolean(appointmentDate || appointmentTime);

  if (leadStatus === "invalid") return "invalid";
  if (leadStatus === "lost") return "lost";
  if (bookingStatus === "no_show") return "no_show";
  if (bookingStatus === "cancelled") return "cancelled";
  if (bookingStatus === "show" || bookingStatus === "showed") return "showed";
  if (
    bookingStatus === "confirmed" ||
    bookingStatus === "booked" ||
    bookingStatus === "rescheduled" ||
    hasAppointmentEvidence
  ) {
    return "booked";
  }
  if (lead.payment_status === "pending") return "contacted";
  return "pending_follow_up";
}

export function mapCrmStatus(lead: LeadRow): CrmStatus {
  return deriveInitialCrmStatusFromLead(lead);
}

export function crmStatusLabel(status: CrmStatus) {
  const labels: Record<CrmStatus, string> = {
    pending_follow_up: "待跟進",
    contacted: "已聯絡",
    booked: "已預約",
    showed: "已到店",
    no_show: "No-show",
    cancelled: "已取消",
    no_reply: "未回覆",
    lost: "已流失",
    new: "待跟進",
    contacting: "已聯絡",
    confirmed: "已確認",
    paid: "已付款",
    invalid: "無效",
  };
  return labels[status] ?? status;
}

export function toCrmLeadCase(lead: LeadRow): CrmLeadCase {
  const ctwa = getCtwa(lead);
  const crmSourceType = mapCrmSourceType(lead, ctwa);
  const status = mapCrmStatus(lead);
  const phone = displayPhone(lead);
  const normalizedPhone = lead.normalized_phone || lead.contact?.normalized_phone || phone;
  const brandName = lead.brand?.name || unknownLabel;
  const brandSlug = slugify(brandName);
  const pageUrl =
    lead.sourceSnapshot?.current_page_url ||
    lead.sourceSnapshot?.landing_page_url ||
    null;
  const treatmentOffer =
    compact([lead.treatment?.name, lead.package?.name]) || unknownLabel;
  const campaign = campaignLabel(lead);
  const ad =
    lead.sourceSnapshot?.utm_content ||
    lead.sourceSnapshot?.meta_ad_id ||
    lead.sourceSnapshot?.fbclid ||
    unknownLabel;
  const activityAt = lead.submitted_at || lead.created_at;

  return {
    id: lead.id,
    createdAt: lead.created_at,
    lastActivityAt: activityAt,
    createdLabel: formatDateTime(lead.created_at),
    lastActivityLabel: formatDateTime(activityAt),
    customerName: displayCustomerName(lead),
    phone,
    normalizedPhone,
    email: lead.contact?.email || unknownLabel,
    brandName,
    brandSlug,
    canonicalIdentity: `${brandSlug}:${normalizedPhone || "unknown-phone"}`,
    treatmentOffer,
    packagePrice: money(asNumber(lead.package?.promo_price ?? lead.price)),
    branchName: lead.branch?.name || unknownLabel,
    appointmentLabel: formatAppointment(lead),
    crmSourceType,
    sourceLabel: crmDisplaySourceLabel(lead, crmSourceType),
    sourceTypeRaw: lead.source_type || lead.sourceSnapshot?.source_type || "unknown",
    campaignLabel: campaign,
    adLabel: ad,
    landingPageSlug: extractPathSlug(pageUrl),
    pageUrl,
    status,
    statusLabel: crmStatusLabel(status),
    assignedCsLabel: "未分配",
    nextFollowUpLabel: "未設定",
    nextFollowUpAt: null,
    whatsappUrl: whatsappLink(normalizedPhone || phone, brandName),
    ctwa,
  };
}

export function summarizeCrmCases(cases: CrmLeadCase[]) {
  return {
    total: cases.length,
    pendingFollowUp: cases.filter((item) => item.status === "pending_follow_up").length,
    nextFollowUp: cases.filter((item) => Boolean(item.nextFollowUpAt)).length,
    booked: cases.filter((item) => item.status === "booked").length,
    showed: cases.filter((item) => item.status === "showed").length,
    noShow: cases.filter((item) => item.status === "no_show").length,
  };
}
