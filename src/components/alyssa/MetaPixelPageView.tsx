"use client";

import { useEffect } from "react";

type MetaPixelWindow = Window & {
  fbq?: MetaPixelFunction;
  _fbq?: MetaPixelFunction;
  __launchhubMetaPixelInitialized?: Record<string, boolean>;
  __launchhubMetaPixelPageViewSent?: Record<string, boolean>;
};

type MetaPixelFunction = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[][];
  push?: MetaPixelFunction;
  loaded?: boolean;
  version?: string;
};

const fbeventsSrc = "https://connect.facebook.net/en_US/fbevents.js";

function cleanPixelId(pixelId: string | null | undefined) {
  const cleaned = pixelId?.replace(/[^0-9]/g, "") ?? "";
  return cleaned || null;
}

function shouldDebugPixel() {
  if (process.env.NODE_ENV === "development") return true;

  try {
    return new URLSearchParams(window.location.search).get("pixel_debug") === "1";
  } catch {
    return false;
  }
}

function debugPixel(message: string, data: Record<string, unknown>) {
  if (shouldDebugPixel()) {
    console.info("[LaunchHub] Meta Pixel", message, data);
  }
}

function ensureMetaPixelBase(windowRef: MetaPixelWindow) {
  if (typeof windowRef.fbq === "function") {
    return windowRef.fbq;
  }

  const fbq = function metaPixelQueue(...args: unknown[]) {
    if (fbq.callMethod) {
      fbq.callMethod(...args);
      return;
    }

    fbq.queue?.push(args);
  } as MetaPixelFunction;

  fbq.queue = [];
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";

  windowRef.fbq = fbq;
  windowRef._fbq = fbq;

  return fbq;
}

function ensureFbeventsScript() {
  if (document.querySelector(`script[src="${fbeventsSrc}"]`)) return;

  const script = document.createElement("script");
  script.async = true;
  script.src = fbeventsSrc;
  document.head.appendChild(script);
}

export function MetaPixelPageView({ pixelId }: { pixelId: string | null }) {
  const safePixelId = cleanPixelId(pixelId);

  useEffect(() => {
    if (!safePixelId) {
      debugPixel("skipped", { reason: "missing_pixel_id" });
      return;
    }

    const windowRef = window as MetaPixelWindow;
    const fbq = ensureMetaPixelBase(windowRef);
    ensureFbeventsScript();

    windowRef.__launchhubMetaPixelInitialized ??= {};
    windowRef.__launchhubMetaPixelPageViewSent ??= {};

    if (!windowRef.__launchhubMetaPixelInitialized[safePixelId]) {
      fbq("init", safePixelId);
      windowRef.__launchhubMetaPixelInitialized[safePixelId] = true;
      debugPixel("init", { pixelId: safePixelId, fbqDefined: typeof windowRef.fbq });
    }

    if (!windowRef.__launchhubMetaPixelPageViewSent[safePixelId]) {
      fbq("track", "PageView");
      windowRef.__launchhubMetaPixelPageViewSent[safePixelId] = true;
      debugPixel("PageView fired", {
        pixelId: safePixelId,
        fbqDefined: typeof windowRef.fbq,
      });
    }
  }, [safePixelId]);

  if (!safePixelId) return null;

  return (
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
  );
}
