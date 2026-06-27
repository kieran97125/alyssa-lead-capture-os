export const PUBLIC_ATTRIBUTION_COOKIE_NAME = "launchhub_public_attribution";
export const PUBLIC_ATTRIBUTION_CLIENT_COOKIE_NAME =
  "launchhub_public_attribution_client";
export const PUBLIC_ATTRIBUTION_COOKIE_MAX_AGE_SECONDS = 3 * 24 * 60 * 60;
export const LOCKED_PUBLIC_ATTRIBUTION_STORAGE_KEY =
  "launchhub_locked_attribution";

export const publicAttributionTrackingKeys = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
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
  "placement",
  "ctwa_id",
  "ctwa_clid",
  "meta_campaign_id",
  "meta_adset_id",
  "meta_ad_id",
] as const;

export type PublicAttributionTrackingKey =
  (typeof publicAttributionTrackingKeys)[number];

export const publicAttributionBackupParamMap = {
  lh_source: "utm_source",
  lh_medium: "utm_medium",
  lh_campaign: "utm_campaign",
  lh_content: "utm_content",
  lh_term: "utm_term",
  lh_campaign_id: "campaign_id",
  lh_adset_id: "adset_id",
  lh_ad_id: "ad_id",
  lh_placement: "placement",
  lh_channel: "utm_source",
  lh_brand: "brand",
} as const;

export const publicAttributionBackupParamKeys = Object.keys(
  publicAttributionBackupParamMap
) as Array<keyof typeof publicAttributionBackupParamMap>;

export const publicAttributionParamKeys = [
  ...publicAttributionTrackingKeys,
  ...publicAttributionBackupParamKeys,
] as const;

export type PublicAttributionCookiePayload = Partial<
  Record<(typeof publicAttributionParamKeys)[number], string>
> & {
  captured_at: string;
  source_capture_method:
    | "proxy_public_lp_first_touch"
    | "server_inline_bootstrap_first_touch"
    | "public_landing_page_locked_first_touch";
  attribution_source_used?: string;
  current_page_url: string;
  landing_page_url: string;
  page_path: string;
};

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function normalizePublicAttributionFields<
  T extends Record<string, unknown>,
>(value: T | null | undefined) {
  const normalized: Record<string, unknown> = { ...(value || {}) };

  publicAttributionBackupParamKeys.forEach((backupKey) => {
    const canonicalKey = publicAttributionBackupParamMap[backupKey];
    const backupValue = stringValue(normalized[backupKey]);
    if (!backupValue) return;

    if (!stringValue(normalized[canonicalKey])) {
      normalized[canonicalKey] = backupValue;
    }
  });

  if (!stringValue(normalized.meta_campaign_id)) {
    normalized.meta_campaign_id =
      stringValue(normalized.campaign_id) ||
      stringValue(normalized.lh_campaign_id) ||
      normalized.meta_campaign_id;
  }
  if (!stringValue(normalized.meta_adset_id)) {
    normalized.meta_adset_id =
      stringValue(normalized.adset_id) ||
      stringValue(normalized.lh_adset_id) ||
      normalized.meta_adset_id;
  }
  if (!stringValue(normalized.meta_ad_id)) {
    normalized.meta_ad_id =
      stringValue(normalized.ad_id) ||
      stringValue(normalized.lh_ad_id) ||
      normalized.meta_ad_id;
  }

  return normalized as T & Record<string, unknown>;
}

export function hasPublicAttributionTracking(
  value: object | null | undefined
) {
  if (!value) return false;
  const record = normalizePublicAttributionFields(
    value as Record<string, unknown>
  );

  return publicAttributionTrackingKeys.some((key) =>
    Boolean(stringValue(record[key]))
  );
}

export function isDebugOnlyUrl(value: string | null | undefined) {
  if (!value) return false;

  try {
    const parsed = new URL(value);
    if (parsed.searchParams.size === 0) return false;

    return Array.from(parsed.searchParams.keys()).every((key) =>
      ["attribution_debug", "pixel_debug", "v"].includes(key)
    );
  } catch {
    return false;
  }
}

export function chooseBestPublicAttribution<T extends object>(
  candidates: Array<T | null | undefined>
) {
  return (
    candidates.find((candidate) => hasPublicAttributionTracking(candidate)) ??
    null
  );
}

export function createPublicAttributionCookiePayload(
  url: URL,
  capturedAt = new Date().toISOString()
): PublicAttributionCookiePayload | null {
  const tracking: Partial<Record<(typeof publicAttributionParamKeys)[number], string>> =
    {};

  publicAttributionParamKeys.forEach((key) => {
    const value = url.searchParams.get(key);
    if (value) tracking[key] = value;
  });

  const normalizedTracking = normalizePublicAttributionFields(tracking);

  if (!hasPublicAttributionTracking(normalizedTracking)) return null;

  const fullUrl = url.toString();

  return {
    captured_at: capturedAt,
    source_capture_method: "proxy_public_lp_first_touch",
    current_page_url: fullUrl,
    landing_page_url: fullUrl,
    page_path: url.pathname,
    ...normalizedTracking,
  };
}

export function encodePublicAttributionCookie(
  payload: PublicAttributionCookiePayload
) {
  return encodeURIComponent(JSON.stringify(payload));
}

export function decodePublicAttributionCookie(
  value: string | null | undefined
): PublicAttributionCookiePayload | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<
      PublicAttributionCookiePayload
    >;

    if (!isValidPublicAttributionCookiePayload(parsed)) {
      return null;
    }

    return {
      captured_at: stringValue(parsed.captured_at) || new Date().toISOString(),
      source_capture_method: parsed.source_capture_method,
      attribution_source_used: stringValue(parsed.attribution_source_used) || undefined,
      current_page_url: stringValue(parsed.current_page_url) || "",
      landing_page_url: stringValue(parsed.landing_page_url) || "",
      page_path: stringValue(parsed.page_path) || "",
      ...Object.fromEntries(
        publicAttributionParamKeys
          .map((key) => [key, stringValue(parsed[key])] as const)
          .filter(([, item]) => Boolean(item))
      ),
    } as PublicAttributionCookiePayload;
  } catch {
    return null;
  }
}

function isValidPublicAttributionCookiePayload(
  parsed: Partial<PublicAttributionCookiePayload>
): parsed is PublicAttributionCookiePayload {
  return Boolean(
    (parsed.source_capture_method === "proxy_public_lp_first_touch" ||
      parsed.source_capture_method === "server_inline_bootstrap_first_touch" ||
      parsed.source_capture_method === "public_landing_page_locked_first_touch") &&
      stringValue(parsed.current_page_url) &&
      stringValue(parsed.landing_page_url) &&
      hasPublicAttributionTracking(parsed)
  );
}
