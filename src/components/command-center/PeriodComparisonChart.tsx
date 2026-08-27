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
import type {
  PerformanceTrendMetricKey,
  PerformanceTrendPoint,
  PerformanceTrendScope,
} from "@/lib/marketing/performanceTrend";

const metricOptions: Array<{
  key: PerformanceTrendMetricKey;
  label: string;
  compactLabel: string;
}> = [
  { key: "spend", label: "廣告費", compactLabel: "Spend" },
  { key: "leads", label: "Lead", compactLabel: "Lead" },
  { key: "bookings", label: "Book", compactLabel: "Book" },
  { key: "shows", label: "Show", compactLabel: "Show" },
  { key: "noShows", label: "No Show", compactLabel: "No Show" },
  { key: "pendingShows", label: "待到店", compactLabel: "待到店" },
  { key: "cpl", label: "每個 Lead 成本", compactLabel: "CPL" },
  { key: "costPerBooking", label: "每個 Book 成本", compactLabel: "CPA · Book" },
  { key: "costPerShow", label: "每個 Show 成本", compactLabel: "CPA · Show" },
  { key: "leadToBookRate", label: "Lead → Book", compactLabel: "L→B" },
  { key: "bookToShowRate", label: "Book → Show", compactLabel: "B→S" },
  { key: "leadToShowRate", label: "Lead → Show", compactLabel: "L→S" },
  { key: "noShowRate", label: "No-show Rate", compactLabel: "No-show %" },
];

const currencyMetrics = new Set<PerformanceTrendMetricKey>([
  "spend",
  "cpl",
  "costPerBooking",
  "costPerShow",
]);
const rateMetrics = new Set<PerformanceTrendMetricKey>([
  "leadToBookRate",
  "bookToShowRate",
  "leadToShowRate",
  "noShowRate",
]);

type ChartDatum = {
  day: number;
  annotations: OperationalAnnotation[];
  annotationY: number | null;
  [key: string]: number | string | null | OperationalAnnotation[];
};

function formatMetricValue(
  value: number | null,
  metric: PerformanceTrendMetricKey
) {
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-HK", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function uniqueAnnotations(items: OperationalAnnotation[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function pointValue(
  point: PerformanceTrendPoint | undefined,
  metric: PerformanceTrendMetricKey
) {
  return point ? point[metric] : null;
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
      <circle
        cx={props.cx}
        cy={props.cy}
        r={7}
        fill="#fff"
        stroke="#D3913E"
        strokeWidth={3}
      />
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

function ComparisonTooltip({
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
      <strong>第 {label} 日累積</strong>
      <div className="performance-trend-tooltip-values">
        {values.map((item) => {
          const value =
            typeof item.value === "number"
              ? item.value
              : item.value === null || item.value === undefined
                ? null
                : Number(item.value);
          return (
            <span key={String(item.dataKey)}>
              <i style={{ background: item.color || "#5A2348" }} />
              {item.name}
              <b>{formatMetricValue(value, metric)}</b>
            </span>
          );
        })}
      </div>
      {annotations.length > 0 ? (
        <div className="performance-trend-annotations">
          <p>同期成效事件</p>
          {annotations.slice(0, 6).map((annotation) => (
            <article key={annotation.id}>
              <span style={{ background: annotation.brandColor }} />
              <div>
                <strong>{annotation.title}</strong>
                <small>
                  {formatDate(annotation.date)} · {annotation.brandName}
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

export function PeriodComparisonChart({
  scopes,
}: {
  scopes: PerformanceTrendScope[];
}) {
  const [scopeKey, setScopeKey] = useState(scopes[0]?.key ?? "");
  const [metric, setMetric] = useState<PerformanceTrendMetricKey>("spend");
  const scope = scopes.find((item) => item.key === scopeKey) ?? scopes[0];
  const activeMetric = scope?.availableMetrics.includes(metric)
    ? metric
    : scope?.availableMetrics[0] ?? "leads";
  const selectedMetric =
    metricOptions.find((option) => option.key === activeMetric) ?? metricOptions[1];
  const chartData = useMemo(() => {
    const series = scope?.series ?? [];
    const maximumPoints = Math.max(0, ...series.map((item) => item.points.length));
    return Array.from({ length: maximumPoints }, (_, index): ChartDatum => {
      const annotations = uniqueAnnotations(
        series.flatMap((item) => item.points[index]?.annotations ?? [])
      );
      const row: ChartDatum = {
        day: series[0]?.points[index]?.day ?? index + 1,
        annotations,
        annotationY: null,
      };
      let maximum = 0;
      series.forEach((item, seriesIndex) => {
        const value = pointValue(item.points[index], activeMetric);
        row[`series_${seriesIndex}`] = value;
        if (typeof value === "number" && Number.isFinite(value)) {
          maximum = Math.max(maximum, value);
        }
      });
      row.annotationY = annotations.length > 0 ? maximum : null;
      return row;
    });
  }, [activeMetric, scope]);

  if (!scope) {
    return <div className="period-chart-loading">所選期間未有可繪製走勢。</div>;
  }

  const overallScopes = scopes.filter((item) => item.type === "overall");
  const brandScopes = scopes.filter((item) => item.type === "brand");
  const treatmentScopes = scopes.filter((item) => item.type === "treatment");
  return (
    <div className="period-chart-panel">
      <div className="period-scope-control">
        <label htmlFor="period-trend-scope">分析範圍</label>
        <select
          id="period-trend-scope"
          value={scope.key}
          onChange={(event) => {
            const nextScope = scopes.find((item) => item.key === event.target.value);
            setScopeKey(event.target.value);
            if (nextScope && !nextScope.availableMetrics.includes(metric)) {
              setMetric(nextScope.availableMetrics[0]);
            }
          }}
        >
          <optgroup label="整體">
            {overallScopes.map((item) => (
              <option key={item.key} value={item.key}>{item.label}</option>
            ))}
          </optgroup>
          <optgroup label="品牌">
            {brandScopes.map((item) => (
              <option key={item.key} value={item.key}>{item.label}</option>
            ))}
          </optgroup>
          {treatmentScopes.length > 0 ? (
            <optgroup label="療程">
              {treatmentScopes.map((item) => (
                <option key={item.key} value={item.key}>{item.label}</option>
              ))}
            </optgroup>
          ) : null}
        </select>
        <small>{scope.description}</small>
      </div>

      <div className="period-chart-controls" aria-label="走勢指標">
        {metricOptions
          .filter((option) => scope.availableMetrics.includes(option.key))
          .map((option) => (
            <button
              key={option.key}
              type="button"
              aria-pressed={activeMetric === option.key}
              onClick={() => setMetric(option.key)}
            >
              {option.compactLabel}
            </button>
          ))}
      </div>

      <div
        className="period-chart-canvas"
        role="img"
        aria-label={`${scope.label} ${selectedMetric.label}同期累積走勢；橙色圓點代表已連結嘅成效事件`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 14, right: 16, left: 4, bottom: 4 }}
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
              domain={[0, "auto"]}
              tick={{ fill: "#8b7a81", fontSize: 10, fontWeight: 650 }}
              tickFormatter={(value) => formatMetricValue(Number(value), activeMetric)}
            />
            <Tooltip
              cursor={{ stroke: "#c9828e", strokeDasharray: "4 4" }}
              content={<ComparisonTooltip metric={activeMetric} />}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: "11px", fontWeight: 700, paddingTop: 8 }}
            />
            {scope.series.map((item, index) => (
              <Line
                key={item.key}
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
