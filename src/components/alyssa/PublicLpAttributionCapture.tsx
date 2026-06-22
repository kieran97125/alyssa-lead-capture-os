"use client";

import { useEffect } from "react";

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

export function PublicLpAttributionCapture({
  formToken,
  formId,
  brandSlug,
}: {
  formToken: string;
  formId: string;
  brandSlug: string;
}) {
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const paramPayload = pickSourceParams(searchParams);

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
      landing_page_url: window.location.href,
      current_page_url: window.location.href,
      page_path: window.location.pathname,
      page_title: document.title || "",
      captured_at: new Date().toISOString(),
      ...paramPayload,
    };

    writeStorage("alyssa_first_touch", payload, window.localStorage);
    writeStorage("alyssa_latest_touch", payload, window.sessionStorage);
    writeStorage("alyssa_visitor_id", visitorId, window.localStorage);
    writeStorage("alyssa_session_id", sessionId, window.sessionStorage);
  }, [brandSlug, formId, formToken]);

  return null;
}
