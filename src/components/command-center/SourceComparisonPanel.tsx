import { ArrowDownRight, ArrowUpRight, GitCompareArrows, Info } from "lucide-react";
import type { SourcePerformanceSnapshot } from "@/lib/marketing/sourcePerformance";
import {
  sourceMetricChange,
  type SourcePerformanceRow,
} from "@/lib/marketing/sourcePerformanceMath";
import { ALL_SPEND_TYPES, SPEND_TYPE_LABELS, type SpendType } from "@/lib/marketing/spendTypes";

function money(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("zh-HK", {
    style: "currency",
    currency: "HKD",
    maximumFractionDigits: 0,
  }).format(value);
}

function percent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("zh-HK", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

function count(value: number) {
  return Math.round(value).toLocaleString("zh-HK");
}

function rowFor(snapshot: SourcePerformanceSnapshot, sourceKey: SpendType) {
  return snapshot.overall.rows.find((row) => row.sourceKey === sourceKey) ?? null;
}

function Change({ value, lowerIsBetter = false }: { value: number | null; lowerIsBetter?: boolean }) {
  if (value === null || Math.abs(value) < 0.0005) return <span className="text-[#9a7d8d]">—</span>;
  const improved = lowerIsBetter ? value < 0 : value > 0;
  const Icon = value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-1 font-black ${improved ? "text-[#3f7a5c]" : "text-[#a44f58]"}`}>
      <Icon size={13} />
      {percent(Math.abs(value))}
    </span>
  );
}

function summaryText(current: SourcePerformanceSnapshot, previous: SourcePerformanceSnapshot) {
  const candidates = ALL_SPEND_TYPES.map((sourceKey) => {
    const currentRow = rowFor(current, sourceKey);
    const previousRow = rowFor(previous, sourceKey);
    return {
      sourceKey,
      spendShareChange:
        (currentRow?.metrics.spendShare ?? 0) - (previousRow?.metrics.spendShare ?? 0),
      cpShowChange: sourceMetricChange(
        currentRow?.metrics.costPerShow ?? null,
        previousRow?.metrics.costPerShow ?? null
      ),
    };
  });
  const biggestMix = candidates
    .filter((item) => item.sourceKey !== "legacy_unclassified")
    .sort((a, b) => Math.abs(b.spendShareChange) - Math.abs(a.spendShareChange))[0];
  const bestEfficiency = candidates
    .filter((item) => item.cpShowChange !== null && item.cpShowChange < 0)
    .sort((a, b) => (a.cpShowChange ?? 0) - (b.cpShowChange ?? 0))[0];

  const notes: string[] = [];
  if (biggestMix && Math.abs(biggestMix.spendShareChange) >= 0.005) {
    notes.push(
      `${SPEND_TYPE_LABELS[biggestMix.sourceKey]} Spend Mix ${biggestMix.spendShareChange > 0 ? "增加" : "減少"} ${percent(Math.abs(biggestMix.spendShareChange))}`
    );
  }
  if (bestEfficiency?.cpShowChange !== null && bestEfficiency?.cpShowChange !== undefined) {
    notes.push(
      `${SPEND_TYPE_LABELS[bestEfficiency.sourceKey]} CPShow 改善 ${percent(Math.abs(bestEfficiency.cpShowChange))}`
    );
  }
  return notes.length > 0 ? notes.join("；") : "本期 Source Mix 同 CPShow 暫未見到明顯結構性變化。";
}

export function SourceComparisonPanel({
  current,
  previous,
  currentLabel,
  previousLabel,
}: {
  current: SourcePerformanceSnapshot;
  previous: SourcePerformanceSnapshot;
  currentLabel: string;
  previousLabel: string;
}) {
  const rows = ALL_SPEND_TYPES.flatMap((sourceKey) => {
    const currentRow = rowFor(current, sourceKey);
    const previousRow = rowFor(previous, sourceKey);
    const hasActivity =
      (currentRow?.metrics.spend ?? 0) > 0 ||
      (currentRow?.metrics.leads ?? 0) > 0 ||
      (previousRow?.metrics.spend ?? 0) > 0 ||
      (previousRow?.metrics.leads ?? 0) > 0;
    return hasActivity ? [{ sourceKey, currentRow, previousRow }] : [];
  });

  return (
    <section className="command-surface overflow-hidden" data-testid="source-comparison-panel">
      <header className="flex flex-col gap-3 border-b border-[#ead9cf] p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[#eef4ff] text-[#46618d]">
            <GitCompareArrows size={18} />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#7184a4]">Source mix comparison</p>
            <h2 className="mt-1 text-xl font-black text-[#321428]">Source 預算分佈與效率對比</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-[#745668]">
              {currentLabel} vs {previousLabel}。比較 Spend Mix、CPL、CPBook 同 CPShow，分辨表現改變係預算搬位定 Source 效率本身變化。
            </p>
          </div>
        </div>
        <div className="max-w-md rounded-2xl border border-[#dfe7f5] bg-[#f7f9fd] px-4 py-3 text-xs font-bold leading-5 text-[#53677f]">
          {summaryText(current, previous)}
        </div>
      </header>

      {[...current.warnings, ...previous.warnings].map((warning) => (
        <div key={warning} className="mx-5 mt-4 flex gap-2 rounded-xl bg-[#fff7e9] px-3 py-2 text-xs font-bold text-[#805b25]">
          <Info size={15} className="mt-0.5 shrink-0" />
          <span>{warning}</span>
        </div>
      ))}

      <div className="overflow-x-auto p-5">
        <table className="min-w-[1240px] w-full border-collapse rounded-2xl border border-[#ead9cf] text-sm">
          <thead className="bg-[#fff8f5] text-left text-xs font-black uppercase tracking-[0.05em] text-[#805d70]">
            <tr>
              <th className="px-3 py-3">Source</th>
              <th className="px-3 py-3 text-right">本期 Spend</th>
              <th className="px-3 py-3 text-right">上期 Spend</th>
              <th className="px-3 py-3 text-right">Spend Δ</th>
              <th className="px-3 py-3 text-right">本期 Mix</th>
              <th className="px-3 py-3 text-right">Mix Δ</th>
              <th className="px-3 py-3 text-right">Lead</th>
              <th className="px-3 py-3 text-right">CPL</th>
              <th className="px-3 py-3 text-right">CPL Δ</th>
              <th className="px-3 py-3 text-right">Book</th>
              <th className="px-3 py-3 text-right">CPBook</th>
              <th className="px-3 py-3 text-right">CPBook Δ</th>
              <th className="px-3 py-3 text-right">Show</th>
              <th className="px-3 py-3 text-right">CPShow</th>
              <th className="px-3 py-3 text-right">CPShow Δ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ sourceKey, currentRow, previousRow }) => {
              const currentMetrics = currentRow?.metrics;
              const previousMetrics = previousRow?.metrics;
              const mixChange =
                (currentMetrics?.spendShare ?? 0) - (previousMetrics?.spendShare ?? 0);
              return (
                <tr key={sourceKey} className="border-t border-[#f0e3dc] bg-white">
                  <td className="px-3 py-3 font-black text-[#321428]">{SPEND_TYPE_LABELS[sourceKey]}</td>
                  <td className="px-3 py-3 text-right font-black">{money(currentMetrics?.spend ?? 0)}</td>
                  <td className="px-3 py-3 text-right text-[#765669]">{money(previousMetrics?.spend ?? 0)}</td>
                  <td className="px-3 py-3 text-right"><Change value={sourceMetricChange(currentMetrics?.spend ?? 0, previousMetrics?.spend ?? 0)} /></td>
                  <td className="px-3 py-3 text-right">{percent(currentMetrics?.spendShare ?? null)}</td>
                  <td className="px-3 py-3 text-right"><Change value={mixChange} /></td>
                  <td className="px-3 py-3 text-right">{count(currentMetrics?.leads ?? 0)}</td>
                  <td className="px-3 py-3 text-right font-bold">{money(currentMetrics?.cpl ?? null)}</td>
                  <td className="px-3 py-3 text-right"><Change lowerIsBetter value={sourceMetricChange(currentMetrics?.cpl ?? null, previousMetrics?.cpl ?? null)} /></td>
                  <td className="px-3 py-3 text-right">{count(currentMetrics?.bookings ?? 0)}</td>
                  <td className="px-3 py-3 text-right font-bold">{money(currentMetrics?.costPerBooking ?? null)}</td>
                  <td className="px-3 py-3 text-right"><Change lowerIsBetter value={sourceMetricChange(currentMetrics?.costPerBooking ?? null, previousMetrics?.costPerBooking ?? null)} /></td>
                  <td className="px-3 py-3 text-right">{count(currentMetrics?.shows ?? 0)}</td>
                  <td className="px-3 py-3 text-right font-bold">{money(currentMetrics?.costPerShow ?? null)}</td>
                  <td className="px-3 py-3 text-right"><Change lowerIsBetter value={sourceMetricChange(currentMetrics?.costPerShow ?? null, previousMetrics?.costPerShow ?? null)} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
