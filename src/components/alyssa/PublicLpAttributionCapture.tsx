"use client";

import { useEffect, useState } from "react";
import {
  LOCKED_PUBLIC_ATTRIBUTION_STORAGE_KEY,
  PUBLIC_ATTRIBUTION_COOKIE_NAME,
  chooseBestPublicAttribution,
  decodePublicAttributionCookie,
  hasPublicAttributionTracking,
  normalizePublicAttributionFields,
  publicAttributionParamKeys,
} from "@/lib/attribution/publicAttributionCookie";

const attributionKeys = [...publicAttributionParamKeys, "utm_id"] as const;

const trackingRestoreKeys = [
  ...publicAttributionParamKeys,
  "utm_id",
] as const;

const queryRestoreKeys = [
  ...trackingRestoreKeys,
  "pixel_debug",
  "attribution_debug",
  "v",
] as const;

type AttributionDebugState = {
  href: string;
  search: string;
  initialSearch: string;
  currentPageUrl: string;
  landingPageUrl: string;
  restoredUrl: string;
  sourceUsed:
    | "live"
    | "initialSearch"
    | "locked_attribution"
    | "server_initial"
    | "proxy_cookie"
    | "none";
  proxyCookieStatus: "present" | "absent";
  pageViewDlUrl: string;
  completeRegistrationDlUrl: string;
  captured: Record<string, string>;
  hasAttributionParams: boolean;
  lockedAttributionPresent: boolean;
  lockedAttributionHasTracking: boolean;
  lockedCaptured: Record<string, string>;
  downgradeBlocked: boolean;
};

function readStorage(key: string, storage: Storage) {
  try {
    const value = storage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: unknown, storage: Storage) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
  }
}

function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2)}`;
}

function pickSourceParams(searchParams: URLSearchParams) {
  const output: Record<string, string> = {};
  attributionKeys.forEach((key) => {
    const value = searchParams.get(key);
    if (value) output[key] = value;
  });
  return normalizePublicAttributionFields(output);
}

function pickCookieSourceParams(value: Record<string, unknown>) {
  const output: Record<string, string> = {};
  publicAttributionParamKeys.forEach((key) => {
    const item = value[key];
    if (typeof item === "string" && item.trim()) output[key] = item;
  });
  return normalizePublicAttributionFields(output);
}

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function getServerInitialAttribution(
  value: Record<string, unknown> | null | undefined
) {
  const normalized = normalizePublicAttributionFields(value);
  return normalized && hasPublicAttributionTracking(normalized)
    ? normalized
    : null;
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

function readProxyAttributionCookie() {
  return decodePublicAttributionCookie(
    readCookie(PUBLIC_ATTRIBUTION_COOKIE_NAME)
  );
}

function createEffectiveUrl(initialQueryString: string) {
  const cleanedInitialQuery = initialQueryString.trim();
  const hasLiveSearch = Boolean(window.location.search);
  const effectiveSearch =
    hasLiveSearch || !cleanedInitialQuery
      ? window.location.search
      : cleanedInitialQuery.startsWith("?")
        ? cleanedInitialQuery
        : `?${cleanedInitialQuery}`;

  return {
    href: `${window.location.origin}${window.location.pathname}${effectiveSearch}${window.location.hash}`,
    search: effectiveSearch,
  };
}

function getTrackingTouch(
  value: Record<string, unknown> | null | undefined
) {
  const normalized = normalizePublicAttributionFields(value);
  return normalized && hasPublicAttributionTracking(normalized)
    ? normalized
    : null;
}

function createLockedPayload({
  source,
  sourceUsed,
  formToken,
  formId,
  brandSlug,
  visitorId,
  sessionId,
  capturedPageUrl,
  pagePath,
  paramPayload,
}: {
  source: Record<string, unknown> | null;
  sourceUsed: string;
  formToken: string;
  formId: string;
  brandSlug: string;
  visitorId: string;
  sessionId: string;
  capturedPageUrl: string;
  pagePath: string;
  paramPayload: Record<string, string>;
}) {
  return {
    ...(source || {}),
    source_capture_method:
      sourceUsed === "server_initial"
        ? "server_public_lp_initial_search"
        : "public_landing_page_locked_first_touch",
    attribution_source_used: "locked_attribution",
    visitor_id: visitorId,
    session_id: sessionId,
    brand: brandSlug,
    form_id: formId,
    form_token: formToken,
    parent_origin: window.location.origin,
    referrer: document.referrer || "",
    landing_page_url: capturedPageUrl,
    current_page_url: capturedPageUrl,
    page_path: pagePath,
    page_title: document.title || "",
    captured_at: getString(source?.captured_at) || new Date().toISOString(),
    ...paramPayload,
  };
}

function restoreMissingPublicLpQueryParams(initialQueryString: string) {
  if (!window.location.pathname.startsWith("/lp/")) return "";

  const initialParams = new URLSearchParams(initialQueryString);
  const hasInitialTracking = trackingRestoreKeys.some((key) =>
    initialParams.has(key)
  );

  if (!hasInitialTracking) return "";

  const currentUrl = new URL(window.location.href);
  let changed = false;

  queryRestoreKeys.forEach((key) => {
    if (!initialParams.has(key) || currentUrl.searchParams.has(key)) return;

    initialParams.getAll(key).forEach((value) => {
      currentUrl.searchParams.append(key, value);
    });
    changed = true;
  });

  if (!changed) return "";

  const restoredUrl = currentUrl.toString();
  window.history.replaceState(window.history.state, "", restoredUrl);
  return restoredUrl;
}

export function PublicLpAttributionCapture({
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
}) {
  const [debugState, setDebugState] = useState<AttributionDebugState | null>(
    null
  );

  useEffect(() => {
    const restoredUrl = restoreMissingPublicLpQueryParams(initialQueryString);
    const effectiveUrl = createEffectiveUrl(initialQueryString);
    const searchParams = new URLSearchParams(effectiveUrl.search);
    const proxyCookie = readProxyAttributionCookie();
    const serverAttribution = getServerInitialAttribution(
      serverInitialAttribution
    );
    const lockedSessionStored = getTrackingTouch(
      readStorage(LOCKED_PUBLIC_ATTRIBUTION_STORAGE_KEY, window.sessionStorage)
    );
    const lockedLocalStored = getTrackingTouch(
      readStorage(LOCKED_PUBLIC_ATTRIBUTION_STORAGE_KEY, window.localStorage)
    );
    const lockedStored = chooseBestPublicAttribution([
      lockedSessionStored,
      lockedLocalStored,
    ]);
    const firstStored = getTrackingTouch(
      readStorage("alyssa_first_touch", window.localStorage)
    );
    const latestStored = getTrackingTouch(
      readStorage("alyssa_latest_touch", window.sessionStorage)
    );
    const liveOrInitialPayload = pickSourceParams(searchParams);
    const hasLiveOrInitialParams = Object.keys(liveOrInitialPayload).length > 0;
    const liveAttribution = hasLiveOrInitialParams
      ? {
          current_page_url: effectiveUrl.href,
          landing_page_url: effectiveUrl.href,
          page_path: window.location.pathname,
          ...liveOrInitialPayload,
        }
      : null;
    const selectedTrackingAttribution = chooseBestPublicAttribution([
      lockedStored,
      liveAttribution,
      serverAttribution,
      latestStored,
      firstStored,
      proxyCookie,
    ]);
    const downgradeBlocked = Boolean(
      selectedTrackingAttribution &&
        !hasLiveOrInitialParams &&
        (window.location.search || initialQueryString)
    );
    const useLockedAttribution =
      selectedTrackingAttribution && selectedTrackingAttribution === lockedStored;
    const useServerAttribution =
      selectedTrackingAttribution && selectedTrackingAttribution === serverAttribution;
    const useProxyCookie =
      selectedTrackingAttribution &&
      !useServerAttribution &&
      !useLockedAttribution &&
      selectedTrackingAttribution === proxyCookie &&
      proxyCookie &&
      hasPublicAttributionTracking(proxyCookie);
    const paramPayload = selectedTrackingAttribution
      ? pickCookieSourceParams(selectedTrackingAttribution)
      : liveOrInitialPayload;
    const capturedPageUrl = selectedTrackingAttribution
      ? getString(selectedTrackingAttribution.current_page_url) ||
        getString(selectedTrackingAttribution.landing_page_url) ||
        effectiveUrl.href
      : effectiveUrl.href;
    const sourceUsed = useLockedAttribution
      ? "locked_attribution"
      : useServerAttribution
        ? "server_initial"
        : useProxyCookie
          ? "proxy_cookie"
          : restoredUrl
            ? "initialSearch"
            : hasLiveOrInitialParams
              ? "live"
              : initialQueryString
                ? "initialSearch"
                : "none";
    const pagePath =
      getString(selectedTrackingAttribution?.page_path) ||
      proxyCookie?.page_path ||
      window.location.pathname;
    const debugEnabled = searchParams.get("attribution_debug") === "1";

    if (debugEnabled) {
      queueMicrotask(() =>
        setDebugState({
          href: window.location.href,
          search: window.location.search,
          initialSearch: initialQueryString,
          currentPageUrl: capturedPageUrl,
          landingPageUrl: capturedPageUrl,
          restoredUrl,
          sourceUsed,
          proxyCookieStatus: proxyCookie ? "present" : "absent",
          pageViewDlUrl: capturedPageUrl,
          completeRegistrationDlUrl: capturedPageUrl,
          captured: paramPayload,
          hasAttributionParams: Object.keys(paramPayload).length > 0,
          lockedAttributionPresent: Boolean(selectedTrackingAttribution),
          lockedAttributionHasTracking:
            hasPublicAttributionTracking(selectedTrackingAttribution),
          lockedCaptured: selectedTrackingAttribution
            ? pickCookieSourceParams(selectedTrackingAttribution)
            : {},
          downgradeBlocked,
        })
      );
    }

    if (Object.keys(paramPayload).length === 0) return;

    const visitorId =
      readStorage("alyssa_visitor_id", window.localStorage) || createId("vis");
    const sessionId =
      readStorage("alyssa_session_id", window.sessionStorage) || createId("ses");
    const payload =
      useLockedAttribution && lockedStored
        ? lockedStored
        : createLockedPayload({
            source: selectedTrackingAttribution,
            sourceUsed,
            formToken,
            formId,
            brandSlug,
            visitorId,
            sessionId,
            capturedPageUrl,
            pagePath,
            paramPayload,
          });

    if (!lockedStored) {
      writeStorage(
        LOCKED_PUBLIC_ATTRIBUTION_STORAGE_KEY,
        payload,
        window.sessionStorage
      );
      writeStorage(
        LOCKED_PUBLIC_ATTRIBUTION_STORAGE_KEY,
        payload,
        window.localStorage
      );
    }
    writeStorage("alyssa_first_touch", payload, window.localStorage);
    writeStorage("alyssa_latest_touch", payload, window.sessionStorage);
    writeStorage("alyssa_visitor_id", visitorId, window.localStorage);
    writeStorage("alyssa_session_id", sessionId, window.sessionStorage);

    const restoreTimers = [250, 1000, 2500].map((delay) =>
      window.setTimeout(() => {
        restoreMissingPublicLpQueryParams(initialQueryString);
      }, delay)
    );

    return () => {
      restoreTimers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [brandSlug, formId, formToken, initialQueryString, serverInitialAttribution]);

  if (!debugState) return null;

  return (
    <aside className="fixed bottom-4 left-4 z-50 max-w-md rounded-2xl border border-amber-200 bg-white/95 p-4 text-xs font-semibold text-slate-800 shadow-2xl backdrop-blur">
      <p className="text-sm font-bold text-amber-700">Attribution debug</p>
      <dl className="mt-3 grid gap-2">
        <DebugRow label="href" value={debugState.href} />
        <DebugRow label="search" value={debugState.search || "(empty)"} />
        <DebugRow
          label="initial search"
          value={debugState.initialSearch || "(empty)"}
        />
        <DebugRow
          label="has params"
          value={debugState.hasAttributionParams ? "yes" : "no"}
        />
        <DebugRow
          label="locked attribution present"
          value={debugState.lockedAttributionPresent ? "yes" : "no"}
        />
        <DebugRow
          label="locked attribution has tracking"
          value={debugState.lockedAttributionHasTracking ? "yes" : "no"}
        />
        <DebugRow
          label="downgrade blocked"
          value={debugState.downgradeBlocked ? "yes" : "no"}
        />
        <DebugRow
          label="current_page_url"
          value={debugState.currentPageUrl}
        />
        <DebugRow
          label="landing_page_url"
          value={debugState.landingPageUrl}
        />
        <DebugRow label="restored URL" value={debugState.restoredUrl || "-"} />
        <DebugRow label="source used" value={debugState.sourceUsed} />
        <DebugRow
          label="proxy cookie"
          value={debugState.proxyCookieStatus}
        />
        <DebugRow label="PageView dl URL" value={debugState.pageViewDlUrl} />
        <DebugRow
          label="CompleteRegistration dl URL"
          value={debugState.completeRegistrationDlUrl}
        />
        {attributionKeys.map((key) => (
          <DebugRow key={key} label={key} value={debugState.captured[key] || ""} />
        ))}
        <DebugRow
          label="locked utm_source"
          value={debugState.lockedCaptured.utm_source || ""}
        />
        <DebugRow
          label="locked utm_campaign"
          value={debugState.lockedCaptured.utm_campaign || ""}
        />
        <DebugRow
          label="locked utm_content"
          value={debugState.lockedCaptured.utm_content || ""}
        />
        <DebugRow
          label="locked fbclid"
          value={debugState.lockedCaptured.fbclid || ""}
        />
      </dl>
    </aside>
  );
}

function DebugRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <dt className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
        {label}
      </dt>
      <dd className="break-all rounded-xl bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-900">
        {value || "-"}
      </dd>
    </div>
  );
}
