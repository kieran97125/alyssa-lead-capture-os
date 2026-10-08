"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import {
  AlignLeft,
  CalendarRange,
  Check,
  Clipboard,
  Download,
  ExternalLink,
  FileText,
  Layers3,
  LoaderCircle,
  Presentation,
  RotateCcw,
  SplitSquareVertical,
} from "lucide-react";
import { SystemButton } from "@/components/system/SystemButton";
import type {
  ReportBreakdownDimension,
  ReportGeneratorOptions,
  ReportOutputFormat,
} from "@/lib/reports/types";

function downloadName(disposition: string | null, fallback: string) {
  const quoted = disposition?.match(/filename="([^"]+)"/i)?.[1];
  return quoted || fallback;
}

function formatName(format: ReportOutputFormat) {
  if (format === "google_slides" || format === "pptx") return "Google Slides";
  if (format === "txt") return "文字摘要";
  return "PDF";
}

export function ReportGeneratorForm({ options, canConnectGoogleDrive = false }: {
  options: ReportGeneratorOptions;
  canConnectGoogleDrive?: boolean;
}) {
  const [startDate, setStartDate] = useState(options.defaultStartDate);
  const [endDate, setEndDate] = useState(options.defaultEndDate);
  const [brandScope, setBrandScope] = useState("");
  const [comparison, setComparison] = useState(true);
  const [breakdowns, setBreakdowns] = useState<ReportBreakdownDimension[]>([]);
  const [format, setFormat] = useState<ReportOutputFormat>("google_slides");
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState("");
  const [authorizationRequired, setAuthorizationRequired] = useState(false);
  const [lastDownload, setLastDownload] = useState("");
  const [lastPresentation, setLastPresentation] = useState<{ name: string; url: string } | null>(null);
  const [lastText, setLastText] = useState("");
  const [copied, setCopied] = useState(false);
  const isSlides = format === "google_slides" || format === "pptx";

  const breakdownLabel = useMemo(() => {
    if (breakdowns.length === 0) return "不拆分";
    if (breakdowns.length === 2) return "按品牌 + 按療程";
    return breakdowns[0] === "brand" ? "按品牌" : "按療程";
  }, [breakdowns]);

  function toggleBreakdown(value: ReportBreakdownDimension) {
    setBreakdowns((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    );
  }

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }

  async function copyText() {
    if (!lastText) return;
    try {
      await navigator.clipboard.writeText(lastText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {
      setError("瀏覽器未能自動複製；你仍然可以喺下方文字預覽手動選取。 ");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError("");
    setAuthorizationRequired(false);
    setLastDownload("");
    setLastPresentation(null);
    setLastText("");
    setCopied(false);
    try {
      const response = await fetch("/api/internal/reports/export", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          startDate,
          endDate,
          brandScope,
          comparison: isSlides ? false : comparison,
          breakdowns: isSlides ? [] : breakdowns,
          format,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { message?: string; code?: string } | null;
        setAuthorizationRequired(payload?.code === "drive_authorization_required");
        throw new Error(payload?.message || "暫時未能生成報告，請稍後再試。");
      }
      if (format === "google_slides") {
        const payload = await response.json() as { presentation?: { name?: string; url?: string } };
        const presentation = payload.presentation;
        if (!presentation?.name || !presentation.url ||
            !/^https:\/\/docs\.google\.com\/presentation\/d\/[a-zA-Z0-9_-]+\//.test(presentation.url)) {
          throw new Error("Google Slides 已提交，但未能確認連結。請先查看報告資料夾。");
        }
        setLastPresentation({ name: presentation.name, url: presentation.url });
        return;
      }
      const filename = downloadName(
        response.headers.get("content-disposition"),
        `growth-report.${format}`
      );

      if (format === "txt") {
        const text = await response.text();
        setLastText(text);
        triggerDownload(new Blob([text], { type: "text/plain;charset=utf-8" }), filename);
      } else {
        triggerDownload(await response.blob(), filename);
      }
      setLastDownload(filename);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "暫時未能生成報告，請稍後再試。");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <form className="report-generator-form" onSubmit={submit}>
      <section className="command-surface report-generator-section">
        <header>
          <span className="report-generator-step">01</span>
          <div>
            <h2>報告範圍</h2>
            <p>預設截至昨日。</p>
          </div>
          <CalendarRange size={22} />
        </header>
        <div className="report-generator-fields">
          <label>
            <span>開始日期</span>
            <input type="date" value={startDate} max={options.defaultEndDate} onChange={(event) => setStartDate(event.target.value)} required />
          </label>
          <label>
            <span>結束日期</span>
            <input type="date" value={endDate} max={options.defaultEndDate} onChange={(event) => setEndDate(event.target.value)} required />
          </label>
          <label>
            <span>品牌範圍</span>
            <select value={brandScope} onChange={(event) => setBrandScope(event.target.value)}>
              {options.brandOptions.map((option) => <option key={`${option.value}:${option.label}`} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>
        {!isSlides ? <label className="report-generator-switch-row">
          <input type="checkbox" checked={comparison} onChange={(event) => setComparison(event.target.checked)} />
          <span className="report-generator-switch" aria-hidden="true"><span /></span>
          <span>
            <strong>加入上月同期比較</strong>
            <small>比較相同日期範圍。</small>
          </span>
        </label> : null}
      </section>

      {!isSlides ? <section className="command-surface report-generator-section">
        <header>
          <span className="report-generator-step">02</span>
          <div>
            <h2>Breakdown 頁</h2>
            <p>可同時選擇品牌及療程。</p>
          </div>
          <SplitSquareVertical size={22} />
        </header>
        <div className="report-breakdown-picker" role="group" aria-label="Breakdown 選項">
          <button type="button" className={breakdowns.length === 0 ? "is-selected" : ""} aria-pressed={breakdowns.length === 0} onClick={() => setBreakdowns([])}>
            <RotateCcw size={17} />
            <span><strong>不拆分</strong><small>只輸出主報告</small></span>
            {breakdowns.length === 0 ? <Check size={16} /> : null}
          </button>
          <button type="button" className={breakdowns.includes("brand") ? "is-selected" : ""} aria-pressed={breakdowns.includes("brand")} onClick={() => toggleBreakdown("brand")}>
            <Layers3 size={17} />
            <span><strong>按品牌</strong><small>追加品牌效率表</small></span>
            {breakdowns.includes("brand") ? <Check size={16} /> : null}
          </button>
          <button type="button" className={breakdowns.includes("treatment") ? "is-selected" : ""} aria-pressed={breakdowns.includes("treatment")} onClick={() => toggleBreakdown("treatment")}>
            <SplitSquareVertical size={17} />
            <span><strong>按療程</strong><small>追加療程漏斗表</small></span>
            {breakdowns.includes("treatment") ? <Check size={16} /> : null}
          </button>
        </div>
        <p className="report-breakdown-summary">
          今次設定：<strong>{breakdownLabel}</strong>
          {breakdowns.length === 2 ? "；會追加兩組獨立頁面，不會做品牌 × 療程交叉表。" : "。"}
        </p>
      </section> : null}

      <section className="command-surface report-generator-section">
        <header>
          <span className="report-generator-step">{isSlides ? "02" : "03"}</span>
          <div>
            <h2>輸出格式</h2>
          </div>
          <Presentation size={22} aria-hidden="true" />
        </header>
        <div className="report-format-picker" role="radiogroup" aria-label="輸出格式">
          <label className={format === "google_slides" ? "is-selected" : ""}>
            <input type="radio" name="report-format" value="google_slides" checked={format === "google_slides"} onChange={() => setFormat("google_slides")} />
            <Presentation size={24} aria-hidden="true" />
            <span><strong>Google Slides</strong><small>儲存到報告資料夾</small></span>
            {format === "google_slides" ? <Check size={17} aria-hidden="true" /> : null}
          </label>
          <label className={format === "pdf" ? "is-selected" : ""}>
            <input type="radio" name="report-format" value="pdf" checked={format === "pdf"} onChange={() => setFormat("pdf")} />
            <FileText size={24} aria-hidden="true" />
            <span><strong>PDF</strong><small>適合發送及存檔</small></span>
            {format === "pdf" ? <Check size={17} aria-hidden="true" /> : null}
          </label>
          <label className={format === "txt" ? "is-selected" : ""}>
            <input type="radio" name="report-format" value="txt" checked={format === "txt"} onChange={() => setFormat("txt")} />
            <AlignLeft size={24} />
            <span><strong>Dashboard 文字摘要</strong><small>方便複製及分享</small></span>
            {format === "txt" ? <Check size={17} /> : null}
          </label>
        </div>
      </section>

      {error ? <p className="command-status-message is-error" role="alert">{error}</p> : null}
      {authorizationRequired && canConnectGoogleDrive ? (
        <SystemButton variant="outline" nativeButton={false} role="link" render={<a href="/reports?reconnect_drive=1" />}>
          <Presentation size={16} aria-hidden="true" />重新連接 Google Drive
        </SystemButton>
      ) : null}
      {lastDownload ? <p className="command-status-message is-success" role="status">已生成並下載：{lastDownload}</p> : null}
      {lastPresentation ? (
        <section className="command-surface report-generator-section" aria-label="Google Slides 生成結果" data-testid="report-slides-result">
          <p className="command-status-message is-success" role="status">已儲存到報告資料夾：{lastPresentation.name}</p>
          <SystemButton variant="outline" nativeButton={false} role="link" render={<a href={lastPresentation.url} target="_blank" rel="noopener noreferrer" />}>
            <ExternalLink size={16} aria-hidden="true" />開啟 Google Slides
          </SystemButton>
        </section>
      ) : null}

      {lastText ? (
        <section className="command-surface report-generator-section" data-testid="report-text-preview">
          <header>
            <span className="report-generator-step">04</span>
            <div>
              <h2>文字預覽</h2>
              <p>可直接複製及分享。</p>
            </div>
            <SystemButton type="button" variant="outline" onClick={copyText}>
              {copied ? <Check size={16} /> : <Clipboard size={16} />}
              {copied ? "已複製" : "複製全文"}
            </SystemButton>
          </header>
          <pre className="max-h-[560px] overflow-auto whitespace-pre-wrap rounded-[var(--radius-panel)] border border-system-border bg-system-card p-5 text-sm leading-6 text-system-foreground">
            {lastText}
          </pre>
        </section>
      ) : null}

      <footer className="report-generator-submit-row">
        <div>
          <strong>{format === "pdf" ? "可搜尋 PDF" : format === "google_slides" ? "Google Slides · CS／AD 報數" : "Dashboard 純文字摘要"}</strong>
          <span>{startDate} 至 {endDate} · {isSlides ? "標準系列報告" : breakdownLabel}</span>
        </div>
        <SystemButton type="submit" className="command-primary-button" disabled={pending || !startDate || !endDate} aria-busy={pending}>
          {pending ? <LoaderCircle className="report-generator-spinner" size={17} aria-hidden="true" /> : format === "google_slides" ? <Presentation size={17} aria-hidden="true" /> : <Download size={17} aria-hidden="true" />}
          {pending ? "生成中…" : `生成 ${formatName(format)}`}
        </SystemButton>
      </footer>
    </form>
  );
}
