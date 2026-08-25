"use client";

import { useMemo, useState } from "react";
import {
  BadgeDollarSign,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Save,
  TriangleAlert,
} from "lucide-react";
import { saveDailyBrandSpendAction } from "@/app/performance/daily/actions";
import { SubmitButton } from "@/components/alyssa/SubmitButton";
import type { DailyBrandSpendEditorSnapshot } from "@/lib/marketing/dailyBrandSpendEditor";
import {
  SPEND_TYPE_OPTIONS,
  type EditableSpendType,
} from "@/lib/marketing/spendTypes";

function money(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("zh-HK", {
    style: "currency",
    currency: "HKD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-HK", {
    timeZone: "UTC",
    month: "numeric",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export function DailyBrandSpendEditor({
  snapshot,
  monthStart,
  maxEntryDate,
  reportingBrandScope,
  focusedSpendType = "meta_whatsapp",
  returnPath,
  schemaReady,
}: {
  snapshot: DailyBrandSpendEditorSnapshot;
  monthStart: string;
  maxEntryDate: string;
  reportingBrandScope: string;
  focusedSpendType?: EditableSpendType;
  returnPath: string;
  schemaReady: boolean;
}) {
  const [amounts, setAmounts] = useState<Record<EditableSpendType, string>>({
    meta_whatsapp: snapshot.entries.meta_whatsapp?.amount?.toString() ?? "",
    meta_lead_form: snapshot.entries.meta_lead_form?.amount?.toString() ?? "",
    meta_website_form: snapshot.entries.meta_website_form?.amount?.toString() ?? "",
    google_ads: snapshot.entries.google_ads?.amount?.toString() ?? "",
  });
  const liveTotal = useMemo(
    () =>
      Object.values(amounts).reduce((sum, value) => {
        if (value.trim() === "") return sum;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? sum + parsed : sum;
      }, 0),
    [amounts]
  );
  const liveCompletion = Object.values(amounts).filter(
    (value) => value.trim() !== ""
  ).length;

  return (
    <section className="command-surface overflow-hidden" data-testid="daily-brand-spend-editor">
      <header className="flex flex-col gap-4 border-b border-[#ead9cf] p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#fff0f5] text-[#7c365f]">
            <BadgeDollarSign size={20} />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#9a5d76]">Brand-first Spend entry</p>
            <h2 className="mt-1 text-xl font-black text-[#321428]">按品牌一次過填晒每日廣告費</h2>
            <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-[#745668]">
              先揀日期同品牌，再一次更新 WhatsApp、Lead Form、Website Form 同 Google Ads。空白 = 未填；0 = 已確認當日冇投放。
            </p>
          </div>
        </div>
        <div className="grid min-w-[210px] grid-cols-2 gap-2 rounded-2xl border border-[#ead9cf] bg-[#fff9f3] p-3 text-right">
          <span>
            <small className="block text-[11px] font-bold text-[#8a6477]">當日已輸入</small>
            <strong className="text-base text-[#321428]">{liveCompletion}/4</strong>
          </span>
          <span>
            <small className="block text-[11px] font-bold text-[#8a6477]">當日總額</small>
            <strong className="text-base text-[#321428]">{money(liveTotal)}</strong>
          </span>
        </div>
      </header>

      <form method="get" className="flex flex-wrap items-end gap-3 border-b border-[#ead9cf] bg-[#fffdfb] p-5">
        <input type="hidden" name="month" value={monthStart} />
        {reportingBrandScope ? (
          <input type="hidden" name="brand" value={reportingBrandScope} />
        ) : null}
        <label className="grid gap-1.5">
          <span className="text-xs font-black text-[#755568]">輸入日期</span>
          <input
            type="date"
            name="entry_date"
            min={monthStart}
            max={maxEntryDate}
            defaultValue={snapshot.selectedDate}
            className="rounded-xl border border-[#dfcdc4] bg-white px-3 py-2 text-sm font-bold text-[#4d2d40]"
          />
        </label>
        <label className="grid min-w-[220px] gap-1.5">
          <span className="text-xs font-black text-[#755568]">品牌</span>
          <select
            name="entry_brand"
            defaultValue={snapshot.selectedBrandId}
            className="rounded-xl border border-[#dfcdc4] bg-white px-3 py-2 text-sm font-bold text-[#4d2d40]"
          >
            {snapshot.brands.map((brand) => (
              <option key={brand.id} value={brand.id}>{brand.name}</option>
            ))}
          </select>
        </label>
        <label className="grid min-w-[210px] gap-1.5">
          <span className="text-xs font-black text-[#755568]">廣告費類型</span>
          <select
            name="spend_type"
            aria-label="廣告費類型"
            defaultValue={focusedSpendType}
            className="rounded-xl border border-[#dfcdc4] bg-white px-3 py-2 text-sm font-bold text-[#4d2d40]"
          >
            {SPEND_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <SubmitButton className="command-secondary-button" pendingLabel="載入中…">
          <CalendarDays size={15} />
          載入日期及類型
        </SubmitButton>
        <span className="ml-auto text-xs font-bold text-[#8a6477]">
          前一日 {formatDate(snapshot.previousDate)} 合計：{money(snapshot.previousTotal)}
        </span>
      </form>

      <form action={saveDailyBrandSpendAction} className="p-5">
        <input type="hidden" name="spendDate" value={snapshot.selectedDate} />
        <input type="hidden" name="brandId" value={snapshot.selectedBrandId} />
        <input type="hidden" name="returnPath" value={returnPath} />

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <strong className="text-base text-[#321428]">{snapshot.selectedBrandName} · {formatDate(snapshot.selectedDate)}</strong>
            <p className="mt-1 text-xs font-semibold text-[#8a6477]">四個 Source 同一版完成；上面「廣告費類型」只係快速標示目前 Source，唔會變返逐 Source 入數。</p>
          </div>
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black ${liveCompletion === 4 ? "bg-[#eaf7ef] text-[#3d7355]" : "bg-[#fff5e8] text-[#8a632b]"}`}>
            {liveCompletion === 4 ? <CheckCircle2 size={14} /> : <TriangleAlert size={14} />}
            {liveCompletion}/4 Sources 已確認
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {SPEND_TYPE_OPTIONS.map((option) => {
            const entry = snapshot.entries[option.value];
            const previous = snapshot.previousEntries[option.value];
            const focused = option.value === focusedSpendType;
            return (
              <article
                key={option.value}
                data-spend-source={option.value}
                className={`rounded-2xl border bg-white p-4 shadow-[0_8px_22px_rgba(90,35,72,0.05)] ${focused ? "border-[#9c5878] ring-2 ring-[#f3dfe8]" : "border-[#ead9cf]"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <strong className="text-sm text-[#321428]">{option.label}</strong>
                    <p className="mt-1 text-[11px] font-semibold leading-4 text-[#8a6477]">{option.description}</p>
                  </div>
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${amounts[option.value].trim() !== "" ? "bg-[#4f8b68]" : "bg-[#d6c3cb]"}`} />
                </div>

                <label className="mt-4 block">
                  <span className="text-[11px] font-black uppercase tracking-[0.08em] text-[#866274]">當日 Spend</span>
                  <span className="mt-1 flex items-center rounded-xl border border-[#dfcdc4] bg-[#fffdfb] px-3 focus-within:border-[#a76a88]">
                    <b className="text-sm text-[#8a6477]">$</b>
                    <input
                      type="number"
                      name={`amount:${option.value}`}
                      min="0"
                      max="99999999.99"
                      step="0.01"
                      inputMode="decimal"
                      value={amounts[option.value]}
                      onChange={(event) =>
                        setAmounts((current) => ({
                          ...current,
                          [option.value]: event.target.value,
                        }))
                      }
                      className="min-w-0 flex-1 bg-transparent px-2 py-2.5 text-right text-base font-black text-[#321428] outline-none"
                      aria-label={`${snapshot.selectedBrandName} ${option.label} 廣告費`}
                    />
                  </span>
                </label>

                <div className="mt-2 flex items-center justify-between text-xs font-bold text-[#8a6477]">
                  <span>前一日</span>
                  <strong className="text-[#5f4253]">{money(previous?.amount ?? null)}</strong>
                </div>

                <label className="mt-3 block">
                  <span className="text-[11px] font-bold text-[#866274]">備註（選填）</span>
                  <input
                    name={`note:${option.value}`}
                    maxLength={500}
                    defaultValue={entry?.note ?? ""}
                    placeholder="例如：預算調整"
                    className="mt-1 w-full rounded-xl border border-[#ead9cf] bg-white px-3 py-2 text-xs font-semibold text-[#5f4253] outline-none focus:border-[#a76a88]"
                  />
                </label>
                <input type="hidden" name={`originalAmount:${option.value}`} value={entry?.amount ?? ""} />
                <input type="hidden" name={`originalNote:${option.value}`} value={entry?.note ?? ""} />
                <input type="hidden" name={`expectedRevision:${option.value}`} value={entry?.revision ?? ""} />

                <small className="mt-3 block text-[10px] font-semibold leading-4 text-[#9b7b8c]">
                  {entry
                    ? `已記錄 · revision ${entry.revision}${entry.updatedBy ? ` · ${entry.updatedBy}` : ""}`
                    : "未填；如確認冇投放請輸入 0。"}
                </small>
              </article>
            );
          })}
        </div>

        <footer className="mt-5 flex flex-col gap-3 rounded-2xl border border-[#ead9cf] bg-[#fff9f3] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <CircleDollarSign size={19} className="text-[#7c365f]" />
            <div>
              <strong className="block text-sm text-[#321428]">即時計算總額：{money(liveTotal)}</strong>
              <span className="text-xs font-semibold text-[#806174]">儲存後 Dashboard、同期對比、CPL、CPBook、CPShow 會即時重算。</span>
            </div>
          </div>
          <SubmitButton
            className="command-primary-button"
            pendingLabel="儲存四個 Source 中…"
            disabled={!snapshot.canEdit || !schemaReady || !snapshot.selectedBrandId}
          >
            <Save size={15} />
            儲存 {snapshot.selectedBrandName} 廣告費
          </SubmitButton>
        </footer>
      </form>
    </section>
  );
}
