import type { ComponentType } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeDollarSign,
  CalendarRange,
  CheckCircle2,
  Clock3,
  Coins,
  DatabaseZap,
  Filter,
  GitCompareArrows,
  Info,
  TriangleAlert,
  UserRoundCheck,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { AppNav } from "@/components/alyssa/AppNav";
import { IntentPrefetchLink } from "@/components/alyssa/IntentPrefetchLink";
import { BrandMark } from "@/components/command-center/BrandMark";
import { PeriodComparisonChartLazy } from "@/components/command-center/PeriodComparisonChartLazy";
import {
  getPeriodComparisonSnapshot,
  type ComparisonDataQuality,
  type PeriodComparisonQuery,
} from "@/lib/marketing/periodComparison";
import type {
  ComparisonKpis,
  ComparisonMetricKey,
} from "@/lib/marketing/periodComparisonMath";
import { getCurrentInternalAccess } from "@/lib/security/internalAccessServer";

export const dynamic = "force-dynamic";

type MetricIcon = ComponentType<{ size?: number; strokeWidth?: number }>;
type MetricKind = "currency" | "count" | "rate";

const primaryMetrics: Array<{
  key: ComparisonMetricKey;
  label: string;
  note: string;
  kind: MetricKind;
  icon: MetricIcon;
  tone: string;
}> = [
  {
    key: "spend",
    label: "廣告費",
    note: "同期已同步 Spend",
    kind: "currency",
    icon: WalletCards,
    tone: "plum",
  },
  {
    key: "leads",
    label: "Lead",
    note: "查詢日期歸屬",
    kind: "count",
    icon: UsersRound,
    tone: "blue",
  },
  {
    key: "bookings",
    label: "Book",
    note: "已預約／到店／No-show",
    kind: "count",
    icon: CalendarRange,
    tone: "rose",
  },
  {
    key: "shows",
    label: "Show",
    note: "確認到店日期歸屬",
    kind: "count",
    icon: UserRoundCheck,
    tone: "green",
  },
  {
    key: "cpl",
    label: "CPL",
    note: "Spend ÷ Lead",
    kind: "currency",
    icon: Coins,
    tone: "plum",
  },
  {
    key: "costPerBooking",
    label: "CPA · Book",
    note: "Spend ÷ Book",
    kind: "currency",
    icon: BadgeDollarSign,
    tone: "rose",
  },
  {
    key: "costPerShow",
    label: "CPA · Show",
    note: "Spend ÷ Show",
    kind: "currency",
    icon: BadgeDollarSign,
    tone: "green",
  },
];

const rateMetrics: Array<{
  key: ComparisonMetricKey;
  label: string;
  formula: string;
}> = [
  { key: "leadToBookRate", label: "Lead → Book", formula: "Book ÷ Lead" },
  { key: "bookToShowRate", label: "Book → Show", formula: "Show ÷ Book" },
  { key: "leadToShowRate", label: "Lead → Show", formula: "Show ÷ Lead" },
];

const lowerIsBetter = new Set<ComparisonMetricKey>([
  "cpl",
  "costPerBooking",
  "costPerShow",
]);

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

function formatDateTime(value: string | null) {
  if (!value) return "尚未有完整同步時間";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "尚未有完整同步時間";
  return `${new Intl.DateTimeFormat("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date)} HKT`;
}

function qualityLabel(quality: ComparisonDataQuality) {
  if (quality === "complete") return "完整";
  if (quality === "partial") return "部分";
  return "未有數據";
}

function ChangeBadge({
  metric,
  change,
}: {
  metric: ComparisonMetricKey;
  change: number | null | undefined;
}) {
  if (change === null || change === undefined) {
    return <span className="period-change is-neutral">未有可比基準</span>;
  }
  if (Math.abs(change) < 0.0005) {
    return <span className="period-change is-neutral">與上月相若</span>;
  }
  if (metric === "spend") {
    const Icon = change > 0 ? ArrowUpRight : ArrowDownRight;
    return (
      <span className="period-change is-neutral">
        <Icon size={13} />
        {Math.abs(change).toLocaleString("zh-HK", {
          style: "percent",
          maximumFractionDigits: 1,
        })}
        <span>vs 上月</span>
      </span>
    );
  }
  const improved = lowerIsBetter.has(metric) ? change < 0 : change > 0;
  const Icon = change > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`period-change ${improved ? "is-good" : "is-bad"}`}>
      <Icon size={13} />
      {Math.abs(change).toLocaleString("zh-HK", {
        style: "percent",
        maximumFractionDigits: 1,
      })}
      <span>vs 上月</span>
    </span>
  );
}

function metricKind(key: ComparisonMetricKey): MetricKind {
  if (
    key === "spend" ||
    key === "cpl" ||
    key === "costPerBooking" ||
    key === "costPerShow"
  ) {
    return "currency";
  }
  if (key.endsWith("Rate")) return "rate";
  return "count";
}

function metricValue(metrics: ComparisonKpis, key: ComparisonMetricKey) {
  return metrics[key];
}

export default async function PeriodComparisonPage({
  searchParams,
}: {
  searchParams?: Promise<PeriodComparisonQuery>;
}) {
  const query = (await searchParams) ?? {};
  const [snapshot, access] = await Promise.all([
    getPeriodComparisonSnapshot(query),
    getCurrentInternalAccess(),
  ]);
  const current = snapshot.totals[0];

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="command-page period-comparison-page">
        <div className="command-page-inner">
          <header className="command-page-header period-comparison-header">
            <div>
              <p className="command-page-kicker">Cross-period intelligence</p>
              <h1 className="command-page-title">品牌同期對比</h1>
              <p className="command-page-subtitle">
                用相同日數公平比較不同月份，將廣告費、Lead、Book、Show、CPL
                同兩個 CPA 口徑放喺同一個決策畫面。
              </p>
              <div className="period-source-line">
                <span
                  className={`period-quality-pill is-${current?.quality.quality ?? "missing"}`}
                >
                  {current?.quality.quality === "complete" ? (
                    <CheckCircle2 size={14} />
                  ) : (
                    <TriangleAlert size={14} />
                  )}
                  本期數據{qualityLabel(current?.quality.quality ?? "missing")}
                </span>
                <span>
                  <Clock3 size={14} />
                  最後來源更新：{formatDateTime(snapshot.sourceUpdatedAt)}
                </span>
              </div>
            </div>
            <div className="command-header-actions">
              <IntentPrefetchLink
                href="/performance"
                className="command-secondary-button"
              >
                <GitCompareArrows size={16} />
                返回療程成效
              </IntentPrefetchLink>
              {access.accessLevel === "master" ? (
                <IntentPrefetchLink
                  href="/data-sources"
                  className="command-primary-button"
                >
                  <DatabaseZap size={16} />
                  檢查資料來源
                </IntentPrefetchLink>
              ) : null}
            </div>
          </header>

          {!snapshot.schemaReady ? (
            <p className="command-status-message">
              正式資料連線未就緒；目前畫面以驗收數據展示版面，唔會當成正式業績。
            </p>
          ) : null}

          <section className="command-surface period-filter-panel">
            <header>
              <div className="period-section-heading">
                <span>
                  <Filter size={17} />
                </span>
                <div>
                  <p>Comparison scope</p>
                  <h2>同期範圍</h2>
                  <small>預設由每月 1 號比較至香港時間昨日。</small>
                </div>
              </div>
              <span className="period-filter-context">
                正比較：{snapshot.selectedBrandLabel} · {snapshot.filters.startDay}–
                {snapshot.filters.endDay} 日
              </span>
            </header>
            <form method="get" action="/performance/compare" className="period-filter-form">
              <label>
                <span>基準月份</span>
                <select
                  name="month"
                  defaultValue={snapshot.filters.anchorMonth.slice(0, 7)}
                >
                  {snapshot.monthOptions.map((option) => (
                    <option key={option.value} value={option.value.slice(0, 7)}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>比較月份數</span>
                <select name="months" defaultValue={String(snapshot.filters.monthCount)}>
                  <option value="2">2 個月</option>
                  <option value="3">3 個月</option>
                  <option value="6">6 個月</option>
                </select>
              </label>
              <label>
                <span>由每月第幾日</span>
                <input
                  type="number"
                  name="start_day"
                  min="1"
                  max="31"
                  defaultValue={snapshot.filters.startDay}
                />
              </label>
              <label>
                <span>至每月第幾日</span>
                <input
                  type="number"
                  name="end_day"
                  min="1"
                  max="31"
                  defaultValue={snapshot.filters.endDay}
                />
              </label>
              <label>
                <span>品牌</span>
                <select name="brand" defaultValue={snapshot.filters.brandId ?? ""}>
                  <option value="">全部品牌</option>
                  {snapshot.brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="command-primary-button">
                <GitCompareArrows size={16} />
                套用比較
              </button>
            </form>
          </section>

          {current ? (
            <section className="period-kpi-grid" aria-label="同期核心指標">
              {primaryMetrics.map((definition) => {
                const value = metricValue(current.metrics, definition.key);
                const Icon = definition.icon;
                return (
                  <article
                    key={definition.key}
                    className={`command-surface period-kpi-card tone-${definition.tone}`}
                  >
                    <span className="period-kpi-icon">
                      <Icon size={18} />
                    </span>
                    <div>
                      <p>{definition.label}</p>
                      <strong>{formatMetric(value, definition.kind)}</strong>
                      <small>{definition.note}</small>
                      <ChangeBadge
                        metric={definition.key}
                        change={current.changes[definition.key]}
                      />
                    </div>
                  </article>
                );
              })}
            </section>
          ) : null}

          <section className="period-analysis-grid">
            <article className="command-surface period-trend-card">
              <div className="period-section-heading">
                <span>
                  <GitCompareArrows size={17} />
                </span>
                <div>
                  <p>Cumulative pace</p>
                  <h2>同期累積走勢</h2>
                  <small>每條線都由同一日開始，避免完整月份壓住未完月份。</small>
                </div>
              </div>
              <PeriodComparisonChartLazy series={snapshot.trendSeries} />
            </article>

            <article className="command-surface period-rate-card">
              <div className="period-section-heading">
                <span>
                  <UserRoundCheck size={17} />
                </span>
                <div>
                  <p>Operational ratios</p>
                  <h2>轉換效率</h2>
                  <small>以本期同一日期範圍內嘅營運量計算。</small>
                </div>
              </div>
              <div className="period-rate-list">
                {current
                  ? rateMetrics.map((definition) => (
                      <article key={definition.key}>
                        <div>
                          <span>{definition.label}</span>
                          <small>{definition.formula}</small>
                        </div>
                        <strong>
                          {formatMetric(
                            metricValue(current.metrics, definition.key),
                            "rate"
                          )}
                        </strong>
                        <ChangeBadge
                          metric={definition.key}
                          change={current.changes[definition.key]}
                        />
                      </article>
                    ))
                  : null}
              </div>
              <div className="period-ratio-note">
                <Info size={16} />
                <p>
                  呢啲係「同期營運比率」，唔係逐個 Lead 追到同一 cohort
                  嘅最終轉換率；比較步速適用，評估完整客戶旅程時要再睇療程成效。
                </p>
              </div>
            </article>
          </section>

          <section className="command-surface period-table-section">
            <div className="period-section-heading">
              <span>
                <CalendarRange size={17} />
              </span>
              <div>
                <p>Month matrix</p>
                <h2>月份比較</h2>
                <small>所有成本由同期總 Spend 除以同期總成果重新計算。</small>
              </div>
            </div>
            <div className="period-table-wrap">
              <table className="period-comparison-table">
                <thead>
                  <tr>
                    <th>月份／範圍</th>
                    <th>數據狀態</th>
                    {primaryMetrics.map((metric) => (
                      <th key={metric.key}>{metric.label}</th>
                    ))}
                    {rateMetrics.map((metric) => (
                      <th key={metric.key}>{metric.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {snapshot.totals.map((row) => (
                    <tr key={row.period.monthStart}>
                      <td>
                        <strong>{row.label}</strong>
                        <small>
                          {row.period.startDate} → {row.period.endDate}
                        </small>
                      </td>
                      <td>
                        <span className={`period-quality-pill is-${row.quality.quality}`}>
                          {qualityLabel(row.quality.quality)}
                        </span>
                        <small>
                          Spend {row.quality.spendCoverageDays}/
                          {row.quality.expectedSpendDays} 品牌日
                        </small>
                      </td>
                      {primaryMetrics.map((metric) => (
                        <td key={metric.key}>
                          <strong>
                            {formatMetric(
                              metricValue(row.metrics, metric.key),
                              metric.kind
                            )}
                          </strong>
                          <ChangeBadge
                            metric={metric.key}
                            change={row.changes[metric.key]}
                          />
                        </td>
                      ))}
                      {rateMetrics.map((metric) => (
                        <td key={metric.key}>
                          <strong>
                            {formatMetric(
                              metricValue(row.metrics, metric.key),
                              "rate"
                            )}
                          </strong>
                          <ChangeBadge
                            metric={metric.key}
                            change={row.changes[metric.key]}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="command-surface period-table-section">
            <div className="period-section-heading">
              <span>
                <UsersRound size={17} />
              </span>
              <div>
                <p>Brand breakdown</p>
                <h2>品牌拆解</h2>
                <small>Alyssa、AM、IB、GOS 各自按同一口徑計算，權限亦沿用品牌設定。</small>
              </div>
            </div>
            <div className="period-table-wrap">
              <table className="period-comparison-table period-brand-table">
                <thead>
                  <tr>
                    <th>品牌／月份</th>
                    <th>狀態</th>
                    <th>Spend</th>
                    <th>Lead</th>
                    <th>Book</th>
                    <th>Show</th>
                    <th>CPL</th>
                    <th>CPA · Book</th>
                    <th>CPA · Show</th>
                    <th>L→B</th>
                    <th>B→S</th>
                    <th>L→S</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.brandRows.map((row) => (
                    <tr key={`${row.brandId}:${row.period.monthStart}`}>
                      <td>
                        <div className="period-brand-cell">
                          <BrandMark name={row.brandName} color={row.brandColor} compact />
                          <div>
                            <strong>{row.brandName}</strong>
                            <small>{row.label}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`period-quality-pill is-${row.quality.quality}`}>
                          {qualityLabel(row.quality.quality)}
                        </span>
                        <small>
                          {row.quality.spendCoverageDays}/{row.quality.expectedSpendDays} 日
                        </small>
                      </td>
                      {(
                        [
                          "spend",
                          "leads",
                          "bookings",
                          "shows",
                          "cpl",
                          "costPerBooking",
                          "costPerShow",
                          "leadToBookRate",
                          "bookToShowRate",
                          "leadToShowRate",
                        ] as ComparisonMetricKey[]
                      ).map((key) => (
                        <td key={key}>
                          {formatMetric(metricValue(row.metrics, key), metricKind(key))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="command-surface period-definition-section">
            <div className="period-section-heading">
              <span>
                <DatabaseZap size={17} />
              </span>
              <div>
                <p>Lineage & quality</p>
                <h2>口徑與數據狀態</h2>
                <small>保留資料血緣，缺來源時唔會用其他月份或重複表補數。</small>
              </div>
            </div>
            <div className="period-definition-grid">
              <article>
                <strong>廣告費</strong>
                <p>只讀該月份目前生效 Workbook 嘅品牌分頁；同月份舊版本唔計。</p>
              </article>
              <article>
                <strong>Lead／Book</strong>
                <p>
                  只讀一個正式 Lead Sheet。Book 代表已預約、已到店或 No-show，按查詢建立日歸屬。
                </p>
              </article>
              <article>
                <strong>Show</strong>
                <p>按確認到店日歸屬，避免將未來預約提早當成已到店。</p>
              </article>
              <article>
                <strong>CPL／CPA</strong>
                <p>CPL = Spend ÷ Lead；CPA · Book = Spend ÷ Book；CPA · Show = Spend ÷ Show。</p>
              </article>
            </div>
            <div className="period-warning-list" aria-label="數據狀態提示">
              {snapshot.warnings.length > 0 ? (
                snapshot.warnings.map((warning) => (
                  <p key={warning}>
                    <TriangleAlert size={15} />
                    {warning}
                  </p>
                ))
              ) : (
                <p className="is-good">
                  <CheckCircle2 size={15} />
                  所選範圍未發現重複來源或缺失同步提示。
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
