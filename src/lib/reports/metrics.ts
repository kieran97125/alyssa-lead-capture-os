import type { ReportMetrics } from "@/lib/reports/types";

export type ReportMetricCounts = {
  leads: number;
  bookings: number;
  shows: number;
  noShows: number;
  pendingShows: number;
};

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}

/**
 * Preserve the difference between an explicitly recorded HK$0 and no Spend
 * rows at all. Missing Spend must remain null so management reports never
 * present an absent ledger as a real zero-cost result.
 */
export function reportSpendTotal(
  spendAmounts: number[],
  attributable = true
) {
  if (!attributable || spendAmounts.length === 0) return null;
  return spendAmounts.reduce(
    (sum, amount) => sum + Math.max(0, Number.isFinite(amount) ? amount : 0),
    0
  );
}

export function reportMetrics(
  counts: ReportMetricCounts,
  spend: number | null
): ReportMetrics {
  return {
    spend,
    ...counts,
    bookRate: ratio(counts.bookings, counts.leads),
    showUpRate: ratio(counts.shows, counts.bookings),
    leadToShowRate: ratio(counts.shows, counts.leads),
    cpl: spend === null ? null : ratio(spend, counts.leads),
    costPerBooking: spend === null ? null : ratio(spend, counts.bookings),
    costPerShow: spend === null ? null : ratio(spend, counts.shows),
  };
}
