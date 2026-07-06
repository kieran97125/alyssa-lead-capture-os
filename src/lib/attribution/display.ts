import type { TouchPayload } from "@/lib/attribution/types";

const invalidTextValues = new Set(["undefined", "null", "nan"]);

export function cleanAttributionText(value: unknown, maxLength = 500) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).trim();
  if (!cleaned) return null;
  if (invalidTextValues.has(cleaned.toLowerCase())) return null;
  return cleaned.slice(0, maxLength);
}

export function hasAttributionText(value: unknown) {
  return Boolean(cleanAttributionText(value));
}

export function getAttributionText(
  touch: TouchPayload | Record<string, unknown> | null | undefined,
  key: string,
  maxLength = 500
) {
  if (!touch) return null;
  return cleanAttributionText((touch as Record<string, unknown>)[key], maxLength);
}

export function hasExplicitCtwaEvidence(
  touch: TouchPayload | Record<string, unknown> | null | undefined,
  sourceType?: string | null
) {
  const rawSourceType = cleanAttributionText(sourceType) || "";
  const utmMedium = getAttributionText(touch, "utm_medium")?.toLowerCase();
  const lhMedium = getAttributionText(touch, "lh_medium")?.toLowerCase();
  const referralSourceType = getAttributionText(
    touch,
    "whatsapp_referral_source_type"
  )?.toLowerCase();

  return Boolean(
    rawSourceType.toLowerCase() === "whatsapp_ctwa" ||
      utmMedium === "ctwa" ||
      lhMedium === "ctwa" ||
      referralSourceType === "ctwa" ||
      getAttributionText(touch, "ctwa_id") ||
      getAttributionText(touch, "ctwa_clid") ||
      getAttributionText(touch, "whatsapp_referral_source_id")
  );
}

export function hasTrackedAttribution(
  touch: TouchPayload | Record<string, unknown> | null | undefined
) {
  return [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_id",
    "utm_content",
    "utm_term",
    "lh_source",
    "lh_medium",
    "lh_campaign",
    "lh_content",
    "lh_term",
    "fbclid",
    "fbp",
    "fbc",
    "gclid",
    "ttclid",
    "msclkid",
    "wbraid",
    "gbraid",
    "campaign_id",
    "adset_id",
    "ad_id",
    "meta_campaign_id",
    "meta_adset_id",
    "meta_ad_id",
  ].some((key) => getAttributionText(touch, key));
}

export function sourceDisplayLabel(
  touch: TouchPayload | Record<string, unknown> | null | undefined,
  sourceType?: string | null
) {
  if (hasExplicitCtwaEvidence(touch, sourceType)) return "WhatsApp CTWA";

  const source =
    getAttributionText(touch, "utm_source") ||
    getAttributionText(touch, "lh_source");
  const medium =
    getAttributionText(touch, "utm_medium") ||
    getAttributionText(touch, "lh_medium");

  if (source) return `${source} / ${medium || "-"}`;

  if (
    getAttributionText(touch, "fbclid") ||
    getAttributionText(touch, "fbp") ||
    getAttributionText(touch, "fbc") ||
    getAttributionText(touch, "meta_campaign_id") ||
    getAttributionText(touch, "meta_adset_id") ||
    getAttributionText(touch, "meta_ad_id")
  ) {
    return "Meta / -";
  }

  if (
    getAttributionText(touch, "gclid") ||
    getAttributionText(touch, "wbraid") ||
    getAttributionText(touch, "gbraid")
  ) {
    return "Google / -";
  }

  return "直接 / 無追蹤";
}

export function campaignDisplayLabel(
  touch: TouchPayload | Record<string, unknown> | null | undefined
) {
  return (
    getAttributionText(touch, "utm_campaign") ||
    getAttributionText(touch, "lh_campaign") ||
    getAttributionText(touch, "meta_campaign_id") ||
    getAttributionText(touch, "campaign_id") ||
    "未標記廣告系列"
  );
}

export function contentDisplayLabel(
  touch: TouchPayload | Record<string, unknown> | null | undefined
) {
  return (
    getAttributionText(touch, "utm_content") ||
    getAttributionText(touch, "lh_content") ||
    getAttributionText(touch, "meta_ad_id") ||
    getAttributionText(touch, "ad_id") ||
    "未標記素材"
  );
}

export function preferredPageUrl(
  touch: TouchPayload | Record<string, unknown> | null | undefined
) {
  return (
    getAttributionText(touch, "parent_url", 2000) ||
    getAttributionText(touch, "page_url", 2000) ||
    getAttributionText(touch, "current_page_url", 2000) ||
    getAttributionText(touch, "landing_page_url", 2000)
  );
}
