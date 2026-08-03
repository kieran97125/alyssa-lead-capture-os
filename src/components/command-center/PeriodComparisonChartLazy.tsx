"use client";

import dynamic from "next/dynamic";
import type { PeriodComparisonTrendSeries } from "@/lib/marketing/periodComparisonMath";

const LazyPeriodComparisonChart = dynamic(
  () =>
    import("@/components/command-center/PeriodComparisonChart").then(
      (module) => module.PeriodComparisonChart
    ),
  {
    ssr: false,
    loading: () => (
      <div className="period-chart-loading" role="status">
        正在準備同期走勢…
      </div>
    ),
  }
);

export function PeriodComparisonChartLazy({
  series,
}: {
  series: PeriodComparisonTrendSeries[];
}) {
  return <LazyPeriodComparisonChart series={series} />;
}
