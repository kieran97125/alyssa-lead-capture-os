"use client";

import { useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { PublicLeadForm } from "@/components/alyssa/PublicLeadForm";

type ConversionMode = "form_submit_pixel" | "thank_you_redirect";

function normalizeOrigin(value: string | null) {
  if (!value) return "";

  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function normalizeConversionMode(value: string | null): ConversionMode | undefined {
  return value === "thank_you_redirect" ? "thank_you_redirect" : undefined;
}

export default function EmbedFormPage() {
  const params = useParams<{ formToken: string }>();
  const searchParams = useSearchParams();
  const formToken = params.formToken;

  useEffect(() => {
    if (typeof window === "undefined") return;

    let resizeFrame = 0;
    let lastHeight = 0;

    const measureHeight = () => {
      const formRoot = document.querySelector<HTMLElement>(
        "[data-launchhub-form-root]"
      );
      const body = document.body;
      const root = document.documentElement;
      const formRootHeight = formRoot?.getBoundingClientRect().height ?? 0;
      const bodyRectHeight = body?.getBoundingClientRect().height ?? 0;
      const contentHeight =
        formRootHeight ||
        bodyRectHeight ||
        body?.offsetHeight ||
        body?.scrollHeight ||
        0;
      const fallbackHeight = Math.max(
        root?.scrollHeight ?? 0,
        root?.offsetHeight ?? 0
      );
      const height = contentHeight || fallbackHeight;

      return Math.ceil(Math.max(height, 480) + 20);
    };

    const postHeight = () => {
      resizeFrame = 0;
      const height = measureHeight();

      if (Math.abs(height - lastHeight) < 4) return;
      lastHeight = height;

      window.parent?.postMessage(
        {
          type: "launchhub:resize",
          source: "launchhub-form",
          formToken,
          height,
        },
        "*"
      );
    };

    const scheduleResize = () => {
      if (resizeFrame) return;
      resizeFrame = window.requestAnimationFrame(postHeight);
    };

    scheduleResize();
    const timers = [60, 160, 400, 900, 1600, 2400].map((delay) =>
      window.setTimeout(scheduleResize, delay)
    );
    const observer = new MutationObserver(scheduleResize);
    observer.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
      characterData: true,
    });
    window.addEventListener("resize", scheduleResize);

    return () => {
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
      timers.forEach((timer) => window.clearTimeout(timer));
      observer.disconnect();
      window.removeEventListener("resize", scheduleResize);
    };
  }, [formToken]);

  return (
    <main className="bg-[var(--public-bg)]">
      <PublicLeadForm
        mode="embed"
        formToken={formToken}
        formId={searchParams.get("form_id") || undefined}
        brandSlug={searchParams.get("brand") || undefined}
        conversionMode={normalizeConversionMode(searchParams.get("conversion_mode"))}
        successRedirectUrl={searchParams.get("success_redirect_url") || undefined}
        expectedParentOrigin={normalizeOrigin(searchParams.get("parent_origin"))}
      />
    </main>
  );
}
