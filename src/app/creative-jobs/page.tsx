import Link from "next/link";
import {
  AlertTriangle,
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  Filter,
  ImagePlus,
  Layers3,
  Palette,
  Sparkles,
} from "lucide-react";
import { AppNav } from "@/components/alyssa/AppNav";
import { SubmitButton } from "@/components/alyssa/SubmitButton";
import { CreativeJobHeaderActions } from "@/components/creative/CreativeJobHeaderActions";
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
  <CreativeJobHeaderActions
    canCreate={snapshot.canCreate}
    canManageSettings={snapshot.canManageSettings}
    brands={snapshot.brands}
    designers={snapshot.designers}
    taxonomies={snapshot.taxonomies}
    today={snapshot.today}
    defaultBrandId={filters.brandId || snapshot.brands[0]?.id || ""}
  />
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

              <section className="mt-4">
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
                          先按 Start Day；同日再按緊急／優先排序，最後按 Due Day。
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
                      <div data-testid="creative-job-list" className="min-w-0">
                        <div className="hidden grid-cols-[minmax(210px,1.5fr)_minmax(125px,.78fr)_minmax(140px,.85fr)_minmax(180px,1fr)_72px_96px] gap-x-3 border-b border-[#eee3dd] bg-[#fbf9f7] px-4 py-2.5 text-[9px] font-black uppercase tracking-[0.06em] text-[#806174] xl:grid">
                          <span>Job／Source</span>
                          <span>品牌／Designer</span>
                          <span>用途／媒體格式</span>
                          <span>Start／Due／Publish</span>
                          <span>優先</span>
                          <span>狀態</span>
                        </div>
                        <div className="divide-y divide-[#f0e7e2]">
                          {snapshot.jobs.map((job) => {
                            const overdue =
                              Boolean(job.dueDate) &&
                              job.dueDate! < snapshot.today &&
                              !["completed", "cancelled"].includes(job.status);
                            return (
                              <Link
                                key={job.id}
                                href={`/creative-jobs/${job.id}`}
                                className="grid min-w-0 gap-3 px-4 py-4 text-[11px] font-semibold transition hover:bg-[#fff9fb] xl:grid-cols-[minmax(210px,1.5fr)_minmax(125px,.78fr)_minmax(140px,.85fr)_minmax(180px,1fr)_72px_96px] xl:items-center xl:gap-x-3"
                              >
                                <span className="min-w-0">
                                  <strong className="block truncate text-xs text-[#321428]">
                                    {job.title}
                                  </strong>
                                  <small className="mt-1 block text-[9px] font-bold text-[#927987]">
                                    {job.quantity} 件 · {job.workload} workload
                                    {job.materialStatus === "waiting"
                                      ? " · 等素材"
                                      : ""}
                                  </small>
                                  <span className="mt-2 inline-flex max-w-full items-center gap-1 rounded-full bg-[#f7f1f4] px-2 py-1 text-[9px] font-bold text-[#806174]">
                                    <span className="shrink-0 text-[#9a5d76]">Source</span>
                                    <span className="truncate">{job.sourceName || "未設定"}</span>
                                  </span>
                                </span>

                                <span className="min-w-0">
                                  <small className="mb-1 block text-[9px] font-black uppercase tracking-[0.08em] text-[#a88d99] xl:hidden">
                                    品牌／Designer
                                  </small>
                                  <strong className="block truncate text-[11px] text-[#6d4a5c]">
                                    {job.brandName}
                                  </strong>
                                  <span className="mt-1 block truncate text-[10px] text-[#806174]">
                                    {job.assigneeProfileName || "未派 Designer"}
                                  </span>
                                </span>

                                <span className="min-w-0">
                                  <small className="mb-1 block text-[9px] font-black uppercase tracking-[0.08em] text-[#a88d99] xl:hidden">
                                    用途／媒體格式
                                  </small>
                                  <strong className="block truncate text-[11px] text-[#4d2d40]">
                                    {job.usageName || "未設定用途"}
                                  </strong>
                                  <span className="mt-1 block truncate text-[10px] text-[#806174]">
                                    {job.mediaFormatName || "未設定格式"}
                                  </span>
                                </span>

                                <span className="min-w-0">
                                  <small className="mb-1 block text-[9px] font-black uppercase tracking-[0.08em] text-[#a88d99] xl:hidden">
                                    排期
                                  </small>
                                  <span className="flex flex-wrap items-center gap-1.5 text-[10px] text-[#6d4a5c]">
                                    <span>
                                      <b className="text-[#9a5d76]">Start</b>{" "}
                                      {prettyDate(job.startDate)}
                                    </span>
                                    <span aria-hidden="true" className="text-[#b9a8b1]">
                                      →
                                    </span>
                                    <span className={overdue ? "font-black text-[#a43b50]" : ""}>
                                      <b>Due</b> {prettyDate(job.dueDate)}
                                    </span>
                                  </span>
                                  <span className="mt-1.5 flex items-center gap-1 text-[9px] font-bold text-[#927987]">
                                    {job.syncCalendar ? (
                                      <>
                                        <CalendarCheck2 size={11} /> Publish {prettyDate(job.publishDate)}
                                      </>
                                    ) : (
                                      "未同步日曆"
                                    )}
                                  </span>
                                </span>

                                <span>
                                  <small className="mb-1 block text-[9px] font-black uppercase tracking-[0.08em] text-[#a88d99] xl:hidden">
                                    優先級
                                  </small>
                                  <PriorityBadge value={job.priority} />
                                </span>

                                <span>
                                  <small className="mb-1 block text-[9px] font-black uppercase tracking-[0.08em] text-[#a88d99] xl:hidden">
                                    狀態
                                  </small>
                                  <StatusBadge status={job.status} />
                                </span>
                              </Link>
                            );
                          })}
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
