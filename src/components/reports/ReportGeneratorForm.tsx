"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  AlignLeft,
  CalendarRange,
  Check,
  Clipboard,
  Download,
  FileText,
  Layers3,
  LoaderCircle,
  Presentation,
  RotateCcw,
  SplitSquareVertical,
} from "lucide-react";
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
  if (format === "pptx") return "PPTX";
  if (format === "txt") return "文字摘要";
  return "PDF";
}

export function ReportGeneratorForm({ options }: { options: ReportGeneratorOptions }) {
  const [startDate, setStartDate] = useState(options.defaultStartDate);
  const [endDate, setEndDate] = useState(options.defaultEndDate);
  const [brandScope, setBrandScope] = useState("");
  const [comparison, setComparison] = useState(true);
  const [breakdowns, setBreakdowns] = useState<ReportBreakdownDimension[]>([]);
  const [format, setFormat] = useState<ReportOutputFormat>("pdf");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [lastDownload, setLastDownload] = useState("");
  const [lastText, setLastText] = useState("");
  const [copied, setCopied] = useState(false);

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
    setPending(true);
    setError("");
    setLastDownload("");
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
          comparison,
          breakdowns,
          format,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(payload?.message || "暫時未能生成報告，請稍後再試。");
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
            <p>本月預設只計到昨日，避免將未完成今日數據當成全日表現。</p>
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
        <label className="report-generator-switch-row">
          <input type="checkbox" checked={comparison} onChange={(event) => setComparison(event.target.checked)} />
          <span className="report-generator-switch" aria-hidden="true"><span /></span>
          <span>
            <strong>加入上月同期比較</strong>
            <small>按相同日號窗口比較；月底會按上月實際日數截短。</small>
          </span>
        </label>
      </section>

      <section className="command-surface report-generator-section">
        <header>
          <span className="report-generator-step">02</span>
          <div>
            <h2>Breakdown 頁</h2>
            <p>「不拆分」係重設；按品牌同按療程可以獨立揀，亦可以同時揀。</p>
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
      </section>

      <section className="command-surface report-generator-section">
        <header>
          <span className="report-generator-step">03</span>
          <div>
            <h2>輸出格式</h2>
            <p>三款格式共用同一 immutable snapshot；數字口徑完全一致，只係輸出載體不同。</p>
          </div>
          <Download size={22} />
        </header>
        <div className="report-format-picker" role="radiogroup" aria-label="輸出格式">
          <label className={format === "pdf" ? "is-selected" : ""}>
            <input type="radio" name="report-format" value="pdf" checked={format === "pdf"} onChange={() => setFormat("pdf")} />
            <FileText size={24} />
            <span><strong>PDF</strong><small>文字可搜尋、圖表為向量，適合發送及存檔</small></span>
            {format === "pdf" ? <Check size={17} /> : null}
          </label>
          <label className={format === "pptx" ? "is-selected" : ""}>
            <input type="radio" name="report-format" value="pptx" checked={format === "pptx"} onChange={() => setFormat("pptx")} />
            <Presentation size={24} />
            <span><strong>PowerPoint</strong><small>文字、圖表、形狀可編輯，適合管理會議再加工</small></span>
            {format === "pptx" ? <Check size={17} /> : null}
          </label>
          <label className={format === "txt" ? "is-selected" : ""}>
            <input type="radio" name="report-format" value="txt" checked={format === "txt"} onChange={() => setFormat("txt")} />
            <AlignLeft size={24} />
            <span><strong>Dashboard 文字摘要</strong><small>純文字 KPI、同期比較同 Breakdown，方便直接 Copy／WhatsApp／Email</small></span>
            {format === "txt" ? <Check size={17} /> : null}
          </label>
        </div>
      </section>

      {error ? <p className="command-status-message is-error" role="alert">{error}</p> : null}
      {lastDownload ? <p className="command-status-message is-success" role="status">已生成並下載：{lastDownload}</p> : null}

      {lastText ? (
        <section className="command-surface report-generator-section" data-testid="report-text-preview">
          <header>
            <span className="report-generator-step">04</span>
            <div>
              <h2>文字預覽</h2>
              <p>同下載檔完全相同；可以直接複製去 WhatsApp、Email、ChatGPT 或工作文件。</p>
            </div>
            <button type="button" className="command-secondary-button" onClick={copyText}>
              {copied ? <Check size={16} /> : <Clipboard size={16} />}
              {copied ? "已複製" : "複製全文"}
            </button>
          </header>
          <pre className="max-h-[560px] overflow-auto whitespace-pre-wrap rounded-[18px] border border-[#ead9cf] bg-[#fffdfb] p-5 text-sm leading-6 text-[#321428]">
            {lastText}
          </pre>
        </section>
      ) : null}

      <footer className="report-generator-submit-row">
        <div>
          <strong>{format === "pdf" ? "可搜尋 PDF" : format === "pptx" ? "可編輯 PowerPoint" : "Dashboard 純文字摘要"}</strong>
          <span>{startDate} 至 {endDate} · {breakdownLabel}</span>
        </div>
        <button type="submit" className="command-primary-button" disabled={pending || !startDate || !endDate}>
          {pending ? <LoaderCircle className="report-generator-spinner" size={17} /> : <Download size={17} />}
          {pending ? "建立快照並生成…" : `生成 ${formatName(format)}`}
        </button>
      </footer>
    </form>
  );
}
