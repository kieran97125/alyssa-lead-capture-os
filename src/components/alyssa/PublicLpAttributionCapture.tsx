"use client";

import { useEffect, useState } from "react";

const attributionKeys = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_id",
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
  "ctwa_id",
  "ctwa_clid",
  "meta_ad_id",
  "meta_adset_id",
  "meta_campaign_id",
  "placement",
  "whatsapp_referral_source_id",
] as const;

type AttributionDebugState = {
  href: string;
  search: string;
  initialSearch: string;
  currentPageUrl: string;
  landingPageUrl: string;
  captured: Record<string, string>;
  hasAttributionParams: boolean;
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
  return output;
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

export function PublicLpAttributionCapture({
  formToken,
  formId,
  brandSlug,
  initialQueryString = "",
}: {
  formToken: string;
  formId: string;
  brandSlug: string;
  initialQueryString?: string;
}) {
  const [debugState, setDebugState] = useState<AttributionDebugState | null>(
    null
  );

  useEffect(() => {
    const effectiveUrl = createEffectiveUrl(initialQueryString);
    const searchParams = new URLSearchParams(effectiveUrl.search);
    const paramPayload = pickSourceParams(searchParams);
    const debugEnabled = searchParams.get("attribution_debug") === "1";

    if (debugEnabled) {
      queueMicrotask(() =>
        setDebugState({
          href: window.location.href,
          search: window.location.search,
          initialSearch: initialQueryString,
          currentPageUrl: effectiveUrl.href,
          landingPageUrl: effectiveUrl.href,
          captured: paramPayload,
          hasAttributionParams: Object.keys(paramPayload).length > 0,
        })
      );
    }

    if (Object.keys(paramPayload).length === 0) return;

    const visitorId =
      readStorage("alyssa_visitor_id", window.localStorage) || createId("vis");
    const sessionId =
      readStorage("alyssa_session_id", window.sessionStorage) || createId("ses");
    const payload = {
      source_capture_method: "public_landing_page",
      visitor_id: visitorId,
      session_id: sessionId,
      brand: brandSlug,
      form_id: formId,
      form_token: formToken,
      parent_origin: window.location.origin,
      referrer: document.referrer || "",
      landing_page_url: effectiveUrl.href,
      current_page_url: effectiveUrl.href,
      page_path: window.location.pathname,
      page_title: document.title || "",
      captured_at: new Date().toISOString(),
      ...paramPayload,
    };

    writeStorage("alyssa_first_touch", payload, window.localStorage);
    writeStorage("alyssa_latest_touch", payload, window.sessionStorage);
    writeStorage("alyssa_visitor_id", visitorId, window.localStorage);
    writeStorage("alyssa_session_id", sessionId, window.sessionStorage);
  }, [brandSlug, formId, formToken, initialQueryString]);

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
          label="current_page_url"
          value={debugState.currentPageUrl}
        />
        <DebugRow
          label="landing_page_url"
          value={debugState.landingPageUrl}
        />
        {attributionKeys.map((key) => (
          <DebugRow key={key} label={key} value={debugState.captured[key] || ""} />
        ))}
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
