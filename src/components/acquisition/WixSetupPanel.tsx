"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { SystemButton } from "@/components/system/SystemButton";
import { SystemDetails } from "@/components/system/SystemDetails";

export type WixSetupPanelProps = {
  formName: string;
  embedCode: string;
  wixAttributionBridgeCode: string;
  previewUrl: string;
  placementUrl?: string | null;
  trackingParameters?: string;
};

function websiteLink(value: string | null | undefined) {
  try {
    const url = new URL(value || "");
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

function previewLink(value: string) {
  // Staff previews run behind the app login and never accept public submissions.
  if (/^\/forms\/[a-zA-Z0-9_-]+\/preview$/.test(value)) return value;
  return websiteLink(value);
}

/** Installation instructions are separate from observed registration/delivery health. */
export function WixSetupPanel({ formName, embedCode, wixAttributionBridgeCode, previewUrl, placementUrl, trackingParameters }: WixSetupPanelProps) {
  const [feedback, setFeedback] = useState<{ key: string; error: boolean; message: string } | null>(null);
  const headingId = useId();
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preview = previewLink(previewUrl);
  const website = websiteLink(placementUrl);
  const available = Boolean(embedCode && wixAttributionBridgeCode);

  useEffect(() => () => { if (resetTimer.current) clearTimeout(resetTimer.current); }, []);

  async function copy(value: string, key: string, label: string) {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    try {
      await navigator.clipboard.writeText(value);
      setFeedback({ key, error: false, message: `已複製${label}。` });
      resetTimer.current = setTimeout(() => setFeedback(null), 2000);
    } catch {
      setFeedback({ key, error: true, message: "複製未成功，請展開「安裝詳細內容」手動複製。" });
    }
  }

  return (
    <section className="rounded-[var(--radius-panel)] border border-system-border bg-system-card p-5 text-system-foreground" data-testid="wix-setup-panel" aria-labelledby={headingId}>
      <header>
        <h2 id={headingId} className="text-lg font-semibold">放上 Wix</h2>
        <p className="mt-1 text-sm text-system-muted-foreground">將「{formName}」放到現有網站。</p>
      </header>

      {!available ? <p role="status" className="mt-4 text-sm text-system-muted-foreground">暫時未能準備安裝內容，請重新載入。</p> : null}
      <ol className="mt-5 grid gap-5">
        <li className="grid grid-cols-[auto_1fr] items-start gap-3">
          <StepNumber number={1} />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">貼上登記表</h3>
            <p className="mt-1 text-sm leading-6 text-system-muted-foreground">在 Wix 加入「嵌入 HTML」，貼上表格安裝碼。</p>
            <SystemButton type="button" className="mt-3" disabled={!embedCode} onClick={() => void copy(embedCode, "embed", "表格安裝碼")}>
              {feedback?.key === "embed" && !feedback.error ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />}
              {feedback?.key === "embed" && !feedback.error ? "已複製" : "複製表格安裝碼"}
            </SystemButton>
          </div>
        </li>
        <li className="grid grid-cols-[auto_1fr] items-start gap-3">
          <StepNumber number={2} />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">保留廣告來源</h3>
            <p className="mt-1 text-sm leading-6 text-system-muted-foreground">將來源設定貼到同一個 Wix 頁面嘅「頁面程式碼」。通常只需設定一次。</p>
            <SystemButton type="button" className="mt-3" variant="outline" disabled={!wixAttributionBridgeCode} onClick={() => void copy(wixAttributionBridgeCode, "source", "來源設定")}>
              <Copy aria-hidden="true" size={16} />複製來源設定
            </SystemButton>
          </div>
        </li>
        <li className="grid grid-cols-[auto_1fr] items-start gap-3">
          <StepNumber number={3} />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">發佈並檢查</h3>
            <p className="mt-1 text-sm leading-6 text-system-muted-foreground">在 Wix 發佈後，開啟網站確認表格顯示正常。</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {preview ? <SystemButton variant="outline" nativeButton={false} render={<a href={preview} target="_blank" rel="noopener noreferrer" />}><ExternalLink aria-hidden="true" size={16} />預覽表格</SystemButton> : null}
              {website ? <SystemButton variant="outline" nativeButton={false} render={<a href={website} target="_blank" rel="noopener noreferrer" />}><ExternalLink aria-hidden="true" size={16} />開啟網站</SystemButton> : null}
            </div>
          </div>
        </li>
      </ol>

      {feedback ? <p role={feedback.error ? "alert" : "status"} className="mt-4 text-sm leading-6" data-testid="wix-copy-feedback">{feedback.message}</p> : null}

      <SystemDetails title="安裝詳細內容" className="mt-5">
        <div className="space-y-4">
          <CodeField label="表格安裝碼" value={embedCode} rows={7} />
          <div>
            <p className="mb-2 text-xs leading-5 text-system-muted-foreground">來源設定入面嘅元件編號，需與 Wix 表格元件一致；預設為 #html1。</p>
            <CodeField label="來源設定程式碼" value={wixAttributionBridgeCode} rows={8} />
          </div>
          {trackingParameters ? <div>
            <CodeField label="廣告網址參數" value={trackingParameters} rows={4} />
            <SystemButton type="button" className="mt-2" variant="outline" density="compact" onClick={() => void copy(trackingParameters, "parameters", "廣告網址參數")}><Copy aria-hidden="true" size={14} />複製廣告網址參數</SystemButton>
          </div> : null}
        </div>
      </SystemDetails>
    </section>
  );
}

function StepNumber({ number }: { number: number }) {
  return <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-system-secondary text-xs font-semibold">{number}</span>;
}

function CodeField({ label, value, rows }: { label: string; value: string; rows: number }) {
  return <label className="grid gap-2 text-sm font-medium">{label}<textarea aria-label={label} readOnly value={value} rows={rows} spellCheck={false} className="w-full min-w-0 resize-y rounded-[var(--radius-control)] border border-system-border bg-system-muted p-3 font-mono text-xs font-normal leading-5 text-system-foreground focus-visible:outline-2 focus-visible:outline-system-ring" /></label>;
}
