import type { ComponentType } from "react";
import {
  Activity,
  ArrowRight,
  CalendarRange,
  Clock3,
  DatabaseZap,
  Filter,
  Flag,
  Info,
  Sparkles,
  Target,
  TriangleAlert,
  UserRoundCheck,
  UserRoundX,
  UsersRound,
} from "lucide-react";
import { refreshDashboardDataAction } from "@/app/command-center/actions";
import { AppNav } from "@/components/alyssa/AppNav";
import { IntentPrefetchLink } from "@/components/alyssa/IntentPrefetchLink";
import { SubmitButton } from "@/components/alyssa/SubmitButton";
import { DashboardRefreshButton } from "@/components/command-center/DashboardRefreshButton";
import { BrandMark } from "@/components/command-center/BrandMark";
import { PerformanceCostSummary } from "@/components/command-center/PerformanceCostSummary";
import { TreatmentPerformanceTrendChartLazy } from "@/components/command-center/TreatmentPerformanceTrendChartLazy";
import {
  getTreatmentPerformanceSnapshot,
  normalizeTreatmentPerformanceFilters,
  type TreatmentPerformanceFilters,
  type TreatmentPerformanceInsight,
  type TreatmentPerformanceRow,
  type TreatmentPerformanceTotals,
} from "@/lib/marketing/treatmentPerformance";
import { getHkMonthContext } from "@/lib/marketing/pacing";
import { getCurrentInternalAccess } from "@/lib/security/internalAccessServer";

export const dynamic = "force-dynamic";

type SearchParams = {
  startDate?: string | string[];
  endDate?: string | string[];
  brandId?: string | string[];
  treatment?: string | string[];
  source?: string | string[];
  campaign?: string | string[];
  sort?: string | string[];
  command_status?: string | string[];
  message?: string | string[];
};

type MetricIcon = ComponentType<{ size?: number; strokeWidth?: number }>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

function addIsoDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function previousMonthRange(monthStart: string) {
  const previousEnd = addIsoDays(monthStart, -1);
  return {
    startDate: previousEnd.slice(0, 8) + "01",
    endDate: previousEnd,
  };
}

function performanceHref(
  filters: TreatmentPerformanceFilters,
  overrides: Partial<TreatmentPerformanceFilters>
) {
  const next = { ...filters, ...overrides };
  const query = new URLSearchParams();
  query.set("startDate", next.startDate);
  query.set("endDate", next.endDate);
  if (next.brandId) query.set("brandId", next.brandId);
  if (next.treatment) query.set("treatment", next.treatment);
  if (next.source) query.set("source", next.source);
  if (next.campaign) query.set("campaign", next.campaign);
  if (next.sort !== "leads") query.set("sort", next.sort);
  return `/performance?${query.toString()}`;
}

function formatNumber(value: number) {
  return Math.round(value).toLocaleString("zh-HK");
}

function formatPercent(value: number | null) {
  return value === null
    ? "—"
    : new Intl.NumberFormat("zh-HK", {
        style: "percent",
        maximumFractionDigits: 1,
      }).format(value);
}

function formatHkDateTime(value: string | null) {
  if (!value) return "尚未同步";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "尚未同步";
  return `${new Intl.DateTimeFormat("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date)} HKT`;
}

function sourceStatusLabel(status: string) {
  if (status === "connected") return "已同步";
  if (status === "syncing") return "同步中";
  if (status === "warning") return "需檢查";
  if (status === "error") return "同步錯誤";
  if (status === "paused") return "已暫停";
  return "等待首次同步";
}

export default async function TreatmentPerformancePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const query = (await searchParams) ?? {};
  const requestedFilters = {
    startDate: firstParam(query.startDate),
    endDate: firstParam(query.endDate),
    brandId: firstParam(query.brandId),
    treatment: firstParam(query.treatment),
    source: firstParam(query.source),
    campaign: firstParam(query.campaign),
    sort: firstParam(query.sort),
  };
  const [snapshot, access] = await Promise.all([
    getTreatmentPerformanceSnapshot(requestedFilters),
    getCurrentInternalAccess(),
  ]);
  const month = getHkMonthContext();
  const previousMonth = previousMonthRange(month.monthStart);
  const message = firstParam(query.message);
  const commandStatus = firstParam(query.command_status);
  const hasActiveDimensionFilter = Boolean(
    snapshot.filters.brandId ||
      snapshot.filters.treatment ||
      snapshot.filters.source ||
      snapshot.filters.campaign
  );
  const refreshDisabled = !snapshot.schemaReady;

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="command-page treatment-performance-page">
        <div className="command-page-inner">
          <header className="command-page-header treatment-performance-header">
            <div>
              <p className="command-page-kicker">成效分析</p>
              <h1 className="command-page-title">療程成效</h1>
              <p className="command-page-subtitle">
                按品牌、療程、來源同 Campaign 比較 Lead、預約、到店、廣告費及成本效率。
              </p>
              <div className="treatment-source-line">
                <span
                  className={`treatment-source-status is-${snapshot.sourceStatus}`}
                >
                  <span />
                  {sourceStatusLabel(snapshot.sourceStatus)}
                </span>
                <span>
                  <DatabaseZap size={14} />
                  Lead Sheet
                </span>
                <span>
                  <Clock3 size={14} />
                  {formatHkDateTime(snapshot.lastSuccessAt)}
                </span>
              </div>
            </div>

            <div className="command-header-actions">
              {access.accessLevel === "master" ? (
                <form
                  action={refreshDashboardDataAction}
                  className="command-refresh-form"
                >
                  <input
                    type="hidden"
                    name="returnPath"
                    value={performanceHref(snapshot.filters, {})}
                  />
                  <DashboardRefreshButton disabled={refreshDisabled} />
                  <small>同步後會更新本頁數據</small>
                </form>
              ) : null}
              {access.accessLevel === "master" ? (
                <IntentPrefetchLink
                  href="/data-sources"
                  className="command-secondary-button"
                >
                  <DatabaseZap size={16} />
                  查看資料來源
                </IntentPrefetchLink>
              ) : null}
            </div>
          </header>

          {message ? (
            <p
              className={`command-status-message ${
                commandStatus === "error" ? "is-error" : "is-success"
              }`}
            >
              {message}
            </p>
          ) : null}
          {snapshot.warnings.map((warning) => (
            <p key={warning} className="command-status-message">
              {warning}
            </p>
          ))}

          <section className="command-surface treatment-filter-panel">
            <header>
              <div>
                <Filter size={17} />
                <div>
                  <strong>分析範圍</strong>
                  <span>
                    預設本月；待到店會包括已排喺月底前嘅預約。
                  </span>
                </div>
              </div>
              <div className="treatment-quick-ranges">
                <IntentPrefetchLink
                  href={performanceHref(snapshot.filters, {
                    startDate: addIsoDays(month.today, -6),
                    endDate: month.today,
                  })}
                >
                  近 7 日
                </IntentPrefetchLink>
                <IntentPrefetchLink
                  href={performanceHref(snapshot.filters, {
                    startDate: month.monthStart,
                    endDate: month.monthEnd,
                  })}
                >
                  本月
                </IntentPrefetchLink>
                <IntentPrefetchLink
                  href={performanceHref(snapshot.filters, previousMonth)}
                >
                  上月
                </IntentPrefetchLink>
              </div>
            </header>

            <form method="get" action="/performance" className="treatment-filter-form">
              <label>
                <span>開始日期</span>
                <input
                  type="date"
                  name="startDate"
                  defaultValue={snapshot.filters.startDate}
                  required
                />
              </label>
              <label>
                <span>結束日期</span>
                <input
                  type="date"
                  name="endDate"
                  defaultValue={snapshot.filters.endDate}
                  required
                />
              </label>
              <label>
                <span>品牌</span>
                <select name="brandId" defaultValue={snapshot.filters.brandId}>
                  <option value="">全部品牌</option>
                  {snapshot.brandOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>療程</span>
                <select
                  name="treatment"
                  defaultValue={snapshot.filters.treatment}
                >
                  <option value="">全部療程</option>
                  {snapshot.treatmentOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>來源</span>
                <select name="source" defaultValue={snapshot.filters.source}>
                  <option value="">全部來源</option>
                  {snapshot.sourceOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Campaign</span>
                <select
                  name="campaign"
                  defaultValue={snapshot.filters.campaign}
                >
                  <option value="">全部 Campaign</option>
                  {snapshot.campaignOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>療程排序</span>
                <select name="sort" defaultValue={snapshot.filters.sort}>
                  <option value="leads">Lead 數量</option>
                  <option value="book_rate">Book Rate</option>
                  <option value="shows">Show 數量</option>
                  <option value="show_up_rate">Show-up Rate</option>
                  <option value="no_show_rate">No-show Rate</option>
                </select>
              </label>
              <div className="treatment-filter-actions">
                <SubmitButton
                  className="command-primary-button"
                  pendingLabel="篩選中…"
                >
                  <Filter size={15} />
                  套用篩選
                </SubmitButton>
                {hasActiveDimensionFilter ? (
                  <IntentPrefetchLink
                    href={performanceHref(
                      normalizeTreatmentPerformanceFilters({
                        startDate: snapshot.filters.startDate,
                        endDate: snapshot.filters.endDate,
                      }),
                      {}
                    )}
                    className="command-secondary-button"
                  >
                    清除分類
                  </IntentPrefetchLink>
                ) : null}
              </div>
            </form>
          </section>

          <section
            className="treatment-summary-grid"
            aria-label="療程成效摘要"
          >
            <MetricCard
              label="Lead"
              value={snapshot.totals.leads}
              meta="按 Created At"
              icon={UsersRound}
              tone="plum"
            />
            <MetricCard
              label="Book"
              value={snapshot.totals.bookings}
              meta={`${formatPercent(snapshot.totals.bookRate)} Book Rate`}
              icon={UserRoundCheck}
              tone="rose"
            />
            <MetricCard
              label="Show"
              value={snapshot.totals.shows}
              meta={`${formatPercent(snapshot.totals.showUpRate)} Show-up`}
              icon={Flag}
              tone="green"
            />
            <MetricCard
              label="No Show"
              value={snapshot.totals.noShows}
              meta={`${formatPercent(snapshot.totals.noShowRate)} No-show Rate`}
              icon={UserRoundX}
              tone="red"
            />
            <MetricCard
              label="待到店"
              value={snapshot.totals.pendingShows}
              meta="預約日在所選期間"
              icon={Clock3}
              tone="blue"
            />
          </section>

          <PerformanceCostSummary costs={snapshot.costs} />

          <section className="command-surface treatment-trend-card">
            <SectionHeading
              eyebrow="Trend view"
              title="療程成效走勢"
              description="可切換單日與累積；單日睇波動，累積睇整段期間進度。數字會跟上方篩選，橙色圓點代表當日日曆操作。"
              icon={Activity}
            />
            <TreatmentPerformanceTrendChartLazy series={snapshot.trendSeries} />
            {snapshot.trendSeriesCount > snapshot.trendSeriesShown ? (
              <p className="treatment-trend-note">
                目前先顯示 Lead 數最高 {snapshot.trendSeriesShown} 個療程；用上方療程篩選可查看其餘走勢。
              </p>
            ) : null}
          </section>

          <section className="treatment-decision-grid">
            <FunnelCard totals={snapshot.totals} />
            <RateCard totals={snapshot.totals} />
          </section>

          <section className="treatment-insight-grid" aria-label="優化提示">
            {snapshot.insights.map((insight) => (
              <InsightCard
                key={`${insight.label}-${insight.value}`}
                insight={insight}
              />
            ))}
          </section>

          <section className="command-surface treatment-ranking-section">
            <SectionHeading
              eyebrow="Treatment ranking"
              title="療程表現"
              description={`${snapshot.filters.startDate} 至 ${snapshot.filters.endDate} · ${snapshot.treatmentRows.length} 個療程組合`}
              icon={Target}
            />
            <div className="treatment-table-wrap">
              <table className="treatment-performance-table">
                <thead>
                  <tr>
                    <th>品牌／療程</th>
                    <th>Lead</th>
                    <th>Book</th>
                    <th>Show</th>
                    <th>No Show</th>
                    <th>待到店</th>
                    <th title="Book ÷ Lead">Book Rate</th>
                    <th title="Show ÷ Lead">Show / Lead</th>
                    <th title="Show ÷ Book">Show-up</th>
                    <th title="No Show ÷ Book">No-show</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.treatmentRows.length > 0 ? (
                    snapshot.treatmentRows.map((row) => (
                      <TreatmentRow
                        key={row.key}
                        row={row}
                        color={snapshot.brandColors[row.brandId]}
                      />
                    ))
                  ) : (
                    <EmptyTableRow
                      colSpan={10}
                      message="所選期間未有符合條件嘅療程成效。"
                    />
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="command-surface treatment-ranking-section">
            <SectionHeading
              eyebrow="Source diagnostics"
              title="來源／Campaign 表現"
              description="同一療程會按來源同 Campaign 拆開，方便追查高量低轉化位置。"
              icon={Activity}
            />
            <div className="treatment-table-wrap">
              <table className="treatment-performance-table source-diagnostic-table">
                <thead>
                  <tr>
                    <th>品牌／療程</th>
                    <th>來源</th>
                    <th>Campaign／廣告</th>
                    <th>Lead</th>
                    <th>Book</th>
                    <th>Show</th>
                    <th title="Book ÷ Lead">Book Rate</th>
                    <th title="Show ÷ Book">Show-up</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.sourceRows.length > 0 ? (
                    snapshot.sourceRows.slice(0, 50).map((row) => (
                      <SourceRow
                        key={row.key}
                        row={row}
                        color={snapshot.brandColors[row.brandId]}
                      />
                    ))
                  ) : (
                    <EmptyTableRow
                      colSpan={8}
                      message="所選期間未有來源／Campaign 成效。"
                    />
                  )}
                </tbody>
              </table>
            </div>
            {snapshot.sourceRows.length > 50 ? (
              <p className="treatment-table-note">
                目前先顯示 Lead 數最高 50 組；可用上方品牌、療程及來源篩選再收窄。
              </p>
            ) : null}
          </section>

          <section className="treatment-definition-note">
            <Info size={17} />
            <div>
              <strong>計算口徑</strong>
              <p>
                Lead／Book 按 Created At；Show 按確認到店日期；No Show
                同待到店按預約日期。Book 包括已預約、已到店及 No Show。由於 Show
                可能來自較早期 Lead，極短日期範圍嘅 Show-up Rate
                可能反映跨期到店，唔應單獨當成同一批 Lead cohort。
              </p>
              <p>
                呢頁只保存品牌、療程、來源、Campaign、分店及每日數量彙總；唔保存姓名、電話、Email、Lead
                Key 或 CS Remark。廣告費只讀品牌級系統廣告費帳簿；如篩選到
                單一療程、來源或 Campaign，成本會顯示未分配，唔會用 Lead 比例估算。
                亦唔會重複讀取舊報表數據。
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  meta,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  meta: string;
  icon: MetricIcon;
  tone: "plum" | "rose" | "green" | "red" | "blue";
}) {
  return (
    <article className={`command-surface treatment-metric-card tone-${tone}`}>
      <span className="treatment-metric-icon">
        <Icon size={18} />
      </span>
      <div>
        <p>{label}</p>
        <strong>{formatNumber(value)}</strong>
        <span>{meta}</span>
      </div>
    </article>
  );
}

function FunnelCard({ totals }: { totals: TreatmentPerformanceTotals }) {
  const max = Math.max(totals.leads, totals.bookings, totals.shows, 1);
  const steps = [
    { label: "Lead", value: totals.leads, tone: "lead" },
    { label: "Book", value: totals.bookings, tone: "book" },
    { label: "Show", value: totals.shows, tone: "show" },
  ];

  return (
    <section className="command-surface treatment-funnel-card">
      <SectionHeading
        eyebrow="Lead journey"
        title="Lead → Book → Show"
        description="用絕對數量睇漏斗，避免只睇百分比忽略樣本。"
        icon={ArrowRight}
      />
      <div className="treatment-funnel-bars">
        {steps.map((step) => (
          <div key={step.label}>
            <header>
              <span>{step.label}</span>
              <strong>{formatNumber(step.value)}</strong>
            </header>
            <div className="treatment-funnel-track">
              <span
                className={`tone-${step.tone}`}
                style={{
                  width: `${Math.max(4, Math.min(100, (step.value / max) * 100))}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RateCard({ totals }: { totals: TreatmentPerformanceTotals }) {
  const rates = [
    {
      label: "Book Rate",
      value: formatPercent(totals.bookRate),
      formula: "Book ÷ Lead",
    },
    {
      label: "Show / Lead",
      value: formatPercent(totals.leadToShowRate),
      formula: "Show ÷ Lead",
    },
    {
      label: "Show-up Rate",
      value: formatPercent(totals.showUpRate),
      formula: "Show ÷ Book",
    },
    {
      label: "No-show Rate",
      value: formatPercent(totals.noShowRate),
      formula: "No Show ÷ Book",
    },
  ];
  return (
    <section className="command-surface treatment-rate-card">
      <SectionHeading
        eyebrow="Conversion health"
        title="轉化率"
        description="每個 Rate 顯示固定分母，方便對數。"
        icon={Activity}
      />
      <div className="treatment-rate-grid">
        {rates.map((rate) => (
          <article key={rate.label}>
            <span>{rate.label}</span>
            <strong>{rate.value}</strong>
            <small>{rate.formula}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function InsightCard({ insight }: { insight: TreatmentPerformanceInsight }) {
  const Icon =
    insight.tone === "positive"
      ? Sparkles
      : insight.tone === "attention"
        ? TriangleAlert
        : CalendarRange;
  return (
    <article className={`command-surface treatment-insight-card is-${insight.tone}`}>
      <span>
        <Icon size={17} />
      </span>
      <div>
        <p>{insight.label}</p>
        <strong>{insight.value}</strong>
        <small>{insight.detail}</small>
      </div>
    </article>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  icon: Icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: MetricIcon;
}) {
  return (
    <header className="treatment-section-heading">
      <span>
        <Icon size={17} />
      </span>
      <div>
        <p>{eyebrow}</p>
        <h2>{title}</h2>
        <small>{description}</small>
      </div>
    </header>
  );
}

function TreatmentRow({
  row,
  color,
}: {
  row: TreatmentPerformanceRow;
  color?: string;
}) {
  return (
    <tr>
      <td>
        <div className="treatment-name-cell">
          <BrandMark name={row.brandName} color={color || "#5a2348"} />
          <div>
            <strong>{row.treatment}</strong>
            <span>{row.brandName}</span>
            {row.leads > 0 && row.leads < 5 ? (
              <small>樣本不足</small>
            ) : null}
          </div>
        </div>
      </td>
      <NumericCell value={row.leads} strong />
      <NumericCell value={row.bookings} />
      <NumericCell value={row.shows} />
      <NumericCell value={row.noShows} tone={row.noShows > 0 ? "red" : undefined} />
      <NumericCell value={row.pendingShows} tone="blue" />
      <RateCell value={row.bookRate} />
      <RateCell value={row.leadToShowRate} />
      <RateCell value={row.showUpRate} />
      <RateCell value={row.noShowRate} inverse />
    </tr>
  );
}

function SourceRow({
  row,
  color,
}: {
  row: TreatmentPerformanceRow;
  color?: string;
}) {
  return (
    <tr>
      <td>
        <div className="treatment-name-cell is-compact">
          <BrandMark name={row.brandName} color={color || "#5a2348"} />
          <div>
            <strong>{row.treatment}</strong>
            <span>{row.brandName}</span>
          </div>
        </div>
      </td>
      <td>{row.source || "未標記來源"}</td>
      <td>
        <span className="campaign-cell">{row.campaign || "未標記 Campaign"}</span>
      </td>
      <NumericCell value={row.leads} strong />
      <NumericCell value={row.bookings} />
      <NumericCell value={row.shows} />
      <RateCell value={row.bookRate} />
      <RateCell value={row.showUpRate} />
    </tr>
  );
}

function NumericCell({
  value,
  strong = false,
  tone,
}: {
  value: number;
  strong?: boolean;
  tone?: "red" | "blue";
}) {
  return (
    <td>
      <span
        className={`treatment-number ${strong ? "is-strong" : ""} ${
          tone ? `tone-${tone}` : ""
        }`}
      >
        {formatNumber(value)}
      </span>
    </td>
  );
}

function RateCell({
  value,
  inverse = false,
}: {
  value: number | null;
  inverse?: boolean;
}) {
  const tone =
    value === null
      ? "is-empty"
      : inverse
        ? value >= 0.4
          ? "is-risk"
          : value <= 0.2
            ? "is-good"
            : ""
        : value >= 0.5
          ? "is-good"
          : "";
  return (
    <td>
      <span className={`treatment-rate-pill ${tone}`}>
        {formatPercent(value)}
      </span>
    </td>
  );
}

function EmptyTableRow({
  colSpan,
  message,
}: {
  colSpan: number;
  message: string;
}) {
  return (
    <tr>
      <td colSpan={colSpan}>
        <div className="treatment-empty-row">
          <Activity size={20} />
          <span>{message}</span>
        </div>
      </td>
    </tr>
  );
}
