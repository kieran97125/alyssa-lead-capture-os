import Link from "next/link";
import {
  AlertTriangle,
  BellRing,
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  Filter,
  ImagePlus,
  Layers3,
  Palette,
  Settings2,
  Sparkles,
  UserRound,
} from "lucide-react";
import { AppNav } from "@/components/alyssa/AppNav";
import { SubmitButton } from "@/components/alyssa/SubmitButton";
import { DesktopNotificationControl } from "@/components/command-center/DesktopNotificationControl";
import { CreativeJobCreateDialog } from "@/components/creative/CreativeJobCreateDialog";
import { CreativeJobDeleteControl } from "@/components/creative/CreativeJobDeleteControl";
import { requireModuleAccess } from "@/lib/security/internalAccessServer";
import { getCreativeListSnapshot } from "@/lib/creative/store";
import {
  creativeJobStatusLabels,
  creativeJobStatuses,
  creativePriorities,
  creativePriorityLabels,
} from "@/lib/creative/types";

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

function requesterDisplayName(name: string | null, email: string | null) {
  if (name?.trim()) return name.trim();
  const localPart = email?.split("@")[0]?.trim();
  if (!localPart) return "系統匯入";
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function viewHref(current: Record<string, string>, view: string) {
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
    scope:
      firstParam(query.scope) === "mine"
        ? ("mine" as const)
        : ("all" as const),
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
  const listReturnPath = viewHref(currentParams, filters.view);
  const message = firstParam(query.creative_message);
  const commandStatus = firstParam(query.creative_status);

  const quickViews = [
    {
      value: "",
      label: "全部進行中",
      count: snapshot.stats.open,
      icon: Layers3,
    },
    {
      value: "waiting",
      label: "等素材",
      count: snapshot.stats.waiting,
      icon: Clock3,
    },
    {
      value: "review",
      label: "待 Review／修改",
      count: snapshot.stats.review,
      icon: Sparkles,
    },
    {
      value: "overdue",
      label: "已逾期",
      count: snapshot.stats.overdue,
      icon: AlertTriangle,
    },
    {
      value: "publish",
      label: "即將出街",
      count: null,
      icon: CalendarCheck2,
    },
    {
      value: "completed",
      label: "已完成",
      count: null,
      icon: CheckCircle2,
    },
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
                Marketer 派 Job、Designer 製作、Review、修改、Final 同出街日程集中管理。
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              {snapshot.canManageSettings ? (
                <Link
                  href="/settings/creative"
                  className="command-secondary-button !min-h-8 !rounded-lg !px-2.5 !py-1.5 !text-[10px]"
                >
                  <Settings2 size={13} /> 分類及 Designer
                </Link>
              ) : null}
              <details className="group relative">
                <summary className="command-secondary-button !min-h-8 !rounded-lg !px-2.5 !py-1.5 !text-[10px] list-none [&::-webkit-details-marker]:hidden">
                  <BellRing size={13} /> 通知設定
                </summary>
                <div className="absolute right-0 top-full z-40 mt-2 w-[min(360px,calc(100vw-2rem))]">
                  <DesktopNotificationControl />
                </div>
              </details>
              {snapshot.canCreate ? (
                <CreativeJobCreateDialog
                  brands={snapshot.brands}
                  designers={snapshot.designers}
                  taxonomies={snapshot.taxonomies}
                  defaultBrandId={filters.brandId || snapshot.brands[0]?.id}
                  today={snapshot.today}
                />
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
              <h2 className="mt-3 text-lg font-black">
                Creative Studio Database 尚未完成設定
              </h2>
              <p className="mt-2 text-sm font-semibold text-[#806174]">
                頁面已準備好，但要先套用 Creative Production migration。
              </p>
            </section>
          ) : (
            <>
              <section
                className="grid gap-2 md:grid-cols-3 xl:grid-cols-6"
                aria-label="設計工作快速檢視"
              >
                {quickViews.map((view) => {
                  const Icon = view.icon;
                  const active = filters.view === view.value;
                  return (
                    <Link
                      key={view.value || "open"}
                      href={viewHref(currentParams, view.value)}
                      className={`rounded-xl border px-3 py-2.5 transition ${
                        active
                          ? "border-[#7c365f] bg-[#5a2348] text-white shadow-[0_8px_20px_rgba(90,35,72,0.14)]"
                          : "border-[#e8dcd5] bg-white text-[#321428] hover:border-[#cfaebe]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Icon size={15} />
                        {view.count !== null ? (
                          <strong className="text-lg leading-none">{view.count}</strong>
                        ) : null}
                      </div>
                      <span
                        className={`mt-2 block text-[10px] font-black ${
                          active ? "text-white" : "text-[#6d4a5c]"
                        }`}
                      >
                        {view.label}
                      </span>
                    </Link>
                  );
                })}
              </section>

              <section className="command-surface mt-4 min-w-0 overflow-hidden">
                <header className="flex flex-col gap-3 border-b border-[#ead9cf] p-3 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#9a5d76]">
                      Job list
                    </p>
                    <h2 className="mt-1 text-base font-black">
                      {snapshot.jobs.length} 項設計工作
                    </h2>
                    <p className="mt-1 text-[10px] font-semibold text-[#806174]">
                      先按 Start Day；同日再按緊急／優先，最後按 Due Day。
                    </p>
                  </div>
                  <form
                    method="get"
                    className="flex w-full flex-wrap items-end gap-1.5 xl:w-auto xl:justify-end"
                  >
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
                        ...snapshot.brands.map(
                          (brand) => [brand.id, brand.name] as [string, string]
                        ),
                      ]}
                    />
                    <FilterSelect
                      label="Designer"
                      name="designer"
                      value={filters.designerId}
                      options={[
                        ["", "全部 Designer"],
                        ...snapshot.designers.map(
                          (designer) =>
                            [designer.id, designer.displayName] as [string, string]
                        ),
                      ]}
                    />
                    <FilterSelect
                      label="狀態"
                      name="status"
                      value={filters.status}
                      options={[
                        ["", "全部狀態"],
                        ...creativeJobStatuses.map(
                          (status) =>
                            [status, creativeJobStatusLabels[status]] as [
                              string,
                              string,
                            ]
                        ),
                      ]}
                    />
                    <FilterSelect
                      label="優先級"
                      name="priority"
                      value={filters.priority}
                      options={[
                        ["", "全部"],
                        ...creativePriorities.map(
                          (priority) =>
                            [priority, creativePriorityLabels[priority]] as [
                              string,
                              string,
                            ]
                        ),
                      ]}
                    />
                    <SubmitButton
                      className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#5a2348] px-2.5 text-[9px] font-black text-white"
                      pendingLabel="載入中…"
                    >
                      <Filter size={12} /> 套用
                    </SubmitButton>
                  </form>
                </header>

                {snapshot.jobs.length ? (
                  <div data-testid="creative-job-list">
                    <div className="hidden grid-cols-[minmax(220px,1.35fr)_minmax(150px,0.82fr)_minmax(220px,1.1fr)_minmax(205px,1fr)_minmax(86px,0.4fr)] gap-3 border-b border-[#eee3dd] bg-[#fbf9f7] px-3 py-2 text-[8px] font-black uppercase tracking-[0.06em] text-[#806174] xl:grid">
                      <span>Job</span>
                      <span>負責</span>
                      <span>製作規格</span>
                      <span>時間</span>
                      <span>狀態</span>
                    </div>
                    {snapshot.jobs.map((job) => {
                      const overdue =
                        Boolean(job.dueDate) &&
                        job.dueDate! < snapshot.today &&
                        !["completed", "cancelled"].includes(job.status);
                      const requester = requesterDisplayName(
                        job.requesterName,
                        job.requesterEmail
                      );
                      return (
                        <div
                          key={job.id}
                          className="relative border-b border-[#f0e7e2] last:border-b-0"
                        >
                          <Link
                            href={`/creative-jobs/${job.id}`}
                            data-testid="creative-job-row"
                            className="grid min-w-0 grid-cols-1 gap-x-3 gap-y-2 px-3 py-2.5 pr-11 text-[10px] font-semibold transition hover:bg-[#fff9fb] md:grid-cols-2 xl:grid-cols-[minmax(220px,1.35fr)_minmax(150px,0.82fr)_minmax(220px,1.1fr)_minmax(205px,1fr)_minmax(86px,0.4fr)] xl:items-center"
                          >
                          <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <strong className="min-w-0 flex-1 truncate text-[12px] leading-4 text-[#321428]">
                                {job.title}
                              </strong>
                              <PriorityBadge value={job.priority} />
                            </div>
                            <small className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[8px] font-bold leading-3 text-[#927987]">
                              <span>{job.quantity} 件 · {job.workload}</span>
                              <span
                                className="inline-flex min-w-0 items-center gap-1 truncate"
                                title={job.requesterEmail || requester}
                              >
                                <UserRound className="shrink-0" size={9} />
                                建立者：<span className="truncate">{requester}</span>
                              </span>
                              {job.materialStatus === "waiting" ? (
                                <span>等素材</span>
                              ) : null}
                            </small>
                          </div>

                          <div className="grid min-w-0 gap-1">
                            <ListMeta
                              label="品牌"
                              value={job.brandName}
                              strong
                            />
                            <ListMeta
                              label="Designer"
                              value={job.assigneeProfileName || "未派"}
                              icon
                            />
                          </div>

                          <div className="grid min-w-0 gap-1">
                            <ListMeta
                              label="Source"
                              value={job.sourceName || "—"}
                            />
                            <ListMeta
                              label="用途"
                              value={job.usageName || "—"}
                            />
                            <ListMeta
                              label="媒體格式"
                              value={job.mediaFormatName || "—"}
                            />
                          </div>

                          <div className="grid min-w-0 grid-cols-3 gap-1.5">
                            <ScheduleMeta
                              label="Start"
                              value={prettyDate(job.startDate)}
                            />
                            <ScheduleMeta
                              label="Due"
                              value={prettyDate(job.dueDate)}
                              alert={overdue}
                            />
                            <ScheduleMeta
                              label="Publish"
                              value={
                                job.syncCalendar
                                  ? prettyDate(job.publishDate)
                                  : "—"
                              }
                              calendar={job.syncCalendar}
                            />
                          </div>

                          <div className="flex items-center xl:justify-start">
                            <StatusBadge status={job.status} />
                          </div>
                          </Link>
                          {snapshot.canCreate ? (
                            <div className="absolute right-2 top-2 xl:top-1/2 xl:-translate-y-1/2">
                              <CreativeJobDeleteControl
                                jobId={job.id}
                                title={job.title}
                                returnPath={listReturnPath}
                                placement="list"
                              />
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-12 text-center">
                    <ImagePlus className="mx-auto text-[#a17b8d]" size={28} />
                    <h3 className="mt-3 text-sm font-black">
                      暫時冇符合條件嘅設計工作
                    </h3>
                    <p className="mt-1 text-xs font-semibold text-[#806174]">
                      Marketer 可以按右上角「新增設計 Job」開始派工作。
                    </p>
                  </div>
                )}
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
    <label className="grid min-w-[104px] flex-1 gap-0.5 sm:flex-none">
      <span className="text-[8px] font-black text-[#806174]">{label}</span>
      <select
        name={name}
        defaultValue={value}
        className="h-8 min-w-0 rounded-lg border border-[#dfcdc4] bg-white px-2 text-[9px] font-bold text-[#4d2d40]"
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

function ListMeta({
  label,
  value,
  strong = false,
  icon = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
  icon?: boolean;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[52px_minmax(0,1fr)] items-center gap-1.5">
      <span className="text-[7px] font-black uppercase tracking-[0.05em] text-[#9a818d]">
        {label}
      </span>
      <span
        className={`flex min-w-0 items-center gap-1 truncate text-[10px] leading-3 ${
          strong ? "font-black text-[#6d4a5c]" : "text-[#4d3945]"
        }`}
        title={value}
      >
        {icon ? <UserRound className="shrink-0" size={11} /> : null}
        <span className="truncate">{value}</span>
      </span>
    </div>
  );
}

function ScheduleMeta({
  label,
  value,
  alert = false,
  calendar = false,
}: {
  label: string;
  value: string;
  alert?: boolean;
  calendar?: boolean;
}) {
  return (
    <span className="min-w-0 rounded-lg bg-[#f8f4f2] px-2 py-1.5">
      <small className="block text-[7px] font-black uppercase tracking-[0.05em] text-[#9a818d]">
        {label}
      </small>
      <strong
        className={`mt-0.5 flex min-w-0 items-center gap-1 truncate text-[8px] leading-3 ${
          alert ? "text-[#a43b50]" : "text-[#4d3945]"
        }`}
      >
        {calendar ? <CalendarCheck2 className="shrink-0" size={10} /> : null}
        <span className="truncate">{value}</span>
      </strong>
    </span>
  );
}

function PriorityBadge({
  value,
}: {
  value: "normal" | "priority" | "urgent";
}) {
  const styles = {
    normal: "bg-[#f5f1ef] text-[#806174]",
    priority: "bg-[#fff7e8] text-[#94611f]",
    urgent: "bg-[#fff0ef] text-[#a43b50]",
  };
  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-black ${styles[value]}`}
    >
      {creativePriorityLabels[value]}
    </span>
  );
}

function StatusBadge({
  status,
}: {
  status: keyof typeof creativeJobStatusLabels;
}) {
  const active = ["review", "revision", "blocked"].includes(status);
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-[8px] font-black ${
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
