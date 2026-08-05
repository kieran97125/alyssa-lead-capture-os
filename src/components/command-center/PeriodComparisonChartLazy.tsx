"use client";

import dynamic from "next/dynamic";
import type { PerformanceTrendScope } from "@/lib/marketing/performanceTrend";

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
  scopes,
}: {
  scopes: PerformanceTrendScope[];
}) {
  return <LazyPeriodComparisonChart scopes={scopes} />;
}
