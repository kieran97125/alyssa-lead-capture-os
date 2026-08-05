import type { ReactNode } from "react";
import {
  BadgeDollarSign,
  CalendarDays,
  CheckCircle2,
  ClipboardPenLine,
  Clock3,
  Coins,
  DatabaseZap,
  Info,
  Save,
  TriangleAlert,
  UserRoundCheck,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { saveDailySpendAction } from "@/app/command-center/actions";
import { AppNav } from "@/components/alyssa/AppNav";
import { SubmitButton } from "@/components/alyssa/SubmitButton";
import { BrandMark } from "@/components/command-center/BrandMark";
import {
  getDailyOverviewSnapshot,
  type DailyOverviewBrandRow,
  type DailyOverviewCell,
  type DailyOverviewQuery,
} from "@/lib/marketing/dailyOverview";
import {
  SPEND_TYPE_LABELS,
  type SpendType,
} from "@/lib/marketing/spendTypes";

export const dynamic = "force-dynamic";

type MetricRow = {
  key: string;
  label: string;
  note: string;
  render: (cell: DailyOverviewCell) => ReactNode;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

function count(value: number) {
  return Math.round(value).toLocaleString("zh-HK");
}

function money(value: number | null) {
  return value === null || !Number.isFinite(value)
    ? "—"
    : new Intl.NumberFormat("zh-HK", {
        style: "currency",
        currency: "HKD",
        maximumFractionDigits: 0,
      }).format(value);
}

function percent(value: number | null) {
  return value === null || !Number.isFinite(value)
    ? "—"
    : new Intl.NumberFormat("zh-HK", {
        style: "percent",
        maximumFractionDigits: 0,
      }).format(value);
}

function formatHkDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return new Intl.DateTimeFormat("zh-HK", {
    timeZone: "UTC",
    month: "numeric",
    day: "numeric",
  }).format(date);
}

function formatHkDateTime(value: string | null) {
  if (!value) return "尚未有記錄";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "尚未有記錄";
  return `${new Intl.DateTimeFormat("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date)} HKT`;
}

function spendTypeMetric(
  spendType: SpendType,
  label: string
): MetricRow {
  return {
    key: `spend:${spendType}`,
    label,
    note: "單日 / 累計",
    render: (cell) => (
      <MetricPair
        primary={money(cell.spendByType.daily[spendType])}
        secondary={money(cell.spendByType.cumulative[spendType])}
      />
    ),
  };
}

const metricRows: MetricRow[] = [
  {
    key: "leads",
    label: "查詢 Lead",
    note: "單日 / 累計",
    render: (cell) => (
      <MetricPair
        primary={count(cell.daily.leads)}
        secondary={count(cell.cumulative.leads)}
      />
    ),
  },
  {
    key: "lead-target",
    label: "Lead 目標進度",
    note: "累計 / 同日目標｜達成率",
    render: (cell) => (
      <span className="daily-overview-target-value">
        {count(cell.cumulative.leads)} / {count(cell.targetPace.leads)}
        <em>{percent(cell.leadTargetAttainment)}</em>
      </span>
    ),
  },
  {
    key: "bookings",
    label: "Book",
    note: "單日 / 累計",
    render: (cell) => (
      <MetricPair
        primary={count(cell.daily.bookings)}
        secondary={count(cell.cumulative.bookings)}
      />
    ),
  },
  {
    key: "booking-rate",
    label: "BR",
    note: "Book ÷ Lead",
    render: (cell) => (
      <MetricPair
        primary={percent(cell.daily.bookingRate)}
        secondary={percent(cell.cumulative.bookingRate)}
      />
    ),
  },
  {
    key: "shows",
    label: "Show",
    note: "單日 / 累計",
    render: (cell) => (
      <MetricPair
        primary={count(cell.daily.shows)}
        secondary={count(cell.cumulative.shows)}
      />
    ),
  },
  spendTypeMetric("meta_whatsapp", "Meta · WhatsApp"),
  spendTypeMetric("meta_lead_form", "Meta · Lead Form"),
  spendTypeMetric("meta_website_form", "Meta · Website Form"),
  spendTypeMetric("google_ads", "Google Ads"),
  spendTypeMetric("legacy_unclassified", "舊資料 · 未分類"),
  {
    key: "spend",
    label: "總廣告費",
    note: "單日 / 累計",
    render: (cell) => (
      <MetricPair
        primary={money(cell.daily.spend)}
        secondary={money(cell.cumulative.spend)}
      />
    ),
  },
  {
    key: "cpl",
    label: "CPL",
    note: "Spend ÷ Lead",
    render: (cell) => (
      <MetricPair
        primary={money(cell.daily.cpl)}
        secondary={money(cell.cumulative.cpl)}
      />
    ),
  },
  {
    key: "cpa-book",
    label: "CPA · Book",
    note: "Spend ÷ Book",
    render: (cell) => (
      <MetricPair
        primary={money(cell.daily.costPerBooking)}
        secondary={money(cell.cumulative.costPerBooking)}
      />
    ),
  },
  {
    key: "cpa-show",
    label: "CPA · Show",
    note: "Spend ÷ Show",
    render: (cell) => (
      <MetricPair
        primary={money(cell.daily.costPerShow)}
        secondary={money(cell.cumulative.costPerShow)}
      />
    ),
  },
];

export default async function DailyOverviewPage({
  searchParams,
}: {
  searchParams?: Promise<
    DailyOverviewQuery & {
      command_status?: string | string[];
      message?: string | string[];
    }
  >;
}) {
  const query = (await searchParams) ?? {};
  const snapshot = await getDailyOverviewSnapshot(query);
  const message = firstParam(query.message);
  const commandStatus = firstParam(query.command_status);
  const selectedSpendLabel = SPEND_TYPE_LABELS[snapshot.selectedSpendType];
  const visibleMetricRows = snapshot.hasLegacySpend
    ? metricRows
    : metricRows.filter((metric) => metric.key !== "spend:legacy_unclassified");
  const returnPath = `/performance/daily?month=${snapshot.monthStart}&entry_date=${snapshot.selectedEntryDate}&spend_type=${snapshot.selectedSpendType}`;

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="command-page daily-overview-page">
        <div className="command-page-inner">
          <header className="command-page-header daily-overview-header">
            <div>
              <p className="command-page-kicker">每日成效</p>
              <h1 className="command-page-title">每日總覽</h1>
              <p className="command-page-subtitle">
                CS Lead Sheet 提供 Lead／Book／Show；廣告費直接喺系統記錄。每個日期同時睇單日及累計表現，毋須再接駁每月 Spending Sheet。
              </p>
              <div className="daily-overview-source-line">
                <span>
                  <DatabaseZap size={14} />
                  Lead Sheet · 轉化
                </span>
                <span>
                  <WalletCards size={14} />
                  每日廣告費
                </span>
                <span>
                  <Clock3 size={14} />
                  廣告費更新：{formatHkDateTime(snapshot.latestSpendUpdateAt)}
                </span>
              </div>
            </div>
            <form className="daily-overview-month-filter" method="get">
              <input
                type="hidden"
                name="spend_type"
                value={snapshot.selectedSpendType}
              />
              <label>
                <span>月份</span>
                <select name="month" defaultValue={snapshot.monthStart}>
                  {snapshot.monthOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="command-secondary-button">
                <CalendarDays size={15} />
                查看月份
              </button>
            </form>
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

          <section className="daily-overview-kpis" aria-label="月份累計摘要">
            <OverviewKpi
              icon={<WalletCards size={18} />}
              label="廣告費"
              value={money(snapshot.allBrands.total.spend)}
              note={`截至 ${formatHkDate(snapshot.throughDate)}`}
            />
            <OverviewKpi
              icon={<UsersRound size={18} />}
              label="Lead"
              value={count(snapshot.allBrands.total.leads)}
              note={`CPL ${money(snapshot.allBrands.total.cpl)}`}
            />
            <OverviewKpi
              icon={<ClipboardPenLine size={18} />}
              label="Book"
              value={count(snapshot.allBrands.total.bookings)}
              note={`CPA ${money(snapshot.allBrands.total.costPerBooking)}`}
            />
            <OverviewKpi
              icon={<UserRoundCheck size={18} />}
              label="Show"
              value={count(snapshot.allBrands.total.shows)}
              note={`CPA ${money(snapshot.allBrands.total.costPerShow)}`}
            />
          </section>

          <section className="command-surface daily-spend-editor">
            <header>
              <div>
                <p>每日廣告費</p>
                <h2>填寫每日廣告費</h2>
                <span>
                  先揀 Meta 細分類或 Google Ads，再一次更新你有權限管理嘅品牌；輸入 0 代表確認冇廣告費，清空再儲存代表刪除該類舊值。每次修改都會保留紀錄。
                </span>
              </div>
              <BadgeDollarSign size={24} />
            </header>

            <form className="daily-spend-date-picker" method="get">
              <input type="hidden" name="month" value={snapshot.monthStart} />
              <label>
                <span>輸入日期</span>
                <input
                  type="date"
                  name="entry_date"
                  min={snapshot.monthStart}
                  max={snapshot.maxEntryDate}
                  defaultValue={snapshot.selectedEntryDate}
                />
              </label>
              <label>
                <span>廣告費類型</span>
                <select
                  name="spend_type"
                  defaultValue={snapshot.selectedSpendType}
                >
                  {snapshot.spendTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="command-secondary-button">
                載入日期及類型
              </button>
            </form>

            <form action={saveDailySpendAction} className="daily-spend-form">
              <input type="hidden" name="spendDate" value={snapshot.selectedEntryDate} />
              <input
                type="hidden"
                name="spendType"
                value={snapshot.selectedSpendType}
              />
              <input type="hidden" name="returnPath" value={returnPath} />
              <div className="daily-spend-brand-grid">
                {snapshot.brands.map((brand) => {
                  const entry = snapshot.selectedEntries[brand.id];
                  return (
                    <article
                      key={brand.id}
                      className="daily-spend-brand-card"
                      style={{
                        borderTopColor: brand.color,
                        backgroundColor: brand.secondaryColor,
                      }}
                    >
                      <div className="daily-spend-brand-heading">
                        <BrandMark
                          name={brand.name}
                          color={brand.color}
                        />
                        <span>
                          {entry
                            ? entry.entryMethod === "legacy_import"
                              ? "已由舊表搬入"
                              : `第 ${entry.revision} 次更新`
                            : "尚未填寫"}
                        </span>
                      </div>
                      <label className="daily-spend-amount-field">
                        <span>{selectedSpendLabel}</span>
                        <span className="daily-spend-money-input">
                          <b>$</b>
                          <input
                            type="number"
                            name={`amount:${brand.id}`}
                            min="0"
                            max="99999999.99"
                            step="0.01"
                            defaultValue={entry?.amount ?? ""}
                            inputMode="decimal"
                            aria-label={`${brand.name} ${snapshot.selectedEntryDate} ${selectedSpendLabel} 廣告費`}
                          />
                        </span>
                      </label>
                      <input
                        type="hidden"
                        name={`originalAmount:${brand.id}`}
                        value={entry?.amount ?? ""}
                      />
                      <input
                        type="hidden"
                        name={`originalNote:${brand.id}`}
                        value={entry?.note ?? ""}
                      />
                      <input
                        type="hidden"
                        name={`expectedRevision:${brand.id}`}
                        value={entry?.revision ?? ""}
                      />
                      <label className="daily-spend-note-field">
                        <span>備註（選填）</span>
                        <input
                          name={`note:${brand.id}`}
                          maxLength={500}
                          defaultValue={entry?.note ?? ""}
                          placeholder={`例如：${selectedSpendLabel} 帳戶調整`}
                        />
                      </label>
                      <small>
                        {entry
                          ? `${formatHkDateTime(entry.updatedAt)} · ${entry.updatedBy ?? "系統搬數"}`
                          : "留空並儲存不會製造 0 值；如確認冇投放，請填 0。"}
                      </small>
                    </article>
                  );
                })}
              </div>
              <footer>
                <div>
                  {snapshot.schemaReady ? (
                    <CheckCircle2 size={17} />
                  ) : (
                    <TriangleAlert size={17} />
                  )}
                  <span>
                    {snapshot.schemaReady
                      ? `將更新 ${snapshot.selectedEntryDate} · ${selectedSpendLabel}，儲存後總廣告費、CPL 同 CPA 會即時重算。`
                      : "廣告費記錄功能暫時未能使用，請聯絡系統管理員。"}
                  </span>
                </div>
                <SubmitButton
                  className="command-primary-button"
                  pendingLabel="儲存及重算中…"
                  disabled={!snapshot.canEditSpend || !snapshot.schemaReady}
                >
                  <Save size={15} />
                  儲存 {selectedSpendLabel}
                </SubmitButton>
              </footer>
            </form>
          </section>

          <section className="command-surface daily-overview-surface">
            <header className="daily-overview-table-header">
              <div>
                <p>每日／累計</p>
                <h2>{snapshot.monthLabel} 每日數據</h2>
                <span>
                  每格左邊係單日、右邊係截至該日累計；橫向捲動可查閱整個月份。
                </span>
              </div>
              <div className="daily-overview-legend">
                <span><i />單日</span>
                <span><i />累計</span>
              </div>
            </header>
            <div className="daily-overview-table-wrap">
              <table className="daily-overview-table">
                <thead>
                  <tr>
                    <th>品牌</th>
                    <th>指標</th>
                    {snapshot.dates.map((date) => {
                      const cell = snapshot.allBrands.cells.find(
                        (item) => item.date === date
                      );
                      return (
                        <th key={date}>
                          <strong>{date}</strong>
                          <span>{cell?.weekday}</span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {[snapshot.allBrands, ...snapshot.brands].map((brand) => (
                    <BrandMetricRows
                      key={brand.id}
                      brand={brand}
                      rows={visibleMetricRows}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="daily-overview-method-grid">
            <article className="command-surface">
              <Coins size={18} />
              <strong>成本口徑</strong>
              <p>
                CPL = 廣告費 ÷ Lead；CPA · Book = 廣告費 ÷ Book；CPA · Show = 廣告費 ÷ Show。分母為 0 時顯示「—」。
              </p>
            </article>
            <article className="command-surface">
              <Info size={18} />
              <strong>資料歸屬</strong>
              <p>
                廣告費只讀系統廣告費帳簿；Lead／Book／Show 只讀 CS Lead Sheet，同一指標唔會由兩個來源重複相加。
                新輸入按 Meta WhatsApp／Lead Form／Website Form 同 Google Ads 分開；舊 Sheet 總額只會標示為未分類。
              </p>
            </article>
          </section>
        </div>
      </div>
    </main>
  );
}

function MetricPair({
  primary,
  secondary,
}: {
  primary: string;
  secondary: string;
}) {
  return (
    <span className="daily-overview-metric-pair">
      <strong>{primary}</strong>
      <i>/</i>
      <em>{secondary}</em>
    </span>
  );
}

function OverviewKpi({
  icon,
  label,
  value,
  note,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article className="command-surface daily-overview-kpi">
      <span>{icon}</span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </article>
  );
}

function BrandMetricRows({
  brand,
  rows,
}: {
  brand: DailyOverviewBrandRow;
  rows: MetricRow[];
}) {
  return rows.map((metric, metricIndex) => (
    <tr
      key={`${brand.id}:${metric.key}`}
      className={metricIndex === 0 ? "daily-overview-brand-start" : ""}
      style={
        metricIndex === 0
          ? { borderTopColor: brand.color }
          : undefined
      }
    >
      {metricIndex === 0 ? (
        <th
          rowSpan={rows.length}
          className="daily-overview-brand-cell"
          style={{ backgroundColor: brand.secondaryColor }}
        >
          <BrandMark name={brand.name} color={brand.color} />
          <span>
            Spend {brand.spendCoverageDays}/{brand.expectedSpendDays} 日
          </span>
        </th>
      ) : null}
      <th className="daily-overview-metric-cell">
        <strong>{metric.label}</strong>
        <span>{metric.note}</span>
      </th>
      {brand.cells.map((cell) => (
        <td key={`${brand.id}:${metric.key}:${cell.date}`}>
          {metric.render(cell)}
        </td>
      ))}
    </tr>
  ));
}
