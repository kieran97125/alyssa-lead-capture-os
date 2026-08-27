import Link from "next/link";
import {
  Bell,
  CalendarCheck2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDot,
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

const groups: Array<{
  key: WorkTaskStatus;
  label: string;
  hint: string;
  accent: string;
  soft: string;
}> = [
  { key: "todo", label: "待辦", hint: "未開始 / 等待處理", accent: "#8E5A76", soft: "#FFF5F9" },
  { key: "in_progress", label: "進行中", hint: "本週正在推進", accent: "#D2913F", soft: "#FFF8ED" },
  { key: "done", label: "完成", hint: "已交付 / 已完成", accent: "#4F9070", soft: "#F2FAF6" },
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
  const snapshot = await getWorkTaskSnapshot({ week: firstParam(query.week), scope, brandId });
  const effectiveScope = snapshot.currentMemberId ? scope : "all";
  const message = firstParam(query.message);
  const commandStatus = firstParam(query.command_status);
  const params = new URLSearchParams({ week: snapshot.weekStart, scope: effectiveScope });
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
                用列項方式集中睇工作、負責人、狀態、期限同品牌；操作邏輯更接近 Monday，減少大卡片造成嘅視線跳動。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/tasks?${prevParams.toString()}`} className="command-secondary-button"><ChevronLeft size={15} />前一週</Link>
              <Link href={`/tasks?${thisWeekParams.toString()}`} className="command-secondary-button">本週</Link>
              <Link href={`/tasks?${nextParams.toString()}`} className="command-secondary-button">下一週<ChevronRight size={15} /></Link>
            </div>
          </header>

          {message ? (
            <p className={`command-status-message ${commandStatus === "error" ? "is-error" : "is-success"}`}>{message}</p>
          ) : null}

          <section className="command-surface overflow-hidden">
            <header className="flex flex-col gap-4 border-b border-[#ead9cf] p-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#9a5d76]">Weekly Work List</p>
                <h2 className="mt-1 text-xl font-black text-[#321428]">{prettyDate(snapshot.weekStart)} – {prettyDate(snapshot.weekEnd)}</h2>
                <p className="mt-1 text-xs font-semibold text-[#8b7180]">{snapshot.tasks.length} 項工作 · 按狀態分組，欄位橫向對齊</p>
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

            <div className="grid gap-5 bg-[#fffdfb] p-4 sm:p-5" data-testid="weekly-task-board" data-layout="list">
              {groups.map((group) => {
                const items = snapshot.tasks.filter((task) => task.status === group.key);
                return <TaskGroup key={group.key} group={group} items={items} members={snapshot.members} returnPath={returnPath} />;
              })}
            </div>
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="command-surface overflow-hidden">
              <header className="flex items-center gap-3 border-b border-[#ead9cf] p-5">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#fff0f5] text-[#7c365f]"><ListTodo size={19} /></span>
                <div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#9a5d76]">New work</p><h2 className="text-lg font-black text-[#321428]">新增／派工作</h2></div>
              </header>
              <div className="p-5">
                {snapshot.canManage && snapshot.brands.length ? <TaskCreateForm brands={snapshot.brands} members={snapshot.members} returnPath={returnPath} /> : <p className="text-sm font-semibold text-[#806174]">目前冇可用品牌或未有編輯權限。</p>}
              </div>
            </section>

            <aside className="command-surface h-fit overflow-hidden" data-testid="work-notification-center">
              <header className="flex items-center justify-between border-b border-[#ead9cf] p-4">
                <div className="flex items-center gap-2"><Bell size={17} className="text-[#7c365f]" /><div><strong className="text-sm text-[#321428]">通知</strong><p className="text-[10px] font-semibold text-[#9b7b8c]">派 Job、留言、發布狀態</p></div></div>
                <span className="rounded-full bg-[#fff0f5] px-2 py-1 text-xs font-black text-[#7c365f]">{snapshot.unreadNotificationCount} 未讀</span>
              </header>
              <div className="grid max-h-[420px] gap-2 overflow-y-auto p-3">
                {snapshot.notifications.length ? snapshot.notifications.map((notification) => (
                  <article key={notification.id} className={`rounded-xl border p-3 ${notification.isRead ? "border-[#ead9cf] bg-white" : "border-[#d9a9bd] bg-[#fff7fa]"}`}>
                    <div className="flex items-start gap-2"><CircleDot size={14} className="mt-0.5 shrink-0 text-[#9a5d76]" /><div className="min-w-0 flex-1"><strong className="block text-xs text-[#321428]">{notification.title}</strong>{notification.body ? <p className="mt-1 text-[11px] font-semibold leading-4 text-[#7d6170]">{notification.body}</p> : null}<small className="mt-1 block text-[10px] text-[#9b7b8c]">{prettyDateTime(notification.createdAt)}</small></div></div>
                    {!notification.isRead ? <form action={markWorkNotificationReadAction} className="mt-2 text-right"><input type="hidden" name="notificationId" value={notification.id} /><input type="hidden" name="returnPath" value={returnPath} /><button className="text-[10px] font-black text-[#7c365f]">標記已讀</button></form> : null}
                  </article>
                )) : <p className="p-4 text-center text-xs font-semibold text-[#9b7b8c]">暫時冇通知</p>}
              </div>
            </aside>
          </section>
        </div>
      </div>
    </main>
  );
}

function TaskGroup({ group, items, members, returnPath }: { group: (typeof groups)[number]; items: WorkTaskRow[]; members: Awaited<ReturnType<typeof getWorkTaskSnapshot>>["members"]; returnPath: string; }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#e8dcd5] bg-white shadow-[0_8px_24px_rgba(90,35,72,0.035)]" data-task-column={group.key}>
      <header className="flex items-center gap-3 border-b border-[#eee3dd] px-4 py-3" style={{ backgroundColor: group.soft }}>
        <span className="h-8 w-1 rounded-full" style={{ backgroundColor: group.accent }} />
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-[#321428]">{group.label}</strong><span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black" style={{ color: group.accent }}>{items.length}</span></div><p className="mt-0.5 text-[10px] font-semibold text-[#9b7b8c]">{group.hint}</p></div>
      </header>
      <div className="overflow-x-auto"><div className="min-w-[1040px]">
        <div className="grid grid-cols-[minmax(260px,1.8fr)_160px_160px_130px_140px_90px_115px_76px] border-b border-[#eee3dd] bg-[#fbf9f7] text-[10px] font-black uppercase tracking-[0.06em] text-[#9a7a8a]">
          <span className="px-4 py-2.5">工作事項</span><span className="border-l border-[#eee3dd] px-3 py-2.5">負責人</span><span className="border-l border-[#eee3dd] px-3 py-2.5">狀態</span><span className="border-l border-[#eee3dd] px-3 py-2.5">期限</span><span className="border-l border-[#eee3dd] px-3 py-2.5">品牌</span><span className="border-l border-[#eee3dd] px-3 py-2.5">Priority</span><span className="border-l border-[#eee3dd] px-3 py-2.5">日曆</span><span className="border-l border-[#eee3dd] px-3 py-2.5 text-center">更新</span>
        </div>
        {items.length ? items.map((task) => <TaskRow key={task.id} task={task} members={members} returnPath={returnPath} />) : <div className="px-4 py-5 text-center text-xs font-semibold text-[#9b7b8c]">暫時冇工作</div>}
      </div></div>
    </section>
  );
}

function TaskRow({ task, members, returnPath }: { task: WorkTaskRow; members: Awaited<ReturnType<typeof getWorkTaskSnapshot>>["members"]; returnPath: string; }) {
  const eligibleMembers = members.filter((member) => member.isMaster || member.brandIds.includes(task.brandId));
  const priorityLabel = task.priority === "high" ? "High" : task.priority === "low" ? "Low" : "Normal";
  const statusTone = task.status === "done" ? "bg-[#eaf7ef] text-[#3d7f5e]" : task.status === "in_progress" ? "bg-[#fff3df] text-[#9a6727]" : "bg-[#f8edf4] text-[#7c365f]";

  return (
    <article className="border-b border-[#f0e7e2] last:border-b-0" data-task-id={task.id}>
      <div className="grid grid-cols-[minmax(260px,1.8fr)_160px_160px_130px_140px_90px_115px_76px] items-stretch text-[11px] text-[#5e4655]">
        <div className="min-w-0 px-4 py-3">
          <details className="group"><summary className="cursor-pointer list-none"><div className="flex items-start gap-2"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: task.brandColor }} /><div className="min-w-0"><strong className="block truncate text-[12px] leading-5 text-[#321428]">{task.title}</strong>{task.description ? <span className="mt-0.5 block truncate text-[10px] font-semibold text-[#9a7a8a]">{task.description}</span> : null}</div></div></summary>
            <div className="mt-3 ml-4 grid gap-2 rounded-xl border border-[#eee3dd] bg-[#fffaf7] p-3">{task.description ? <p className="text-[11px] font-semibold leading-5 text-[#6f5364]">{task.description}</p> : null}{task.performanceMarker ? <span className="flex items-center gap-1.5 text-[10px] font-black text-[#7c365f]"><Sparkles size={12} />成效里程碑</span> : null}{task.calendarLinks.length ? task.calendarLinks.map((link) => <Link key={link.id} href={`/calendar?month=${link.scheduledDate.slice(0, 7)}-01`} className="flex items-center gap-1 text-[10px] font-black text-[#53677e]"><Link2 size={11} />{link.title} · {link.status}</Link>) : null}
              <div className="border-t border-[#eee3dd] pt-2"><strong className="text-[10px] text-[#7c365f]"><MessageSquareText size={11} className="mr-1 inline" />留言 / 更新 ({task.comments.length})</strong><div className="mt-2 grid gap-1.5">{task.comments.map((comment) => <div key={comment.id} className="rounded-lg bg-white p-2 text-[10px] leading-4 text-[#6c4d60]"><b>{comment.authorEmail || "Team"}</b><p>{comment.body}</p><small className="text-[#9b7b8c]">{prettyDateTime(comment.createdAt)}</small></div>)}<form action={addWorkTaskCommentAction} className="flex gap-2"><input type="hidden" name="taskId" value={task.id} /><input type="hidden" name="returnPath" value={returnPath} /><input name="body" required maxLength={2000} placeholder="新增留言…" className="min-w-0 flex-1 rounded-lg border border-[#e2d4cc] bg-white px-2 py-1.5 text-[10px] font-semibold outline-none" /><button className="rounded-lg border border-[#e2d4cc] px-2 text-[10px] font-black text-[#7c365f]">送出</button></form></div></div>
            </div>
          </details>
        </div>

        <div className="flex items-center border-l border-[#f0e7e2] px-2 py-2">
          <form action={assignWorkTaskAction} className="flex w-full gap-1" data-testid="task-assignee-form">
            <input type="hidden" name="taskId" value={task.id} /><input type="hidden" name="returnPath" value={returnPath} />
            <select name="assigneeMemberId" defaultValue={task.assigneeMemberId || ""} className="min-w-0 flex-1 rounded-lg border border-[#e5d8d1] bg-white px-2 py-1.5 text-[10px] font-bold text-[#5f4253]"><option value="">未指派</option>{eligibleMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select>
            <button className="shrink-0 rounded-lg border border-[#e5d8d1] bg-white px-2 py-1.5 text-[9px] font-black text-[#7c365f]">派</button>
          </form>
        </div>

        <div className="flex items-center border-l border-[#f0e7e2] px-2 py-2">
          <form action={updateWorkTaskStatusAction} className="flex w-full gap-1" data-testid="task-status-form">
            <input type="hidden" name="taskId" value={task.id} /><input type="hidden" name="returnPath" value={returnPath} />
            <select name="status" defaultValue={task.status} className={`min-w-0 flex-1 rounded-lg border-0 px-2 py-1.5 text-[10px] font-black outline-none ${statusTone}`}><option value="todo">待辦</option><option value="in_progress">進行中</option><option value="done">完成</option></select>
            <button className="shrink-0 rounded-lg border border-[#e5d8d1] bg-white px-2 py-1.5 text-[9px] font-black text-[#7c365f]">更新</button>
          </form>
        </div>

        <div className="flex items-center border-l border-[#f0e7e2] px-3 py-2 font-bold text-[#6e5463]"><CalendarDays size={12} className="mr-1.5 shrink-0 text-[#9a7a8a]" /><span>{prettyDate(task.dueDate)}{task.dueTime ? <><br />{task.dueTime.slice(0, 5)}</> : null}</span></div>
        <div className="flex min-w-0 items-center gap-2 border-l border-[#f0e7e2] px-3 py-2"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: task.brandColor }} /><span className="truncate font-bold" style={{ color: task.brandColor }}>{task.brandName}</span></div>
        <div className="flex items-center border-l border-[#f0e7e2] px-3 py-2"><span className={`rounded-full px-2 py-1 text-[9px] font-black ${task.priority === "high" ? "bg-[#fff0ef] text-[#a14d45]" : task.priority === "low" ? "bg-[#f0f4f8] text-[#617285]" : "bg-[#fff6e9] text-[#8a632b]"}`}>{priorityLabel}</span></div>
        <div className="flex items-center justify-center border-l border-[#f0e7e2] px-2 py-2">{task.calendarLinks.length ? <Link href={`/calendar?month=${task.calendarLinks[0].scheduledDate.slice(0, 7)}-01`} className="inline-flex items-center gap-1 rounded-lg bg-[#eef4fa] px-2 py-1.5 text-[9px] font-black text-[#53677e]"><Link2 size={10} />已連結</Link> : task.dueDate ? <form action={addWorkTaskToCalendarAction}><input type="hidden" name="taskId" value={task.id} /><input type="hidden" name="returnPath" value={returnPath} /><button className="inline-flex items-center gap-1 rounded-lg bg-[#f4f7fb] px-2 py-1.5 text-[9px] font-black text-[#53677e]"><CalendarCheck2 size={10} />加入</button></form> : <span className="text-[9px] font-bold text-[#b09ca7]">—</span>}</div>
        <div className="flex items-center justify-center border-l border-[#f0e7e2] px-2 py-2"><span className="inline-flex min-w-7 items-center justify-center rounded-full bg-[#fff4f8] px-2 py-1 text-[9px] font-black text-[#7c365f]"><MessageSquareText size={10} className="mr-1" />{task.comments.length}</span></div>
      </div>
    </article>
  );
}
