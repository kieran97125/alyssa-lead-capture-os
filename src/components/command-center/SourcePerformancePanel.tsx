import { BarChart3, CircleDollarSign, Info } from "lucide-react";
import type { SourcePerformanceSnapshot } from "@/lib/marketing/sourcePerformance";
import type { SourcePerformanceRow } from "@/lib/marketing/sourcePerformanceMath";

function money(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("zh-HK", {
    style: "currency",
    currency: "HKD",
    maximumFractionDigits: 0,
  }).format(value);
}

function count(value: number) {
  return Math.round(value).toLocaleString("zh-HK");
}

function percent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("zh-HK", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

function SourceMixCard({ row }: { row: SourcePerformanceRow }) {
  const share = Math.max(0, Math.min(1, row.metrics.spendShare ?? 0));
  return (
    <article className="rounded-2xl border border-[#ead9cf] bg-white p-4 shadow-[0_8px_22px_rgba(90,35,72,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.08em] text-[#94697d]">
            {row.sourceLabel}
          </p>
          <strong className="mt-1 block text-xl text-[#321428]">
            {money(row.metrics.spend)}
          </strong>
        </div>
        <span className="rounded-full bg-[#fff4f7] px-2.5 py-1 text-xs font-black text-[#7c365f]">
          {percent(row.metrics.spendShare)}
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#f4e8ee]">
        <span
          className="block h-full rounded-full bg-[#9c5878]"
          style={{ width: `${Math.max(2, share * 100)}%` }}
        />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <span className="rounded-xl bg-[#fff9f5] px-2 py-2">
          <b className="block text-[#321428]">{money(row.metrics.cpl)}</b>
          <em className="not-italic text-[#866274]">CPL</em>
        </span>
        <span className="rounded-xl bg-[#fff9f5] px-2 py-2">
          <b className="block text-[#321428]">{money(row.metrics.costPerBooking)}</b>
          <em className="not-italic text-[#866274]">CPBook</em>
        </span>
        <span className="rounded-xl bg-[#fff9f5] px-2 py-2">
          <b className="block text-[#321428]">{money(row.metrics.costPerShow)}</b>
          <em className="not-italic text-[#866274]">CPShow</em>
        </span>
      </div>
    </article>
  );
}

export function SourcePerformancePanel({
  snapshot,
}: {
  snapshot: SourcePerformanceSnapshot;
}) {
  const visibleOverall = snapshot.overall.rows.filter(
    (row) => row.metrics.spend > 0 || row.metrics.leads > 0
  );
  const brandRows = snapshot.brands.flatMap((brand) =>
    brand.rows
      .filter((row) => row.metrics.spend > 0 || row.metrics.leads > 0)
      .map((row) => ({ brand, row }))
  );

  return (
    <section
      className="command-surface overflow-hidden"
      aria-label="廣告費分佈與 Source 效率"
      data-testid="source-performance-panel"
    >
      <header className="flex flex-col gap-4 border-b border-[#ead9cf] p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[#fff0f5] text-[#7c365f]">
            <BarChart3 size={18} />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#9a5d76]">
              Spend distribution
            </p>
            <h2 className="mt-1 text-xl font-black text-[#321428]">
              廣告費分佈與 Source 效率
            </h2>
            <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-[#745668]">
              {snapshot.startDate} 至 {snapshot.endDate}。同一 Source 同時睇 Spend、Lead、Book、Show、CPL、CPBook 同 CPShow，避免只用平 CPL 判斷成效。
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-[#ead9cf] bg-[#fff9f3] px-4 py-3 text-right">
          <span className="text-xs font-bold text-[#8a6477]">所選品牌總廣告費</span>
          <strong className="mt-1 block text-lg text-[#321428]">
            {money(snapshot.overall.totalSpend)}
          </strong>
        </div>
      </header>

      {snapshot.warnings.map((warning) => (
        <div key={warning} className="mx-5 mt-4 flex gap-2 rounded-xl bg-[#fff7e9] px-3 py-2 text-xs font-bold text-[#805b25]">
          <Info size={15} className="mt-0.5 shrink-0" />
          <span>{warning}</span>
        </div>
      ))}

      <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
        {visibleOverall.map((row) => (
          <SourceMixCard key={row.sourceKey} row={row} />
        ))}
      </div>

      <div className="px-5 pb-5">
        <div className="mb-3 flex items-center gap-2">
          <CircleDollarSign size={17} className="text-[#7c365f]" />
          <strong className="text-sm text-[#321428]">各品牌 × Source 詳細效率</strong>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-[#ead9cf]">
          <table className="min-w-[980px] w-full border-collapse text-sm">
            <thead className="bg-[#fff8f5] text-left text-xs font-black uppercase tracking-[0.06em] text-[#805d70]">
              <tr>
                <th className="px-3 py-3">品牌</th>
                <th className="px-3 py-3">Source</th>
                <th className="px-3 py-3 text-right">Spend</th>
                <th className="px-3 py-3 text-right">佔品牌 Spend</th>
                <th className="px-3 py-3 text-right">Lead</th>
                <th className="px-3 py-3 text-right">CPL</th>
                <th className="px-3 py-3 text-right">Book</th>
                <th className="px-3 py-3 text-right">CPBook</th>
                <th className="px-3 py-3 text-right">Show</th>
                <th className="px-3 py-3 text-right">CPShow</th>
                <th className="px-3 py-3 text-right">BR</th>
              </tr>
            </thead>
            <tbody>
              {brandRows.map(({ brand, row }) => (
                <tr
                  key={`${brand.brandId}:${row.sourceKey}`}
                  className="border-t border-[#f0e3dc] bg-white"
                >
                  <td className="px-3 py-3 font-black text-[#321428]">
                    <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: brand.brandColor }} />
                    {brand.brandName}
                  </td>
                  <td className="px-3 py-3 font-bold text-[#68485b]">{row.sourceLabel}</td>
                  <td className="px-3 py-3 text-right font-black text-[#321428]">{money(row.metrics.spend)}</td>
                  <td className="px-3 py-3 text-right">{percent(row.metrics.spendShare)}</td>
                  <td className="px-3 py-3 text-right">{count(row.metrics.leads)}</td>
                  <td className="px-3 py-3 text-right font-bold">{money(row.metrics.cpl)}</td>
                  <td className="px-3 py-3 text-right">{count(row.metrics.bookings)}</td>
                  <td className="px-3 py-3 text-right font-bold">{money(row.metrics.costPerBooking)}</td>
                  <td className="px-3 py-3 text-right">{count(row.metrics.shows)}</td>
                  <td className="px-3 py-3 text-right font-bold">{money(row.metrics.costPerShow)}</td>
                  <td className="px-3 py-3 text-right">{percent(row.metrics.bookingRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
