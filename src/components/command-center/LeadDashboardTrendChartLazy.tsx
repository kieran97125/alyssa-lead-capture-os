"use client";

import dynamic from "next/dynamic";
import type { PerformanceTrendSeries } from "@/lib/marketing/performanceTrend";
import type { PerformanceCostAvailability } from "@/lib/marketing/performanceCostMath";

const LazyTrendChart = dynamic(
  () =>
    import("@/components/command-center/TreatmentPerformanceTrendChart").then(
      (module) => module.TreatmentPerformanceTrendChart
    ),
  {
    ssr: false,
    loading: () => (
      <div className="period-chart-loading" role="status">
        正在準備 Dashboard 走勢…
      </div>
    ),
  }
);

export function LeadDashboardTrendChartLazy({
  series,
  costAvailability,
}: {
  series: PerformanceTrendSeries[];
  costAvailability: PerformanceCostAvailability;
}) {
  return (
    <LazyTrendChart
      series={series}
      costAvailability={costAvailability}
      defaultMode="daily"
      preferenceKey="lead-dashboard"
    />
  );
}
