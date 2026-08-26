import Link from "next/link";
import {
  Bell,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  Link2,
  ListTodo,
  MessageSquareText,
  Sparkles,
  UserRound,
} from "lucide-react";
import { AppNav } from "@/components/alyssa/AppNav";
import { SubmitButton } from "@/components/alyssa/SubmitButton";
import { TaskCreateForm } from "@/components/command-center/TaskCreateForm";
import { requireModuleAccess } from "@/lib/security/internalAccessServer";
import {
  getWorkTaskSnapshot,
  type WorkTaskRow,
  type WorkTaskStatus,
} from "@/lib/marketing/workTasks";
import {
  addWorkTaskCommentAction,
  addWorkTaskToCalendarAction,
  assignWorkTaskAction,
  markWorkNotificationReadAction,
  updateWorkTaskStatusAction,
} from "./actions";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function prettyDate(value: string | null) {
  if (!value) return "未設定";
  return new Intl.DateTimeFormat("zh-HK", {
    timeZone: "UTC",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function prettyDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

const columns: Array<{
  key: WorkTaskStatus;
  label: string;
  hint: string;
}> = [
  { key: "todo", label: "待辦", hint: "未開始 / 等待處理" },
  { key: "in_progress", label: "進行中", hint: "本週正在推進" },
  { key: "done", label: "完成", hint: "已交付 / 已完成" },
];

export default async function TasksPage({
  searchParams,
}: {
  searchParams?: Promise<{
    week?: string | string[];
    scope?: string | string[];
    brand?: string | string[];
    command_status?: string | string[];
    message?: string | string[];
  }>;
}) {
  await requireModuleAccess("calendar");
  const query = (await searchParams) ?? {};
  const requestedScope = firstParam(query.scope);
  const scope = requestedScope === "all" ? "all" : "mine";
  const brandId = firstParam(query.brand);
  const snapshot = await getWorkTaskSnapshot({
    week: firstParam(query.week),
    scope,
    brandId,
  });
  const effectiveScope = snapshot.currentMemberId ? scope : "all";
  const message = firstParam(query.message);
  const commandStatus = firstParam(query.command_status);
  const params = new URLSearchParams({
    week: snapshot.weekStart,
    scope: effectiveScope,
  });
  if (brandId) params.set("brand", brandId);
  const returnPath = `/tasks?${params.toString()}`;
  const prevParams = new URLSearchParams(params);
  prevParams.set("week", shiftDate(snapshot.weekStart, -7));
  const nextParams = new URLSearchParams(params);
  nextParams.set("week", shiftDate(snapshot.weekStart, 7));
  const thisWeekParams = new URLSearchParams(params);
  thisWeekParams.delete("week");

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="command-page">
        <div className="command-page-inner">
          <header className="command-page-header">
            <div>
              <p className="command-page-kicker">Connected Marketing Operations</p>
              <h1 className="command-page-title">工作事項</h1>
              <p className="command-page-subtitle">
                Weekly work、派 Job、營銷日曆、通知同成效里程碑共用同一套 Brand Access。重要工作完成後可以直接成為 Performance Timeline 嘅事件點。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/tasks?${prevParams.toString()}`} className="command-secondary-button"><ChevronLeft size={15} />前一週</Link>
              <Link href={`/tasks?${thisWeekParams.toString()}`} className="command-secondary-button">本週</Link>
              <Link href={`/tasks?${nextParams.toString()}`} className="command-secondary-button">下一週<ChevronRight size={15} /></Link>
            </div>
          </header>

          {message ? (
            <p className={`command-status-message ${commandStatus === "error" ? "is-error" : "is-success"}`}>
              {message}
            </p>
          ) : null}

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <article className="command-surface overflow-hidden">
              <header className="flex flex-col gap-3 border-b border-[#ead9cf] p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[#9a5d76]">Weekly Board</p>
                  <h2 className="mt-1 text-xl font-black text-[#321428]">
                    {prettyDate(snapshot.weekStart)} – {prettyDate(snapshot.weekEnd)}
                  </h2>
                </div>
                <form method="get" className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="week" value={snapshot.weekStart} />
                  <label className="grid gap-1">
                    <span className="text-[10px] font-black text-[#806174]">範圍</span>
                    <select name="scope" defaultValue={effectiveScope} className="rounded-xl border border-[#dfcdc4] bg-white px-3 py-2 text-xs font-bold text-[#4d2d40]">
                      {snapshot.currentMemberId ? <option value="mine">我的工作</option> : null}
                      <option value="all">全部工作</option>
                    </select>
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[10px] font-black text-[#806174]">品牌</span>
                    <select name="brand" defaultValue={brandId} className="rounded-xl border border-[#dfcdc4] bg-white px-3 py-2 text-xs font-bold text-[#4d2d40]">
                      <option value="">全部可用品牌</option>
                      {snapshot.brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
                    </select>
                  </label>
                  <SubmitButton className="command-secondary-button" pendingLabel="載入中…">查看</SubmitButton>
                </form>
              </header>
              <div className="grid gap-3 bg-[#fffdfb] p-4 lg:grid-cols-3" data-testid="weekly-task-board">
                {columns.map((column) => {
                  const items = snapshot.tasks.filter((task) => task.status === column.key);
                  return (
                    <section key={column.key} className="min-w-0 rounded-2xl border border-[#ead9cf] bg-[#fffaf6] p-3" data-task-column={column.key}>
                      <header className="mb-3 flex items-center justify-between gap-2">
                        <div>
                          <strong className="text-sm text-[#321428]">{column.label}</strong>
                          <p className="text-[10px] font-semibold text-[#9b7b8c]">{column.hint}</p>
                        </div>
                        <span className="grid h-7 min-w-7 place-items-center rounded-full bg-white px-2 text-xs font-black text-[#7c365f]">{items.length}</span>
                      </header>
                      <div className="grid gap-2.5">
                        {items.length ? items.map((task) => (
                          <TaskCard key={task.id} task={task} members={snapshot.members} returnPath={returnPath} />
                        )) : (
                          <div className="rounded-xl border border-dashed border-[#e2d4cc] bg-white/70 p-4 text-center text-xs font-semibold text-[#9b7b8c]">暫時冇工作</div>
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            </article>

            <aside className="command-surface h-fit overflow-hidden" data-testid="work-notification-center">
              <header className="flex items-center justify-between border-b border-[#ead9cf] p-4">
                <div className="flex items-center gap-2">
                  <Bell size={17} className="text-[#7c365f]" />
                  <div><strong className="text-sm text-[#321428]">通知</strong><p className="text-[10px] font-semibold text-[#9b7b8c]">派 Job、留言、發布狀態</p></div>
                </div>
                <span className="rounded-full bg-[#fff0f5] px-2 py-1 text-xs font-black text-[#7c365f]">{snapshot.unreadNotificationCount} 未讀</span>
              </header>
              <div className="grid max-h-[520px] gap-2 overflow-y-auto p-3">
                {snapshot.notifications.length ? snapshot.notifications.map((notification) => (
                  <article key={notification.id} className={`rounded-xl border p-3 ${notification.isRead ? "border-[#ead9cf] bg-white" : "border-[#d9a9bd] bg-[#fff7fa]"}`}>
                    <div className="flex items-start gap-2">
                      <CircleDot size={14} className="mt-0.5 shrink-0 text-[#9a5d76]" />
                      <div className="min-w-0 flex-1">
                        <strong className="block text-xs text-[#321428]">{notification.title}</strong>
                        {notification.body ? <p className="mt-1 text-[11px] font-semibold leading-4 text-[#7d6170]">{notification.body}</p> : null}
                        <small className="mt-1 block text-[10px] text-[#9b7b8c]">{prettyDateTime(notification.createdAt)}</small>
                      </div>
                    </div>
                    {!notification.isRead ? (
                      <form action={markWorkNotificationReadAction} className="mt-2 text-right">
                        <input type="hidden" name="notificationId" value={notification.id} />
                        <input type="hidden" name="returnPath" value={returnPath} />
                        <button className="text-[10px] font-black text-[#7c365f]">標記已讀</button>
                      </form>
                    ) : null}
                  </article>
                )) : <p className="p-4 text-center text-xs font-semibold text-[#9b7b8c]">暫時冇通知</p>}
              </div>
            </aside>
          </section>

          <section className="command-surface mt-4 overflow-hidden">
            <header className="flex items-center gap-3 border-b border-[#ead9cf] p-5">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#fff0f5] text-[#7c365f]"><ListTodo size={19} /></span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#9a5d76]">New work</p>
                <h2 className="text-lg font-black text-[#321428]">新增／派工作</h2>
              </div>
            </header>
            <div className="p-5">
              {snapshot.canManage && snapshot.brands.length ? (
                <TaskCreateForm brands={snapshot.brands} members={snapshot.members} returnPath={returnPath} />
              ) : (
                <p className="text-sm font-semibold text-[#806174]">目前冇可用品牌或未有編輯權限。</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function TaskCard({
  task,
  members,
  returnPath,
}: {
  task: WorkTaskRow;
  members: Awaited<ReturnType<typeof getWorkTaskSnapshot>>["members"];
  returnPath: string;
}) {
  const eligibleMembers = members.filter((member) => member.isMaster || member.brandIds.includes(task.brandId));
  const priorityLabel = task.priority === "high" ? "High" : task.priority === "low" ? "Low" : "Normal";
  return (
    <article className="rounded-2xl border border-[#ead9cf] bg-white p-3 shadow-[0_7px_18px_rgba(90,35,72,0.04)]" data-task-id={task.id}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1 text-[10px] font-black" style={{ color: task.brandColor }}><i className="h-2 w-2 rounded-full" style={{ backgroundColor: task.brandColor }} />{task.brandName}</span>
          <strong className="mt-1 block text-sm leading-5 text-[#321428]">{task.title}</strong>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black ${task.priority === "high" ? "bg-[#fff0ef] text-[#a14d45]" : task.priority === "low" ? "bg-[#f0f4f8] text-[#617285]" : "bg-[#fff6e9] text-[#8a632b]"}`}>{priorityLabel}</span>
      </div>
      {task.description ? <p className="mt-2 line-clamp-3 text-[11px] font-semibold leading-4 text-[#7d6170]">{task.description}</p> : null}
      <div className="mt-3 grid gap-1.5 text-[10px] font-bold text-[#806174]">
        <span className="flex items-center gap-1.5"><CalendarDays size={12} />{prettyDate(task.dueDate)}{task.dueTime ? ` · ${task.dueTime.slice(0, 5)}` : ""}</span>
        <span className="flex items-center gap-1.5"><UserRound size={12} />{task.assigneeName || task.assigneeEmail || "未指派"}</span>
        {task.performanceMarker ? <span className="flex items-center gap-1.5 text-[#7c365f]"><Sparkles size={12} />成效里程碑</span> : null}
      </div>
      {task.calendarLinks.length ? (
        <div className="mt-2 grid gap-1">
          {task.calendarLinks.map((link) => (
            <Link key={link.id} href={`/calendar?month=${link.scheduledDate.slice(0, 7)}-01`} className="flex items-center gap-1 rounded-lg bg-[#f3f7fb] px-2 py-1 text-[10px] font-bold text-[#53677e]">
              <Link2 size={10} /> 日曆：{link.title} · {link.status}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="mt-3 grid gap-2 border-t border-[#f0e5df] pt-3">
        <form action={updateWorkTaskStatusAction} className="flex gap-1.5">
          <input type="hidden" name="taskId" value={task.id} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <select name="status" defaultValue={task.status} className="min-w-0 flex-1 rounded-lg border border-[#e2d4cc] bg-white px-2 py-1.5 text-[10px] font-black text-[#5f4253]">
            <option value="todo">待辦</option><option value="in_progress">進行中</option><option value="done">完成</option>
          </select>
          <button className="rounded-lg border border-[#e2d4cc] px-2 text-[10px] font-black text-[#7c365f]">更新</button>
        </form>
        <form action={assignWorkTaskAction} className="flex gap-1.5">
          <input type="hidden" name="taskId" value={task.id} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <select name="assigneeMemberId" defaultValue={task.assigneeMemberId || ""} className="min-w-0 flex-1 rounded-lg border border-[#e2d4cc] bg-white px-2 py-1.5 text-[10px] font-bold text-[#5f4253]">
            <option value="">未指派</option>
            {eligibleMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
          <button className="rounded-lg border border-[#e2d4cc] px-2 text-[10px] font-black text-[#7c365f]">派 Job</button>
        </form>
        {!task.calendarLinks.length && task.dueDate ? (
          <form action={addWorkTaskToCalendarAction}>
            <input type="hidden" name="taskId" value={task.id} />
            <input type="hidden" name="returnPath" value={returnPath} />
            <button className="flex w-full items-center justify-center gap-1 rounded-lg bg-[#f4f7fb] px-2 py-1.5 text-[10px] font-black text-[#53677e]"><CalendarCheck2 size={11} />加入營銷日曆</button>
          </form>
        ) : null}
      </div>

      <details className="mt-2 rounded-xl bg-[#fffaf6] p-2">
        <summary className="cursor-pointer text-[10px] font-black text-[#7c365f]"><MessageSquareText size={11} className="mr-1 inline" />留言 / 更新 ({task.comments.length})</summary>
        <div className="mt-2 grid gap-2">
          {task.comments.map((comment) => (
            <div key={comment.id} className="rounded-lg bg-white p-2 text-[10px] leading-4 text-[#6c4d60]"><b>{comment.authorEmail || "Team"}</b><p>{comment.body}</p><small className="text-[#9b7b8c]">{prettyDateTime(comment.createdAt)}</small></div>
          ))}
          <form action={addWorkTaskCommentAction} className="grid gap-1">
            <input type="hidden" name="taskId" value={task.id} />
            <input type="hidden" name="returnPath" value={returnPath} />
            <textarea name="body" required maxLength={2000} rows={2} placeholder="新增留言…" className="rounded-lg border border-[#e2d4cc] bg-white p-2 text-[10px] font-semibold outline-none" />
            <button className="justify-self-end text-[10px] font-black text-[#7c365f]">送出留言</button>
          </form>
        </div>
      </details>
    </article>
  );
}
