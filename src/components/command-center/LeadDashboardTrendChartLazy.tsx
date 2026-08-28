"use client";

import dynamic from "next/dynamic";
import type { PerformanceTrendSeries } from "@/lib/marketing/performanceTrend";

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
}: {
  series: PerformanceTrendSeries[];
}) {
  return (
    <LazyTrendChart
      series={series}
      defaultMode="daily"
      preferenceKey="lead-dashboard"
    />
  );
}
