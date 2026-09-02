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
import { TrendModeToggle, useTrendModePreference } from "@/components/command-center/TrendModeToggle";
import {
  operationalItemTypeLabels,
  operationalStatusLabels,
  type OperationalAnnotation,
} from "@/lib/marketing/operationalAnnotations";
import type {
  PerformanceTrendMetricKey,
  PerformanceTrendMode,
  PerformanceTrendPoint,
  PerformanceTrendScope,
} from "@/lib/marketing/performanceTrend";
import { performanceTrendPointsForMode } from "@/lib/marketing/performanceTrend";

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
  { key: "cpl", label: "每個 Lead 成本", compactLabel: "CPLead" },
  { key: "costPerBooking", label: "每個 Book 成本", compactLabel: "CPBook" },
  { key: "costPerShow", label: "每個 Show 成本", compactLabel: "CPShow" },
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

function annotationsForSeries(
  payload: ChartDatum | undefined,
  seriesIndex: number
) {
  const value = payload?.[`annotations_${seriesIndex}`];
  return Array.isArray(value) ? (value as OperationalAnnotation[]) : [];
}

function AnnotationDot(props: {
  cx?: number;
  cy?: number;
  payload?: ChartDatum;
  seriesIndex: number;
  seriesLabel: string;
  seriesColor: string;
}) {
  const annotations = annotationsForSeries(props.payload, props.seriesIndex);
  const count = annotations.length;
  if (!count || typeof props.cx !== "number" || typeof props.cy !== "number") {
    return null;
  }
  return (
    <g
      aria-label={`${count} 個成效事件`}
      data-testid="period-series-annotation"
      data-series-label={props.seriesLabel}
      data-event-dates={annotations.map((annotation) => annotation.date).join(",")}
    >
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
          fill={props.seriesColor}
          fontSize={7}
          fontWeight={900}
        >
          {count}
        </text>
      ) : (
        <circle cx={props.cx} cy={props.cy} r={2.25} fill={props.seriesColor} />
      )}
    </g>
  );
}

function ComparisonTooltip({
  active,
  label,
  payload,
  metric,
  mode,
  seriesLabels,
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
  mode: PerformanceTrendMode;
  seriesLabels: string[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  const annotationEntries = seriesLabels.flatMap((seriesLabel, seriesIndex) =>
    annotationsForSeries(row, seriesIndex).map((annotation) => ({
      annotation,
      seriesLabel,
    }))
  );
  const values = payload.filter(
    (item) => !String(item.dataKey ?? "").startsWith("annotationY_")
  );
  return (
    <div className="performance-trend-tooltip">
      <strong>
        第 {label} 日 · {mode === "cumulative" ? "累積" : "單日"}
      </strong>
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
      {annotationEntries.length > 0 ? (
        <div className="performance-trend-annotations">
          <p>同期成效事件（按月份）</p>
          {annotationEntries.slice(0, 8).map(({ annotation, seriesLabel }) => (
            <article key={`${seriesLabel}:${annotation.id}`}>
              <span style={{ background: annotation.brandColor }} />
              <div>
                <strong>{annotation.title}</strong>
                <small>
                  {seriesLabel} · {formatDate(annotation.date)} · {annotation.brandName}
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
  const [mode, setMode] = useTrendModePreference({
    defaultMode: "cumulative",
    preferenceKey: "period-comparison",
  });
  const scope = scopes.find((item) => item.key === scopeKey) ?? scopes[0];
  const activeMetric = scope?.availableMetrics.includes(metric)
    ? metric
    : scope?.availableMetrics[0] ?? "leads";
  const selectedMetric =
    metricOptions.find((option) => option.key === activeMetric) ?? metricOptions[1];
  const chartData = useMemo(() => {
    const series = (scope?.series ?? []).map((item) => ({
      ...item,
      points: performanceTrendPointsForMode(item.points, mode),
    }));
    const maximumPoints = Math.max(0, ...series.map((item) => item.points.length));
    return Array.from({ length: maximumPoints }, (_, index): ChartDatum => {
      const row: ChartDatum = {
        day: series[0]?.points[index]?.day ?? index + 1,
      };
      series.forEach((item, seriesIndex) => {
        const point = item.points[index];
        const value = pointValue(point, activeMetric);
        const annotations = uniqueAnnotations(point?.annotations ?? []);
        row[`series_${seriesIndex}`] = value;
        row[`annotations_${seriesIndex}`] = annotations;
        row[`annotationY_${seriesIndex}`] =
          annotations.length > 0
            ? typeof value === "number" && Number.isFinite(value)
              ? value
              : 0
            : null;
      });
      return row;
    });
  }, [activeMetric, mode, scope]);

  if (!scope) {
    return <div className="period-chart-loading">所選期間未有可繪製走勢。</div>;
  }

  const overallScopes = scopes.filter((item) => item.type === "overall");
  const brandScopes = scopes.filter((item) => item.type === "brand");
  const treatmentScopes = scopes.filter((item) => item.type === "treatment");
  const seriesLabels = scope.series.map((item) => item.label);
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

      <div className="mb-3 flex flex-col gap-3 rounded-2xl border border-[#eadfd9] bg-[#fffaf7] px-3 py-2.5 lg:flex-row lg:items-center lg:justify-between">
        <TrendModeToggle mode={mode} onChange={setMode} compact />
        <span className="text-[10px] font-semibold leading-4 text-[#8b7180]">
          累積比較整體進度；單日比較每日實際波動。成本同轉換率均按所選模式重新計算。
        </span>
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
        aria-label={`${scope.label} ${selectedMetric.label}同期${
          mode === "cumulative" ? "累積" : "單日"
        }走勢；橙色圓點代表已連結嘅成效事件，圓心顏色對應所屬月份`}
        data-trend-mode={mode}
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
              content={
                <ComparisonTooltip
                  metric={activeMetric}
                  mode={mode}
                  seriesLabels={seriesLabels}
                />
              }
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: "11px", fontWeight: 700, paddingTop: 8 }}
            />
            {scope.series.map((item, index) => (
              <Line
                key={item.key}
                type={mode === "cumulative" ? "monotone" : "linear"}
                dataKey={`series_${index}`}
                name={item.label}
                stroke={item.color}
                strokeWidth={index === 0 ? 3 : 2}
                strokeOpacity={index === 0 ? 1 : 0.78}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, fill: "#fff" }}
                connectNulls={mode === "cumulative"}
                isAnimationActive={false}
              />
            ))}
            {scope.series.map((item, index) => (
              <Line
                key={`annotation:${item.key}`}
                type="linear"
                dataKey={`annotationY_${index}`}
                name={`${item.label} 成效事件`}
                stroke="transparent"
                dot={
                  <AnnotationDot
                    seriesIndex={index}
                    seriesLabel={item.label}
                    seriesColor={item.color}
                  />
                }
                activeDot={
                  <AnnotationDot
                    seriesIndex={index}
                    seriesLabel={item.label}
                    seriesColor={item.color}
                  />
                }
                connectNulls={false}
                isAnimationActive={false}
                legendType="none"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
