import { SystemDataStatus } from "@/components/system/SystemDetails";
import { Suspense } from "react";
import { redirect, unstable_rethrow } from "next/navigation";
import {
  ArrowUpRight,
  CalendarClock,
  DatabaseZap,
  Target,
  TriangleAlert,
  ShieldAlert,
} from "lucide-react";
import { AppNav } from "@/components/alyssa/AppNav";
import { DashboardRegionState } from "@/components/command-center/DashboardRegionState";
import { IntentPrefetchLink } from "@/components/alyssa/IntentPrefetchLink";
import {
  PaceBar,
  PaceStatusBadge,
} from "@/components/command-center/PaceBar";
import { BrandMark } from "@/components/command-center/BrandMark";
import { DashboardRefreshButton } from "@/components/command-center/DashboardRefreshButton";
import { LeadDashboardPanel } from "@/components/command-center/LeadDashboardPanel";
import { SourcePerformancePanel } from "@/components/command-center/SourcePerformancePanel";
import { refreshDashboardDataAction } from "@/app/command-center/actions";
import { money } from "@/lib/data/businessMetrics";
import {
  getCommandCenterSnapshot,
  type BrandCommandCenterRow,
  type MetricProgress,
} from "@/lib/marketing/commandCenter";
import { getLeadDashboardSnapshot } from "@/lib/marketing/leadDashboard";
import {
  buildLeadDashboardReturnPath,
  normalizeLeadDashboardFilters,
} from "@/lib/marketing/leadDashboardFilters";
import { getLeadAuditNavigationSummary } from "@/lib/marketing/leadSheetAuditView";
import { getSourcePerformanceSnapshot } from "@/lib/marketing/sourcePerformance";
import { getCurrentInternalAccess } from "@/lib/security/internalAccessServer";
import { WorkspaceAccessUnavailableError } from "@/lib/security/workspaceAuth";
import {
  hasWorkspaceModulePermission,
  normalizeWorkspaceRole,
} from "@/lib/security/workspacePermissions";

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
    startDate?: string | string[];
    endDate?: string | string[];
    accountId?: string | string[];
    brandId?: string | string[];
    treatment?: string | string[];
  }>;
}) {
  // Auth remains a prerequisite. Data panels do not gate the navigation or shell.
  const [requestedQuery, access] = await Promise.all([
    searchParams,
    getCurrentInternalAccess().catch((error: unknown) => {
      if (error instanceof WorkspaceAccessUnavailableError) {
        redirect("/login?error=auth_unavailable&next=%2Fdashboard");
      }
      throw error;
    }),
  ]);
  const query = requestedQuery ?? {};
  if (access.source === "unauthenticated") {
    redirect("/login?error=auth_unavailable&next=%2Fdashboard");
  }
  const filters = normalizeLeadDashboardFilters({
    startDate: firstParam(query.startDate),
    endDate: firstParam(query.endDate),
    accountId: firstParam(query.accountId),
    brandId: firstParam(query.brandId),
    treatment: firstParam(query.treatment),
  });
  const commandSnapshotPromise = settleDashboardData(getCommandCenterSnapshot());
  const leadDashboardPromise = settleDashboardData(
    getLeadDashboardSnapshot(filters, access)
  );
  const sourcePerformancePromise = settleDashboardData(
    getSourcePerformanceSnapshot({
      startDate: filters.startDate,
      endDate: filters.endDate,
      accountScope: filters.accountId || null,
      brandScope: filters.brandId,
    }, access)
  );
  const canSeeLeadAudit =
    access.accessLevel === "master" ||
    (access.source === "supabase_auth" &&
      hasWorkspaceModulePermission({
        isMaster: false,
        workspaceRole: normalizeWorkspaceRole(access.workspaceRole),
        modulePermissions: access.modulePermissions ?? {},
      }, "lead_audit"));
  const leadAuditAlertPromise = settleDashboardData(
    canSeeLeadAudit ? getLeadAuditNavigationSummary(access) : Promise.resolve(0)
  );
  const isMaster = access.accessLevel === "master";
  const greetingName =
    access.source === "supabase_auth"
      ? access.fullName?.trim().split(/\s+/)[0] ||
        access.email?.split("@")[0] ||
        "團隊"
      : "Kieran";
  const message = firstParam(query?.message);
  const status = firstParam(query?.command_status);
  const dashboardReturnPath = buildLeadDashboardReturnPath(filters);

  return (
    <main className="alyssa-shell">
      <AppNav
        access={access}
        leadAuditAlertPromise={leadAuditAlertPromise.then((result) =>
          result.ok ? result.value : null
        )}
      />
      <div className="command-page">
        <div className="command-page-inner">
          <header className="command-page-header">
            <div>
              <p className="command-page-kicker">早晨，{greetingName}</p>
              <h1 className="command-page-title">Dashboard</h1>
              <p className="command-page-subtitle">
                Lead、預約、到店及廣告成本
              </p>
            </div>
            <div className="command-header-actions">
              <Suspense fallback={<small role="status">讀取同步狀態中…</small>}>
                <DashboardSyncStatus
                  result={commandSnapshotPromise}
                  isMaster={isMaster}
                  returnPath={dashboardReturnPath}
                />
              </Suspense>
              {isMaster ? (
                <IntentPrefetchLink
                  href="/settings/planning"
                  className="command-secondary-button"
                >
                  <Target size={16} />
                  設定本月目標
                </IntentPrefetchLink>
              ) : null}
              <IntentPrefetchLink
                href="/calendar"
                className="command-primary-button"
              >
                <CalendarClock size={16} />
                安排營銷事項
              </IntentPrefetchLink>
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
          <Suspense fallback={null}>
            <LeadAuditAlert result={leadAuditAlertPromise} />
          </Suspense>
          <Suspense fallback={<DashboardRegionState title="Lead、預約及到店" />}>
            <LeadDashboardRegion
              result={leadDashboardPromise}
              returnPath={dashboardReturnPath}
            />
          </Suspense>
          <Suspense fallback={<DashboardRegionState title="廣告來源成效" />}>
            <SourcePerformanceRegion
              result={sourcePerformancePromise}
              returnPath={dashboardReturnPath}
            />
          </Suspense>
          <Suspense fallback={<DashboardRegionState title="營運控制" />}>
            <OperationsRegion
              result={commandSnapshotPromise}
              isMaster={isMaster}
              returnPath={dashboardReturnPath}
            />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

type DashboardData<T> = { ok: true; value: T } | { ok: false; error: unknown };

// Attach the rejection handler as soon as a read starts, including while a
// different Suspense boundary is pending. Next redirect/notFound signals are
// rethrown by the region, not mistaken for empty business data.
function settleDashboardData<T>(read: Promise<T>): Promise<DashboardData<T>> {
  return read.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error })
  );
}

function readDashboardData<T>(result: DashboardData<T>): T | null {
  if (result.ok) return result.value;
  unstable_rethrow(result.error);
  return null;
}

type CommandResult = Promise<
  DashboardData<Awaited<ReturnType<typeof getCommandCenterSnapshot>>>
>;

async function DashboardSyncStatus({ result, isMaster, returnPath }: {
  result: CommandResult;
  isMaster: boolean;
  returnPath: string;
}) {
  const snapshot = readDashboardData(await result);
  if (!snapshot) return <small role="status">同步狀態暫時未能讀取</small>;
  const leadSheetSources = snapshot.dataSources.filter((source) =>
    source.providerKey === "google_sheets" &&
    !source.reportingWorkbookId &&
    source.status !== "paused"
  );
  const latestSuccessAt = leadSheetSources
    .map((source) => source.lastSuccessAt)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.localeCompare(left))[0] ?? null;
  const refreshDisabled =
    !isMaster || !snapshot.schemaReady || leadSheetSources.length === 0;
  return isMaster ? (
    <form action={refreshDashboardDataAction} className="command-refresh-form">
      <input type="hidden" name="returnPath" value={returnPath} />
      <DashboardRefreshButton
        disabled={refreshDisabled}
        idleLabel="跟 Lead Sheet 更新"
        pendingLabel="讀取 Lead Sheet 中…"
      />
      <small>上次同步作業：{formatHkDateTime(latestSuccessAt) || "尚未同步"} · 按掣先更新</small>
    </form>
  ) : <small>上次同步作業：{formatHkDateTime(latestSuccessAt) || "尚未同步"} · 由 Master 手動更新</small>;
}

async function LeadAuditAlert({ result }: {
  result: Promise<DashboardData<number>>;
}) {
  const count = readDashboardData(await result);
  if (!count || count <= 0) return null;
  return (
    <a href="/lead-audit?review=open" className="lead-audit-alert-banner">
      <ShieldAlert size={22} />
      <div>
        <strong>{count} 項 Lead 資料異常待核對</strong>
        <p>系統偵測到舊紀錄被刪除或出現關鍵變動。</p>
      </div>
      <span>立即檢查 <ArrowUpRight size={14} /></span>
    </a>
  );
}

async function LeadDashboardRegion({ result, returnPath }: {
  result: Promise<DashboardData<Awaited<ReturnType<typeof getLeadDashboardSnapshot>>>>;
  returnPath: string;
}) {
  const snapshot = readDashboardData(await result);
  if (!snapshot?.live) {
    return <DashboardRegionState title="Lead、預約及到店" failed retryHref={returnPath} message="未有可用嘅已同步資料。請由 Master 按「跟 Lead Sheet 更新」。" />;
  }
  return (
    <>
      {snapshot.warnings.map((warning) => (
        <p key={warning} className="command-status-message is-error">{warning}</p>
      ))}
      <LeadDashboardPanel snapshot={snapshot} />
    </>
  );
}

async function SourcePerformanceRegion({ result, returnPath }: {
  result: Promise<DashboardData<Awaited<ReturnType<typeof getSourcePerformanceSnapshot>>>>;
  returnPath: string;
}) {
  const snapshot = readDashboardData(await result);
  if (!snapshot || (!snapshot.live && process.env.ALYSSA_E2E_FIXTURES !== "1")) {
    return <DashboardRegionState title="廣告來源成效" failed retryHref={returnPath} />;
  }
  return <SourcePerformancePanel snapshot={snapshot} />;
}

async function OperationsRegion({ result, isMaster, returnPath }: {
  result: CommandResult;
  isMaster: boolean;
  returnPath: string;
}) {
  const snapshot = readDashboardData(await result);
  if (!snapshot || (!snapshot.schemaReady && process.env.ALYSSA_E2E_FIXTURES !== "1")) {
    return <DashboardRegionState title="營運控制" failed retryHref={returnPath} />;
  }
  const alerts = snapshot.brands.filter((brand) =>
    ["warning", "critical", "under"].includes(brand.budgetStatus) ||
    brand.leads.status === "behind" ||
    brand.bookings.status === "behind" ||
    brand.shows.status === "behind" ||
    brand.sourceIssueCount > 0
  );
  const upcoming = snapshot.calendarItems
    .filter((item) => item.scheduledDate >= snapshot.month.today)
    .slice(0, 5);
  return (
    <>
      <SystemDataStatus warnings={snapshot.dataWarnings} />
      <div className="lead-dashboard-operations-heading">
        <p>Operations control</p>
        <h2>營運控制</h2>
        <span>
          Budget 與 KPI 以已完成日期至昨日為準，避免今日未完整數據干擾判斷。
        </span>
      </div>

      <section className="command-dashboard-layout">
        <div className="command-main-column">
          <section className="command-surface command-section">
            <SectionHeader
              eyebrow="Budget control"
              title="預算概覽"
              description={`時間進度 ${snapshot.month.elapsedDays}／${snapshot.month.daysInMonth} 日；垂直線代表截至昨日理應使用位置。`}
              href={isMaster ? "/settings/planning" : undefined}
              linkLabel={isMaster ? "管理預算" : undefined}
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
              description="截至昨日的目標進度"
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
                        style={{ background: brand?.color || "#5a2348" }}
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
              href={isMaster ? "/data-sources" : undefined}
              linkLabel={isMaster ? "管理來源" : undefined}
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
    </>
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
        <IntentPrefetchLink href={href}>
          {linkLabel}
          <ArrowUpRight size={14} />
        </IntentPrefetchLink>
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
      />
      <div>
        <strong>{brand.name}</strong>
        <p>{messages.join(" · ")}</p>
      </div>
      <IntentPrefetchLink
        href="/kpis"
        aria-label={`查看 ${brand.name} KPI`}
      >
        <ArrowUpRight size={15} />
      </IntentPrefetchLink>
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
