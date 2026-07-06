import { AttributionClassification, TouchPayload } from "./types";
import {
  cleanAttributionText,
  hasAttributionText,
  hasExplicitCtwaEvidence,
  hasTrackedAttribution,
} from "@/lib/attribution/display";

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
  "fbp",
  "fbc",
  "gclid",
  "ttclid",
  "msclkid",
  "wbraid",
  "gbraid",
] as const;

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

  const utmCount = utmKeys.filter((key) => hasAttributionText(touch[key])).length;
  const hasClickId = clickIdKeys.some((key) => hasAttributionText(touch[key]));
  const hasCtwa = hasExplicitCtwaEvidence(touch);
  const hasTrackedIds = hasTrackedAttribution(touch);
  const hasReferrer =
    hasAttributionText(touch.referrer) ||
    hasAttributionText(touch.landing_page_url) ||
    hasAttributionText(touch.current_page_url);

  if (utmCount >= 3) {
    return {
      sourceType: "reg_form_utm",
      attributionQuality: "complete_utm",
      trackingStatus: "complete_utm",
      auditReason: "utm_found_on_parent_url",
    };
  }

  if (hasCtwa) {
    return {
      sourceType: "whatsapp_ctwa",
      attributionQuality: "ctwa_detected",
      trackingStatus: "ctwa_detected",
      auditReason: "ctwa_id_detected_from_whatsapp_payload",
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

  if (hasTrackedIds) {
    return {
      sourceType: "reg_form_utm",
      attributionQuality: "click_id_only",
      trackingStatus: "click_id_only",
      auditReason: "campaign_or_ad_id_found_without_utm",
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
  return cleanAttributionText(value, maxLength);
}
