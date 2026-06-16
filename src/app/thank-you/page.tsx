"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function ThankYouPage() {
  return (
    <Suspense fallback={<ThankYouContent />}>
      <ThankYouReporter />
    </Suspense>
  );
}

function ThankYouReporter() {
  const searchParams = useSearchParams();

  useEffect(() => {
    void fetch("/api/public/thank-you", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lead_id: searchParams.get("lead_id"),
        source_snapshot_id: searchParams.get("source_snapshot_id"),
        page_url: window.location.href,
        referrer: document.referrer,
      }),
    });
  }, [searchParams]);

  return <ThankYouContent />;
}

function ThankYouContent() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#fff9f3] px-5 text-[#321428]">
      <section className="max-w-xl rounded-[28px] border border-[#ead9cf] bg-white p-8 text-center shadow-[0_24px_70px_rgba(90,35,72,0.14)]">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">Thank you</p>
        <h1 className="mt-3 text-3xl font-bold">預約資料已收到</h1>
        <p className="mt-4 text-sm leading-6 text-[#6d4a5c]">
          品牌團隊會盡快透過 WhatsApp 跟進。
        </p>
      </section>
    </main>
  );
}
