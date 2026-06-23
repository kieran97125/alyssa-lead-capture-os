export const PUBLIC_ATTRIBUTION_COOKIE_NAME = "launchhub_public_attribution";
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

export type PublicAttributionCookiePayload = Partial<
  Record<PublicAttributionTrackingKey, string>
> & {
  captured_at: string;
  source_capture_method: "proxy_public_lp_first_touch";
  current_page_url: string;
  landing_page_url: string;
  page_path: string;
};

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function hasPublicAttributionTracking(
  value: object | null | undefined
) {
  if (!value) return false;
  const record = value as Record<string, unknown>;

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
  const tracking: Partial<Record<PublicAttributionTrackingKey, string>> = {};

  publicAttributionTrackingKeys.forEach((key) => {
    const value = url.searchParams.get(key);
    if (value) tracking[key] = value;
  });

  if (!hasPublicAttributionTracking(tracking)) return null;

  const fullUrl = url.toString();

  return {
    captured_at: capturedAt,
    source_capture_method: "proxy_public_lp_first_touch",
    current_page_url: fullUrl,
    landing_page_url: fullUrl,
    page_path: url.pathname,
    ...tracking,
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

    if (
      parsed.source_capture_method !== "proxy_public_lp_first_touch" ||
      !stringValue(parsed.current_page_url) ||
      !stringValue(parsed.landing_page_url) ||
      !hasPublicAttributionTracking(parsed)
    ) {
      return null;
    }

    return {
      captured_at: stringValue(parsed.captured_at) || new Date().toISOString(),
      source_capture_method: "proxy_public_lp_first_touch",
      current_page_url: stringValue(parsed.current_page_url) || "",
      landing_page_url: stringValue(parsed.landing_page_url) || "",
      page_path: stringValue(parsed.page_path) || "",
      ...Object.fromEntries(
        publicAttributionTrackingKeys
          .map((key) => [key, stringValue(parsed[key])] as const)
          .filter(([, item]) => Boolean(item))
      ),
    } as PublicAttributionCookiePayload;
  } catch {
    return null;
  }
}
