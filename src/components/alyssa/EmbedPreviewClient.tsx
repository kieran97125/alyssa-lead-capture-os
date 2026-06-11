"use client";

import { useEffect, useState } from "react";
import { CopyButton } from "./CopyButton";
import { EmbedCodeCard } from "./EmbedCodeCard";

type Props = {
  embedCode: string;
  embedScriptUrl: string;
  formId: string;
  formToken: string;
};

type DebugPayload = {
  submitted_touch_json?: Record<string, unknown>;
  tracking_status?: string;
  audit_reason?: string;
};

const debugFields = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "fbclid",
  "visitor_id",
  "session_id",
] as const;

const sampleUrl =
  "/embed-preview?utm_source=meta&utm_medium=paid_social&utm_campaign=alyssa_summer_consult&utm_content=rose_offer_card&fbclid=preview_fbclid_123";

function asText(value: unknown) {
  return typeof value === "string" && value.trim() ? value : "未擷取";
}

export function EmbedPreviewClient({
  embedCode,
  embedScriptUrl,
  formId,
  formToken,
}: Props) {
  const [debugPayload, setDebugPayload] = useState<DebugPayload | null>(null);

  useEffect(() => {
    function handleDebugEvent(event: Event) {
      const customEvent = event as CustomEvent<DebugPayload>;
      setDebugPayload(customEvent.detail);
    }

    window.addEventListener("alyssa:attribution-captured", handleDebugEvent);

    const existingScript = document.getElementById("alyssa-preview-embed-script");
    existingScript?.remove();

    const script = document.createElement("script");
    script.id = "alyssa-preview-embed-script";
    script.src = embedScriptUrl;
    script.async = true;
    script.dataset.formToken = formToken;
    script.dataset.brand = "alyssa";
    script.dataset.formId = formId;
    script.dataset.targetId = "alyssa-preview-form-target";
    script.dataset.height = "920";
    document.body.appendChild(script);

    return () => {
      window.removeEventListener("alyssa:attribution-captured", handleDebugEvent);
      script.remove();
    };
  }, [embedScriptUrl, formId, formToken]);

  const touch = debugPayload?.submitted_touch_json ?? {};

  return (
    <div className="mx-auto max-w-7xl px-5 py-8">
      <section className="grid gap-6 lg:grid-cols-[1fr_420px] lg:items-start">
        <div className="overflow-hidden rounded-[28px] border border-[#ead9cf] bg-white shadow-[0_24px_70px_rgba(90,35,72,0.12)]">
          <div className="bg-[#fff6f0] px-6 py-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9a5d76]">
              模擬 Wix Landing Page
            </p>
            <h1 className="mt-4 max-w-2xl text-4xl font-bold leading-tight text-[#321428] md:text-5xl">
              Alyssa 首次療程諮詢及膚質分析
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#6d4a5c]">
              呢個頁面模擬真實 Wix parent page：UTM 參數會先存在喺呢一頁，
              embed script 先讀取來源資料，再將 attribution payload 傳入 iframe。
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={sampleUrl}
                className="rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#d95f55]"
              >
                載入示範 UTM URL
              </a>
              <CopyButton value={sampleUrl} label="複製示範 URL" />
            </div>
          </div>

          <div className="grid gap-6 p-6 lg:grid-cols-[0.92fr_1.08fr]">
            <div className="space-y-4">
              <div className="rounded-3xl border border-[#ead9cf] bg-[#fff9f3] p-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9a5d76]">
                  預覽優惠
                </p>
                <h2 className="mt-3 text-2xl font-bold text-[#321428]">
                  免費膚質分析及療程建議
                </h2>
                <p className="mt-3 text-sm leading-6 text-[#7b5a6a]">
                  適合 Meta 同 WhatsApp 廣告流量測試，確保 campaign attribution
                  可以喺 Wix iframe 嵌入場景下保留。
                </p>
              </div>

              <div className="rounded-3xl border border-[#ead9cf] bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9a5d76]">
                  追蹤流程
                </p>
                <ol className="mt-3 space-y-3 text-sm leading-6 text-[#6d4a5c]">
                  <li>1. Parent page 先讀取 UTM 同 click IDs。</li>
                  <li>2. 建立 first/latest/submitted touch payloads。</li>
                  <li>3. 透過嚴格 origin targeting 將 payload 傳入 iframe。</li>
                  <li>4. Lead submit 後建立 source snapshot 同 lead events。</li>
                </ol>
              </div>
            </div>

            <div id="alyssa-preview-form-target" className="min-h-[760px]" />
          </div>
        </div>

        <aside className="space-y-5">
          <EmbedCodeCard
            code={embedCode}
            title="Wix 嵌入碼"
            description="呢個預覽頁正正載入以下 public script。"
          />

          <section className="rounded-[24px] border border-[#d7c5b9] bg-[#2b2027] p-5 text-[#fff9f3] shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d9b66f]">
                  內部追蹤 Debug
                </p>
                <h2 className="mt-2 text-lg font-bold">
                  Parent Page 來源追蹤資料
                </h2>
              </div>
              <span className="rounded-full border border-[#6f5866] px-3 py-1 text-xs font-bold text-[#eac7ce]">
                非客戶畫面
              </span>
            </div>

            <div className="mt-5 space-y-2">
              {debugFields.map((field) => (
                <DebugRow key={field} label={field} value={asText(touch[field])} />
              ))}
              <DebugRow
                label="tracking_status"
                value={asText(debugPayload?.tracking_status ?? touch.tracking_status)}
              />
              <DebugRow
                label="audit_reason"
                value={asText(debugPayload?.audit_reason ?? touch.audit_reason)}
              />
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}

function DebugRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-2 rounded-2xl border border-[#4a3843] bg-[#382b34] p-3 text-xs sm:grid-cols-[150px_1fr]">
      <span className="font-bold text-[#d9b66f]">{label}</span>
      <span className="break-words text-[#fff9f3]">{value}</span>
    </div>
  );
}
