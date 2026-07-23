"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  publicThemeStyle,
  resolvePublicBrandTheme,
} from "@/lib/brandThemes";
import {
  LOCKED_PUBLIC_ATTRIBUTION_STORAGE_KEY,
  PUBLIC_ATTRIBUTION_COOKIE_NAME,
  chooseBestPublicAttribution,
  decodePublicAttributionCookie,
  hasPublicAttributionTracking,
  normalizePublicAttributionFields,
  publicAttributionParamKeys,
} from "@/lib/attribution/publicAttributionCookie";
import {
  alyssaBranches,
  alyssaDefaultForm,
  alyssaPackages,
  alyssaTreatments,
} from "@/lib/data/alyssaConfig";
import {
  IMAGE_REFERENCE_FOOTER_NOTE,
  getBrandLegalProfile,
  getLegalFooterLinks,
  getLegalFooterText,
  LEGAL_CONSENT_HELPER_TEXT,
  LEGAL_CONSENT_REQUIRED_MESSAGE,
  LEGAL_CONSENT_TEXT,
} from "@/lib/legal/consent";
import {
  getConfiguredMetaPixelIdForBrand,
  isMetaPixelDebugEnabled,
  sendMetaPixelBeacon,
} from "@/lib/metaPixel/client";

type AttributionEnvelope = {
  first_touch_json?: Record<string, unknown>;
  latest_touch_json?: Record<string, unknown>;
  submitted_touch_json?: Record<string, unknown>;
  server_touch_json?: Record<string, unknown>;
  locked_touch_json?: Record<string, unknown>;
  locked_session_touch_json?: Record<string, unknown>;
  locked_local_touch_json?: Record<string, unknown>;
};

type SubmitState = "idle" | "loading" | "success" | "error";
type ConfigStatus = "loading" | "ready" | "error";
type ConversionMode = "form_submit_pixel" | "thank_you_redirect";

type AttributionDebugResponse = {
  attribution_debug: true;
  inline_bootstrap_present: boolean;
  inline_bootstrap_has_tracking: boolean;
  locked_session_present: boolean;
  locked_session_has_tracking: boolean;
  locked_local_present: boolean;
  locked_local_has_tracking: boolean;
  server_body_present: boolean;
  server_body_has_tracking: boolean;
  locked_body_present: boolean;
  locked_body_has_tracking: boolean;
  proxy_cookie_present: boolean;
  proxy_cookie_parse_ok: boolean;
  body_has_tracking: boolean;
  preserved_body_has_tracking: boolean;
  proxy_cookie_has_tracking: boolean;
  downgrade_blocked: boolean;
  final_attribution_source_used:
    | "body"
    | "inline_bootstrap"
    | "locked_attribution"
    | "preserved_body"
    | "server_initial"
    | "proxy_cookie"
    | "direct";
  final_utm_source: string;
  final_utm_medium: string;
  final_utm_campaign: string;
  final_utm_content: string;
  final_campaign_id: string;
  final_adset_id: string;
  final_ad_id: string;
  final_placement: string;
  final_meta_campaign_id: string;
  final_meta_adset_id: string;
  final_meta_ad_id: string;
  final_fbclid: string;
  final_current_page_url: string;
  final_landing_page_url: string;
  final_tracking_status: string;
  final_audit_reason: string;
};

type FormOption = {
  id: string;
  name: string;
};

type TreatmentOption = FormOption & {
  description: string;
};

type PackageOption = FormOption & {
  treatmentId: string;
  promoPrice: number;
  paymentRequired: boolean;
};

type BranchOption = FormOption & {
  isDefault: boolean;
};

type BrandOption = FormOption & {
  slug: string;
  legalPageUrl?: string | null;
  legalLinkLabel?: string | null;
  privacyUrl?: string | null;
  disclaimerUrl?: string | null;
  operatorName?: string | null;
};

type PublicFormConfig = {
  id: string;
  publicFormToken: string;
  defaultTreatmentId: string;
  defaultPackageId: string;
  defaultBranchId: string;
  allowedDomains: string[];
  successRedirectUrl?: string | null;
  conversionMode?: ConversionMode | null;
};

type PublicLeadFormProps = {
  formToken: string;
  formId?: string;
  brandSlug?: string;
  initialQueryString?: string;
  serverInitialAttribution?: Record<string, unknown> | null;
  expectedParentOrigin?: string;
  mode?: "inline" | "embed";
  conversionMode?: ConversionMode;
  successRedirectUrl?: string;
  className?: string;
};

const ATTRIBUTION_KEYS = [...publicAttributionParamKeys, "utm_id"] as const;
const THANK_YOU_REDIRECT_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "campaign_id",
  "adset_id",
  "ad_id",
  "placement",
  "lh_source",
  "lh_medium",
  "lh_campaign",
  "lh_content",
  "lh_term",
  "lh_campaign_id",
  "lh_adset_id",
  "lh_ad_id",
  "lh_placement",
] as const;

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeConversionMode(value: unknown): ConversionMode {
  return value === "thank_you_redirect"
    ? "thank_you_redirect"
    : "form_submit_pixel";
}

function getNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function getAttributionDebugResponse(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<AttributionDebugResponse>;
  return item.attribution_debug === true
    ? (item as AttributionDebugResponse)
    : null;
}

function normalizeOrigin(value: string | null | undefined) {
  if (!value) return null;
  const cleaned = value.trim();

  if (!cleaned) return null;

  try {
    return new URL(cleaned).origin.toLowerCase();
  } catch {
    try {
      return new URL(`https://${cleaned}`).origin.toLowerCase();
    } catch {
      return null;
    }
  }
}

function getAllowedRedirectOrigins(brandSlug: string | null | undefined) {
  const slug = (brandSlug || "").trim().toLowerCase();
  const origins = new Set<string>();

  if (slug === "alyssa" || slug.startsWith("alyssa-")) {
    origins.add("https://www.alyssa.hk");
    origins.add("https://alyssa.hk");
  }

  if (slug === "ineffable" || slug === "ineffable-beauty") {
    origins.add("https://www.ineffablebeautyhk.com");
    origins.add("https://ineffablebeautyhk.com");
  }

  return origins;
}

function sanitizeSuccessRedirectUrl(
  value: string | null | undefined,
  brandSlug: string | null | undefined
) {
  const cleaned = (value || "").trim();
  if (!cleaned) return null;

  try {
    const url = new URL(cleaned);
    if (url.protocol !== "https:") return null;
    if (!getAllowedRedirectOrigins(brandSlug).has(url.origin)) return null;
    const slug = (brandSlug || "").trim().toLowerCase();
    const path = url.pathname.replace(/\/+$/, "");
    const allowedPath =
      slug === "alyssa" || slug.startsWith("alyssa-")
        ? path === "/thankyou"
        : path === "/thank-you";
    if (!allowedPath) return null;
    return url;
  } catch {
    return null;
  }
}

function isAllowedParentOrigin(
  candidateOrigin: string | null | undefined,
  allowedDomains: string[]
) {
  const candidate = normalizeOrigin(candidateOrigin);
  if (!candidate) return false;

  const allowedOrigins = allowedDomains
    .map(normalizeOrigin)
    .filter((item): item is string => Boolean(item));

  if (allowedOrigins.includes(candidate)) return true;

  try {
    const candidateUrl = new URL(candidate);
    return allowedDomains.some((domain) => {
      const cleaned = domain.trim().toLowerCase();
      return (
        (cleaned === "localhost" || cleaned === "127.0.0.1") &&
        candidateUrl.hostname === cleaned
      );
    });
  } catch {
    return false;
  }
}

function safeJsonParse(value: string | null) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2)}`;
}

function readStorage(key: string, storage: Storage) {
  try {
    return safeJsonParse(storage.getItem(key));
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: unknown, storage: Storage) {
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function pickParams(searchParams: URLSearchParams) {
  const output: Record<string, string> = {};
  ATTRIBUTION_KEYS.forEach((key) => {
    const value = searchParams.get(key);
    if (value) output[key] = value;
  });
  return normalizePublicAttributionFields(output);
}

function normalizeQueryString(value: string) {
  const cleaned = value.trim();
  if (!cleaned) return "";
  return cleaned.startsWith("?") ? cleaned : `?${cleaned}`;
}

function createUrlFromSearch(search: string) {
  return `${window.location.origin}${window.location.pathname}${search}${window.location.hash}`;
}

function getLandingPageSlugFromUrl(value: string) {
  try {
    const pathParts = new URL(value).pathname.split("/").filter(Boolean);
    return pathParts[0] === "lp" && pathParts[1] ? pathParts[1] : "";
  } catch {
    return "";
  }
}

function readCookie(name: string) {
  const prefix = `${name}=`;
  return (
    document.cookie
      .split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith(prefix))
      ?.slice(prefix.length) ?? null
  );
}

function readMetaBrowserCookie(name: "_fbp" | "_fbc") {
  const value = readCookie(name);
  try {
    return value ? decodeURIComponent(value) : "";
  } catch {
    return value || "";
  }
}

function readProxyAttributionCookie() {
  return decodePublicAttributionCookie(
    readCookie(PUBLIC_ATTRIBUTION_COOKIE_NAME)
  );
}

function getServerInitialAttribution(
  value: Record<string, unknown> | null | undefined
) {
  const normalized = normalizePublicAttributionFields(value);
  return normalized && hasPublicAttributionTracking(normalized)
    ? normalized
    : null;
}

function getTrackingTouch(value: unknown) {
  const normalized =
    value && typeof value === "object"
      ? normalizePublicAttributionFields(value as Record<string, unknown>)
      : null;
  return normalized && hasPublicAttributionTracking(normalized)
    ? normalized
    : null;
}

function readLockedAttribution() {
  if (typeof window === "undefined") return null;

  return chooseBestPublicAttribution([
    getTrackingTouch(
      readStorage(LOCKED_PUBLIC_ATTRIBUTION_STORAGE_KEY, window.sessionStorage)
    ),
    getTrackingTouch(
      readStorage(LOCKED_PUBLIC_ATTRIBUTION_STORAGE_KEY, window.localStorage)
    ),
  ]);
}

function readLockedAttributionDetails() {
  if (typeof window === "undefined") {
    return {
      session: null,
      local: null,
      selected: null,
    };
  }

  const session = getTrackingTouch(
    readStorage(LOCKED_PUBLIC_ATTRIBUTION_STORAGE_KEY, window.sessionStorage)
  );
  const local = getTrackingTouch(
    readStorage(LOCKED_PUBLIC_ATTRIBUTION_STORAGE_KEY, window.localStorage)
  );

  return {
    session,
    local,
    selected: chooseBestPublicAttribution([session, local]),
  };
}

function pickTouchParams(value: Record<string, unknown>) {
  const output: Record<string, string> = {};
  ATTRIBUTION_KEYS.forEach((key) => {
    const item = value[key];
    if (typeof item === "string" && item.trim()) output[key] = item.trim();
  });
  return normalizePublicAttributionFields(output);
}

function getEffectiveAttributionUrl(
  initialQueryString = "",
  serverInitialAttribution?: Record<string, unknown> | null
) {
  const liveParams = new URLSearchParams(window.location.search);
  const livePayload = pickParams(liveParams);

  if (Object.keys(livePayload).length > 0) {
    return {
      href: window.location.href,
      search: window.location.search,
      sourceUsed: "live",
    };
  }

  const lockedAttribution = readLockedAttribution();

  if (lockedAttribution) {
    const lockedUrl =
      getString(lockedAttribution.current_page_url) ||
      getString(lockedAttribution.landing_page_url);

    try {
      const parsed = new URL(lockedUrl);

      return {
        href: lockedUrl,
        search: parsed.search,
        sourceUsed: "locked_attribution",
      };
    } catch {
      return {
        href: lockedUrl,
        search: "",
        sourceUsed: "locked_attribution",
      };
    }
  }

  const serverAttribution = getServerInitialAttribution(serverInitialAttribution);

  if (serverAttribution) {
    const serverUrl = getString(serverAttribution.current_page_url);

    try {
      const parsed = new URL(serverUrl);

      return {
        href: serverUrl,
        search: parsed.search,
        sourceUsed: "server_initial",
      };
    } catch {
      return {
        href: serverUrl,
        search: "",
        sourceUsed: "server_initial",
      };
    }
  }

  const initialSearch = normalizeQueryString(initialQueryString);
  const initialPayload = pickParams(new URLSearchParams(initialSearch));

  if (Object.keys(initialPayload).length > 0) {
    return {
      href: createUrlFromSearch(initialSearch),
      search: initialSearch,
      sourceUsed: "initialSearch",
    };
  }

  const proxyCookie = readProxyAttributionCookie();

  if (proxyCookie && hasPublicAttributionTracking(proxyCookie)) {
    try {
      const proxyUrl = new URL(proxyCookie.current_page_url);

      return {
        href: proxyCookie.current_page_url,
        search: proxyUrl.search,
        sourceUsed: "proxy_cookie",
      };
    } catch {
      return {
        href: proxyCookie.current_page_url,
        search: "",
        sourceUsed: "proxy_cookie",
      };
    }
  }

  return {
    href: window.location.href,
    search: window.location.search,
    sourceUsed: "storage",
  };
}

function classifyTracking(payload: Record<string, unknown>) {
  const utmCount = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_id",
    "utm_content",
    "utm_term",
  ].filter((key) => payload[key]).length;
  const hasClickId = Boolean(
    payload.fbclid ||
      payload.gclid ||
      payload.ttclid ||
      payload.msclkid ||
      payload.wbraid ||
      payload.gbraid
  );
  const normalizedPayload = normalizePublicAttributionFields(payload);
  const hasMetaIds = Boolean(
    normalizedPayload.meta_campaign_id ||
      normalizedPayload.meta_adset_id ||
      normalizedPayload.meta_ad_id
  );

  if (utmCount >= 3) {
    return {
      tracking_status: "complete_utm",
      audit_reason: "utm_found_on_parent_url",
    };
  }

  if (utmCount > 0) {
    return {
      tracking_status: "partial_utm",
      audit_reason: "iframe_received_parent_payload",
    };
  }

  if (hasClickId || hasMetaIds) {
    return {
      tracking_status: "click_id_only",
      audit_reason: "fbclid_found_without_utm",
    };
  }

  return {
    tracking_status: "organic_unknown",
    audit_reason: "no_url_params_no_storage",
  };
}

function captureCurrentPageAttribution({
  formToken,
  formId,
  brandSlug,
  initialQueryString = "",
  serverInitialAttribution,
}: {
  formToken: string;
  formId: string;
  brandSlug: string;
  initialQueryString?: string;
  serverInitialAttribution?: Record<string, unknown> | null;
}): AttributionEnvelope {
  const localKey = "alyssa_first_touch";
  const sessionKey = "alyssa_latest_touch";
  const serverTouch = getServerInitialAttribution(serverInitialAttribution);
  const lockedDetails = readLockedAttributionDetails();
  const lockedTouch = lockedDetails.selected;
  const effectiveUrl = getEffectiveAttributionUrl(
    initialQueryString,
    serverInitialAttribution
  );
  const searchParams = new URLSearchParams(effectiveUrl.search);
  const parentOriginParam = normalizeOrigin(searchParams.get("parent_origin"));
  const parentUrlParam = searchParams.get("parent_url") || "";
  let parentPath = window.location.pathname;

  if (parentUrlParam) {
    try {
      parentPath = new URL(parentUrlParam).pathname;
    } catch {
      parentPath = window.location.pathname;
    }
  }

  const visitorId =
    readStorage("alyssa_visitor_id", window.localStorage) || createId("vis");
  const sessionId =
    readStorage("alyssa_session_id", window.sessionStorage) || createId("ses");
  const paramPayload =
    effectiveUrl.sourceUsed === "locked_attribution" && lockedTouch
      ? pickTouchParams(lockedTouch)
      : effectiveUrl.sourceUsed === "server_initial" && serverTouch
      ? pickTouchParams(serverTouch)
      : pickParams(searchParams);
  const fbpCookie = readMetaBrowserCookie("_fbp");
  const fbcCookie = readMetaBrowserCookie("_fbc");
  if (!paramPayload.fbp && fbpCookie) paramPayload.fbp = fbpCookie;
  if (!paramPayload.fbc && fbcCookie) paramPayload.fbc = fbcCookie;
  const firstStored = readStorage(localKey, window.localStorage);
  const latestStored = readStorage(sessionKey, window.sessionStorage);
  const firstTrackingStored = getTrackingTouch(firstStored);
  const latestTrackingStored = getTrackingTouch(latestStored);
  const hasCurrentParams = Object.keys(paramPayload).length > 0;
  const selectedTrackingTouch = chooseBestPublicAttribution([
    effectiveUrl.sourceUsed === "live"
      ? {
          current_page_url: effectiveUrl.href,
          landing_page_url: effectiveUrl.href,
          ...paramPayload,
        }
      : null,
    lockedTouch,
    serverTouch,
    latestTrackingStored,
    firstTrackingStored,
  ]);
  const authoritativeTrackingTouch =
    getTrackingTouch(selectedTrackingTouch) || null;
  const sourceCaptureMethod =
    effectiveUrl.sourceUsed === "locked_attribution"
      ? "public_landing_page_locked_first_touch"
      : effectiveUrl.sourceUsed === "server_initial"
      ? "server_public_lp_initial_search"
      : hasCurrentParams
        ? "public_landing_page"
        : latestStored
          ? "public_landing_page_session_storage_recovered"
          : firstStored
            ? "public_landing_page_local_storage_recovered"
            : "public_landing_page_no_tracking_signal";
  const recoveredCurrentPageUrl =
    getString(authoritativeTrackingTouch?.current_page_url) ||
    getString(latestStored?.current_page_url) ||
    getString(firstStored?.current_page_url);
  const recoveredLandingPageUrl =
    getString(authoritativeTrackingTouch?.landing_page_url) ||
    getString(firstStored?.landing_page_url) ||
    getString(latestStored?.landing_page_url);
  const livePageUrl = parentUrlParam || effectiveUrl.href;
  const currentPageUrl = hasCurrentParams
    ? livePageUrl
    : recoveredCurrentPageUrl || livePageUrl;
  const landingPageUrl = hasCurrentParams
    ? livePageUrl
    : recoveredLandingPageUrl || livePageUrl;
  const basePayload = {
    source_capture_method: sourceCaptureMethod,
    visitor_id: visitorId,
    session_id: sessionId,
    brand: brandSlug,
    form_id: formId,
    form_token: formToken,
    parent_origin: parentOriginParam || window.location.origin,
    parent_url: parentUrlParam || "",
    referrer: document.referrer || "",
    landing_page_url: landingPageUrl,
    current_page_url: currentPageUrl,
    page_url: currentPageUrl,
    landing_page_slug: getLandingPageSlugFromUrl(currentPageUrl),
    page_path: parentPath,
    page_title: document.title || "",
    preserved_initial_full_url: effectiveUrl.href,
    preserved_initial_search: initialQueryString,
    attribution_source_used: effectiveUrl.sourceUsed,
    client_event_id: createId("lh_evt"),
    captured_at: new Date().toISOString(),
  };
  const latestTouch = {
    ...(latestStored || {}),
    ...basePayload,
    ...(authoritativeTrackingTouch || {}),
    ...paramPayload,
    source_capture_method: sourceCaptureMethod,
  };
  const firstTouch = hasCurrentParams
    ? { ...basePayload, ...paramPayload }
    : firstTrackingStored ||
      authoritativeTrackingTouch ||
      firstStored || { ...basePayload, ...paramPayload };
  if (!lockedTouch && hasPublicAttributionTracking(latestTouch)) {
    writeStorage(
      LOCKED_PUBLIC_ATTRIBUTION_STORAGE_KEY,
      {
        ...latestTouch,
        attribution_source_used: "locked_attribution",
      },
      window.sessionStorage
    );
    writeStorage(
      LOCKED_PUBLIC_ATTRIBUTION_STORAGE_KEY,
      {
        ...latestTouch,
        attribution_source_used: "locked_attribution",
      },
      window.localStorage
    );
  }
  const localSaved = writeStorage(localKey, firstTouch, window.localStorage);
  const sessionSaved = writeStorage(sessionKey, latestTouch, window.sessionStorage);
  writeStorage("alyssa_visitor_id", visitorId, window.localStorage);
  writeStorage("alyssa_session_id", sessionId, window.sessionStorage);
  const tracking = classifyTracking(latestTouch);
  const submittedTouch = {
    ...latestTouch,
    storage_status:
      localSaved && sessionSaved
        ? "storage_available"
        : localSaved
          ? "session_storage_blocked"
          : sessionSaved
            ? "local_storage_blocked"
            : "storage_blocked",
    ...tracking,
  };

  return {
    first_touch_json: firstTouch,
    latest_touch_json: latestTouch,
    submitted_touch_json: submittedTouch,
    server_touch_json:
      authoritativeTrackingTouch || serverTouch || undefined,
    locked_touch_json: lockedTouch || undefined,
    locked_session_touch_json: lockedDetails.session || undefined,
    locked_local_touch_json: lockedDetails.local || undefined,
  };
}

function normalizeForm(raw: Record<string, unknown>): PublicFormConfig {
  const allowedDomains = raw.allowedDomains ?? raw.allowed_domains;

  return {
    id: getString(raw.id) || alyssaDefaultForm.id,
    publicFormToken:
      getString(raw.publicFormToken) || getString(raw.public_form_token),
    defaultTreatmentId:
      getString(raw.defaultTreatmentId) ||
      getString(raw.default_treatment_id) ||
      alyssaDefaultForm.defaultTreatmentId,
    defaultPackageId:
      getString(raw.defaultPackageId) ||
      getString(raw.default_package_id) ||
      alyssaDefaultForm.defaultPackageId,
    defaultBranchId:
      getString(raw.defaultBranchId) ||
      getString(raw.default_branch_id) ||
      alyssaDefaultForm.defaultBranchId,
    successRedirectUrl:
      getString(raw.successRedirectUrl) ||
      getString(raw.success_redirect_url) ||
      null,
    conversionMode: normalizeConversionMode(
      raw.conversionMode ?? raw.conversion_mode
    ),
    allowedDomains: Array.isArray(allowedDomains)
      ? allowedDomains.filter((item): item is string => typeof item === "string")
      : [],
  };
}

function normalizeTreatment(raw: Record<string, unknown>): TreatmentOption {
  return {
    id: getString(raw.id),
    name: getString(raw.name),
    description: getString(raw.description),
  };
}

function normalizePackage(raw: Record<string, unknown>): PackageOption {
  return {
    id: getString(raw.id),
    name: getString(raw.name),
    treatmentId: getString(raw.treatmentId) || getString(raw.treatment_id),
    promoPrice: getNumber(raw.promoPrice ?? raw.promo_price),
    paymentRequired: Boolean(raw.paymentRequired ?? raw.payment_required),
  };
}

function normalizeBranch(raw: Record<string, unknown>): BranchOption {
  return {
    id: getString(raw.id),
    name: getString(raw.name),
    isDefault: Boolean(raw.isDefault ?? raw.is_default),
  };
}

function resolveDefaultBranchId(
  form: PublicFormConfig,
  branchOptions: BranchOption[]
) {
  if (branchOptions.length === 1) return branchOptions[0].id;

  return (
    branchOptions.find((item) => item.isDefault)?.id ||
    (branchOptions.some((item) => item.id === form.defaultBranchId)
      ? form.defaultBranchId
      : "")
  );
}

function normalizeBrand(raw: Record<string, unknown>): BrandOption {
  return {
    id: getString(raw.id),
    name: getString(raw.name) || "Alyssa",
    slug: getString(raw.slug) || "alyssa",
    legalPageUrl: getString(raw.legalPageUrl) || getString(raw.legal_page_url) || null,
    legalLinkLabel:
      getString(raw.legalLinkLabel) || getString(raw.legal_link_label) || null,
    privacyUrl: getString(raw.privacyUrl) || getString(raw.privacy_url) || null,
    disclaimerUrl:
      getString(raw.disclaimerUrl) || getString(raw.disclaimer_url) || null,
    operatorName: getString(raw.operatorName) || getString(raw.operator_name) || null,
  };
}

function getBrandDisplayOverride(brandSlug?: string | null): BrandOption | null {
  if (brandSlug === "ineffable" || brandSlug === "ineffable-beauty") {
    return {
      id: "ineffable-brand-display",
      name: "Ineffable Beauty",
      slug: "ineffable",
    };
  }

  return null;
}

function normalizeBrandSlugForMatch(value?: string | null) {
  const cleaned = (value || "").trim().toLowerCase();
  return cleaned === "ineffable-beauty" ? "ineffable" : cleaned;
}

function isCompatibleBrandSlug(
  requestedBrandSlug?: string | null,
  actualBrandSlug?: string | null
) {
  const requested = normalizeBrandSlugForMatch(requestedBrandSlug);
  const actual = normalizeBrandSlugForMatch(actualBrandSlug);
  if (!requested || !actual) return true;
  return requested === actual;
}

function isDisplayPackage(item: PackageOption) {
  return item.paymentRequired || item.promoPrice > 0;
}

function getPrimaryPackage(
  form: PublicFormConfig,
  packageOptions: PackageOption[]
) {
  const defaultPackage = packageOptions.find(
    (item) => item.id === form.defaultPackageId
  );

  if (defaultPackage) return defaultPackage;

  return packageOptions.find(isDisplayPackage) || packageOptions[0];
}

async function logPublicEvent(
  eventType: string,
  payload: Record<string, unknown>,
  attribution?: AttributionEnvelope
) {
  const submittedTouch = attribution?.submitted_touch_json ?? {};

  await fetch("/api/public/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event_type: eventType,
      visitor_id: getString(submittedTouch.visitor_id),
      session_id: getString(submittedTouch.session_id),
      event_payload_json: payload,
      page_url: typeof window !== "undefined" ? window.location.href : undefined,
      referrer: typeof document !== "undefined" ? document.referrer : undefined,
    }),
  }).catch(() => undefined);
}

function priceLabel(item: PackageOption | undefined) {
  if (!item) return "";
  return item.promoPrice > 0 ? `HK$${item.promoPrice}` : "預約查詢";
}

function formatSelectedDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return "";

  return `${match[1]}年${Number(match[2])}月${Number(match[3])}日`;
}

export function PublicLeadForm({
  formToken,
  formId,
  brandSlug,
  initialQueryString = "",
  serverInitialAttribution,
  expectedParentOrigin,
  mode = "inline",
  conversionMode,
  successRedirectUrl,
  className = "",
}: PublicLeadFormProps) {
  const conversionEventSentRef = useRef(false);
  const [attribution, setAttribution] = useState<AttributionEnvelope>({});
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");
  const [redirectFallbackUrl, setRedirectFallbackUrl] = useState("");
  const [configMessage, setConfigMessage] = useState("");
  const [configStatus, setConfigStatus] = useState<ConfigStatus>("loading");
  const [formStarted, setFormStarted] = useState(false);
  const [attributionDebug, setAttributionDebug] =
    useState<AttributionDebugResponse | null>(null);
  const [publicForm, setPublicForm] = useState<PublicFormConfig>(() =>
    normalizeForm(alyssaDefaultForm)
  );
  const [treatments, setTreatments] = useState<TreatmentOption[]>(() =>
    alyssaTreatments.map(normalizeTreatment)
  );
  const [packages, setPackages] = useState<PackageOption[]>(() =>
    alyssaPackages.map(normalizePackage)
  );
  const [branches, setBranches] = useState<BranchOption[]>(() =>
    alyssaBranches.map(normalizeBranch)
  );
  const [brand, setBrand] = useState<BrandOption>(() =>
    getBrandDisplayOverride(brandSlug) ??
    normalizeBrand({ id: "alyssa-brand-seed", name: "Alyssa", slug: "alyssa" })
  );
  const [formData, setFormData] = useState({
    honeypot: "",
    customer_name: "",
    phone: "",
    email: "",
    treatment_id: alyssaDefaultForm.defaultTreatmentId,
    package_id: alyssaDefaultForm.defaultPackageId,
    branch_id: alyssaDefaultForm.defaultBranchId,
    appointment_date: "",
    appointment_time: "12:00",
    payment_option: "booking_only",
    legalConsentAccepted: false,
  });

  const selectedTreatment = useMemo(
    () =>
      treatments.find((item) => item.id === formData.treatment_id) ||
      treatments[0],
    [formData.treatment_id, treatments]
  );
  const availablePackages = useMemo(() => {
    const filtered = packages.filter(
      (item) => item.treatmentId === selectedTreatment?.id
    );
    return filtered.length > 0 ? filtered : packages;
  }, [packages, selectedTreatment?.id]);
  const selectedPackage = useMemo(
    () =>
      availablePackages.find((item) => item.id === formData.package_id) ||
      availablePackages[0],
    [availablePackages, formData.package_id]
  );
  const legalProfile = useMemo(() => {
    const resolvedSlug = brand.slug || brandSlug || "alyssa";

    return getBrandLegalProfile({
      brandSlug: resolvedSlug,
      brandName: brand.name || resolvedSlug,
      legalPageUrl: brand.legalPageUrl,
      legalLinkLabel: brand.legalLinkLabel,
      privacyUrl: brand.privacyUrl,
      disclaimerUrl: brand.disclaimerUrl,
      operatorName: brand.operatorName,
    });
  }, [
    brand.disclaimerUrl,
    brand.legalLinkLabel,
    brand.legalPageUrl,
    brand.name,
    brand.operatorName,
    brand.privacyUrl,
    brand.slug,
    brandSlug,
  ]);
  const publicTheme = useMemo(
    () =>
      resolvePublicBrandTheme({
        brandSlug: brand.slug || brandSlug,
        brandName: brand.name,
      }),
    [brand.name, brand.slug, brandSlug]
  );
  const themeStyle = useMemo(
    () => publicThemeStyle(publicTheme) as CSSProperties,
    [publicTheme]
  );
  const isCompactPublicForm = publicTheme.formLayout === "compact";
  const isEmbed = mode === "embed";
  const effectiveConversionMode =
    conversionMode ?? publicForm.conversionMode ?? "form_submit_pixel";
  const effectiveSuccessRedirectUrl =
    successRedirectUrl || publicForm.successRedirectUrl || "";

  function buildThankYouRedirectUrl({
    leadId,
    eventId,
    eventAttribution,
    successRedirectUrl,
  }: {
    leadId: string;
    eventId: string;
    eventAttribution: AttributionEnvelope;
    successRedirectUrl?: string | null;
  }) {
    const baseUrl = sanitizeSuccessRedirectUrl(
      successRedirectUrl || effectiveSuccessRedirectUrl,
      brand.slug || brandSlug
    );
    if (!baseUrl || !leadId) return null;

    const submittedTouch = eventAttribution.submitted_touch_json ?? {};
    baseUrl.searchParams.set("submitted", "1");
    if (!baseUrl.searchParams.get("treatment")) {
      baseUrl.searchParams.set(
        "treatment",
        selectedTreatment?.id || formData.treatment_id || ""
      );
    }
    if (!baseUrl.searchParams.get("value")) {
      baseUrl.searchParams.set(
        "value",
        String(selectedPackage?.promoPrice ?? 0)
      );
    }
    baseUrl.searchParams.set("form_id", formId || publicForm.id);
    baseUrl.searchParams.set("lead_id", leadId);
    if (eventId) baseUrl.searchParams.set("event_id", eventId);

    THANK_YOU_REDIRECT_KEYS.forEach((key) => {
      const value = getString(submittedTouch[key]);
      if (value && !baseUrl.searchParams.has(key)) {
        baseUrl.searchParams.set(key, value);
      }
    });

    return baseUrl.toString();
  }

  function buildCompleteRegistrationPayload() {
    return {
      value: selectedPackage?.promoPrice ?? 0,
      currency: "HKD",
      content_name: `${brand.name || "LaunchHub"} registration`,
      content_category: "registration",
    };
  }

  function isFormPixelDebugEnabled() {
    if (isMetaPixelDebugEnabled()) return true;

    try {
      return new URLSearchParams(initialQueryString).get("pixel_debug") === "1";
    } catch {
      return false;
    }
  }

  function logSkippedConversion(reason: string) {
    if (process.env.NODE_ENV === "development" || isFormPixelDebugEnabled()) {
      console.info("[LaunchHub] CompleteRegistration skipped", { reason });
    }
  }

  function logConversionDebug(message: string, data: Record<string, unknown>) {
    if (isFormPixelDebugEnabled()) {
      console.info("[LaunchHub] CompleteRegistration", message, data);
    }
  }

  function startSuccessRedirect(
    finalRedirectUrl: string,
    eventAttribution: AttributionEnvelope
  ) {
    setRedirectFallbackUrl(finalRedirectUrl);
    void logPublicEvent(
      "form_submit_success",
      {
        conversion_mode: "thank_you_redirect",
        success_redirect_url_resolved: true,
        success_redirect_started: true,
      },
      eventAttribution
    );

    if (isEmbed && window.parent && window.parent !== window) {
      window.parent.postMessage(
        {
          type: "launchhub:success-redirect",
          source: "launchhub-form",
          formToken,
          brandSlug: brand.slug || brandSlug || "",
          redirectUrl: finalRedirectUrl,
        },
        "*"
      );
    }

    try {
      if (window.top) {
        window.top.location.href = finalRedirectUrl;
        return;
      }
    } catch {
      logConversionDebug("top redirect blocked", { finalRedirectUrl });
    }

    try {
      if (window.parent && window.parent !== window) {
        window.parent.location.href = finalRedirectUrl;
        return;
      }
    } catch {
      logConversionDebug("parent redirect blocked", { finalRedirectUrl });
    }

    try {
      window.open(finalRedirectUrl, "_top");
      return;
    } catch {
      logConversionDebug("open _top redirect blocked", { finalRedirectUrl });
    }

    try {
      window.location.href = finalRedirectUrl;
    } catch {
      logConversionDebug("window redirect blocked", { finalRedirectUrl });
    }
  }

  function handleSuccessfulRegistrationEvent(
    eventAttribution: AttributionEnvelope,
    finalRedirectUrl: string | null
  ) {
    if (conversionEventSentRef.current) return;
    conversionEventSentRef.current = true;

    if (effectiveConversionMode === "thank_you_redirect") {
      if (finalRedirectUrl) {
        startSuccessRedirect(finalRedirectUrl, eventAttribution);
      } else {
        logSkippedConversion("thank_you_redirect_missing_or_not_allowed");
      }
      return;
    }

    const payload = buildCompleteRegistrationPayload();

    if (isEmbed) {
      const targetOrigin = normalizeOrigin(expectedParentOrigin);
      const referrerOrigin = normalizeOrigin(document.referrer);

      if (
        !window.parent ||
        window.parent === window ||
        !targetOrigin ||
        !isAllowedParentOrigin(targetOrigin, publicForm.allowedDomains)
      ) {
        logSkippedConversion("parent_origin_missing_or_not_allowed");
        return;
      }

      const conversionMessage = {
        type: "launchhub:form-submitted",
        event: "CompleteRegistration",
        formToken,
        brandSlug: brand.slug || brandSlug || "",
        value: payload.value,
        currency: payload.currency,
      };
      const shouldRelayViaImmediateParent =
        Boolean(referrerOrigin && referrerOrigin !== targetOrigin) ||
        Boolean(document.referrer.includes("filesusr.com"));

      logConversionDebug("iframe mode uses parent postMessage", {
        formToken,
        brandSlug: brand.slug || brandSlug || "",
        targetOrigin,
        referrerOrigin,
        relayViaImmediateParent: shouldRelayViaImmediateParent,
      });
      window.parent.postMessage(conversionMessage, targetOrigin);

      if (shouldRelayViaImmediateParent) {
        window.parent.postMessage(conversionMessage, "*");
      }
      return;
    }

    const fbq = (window as typeof window & {
      fbq?: (...args: unknown[]) => void;
    }).fbq;

    if (typeof fbq !== "function") {
      logSkippedConversion("fbq_not_found");
    } else {
      fbq("track", "CompleteRegistration", payload);
      logConversionDebug("fbq CompleteRegistration attempted", {
        value: payload.value,
        currency: payload.currency,
        content_category: payload.content_category,
      });
    }

    const conversionPixelId = getConfiguredMetaPixelIdForBrand(
      brand.slug || brandSlug
    );

    const beaconResult = sendMetaPixelBeacon({
      pixelId: conversionPixelId,
      eventName: "CompleteRegistration",
      value: payload.value,
      currency: payload.currency,
      contentCategory: payload.content_category,
      eventKey: `complete-registration:${formToken}:${Date.now()}`,
      pageUrl: getString(
        eventAttribution.submitted_touch_json?.current_page_url
      ),
    });

    logConversionDebug("fallback CompleteRegistration beacon handled", {
      sent: beaconResult.sent,
      reason: beaconResult.reason,
      urlCreated: Boolean(beaconResult.url),
      pixelConfigured: Boolean(conversionPixelId),
    });
  }

  useEffect(() => {
    async function loadConfig() {
      setConfigStatus("loading");
      setConfigMessage("");

      try {
        const response = await fetch(
          `/api/public/forms/${encodeURIComponent(formToken)}`,
          { cache: "no-store" }
        );
        const result = await response.json();

        if (!response.ok || !result.ok) {
          setConfigStatus("error");
          setConfigMessage("表格暫時未能載入，請稍後再試。");
          setConfigMessage("這張表格暫時未能使用，請稍後再試。");
          return;
        }

        setConfigMessage("");

        const nextForm = normalizeForm(result.form ?? {});
        if (nextForm.publicFormToken && nextForm.publicFormToken !== formToken) {
          throw new Error("form_token_mismatch");
        }
        if (formId && nextForm.id && nextForm.id !== formId) {
          throw new Error("form_id_mismatch");
        }

        const apiBrand = normalizeBrand(result.brand ?? {});
        if (!isCompatibleBrandSlug(brandSlug, apiBrand.slug)) {
          throw new Error("brand_slug_mismatch");
        }
        const displayOverride = getBrandDisplayOverride(brandSlug);
        const nextBrand = displayOverride
          ? {
              ...apiBrand,
              id: displayOverride.id,
              name: displayOverride.name,
              slug: displayOverride.slug,
            }
          : apiBrand;
        const nextTreatments = (result.treatments ?? [])
          .map(normalizeTreatment)
          .filter((item: TreatmentOption) => item.id && item.name);
        const nextPackages = (result.packages ?? [])
          .map(normalizePackage)
          .filter((item: PackageOption) => item.id && item.name);
        const nextBranches = (result.branches ?? [])
          .map(normalizeBranch)
          .filter((item: BranchOption) => item.id && item.name);
        if (nextTreatments.length === 0 || nextPackages.length === 0) {
          throw new Error("form_config_incomplete");
        }

        setPublicForm(nextForm);
        setBrand(nextBrand);
        setTreatments(nextTreatments);
        setPackages(nextPackages);
        setBranches(nextBranches);

        const primaryPackage = getPrimaryPackage(nextForm, nextPackages);
        const nextPublicTheme = resolvePublicBrandTheme({
          brandSlug: nextBrand.slug,
          brandName: nextBrand.name,
        });

        setFormData((current) => ({
          ...current,
          treatment_id: primaryPackage?.treatmentId || nextForm.defaultTreatmentId,
          package_id: primaryPackage?.id || nextForm.defaultPackageId,
          branch_id: resolveDefaultBranchId(nextForm, nextBranches),
          appointment_time:
            nextPublicTheme.formLayout === "compact"
              ? ""
              : current.appointment_time,
        }));
        setConfigStatus("ready");
      } catch (error) {
        console.warn("[LaunchHub] public_form_config_load_failed", {
          formToken,
          formId,
          reason: error instanceof Error ? error.message : "unknown_error",
        });
        setConfigStatus("error");
        setConfigMessage("表格暫時未能載入，請稍後再試。");
        setConfigMessage("這張表格暫時未能讀取，請稍後再試。");
      }
    }

    void loadConfig();
  }, [brandSlug, formId, formToken]);

  useEffect(() => {
    if (configStatus !== "ready") return;

    const initialAttribution = captureCurrentPageAttribution({
      formToken,
      formId: formId || publicForm.id,
      brandSlug: brand.slug || brandSlug || "alyssa",
      initialQueryString,
      serverInitialAttribution,
    });
    queueMicrotask(() => setAttribution(initialAttribution));
    void logPublicEvent("form_view", { form_token: formToken }, initialAttribution);

    function onMessage(event: MessageEvent) {
      if (
        expectedParentOrigin &&
        normalizeOrigin(event.origin) !== normalizeOrigin(expectedParentOrigin)
      ) {
        return;
      }
      if (event.data?.type !== "alyssa_attribution_payload") return;
      const nextAttribution = event.data.payload || {};
      setAttribution(nextAttribution);
      void logPublicEvent(
        "parent_attribution_captured",
        nextAttribution,
        nextAttribution
      );
    }

    window.addEventListener("message", onMessage);

    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        { type: "alyssa_iframe_ready" },
        expectedParentOrigin || window.location.origin
      );
    }

    return () => window.removeEventListener("message", onMessage);
  }, [
    brand.slug,
    brandSlug,
    configStatus,
    expectedParentOrigin,
    formId,
    formToken,
    initialQueryString,
    serverInitialAttribution,
    publicForm.id,
  ]);

  function updateField(key: keyof typeof formData, value: string) {
    setFormData((current) => {
      if (key === "treatment_id") {
        const nextPackage =
          packages.find(
            (item) => item.treatmentId === value && isDisplayPackage(item)
          ) || packages.find((item) => item.treatmentId === value);

        return {
          ...current,
          treatment_id: value,
          package_id: nextPackage?.id || current.package_id,
        };
      }

      return { ...current, [key]: value };
    });

    if (!formStarted && key !== "honeypot") {
      setFormStarted(true);
      void logPublicEvent("form_start", { field: key }, attribution);
    }
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (configStatus !== "ready") {
      setState("error");
      setMessage("表格仍在載入，請稍候再試。");
      return;
    }

    const liveAttribution = captureCurrentPageAttribution({
      formToken,
      formId: formId || publicForm.id,
      brandSlug: brand.slug || brandSlug || "alyssa",
      initialQueryString,
      serverInitialAttribution,
    });
    queueMicrotask(() => setAttribution(liveAttribution));

    if (!formData.legalConsentAccepted) {
      setState("error");
      setMessage(LEGAL_CONSENT_REQUIRED_MESSAGE);
      await logPublicEvent(
        "form_submit_failed",
        { error: "legal_consent_missing" },
        liveAttribution
      );
      return;
    }

    if (branches.length > 1 && !formData.branch_id) {
      setState("error");
      setMessage("請先選擇分店。");
      await logPublicEvent(
        "form_submit_failed",
        { error: "branch_required" },
        liveAttribution
      );
      return;
    }

    if (!formData.appointment_date) {
      setState("error");
      setMessage("請選擇預約日期。");
      await logPublicEvent(
        "form_submit_failed",
        { error: "appointment_date_required" },
        liveAttribution
      );
      return;
    }

    if (isCompactPublicForm && !formData.appointment_time) {
      setState("error");
      setMessage("請選擇預約時間。");
      await logPublicEvent(
        "form_submit_failed",
        { error: "appointment_time_required" },
        liveAttribution
      );
      return;
    }

    setState("loading");
    setMessage("正在提交預約資料...");
    setAttributionDebug(null);
    await logPublicEvent(
      "form_submit_attempt",
      { form_token: formToken },
      liveAttribution
    );

    try {
      const resolvedFormData = {
        ...formData,
        treatment_id: selectedTreatment?.id || formData.treatment_id,
        package_id: selectedPackage?.id || formData.package_id,
      };
      const response = await fetch("/api/public/leads", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...resolvedFormData,
          form_token: formToken,
          form_id: formId || publicForm.id,
          first_touch_json: liveAttribution.first_touch_json || {},
          latest_touch_json: liveAttribution.latest_touch_json || {},
          submitted_touch_json: liveAttribution.submitted_touch_json || {},
          server_touch_json: liveAttribution.server_touch_json || {},
          locked_touch_json: liveAttribution.locked_touch_json || {},
          locked_session_touch_json:
            liveAttribution.locked_session_touch_json || {},
          locked_local_touch_json:
            liveAttribution.locked_local_touch_json || {},
        }),
      });
      const result = await response.json();
      const nextAttributionDebug = getAttributionDebugResponse(
        result.attribution_debug
      );
      setAttributionDebug(nextAttributionDebug);

      if (!response.ok || !result.ok) {
        setState("error");
        setMessage(result.message || "未能提交表格，請稍後再試。");
        await logPublicEvent(
          "form_submit_failed",
          { error: result.error || "submission_failed" },
          liveAttribution
        );
        return;
      }

      const successAttribution = nextAttributionDebug?.final_current_page_url
        ? {
            ...liveAttribution,
            submitted_touch_json: {
              ...(liveAttribution.submitted_touch_json || {}),
              current_page_url: nextAttributionDebug.final_current_page_url,
              landing_page_url:
                nextAttributionDebug.final_landing_page_url ||
                nextAttributionDebug.final_current_page_url,
            },
          }
        : liveAttribution;
      const leadId = getString(result.lead_id);
      const eventId =
        getString(result.event_id) ||
        getString(successAttribution.submitted_touch_json?.client_event_id) ||
        leadId;
      const apiFinalRedirectUrl = sanitizeSuccessRedirectUrl(
        getString(result.final_redirect_url),
        brand.slug || brandSlug
      )?.toString();
      const finalRedirectUrl =
        effectiveConversionMode === "thank_you_redirect"
          ? apiFinalRedirectUrl ||
            buildThankYouRedirectUrl({
              leadId,
              eventId,
              eventAttribution: successAttribution,
              successRedirectUrl: getString(result.success_redirect_url),
            })
          : null;

      handleSuccessfulRegistrationEvent(successAttribution, finalRedirectUrl);
      setState(
        effectiveConversionMode === "thank_you_redirect" && finalRedirectUrl
          ? "loading"
          : "success"
      );
      setMessage(
        finalRedirectUrl
          ? "已收到你的登記，正在前往確認頁。"
          : "已收到你的登記，我們會盡快透過 WhatsApp 跟進。"
      );
    } catch (error) {
      setState("error");
      setMessage("網絡暫時未能連線，請稍後再試。");
      await logPublicEvent(
        "form_submit_failed",
        { error: error instanceof Error ? error.message : "network_error" },
        liveAttribution
      );
    }
  }

  if (configStatus !== "ready") {
    return (
      <section
        data-launchhub-form-root
        className={`${className} box-border w-full max-w-full min-w-0 overflow-x-hidden ${
          isEmbed
            ? "w-full max-w-none px-2.5 py-2 sm:mx-auto sm:max-w-[min(36rem,calc(100vw-8px))] sm:px-3 sm:py-3"
            : ""
        }`}
        style={themeStyle}
      >
        <div className="box-border w-full max-w-full overflow-hidden rounded-none border-0 bg-transparent shadow-none sm:rounded-[30px] sm:border sm:border-[var(--public-border)] sm:bg-[var(--public-card)] sm:shadow-[0_24px_70px_rgba(216,91,163,0.14)]">
          <div className="p-0 sm:p-6">
            {configStatus === "loading" ? (
              <FormLoadingSkeleton />
            ) : (
              <Notice tone="warning" title="表格暫時未能載入">
                <p>表格暫時未能載入，請稍後再試。</p>
              </Notice>
            )}
          </div>
        </div>
      </section>
    );
  }

  if (isCompactPublicForm) {
    return (
      <section
        data-launchhub-form-root
        data-public-form-layout="compact"
        className={`${className} box-border w-full max-w-full min-w-0 overflow-x-hidden bg-[var(--public-bg)] px-3 py-4 text-[var(--public-text)] sm:px-5 sm:py-6 ${
          isEmbed
            ? "mx-auto max-w-[min(48rem,calc(100vw-8px))]"
            : "mx-auto max-w-3xl"
        }`}
        style={themeStyle}
      >
        <div className="relative box-border w-full max-w-full overflow-hidden rounded-[24px] border border-[var(--public-border)] bg-[var(--public-card)] px-4 py-5 shadow-[0_18px_56px_rgba(93,55,30,0.08)] sm:rounded-[30px] sm:px-8 sm:py-7">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-24 h-52 w-52 rounded-full bg-[var(--public-accent-soft)] blur-3xl"
          />

          {state === "success" ? (
            <div className="relative">
              <Notice tone="success" title="已收到你的預約">
                <p>{message}</p>
                <p className="mt-3">
                  {brand.name} 預約專員會透過 WhatsApp 聯絡你確認時段。
                </p>
                {redirectFallbackUrl && (
                  <p className="mt-4">
                    <a
                      href={redirectFallbackUrl}
                      target="_top"
                      className="inline-flex rounded-full bg-[var(--public-cta)] px-5 py-3 text-sm font-bold text-[var(--public-cta-text)]"
                    >
                      前往確認頁
                    </a>
                  </p>
                )}
              </Notice>
              {attributionDebug && (
                <AttributionDebugPanel debug={attributionDebug} />
              )}
            </div>
          ) : (
            <div className="relative">
              <header>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--public-accent)] sm:text-xs">
                  {brand.name} · New client
                </p>
                <h2 className="mt-2 text-[26px] font-semibold leading-tight tracking-[-0.025em] text-[var(--public-heading)] sm:mt-3 sm:text-[34px]">
                  輕鬆預約你的護理
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--public-muted)] sm:text-[15px]">
                  只需填寫基本資料，我哋會盡快為你確認時段。
                </p>
              </header>

              <section
                aria-label="預約項目"
                className="mt-4 rounded-[14px] border border-[var(--public-border)] bg-[var(--public-soft-bg)] px-3.5 py-3 sm:mt-5 sm:flex sm:items-center sm:justify-between sm:gap-5 sm:px-4"
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--public-accent)]">
                    預約項目
                  </p>
                  <p className="mt-1 break-words text-sm font-bold leading-5 text-[var(--public-heading)] sm:text-[15px]">
                    {selectedTreatment?.name || "療程稍後確認"}
                  </p>
                  {selectedPackage?.name && (
                    <p className="mt-0.5 break-words text-xs font-semibold leading-5 text-[var(--public-muted)] sm:text-[13px]">
                      {selectedPackage.name}
                    </p>
                  )}
                </div>
                <p className="mt-2 inline-flex shrink-0 rounded-full bg-white px-3 py-1.5 text-sm font-extrabold text-[var(--public-accent)] sm:mt-0">
                  {priceLabel(selectedPackage)}
                </p>
              </section>

              <form
                onSubmit={submitForm}
                className="mt-4 w-full max-w-full overflow-x-hidden sm:mt-5"
              >
                <input
                  name="website"
                  aria-hidden="true"
                  autoComplete="off"
                  className="hidden"
                  tabIndex={-1}
                  value={formData.honeypot}
                  onChange={(event) =>
                    updateField("honeypot", event.target.value)
                  }
                />

                <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-3.5">
                  <Field label="姓名">
                    <input
                      required
                      autoComplete="name"
                      className="mt-1.5 block h-12 w-full min-w-0 rounded-[13px] border border-[var(--public-border)] bg-white px-3.5 text-base outline-none transition focus:border-[var(--public-accent)] focus:ring-3 focus:ring-[var(--public-accent-soft)] sm:text-sm"
                      value={formData.customer_name}
                      onChange={(event) =>
                        updateField("customer_name", event.target.value)
                      }
                      placeholder="你的稱呼"
                    />
                  </Field>

                  <Field label="聯絡電話">
                    <input
                      required
                      autoComplete="tel"
                      inputMode="tel"
                      className="mt-1.5 block h-12 w-full min-w-0 rounded-[13px] border border-[var(--public-border)] bg-white px-3.5 text-base outline-none transition focus:border-[var(--public-accent)] focus:ring-3 focus:ring-[var(--public-accent-soft)] sm:text-sm"
                      value={formData.phone}
                      onChange={(event) =>
                        updateField("phone", event.target.value)
                      }
                      placeholder="例如：9123 4567"
                    />
                  </Field>

                  <Field label="預約日期">
                    <MobileDateField
                      compact
                      value={formData.appointment_date}
                      onChange={(value) =>
                        updateField("appointment_date", value)
                      }
                    />
                  </Field>

                  <Field label="預約時間">
                    <select
                      required
                      aria-label="預約時間"
                      className="mt-1.5 block h-12 w-full min-w-0 rounded-[13px] border border-[var(--public-border)] bg-white px-3.5 text-base outline-none transition focus:border-[var(--public-accent)] focus:ring-3 focus:ring-[var(--public-accent-soft)] sm:text-sm"
                      value={formData.appointment_time}
                      onChange={(event) =>
                        updateField("appointment_time", event.target.value)
                      }
                    >
                      <option value="">選擇時間</option>
                      {[
                        "11:00",
                        "12:00",
                        "14:00",
                        "16:00",
                        "18:00",
                        "19:30",
                      ].map((time) => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <label className="mt-4 flex items-start gap-2.5 text-[13px] font-semibold leading-5 text-[var(--public-heading)]">
                  <input
                    required
                    type="checkbox"
                    aria-label={LEGAL_CONSENT_TEXT}
                    checked={formData.legalConsentAccepted}
                    onChange={(event) => {
                      event.currentTarget.setCustomValidity("");
                      setFormData((current) => ({
                        ...current,
                        legalConsentAccepted: event.target.checked,
                      }));
                      if (event.target.checked && state === "error") {
                        setMessage("");
                        setState("idle");
                      }
                    }}
                    onInvalid={(event) => {
                      event.currentTarget.setCustomValidity(
                        LEGAL_CONSENT_REQUIRED_MESSAGE
                      );
                      setState("error");
                      setMessage(LEGAL_CONSENT_REQUIRED_MESSAGE);
                    }}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-[var(--public-border)] accent-[var(--public-cta)]"
                  />
                  <span>{LEGAL_CONSENT_TEXT}</span>
                </label>

                <button
                  disabled={state === "loading"}
                  className="mt-4 block min-h-12 w-full rounded-[14px] bg-[var(--public-cta)] px-5 py-3 text-base font-bold text-[var(--public-cta-text)] shadow-[0_10px_24px_rgba(255,90,31,0.2)] transition hover:bg-[var(--public-cta-hover)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--public-accent-soft)] disabled:opacity-60"
                >
                  {state === "loading" ? "正在提交..." : "提交預約  →"}
                </button>
              </form>

              {message && state === "error" && (
                <div
                  role="alert"
                  className="mt-3 rounded-[12px] border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-semibold text-red-700"
                >
                  {message}
                </div>
              )}

              <p className="mt-3 text-center text-xs leading-5 text-[var(--public-muted)]">
                提交後，預約專員會與你確認時段。
              </p>
              {isEmbed && (
                <PublicLegalFooter
                  footerText={getLegalFooterText(legalProfile)}
                  links={getLegalFooterLinks(legalProfile)}
                />
              )}
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section
      data-launchhub-form-root
      className={`${className} box-border w-full max-w-full min-w-0 overflow-x-hidden [&_button]:box-border [&_button]:block [&_button]:min-h-[44px] [&_button]:max-w-full [&_input]:box-border [&_input]:block [&_input]:!h-[42px] [&_input]:!min-h-[42px] [&_input]:min-w-0 [&_input]:max-w-full [&_input]:!rounded-[12px] [&_input]:!px-3.5 [&_input]:!py-2 [&_input]:!text-base sm:[&_input]:!h-auto sm:[&_input]:!min-h-[44px] sm:[&_input]:!rounded-[14px] sm:[&_input]:!px-3.5 sm:[&_input]:!py-2.5 sm:[&_input]:!text-sm [&_select]:box-border [&_select]:block [&_select]:!h-[42px] [&_select]:!min-h-[42px] [&_select]:min-w-0 [&_select]:max-w-full [&_select]:truncate [&_select]:!rounded-[12px] [&_select]:!px-3.5 [&_select]:!py-2 [&_select]:!text-base sm:[&_select]:!h-auto sm:[&_select]:!min-h-[44px] sm:[&_select]:!rounded-[14px] sm:[&_select]:!px-3.5 sm:[&_select]:!py-2.5 sm:[&_select]:!text-sm [&_textarea]:box-border [&_textarea]:block [&_textarea]:min-w-0 [&_textarea]:max-w-full [&_textarea]:!rounded-[12px] [&_textarea]:!px-3.5 [&_textarea]:!py-2 [&_textarea]:!text-base sm:[&_textarea]:!rounded-[14px] sm:[&_textarea]:!px-3.5 sm:[&_textarea]:!py-2.5 sm:[&_textarea]:!text-sm ${
        isEmbed
          ? "w-full max-w-none px-2 py-1.5 sm:mx-auto sm:max-w-[min(34rem,calc(100vw-8px))] sm:px-2.5 sm:py-2.5"
          : ""
      }`}
      style={themeStyle}
    >
      <div className="box-border w-full max-w-full overflow-hidden rounded-none border-0 bg-transparent shadow-none sm:rounded-[22px] sm:border sm:border-[var(--public-border)] sm:bg-[var(--public-card)]">
        <div className="bg-transparent px-0 py-1.5 sm:bg-white sm:px-4 sm:py-4">
          <div className="flex min-w-0 items-center justify-between gap-2 sm:gap-4">
            <p className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--public-accent)] sm:text-[11px] sm:tracking-[0.14em]">
              {brand.name}
            </p>
            <span className="hidden rounded-full border border-[var(--public-border)] bg-white px-2.5 py-1 text-[11px] font-bold text-[var(--public-accent)] sm:inline-flex">
              WhatsApp 跟進
            </span>
          </div>
          <h2 className="mt-1.5 text-base font-bold text-[var(--public-heading)] sm:mt-2 sm:text-xl">
            預約療程體驗
          </h2>
          <p className="mt-1 text-xs leading-5 text-[var(--public-muted)] sm:text-[13px]">
            請填寫預約資料，{brand.name} 團隊會透過 WhatsApp 跟進確認。
          </p>
        </div>

        <div className="p-0 sm:p-4">
          {configMessage ? (
            <Notice tone="warning" title="表格暫時未能使用">
              <p>{configMessage}</p>
              <p className="mt-3 break-all rounded-2xl bg-white/80 px-4 py-3 font-mono text-xs font-semibold">
                {formToken}
              </p>
            </Notice>
          ) : state === "success" ? (
            <div className="grid gap-4">
              <Notice tone="success" title="已收到你的登記">
                <p>{message}</p>
                <p className="mt-3">
                  {brand.name} 團隊會透過 WhatsApp 聯絡你，確認療程及預約細節。
                </p>
                {redirectFallbackUrl && (
                  <p className="mt-4">
                    <a
                      href={redirectFallbackUrl}
                      target="_top"
                      className="inline-flex rounded-full bg-[var(--public-cta)] px-5 py-3 text-sm font-bold text-white"
                    >
                      前往確認頁
                    </a>
                  </p>
                )}
              </Notice>
              {attributionDebug && (
                <AttributionDebugPanel debug={attributionDebug} />
              )}
            </div>
          ) : (
            <>
              <section className="box-border w-full max-w-full rounded-[12px] border border-[#f3e5ec] bg-white p-2.5 sm:rounded-[18px] sm:border-[var(--public-border)] sm:bg-[var(--public-soft-bg)] sm:p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--public-accent)] sm:text-[11px] sm:tracking-[0.12em]">
                  已選療程
                </p>
                <div className="mt-1.5 flex min-w-0 items-center justify-between gap-2 sm:mt-2 sm:gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[var(--public-heading)] sm:text-[15px]">
                      {selectedTreatment?.name}
                    </p>
                    {selectedTreatment?.description && (
                      <p className="mt-0.5 line-clamp-1 text-xs leading-5 text-[var(--public-muted)] sm:text-[13px]">
                        {selectedTreatment.description}
                      </p>
                    )}
                  </div>
                  <p className="max-w-[40%] shrink-0 truncate rounded-full bg-[#fff8fc] px-2.5 py-1 text-xs font-bold text-[var(--public-cta)] sm:max-w-none sm:bg-white sm:px-3 sm:py-1.5 sm:text-[13px]">
                    {priceLabel(selectedPackage)}
                  </p>
                </div>
              </section>

              <div className="mt-2 hidden min-w-0 grid-cols-3 gap-1.5 sm:grid">
                {["WhatsApp 專人跟進", "清楚預約安排", "資料只作跟進"].map(
                  (item) => (
                    <p
                      key={item}
                      className="truncate rounded-full border border-[var(--public-border)] bg-white px-2.5 py-1 text-center text-[11px] font-bold text-[var(--public-accent)]"
                    >
                      {item}
                    </p>
                  )
                )}
              </div>

              <form onSubmit={submitForm} className="mt-3 w-full max-w-full space-y-2.5 overflow-x-hidden sm:mt-3.5 sm:space-y-3">
                <input
                  name="website"
                  aria-hidden="true"
                  autoComplete="off"
                  className="hidden"
                  tabIndex={-1}
                  value={formData.honeypot}
                  onChange={(event) => updateField("honeypot", event.target.value)}
                />

                <FormSection title="療程資料">
                  <Field label="療程">
                    <select
                      className="mt-1.5 w-full rounded-2xl border border-[var(--public-border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--public-cta)]"
                      value={formData.treatment_id}
                      onChange={(event) =>
                        updateField("treatment_id", event.target.value)
                      }
                    >
                      {treatments.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="套餐">
                    <select
                      className="mt-1.5 w-full rounded-2xl border border-[var(--public-border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--public-cta)]"
                      value={selectedPackage?.id || ""}
                      onChange={(event) =>
                        updateField("package_id", event.target.value)
                      }
                    >
                      {availablePackages.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} - {priceLabel(item)}
                        </option>
                      ))}
                    </select>
                  </Field>

                  {selectedPackage?.paymentRequired && (
                    <Field label="付款方式">
                      <select
                        className="mt-1.5 w-full rounded-2xl border border-[var(--public-border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--public-cta)]"
                        value={formData.payment_option}
                        onChange={(event) =>
                          updateField("payment_option", event.target.value)
                        }
                      >
                        <option value="booking_only">只預約，稍後確認</option>
                        <option value="pay_now">即時付款</option>
                      </select>
                    </Field>
                  )}
                </FormSection>

                <FormSection title="客人資料">
                  <div className="grid min-w-0 grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
                    <Field label="姓名">
                      <input
                        required
                        className="mt-1.5 w-full rounded-2xl border border-[var(--public-border)] px-4 py-3 text-sm outline-none focus:border-[var(--public-cta)]"
                        value={formData.customer_name}
                        onChange={(event) =>
                          updateField("customer_name", event.target.value)
                        }
                        placeholder="你的姓名"
                      />
                    </Field>
                    <Field label="電話 / WhatsApp">
                      <input
                        required
                        inputMode="tel"
                        className="mt-1.5 w-full rounded-2xl border border-[var(--public-border)] px-4 py-3 text-sm outline-none focus:border-[var(--public-cta)]"
                        value={formData.phone}
                        onChange={(event) => updateField("phone", event.target.value)}
                        placeholder="9123 4567"
                      />
                    </Field>
                  </div>

                  <Field label="Email">
                    <input
                      type="email"
                      className="mt-1.5 w-full rounded-2xl border border-[var(--public-border)] px-4 py-3 text-sm outline-none focus:border-[var(--public-cta)]"
                      value={formData.email}
                      onChange={(event) => updateField("email", event.target.value)}
                      placeholder="name@example.com"
                    />
                  </Field>
                </FormSection>

                <FormSection title="預約安排">
                  <div className="grid min-w-0 grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3">
                    <Field label="分店">
                      {branches.length > 1 ? (
                        <select
                          required
                          className="mt-1.5 w-full rounded-2xl border border-[var(--public-border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--public-cta)]"
                          value={formData.branch_id}
                          onChange={(event) =>
                            updateField("branch_id", event.target.value)
                          }
                        >
                          <option value="">請選擇分店</option>
                          {branches.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="mt-1.5 truncate rounded-[12px] border border-[var(--public-border)] bg-white px-3.5 py-2.5 text-sm font-semibold text-[var(--public-heading)] sm:rounded-[14px]">
                          {branches[0]?.name || "分店稍後確認"}
                        </div>
                      )}
                    </Field>
                    <Field label="預約日期">
                      <MobileDateField
                        value={formData.appointment_date}
                        onChange={(value) =>
                          updateField("appointment_date", value)
                        }
                      />
                    </Field>
                    <Field label="預約時間">
                      <select
                        className="mt-1.5 w-full rounded-2xl border border-[var(--public-border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--public-cta)]"
                        value={formData.appointment_time}
                        onChange={(event) =>
                          updateField("appointment_time", event.target.value)
                        }
                      >
                        {["11:00", "12:00", "14:00", "16:00", "18:00", "19:30"].map(
                          (time) => (
                            <option key={time}>{time}</option>
                          )
                        )}
                      </select>
                    </Field>
                  </div>
                </FormSection>

                <section className="box-border w-full max-w-full rounded-[12px] border border-[#f3e5ec] bg-white p-2.5 sm:rounded-[18px] sm:border-[var(--public-border)] sm:bg-[var(--public-soft-bg)] sm:p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--public-accent)] sm:text-[11px] sm:tracking-[0.12em]">
                    條款確認
                  </p>
                  <p className="mt-1.5 text-[11px] font-semibold leading-4 text-[var(--public-muted)] sm:text-xs sm:leading-5">
                    {LEGAL_CONSENT_HELPER_TEXT}
                  </p>
                  <label className="mt-2.5 flex items-start gap-2.5 text-[13px] font-semibold leading-5 text-[var(--public-heading)] sm:text-[13px] sm:leading-5">
                    <input
                      required
                      type="checkbox"
                      aria-label={LEGAL_CONSENT_TEXT}
                      checked={formData.legalConsentAccepted}
                      onChange={(event) => {
                        event.currentTarget.setCustomValidity("");
                        setFormData((current) => ({
                          ...current,
                          legalConsentAccepted: event.target.checked,
                        }));
                        if (event.target.checked && state === "error") {
                          setMessage("");
                          setState("idle");
                        }
                      }}
                      onInvalid={(event) => {
                        event.currentTarget.setCustomValidity(
                          LEGAL_CONSENT_REQUIRED_MESSAGE
                        );
                        setState("error");
                        setMessage(LEGAL_CONSENT_REQUIRED_MESSAGE);
                      }}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-[var(--public-border)] text-[var(--public-cta)]"
                    />
                    <span>{LEGAL_CONSENT_TEXT}</span>
                  </label>
                </section>

                <button
                  disabled={state === "loading"}
                  className="w-full rounded-[14px] bg-[var(--public-cta)] px-5 py-2.5 text-sm font-bold text-[var(--public-cta-text)] shadow-none transition hover:bg-[var(--public-cta-hover)] disabled:opacity-60 sm:rounded-full sm:py-3"
                >
                  {state === "loading" ? "正在提交..." : "提交預約資料"}
                </button>
              </form>

              {message && state === "error" && (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {message}
                </div>
              )}

              <p className="mt-3 text-center text-[11px] leading-4 text-[var(--public-muted)] sm:text-xs sm:leading-5">
                資料只會用作預約、客戶服務及相關跟進用途。
              </p>
              {isEmbed && (
                <PublicLegalFooter
                  footerText={getLegalFooterText(legalProfile)}
                  links={getLegalFooterLinks(legalProfile)}
                />
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function AttributionDebugPanel({
  debug,
}: {
  debug: AttributionDebugResponse;
}) {
  const rows = [
    ["inline bootstrap present", String(debug.inline_bootstrap_present)],
    ["inline bootstrap has tracking", String(debug.inline_bootstrap_has_tracking)],
    ["locked session present", String(debug.locked_session_present)],
    ["locked session has tracking", String(debug.locked_session_has_tracking)],
    ["locked local present", String(debug.locked_local_present)],
    ["locked local has tracking", String(debug.locked_local_has_tracking)],
    ["proxy cookie present", String(debug.proxy_cookie_present)],
    ["server body present", String(debug.server_body_present)],
    ["server body has tracking", String(debug.server_body_has_tracking)],
    ["locked body present", String(debug.locked_body_present)],
    ["locked body has tracking", String(debug.locked_body_has_tracking)],
    ["proxy cookie parse ok", String(debug.proxy_cookie_parse_ok)],
    ["body has tracking", String(debug.body_has_tracking)],
    ["preserved body has tracking", String(debug.preserved_body_has_tracking)],
    ["proxy cookie has tracking", String(debug.proxy_cookie_has_tracking)],
    ["downgrade blocked", String(debug.downgrade_blocked)],
    ["final source used", debug.final_attribution_source_used],
    ["final utm_source", debug.final_utm_source || "-"],
    ["final utm_medium", debug.final_utm_medium || "-"],
    ["final utm_campaign", debug.final_utm_campaign || "-"],
    ["final utm_content", debug.final_utm_content || "-"],
    ["final campaign_id", debug.final_campaign_id || "-"],
    ["final adset_id", debug.final_adset_id || "-"],
    ["final ad_id", debug.final_ad_id || "-"],
    ["final placement", debug.final_placement || "-"],
    ["final meta_campaign_id", debug.final_meta_campaign_id || "-"],
    ["final meta_adset_id", debug.final_meta_adset_id || "-"],
    ["final meta_ad_id", debug.final_meta_ad_id || "-"],
    ["final fbclid", debug.final_fbclid || "-"],
    ["final tracking_status", debug.final_tracking_status || "-"],
    ["final audit_reason", debug.final_audit_reason || "-"],
    ["final current_page_url", debug.final_current_page_url || "-"],
  ];

  return (
    <section className="rounded-[24px] border border-[#f3c8dd] bg-white/95 p-4 text-left text-xs font-semibold leading-5 text-[#5a2348] shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#d85ba3]">
        Attribution Debug
      </p>
      <dl className="mt-3 grid gap-2">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1">
            <dt className="text-[10px] uppercase tracking-[0.12em] text-[#8d6a82]">
              {label}
            </dt>
            <dd className="break-all rounded-2xl bg-[#fff8fc] px-3 py-2 font-mono text-[11px] text-[#5a2348]">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Notice({
  tone,
  title,
  children,
}: {
  tone: "warning" | "success";
  title: string;
  children: ReactNode;
}) {
  const classes =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-amber-200 bg-amber-50 text-amber-800";

  return (
    <section className={`box-border w-full max-w-full rounded-[14px] border p-3 text-center sm:rounded-[26px] sm:p-6 ${classes}`}>
      <h2 className="text-base font-bold sm:text-2xl">{title}</h2>
      <div className="mt-2 text-[13px] font-semibold leading-5 sm:mt-3 sm:text-sm sm:leading-6">{children}</div>
    </section>
  );
}

function FormLoadingSkeleton() {
  return (
    <section className="box-border w-full max-w-full rounded-[14px] border border-[#f3e5ec] bg-white p-3 text-left sm:rounded-[22px] sm:p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#d85ba3]">
        LaunchHub
      </p>
      <h2 className="mt-2 text-base font-bold text-[#5a2348]">
        表格載入中...
      </h2>
      <p className="mt-1 text-xs font-semibold leading-5 text-[#8d6a82]">
        請稍候，正在載入登記表格。
      </p>
      <div className="mt-3 grid gap-2">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="h-9 animate-pulse rounded-[12px] bg-[#f8edf4]"
          />
        ))}
      </div>
    </section>
  );
}

function MobileDateField({
  compact = false,
  value,
  onChange,
}: {
  compact?: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  const displayValue = formatSelectedDate(value);

  return (
    <div className="relative mt-1.5 min-w-0">
      <div
        className={`pointer-events-none flex w-full items-center justify-between border border-[var(--public-border)] bg-white px-3.5 py-2 text-base font-semibold text-[var(--public-heading)] sm:text-sm ${
          compact
            ? "h-12 min-h-12 rounded-[13px]"
            : "h-[42px] min-h-[42px] rounded-[12px] sm:h-11 sm:min-h-11 sm:rounded-[14px]"
        }`}
      >
        <span className={displayValue ? "" : "text-[var(--public-muted)]"}>
          {displayValue || "選擇預約日期"}
        </span>
        <span aria-hidden="true" className="text-[var(--public-accent)]">
          日曆
        </span>
      </div>
      <input
        required
        type="date"
        aria-label="預約日期"
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="box-border w-full max-w-full min-w-0 rounded-[12px] border border-[#f3e5ec] bg-white p-2.5 sm:rounded-[18px] sm:border-[var(--public-border)] sm:bg-white sm:p-3">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--public-accent)] sm:mb-2.5 sm:text-[11px] sm:tracking-[0.12em]">
        {title}
      </p>
      <div className="min-w-0 space-y-2.5 sm:space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0 text-[13px] font-semibold text-[var(--public-heading)] sm:text-[13px] sm:font-bold">
      {label}
      {children}
    </label>
  );
}

function PublicLegalFooter({
  footerText,
  links,
}: {
  footerText: string;
  links: Array<{ label: string; href: string }>;
}) {
  return (
    <footer className="mt-3 border-t border-[var(--public-border)] pt-2.5 text-center text-[10px] font-semibold leading-4 text-[var(--public-muted)] sm:mt-4 sm:pt-3 sm:text-[11px] sm:leading-5">
      <p>{footerText}</p>
      <p className="mt-1">{IMAGE_REFERENCE_FOOTER_NOTE}</p>
      <nav className="mt-1.5 flex flex-wrap justify-center gap-x-3 gap-y-1">
        {links.map((link) => (
          <a
            key={`${link.label}:${link.href}`}
            className="underline underline-offset-4"
            href={link.href}
            target={link.href.startsWith("http") ? "_blank" : undefined}
            rel={link.href.startsWith("http") ? "noreferrer" : undefined}
          >
            {link.label}
          </a>
        ))}
      </nav>
    </footer>
  );
}
