"use client";

import { useEffect, useState } from "react";
import {
  LOCKED_PUBLIC_ATTRIBUTION_STORAGE_KEY,
  hasPublicAttributionTracking,
  publicAttributionParamKeys,
} from "@/lib/attribution/publicAttributionCookie";
import {
  cleanMetaPixelId,
  isMetaPixelDebugEnabled,
  sendMetaPixelBeacon,
} from "@/lib/metaPixel/client";

type MetaPixelFunction = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[][];
  push?: MetaPixelFunction;
  loaded?: boolean;
  version?: string;
};

type MetaPixelWindow = Window & {
  fbq?: MetaPixelFunction;
  _fbq?: MetaPixelFunction;
  __launchhubMetaPixelScriptInjected?: boolean;
  __launchhubMetaPixelScriptLoaded?: boolean;
  __launchhubMetaPixelInitialized?: Record<string, boolean>;
  __launchhubMetaPixelPageViewRequested?: Record<string, boolean>;
  __launchhubMetaPixelPageViewFbqAttempted?: Record<string, boolean>;
  __launchhubMetaPixelPageViewBeaconUrl?: Record<string, string | null>;
  __launchhubMetaPixelLastError?: string | null;
  __launchhubTestCompleteRegistration?: () => void;
};

type PixelDebugState = {
  pixelId: string | null;
  debugEnabled: boolean;
  componentMounted: boolean;
  scriptInjected: boolean;
  scriptLoaded: boolean;
  fbqType: string;
  fbqLoaded: boolean;
  fbqVersion: string;
  pageViewQueuedOrFired: boolean;
  fbqPageViewAttempted: boolean;
  fallbackPageViewBeaconUrl: string | null;
  lastError: string | null;
};

const fbeventsSrc = "https://connect.facebook.net/en_US/fbevents.js";
const scriptSelector = 'script[data-launchhub-meta-pixel="true"]';

function getWindowDebugState(
  windowRef: MetaPixelWindow,
  pixelId: string | null,
  debugEnabled: boolean,
  componentMounted = true
): PixelDebugState {
  return {
    pixelId,
    debugEnabled,
    componentMounted,
    scriptInjected: Boolean(windowRef.__launchhubMetaPixelScriptInjected),
    scriptLoaded: Boolean(windowRef.__launchhubMetaPixelScriptLoaded),
    fbqType: typeof windowRef.fbq,
    fbqLoaded: Boolean(windowRef.fbq?.loaded),
    fbqVersion: windowRef.fbq?.version ?? "",
    pageViewQueuedOrFired: Boolean(
      pixelId && windowRef.__launchhubMetaPixelPageViewRequested?.[pixelId]
    ),
    fbqPageViewAttempted: Boolean(
      pixelId && windowRef.__launchhubMetaPixelPageViewFbqAttempted?.[pixelId]
    ),
    fallbackPageViewBeaconUrl: pixelId
      ? windowRef.__launchhubMetaPixelPageViewBeaconUrl?.[pixelId] ?? null
      : null,
    lastError: windowRef.__launchhubMetaPixelLastError ?? null,
  };
}

function isPixelDebugEnabled(initialQueryString = "") {
  if (isMetaPixelDebugEnabled()) return true;

  try {
    return new URLSearchParams(initialQueryString).get("pixel_debug") === "1";
  } catch {
    return false;
  }
}

function debugPixel(message: string, state: PixelDebugState) {
  if (state.debugEnabled) {
    console.info("[LaunchHub] Meta Pixel", message, state);
  }
}

function safeJsonParse(value: string | null) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function getLockedAttributionPageUrl() {
  try {
    const locked = safeJsonParse(
      window.localStorage.getItem(LOCKED_PUBLIC_ATTRIBUTION_STORAGE_KEY)
    ) as Record<string, unknown> | null;

    if (!hasPublicAttributionTracking(locked)) return "";

    return (
      getString(locked?.current_page_url) ||
      getString(locked?.landing_page_url)
    );
  } catch {
    return "";
  }
}

function urlHasTracking(value: string | undefined) {
  if (!value) return false;

  try {
    const parsed = new URL(value);
    return publicAttributionParamKeys.some((key) =>
      Boolean(parsed.searchParams.get(key))
    );
  } catch {
    return false;
  }
}

function installOfficialCompatibleFbq(windowRef: MetaPixelWindow) {
  if (typeof windowRef.fbq === "function") return windowRef.fbq;

  const fbq = function metaPixelQueue(...args: unknown[]) {
    if (fbq.callMethod) {
      fbq.callMethod(...args);
      return;
    }

    fbq.queue?.push(args);
  } as MetaPixelFunction;

  if (!windowRef._fbq) windowRef._fbq = fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  windowRef.fbq = fbq;

  return fbq;
}

function ensureFbeventsScript(
  windowRef: MetaPixelWindow,
  onLoaded: () => void,
  onFailed: (message: string) => void
) {
  const existingScript = document.querySelector<HTMLScriptElement>(scriptSelector);

  if (windowRef.__launchhubMetaPixelScriptLoaded) {
    onLoaded();
    return;
  }

  if (existingScript) {
    windowRef.__launchhubMetaPixelScriptInjected = true;
    existingScript.addEventListener("load", onLoaded, { once: true });
    existingScript.addEventListener(
      "error",
      () => onFailed("fbevents.js failed to load"),
      { once: true }
    );
    return;
  }

  const script = document.createElement("script");
  script.async = true;
  script.src = fbeventsSrc;
  script.dataset.launchhubMetaPixel = "true";
  script.onload = () => {
    windowRef.__launchhubMetaPixelScriptLoaded = true;
    onLoaded();
  };
  script.onerror = () => {
    onFailed("fbevents.js failed to load");
  };

  windowRef.__launchhubMetaPixelScriptInjected = true;

  const firstScript = document.getElementsByTagName("script")[0];
  if (firstScript?.parentNode) {
    firstScript.parentNode.insertBefore(script, firstScript);
  } else {
    document.head.appendChild(script);
  }
}

function requestPageView(windowRef: MetaPixelWindow, pixelId: string) {
  const fbq = windowRef.fbq;
  if (typeof fbq !== "function") {
    throw new Error("fbq is not available after fbevents.js load");
  }

  windowRef.__launchhubMetaPixelInitialized ??= {};
  windowRef.__launchhubMetaPixelPageViewRequested ??= {};
  windowRef.__launchhubMetaPixelPageViewFbqAttempted ??= {};
  windowRef.__launchhubMetaPixelPageViewBeaconUrl ??= {};

  if (!windowRef.__launchhubMetaPixelInitialized[pixelId]) {
    fbq("init", pixelId);
    windowRef.__launchhubMetaPixelInitialized[pixelId] = true;
  }

  if (!windowRef.__launchhubMetaPixelPageViewRequested[pixelId]) {
    fbq("track", "PageView");
    windowRef.__launchhubMetaPixelPageViewFbqAttempted[pixelId] = true;

    windowRef.__launchhubMetaPixelPageViewRequested[pixelId] = true;
  }
}

function requestPageViewBeacon(
  windowRef: MetaPixelWindow,
  pixelId: string,
  pageUrl?: string
) {
  windowRef.__launchhubMetaPixelPageViewBeaconUrl ??= {};
  const beaconResult = sendMetaPixelBeacon({
    pixelId,
    eventName: "PageView",
    eventKey: `pageview:${pageUrl || window.location.href}`,
    pageUrl,
  });
  windowRef.__launchhubMetaPixelPageViewBeaconUrl[pixelId] = beaconResult.url;
}

export function MetaPixelPageView({
  pixelId,
  preservedPageUrl,
  initialQueryString = "",
}: {
  pixelId: string | null;
  preservedPageUrl?: string;
  initialQueryString?: string;
}) {
  const safePixelId = cleanMetaPixelId(pixelId);
  const [debugState, setDebugState] = useState<PixelDebugState>({
    pixelId: safePixelId,
    debugEnabled: false,
    componentMounted: false,
    scriptInjected: false,
    scriptLoaded: false,
    fbqType: "undefined",
    fbqLoaded: false,
    fbqVersion: "",
    pageViewQueuedOrFired: false,
    fbqPageViewAttempted: false,
    fallbackPageViewBeaconUrl: null,
    lastError: null,
  });

  useEffect(() => {
    const windowRef = window as MetaPixelWindow;
    const enabled = isPixelDebugEnabled(initialQueryString);
    const cleanedInitialQuery = initialQueryString.trim();
    const initialSearch = cleanedInitialQuery
      ? cleanedInitialQuery.startsWith("?")
        ? cleanedInitialQuery
        : `?${cleanedInitialQuery}`
      : "";
    const lockedPageUrl = getLockedAttributionPageUrl();
    const pageViewUrl =
      (urlHasTracking(preservedPageUrl) ? preservedPageUrl : "") ||
      lockedPageUrl ||
      `${window.location.origin}${window.location.pathname}${initialSearch}${window.location.hash}`;

    function publishDebug(message: string) {
      const nextState = getWindowDebugState(windowRef, safePixelId, enabled);
      queueMicrotask(() => setDebugState(nextState));
      debugPixel(message, nextState);
    }

    if (!safePixelId) {
      windowRef.__launchhubMetaPixelLastError = "missing_pixel_id";
      publishDebug("skipped");
      return;
    }

    windowRef.__launchhubMetaPixelLastError = null;
    installOfficialCompatibleFbq(windowRef);
    requestPageViewBeacon(windowRef, safePixelId, pageViewUrl);
    publishDebug("component mounted");

    ensureFbeventsScript(
      windowRef,
      () => {
        try {
          windowRef.__launchhubMetaPixelScriptLoaded = true;
          requestPageView(windowRef, safePixelId);

          if (enabled) {
            windowRef.__launchhubTestCompleteRegistration = () => {
              windowRef.fbq?.("track", "CompleteRegistration", {
                value: 388,
                currency: "HKD",
                content_category: "registration",
              });
              sendMetaPixelBeacon({
                pixelId: safePixelId,
                eventName: "CompleteRegistration",
                value: 388,
                currency: "HKD",
                contentCategory: "registration",
                eventKey: `debug-complete-registration:${Date.now()}`,
                pageUrl: pageViewUrl,
              });
            };
          }

          publishDebug("fbevents loaded and PageView requested");
        } catch (error) {
          windowRef.__launchhubMetaPixelLastError =
            error instanceof Error ? error.message : "unknown_pixel_error";
          publishDebug("PageView failed");
        }
      },
      (message) => {
        windowRef.__launchhubMetaPixelLastError = message;
        publishDebug("script load failed");
      }
    );
    publishDebug("script injection requested");
  }, [initialQueryString, preservedPageUrl, safePixelId]);

  if (!safePixelId) return null;

  return (
    <>
      {debugState.debugEnabled && (
        <aside className="fixed bottom-4 left-4 z-[1000] max-w-xs rounded-2xl border border-[#f3c8dd] bg-white/95 p-4 text-xs font-semibold leading-5 text-[#5a2348] shadow-[0_18px_50px_rgba(90,35,72,0.18)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#d85ba3]">
            Meta Pixel Debug
          </p>
          <dl className="mt-3 grid gap-1">
            <DebugRow label="Pixel ID" value={debugState.pixelId ?? "missing"} />
            <DebugRow
              label="Component mounted"
              value={debugState.componentMounted ? "yes" : "no"}
            />
            <DebugRow
              label="fbevents.js injected"
              value={debugState.scriptInjected ? "yes" : "no"}
            />
            <DebugRow
              label="fbevents.js loaded"
              value={debugState.scriptLoaded ? "yes" : "no"}
            />
            <DebugRow label="fbq available" value={debugState.fbqType} />
            <DebugRow label="fbq.loaded" value={debugState.fbqLoaded ? "true" : "false"} />
            <DebugRow label="fbq.version" value={debugState.fbqVersion || "-"} />
            <DebugRow
              label="PageView requested"
              value={debugState.pageViewQueuedOrFired ? "yes" : "no"}
            />
            <DebugRow
              label="fbq PageView attempted"
              value={debugState.fbqPageViewAttempted ? "yes" : "no"}
            />
            <DebugRow
              label="PageView beacon URL"
              value={debugState.fallbackPageViewBeaconUrl || "not created"}
            />
            <DebugRow label="Last error" value={debugState.lastError ?? "-"} />
          </dl>
        </aside>
      )}

      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${safePixelId}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}

function DebugRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-3">
      <dt className="text-[#8c5d75]">{label}</dt>
      <dd className="max-w-[140px] truncate text-right text-[#321428]" title={value}>
        {value}
      </dd>
    </div>
  );
}
