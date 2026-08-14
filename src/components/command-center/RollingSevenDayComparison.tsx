"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeDollarSign,
  CalendarDays,
  Coins,
  UserRoundCheck,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import type {
  RollingComparisonMetricKey,
  RollingSevenDaySnapshot,
} from "@/lib/marketing/rollingComparison";
import type { ReportMetrics } from "@/lib/reports/types";

type MetricKind = "currency" | "count" | "rate";
type MetricIcon = ComponentType<{ size?: number; strokeWidth?: number }>;

type MetricDefinition = {
  key: RollingComparisonMetricKey;
  label: string;
  kind: MetricKind;
  icon: MetricIcon;
  lowerIsBetter?: boolean;
};

const metrics: MetricDefinition[] = [
  { key: "spend", label: "廣告費", kind: "currency", icon: WalletCards },
  { key: "leads", label: "Lead", kind: "count", icon: UsersRound },
  { key: "bookings", label: "Book", kind: "count", icon: CalendarDays },
  { key: "shows", label: "Show", kind: "count", icon: UserRoundCheck },
  { key: "cpl", label: "CPL", kind: "currency", icon: Coins, lowerIsBetter: true },
  {
    key: "costPerBooking",
    label: "CPA · Book",
    kind: "currency",
    icon: BadgeDollarSign,
    lowerIsBetter: true,
  },
  {
    key: "costPerShow",
    label: "CPA · Show",
    kind: "currency",
    icon: BadgeDollarSign,
    lowerIsBetter: true,
  },
];

const rates: Array<{ key: RollingComparisonMetricKey; label: string }> = [
  { key: "bookRate", label: "Lead → Book" },
  { key: "showUpRate", label: "Book → Show" },
  { key: "leadToShowRate", label: "Lead → Show" },
];

function valueOf(metrics: ReportMetrics, key: RollingComparisonMetricKey) {
  return metrics[key];
}

function formatMetric(value: number | null, kind: MetricKind) {
  if (value === null || !Number.isFinite(value)) return "—";
  if (kind === "currency") {
    return new Intl.NumberFormat("zh-HK", {
      style: "currency",
      currency: "HKD",
      maximumFractionDigits: 2,
    }).format(value);
  }
  if (kind === "rate") {
    return new Intl.NumberFormat("zh-HK", {
      style: "percent",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return Math.round(value).toLocaleString("zh-HK");
}

function ActualChange({
  change,
  lowerIsBetter = false,
  neutral = false,
}: {
  change: number | null | undefined;
  lowerIsBetter?: boolean;
  neutral?: boolean;
}) {
  if (change === null || change === undefined || Math.abs(change) < 0.0005) {
    return null;
  }
  const Icon = change > 0 ? ArrowUpRight : ArrowDownRight;
  const good = lowerIsBetter ? change < 0 : change > 0;
  return (
    <span
      className={`rolling-change ${neutral ? "is-neutral" : good ? "is-good" : "is-bad"}`}
    >
      <Icon size={13} />
      {Math.abs(change).toLocaleString("zh-HK", {
        style: "percent",
        maximumFractionDigits: 1,
      })}
      <small>vs 前 7 日</small>
    </span>
  );
}

export function RollingSevenDayComparison() {
  const searchParams = useSearchParams();
  const brand = searchParams.get("brand") || "";
  const requestUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (brand) params.set("brand", brand);
    const query = params.toString();
    return `/api/internal/performance/rolling-comparison${query ? `?${query}` : ""}`;
  }, [brand]);
  const [snapshot, setSnapshot] = useState<RollingSevenDaySnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    fetch(requestUrl, {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const payload = (await response.json()) as {
          ok?: boolean;
          snapshot?: RollingSevenDaySnapshot;
        };
        return payload.ok ? payload.snapshot ?? null : null;
      })
      .then((next) => {
        if (active) setSnapshot(next);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [requestUrl]);

  if (!loading && !snapshot) return null;

  return (
    <section className="rolling-compare-shell" aria-label="近 7 日對比">
      <div className="rolling-compare-panel">
        <header className="rolling-compare-header">
          <div>
            <p>短期趨勢</p>
            <h2>近 7 日 vs 前 7 日</h2>
            <span>
              只計香港時間已完成日，今日未完結數據唔會混入比較。
            </span>
          </div>
          {snapshot ? (
            <div className="rolling-period-pills">
              <span className="is-current">
                最近 7 日 <strong>{snapshot.current.label}</strong>
              </span>
              <span>
                前 7 日 <strong>{snapshot.previous.label}</strong>
              </span>
              <span className="is-brand">{snapshot.brandLabel}</span>
            </div>
          ) : null}
        </header>

        {loading || !snapshot ? (
          <div className="rolling-compare-loading" role="status">
            正在計算近 7 日成效…
          </div>
        ) : (
          <>
            <div className="rolling-kpi-grid">
              {metrics.map((definition) => {
                const Icon = definition.icon;
                const current = valueOf(snapshot.current.metrics, definition.key);
                const previous = valueOf(snapshot.previous.metrics, definition.key);
                return (
                  <article key={definition.key} className="rolling-kpi-card">
                    <span className="rolling-kpi-icon">
                      <Icon size={17} />
                    </span>
                    <div className="rolling-kpi-copy">
                      <p>{definition.label}</p>
                      <strong>{formatMetric(current, definition.kind)}</strong>
                      <small>
                        前 7 日 {formatMetric(previous, definition.kind)}
                      </small>
                      <ActualChange
                        change={snapshot.changes[definition.key]}
                        lowerIsBetter={definition.lowerIsBetter}
                        neutral={definition.key === "spend"}
                      />
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="rolling-rate-grid">
              {rates.map((definition) => (
                <article key={definition.key}>
                  <span>{definition.label}</span>
                  <strong>
                    {formatMetric(
                      valueOf(snapshot.current.metrics, definition.key),
                      "rate"
                    )}
                  </strong>
                  <small>
                    前 7 日{" "}
                    {formatMetric(
                      valueOf(snapshot.previous.metrics, definition.key),
                      "rate"
                    )}
                  </small>
                  <ActualChange change={snapshot.changes[definition.key]} />
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
