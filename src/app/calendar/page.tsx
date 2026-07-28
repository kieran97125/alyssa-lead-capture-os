import { CalendarPlus, Info } from "lucide-react";
import { createCalendarItemAction } from "@/app/command-center/actions";
import { AppNav } from "@/components/alyssa/AppNav";
import { MarketingCalendarBoard } from "@/components/command-center/MarketingCalendarBoard";
import { getCommandCenterSnapshot } from "@/lib/marketing/commandCenter";

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
  }>;
}) {
  const [snapshot, query] = await Promise.all([
    getCommandCenterSnapshot(),
    searchParams,
  ]);
  const message = firstParam(query?.message);
  const status = firstParam(query?.command_status);

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="command-page">
        <div className="command-page-inner">
          <header className="command-page-header">
            <div>
              <p className="command-page-kicker">Campaign Operations</p>
              <h1 className="command-page-title">營銷日曆</h1>
              <p className="command-page-subtitle">
                {snapshot.month.label} · 用品牌色分辨 Post、廣告、Landing Page
                同營運事項。可用滑鼠或鍵盤拖放到其他日期。
              </p>
            </div>
            <a href="#new-calendar-item" className="command-primary-button">
              <CalendarPlus size={16} />
              新增事項
            </a>
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
          {!snapshot.schemaReady ? (
            <p className="command-status-message">
              Migration 尚未套用；拖放及新增功能會喺正式套用後啟用。
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
              拖放後會立即寫入日期及 Audit Log
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
              <p>New item</p>
              <h2>新增營銷事項</h2>
            </header>
            <form action={createCalendarItemAction}>
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
                  defaultValue={snapshot.month.today}
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
                <button
                  type="submit"
                  className="command-primary-button"
                  disabled={!snapshot.schemaReady}
                >
                  <CalendarPlus size={15} />
                  加入日曆
                </button>
              </footer>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
