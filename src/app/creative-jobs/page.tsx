import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  Filter,
  ImagePlus,
  Layers3,
  ListFilter,
  Palette,
  Plus,
  Settings2,
  Sparkles,
  UserRound,
} from "lucide-react";
import { AppNav } from "@/components/alyssa/AppNav";
import { SubmitButton } from "@/components/alyssa/SubmitButton";
import { DesktopNotificationControl } from "@/components/command-center/DesktopNotificationControl";
import { requireModuleAccess } from "@/lib/security/internalAccessServer";
import { getCreativeListSnapshot } from "@/lib/creative/store";
import {
  creativeJobStatusLabels,
  creativeJobStatuses,
  creativePriorities,
  creativePriorityLabels,
} from "@/lib/creative/types";
import { createCreativeDraftAction } from "./actions";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

function prettyDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-HK", {
    timeZone: "UTC",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function viewHref(
  current: Record<string, string>,
  view: string
) {
  const params = new URLSearchParams(current);
  if (view) params.set("view", view);
  else params.delete("view");
  return `/creative-jobs${params.size ? `?${params.toString()}` : ""}`;
}

export default async function CreativeJobsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    scope?: string | string[];
    brand?: string | string[];
    status?: string | string[];
    priority?: string | string[];
    designer?: string | string[];
    view?: string | string[];
    creative_status?: string | string[];
    creative_message?: string | string[];
  }>;
}) {
  const moduleAccess = await requireModuleAccess("creative_jobs");
  if (!moduleAccess.allowed) {
    return (
      <main className="alyssa-shell">
        <AppNav access={moduleAccess.access} />
        <div className="command-page">
          <div className="command-page-inner">
            <section className="command-surface p-8 text-center">
              <Palette className="mx-auto text-[#9a5d76]" size={28} />
              <h1 className="mt-3 text-xl font-black text-[#321428]">
                你未獲授權使用設計工作
              </h1>
              <p className="mt-2 text-sm font-semibold text-[#806174]">
                系統擁有人可以喺「成員及權限」為你開啟設計工作模組。
              </p>
            </section>
          </div>
        </div>
      </main>
    );
  }

  const query = (await searchParams) ?? {};
  const filters = {
    scope: firstParam(query.scope) === "mine" ? ("mine" as const) : ("all" as const),
    brandId: firstParam(query.brand),
    status: firstParam(query.status),
    priority: firstParam(query.priority),
    designerId: firstParam(query.designer),
    view: firstParam(query.view),
  };
  const snapshot = await getCreativeListSnapshot(filters);
  const currentParams: Record<string, string> = {};
  if (filters.scope === "mine") currentParams.scope = "mine";
  if (filters.brandId) currentParams.brand = filters.brandId;
  if (filters.status) currentParams.status = filters.status;
  if (filters.priority) currentParams.priority = filters.priority;
  if (filters.designerId) currentParams.designer = filters.designerId;
  const message = firstParam(query.creative_message);
  const commandStatus = firstParam(query.creative_status);

  const quickViews = [
    { value: "", label: "全部進行中", count: snapshot.stats.open, icon: Layers3 },
    { value: "waiting", label: "等素材", count: snapshot.stats.waiting, icon: Clock3 },
    { value: "review", label: "待 Review／修改", count: snapshot.stats.review, icon: Sparkles },
    { value: "overdue", label: "已逾期", count: snapshot.stats.overdue, icon: AlertTriangle },
    { value: "publish", label: "即將出街", count: null, icon: CalendarCheck2 },
    { value: "completed", label: "已完成", count: null, icon: CheckCircle2 },
  ];

  return (
    <main className="alyssa-shell">
      <AppNav access={moduleAccess.access} />
      <div className="command-page">
        <div className="command-page-inner !max-w-[1720px]">
          <header className="command-page-header">
            <div>
              <p className="command-page-kicker">Creative production</p>
              <h1 className="command-page-title">設計工作</h1>
              <p className="command-page-subtitle">
                Marketer 派 Job 畀 Designer；Job List 跟 Start Day，截止跟 Due Day，勾選同步後出街及營銷日曆跟 Publish Day。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {snapshot.canManageSettings ? (
                <Link href="/settings/creative" className="command-secondary-button">
                  <Settings2 size={15} /> 分類及 Designer
                </Link>
              ) : null}
              {snapshot.canCreate ? (
                <form action={createCreativeDraftAction}>
                  <input
                    type="hidden"
                    name="brandId"
                    value={filters.brandId || snapshot.brands[0]?.id || ""}
                  />
                  <SubmitButton
                    className="command-primary-button"
                    pendingLabel="建立中…"
                  >
                    <Plus size={16} /> 新增設計 Job
                  </SubmitButton>
                </form>
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

          {!snapshot.schemaReady ? (
            <section className="command-surface p-8 text-center">
              <AlertTriangle className="mx-auto text-[#a43b50]" size={28} />
              <h2 className="mt-3 text-lg font-black">Creative Studio Database 尚未完成設定</h2>
              <p className="mt-2 text-sm font-semibold text-[#806174]">
                頁面已準備好，但要先套用 Creative Production migration。
              </p>
            </section>
          ) : (
            <>
              <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="設計工作快速檢視">
                {quickViews.map((view) => {
                  const Icon = view.icon;
                  const active = filters.view === view.value;
                  return (
                    <Link
                      key={view.value || "open"}
                      href={viewHref(currentParams, view.value)}
                      className={`rounded-2xl border p-4 transition ${
                        active
                          ? "border-[#7c365f] bg-[#5a2348] text-white shadow-[0_12px_30px_rgba(90,35,72,0.16)]"
                          : "border-[#e8dcd5] bg-white text-[#321428] hover:border-[#cfaebe]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Icon size={17} />
                        {view.count !== null ? (
                          <strong className="text-xl">{view.count}</strong>
                        ) : null}
                      </div>
                      <span className={`mt-3 block text-[11px] font-black ${active ? "text-white" : "text-[#6d4a5c]"}`}>
                        {view.label}
                      </span>
                    </Link>
                  );
                })}
              </section>

              <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
                <div className="min-w-0">
                  <section className="command-surface overflow-hidden">
                    <header className="flex flex-col gap-3 border-b border-[#ead9cf] p-4 lg:flex-row lg:items-end lg:justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#9a5d76]">
                          Job list
                        </p>
                        <h2 className="mt-1 text-lg font-black">
                          {snapshot.jobs.length} 項設計工作
                        </h2>
                        <p className="mt-1 text-[11px] font-semibold text-[#806174]">
                          同日工作先按緊急／優先排序，再按 Start Day 及 Due Day 排列。
                        </p>
                      </div>
                      <form method="get" className="flex flex-wrap items-end gap-2">
                        <input type="hidden" name="view" value={filters.view} />
                        <FilterSelect
                          label="範圍"
                          name="scope"
                          value={filters.scope}
                          options={[
                            ["all", "全部工作"],
                            ["mine", "與我有關"],
                          ]}
                        />
                        <FilterSelect
                          label="品牌"
                          name="brand"
                          value={filters.brandId}
                          options={[
                            ["", "全部品牌"],
                            ...snapshot.brands.map((brand) => [brand.id, brand.name] as [string, string]),
                          ]}
                        />
                        <FilterSelect
                          label="Designer"
                          name="designer"
                          value={filters.designerId}
                          options={[
                            ["", "全部 Designer"],
                            ...snapshot.designers.map((designer) => [designer.id, designer.displayName] as [string, string]),
                          ]}
                        />
                        <FilterSelect
                          label="狀態"
                          name="status"
                          value={filters.status}
                          options={[
                            ["", "全部狀態"],
                            ...creativeJobStatuses.map((status) => [status, creativeJobStatusLabels[status]] as [string, string]),
                          ]}
                        />
                        <FilterSelect
                          label="優先級"
                          name="priority"
                          value={filters.priority}
                          options={[
                            ["", "全部"],
                            ...creativePriorities.map((priority) => [priority, creativePriorityLabels[priority]] as [string, string]),
                          ]}
                        />
                        <SubmitButton
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#5a2348] px-3 text-[10px] font-black text-white"
                          pendingLabel="載入中…"
                        >
                          <Filter size={13} /> 套用
                        </SubmitButton>
                      </form>
                    </header>

                    {snapshot.jobs.length ? (
                      <div className="overflow-x-auto">
                        <div className="min-w-[1320px]">
                          <div className="grid grid-cols-[minmax(270px,1.9fr)_130px_120px_150px_120px_140px_90px_115px_115px_130px_120px] border-b border-[#eee3dd] bg-[#fbf9f7] px-4 py-2.5 text-[9px] font-black uppercase tracking-[0.06em] text-[#806174]">
                            <span>Job</span>
                            <span>品牌</span>
                            <span>Designer</span>
                            <span>Source</span>
                            <span>用途</span>
                            <span>媒體格式</span>
                            <span>優先</span>
                            <span>Start</span>
                            <span>Due</span>
                            <span>出街／日曆</span>
                            <span>狀態</span>
                          </div>
                          {snapshot.jobs.map((job) => (
                            <Link
                              key={job.id}
                              href={`/creative-jobs/${job.id}`}
                              className="grid grid-cols-[minmax(270px,1.9fr)_130px_120px_150px_120px_140px_90px_115px_115px_130px_120px] items-center border-b border-[#f0e7e2] px-4 py-3 text-[11px] font-semibold transition last:border-b-0 hover:bg-[#fff9fb]"
                            >
                              <span className="min-w-0 pr-3">
                                <strong className="block truncate text-xs text-[#321428]">
                                  {job.title}
                                </strong>
                                <small className="mt-1 block text-[9px] font-bold text-[#927987]">
                                  {job.quantity} 件 · {job.workload} workload
                                  {job.materialStatus === "waiting" ? " · 等素材" : ""}
                                </small>
                              </span>
                              <span className="truncate font-black text-[#6d4a5c]">
                                {job.brandName}
                              </span>
                              <span className="truncate">
                                {job.assigneeProfileName || "未派"}
                              </span>
                              <span className="truncate">{job.sourceName || "—"}</span>
                              <span className="truncate">{job.usageName || "—"}</span>
                              <span className="truncate">{job.mediaFormatName || "—"}</span>
                              <span>
                                <PriorityBadge value={job.priority} />
                              </span>
                              <span>{prettyDate(job.startDate)}</span>
                              <span className={job.dueDate && job.dueDate < snapshot.today && !["completed", "cancelled"].includes(job.status) ? "font-black text-[#a43b50]" : ""}>
                                {prettyDate(job.dueDate)}
                              </span>
                              <span>
                                {job.syncCalendar ? (
                                  <span className="inline-flex items-center gap-1 font-bold text-[#53677e]">
                                    <CalendarCheck2 size={12} /> {prettyDate(job.publishDate)}
                                  </span>
                                ) : (
                                  <span className="text-[#927987]">不同步</span>
                                )}
                              </span>
                              <span>
                                <StatusBadge status={job.status} />
                              </span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="p-12 text-center">
                        <ImagePlus className="mx-auto text-[#a17b8d]" size={28} />
                        <h3 className="mt-3 text-sm font-black">暫時冇符合條件嘅設計工作</h3>
                        <p className="mt-1 text-xs font-semibold text-[#806174]">
                          Marketer 可以按右上角「新增設計 Job」開始派工作。
                        </p>
                      </div>
                    )}
                  </section>
                </div>

                <aside className="grid h-fit gap-4 xl:sticky xl:top-5">
                  <section className="command-surface overflow-hidden">
                    <header className="border-b border-[#ead9cf] bg-[#fffaf7] p-4">
                      <div className="flex items-center gap-2">
                        <ListFilter size={16} className="text-[#7c365f]" />
                        <div>
                          <strong className="block text-xs">派 Job 規則</strong>
                          <small className="text-[10px] font-semibold text-[#806174]">
                            三個日期各有明確用途
                          </small>
                        </div>
                      </div>
                    </header>
                    <div className="grid gap-3 p-4 text-[10px] font-semibold leading-4 text-[#6d4a5c]">
                      <Rule icon={Clock3} title="Start Day">
                        預設香港今日，可改；決定 Job List 顯示及開始提醒。
                      </Rule>
                      <Rule icon={AlertTriangle} title="Due Day">
                        Designer 交稿截止；控制 24 小時提醒同逾期。
                      </Rule>
                      <Rule icon={CalendarCheck2} title="Publish Day">
                        只有勾選同步日曆先啟用；決定實際出街日期。
                      </Rule>
                    </div>
                  </section>
                  <DesktopNotificationControl />
                </aside>
              </section>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function FilterSelect({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value: string;
  options: Array<[string, string]>;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-[9px] font-black text-[#806174]">{label}</span>
      <select
        name={name}
        defaultValue={value}
        className="h-9 rounded-xl border border-[#dfcdc4] bg-white px-2.5 text-[10px] font-bold text-[#4d2d40]"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={`${name}-${optionValue || "all"}`} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function PriorityBadge({ value }: { value: "normal" | "priority" | "urgent" }) {
  const styles = {
    normal: "bg-[#f5f1ef] text-[#806174]",
    priority: "bg-[#fff7e8] text-[#94611f]",
    urgent: "bg-[#fff0ef] text-[#a43b50]",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-[9px] font-black ${styles[value]}`}>
      {creativePriorityLabels[value]}
    </span>
  );
}

function StatusBadge({ status }: { status: keyof typeof creativeJobStatusLabels }) {
  const active = ["review", "revision", "blocked"].includes(status);
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-[9px] font-black ${
        active
          ? "bg-[#fff0f5] text-[#7c365f]"
          : status === "completed"
            ? "bg-[#eef8f3] text-[#3f7f5f]"
            : "bg-[#f5f1ef] text-[#6d4a5c]"
      }`}
    >
      {creativeJobStatusLabels[status]}
    </span>
  );
}

function Rule({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Clock3;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-2.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#fff0f5] text-[#7c365f]">
        <Icon size={14} />
      </span>
      <div>
        <strong className="block text-[10px] text-[#321428]">{title}</strong>
        <p className="mt-0.5">{children}</p>
      </div>
    </div>
  );
}
