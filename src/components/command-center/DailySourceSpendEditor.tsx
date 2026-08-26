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
import { saveDailySpendAction } from "@/app/command-center/actions";
import { SubmitButton } from "@/components/alyssa/SubmitButton";
import { BrandMark } from "@/components/command-center/BrandMark";
import type { DailySourceSpendEditorSnapshot } from "@/lib/marketing/dailySourceSpendEditor";
import { SPEND_TYPE_OPTIONS } from "@/lib/marketing/spendTypes";

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

export function DailySourceSpendEditor({
  snapshot,
  monthStart,
  maxEntryDate,
  reportingBrandScope,
  returnPath,
  schemaReady,
}: {
  snapshot: DailySourceSpendEditorSnapshot;
  monthStart: string;
  maxEntryDate: string;
  reportingBrandScope: string;
  returnPath: string;
  schemaReady: boolean;
}) {
  const [amounts, setAmounts] = useState<Record<string, string>>(
    Object.fromEntries(
      snapshot.brands.map((brand) => [
        brand.id,
        brand.entry?.amount?.toString() ?? "",
      ])
    )
  );
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
    <section
      className="command-surface overflow-hidden"
      data-testid="daily-source-spend-editor"
    >
      <header className="flex flex-col gap-4 border-b border-[#ead9cf] p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#eef4ff] text-[#46618d]">
            <BadgeDollarSign size={20} />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#7184a4]">
              Source-first Spend entry
            </p>
            <h2 className="mt-1 text-xl font-black text-[#321428]">
              按 Source 一次過填晒各品牌廣告費
            </h2>
            <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-[#745668]">
              先揀日期同 Source，再一次更新所有有權限品牌。空白 = 未填；0 = 已確認當日冇投放。
            </p>
          </div>
        </div>
        <div className="grid min-w-[220px] grid-cols-2 gap-2 rounded-2xl border border-[#dfe7f5] bg-[#f7f9fd] p-3 text-right">
          <span>
            <small className="block text-[11px] font-bold text-[#7184a4]">
              當日已輸入
            </small>
            <strong className="text-base text-[#321428]">
              {liveCompletion}/{snapshot.brands.length}
            </strong>
          </span>
          <span>
            <small className="block text-[11px] font-bold text-[#7184a4]">
              Source 總額
            </small>
            <strong className="text-base text-[#321428]">{money(liveTotal)}</strong>
          </span>
        </div>
      </header>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 border-b border-[#ead9cf] bg-[#fffdfb] p-5"
      >
        <input type="hidden" name="month" value={monthStart} />
        <input type="hidden" name="entry_mode" value="source" />
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
        <label className="grid min-w-[230px] gap-1.5">
          <span className="text-xs font-black text-[#755568]">Source</span>
          <select
            name="spend_type"
            aria-label="Source"
            defaultValue={snapshot.spendType}
            className="rounded-xl border border-[#dfcdc4] bg-white px-3 py-2 text-sm font-bold text-[#4d2d40]"
          >
            {SPEND_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <SubmitButton
          className="command-secondary-button"
          pendingLabel="載入中…"
        >
          <CalendarDays size={15} />
          載入 Source
        </SubmitButton>
        <span className="ml-auto text-xs font-bold text-[#8a6477]">
          前一日 {formatDate(snapshot.previousDate)} · {snapshot.spendTypeLabel} 合計：
          {money(snapshot.previousTotal)}
        </span>
      </form>

      <form action={saveDailySpendAction} className="p-5">
        <input type="hidden" name="spendDate" value={snapshot.selectedDate} />
        <input type="hidden" name="spendType" value={snapshot.spendType} />
        <input type="hidden" name="returnPath" value={returnPath} />

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <strong className="text-base text-[#321428]">
              {snapshot.spendTypeLabel} · {formatDate(snapshot.selectedDate)}
            </strong>
            <p className="mt-1 text-xs font-semibold text-[#8a6477]">
              同一個 Source 一次過更新各品牌；每個品牌仍保留獨立 revision 同 audit。
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black ${
              liveCompletion === snapshot.brands.length && snapshot.brands.length > 0
                ? "bg-[#eaf7ef] text-[#3d7355]"
                : "bg-[#fff5e8] text-[#8a632b]"
            }`}
          >
            {liveCompletion === snapshot.brands.length && snapshot.brands.length > 0 ? (
              <CheckCircle2 size={14} />
            ) : (
              <TriangleAlert size={14} />
            )}
            {liveCompletion}/{snapshot.brands.length} 品牌已確認
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {snapshot.brands.map((brand) => (
            <article
              key={brand.id}
              data-spend-brand={brand.id}
              className="rounded-2xl border border-[#ead9cf] bg-white p-4 shadow-[0_8px_22px_rgba(90,35,72,0.05)]"
              style={{ borderTopColor: brand.color, borderTopWidth: 3 }}
            >
              <div className="flex items-center justify-between gap-2">
                <BrandMark name={brand.name} color={brand.color} compact />
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                    (amounts[brand.id] ?? "").trim() !== ""
                      ? "bg-[#4f8b68]"
                      : "bg-[#d6c3cb]"
                  }`}
                />
              </div>

              <label className="mt-4 block">
                <span className="text-[11px] font-black uppercase tracking-[0.08em] text-[#866274]">
                  當日 Spend
                </span>
                <span className="mt-1 flex items-center rounded-xl border border-[#dfcdc4] bg-[#fffdfb] px-3 focus-within:border-[#a76a88]">
                  <b className="text-sm text-[#8a6477]">$</b>
                  <input
                    type="number"
                    name={`amount:${brand.id}`}
                    min="0"
                    max="99999999.99"
                    step="0.01"
                    inputMode="decimal"
                    value={amounts[brand.id] ?? ""}
                    onChange={(event) =>
                      setAmounts((current) => ({
                        ...current,
                        [brand.id]: event.target.value,
                      }))
                    }
                    className="min-w-0 flex-1 bg-transparent px-2 py-2.5 text-right text-base font-black text-[#321428] outline-none"
                    aria-label={`${brand.name} ${snapshot.spendTypeLabel} 廣告費`}
                  />
                </span>
              </label>

              <div className="mt-2 flex items-center justify-between text-xs font-bold text-[#8a6477]">
                <span>前一日</span>
                <strong className="text-[#5f4253]">
                  {money(brand.previousEntry?.amount ?? null)}
                </strong>
              </div>

              <label className="mt-3 block">
                <span className="text-[11px] font-bold text-[#866274]">
                  備註（選填）
                </span>
                <input
                  name={`note:${brand.id}`}
                  maxLength={500}
                  defaultValue={brand.entry?.note ?? ""}
                  placeholder="例如：預算調整"
                  className="mt-1 w-full rounded-xl border border-[#ead9cf] bg-white px-3 py-2 text-xs font-semibold text-[#5f4253] outline-none focus:border-[#a76a88]"
                />
              </label>
              <input
                type="hidden"
                name={`originalAmount:${brand.id}`}
                value={brand.entry?.amount ?? ""}
              />
              <input
                type="hidden"
                name={`originalNote:${brand.id}`}
                value={brand.entry?.note ?? ""}
              />
              <input
                type="hidden"
                name={`expectedRevision:${brand.id}`}
                value={brand.entry?.revision ?? ""}
              />

              <small className="mt-3 block text-[10px] font-semibold leading-4 text-[#9b7b8c]">
                {brand.entry
                  ? `已記錄 · revision ${brand.entry.revision}${
                      brand.entry.updatedBy ? ` · ${brand.entry.updatedBy}` : ""
                    }`
                  : "未填；如確認冇投放請輸入 0。"}
              </small>
            </article>
          ))}
        </div>

        <footer className="mt-5 flex flex-col gap-3 rounded-2xl border border-[#dfe7f5] bg-[#f7f9fd] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <CircleDollarSign size={19} className="text-[#46618d]" />
            <div>
              <strong className="block text-sm text-[#321428]">
                即時計算 Source 總額：{money(liveTotal)}
              </strong>
              <span className="text-xs font-semibold text-[#806174]">
                儲存後「按品牌」模式、Dashboard、同期對比同成本指標會同步更新。
              </span>
            </div>
          </div>
          <SubmitButton
            className="command-primary-button"
            pendingLabel="儲存各品牌中…"
            disabled={!snapshot.canEdit || !schemaReady || snapshot.brands.length === 0}
          >
            <Save size={15} />
            儲存 {snapshot.spendTypeLabel}
          </SubmitButton>
        </footer>
      </form>
    </section>
  );
}
