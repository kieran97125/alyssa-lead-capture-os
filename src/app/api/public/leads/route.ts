import { randomUUID } from "crypto";
import { after, NextRequest, NextResponse } from "next/server";
import {
  classifyAttribution,
  cleanText,
  normalizePhone,
} from "@/lib/attribution/classify";
import { preferredPageUrl } from "@/lib/attribution/display";
import {
  PUBLIC_ATTRIBUTION_CLIENT_COOKIE_NAME,
  PUBLIC_ATTRIBUTION_COOKIE_NAME,
  chooseBestPublicAttribution,
  decodePublicAttributionCookie,
  hasPublicAttributionTracking,
  normalizePublicAttributionFields,
} from "@/lib/attribution/publicAttributionCookie";
import { TouchPayload } from "@/lib/attribution/types";
import {
  createAttributionTraceSummary,
  createSanitizedAttributionPayload,
} from "@/lib/attribution/telemetry";
import { alyssaDefaultForm } from "@/lib/data/alyssaConfig";
import {
  getBrandLegalProfile,
  LEGAL_CONSENT_REQUIRED_MESSAGE,
  LEGAL_CONSENT_TEXT,
} from "@/lib/legal/consent";
import { buildSubmittedSuccessRedirectUrl } from "@/lib/data/brandDefaults";
import { buildGoogleSheetsLeadPayload } from "@/lib/integrations/googleSheetsLeadSync";
import { normalizedSubmissionId, persistPublicCapture, PublicCaptureError, publicCaptureRequestHash, readPublicCaptureReceipt, type CaptureResponse } from "@/lib/capture/publicCapture";
import { processPublicLeadDeliveries } from "@/lib/capture/leadDelivery";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

type LeadSubmitPayload = {
  form_token?: string;
  submission_id?: string;
  form_id?: string;
  brand_id?: string;
  treatment_id?: string;
  package_id?: string;
  branch_id?: string;
  customer_name?: string;
  phone?: string;
  email?: string;
  appointment_date?: string;
  appointment_time?: string;
  payment_option?: "pay_now" | "booking_only";
  first_touch_json?: TouchPayload;
  latest_touch_json?: TouchPayload;
  submitted_touch_json?: TouchPayload;
  server_touch_json?: TouchPayload;
  locked_touch_json?: TouchPayload;
  locked_session_touch_json?: TouchPayload;
  locked_local_touch_json?: TouchPayload;
  honeypot?: string;
  legalConsentAccepted?: boolean | string;
};

type AttributionSourceUsed =
  | "body"
  | "inline_bootstrap"
  | "locked_attribution"
  | "preserved_body"
  | "server_initial"
  | "proxy_cookie"
  | "direct";

const IP_RATE_WINDOW_MS = 3 * 60 * 1000;
const IP_RATE_LIMIT = 8;
const publicSubmitAttempts = new Map<string, number[]>();

const publicMessages = {
  validation: "未能提交表格，請檢查資料後再試。",
  duplicate: "登記已收到，請稍後再試或等候團隊聯絡。",
  unavailable: "表格暫時未能使用，請稍後再試。",
  spam: "未能提交表格，請稍後再試。",
};

function hasAcceptedLegalConsent(value: LeadSubmitPayload["legalConsentAccepted"]) {
  return value === true;
}

function getStorageRecoverySource(touch: TouchPayload) {
  if (touch.source_capture_method === "parent_embed_script_local_storage_recovered") {
    return "local";
  }

  if (touch.source_capture_method === "parent_embed_script_session_storage_recovered") {
    return "session";
  }

  return null;
}

function classifySubmittedTouch(touch: TouchPayload) {
  const normalizedTouch = normalizePublicAttributionFields(
    touch as Record<string, unknown>
  ) as TouchPayload;
  const classification = classifyAttribution(normalizedTouch, {
    parentPayloadMissing: Object.keys(normalizedTouch).length === 0,
    recoveredFromStorage: getStorageRecoverySource(touch),
  });

  if (
    (touch.source_capture_method === "server_inline_bootstrap_first_touch" ||
      (touch as Record<string, unknown>).attribution_source_used ===
        "inline_bootstrap") &&
    hasPublicAttributionTracking(normalizedTouch)
  ) {
    return {
      ...classification,
      auditReason: "utm_preserved_from_inline_bootstrap_first_touch",
    };
  }

  if (
    (touch.source_capture_method === "public_landing_page_locked_first_touch" ||
      (touch as Record<string, unknown>).attribution_source_used ===
        "locked_attribution") &&
    hasPublicAttributionTracking(normalizedTouch)
  ) {
    return {
      ...classification,
      auditReason: "utm_preserved_from_first_tracking_touch",
    };
  }

  if (
    touch.source_capture_method === "server_public_lp_initial_search" &&
    hasPublicAttributionTracking(normalizedTouch)
  ) {
    return {
      ...classification,
      auditReason: "utm_recovered_from_server_initial_search",
    };
  }

  if (
    touch.source_capture_method === "proxy_public_lp_first_touch" &&
    hasPublicAttributionTracking(touch)
  ) {
    return {
      ...classification,
      auditReason: "utm_recovered_from_proxy_cookie",
    };
  }

  return classification;
}

function getSafeTouch(value: TouchPayload | undefined) {
  return value && typeof value === "object"
    ? (normalizePublicAttributionFields(
        value as Record<string, unknown>
      ) as TouchPayload)
    : {};
}

function mergeTouch(base: TouchPayload, source: TouchPayload): TouchPayload {
  return {
    ...base,
    ...source,
    current_page_url: source.current_page_url || base.current_page_url,
    landing_page_url: source.landing_page_url || base.landing_page_url,
  };
}

function resolveSubmittedAttribution(
  request: NextRequest,
  payload: LeadSubmitPayload
) {
  const bodyFirstTouch = getSafeTouch(payload.first_touch_json);
  const bodyLatestTouch = getSafeTouch(payload.latest_touch_json);
  const bodySubmittedTouch = getSafeTouch(payload.submitted_touch_json);
  const bodyServerTouch = getSafeTouch(payload.server_touch_json);
  const bodyLockedTouch = getSafeTouch(payload.locked_touch_json);
  const bodyLockedSessionTouch = getSafeTouch(payload.locked_session_touch_json);
  const bodyLockedLocalTouch = getSafeTouch(payload.locked_local_touch_json);
  const proxyCookieValue = request.cookies.get(PUBLIC_ATTRIBUTION_COOKIE_NAME)
    ?.value;
  const clientCookieValue = request.cookies.get(
    PUBLIC_ATTRIBUTION_CLIENT_COOKIE_NAME
  )?.value;
  const proxyCookieTouch =
    decodePublicAttributionCookie(proxyCookieValue) ?? null;
  const clientCookieTouch =
    decodePublicAttributionCookie(clientCookieValue) ?? null;

  const bodyPreservedTouch = hasPublicAttributionTracking(bodyFirstTouch)
    ? bodyFirstTouch
    : hasPublicAttributionTracking(bodyLatestTouch)
      ? bodyLatestTouch
      : null;
  const submittedHasTracking = hasPublicAttributionTracking(bodySubmittedTouch);
  const bodySubmittedRecord = bodySubmittedTouch as Record<string, unknown>;
  const submittedIsServerInitial =
    bodySubmittedTouch.source_capture_method ===
      "server_public_lp_initial_search" ||
    bodySubmittedRecord.attribution_source_used === "server_initial";
  const submittedIsLocked =
    bodySubmittedTouch.source_capture_method ===
      "public_landing_page_locked_first_touch" ||
    bodySubmittedRecord.attribution_source_used === "locked_attribution";
  const submittedIsInlineBootstrap =
    bodySubmittedTouch.source_capture_method ===
      "server_inline_bootstrap_first_touch" ||
    bodySubmittedRecord.attribution_source_used === "inline_bootstrap";
  const bodyServerRecord = bodyServerTouch as Record<string, unknown>;
  const serverTouchIsLocked =
    bodyServerTouch.source_capture_method ===
      "public_landing_page_locked_first_touch" ||
    bodyServerRecord.attribution_source_used === "locked_attribution";
  const serverTouchIsInlineBootstrap =
    bodyServerTouch.source_capture_method ===
      "server_inline_bootstrap_first_touch" ||
    bodyServerRecord.attribution_source_used === "inline_bootstrap";
  const bodyLockedRecord = bodyLockedTouch as Record<string, unknown>;
  const lockedTouchIsInlineBootstrap =
    bodyLockedTouch.source_capture_method ===
      "server_inline_bootstrap_first_touch" ||
    bodyLockedRecord.attribution_source_used === "inline_bootstrap";
  const serverBodyHasTracking = hasPublicAttributionTracking(bodyServerTouch);
  const lockedSessionPresent = Boolean(payload.locked_session_touch_json);
  const lockedSessionHasTracking = hasPublicAttributionTracking(
    bodyLockedSessionTouch
  );
  const lockedLocalPresent = Boolean(payload.locked_local_touch_json);
  const lockedLocalHasTracking = hasPublicAttributionTracking(
    bodyLockedLocalTouch
  );
  const selectedLockedTouch = chooseBestPublicAttribution([
    bodyLockedTouch,
    bodyLockedSessionTouch,
    bodyLockedLocalTouch,
    serverTouchIsLocked || serverTouchIsInlineBootstrap ? bodyServerTouch : null,
  ]) as TouchPayload | null;
  const lockedBodyPresent = Boolean(
    payload.locked_touch_json ||
      payload.locked_session_touch_json ||
      payload.locked_local_touch_json ||
      ((serverTouchIsLocked || serverTouchIsInlineBootstrap) &&
        payload.server_touch_json)
  );
  const lockedBodyHasTracking = hasPublicAttributionTracking(selectedLockedTouch);
  const inlineBootstrapPresent = Boolean(
    submittedIsInlineBootstrap ||
      serverTouchIsInlineBootstrap ||
      lockedTouchIsInlineBootstrap ||
      bodyLockedSessionTouch.source_capture_method ===
        "server_inline_bootstrap_first_touch" ||
      bodyLockedLocalTouch.source_capture_method ===
        "server_inline_bootstrap_first_touch" ||
      clientCookieTouch?.source_capture_method ===
        "server_inline_bootstrap_first_touch"
  );
  const inlineBootstrapHasTracking = Boolean(
    inlineBootstrapPresent &&
      hasPublicAttributionTracking(
        chooseBestPublicAttribution([
          submittedIsInlineBootstrap ? bodySubmittedTouch : null,
          serverTouchIsInlineBootstrap ? bodyServerTouch : null,
          lockedTouchIsInlineBootstrap ? bodyLockedTouch : null,
          bodyLockedSessionTouch,
          bodyLockedLocalTouch,
          clientCookieTouch,
        ])
      )
  );
  const preservedBodyHasTracking = Boolean(bodyPreservedTouch);
  const proxyCookiePresent = Boolean(proxyCookieValue);
  const proxyCookieParseOk = Boolean(proxyCookieTouch);
  const clientCookiePresent = Boolean(clientCookieValue);
  const clientCookieParseOk = Boolean(clientCookieTouch);
  const proxyCookieHasTracking =
    hasPublicAttributionTracking(proxyCookieTouch) ||
    hasPublicAttributionTracking(clientCookieTouch);
  const downgradeBlocked =
    Boolean(bodySubmittedTouch.current_page_url || bodySubmittedTouch.landing_page_url) &&
    !submittedHasTracking &&
    (lockedBodyHasTracking ||
      serverBodyHasTracking ||
      preservedBodyHasTracking ||
      proxyCookieHasTracking);

  if (
    submittedHasTracking &&
    !submittedIsServerInitial &&
    !submittedIsLocked &&
    !submittedIsInlineBootstrap
  ) {
    return {
      firstTouch: bodyFirstTouch,
      latestTouch: bodyLatestTouch,
      submittedTouch: bodySubmittedTouch,
      sourceUsed: "body" as AttributionSourceUsed,
      proxyCookiePresent,
      proxyCookieParseOk,
      bodyHasTracking: submittedHasTracking,
      serverBodyPresent: Boolean(payload.server_touch_json),
      serverBodyHasTracking,
      inlineBootstrapPresent,
      inlineBootstrapHasTracking,
      lockedSessionPresent,
      lockedSessionHasTracking,
      lockedLocalPresent,
      lockedLocalHasTracking,
      lockedBodyPresent,
      lockedBodyHasTracking,
      preservedBodyHasTracking,
      proxyCookieHasTracking,
      clientCookiePresent,
      clientCookieParseOk,
      downgradeBlocked,
    };
  }

  if (
    lockedBodyHasTracking ||
    (submittedHasTracking && (submittedIsLocked || submittedIsInlineBootstrap))
  ) {
    const lockedTouch =
      selectedLockedTouch ||
      (submittedHasTracking ? bodySubmittedTouch : bodyLockedTouch);
    const sourceUsed =
      hasPublicAttributionTracking(lockedTouch) &&
      (lockedTouch.source_capture_method ===
        "server_inline_bootstrap_first_touch" ||
        (lockedTouch as Record<string, unknown>).attribution_source_used ===
          "inline_bootstrap")
        ? "inline_bootstrap"
        : "locked_attribution";
    const submittedTouch = mergeTouch(bodySubmittedTouch, lockedTouch);
    const firstTouch = hasPublicAttributionTracking(bodyFirstTouch)
      ? bodyFirstTouch
      : mergeTouch(bodyFirstTouch, lockedTouch);
    const latestTouch = hasPublicAttributionTracking(bodyLatestTouch)
      ? bodyLatestTouch
      : mergeTouch(bodyLatestTouch, lockedTouch);

    return {
      firstTouch,
      latestTouch,
      submittedTouch: {
        ...submittedTouch,
        source_capture_method:
          sourceUsed === "inline_bootstrap"
            ? "server_inline_bootstrap_first_touch"
            : "public_landing_page_locked_first_touch",
        attribution_source_used: sourceUsed,
      },
      sourceUsed: sourceUsed as AttributionSourceUsed,
      proxyCookiePresent,
      proxyCookieParseOk,
      bodyHasTracking: submittedHasTracking,
      serverBodyPresent: Boolean(payload.server_touch_json),
      serverBodyHasTracking,
      inlineBootstrapPresent,
      inlineBootstrapHasTracking,
      lockedSessionPresent,
      lockedSessionHasTracking,
      lockedLocalPresent,
      lockedLocalHasTracking,
      lockedBodyPresent: true,
      lockedBodyHasTracking: true,
      preservedBodyHasTracking,
      proxyCookieHasTracking,
      clientCookiePresent,
      clientCookieParseOk,
      downgradeBlocked,
    };
  }

  if (serverBodyHasTracking || (submittedHasTracking && submittedIsServerInitial)) {
    const serverTouch = serverBodyHasTracking ? bodyServerTouch : bodySubmittedTouch;
    const submittedTouch = mergeTouch(bodySubmittedTouch, serverTouch);
    const firstTouch = hasPublicAttributionTracking(bodyFirstTouch)
      ? bodyFirstTouch
      : mergeTouch(bodyFirstTouch, serverTouch);
    const latestTouch = hasPublicAttributionTracking(bodyLatestTouch)
      ? bodyLatestTouch
      : mergeTouch(bodyLatestTouch, serverTouch);

    return {
      firstTouch,
      latestTouch,
      submittedTouch: {
        ...submittedTouch,
        source_capture_method: "server_public_lp_initial_search",
        attribution_source_used: "server_initial",
      },
      sourceUsed: "server_initial" as AttributionSourceUsed,
      proxyCookiePresent,
      proxyCookieParseOk,
      bodyHasTracking: submittedHasTracking,
      serverBodyPresent: Boolean(payload.server_touch_json),
      serverBodyHasTracking,
      inlineBootstrapPresent,
      inlineBootstrapHasTracking,
      lockedSessionPresent,
      lockedSessionHasTracking,
      lockedLocalPresent,
      lockedLocalHasTracking,
      lockedBodyPresent,
      lockedBodyHasTracking,
      preservedBodyHasTracking,
      proxyCookieHasTracking,
      clientCookiePresent,
      clientCookieParseOk,
      downgradeBlocked,
    };
  }

  if (bodyPreservedTouch) {
    const submittedTouch = mergeTouch(bodySubmittedTouch, bodyPreservedTouch);

    return {
      firstTouch: bodyFirstTouch,
      latestTouch: bodyLatestTouch,
      submittedTouch,
      sourceUsed: "preserved_body" as AttributionSourceUsed,
      proxyCookiePresent,
      proxyCookieParseOk,
      bodyHasTracking: submittedHasTracking,
      serverBodyPresent: Boolean(payload.server_touch_json),
      serverBodyHasTracking,
      inlineBootstrapPresent,
      inlineBootstrapHasTracking,
      lockedSessionPresent,
      lockedSessionHasTracking,
      lockedLocalPresent,
      lockedLocalHasTracking,
      lockedBodyPresent,
      lockedBodyHasTracking,
      preservedBodyHasTracking,
      proxyCookieHasTracking,
      clientCookiePresent,
      clientCookieParseOk,
      downgradeBlocked,
    };
  }

  const cookieTouch = proxyCookieTouch || clientCookieTouch;

  if (cookieTouch) {
    const sourceUsed =
      cookieTouch.source_capture_method === "server_inline_bootstrap_first_touch"
        ? "inline_bootstrap"
        : "proxy_cookie";
    const submittedTouch = mergeTouch(bodySubmittedTouch, cookieTouch);
    const firstTouch = hasPublicAttributionTracking(bodyFirstTouch)
      ? bodyFirstTouch
      : mergeTouch(bodyFirstTouch, cookieTouch);
    const latestTouch = hasPublicAttributionTracking(bodyLatestTouch)
      ? bodyLatestTouch
      : mergeTouch(bodyLatestTouch, cookieTouch);

    return {
      firstTouch,
      latestTouch,
      submittedTouch,
      sourceUsed: sourceUsed as AttributionSourceUsed,
      proxyCookiePresent: true,
      proxyCookieParseOk,
      bodyHasTracking: submittedHasTracking,
      serverBodyPresent: Boolean(payload.server_touch_json),
      serverBodyHasTracking,
      inlineBootstrapPresent,
      inlineBootstrapHasTracking,
      lockedSessionPresent,
      lockedSessionHasTracking,
      lockedLocalPresent,
      lockedLocalHasTracking,
      lockedBodyPresent,
      lockedBodyHasTracking,
      preservedBodyHasTracking,
      proxyCookieHasTracking,
      clientCookiePresent,
      clientCookieParseOk,
      downgradeBlocked,
    };
  }

  return {
    firstTouch: bodyFirstTouch,
    latestTouch: bodyLatestTouch,
    submittedTouch: bodySubmittedTouch,
    sourceUsed: "direct" as AttributionSourceUsed,
    proxyCookiePresent,
    proxyCookieParseOk,
    bodyHasTracking: submittedHasTracking,
    serverBodyPresent: Boolean(payload.server_touch_json),
    serverBodyHasTracking,
    inlineBootstrapPresent,
    inlineBootstrapHasTracking,
    lockedSessionPresent,
    lockedSessionHasTracking,
    lockedLocalPresent,
    lockedLocalHasTracking,
    lockedBodyPresent,
    lockedBodyHasTracking,
    preservedBodyHasTracking,
    proxyCookieHasTracking,
    clientCookiePresent,
    clientCookieParseOk,
    downgradeBlocked: false,
  };
}

function valueHasAttributionDebug(value: unknown) {
  if (typeof value !== "string") return false;
  if (!value.includes("attribution_debug=1")) return false;

  try {
    const parsed = new URL(value);
    return parsed.searchParams.get("attribution_debug") === "1";
  } catch {
    return value.includes("attribution_debug=1");
  }
}

function touchHasAttributionDebug(touch: TouchPayload) {
  const record = touch as Record<string, unknown>;

  return Boolean(
    valueHasAttributionDebug(touch.current_page_url) ||
      valueHasAttributionDebug(touch.landing_page_url) ||
      valueHasAttributionDebug(record.preserved_initial_full_url) ||
      valueHasAttributionDebug(record.preserved_initial_search)
  );
}

function shouldReturnAttributionDebug(
  request: NextRequest,
  payload: LeadSubmitPayload,
  submittedTouch: TouchPayload
) {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALYSSA_E2E_FIXTURES !== "1"
  ) {
    return false;
  }

  return Boolean(
    request.nextUrl.searchParams.get("attribution_debug") === "1" ||
      touchHasAttributionDebug(getSafeTouch(payload.first_touch_json)) ||
      touchHasAttributionDebug(getSafeTouch(payload.latest_touch_json)) ||
      touchHasAttributionDebug(getSafeTouch(payload.submitted_touch_json)) ||
      touchHasAttributionDebug(getSafeTouch(payload.server_touch_json)) ||
      touchHasAttributionDebug(submittedTouch)
  );
}

function createAttributionDebugPayload({
  resolvedAttribution,
  submittedTouch,
  classification,
}: {
  resolvedAttribution: ReturnType<typeof resolveSubmittedAttribution>;
  submittedTouch: TouchPayload;
  classification: ReturnType<typeof classifySubmittedTouch>;
}) {
  return {
    attribution_debug: true,
    inline_bootstrap_present: resolvedAttribution.inlineBootstrapPresent,
    inline_bootstrap_has_tracking:
      resolvedAttribution.inlineBootstrapHasTracking,
    locked_session_present: resolvedAttribution.lockedSessionPresent,
    locked_session_has_tracking:
      resolvedAttribution.lockedSessionHasTracking,
    locked_local_present: resolvedAttribution.lockedLocalPresent,
    locked_local_has_tracking: resolvedAttribution.lockedLocalHasTracking,
    server_body_present: resolvedAttribution.serverBodyPresent,
    server_body_has_tracking: resolvedAttribution.serverBodyHasTracking,
    locked_body_present: resolvedAttribution.lockedBodyPresent,
    locked_body_has_tracking: resolvedAttribution.lockedBodyHasTracking,
    proxy_cookie_present: resolvedAttribution.proxyCookiePresent,
    proxy_cookie_parse_ok: resolvedAttribution.proxyCookieParseOk,
    client_cookie_present: resolvedAttribution.clientCookiePresent,
    client_cookie_parse_ok: resolvedAttribution.clientCookieParseOk,
    body_has_tracking: resolvedAttribution.bodyHasTracking,
    preserved_body_has_tracking: resolvedAttribution.preservedBodyHasTracking,
    proxy_cookie_has_tracking: resolvedAttribution.proxyCookieHasTracking,
    downgrade_blocked: resolvedAttribution.downgradeBlocked,
    final_attribution_source_used: resolvedAttribution.sourceUsed,
    final_utm_source: cleanText(submittedTouch.utm_source, 300),
    final_utm_medium: cleanText(submittedTouch.utm_medium, 300),
    final_utm_campaign: cleanText(submittedTouch.utm_campaign, 300),
    final_utm_content: cleanText(submittedTouch.utm_content, 300),
    final_campaign_id: cleanText(submittedTouch.campaign_id, 300),
    final_adset_id: cleanText(submittedTouch.adset_id, 300),
    final_ad_id: cleanText(submittedTouch.ad_id, 300),
    final_placement: cleanText(submittedTouch.placement, 300),
    final_meta_campaign_id: cleanText(submittedTouch.meta_campaign_id, 300),
    final_meta_adset_id: cleanText(submittedTouch.meta_adset_id, 300),
    final_meta_ad_id: cleanText(submittedTouch.meta_ad_id, 300),
    final_fbclid: cleanText(submittedTouch.fbclid, 500),
    final_current_page_url: cleanText(submittedTouch.current_page_url, 2000),
    final_landing_page_url: cleanText(submittedTouch.landing_page_url, 2000),
    final_tracking_status: classification.trackingStatus,
    final_audit_reason: classification.auditReason,
  };
}

function normalizeOrigin(value: string | null | undefined) {
  if (!value) return null;
  const cleaned = String(value).trim();

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

function uniqueOrigins(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map(normalizeOrigin).filter((value): value is string => Boolean(value)))
  );
}

function isAllowedOrigin(
  allowedOrigins: string[],
  candidateOrigin: string,
  rawAllowedDomains: string[]
) {
  if (allowedOrigins.includes(candidateOrigin)) return true;

  try {
    const candidateUrl = new URL(candidateOrigin);
    return rawAllowedDomains.some((domain) => {
      const cleaned = String(domain).trim().toLowerCase();
      return (
        (cleaned === "localhost" || cleaned === "127.0.0.1") &&
        candidateUrl.hostname === cleaned
      );
    });
  } catch {
    return false;
  }
}

function getOriginValidation(
  allowedDomains: string[],
  candidateValues: Array<string | null | undefined>
) {
  const allowedOrigins = uniqueOrigins(allowedDomains);
  const receivedOrigins = uniqueOrigins(candidateValues);

  if (allowedDomains.length === 0) {
    return { allowed: true, allowedOrigins, receivedOrigins };
  }

  const allowed = receivedOrigins.some((origin) =>
    isAllowedOrigin(allowedOrigins, origin, allowedDomains)
  );

  return { allowed, allowedOrigins, receivedOrigins };
}

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const forwardedIp = forwardedFor?.split(",")[0]?.trim();

  return (
    forwardedIp ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-vercel-forwarded-for") ||
    request.headers.get("cf-connecting-ip") ||
    null
  );
}

function isIpRateLimited(ip: string | null) {
  if (!ip) return false;

  const now = Date.now();
  const recentAttempts = (publicSubmitAttempts.get(ip) ?? []).filter(
    (timestamp) => now - timestamp < IP_RATE_WINDOW_MS
  );

  if (recentAttempts.length >= IP_RATE_LIMIT) {
    publicSubmitAttempts.set(ip, recentAttempts);
    return true;
  }

  recentAttempts.push(now);
  publicSubmitAttempts.set(ip, recentAttempts);
  return false;
}

function shortUserAgent(request: NextRequest) {
  return (request.headers.get("user-agent") ?? "").slice(0, 160);
}

function logPublicSubmitFailure(
  request: NextRequest,
  input: {
    reason: string;
    formToken?: string | null;
    normalizedPhone?: string | null;
    attributionTraceId?: string | null;
    databaseError?: {
      code: string | null;
      message: string | null;
      hint: string | null;
    } | null;
  }
) {
  console.warn("[LaunchHub] public_lead_submit_rejected", {
    reason: input.reason,
    form_token: input.formToken || null,
    normalized_phone: input.normalizedPhone || null,
    attribution_trace_id: input.attributionTraceId || null,
    database_error: input.databaseError || null,
    request_origin: normalizeOrigin(request.headers.get("origin")),
    referer_origin: normalizeOrigin(request.headers.get("referer")),
    user_agent: shortUserAgent(request),
    timestamp: new Date().toISOString(),
  });
}

function rejectPublicSubmit(
  request: NextRequest,
  status: number,
  error: string,
  message: string,
  input: {
    formToken?: string | null;
    normalizedPhone?: string | null;
    attributionTraceId?: string | null;
    databaseError?: {
      code: string | null;
      message: string | null;
      hint: string | null;
    } | null;
  } = {}
) {
  logPublicSubmitFailure(request, {
    reason: error,
    formToken: input.formToken,
    normalizedPhone: input.normalizedPhone,
    attributionTraceId: input.attributionTraceId,
    databaseError: input.databaseError,
  });

  return NextResponse.json({ ok: false, error, message }, { status });
}

function databaseErrorForLog(
  error:
    | {
        code?: string | null;
        message?: string | null;
        hint?: string | null;
      }
    | null
    | undefined
) {
  if (!error) return null;

  return {
    code: cleanText(error.code, 80) || null,
    message: cleanText(error.message, 500) || null,
    hint: cleanText(error.hint, 500) || null,
  };
}

function isValidNormalizedPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

function isValidEmail(value: string | null) {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isReasonableDate(value: string | null) {
  if (!value) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isReasonableTime(value: string | null) {
  if (!value) return true;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function normalizeConversionMode(value: unknown) {
  return value === "thank_you_redirect"
    ? "thank_you_redirect"
    : "form_submit_pixel";
}

async function getAllowedFormBranchIds(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  form: Record<string, unknown>
) {
  const defaultBranchId =
    typeof form.default_branch_id === "string" ? form.default_branch_id : "";
  const { data, error } = await supabase
    .from("form_branches")
    .select("branch_id,is_default,is_active,display_order")
    .eq("form_id", form.id)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) {
    console.warn("[LaunchHub] submit_form_branches_read_failed", {
      form_id: form.id,
      code: error.code,
      message: error.message,
    });
    return {
      branchIds: defaultBranchId ? [defaultBranchId] : [],
      defaultBranchId,
      source: "default_branch_id",
    };
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const branchIds = rows
    .map((row) => (typeof row.branch_id === "string" ? row.branch_id : ""))
    .filter(Boolean);
  const selectedDefault =
    rows.find((row) => row.is_default === true)?.branch_id || defaultBranchId;

  return {
    branchIds,
    defaultBranchId:
      typeof selectedDefault === "string" ? selectedDefault : defaultBranchId,
    source: rows.length > 0 ? "form_branches" : "default_branch_id",
  };
}

async function getAllowedFormPackageIds(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  form: Record<string, unknown>
) {
  const defaultPackageId =
    typeof form.default_package_id === "string" ? form.default_package_id : "";
  const selectionMode =
    form.package_selection_mode === "customer_choice"
      ? "customer_choice"
      : "fixed";

  if (selectionMode === "fixed") {
    return {
      packageIds: defaultPackageId ? [defaultPackageId] : [],
      defaultPackageId,
      source: "default_package_id",
    };
  }

  const { data, error } = await supabase
    .from("form_packages")
    .select("package_id,is_default,is_active,display_order")
    .eq("form_id", form.id)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) {
    console.warn("[LaunchHub] submit_form_packages_read_failed", {
      form_id: form.id,
      code: error.code,
      message: error.message,
    });
    return {
      packageIds: defaultPackageId ? [defaultPackageId] : [],
      defaultPackageId,
      source: "default_package_id",
    };
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const packageIds = rows
    .map((row) => (typeof row.package_id === "string" ? row.package_id : ""))
    .filter(Boolean);
  const selectedDefault =
    rows.find((row) => row.is_default === true)?.package_id || defaultPackageId;

  return {
    packageIds: packageIds.length > 0
      ? packageIds
      : defaultPackageId
        ? [defaultPackageId]
        : [],
    defaultPackageId:
      typeof selectedDefault === "string" ? selectedDefault : defaultPackageId,
    source: packageIds.length > 0 ? "form_packages" : "default_package_id",
  };
}

async function createLocalResponse(
  payload: LeadSubmitPayload,
  submittedTouchOverride?: TouchPayload,
  attributionDebug?: ReturnType<typeof createAttributionDebugPayload>,
  attributionTraceId = randomUUID()
) {
  const submittedTouch =
    submittedTouchOverride ?? payload.submitted_touch_json ?? {};
  const classification = classifySubmittedTouch(submittedTouch);
  const leadId = randomUUID();
  const eventId = cleanText(submittedTouch.client_event_id, 120) || leadId;

  return NextResponse.json(
    {
      ok: true,
      mode: "local_noop",
      lead_id: leadId,
      event_id: eventId,
      form_id: payload.form_id || alyssaDefaultForm.id,
      conversion_mode: "form_submit_pixel",
      success_redirect_url: null,
      final_redirect_url: null,
      contact_id: randomUUID(),
      source_snapshot_id: randomUUID(),
      attribution_trace_id: attributionTraceId,
      source_type: classification.sourceType,
      tracking_status: classification.trackingStatus,
      audit_reason: classification.auditReason,
      ...(attributionDebug ? { attribution_debug: attributionDebug } : {}),
    },
    { status: 201 }
  );
}

function acceptedCaptureResponse(receipt: CaptureResponse, attributionDebug?: ReturnType<typeof createAttributionDebugPayload>) {
  const finalRedirectUrl = receipt.conversion_mode === "thank_you_redirect"
    ? buildSubmittedSuccessRedirectUrl({ successRedirectUrl: receipt.success_redirect_url,
        leadId: receipt.lead_id, eventId: receipt.event_id, formId: receipt.form_id, value: receipt.value }) : null;
  return NextResponse.json({ ...receipt, final_redirect_url: finalRedirectUrl,
    ...(attributionDebug ? { attribution_debug: attributionDebug } : {}) }, { status: 201 });
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as
    | LeadSubmitPayload
    | null;

  if (!payload) {
    return rejectPublicSubmit(
      request,
      400,
      "invalid_json",
      publicMessages.validation
    );
  }

  if (cleanText(payload.honeypot)) {
    return rejectPublicSubmit(
      request,
      400,
      "spam_rejected",
      publicMessages.spam,
      { formToken: cleanText(payload.form_token, 300) }
    );
  }

  if (!hasAcceptedLegalConsent(payload.legalConsentAccepted)) {
    return rejectPublicSubmit(
      request,
      400,
      "legal_consent_missing",
      LEGAL_CONSENT_REQUIRED_MESSAGE,
      { formToken: cleanText(payload.form_token, 300) }
    );
  }

  const formToken = cleanText(payload.form_token, 300);
  const customerName = cleanText(payload.customer_name, 120);
  const phone = cleanText(payload.phone, 80);
  const normalizedPhone = phone ? normalizePhone(phone) : "";
  const email = cleanText(payload.email, 200);
  const appointmentDate = cleanText(payload.appointment_date, 20);
  const appointmentTime = cleanText(payload.appointment_time, 20);
  const clientIp = getClientIp(request);

  if (!formToken || !customerName || !phone || !isValidNormalizedPhone(normalizedPhone)) {
    return rejectPublicSubmit(
      request,
      400,
      "required_fields_missing",
      publicMessages.validation,
      { formToken, normalizedPhone }
    );
  }

  if (!isValidEmail(email)) {
    return rejectPublicSubmit(
      request,
      400,
      "invalid_email",
      publicMessages.validation,
      { formToken, normalizedPhone }
    );
  }

  if (!isReasonableDate(appointmentDate) || !isReasonableTime(appointmentTime)) {
    return rejectPublicSubmit(
      request,
      400,
      "invalid_booking_time",
      publicMessages.validation,
      { formToken, normalizedPhone }
    );
  }



  if (!formToken || !phone || normalizedPhone.length < 8) {
    return NextResponse.json(
      {
        ok: false,
        error: "required_fields_missing",
        message: "請輸入有效 WhatsApp 電話號碼。",
      },
      { status: 400 }
    );
  }

  const resolvedAttribution = resolveSubmittedAttribution(request, payload);
  const submittedTouch = resolvedAttribution.submittedTouch;
  const classification = classifySubmittedTouch(submittedTouch);
  const attributionTraceId = randomUUID();
  const attributionTraceSummary = createAttributionTraceSummary({
    traceId: attributionTraceId,
    sourceUsed: resolvedAttribution.sourceUsed,
    touch: submittedTouch,
    classification,
  });
  console.info("[LaunchHub] attribution_resolved", attributionTraceSummary);
  const attributionDebug = shouldReturnAttributionDebug(
    request,
    payload,
    submittedTouch
  )
    ? createAttributionDebugPayload({
        resolvedAttribution,
        submittedTouch,
        classification,
      })
    : undefined;

  // Production must never acknowledge a registration that was not persisted.
  // Explicit isolated acceptance fixtures are separate from missing configuration.
  if (!hasSupabaseAdminEnv() && process.env.NODE_ENV === "production" && process.env.ALYSSA_E2E_FIXTURES !== "1") {
    return rejectPublicSubmit(request, 503, "capture_database_unavailable", publicMessages.unavailable,
      { formToken, normalizedPhone, attributionTraceId });
  }
  // Attribution E2E must never write synthetic leads into a linked database.
  if (process.env.ALYSSA_E2E_FIXTURES === "1" || !hasSupabaseAdminEnv()) {
    if (formToken !== alyssaDefaultForm.publicFormToken) {
      return rejectPublicSubmit(
        request,
        403,
        "invalid_form",
        publicMessages.unavailable,
        { formToken, normalizedPhone }
      );
    }

    return createLocalResponse(
      payload,
      submittedTouch,
      attributionDebug,
      attributionTraceId
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data: form, error: formError } = await supabase
    .from("forms")
    .select("*")
    .eq("public_form_token", formToken)
    .single();

  if (formError || !form) {
    return rejectPublicSubmit(
      request,
      403,
      "invalid_form",
      publicMessages.unavailable,
      { formToken, normalizedPhone }
    );
  }

  // A successful receipt remains replayable if the offer is subsequently edited
  // or archived. A matching business hash is required before exposing its IDs.
  if (payload.submission_id) {
    try {
      const receipt = await readPublicCaptureReceipt({
        formId: form.id, submissionId: normalizedSubmissionId(payload.submission_id),
        requestHash: publicCaptureRequestHash({ formId: form.id, customerName, phone: normalizedPhone, email,
          treatmentId: cleanText(payload.treatment_id, 80) || "",
          packageId: cleanText(payload.package_id, 80) || "",
          branchId: cleanText(payload.branch_id, 80) || "",
          appointmentDate, appointmentTime, paymentOption: payload.payment_option ?? "booking_only" }),
      });
      if (receipt) return acceptedCaptureResponse(receipt, attributionDebug);
    } catch (error) {
      const code = error instanceof PublicCaptureError ? error.code : "capture_transaction_unavailable";
      return rejectPublicSubmit(request, code === "capture_idempotency_conflict" ? 409 : code === "capture_invalid_submission_id" ? 400 : 503,
        code, code === "capture_idempotency_conflict" ? "登記資料已更改，請重新載入表格後再試。" : publicMessages.unavailable,
        { formToken, normalizedPhone, attributionTraceId });
    }
  }
  if (isIpRateLimited(clientIp)) {
    return rejectPublicSubmit(
      request,
      429,
      "rate_limited",
      publicMessages.duplicate,
      { formToken, normalizedPhone }
    );
  }

  if (String(form.status ?? "").toLowerCase() !== "active") {
    return rejectPublicSubmit(
      request,
      403,
      "form_unavailable",
      publicMessages.unavailable,
      { formToken, normalizedPhone }
    );
  }

  const currentPageUrl = preferredPageUrl(submittedTouch);
  const allowedDomains = (form.allowed_domains ?? []) as string[];
  const originValidation = getOriginValidation(allowedDomains, [
    request.headers.get("origin"),
    request.headers.get("referer"),
    submittedTouch.parent_origin,
    submittedTouch.current_page_url,
    submittedTouch.landing_page_url,
    payload.first_touch_json?.parent_origin,
    payload.first_touch_json?.current_page_url,
    payload.first_touch_json?.landing_page_url,
    payload.latest_touch_json?.parent_origin,
    payload.latest_touch_json?.current_page_url,
    payload.latest_touch_json?.landing_page_url,
    payload.submitted_touch_json?.parent_origin,
    payload.submitted_touch_json?.current_page_url,
    payload.submitted_touch_json?.landing_page_url,
  ]);

  if (!originValidation.allowed) {
    console.warn("[LaunchHub] domain_not_allowed", {
      form_token: formToken,
      received_origins: originValidation.receivedOrigins,
      allowed_origins: originValidation.allowedOrigins,
    });
    logPublicSubmitFailure(request, {
      reason: "domain_not_allowed",
      formToken,
      normalizedPhone,
    });

    return NextResponse.json(
      {
        ok: false,
        error: "domain_not_allowed",
        message: publicMessages.unavailable,
        received_origins: originValidation.receivedOrigins,
        allowed_origins: originValidation.allowedOrigins,
      },
      { status: 403 }
    );
  }

  const treatmentId = cleanText(payload.treatment_id, 80) || form.default_treatment_id;
  const allowedBranches = await getAllowedFormBranchIds(supabase, form);
  const allowedPackages = await getAllowedFormPackageIds(supabase, form);
  const submittedBranchId = cleanText(payload.branch_id, 80);
  const branchId =
    submittedBranchId ||
    (allowedBranches.branchIds.length === 1
      ? allowedBranches.branchIds[0]
      : allowedBranches.defaultBranchId);
  const packageId =
    cleanText(payload.package_id, 80) || allowedPackages.defaultPackageId;

  if (!branchId) {
    return rejectPublicSubmit(
      request,
      400,
      "branch_required",
      publicMessages.validation,
      { formToken, normalizedPhone }
    );
  }

  if (
    allowedBranches.branchIds.length > 0 &&
    !allowedBranches.branchIds.includes(branchId)
  ) {
    console.warn("[LaunchHub] branch_not_allowed_for_form", {
      form_token: formToken,
      form_id: form.id,
      branch_id: branchId,
      branch_source: allowedBranches.source,
    });
    return rejectPublicSubmit(
      request,
      400,
      "branch_not_allowed",
      publicMessages.validation,
      { formToken, normalizedPhone }
    );
  }

  if (
    allowedPackages.packageIds.length === 0 ||
    !allowedPackages.packageIds.includes(packageId)
  ) {
    console.warn("[LaunchHub] package_not_allowed_for_form", {
      form_token: formToken,
      form_id: form.id,
      package_id: packageId,
      package_source: allowedPackages.source,
    });
    return rejectPublicSubmit(
      request,
      400,
      "package_not_allowed",
      publicMessages.validation,
      { formToken, normalizedPhone }
    );
  }

  const [
    { data: packageRecord },
    { data: treatmentRecord },
    { data: branchRecord },
    { data: brandRecord },
  ] = await Promise.all([
      supabase
        .from("packages")
        .select("*")
        .eq("id", packageId)
        .eq("status", "active")
        .single(),
      supabase
        .from("treatments")
        .select("id, brand_id, name")
        .eq("id", treatmentId)
        .eq("brand_id", form.brand_id)
        .eq("status", "active")
        .single(),
      supabase
        .from("branches")
        .select("id, brand_id, name")
        .eq("id", branchId)
        .eq("brand_id", form.brand_id)
        .eq("status", "active")
        .single(),
      supabase
        .from("brands")
        .select("slug, name")
        .eq("id", form.brand_id)
        .maybeSingle(),
    ]);

  if (!packageRecord) {
    return rejectPublicSubmit(
      request,
      400,
      "invalid_package",
      publicMessages.validation,
      { formToken, normalizedPhone }
    );
  }

  if (!treatmentRecord) {
    return rejectPublicSubmit(
      request,
      400,
      "invalid_treatment",
      publicMessages.validation,
      { formToken, normalizedPhone }
    );
  }

  if (!branchRecord) {
    return rejectPublicSubmit(
      request,
      400,
      "invalid_branch",
      publicMessages.validation,
      { formToken, normalizedPhone }
    );
  }

  if (packageRecord.treatment_id !== treatmentId) {
    return rejectPublicSubmit(
      request,
      400,
      "package_treatment_mismatch",
      publicMessages.validation,
      { formToken, normalizedPhone }
    );
  }

  const paymentStatus = packageRecord.payment_required && payload.payment_option === "pay_now" ? "pending" : "booking_only";
  const packageDisplayPrice = packageRecord.promo_price ?? packageRecord.original_price ?? 0;
  const submittedAt = new Date().toISOString();
  const legalBrandRecord = (brandRecord ?? {}) as Record<string, unknown>;
  const legalProfile = getBrandLegalProfile({
    brandSlug: cleanText(legalBrandRecord.slug, 120) || "brand",
    brandName: cleanText(legalBrandRecord.name, 200) || "brand",
    legalPageUrl: cleanText(legalBrandRecord.legal_page_url, 2000),
    legalLinkLabel: cleanText(legalBrandRecord.legal_link_label, 120),
    operatorName: cleanText(legalBrandRecord.operator_name, 200),
  });
  const legalConsentPayload = {
    consent_event: "legal_consent_accepted",
    accepted_at: new Date().toISOString(),
    consent_text: LEGAL_CONSENT_TEXT,
    legal_page_url: legalProfile.legalPageUrl,
    legal_link_label: legalProfile.legalLinkLabel,
    privacy_policy_url: legalProfile.privacyPolicyUrl,
    terms_url: legalProfile.termsUrl,
    disclaimer_url: legalProfile.disclaimerUrl,
    form_token: formToken,
    landing_page_url: cleanText(submittedTouch.landing_page_url, 2000),
    current_page_url: currentPageUrl,
    request_origin: normalizeOrigin(request.headers.get("origin")),
    user_agent: shortUserAgent(request),
  };

  let captured;
  try {
    const submissionId = normalizedSubmissionId(payload.submission_id);
    const requestHash = publicCaptureRequestHash({
      formId: form.id, customerName, phone: normalizedPhone, email,
      treatmentId: cleanText(payload.treatment_id, 80) || "",
      packageId: cleanText(payload.package_id, 80) || "",
      branchId: cleanText(payload.branch_id, 80) || "",
      appointmentDate, appointmentTime, paymentOption: payload.payment_option ?? "booking_only",
    });
    const commonEvent = {
      visitor_id: cleanText(submittedTouch.visitor_id, 120),
      session_id: cleanText(submittedTouch.session_id, 120),
      page_url: currentPageUrl, referrer: cleanText(submittedTouch.referrer, 2000),
    };
    const sheetPayload = buildGoogleSheetsLeadPayload({
      brandId: form.brand_id, leadKey: "00000000-0000-4000-8000-000000000000", createdAt: submittedAt,
      customerName, phone: normalizedPhone, email, brandName: brandRecord?.name || "",
      formName: form.form_name || "", treatmentName: treatmentRecord.name || "",
      packageName: packageRecord.name || "", price: packageDisplayPrice, branchName: branchRecord.name || "",
      appointmentDate, appointmentTime, pageUrl: currentPageUrl, touch: submittedTouch,
    });
    // The projection contains display fields only, never webhook secrets/access tokens.
    sheetPayload.secret = "";
    captured = await persistPublicCapture({
      formId: form.id, submissionId, requestHash,
      contact: { customer_name: customerName, phone, normalized_phone: normalizedPhone, email },
      snapshot: {
      source_type: classification.sourceType,
      visitor_id: cleanText(submittedTouch.visitor_id, 120),
      session_id: cleanText(submittedTouch.session_id, 120),
      first_touch_json: resolvedAttribution.firstTouch,
      latest_touch_json: resolvedAttribution.latestTouch,
      submitted_touch_json: submittedTouch,
      raw_payload_json: createSanitizedAttributionPayload({
        traceId: attributionTraceId,
        sourceUsed: resolvedAttribution.sourceUsed,
        firstTouch: resolvedAttribution.firstTouch,
        latestTouch: resolvedAttribution.latestTouch,
        submittedTouch,
      }),
      utm_source: cleanText(submittedTouch.utm_source, 300),
      utm_medium: cleanText(submittedTouch.utm_medium, 300),
      utm_campaign: cleanText(submittedTouch.utm_campaign, 500),
      utm_id: cleanText(submittedTouch.utm_id, 300),
      utm_content: cleanText(submittedTouch.utm_content, 500),
      utm_term: cleanText(submittedTouch.utm_term, 500),
      fbclid: cleanText(submittedTouch.fbclid, 1000),
      gclid: cleanText(submittedTouch.gclid, 1000),
      ttclid: cleanText(submittedTouch.ttclid, 1000),
      msclkid: cleanText(submittedTouch.msclkid, 1000),
      wbraid: cleanText(submittedTouch.wbraid, 1000),
      gbraid: cleanText(submittedTouch.gbraid, 1000),
      referrer: cleanText(submittedTouch.referrer, 2000),
      landing_page_url: cleanText(submittedTouch.landing_page_url, 2000),
      current_page_url: currentPageUrl,
      page_path: cleanText(submittedTouch.page_path, 500),
      page_title: cleanText(submittedTouch.page_title, 500),
      source_capture_method: cleanText(submittedTouch.source_capture_method, 120),
      attribution_quality: classification.attributionQuality,
      tracking_status: classification.trackingStatus,
      audit_reason: classification.auditReason,
      ctwa_id: cleanText(submittedTouch.ctwa_id, 300),
      whatsapp_message_id: cleanText(submittedTouch.whatsapp_message_id, 300),
      whatsapp_conversation_id: cleanText(
        submittedTouch.whatsapp_conversation_id,
        300
      ),
      whatsapp_phone_number_id: cleanText(
        submittedTouch.whatsapp_phone_number_id,
        300
      ),
      meta_ad_id: cleanText(submittedTouch.meta_ad_id, 300),
      meta_adset_id: cleanText(submittedTouch.meta_adset_id, 300),
      meta_campaign_id: cleanText(submittedTouch.meta_campaign_id, 300),
      meta_source_url: cleanText(submittedTouch.meta_source_url, 2000),
      whatsapp_referral_headline: cleanText(
        submittedTouch.whatsapp_referral_headline,
        500
      ),
      whatsapp_referral_body: cleanText(submittedTouch.whatsapp_referral_body, 1000),
      whatsapp_referral_source_type: cleanText(
        submittedTouch.whatsapp_referral_source_type,
        120
      ),
      whatsapp_referral_source_id: cleanText(
        submittedTouch.whatsapp_referral_source_id,
        300
      ),
      first_seen_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    },
      lead: {
        source_type: classification.sourceType, form_id: form.id, brand_id: form.brand_id,
        treatment_id: treatmentId, package_id: packageRecord.id, branch_id: branchId,
        customer_name: customerName, phone, normalized_phone: normalizedPhone,
        appointment_date: appointmentDate, appointment_time: appointmentTime,
        price: packageDisplayPrice, currency: packageRecord.currency || "HKD", payment_status: paymentStatus,
      },
      events: [
        { ...commonEvent, event_type: "form_submit_success", event_payload_json: {
          source_type: classification.sourceType, is_duplicate: false,
          attribution_source_used: resolvedAttribution.sourceUsed, attribution_trace_id: attributionTraceId,
          proxy_cookie_present: resolvedAttribution.proxyCookiePresent,
        } },
        { ...commonEvent, event_type: "form_submit_success", event_payload_json: legalConsentPayload },
        { ...commonEvent, event_type: "booking_created", event_payload_json: {
          booking_status: "requested", created_by_source: classification.sourceType,
        } },
        ...(classification.sourceType === "organic_unknown" ? [{ ...commonEvent,
          event_type: "organic_source_assigned", event_payload_json: { audit_reason: classification.auditReason },
        }] : []),
      ],
      delivery: { enabled: process.env.GOOGLE_SHEETS_SYNC_ENABLED?.trim().toLowerCase() === "true", payload: sheetPayload },
      response: {
        form_id: form.id, event_id: cleanText(submittedTouch.client_event_id, 120) || "",
        conversion_mode: normalizeConversionMode(form.conversion_mode),
        success_redirect_url: typeof form.success_redirect_url === "string" ? form.success_redirect_url : null,
        value: Number(packageDisplayPrice), currency: packageRecord.currency || "HKD", source_type: classification.sourceType,
        tracking_status: classification.trackingStatus, audit_reason: classification.auditReason,
        attribution_trace_id: attributionTraceId,
      },
    });
  } catch (error) {
    const code = error instanceof PublicCaptureError ? error.code : "capture_transaction_unavailable";
    const status = code === "capture_duplicate_recent" ? 429 : code === "capture_idempotency_conflict" ? 409
      : ["capture_invalid_submission_id", "capture_form_changed", "capture_offer_changed", "capture_invalid_request", "capture_package_not_allowed", "capture_branch_not_allowed", "capture_invalid_events"].includes(code) ? 400 : 503;
    return rejectPublicSubmit(request, status, code,
      status === 429 ? publicMessages.duplicate : status === 409 ? "登記資料已更改，請重新載入表格後再試。" : status === 400 ? publicMessages.validation : publicMessages.unavailable,
      { formToken, normalizedPhone, attributionTraceId });
  }
  const receipt = captured.response;
  if (!captured.replayed && receipt.delivery_status === "pending") {
    // Acceptance is already durable. Google latency is isolated from the customer;
    // cron catches up if this bounded background attempt is interrupted.
    try {
      after(async () => {
        try { await processPublicLeadDeliveries({ deliveryId: receipt.delivery_id, limit: 1 }); }
        catch { console.error("public_lead_delivery_background_failed", { delivery_id: receipt.delivery_id }); }
      });
    } catch {
      // Scheduling is an optimization; the committed outbox remains available
      // to cron and must never turn accepted customer data into an error.
      console.error("public_lead_delivery_schedule_failed", { delivery_id: receipt.delivery_id });
    }
  }
  return acceptedCaptureResponse(receipt, attributionDebug);
}
