import { CalendarPlus, ChevronLeft, ChevronRight, Info, Link2, Sparkles } from "lucide-react";
import { createConnectedCalendarItemAction } from "@/app/calendar/actions";
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
                {snapshot.month.label} · 日曆日期代表 Due／出街日。Scheduled 事項到排定 HKT 時間會自動發布；同步工作可另設較早嘅 Start Day。
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
                <SubmitButton pendingLabel="載入中…">前往</SubmitButton>
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
              拖放更改日期；Scheduled 冇時間預設 12:00 HKT 發布
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
            <form action={createConnectedCalendarItemAction}>
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
                <span>Due／出街日期</span>
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
                <span>時間（可留空）</span>
                <input type="time" name="scheduledTime" />
                <small>Scheduled 如冇填時間，系統會喺該日 12:00 HKT 自動轉 Published。</small>
              </label>
              <label>
                <span>狀態</span>
                <select name="status" defaultValue="idea" data-testid="calendar-status-select">
                  <option value="idea">Idea</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="published">Published</option>
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

              <div className="calendar-notes-field grid gap-2 rounded-2xl border border-[#ead9cf] bg-[#fff9f3] p-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="flex items-start gap-2">
                  <input type="checkbox" name="showOnPerformanceTimeline" defaultChecked />
                  <span>
                    <b className="flex items-center gap-1"><Sparkles size={13} /> 成效時間線標記</b>
                    <small>Published 後會顯示喺成效圖表小點點，方便對照 Lead / Book / Show 變化。</small>
                  </span>
                </label>
                <label className="flex items-start gap-2">
                  <input type="checkbox" name="createTask" />
                  <span>
                    <b className="flex items-center gap-1"><Link2 size={13} /> 同步建立工作事項</b>
                    <small>建立 linked Weekly Task；工作列表跟 Start Day，日曆同出街仍跟 Due Day。</small>
                  </span>
                </label>
                <label>
                  <span>同步工作 Start Day</span>
                  <input
                    type="date"
                    name="taskStartDate"
                    defaultValue={createDefaultDate}
                  />
                  <small>決定工作出現喺邊一週；必須早過或等於 Due／出街日期。</small>
                </label>
                <label>
                  <span>同步工作 Start Time</span>
                  <input type="time" name="taskStartTime" />
                  <small>留空會於 Start Day 09:00 HKT 提醒。</small>
                </label>
                <label>
                  <span>同步工作 Priority</span>
                  <select name="taskPriority" defaultValue="normal">
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                  </select>
                </label>
              </div>
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
