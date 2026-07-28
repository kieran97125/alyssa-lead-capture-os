import Link from "next/link";
import {
  ArrowUpRight,
  CalendarClock,
  CircleDollarSign,
  DatabaseZap,
  Flag,
  Target,
  TriangleAlert,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { AppNav } from "@/components/alyssa/AppNav";
import {
  PaceBar,
  PaceStatusBadge,
} from "@/components/command-center/PaceBar";
import { BrandMark } from "@/components/command-center/BrandMark";
import { DashboardRefreshButton } from "@/components/command-center/DashboardRefreshButton";
import { refreshDashboardDataAction } from "@/app/command-center/actions";
import { money } from "@/lib/data/businessMetrics";
import {
  getCommandCenterSnapshot,
  type BrandCommandCenterRow,
  type MetricProgress,
} from "@/lib/marketing/commandCenter";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

function rounded(value: number) {
  return Math.round(value).toLocaleString("zh-HK");
}

function formatHkDateTime(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const formatted = new Intl.DateTimeFormat("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return `${formatted} HKT`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{
    command_status?: string | string[];
    message?: string | string[];
  }>;
}) {
  const [snapshot, query] = await Promise.all([
    getCommandCenterSnapshot(),
    searchParams,
  ]);
  const message = firstParam(query?.message);
  const status = firstParam(query?.command_status);
  const alerts = snapshot.brands.filter(
    (brand) =>
      ["warning", "critical", "under"].includes(brand.budgetStatus) ||
      brand.leads.status === "behind" ||
      brand.bookings.status === "behind" ||
      brand.shows.status === "behind" ||
      brand.sourceIssueCount > 0
  );
  const upcoming = snapshot.calendarItems
    .filter((item) => item.scheduledDate >= snapshot.month.today)
    .slice(0, 5);
  const latestSuccessAt =
    snapshot.dataSources
      .map((source) => source.lastSuccessAt)
      .filter((value): value is string => Boolean(value))
      .sort((left, right) => right.localeCompare(left))[0] ?? null;
  const refreshDisabled =
    !snapshot.schemaReady || snapshot.dataSources.length === 0;

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="command-page">
        <div className="command-page-inner">
          <header className="command-page-header">
            <div>
              <p className="command-page-kicker">Marketing Command Center</p>
              <h1 className="command-page-title">早晨，Kieran</h1>
              <p className="command-page-subtitle">
                {snapshot.month.label}營運進度 · {snapshot.month.throughLabel}。Lead、Book
                及 Show 只計本月 1 號至昨日，避免今日未完整數據干擾判斷。
              </p>
            </div>
            <div className="command-header-actions">
              <form
                action={refreshDashboardDataAction}
                className="command-refresh-form"
              >
                <input type="hidden" name="returnPath" value="/dashboard" />
                <DashboardRefreshButton disabled={refreshDisabled} />
                <small>
                  最後更新：{formatHkDateTime(latestSuccessAt) || "尚未同步"}
                </small>
              </form>
              <Link href="/settings/planning" className="command-secondary-button">
                <Target size={16} />
                設定本月目標
              </Link>
              <Link href="/calendar" className="command-primary-button">
                <CalendarClock size={16} />
                安排營銷事項
              </Link>
            </div>
          </header>

          {message ? (
            <p
              className={`command-status-message ${
                status === "error" ? "is-error" : "is-success"
              }`}
            >
              {message}
            </p>
          ) : null}
          {snapshot.dataWarnings.map((warning) => (
            <p key={warning} className="command-status-message">
              {warning}
            </p>
          ))}

          <section className="command-summary-grid" aria-label="本月整體摘要">
            <SummaryCard
              label="廣告已用"
              value={money(snapshot.total.spend)}
              meta={
                snapshot.total.budget > 0
                  ? `月度預算 ${money(snapshot.total.budget)}`
                  : "尚未設定月度預算"
              }
              icon={CircleDollarSign}
              tone="violet"
            />
            <SummaryCard
              label="Leads"
              value={rounded(snapshot.total.leads)}
              meta={
                snapshot.total.leadTarget > 0
                  ? `目標 ${rounded(snapshot.total.leadTarget)}`
                  : "尚未設定 Lead 目標"
              }
              icon={UsersRound}
              tone="blue"
            />
            <SummaryCard
              label="Bookings"
              value={rounded(snapshot.total.bookings)}
              meta={
                snapshot.total.bookingTarget > 0
                  ? `目標 ${rounded(snapshot.total.bookingTarget)}`
                  : "尚未設定 Booking 目標"
              }
              icon={UserRoundCheck}
              tone="amber"
            />
            <SummaryCard
              label="Shows"
              value={rounded(snapshot.total.shows)}
              meta={
                snapshot.total.showTarget > 0
                  ? `目標 ${rounded(snapshot.total.showTarget)}`
                  : "尚未設定 Show 目標"
              }
              icon={Flag}
              tone="green"
            />
          </section>

          <section className="command-dashboard-layout">
            <div className="command-main-column">
              <section className="command-surface command-section">
                <SectionHeader
                  eyebrow="Budget control"
                  title="預算概覽"
                  description={`時間進度 ${snapshot.month.elapsedDays}／${snapshot.month.daysInMonth} 日；垂直線代表截至昨日理應使用位置。`}
                  href="/settings/planning"
                  linkLabel="管理預算"
                />
                <div className="budget-brand-list">
                  {snapshot.brands.map((brand) => (
                    <BudgetBrandRow
                      key={brand.id}
                      brand={brand}
                      paceRatio={snapshot.month.paceRatio}
                    />
                  ))}
                </div>
              </section>

              <section className="command-surface command-section">
                <SectionHeader
                  eyebrow="Funnel pace"
                  title="品牌 KPI 進度"
                  description="實際進度會同截至昨日應達值比較；未設定目標時不會發出假警告。"
                  href="/kpis"
                  linkLabel="查看完整 KPI"
                />
                <div className="kpi-brand-list">
                  {snapshot.brands.map((brand) => (
                    <KpiBrandRow
                      key={brand.id}
                      brand={brand}
                      paceRatio={snapshot.month.paceRatio}
                    />
                  ))}
                </div>
              </section>
            </div>

            <aside className="command-side-column">
              <section className="command-surface command-section">
                <SectionHeader
                  eyebrow="Attention"
                  title="需要留意"
                  description={`${alerts.length} 個品牌狀態需要檢查`}
                />
                <div className="command-alert-list">
                  {alerts.length > 0 ? (
                    alerts.map((brand) => (
                      <BrandAlert key={brand.id} brand={brand} />
                    ))
                  ) : (
                    <EmptyState
                      icon={Target}
                      title="目前未有進度警告"
                      body="設定 Budget、KPI 及資料來源後，系統會自動檢查超支、投放偏慢及漏斗落後。"
                    />
                  )}
                </div>
              </section>

              <section className="command-surface command-section">
                <SectionHeader
                  eyebrow="Next up"
                  title="即將執行"
                  description="由營銷日曆統一管理 Post、廣告、LP 及會議"
                  href="/calendar"
                  linkLabel="開啟日曆"
                />
                <div className="command-upcoming-list">
                  {upcoming.length > 0 ? (
                    upcoming.map((item) => {
                      const brand = snapshot.brands.find(
                        (candidate) => candidate.id === item.brandId
                      );
                      return (
                        <div key={item.id} className="command-upcoming-item">
                          <span
                            className="command-upcoming-dot"
                            style={{ background: brand?.color || "#635bff" }}
                          />
                          <div>
                            <strong>{item.title}</strong>
                            <span>
                              {brand?.name || "未設定品牌"} · {item.scheduledDate}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <EmptyState
                      icon={CalendarClock}
                      title="未有即將執行事項"
                      body="將本月 Post、廣告、Landing Page 同例會加入日曆，就可以跨品牌排期。"
                    />
                  )}
                </div>
              </section>

              <section className="command-surface command-section">
                <SectionHeader
                  eyebrow="Data health"
                  title="資料接駁"
                  description={`${snapshot.dataSources.length} 個已登記來源`}
                  href="/data-sources"
                  linkLabel="管理來源"
                />
                <div className="source-health-grid">
                  <SourceHealth
                    icon={DatabaseZap}
                    label="已連接"
                    value={
                      snapshot.dataSources.filter(
                        (source) => source.status === "connected"
                      ).length
                    }
                  />
                  <SourceHealth
                    icon={TriangleAlert}
                    label="需處理"
                    value={
                      snapshot.dataSources.filter((source) =>
                        ["warning", "error"].includes(source.status)
                      ).length
                    }
                  />
                </div>
              </section>
            </aside>
          </section>
        </div>
      </div>
    </main>
  );
}

type SummaryTone = "violet" | "blue" | "amber" | "green";

function SummaryCard({
  label,
  value,
  meta,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  meta: string;
  icon: typeof UsersRound;
  tone: SummaryTone;
}) {
  return (
    <article className={`command-summary-card tone-${tone}`}>
      <span className="command-summary-icon">
        <Icon size={19} />
      </span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{meta}</span>
      </div>
    </article>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
  href,
  linkLabel,
}: {
  eyebrow: string;
  title: string;
  description: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <header className="command-section-header">
      <div>
        <p>{eyebrow}</p>
        <h2>{title}</h2>
        <span>{description}</span>
      </div>
      {href && linkLabel ? (
        <Link href={href}>
          {linkLabel}
          <ArrowUpRight size={14} />
        </Link>
      ) : null}
    </header>
  );
}

function BudgetBrandRow({
  brand,
  paceRatio,
}: {
  brand: BrandCommandCenterRow;
  paceRatio: number;
}) {
  const hasBudget = brand.monthlyPlan.budget > 0;

  return (
    <article className="budget-brand-row">
      <div className="budget-brand-identity">
        <BrandMark
          compact
          name={brand.name}
          color={brand.color}
          logoUrl={brand.logoUrl}
        />
        <div>
          <strong>{brand.name}</strong>
          <small>
            {hasBudget
              ? `月底推算 ${money(brand.spendForecast)}`
              : "未設定本月 Budget"}
          </small>
        </div>
      </div>
      <div className="budget-brand-progress">
        <div className="budget-brand-values">
          <strong>{money(brand.spend)}</strong>
          <span>
            截至昨日應用 {money(brand.expectedSpend)} · 月度{" "}
            {money(brand.monthlyPlan.budget)}
          </span>
        </div>
        <PaceBar
          progress={brand.spendProgress}
          paceRatio={paceRatio}
          status={brand.budgetStatus}
          color={brand.color}
          label={`${brand.name} 預算使用進度`}
        />
      </div>
      <PaceStatusBadge status={brand.budgetStatus} />
    </article>
  );
}

function KpiBrandRow({
  brand,
  paceRatio,
}: {
  brand: BrandCommandCenterRow;
  paceRatio: number;
}) {
  return (
    <article className="kpi-brand-row">
      <div className="kpi-brand-heading">
        <span style={{ background: brand.color }} />
        <div>
          <strong>{brand.name}</strong>
          <small>{brand.connectedSourceCount} 個已連接資料來源</small>
        </div>
      </div>
      <div className="kpi-metric-grid">
        <CompactMetric label="Lead" metric={brand.leads} paceRatio={paceRatio} />
        <CompactMetric
          label="Book"
          metric={brand.bookings}
          paceRatio={paceRatio}
        />
        <CompactMetric label="Show" metric={brand.shows} paceRatio={paceRatio} />
      </div>
    </article>
  );
}

function CompactMetric({
  label,
  metric,
  paceRatio,
}: {
  label: string;
  metric: MetricProgress;
  paceRatio: number;
}) {
  return (
    <div className="compact-kpi">
      <div>
        <span>{label}</span>
        <strong>
          {metric.actual}
          <small> / {metric.target || "—"}</small>
        </strong>
      </div>
      <PaceBar
        progress={metric.progress}
        paceRatio={paceRatio}
        status={metric.status}
        label={`${label} KPI 進度`}
      />
      <p>
        昨日應達 {rounded(metric.expected)} ·{" "}
        {metric.target > 0
          ? `${metric.delta >= 0 ? "+" : ""}${rounded(metric.delta)}`
          : "待設定"}
      </p>
    </div>
  );
}

function BrandAlert({ brand }: { brand: BrandCommandCenterRow }) {
  const messages = [
    brand.budgetStatus === "critical"
      ? `預算比應用進度高 ${money(Math.abs(brand.spendDelta))}`
      : brand.budgetStatus === "warning"
        ? "廣告使用速度偏快"
        : brand.budgetStatus === "under"
          ? "投放速度明顯偏慢"
          : "",
    brand.leads.status === "behind" ? "Lead 落後" : "",
    brand.bookings.status === "behind" ? "Booking 落後" : "",
    brand.shows.status === "behind" ? "Show 落後" : "",
    brand.sourceIssueCount > 0
      ? `${brand.sourceIssueCount} 個資料來源異常`
      : "",
  ].filter(Boolean);

  return (
    <article className="command-brand-alert">
      <BrandMark
        compact
        name={brand.name}
        color={brand.color}
        logoUrl={brand.logoUrl}
      />
      <div>
        <strong>{brand.name}</strong>
        <p>{messages.join(" · ")}</p>
      </div>
      <Link href="/kpis" aria-label={`查看 ${brand.name} KPI`}>
        <ArrowUpRight size={15} />
      </Link>
    </article>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Target;
  title: string;
  body: string;
}) {
  return (
    <div className="command-empty-state">
      <Icon size={22} />
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

function SourceHealth({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof DatabaseZap;
  label: string;
  value: number;
}) {
  return (
    <div className="source-health-card">
      <Icon size={17} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
