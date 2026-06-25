"use client";

import { useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { PublicLeadForm } from "@/components/alyssa/PublicLeadForm";

function normalizeOrigin(value: string | null) {
  if (!value) return "";

  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
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
      const body = document.body;
      const root = document.documentElement;
      const height = Math.max(
        body?.scrollHeight ?? 0,
        body?.offsetHeight ?? 0,
        root?.scrollHeight ?? 0,
        root?.offsetHeight ?? 0,
        root?.clientHeight ?? 0,
        640
      );

      return Math.ceil(height + 24);
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
    const timers = [120, 400, 900, 1600].map((delay) =>
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
        expectedParentOrigin={normalizeOrigin(searchParams.get("parent_origin"))}
      />
    </main>
  );
}
