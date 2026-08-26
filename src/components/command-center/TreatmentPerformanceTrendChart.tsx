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
import {
  operationalItemTypeLabels,
  operationalStatusLabels,
  type OperationalAnnotation,
} from "@/lib/marketing/operationalAnnotations";
import {
  treatmentTrendMetricKeys,
  type PerformanceTrendMetricKey,
  type PerformanceTrendSeries,
} from "@/lib/marketing/performanceTrend";

const metricOptions: Array<{
  key: PerformanceTrendMetricKey;
  label: string;
  compactLabel: string;
}> = [
  { key: "leads", label: "每日 Lead", compactLabel: "Lead" },
  { key: "bookings", label: "每日 Book", compactLabel: "Book" },
  { key: "shows", label: "每日 Show", compactLabel: "Show" },
  { key: "noShows", label: "每日 No Show", compactLabel: "No Show" },
  { key: "pendingShows", label: "每日待到店", compactLabel: "待到店" },
  { key: "leadToBookRate", label: "每日 Lead → Book", compactLabel: "L→B" },
  { key: "bookToShowRate", label: "每日 Book → Show", compactLabel: "B→S" },
  { key: "leadToShowRate", label: "每日 Lead → Show", compactLabel: "L→S" },
  { key: "noShowRate", label: "每日 No-show Rate", compactLabel: "No-show %" },
];

const rateMetrics = new Set<PerformanceTrendMetricKey>([
  "leadToBookRate",
  "bookToShowRate",
  "leadToShowRate",
  "noShowRate",
]);

type ChartDatum = Record<string, number | string | null | OperationalAnnotation[]> & {
  date: string;
  annotations: OperationalAnnotation[];
  annotationY: number | null;
};

function formatValue(value: number | null, metric: PerformanceTrendMetricKey) {
  if (value === null || !Number.isFinite(value)) return "—";
  if (rateMetrics.has(metric)) {
    return new Intl.NumberFormat("zh-HK", {
      style: "percent",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return Math.round(value).toLocaleString("zh-HK");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-HK", {
    month: "numeric",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function uniqueAnnotations(items: OperationalAnnotation[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function AnnotationDot(props: {
  cx?: number;
  cy?: number;
  payload?: ChartDatum;
}) {
  const count = props.payload?.annotations.length ?? 0;
  if (!count || typeof props.cx !== "number" || typeof props.cy !== "number") {
    return null;
  }
  return (
    <g aria-label={`${count} 個成效事件`}>
      <circle cx={props.cx} cy={props.cy} r={7} fill="#fff" stroke="#D3913E" strokeWidth={3} />
      {count > 1 ? (
        <text
          x={props.cx}
          y={props.cy + 2.5}
          textAnchor="middle"
          fill="#8A4F17"
          fontSize={7}
          fontWeight={900}
        >
          {count}
        </text>
      ) : null}
    </g>
  );
}

function TrendTooltip({
  active,
  label,
  payload,
  metric,
}: {
  active?: boolean;
  label?: string | number;
  payload?: Array<{
    name?: string;
    value?: number | string | null;
    color?: string;
    dataKey?: string | number;
    payload?: ChartDatum;
  }>;
  metric: PerformanceTrendMetricKey;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  const annotations = row?.annotations ?? [];
  const values = payload.filter((item) => item.dataKey !== "annotationY");
  return (
    <div className="performance-trend-tooltip">
      <strong>{formatDate(String(label ?? row?.date ?? ""))}</strong>
      <div className="performance-trend-tooltip-values">
        {values.map((item) => (
          <span key={String(item.dataKey)}>
            <i style={{ background: item.color || "#5A2348" }} />
            {item.name}
            <b>
              {formatValue(
                typeof item.value === "number"
                  ? item.value
                  : item.value === null || item.value === undefined
                    ? null
                    : Number(item.value),
                metric
              )}
            </b>
          </span>
        ))}
      </div>
      {annotations.length > 0 ? (
        <div className="performance-trend-annotations">
          <p>當日成效事件</p>
          {annotations.slice(0, 5).map((annotation) => (
            <article key={annotation.id}>
              <span style={{ background: annotation.brandColor }} />
              <div>
                <strong>{annotation.title}</strong>
                <small>
                  {annotation.brandName}
                  {annotation.treatmentLabel
                    ? ` · ${annotation.treatmentLabel}`
                    : " · 品牌整體"}
                  {` · ${operationalItemTypeLabels[annotation.itemType] || annotation.itemType}`}
                  {annotation.channel ? ` · ${annotation.channel}` : ""}
                  {` · ${operationalStatusLabels[annotation.status] || annotation.status}`}
                </small>
                {annotation.notes ? <p>{annotation.notes}</p> : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function TreatmentPerformanceTrendChart({
  series,
}: {
  series: PerformanceTrendSeries[];
}) {
  const [metric, setMetric] = useState<PerformanceTrendMetricKey>("leads");
  const selectedMetric =
    metricOptions.find((option) => option.key === metric) ?? metricOptions[0];
  const available = new Set(treatmentTrendMetricKeys);
  const chartData = useMemo(() => {
    const dates = Array.from(
      new Set(series.flatMap((item) => item.points.map((point) => point.date)))
    ).sort();
    return dates.map((date): ChartDatum => {
      const row = {
        date,
        annotations: uniqueAnnotations(
          series.flatMap(
            (item) =>
              item.points.find((point) => point.date === date)?.annotations ?? []
          )
        ),
        annotationY: null,
      } as ChartDatum;
      let maximum = 0;
      series.forEach((item, index) => {
        const point = item.points.find((candidate) => candidate.date === date);
        const value = point?.[metric] ?? null;
        row[`series_${index}`] = value;
        if (typeof value === "number" && Number.isFinite(value)) {
          maximum = Math.max(maximum, value);
        }
      });
      row.annotationY = row.annotations.length > 0 ? maximum : null;
      return row;
    });
  }, [metric, series]);

  if (series.length === 0) {
    return <div className="period-chart-loading">所選期間未有可繪製嘅療程走勢。</div>;
  }

  return (
    <div className="period-chart-panel treatment-trend-panel">
      <div className="period-chart-controls" aria-label="療程走勢指標">
        {metricOptions
          .filter((option) => available.has(option.key))
          .map((option) => (
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
        aria-label={`${selectedMetric.label}走勢；橙色圓點代表已連結嘅成效事件`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 14, right: 16, left: 4, bottom: 4 }} accessibilityLayer>
            <CartesianGrid stroke="#eee3de" strokeDasharray="4 5" vertical={false} />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              minTickGap={24}
              tick={{ fill: "#8b7a81", fontSize: 11, fontWeight: 650 }}
              tickFormatter={formatDate}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={60}
              domain={[0, "auto"]}
              tick={{ fill: "#8b7a81", fontSize: 10, fontWeight: 650 }}
              tickFormatter={(value) => formatValue(Number(value), metric)}
            />
            <Tooltip
              cursor={{ stroke: "#c9828e", strokeDasharray: "4 4" }}
              content={<TrendTooltip metric={metric} />}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px", fontWeight: 700, paddingTop: 8 }} />
            {series.map((item, index) => (
              <Line
                key={item.key}
                type="monotone"
                dataKey={`series_${index}`}
                name={item.label}
                stroke={item.color}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, fill: "#fff" }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
            <Line
              type="linear"
              dataKey="annotationY"
              name="成效事件"
              stroke="transparent"
              dot={<AnnotationDot />}
              activeDot={<AnnotationDot />}
              connectNulls={false}
              isAnimationActive={false}
              legendType="none"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
