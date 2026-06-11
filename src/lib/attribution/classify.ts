import { AttributionClassification, TouchPayload } from "./types";

const utmKeys = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_id",
  "utm_content",
  "utm_term",
] as const;

const clickIdKeys = [
  "fbclid",
  "gclid",
  "ttclid",
  "msclkid",
  "wbraid",
  "gbraid",
] as const;

function hasValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

export function classifyAttribution(
  touch: TouchPayload,
  options?: {
    parentPayloadMissing?: boolean;
    recoveredFromStorage?: "local" | "session" | null;
  }
): AttributionClassification {
  if (options?.parentPayloadMissing) {
    return {
      sourceType: "organic_unknown",
      attributionQuality: "missing",
      trackingStatus: "missing",
      auditReason: "iframe_missing_parent_payload",
    };
  }

  const utmCount = utmKeys.filter((key) => hasValue(touch[key])).length;
  const hasClickId = clickIdKeys.some((key) => hasValue(touch[key]));
  const hasCtwa =
    hasValue(touch.ctwa_id) ||
    hasValue(touch.whatsapp_referral_source_id) ||
    hasValue(touch.whatsapp_message_id) ||
    hasValue(touch.meta_ad_id) ||
    hasValue(touch.meta_adset_id) ||
    hasValue(touch.meta_campaign_id);
  const hasReferrer =
    hasValue(touch.referrer) ||
    hasValue(touch.landing_page_url) ||
    hasValue(touch.current_page_url);

  if (hasCtwa) {
    return {
      sourceType: "whatsapp_ctwa",
      attributionQuality: "ctwa_detected",
      trackingStatus: "ctwa_detected",
      auditReason: "ctwa_id_detected_from_whatsapp_payload",
    };
  }

  if (utmCount >= 3) {
    return {
      sourceType: "reg_form_utm",
      attributionQuality: "complete_utm",
      trackingStatus: "complete_utm",
      auditReason: "utm_found_on_parent_url",
    };
  }

  if (options?.recoveredFromStorage && (utmCount > 0 || hasClickId)) {
    return {
      sourceType: "reg_form_utm",
      attributionQuality: "storage_recovered",
      trackingStatus: "storage_recovered",
      auditReason:
        options.recoveredFromStorage === "local"
          ? "recovered_from_local_storage"
          : "recovered_from_session_storage",
    };
  }

  if (utmCount > 0) {
    return {
      sourceType: "reg_form_utm",
      attributionQuality: "partial_utm",
      trackingStatus: "partial_utm",
      auditReason: "iframe_received_parent_payload",
    };
  }

  if (hasClickId) {
    return {
      sourceType: "reg_form_utm",
      attributionQuality: "click_id_only",
      trackingStatus: "click_id_only",
      auditReason: "fbclid_found_without_utm",
    };
  }

  if (hasReferrer) {
    return {
      sourceType: "organic_unknown",
      attributionQuality: "referrer_only",
      trackingStatus: "referrer_only",
      auditReason: "organic_assigned_due_to_no_tracking_signal",
    };
  }

  return {
    sourceType: "organic_unknown",
    attributionQuality: "organic_unknown",
    trackingStatus: "organic_unknown",
    auditReason: "no_url_params_no_storage",
  };
}

export function normalizePhone(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const digits = trimmed.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return `+${digits.slice(1).replace(/\D/g, "")}`;
  const numeric = digits.replace(/\D/g, "");
  return numeric.length === 8 ? `+852${numeric}` : numeric;
}

export function cleanText(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}
