import {
  Activity,
  Clock3,
  DatabaseZap,
  Filter,
  Flag,
  Info,
  UserRoundCheck,
  UserRoundX,
  UsersRound,
} from "lucide-react";
import { BrandMark } from "@/components/command-center/BrandMark";
import { IntentPrefetchLink } from "@/components/alyssa/IntentPrefetchLink";
import type {
  LeadDashboardDimensionRow,
  LeadDashboardStats,
} from "@/lib/marketing/leadDashboardMath";
import type { LeadDashboardSnapshot } from "@/lib/marketing/leadDashboard";

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
  if (!value) return "尚未讀取";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "尚未讀取";
  return `${new Intl.DateTimeFormat("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date)} HKT`;
}

function statusLabel(status: string, live: boolean) {
  if (live) return "即時讀取成功";
  if (status === "error") return "來源錯誤";
  if (status === "paused") return "來源已暫停";
  return "未能即時讀取";
}

function SummaryMetric({
  label,
  value,
  meta,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  meta: string;
  tone: "plum" | "rose" | "green" | "red" | "blue";
  icon: typeof UsersRound;
}) {
  return (
    <article className={`lead-dashboard-metric tone-${tone}`}>
      <span><Icon size={18} /></span>
      <div>
        <p>{label}</p>
        <strong>{formatNumber(value)}</strong>
        <small>{meta}</small>
      </div>
    </article>
  );
}

function RateCells({ row }: { row: LeadDashboardStats }) {
  return (
    <>
      <td>{formatPercent(row.bookRate)}</td>
      <td>{formatPercent(row.showRate)}</td>
      <td>{formatPercent(row.showUpRate)}</td>
      <td>{formatPercent(row.noShowRate)}</td>
    </>
  );
}

function PerformanceTable({
  rows,
  firstColumn,
  snapshot,
}: {
  rows: LeadDashboardDimensionRow[];
  firstColumn: "brand" | "treatment";
  snapshot: LeadDashboardSnapshot;
}) {
  return (
    <div className="treatment-table-wrap">
      <table className="treatment-performance-table lead-dashboard-table">
        <thead>
          <tr>
            <th>{firstColumn === "brand" ? "品牌" : "療程項目"}</th>
            <th>Lead</th>
            <th>Book</th>
            <th>Show</th>
            <th>No Show</th>
            <th>本月未 Show</th>
            <th title="Book ÷ Lead">Book Rate</th>
            <th title="Show ÷ Lead">Show Rate</th>
            <th title="Show ÷ Book">Show-up Rate</th>
            <th title="No Show ÷ Book">No-show Rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows.map((row) => (
              <tr key={row.key}>
                <td>
                  {firstColumn === "brand" ? (
                    <span className="lead-dashboard-brand-cell">
                      <BrandMark
                        compact
                        name={row.brandLabel}
                        color={snapshot.brandColors[row.brandId] || "#5a2348"}
                      />
                      <strong>{row.brandLabel}</strong>
                    </span>
                  ) : (
                    <strong>{row.treatmentLabel}</strong>
                  )}
                </td>
                <td>{formatNumber(row.leads)}</td>
                <td>{formatNumber(row.bookings)}</td>
                <td>{formatNumber(row.shows)}</td>
                <td>{formatNumber(row.noShows)}</td>
                <td>{formatNumber(row.outstanding)}</td>
                <RateCells row={row} />
              </tr>
            ))
          ) : (
            <tr><td colSpan={10}>所選期間未有符合條件嘅 Lead。</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function LeadDashboardPanel({
  snapshot,
}: {
  snapshot: LeadDashboardSnapshot;
}) {
  const hasFilters = Boolean(
    snapshot.filters.brandId || snapshot.filters.treatment
  );

  return (
    <section className="lead-dashboard-stack" aria-label="Lead Dashboard">
      <section className="command-surface lead-dashboard-filter-panel">
        <header>
          <div>
            <span
              className={`treatment-source-status is-${
                snapshot.live ? "connected" : snapshot.sourceStatus
              }`}
            >
              <span />
              {statusLabel(snapshot.sourceStatus, snapshot.live)}
            </span>
            <strong>{snapshot.sourceName} · <code>lead</code> 分頁</strong>
            <small>
              <DatabaseZap size={13} />
              直接讀取 Lead 表 · {formatHkDateTime(snapshot.loadedAt)}
            </small>
          </div>
          <p>
            內建 Apps Script 口徑：按品牌＋電話最後 8 位去重；電話空白先用
            Lead Key。Lead／Book 歸入 First Touch。
          </p>
        </header>

        <form method="get" action="/dashboard" className="lead-dashboard-filter-form">
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
            <select name="treatment" defaultValue={snapshot.filters.treatment}>
              <option value="">全部療程</option>
              {snapshot.treatmentOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="lead-dashboard-filter-actions">
            <button type="submit" className="command-primary-button">
              <Filter size={15} />
              套用篩選
            </button>
            {hasFilters ? (
              <IntentPrefetchLink
                href={`/dashboard?startDate=${snapshot.filters.startDate}&endDate=${snapshot.filters.endDate}`}
                className="command-secondary-button"
              >
                清除分類
              </IntentPrefetchLink>
            ) : null}
          </div>
        </form>
      </section>

      <section className="lead-dashboard-summary" aria-label="Lead Funnel 摘要">
        <SummaryMetric
          label="Lead"
          value={snapshot.totals.leads}
          meta="First Touch Created At"
          tone="plum"
          icon={UsersRound}
        />
        <SummaryMetric
          label="Book"
          value={snapshot.totals.bookings}
          meta={`${formatPercent(snapshot.totals.bookRate)} Book Rate`}
          tone="rose"
          icon={UserRoundCheck}
        />
        <SummaryMetric
          label="Show"
          value={snapshot.totals.shows}
          meta={`${formatPercent(snapshot.totals.showRate)} Show / Lead`}
          tone="green"
          icon={Flag}
        />
        <SummaryMetric
          label="No Show"
          value={snapshot.totals.noShows}
          meta={`${formatPercent(snapshot.totals.noShowRate)} No-show Rate`}
          tone="red"
          icon={UserRoundX}
        />
        <SummaryMetric
          label="本月未 Show"
          value={snapshot.totals.outstanding}
          meta={`${snapshot.outstandingMonthStart} 至 ${snapshot.outstandingMonthEnd}`}
          tone="blue"
          icon={Clock3}
        />
      </section>

      <section className="command-surface treatment-ranking-section">
        <div className="lead-dashboard-section-heading">
          <div><UsersRound size={17} /><div><p>Brand summary</p><h2>品牌總結</h2></div></div>
          <span>{snapshot.filters.startDate} 至 {snapshot.filters.endDate}</span>
        </div>
        <PerformanceTable rows={snapshot.brandRows} firstColumn="brand" snapshot={snapshot} />
      </section>

      <section className="command-surface treatment-ranking-section">
        <div className="lead-dashboard-section-heading">
          <div><Activity size={17} /><div><p>Treatment performance</p><h2>療程表現</h2></div></div>
          <span>{snapshot.treatmentRows.length} 個療程</span>
        </div>
        <PerformanceTable rows={snapshot.treatmentRows} firstColumn="treatment" snapshot={snapshot} />
      </section>

      <section className="command-surface treatment-ranking-section">
        <div className="lead-dashboard-section-heading">
          <div><Activity size={17} /><div><p>Source diagnostics</p><h2>來源／Campaign 表現</h2></div></div>
          <span>按 First Touch 來源歸因</span>
        </div>
        <div className="treatment-table-wrap">
          <table className="treatment-performance-table source-diagnostic-table lead-dashboard-table">
            <thead>
              <tr>
                <th>品牌／療程</th><th>來源</th><th>Campaign／廣告</th>
                <th>Lead</th><th>Book</th><th>Show</th><th>No Show</th>
                <th>本月未 Show</th><th>Book Rate</th><th>Show-up Rate</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.campaignRows.length > 0 ? (
                snapshot.campaignRows.slice(0, 100).map((row) => (
                  <tr key={row.key}>
                    <td><strong>{row.brandLabel}</strong><span>{row.treatmentLabel}</span></td>
                    <td>{row.sourceLabel}</td><td>{row.campaignLabel}</td>
                    <td>{formatNumber(row.leads)}</td><td>{formatNumber(row.bookings)}</td>
                    <td>{formatNumber(row.shows)}</td><td>{formatNumber(row.noShows)}</td>
                    <td>{formatNumber(row.outstanding)}</td>
                    <td>{formatPercent(row.bookRate)}</td><td>{formatPercent(row.showUpRate)}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={10}>所選期間未有來源／Campaign 成效。</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {snapshot.campaignRows.length > 100 ? (
          <p className="treatment-table-note">先顯示 Lead 數最高 100 組；可用品牌或療程再收窄。</p>
        ) : null}
      </section>

      <section className="command-surface treatment-ranking-section">
        <div className="lead-dashboard-section-heading">
          <div><Clock3 size={17} /><div><p>Outstanding appointments</p><h2>本月未 Show 明細</h2></div></div>
          <span>{snapshot.outstandingRows.length} 個待到店預約</span>
        </div>
        <div className="treatment-table-wrap">
          <table className="treatment-performance-table lead-dashboard-table lead-dashboard-outstanding-table">
            <thead>
              <tr>
                <th>預約日期／時間</th><th>品牌／分店</th><th>療程</th><th>狀態</th>
                <th>來源</th><th>Campaign／廣告</th><th>First Touch</th><th>CS Remark</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.outstandingRows.length > 0 ? (
                snapshot.outstandingRows.map((row) => (
                  <tr key={row.key}>
                    <td><strong>{row.appointmentDate}</strong><span>{row.appointmentTime}</span></td>
                    <td><strong>{row.brandLabel}</strong><span>{row.branchLabel}</span></td>
                    <td>{row.treatmentLabel}</td><td>{row.statusLabel}</td>
                    <td>{row.sourceLabel}</td><td>{row.campaignLabel}</td>
                    <td>{row.createdAt}</td><td>{row.csRemark || "—"}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={8}>所選月份暫時未有待到店預約。</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="treatment-definition-note lead-dashboard-definition">
        <Info size={17} />
        <div>
          <strong>計算及資料來源</strong>
          <p>
            Lead／Book 按同品牌同電話尾 8 位嘅最早 Created At；Show 按確認到店日期；
            No Show 同本月未 Show 按預約日期。Book 包括已預約、已到店及 No Show。
          </p>
          <p>
            呢個 Dashboard 由系統直接讀取 <code>lead</code> 分頁再即時計算；
            不讀 <code>mkt_dashboard</code>、每日 Overview 或任何外部報表頁。
          </p>
        </div>
      </section>
    </section>
  );
}
