"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  ComparisonMetricKey,
  ComparisonTrendPoint,
  PeriodComparisonTrendSeries,
} from "@/lib/marketing/periodComparisonMath";

const metricOptions: Array<{
  key: ComparisonMetricKey;
  label: string;
  compactLabel: string;
}> = [
  { key: "spend", label: "廣告費", compactLabel: "Spend" },
  { key: "leads", label: "Lead", compactLabel: "Lead" },
  { key: "bookings", label: "Book", compactLabel: "Book" },
  { key: "shows", label: "Show", compactLabel: "Show" },
  { key: "cpl", label: "每個 Lead 成本", compactLabel: "CPL" },
  {
    key: "costPerBooking",
    label: "每個 Book 成本",
    compactLabel: "CPA · Book",
  },
  {
    key: "costPerShow",
    label: "每個 Show 成本",
    compactLabel: "CPA · Show",
  },
  {
    key: "leadToBookRate",
    label: "Lead → Book",
    compactLabel: "L→B",
  },
  {
    key: "bookToShowRate",
    label: "Book → Show",
    compactLabel: "B→S",
  },
  {
    key: "leadToShowRate",
    label: "Lead → Show",
    compactLabel: "L→S",
  },
];

const currencyMetrics = new Set<ComparisonMetricKey>([
  "spend",
  "cpl",
  "costPerBooking",
  "costPerShow",
]);
const rateMetrics = new Set<ComparisonMetricKey>([
  "leadToBookRate",
  "bookToShowRate",
  "leadToShowRate",
]);

function formatMetricValue(value: number | null, metric: ComparisonMetricKey) {
  if (value === null || !Number.isFinite(value)) return "—";
  if (currencyMetrics.has(metric)) {
    return new Intl.NumberFormat("zh-HK", {
      style: "currency",
      currency: "HKD",
      maximumFractionDigits: metric === "spend" ? 0 : 2,
    }).format(value);
  }
  if (rateMetrics.has(metric)) {
    return new Intl.NumberFormat("zh-HK", {
      style: "percent",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return Math.round(value).toLocaleString("zh-HK");
}

function valueAt(point: ComparisonTrendPoint, metric: ComparisonMetricKey) {
  return point[metric];
}

export function PeriodComparisonChart({
  series,
}: {
  series: PeriodComparisonTrendSeries[];
}) {
  const [metric, setMetric] = useState<ComparisonMetricKey>("spend");
  const selectedMetric =
    metricOptions.find((option) => option.key === metric) ?? metricOptions[0];
  const chartData = useMemo(() => {
    const maximumPoints = Math.max(0, ...series.map((item) => item.points.length));
    return Array.from({ length: maximumPoints }, (_, index) => {
      const row: Record<string, number | string | null> = {
        day: series[0]?.points[index]?.day ?? index + 1,
      };
      series.forEach((item, seriesIndex) => {
        row[`series_${seriesIndex}`] = item.points[index]
          ? valueAt(item.points[index], metric)
          : null;
      });
      return row;
    });
  }, [metric, series]);

  return (
    <div className="period-chart-panel">
      <div className="period-chart-controls" aria-label="走勢指標">
        {metricOptions.map((option) => (
          <button
            key={option.key}
            type="button"
            aria-pressed={metric === option.key}
            onClick={() => setMetric(option.key)}
          >
            {option.compactLabel}
          </button>
        ))}
      </div>

      <div
        className="period-chart-canvas"
        role="img"
        aria-label={`${selectedMetric.label}同期累積走勢`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 12, right: 14, left: 4, bottom: 2 }}
            accessibilityLayer
          >
            <CartesianGrid stroke="#eee3de" strokeDasharray="4 5" vertical={false} />
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#8b7a81", fontSize: 11, fontWeight: 650 }}
              tickFormatter={(value) => `${value}日`}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={72}
              tick={{ fill: "#8b7a81", fontSize: 10, fontWeight: 650 }}
              tickFormatter={(value) => formatMetricValue(Number(value), metric)}
            />
            <Tooltip
              cursor={{ stroke: "#c9828e", strokeDasharray: "4 4" }}
              labelFormatter={(label) => `第 ${label} 日累積`}
              formatter={(value) =>
                formatMetricValue(
                  typeof value === "number" ? value : Number(value),
                  metric
                )
              }
              contentStyle={{
                border: "1px solid #eadbd5",
                borderRadius: "12px",
                boxShadow: "0 12px 30px rgba(52, 25, 42, 0.12)",
                fontSize: "12px",
              }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: "11px", fontWeight: 700, paddingTop: 8 }}
            />
            {series.map((item, index) => (
              <Line
                key={item.monthStart}
                type="monotone"
                dataKey={`series_${index}`}
                name={item.label}
                stroke={item.color}
                strokeWidth={index === 0 ? 3 : 2}
                strokeOpacity={index === 0 ? 1 : 0.78}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, fill: "#fff" }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
