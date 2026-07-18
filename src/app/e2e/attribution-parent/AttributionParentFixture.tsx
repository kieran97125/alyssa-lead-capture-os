"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "gclid",
  "ctwa_id",
  "campaign_id",
  "adset_id",
  "ad_id",
  "placement",
  "meta_campaign_id",
  "meta_adset_id",
  "meta_ad_id",
] as const;

function buildTouch() {
  const url = new URL(window.location.href);
  const touch: Record<string, string> = {
    source_capture_method: "wix_page_code",
    attribution_source_used: "wix_parent_bridge",
    parent_url: url.toString(),
    current_page_url: url.toString(),
    landing_page_url: url.toString(),
    parent_origin: url.origin,
    page_path: url.pathname,
    captured_at: new Date().toISOString(),
  };

  ATTRIBUTION_KEYS.forEach((key) => {
    const value = url.searchParams.get(key)?.trim();
    if (value) touch[key] = value;
  });

  return touch;
}

export function AttributionParentFixture() {
  const htmlFrameRef = useRef<HTMLIFrameElement>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const srcDoc = useMemo(() => {
    if (!origin) return "";

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <style>html,body{margin:0;padding:0;width:100%;background:#fff}#launchhub-e2e-form{width:100%}</style>
  </head>
  <body>
    <div id="launchhub-e2e-form"></div>
    <script
      src="${origin}/embed/alyssa-form.js?v=e2e-attribution"
      data-form-token="alyssa-main-form-dev-token"
      data-brand="alyssa"
      data-form-id="alyssa-main-form"
      data-target="#launchhub-e2e-form"
      data-lazy-load="false"
      data-height="980"
    ></script>
  </body>
</html>`;
  }, [origin]);

  useEffect(() => {
    if (!origin) return;

    const sendAttribution = () => {
      const frameWindow = htmlFrameRef.current?.contentWindow;
      if (!frameWindow) return;
      const touch = buildTouch();
      frameWindow.postMessage(
        {
          type: "launchhub_attribution_payload",
          schema_version: 1,
          payload: {
            first_touch_json: touch,
            latest_touch_json: touch,
            submitted_touch_json: touch,
          },
        },
        origin
      );
    };

    const onMessage = (event: MessageEvent) => {
      if (event.source !== htmlFrameRef.current?.contentWindow) return;
      if (event.origin !== origin) return;
      if (event.data?.type !== "launchhub_wix_attribution_ready") return;
      sendAttribution();
    };

    window.addEventListener("message", onMessage);
    const timers = [150, 500, 1200].map((delay) =>
      window.setTimeout(sendAttribution, delay)
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("message", onMessage);
    };
  }, [origin]);

  if (!srcDoc) return <p>Loading fixture…</p>;

  return (
    <main className="min-h-screen bg-white p-4">
      <h1 className="mb-3 text-lg font-bold">Wix attribution bridge fixture</h1>
      <iframe
        ref={htmlFrameRef}
        title="Wix HTML Component"
        srcDoc={srcDoc}
        className="h-[1200px] w-full border-0"
      />
    </main>
  );
}
