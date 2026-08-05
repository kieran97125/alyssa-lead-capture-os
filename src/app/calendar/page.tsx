import { CalendarPlus, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { createCalendarItemAction } from "@/app/command-center/actions";
import { AppNav } from "@/components/alyssa/AppNav";
import { IntentPrefetchLink } from "@/components/alyssa/IntentPrefetchLink";
import { SubmitButton } from "@/components/alyssa/SubmitButton";
import { MarketingCalendarBoard } from "@/components/command-center/MarketingCalendarBoard";
import { getMarketingCalendarSnapshot } from "@/lib/marketing/marketingCalendar";
import { shiftComparisonMonth } from "@/lib/marketing/periodComparisonMath";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

export default async function MarketingCalendarPage({
  searchParams,
}: {
  searchParams?: Promise<{
    command_status?: string | string[];
    message?: string | string[];
    month?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const requestedMonth = firstParam(query?.month);
  const snapshot = await getMarketingCalendarSnapshot(requestedMonth);
  const message = firstParam(query?.message);
  const status = firstParam(query?.command_status);
  const monthValue = snapshot.month.monthStart.slice(0, 7);
  const previousMonth = shiftComparisonMonth(snapshot.month.monthStart, -1) as string;
  const nextMonth = shiftComparisonMonth(snapshot.month.monthStart, 1) as string;
  const createDefaultDate =
    snapshot.month.today >= snapshot.month.monthStart &&
    snapshot.month.today <= snapshot.month.monthEnd
      ? snapshot.month.today
      : snapshot.month.monthStart;
  const returnPath = `/calendar?month=${monthValue}`;

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="command-page">
        <div className="command-page-inner">
          <header className="command-page-header">
            <div>
              <p className="command-page-kicker">營銷規劃</p>
              <h1 className="command-page-title">營銷日曆</h1>
              <p className="command-page-subtitle">
                {snapshot.month.label} · 集中安排各品牌、療程、內容同廣告事項；可直接拖放更改日期。
              </p>
            </div>
            <div className="calendar-header-actions">
              <form method="get" action="/calendar" className="calendar-month-picker">
                <IntentPrefetchLink
                  href={`/calendar?month=${previousMonth.slice(0, 7)}`}
                  aria-label="上一個月"
                >
                  <ChevronLeft size={16} />
                </IntentPrefetchLink>
                <label>
                  <span>顯示月份</span>
                  <input type="month" name="month" defaultValue={monthValue} />
                </label>
                <button type="submit">前往</button>
                <IntentPrefetchLink
                  href={`/calendar?month=${nextMonth.slice(0, 7)}`}
                  aria-label="下一個月"
                >
                  <ChevronRight size={16} />
                </IntentPrefetchLink>
              </form>
              <a href="#new-calendar-item" className="command-primary-button">
                <CalendarPlus size={16} />
                新增事項
              </a>
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
          {snapshot.warnings.map((warning) => (
            <p key={warning} className="command-status-message">
              {warning}
            </p>
          ))}
          {!snapshot.schemaReady ? (
            <p className="command-status-message">
              日曆暫時只供查看，請聯絡系統管理員完成設定。
            </p>
          ) : null}

          <section className="calendar-brand-legend command-surface">
            <div>
              {snapshot.brands.map((brand) => (
                <span key={brand.id}>
                  <i style={{ background: brand.color }} />
                  {brand.name}
                </span>
              ))}
            </div>
            <p>
              <Info size={14} />
              拖放後會自動保存新日期
            </p>
          </section>

          <section className="command-surface calendar-board-section">
            <MarketingCalendarBoard
              initialItems={snapshot.calendarItems}
              brands={snapshot.brands.map((brand) => ({
                id: brand.id,
                name: brand.name,
                color: brand.color,
              }))}
              year={snapshot.month.year}
              month={snapshot.month.month}
              daysInMonth={snapshot.month.daysInMonth}
              today={snapshot.month.today}
            />
          </section>

          <section
            id="new-calendar-item"
            className="command-surface calendar-create-section"
          >
            <header>
              <h2>新增營銷事項</h2>
            </header>
            <form action={createCalendarItemAction}>
              <input type="hidden" name="returnPath" value={returnPath} />
              <label>
                <span>品牌</span>
                <select name="brandId" defaultValue="" required>
                  <option value="" disabled>
                    選擇品牌
                  </option>
                  {snapshot.brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>影響療程（可選）</span>
                <select
                  name="treatmentId"
                  defaultValue=""
                  disabled={!snapshot.treatmentLinkReady}
                >
                  <option value="">品牌整體／所有療程</option>
                  {snapshot.brands.map((brand) => {
                    const treatments = snapshot.treatments.filter(
                      (treatment) => treatment.brandId === brand.id
                    );
                    return treatments.length > 0 ? (
                      <optgroup key={brand.id} label={brand.name}>
                        {treatments.map((treatment) => (
                          <option key={treatment.id} value={treatment.id}>
                            {treatment.name}
                          </option>
                        ))}
                      </optgroup>
                    ) : null;
                  })}
                </select>
              </label>
              <label className="calendar-title-field">
                <span>事項名稱</span>
                <input name="title" placeholder="例如：DEP Reels 上線" required />
              </label>
              <label>
                <span>類型</span>
                <select name="itemType" defaultValue="post">
                  <option value="post">Post</option>
                  <option value="ad">廣告</option>
                  <option value="landing_page">Landing Page</option>
                  <option value="email">Email</option>
                  <option value="meeting">會議</option>
                  <option value="task">任務</option>
                </select>
              </label>
              <label>
                <span>渠道</span>
                <input name="channel" placeholder="IG / Meta / Google" />
              </label>
              <label>
                <span>日期</span>
                <input
                  type="date"
                  name="scheduledDate"
                  min={snapshot.month.monthStart}
                  max={snapshot.month.monthEnd}
                  defaultValue={createDefaultDate}
                  required
                />
              </label>
              <label>
                <span>時間</span>
                <input type="time" name="scheduledTime" />
              </label>
              <label>
                <span>狀態</span>
                <select name="status" defaultValue="planned">
                  <option value="idea">Idea</option>
                  <option value="planned">Planned</option>
                  <option value="in_progress">In progress</option>
                  <option value="review">Review</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="published">Published</option>
                  <option value="blocked">Blocked</option>
                </select>
              </label>
              <label>
                <span>負責人電郵</span>
                <input name="assigneeEmail" placeholder="name@alyssa.hk" />
              </label>
              <label className="calendar-notes-field">
                <span>備註</span>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="素材、審批或上線要求"
                />
              </label>
              <footer>
                <SubmitButton
                  className="command-primary-button"
                  disabled={!snapshot.schemaReady}
                  pendingLabel="加入中…"
                >
                  <CalendarPlus size={15} />
                  加入日曆
                </SubmitButton>
              </footer>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
