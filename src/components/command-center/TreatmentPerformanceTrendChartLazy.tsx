"use client";

import dynamic from "next/dynamic";
import type { PerformanceTrendSeries } from "@/lib/marketing/performanceTrend";

const LazyTreatmentPerformanceTrendChart = dynamic(
  () =>
    import("@/components/command-center/TreatmentPerformanceTrendChart").then(
      (module) => module.TreatmentPerformanceTrendChart
    ),
  {
    ssr: false,
    loading: () => (
      <div className="period-chart-loading" role="status">
        正在準備療程走勢…
      </div>
    ),
  }
);

export function TreatmentPerformanceTrendChartLazy({
  series,
}: {
  series: PerformanceTrendSeries[];
}) {
  return <LazyTreatmentPerformanceTrendChart series={series} />;
}
