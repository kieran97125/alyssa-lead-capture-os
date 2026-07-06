import {
  CrmInboxTable,
  crmInboxPresets,
  type CrmInboxPreset,
} from "@/components/crm/CrmInboxTable";
import { CrmShell } from "@/components/crm/CrmShell";
import { getCrmSettings } from "@/lib/crm/settingsLoader";
import { cleanAttributionText } from "@/lib/attribution/display";
import {
  summarizeCrmCases,
  toCrmLeadCase,
  type CrmLeadCase,
} from "@/lib/crm/leadOps";
import {
  applyCrmRecordToLeadCase,
  getCrmBookingsByCaseIds,
  getCrmCasesBySourceLeadIds,
  getCrmRuntimeStatus,
  type CrmBookingRecord,
  type CrmLeadCaseRecord,
} from "@/lib/crm/store";
import {
  dateRangeOptions,
  formatDateTime,
  getLeadRows,
  parseRange,
  type LeadRow,
} from "@/lib/data/businessMetrics";

export const dynamic = "force-dynamic";

type ConversionTone = "blue" | "emerald" | "purple" | "red" | "slate";
type TrackingQualityKey = "strong" | "partial" | "direct" | "missing";
type ReadinessKey = "ready" | "needs_stronger_tracking" | "crm_only" | "missing_identifiers";

type CrmTabKey = "dashboard" | "leads" | "bookings" | "reports";

const tabs: Array<{ key: CrmTabKey; label: string }> = [
  { key: "leads", label: "工作台" },
  { key: "bookings", label: "預約" },
];

const queueOptions = [
  ["", "全部"],
  ["new", "待跟進"],
  ["follow_up_today", "今日要跟"],
  ["follow_up_overdue", "過期未跟"],
  ["contacting", "已聯絡"],
  ["booked", "已預約"],
  ["lost", "Lost"],
  ["invalid", "Invalid"],
];

const bookingQueueOptions = [
  ["", "全部"],
  ["today_bookings", "今日預約"],
  ["pending_show_outcome", "待標記到店結果"],
  ["booked", "已預約"],
  ["no_show", "No-show"],
];

const inboxSubTabs = [
  { label: "Chats / 對話", queue: "" },
  { label: "Bookings / 預約", queue: "booked" },
  { label: "Follow-up / 跟進", queue: "follow_up_today" },
  { label: "Completed / 已完成", queue: "showed" },
  { label: "All / 全部", queue: "" },
];

const bookingSubTabs = [
  { label: "今日預約", queue: "today_bookings" },
  { label: "待標記結果", queue: "pending_show_outcome" },
  { label: "已預約", queue: "booked" },
  { label: "No-show", queue: "no_show" },
  { label: "全部", queue: "" },
];

export default async function CrmPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const activeTab = normalizeCrmTab(firstQueryValue(query?.tab));
  const range = parseRange(query?.range);
  const search = firstQueryValue(query?.search)?.trim() || "";
  const brand = firstQueryValue(query?.brand)?.trim().toLowerCase() || "";
  const treatment = firstQueryValue(query?.treatment)?.trim().toLowerCase() || "";
  const queue = firstQueryValue(query?.queue)?.trim() || "";
  const viewPreset = normalizeInboxPreset(firstQueryValue(query?.view));
  const source =
    activeTab === "reports"
      ? firstQueryValue(query?.source)?.trim().toLowerCase() || ""
      : "";
  const outcome = firstQueryValue(query?.outcome)?.trim() || "";
  const tracking = firstQueryValue(query?.tracking)?.trim() || "";
  const leadLimit = range === "all" ? 5000 : 500;
  const { leads, error } = await getLeadRows(range, leadLimit, { query: search });
  const leadById = new Map(leads.map((lead) => [lead.id, lead]));
  const [runtime, crmCasesByLeadId, crmSettings] = await Promise.all([
    getCrmRuntimeStatus(),
    getCrmCasesBySourceLeadIds(leads.map((lead) => lead.id)),
    getCrmSettings(),
  ]);
  const caseIds = Array.from(crmCasesByLeadId.values()).map((item) => item.id);
  const bookingsByCaseId = await getCrmBookingsByCaseIds(caseIds);

  const enrichedCases = leads.map((lead) => {
    const record = crmCasesByLeadId.get(lead.id) ?? null;
    const booking = record ? bookingsByCaseId.get(record.id) ?? null : null;
    return applyBookingToCase(
      applyCrmRecordToLeadCase(toCrmLeadCase(lead), record),
      booking
    );
  });

  const baseFilteredCases = enrichedCases.filter((item) => {
    if (brand && !item.brandName.toLowerCase().includes(brand)) return false;
    if (treatment && !item.treatmentOffer.toLowerCase().includes(treatment)) return false;
    if (
      source &&
      ![item.sourceLabel, item.sourceTypeRaw, item.campaignLabel, item.adLabel]
        .join(" ")
        .toLowerCase()
        .includes(source)
    ) {
      return false;
    }
    return true;
  });
  const summary = getCommandCenterSummary(baseFilteredCases);
  const conversion = getConversionOverview(baseFilteredCases);
  const conversionBreakdown = getConversionBreakdown(baseFilteredCases);
  const sourceQualityRows = getSourceQualityRows(baseFilteredCases);
  const campaignQualityRows = getCampaignQualityRows(baseFilteredCases);
  const directSummary = getDirectTrafficSummary(baseFilteredCases);
  const outcomeRows = getOutcomeFeedbackRows(
    baseFilteredCases,
    leadById,
    crmCasesByLeadId
  ).filter((row) => {
    if (outcome && row.outcomeType !== outcome) return false;
    if (tracking && row.trackingQualityKey !== tracking) return false;
    return true;
  });
  const outcomeSummary = getOutcomeFeedbackSummary(outcomeRows);
  const readinessSummary = getOutcomeReadinessSummary(outcomeRows);
  const trackingCaptureAudit = getTrackingCaptureAudit(baseFilteredCases, leadById);
  const workbenchCases = baseFilteredCases
    .filter((item) => (queue ? matchesQueue(item, queue) : true))
    .sort(comparePriority);
  const bookingCases = baseFilteredCases
    .filter((item) => item.status === "booked" || isTodayBooking(item) || isPendingShowOutcome(item))
    .filter((item) => (queue ? matchesQueue(item, queue) : true))
    .sort(comparePriority);
  const visibleCases =
    activeTab === "bookings"
      ? bookingCases
      : workbenchCases;
  const activeSubTabs = activeTab === "bookings" ? bookingSubTabs : inboxSubTabs;
  const activeQueueOptions = activeTab === "bookings" ? bookingQueueOptions : queueOptions;
  const dashboardCards = [
    { label: "Today leads", value: countTodayCreated(baseFilteredCases), href: "/crm?tab=leads" },
    { label: "Pending follow-up", value: summary.newLeads, href: "/crm?tab=leads&queue=new" },
    { label: "Today follow-up", value: summary.todayFollowUp, href: "/crm?tab=leads&queue=follow_up_today" },
    { label: "Overdue follow-up", value: summary.overdueFollowUp, href: "/crm?tab=leads&queue=follow_up_overdue" },
    { label: "Today bookings", value: summary.todayBookings, href: "/crm?tab=bookings&queue=today_bookings" },
    { label: "Pending show outcome", value: summary.pendingShowOutcome, href: "/crm?tab=bookings&queue=pending_show_outcome" },
    { label: "Booked", value: summary.booked, href: "/crm?tab=bookings&queue=booked" },
    { label: "Showed / No-show", value: conversion.showed + conversion.noShow, href: "/crm?tab=reports" },
  ];

  return (
    <CrmShell
      active={
        activeTab === "dashboard"
          ? "dashboard"
          : activeTab === "bookings"
          ? "bookings"
          : activeTab === "reports"
            ? "reports"
            : "inbox"
      }
    >
      <div className="flex h-screen min-w-0 flex-col">
        <header className="shrink-0 border-b border-[#e5e7eb] bg-white">
          <div className="border-b border-[#eef2f6] px-4 py-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-[17px] font-black text-[#111827]">
                    {activeTab === "reports"
                      ? "Marketing Reports / 報表"
                      : activeTab === "dashboard"
                        ? "Dashboard / 首頁"
                      : activeTab === "bookings"
                        ? "Bookings / 預約"
                        : "Inbox / 工作台"}
                  </h1>
                  <span className="rounded-full bg-[#ecfdf5] px-2 py-0.5 text-[10px] font-black text-[#047857]">
                    {runtime.actionsEnabled ? "Actions on" : "Read-only"}
                  </span>
                </div>
                <p className="mt-1 text-[11px] font-semibold text-[#64748b]">
                  {activeTab === "reports"
                    ? "管理層及 Marketing 用報表；CS 日常工作只需要使用工作台及預約。"
                    : activeTab === "dashboard"
                      ? "CRM 首頁總覽：今日 lead、跟進、預約及需要處理的 booking outcome。"
                    : activeTab === "bookings"
                      ? "今日預約、待標記到店結果及已確認預約的操作隊列。"
                      : "CS 每日跟進 Lead、手動開 WhatsApp、確認預約及更新狀態。"}
                </p>
              </div>
              {activeTab !== "reports" && activeTab !== "dashboard" ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <CountChip label="待跟進" value={summary.newLeads} />
                  <CountChip label="今日要跟" value={summary.todayFollowUp} tone="amber" />
                  <CountChip label="過期" value={summary.overdueFollowUp} tone="red" />
                  <CountChip label="已預約" value={summary.booked} tone="purple" />
                </div>
              ) : null}
            </div>

            {activeTab !== "reports" && activeTab !== "dashboard" ? (
              <div className="mt-3 flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                <nav className="flex gap-1 overflow-x-auto">
                  {activeSubTabs.map((item) => {
                    const href = item.queue
                      ? `/crm?tab=${activeTab}&queue=${item.queue}`
                      : activeTab === "bookings"
                        ? "/crm?tab=bookings"
                        : "/crm?tab=leads";
                    const active = queue === item.queue || (!queue && item.queue === "");
                    return (
                      <a
                        key={item.label}
                        href={href}
                        className={`flex h-8 items-center whitespace-nowrap rounded-full border px-3 text-[12px] font-bold ${
                          active
                            ? "border-[#6366f1] bg-[#eef2ff] text-[#4338ca]"
                            : "border-[#e2e8f0] bg-white text-[#64748b] hover:bg-[#f8fafc]"
                        }`}
                      >
                        {item.label}
                      </a>
                    );
                  })}
                </nav>

                <form className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <input type="hidden" name="tab" value={activeTab} />
                  <button
                    type="submit"
                    className="grid h-8 w-8 place-items-center rounded-md border border-[#dbe2ea] bg-white text-[12px] font-black text-[#475569]"
                    title="Filter"
                  >
                    F
                  </button>
                  <select
                    name="range"
                    defaultValue={range}
                    className="h-8 rounded-md border border-[#dbe2ea] bg-white px-2 text-[12px] font-semibold text-[#334155]"
                  >
                    {dateRangeOptions.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <select
                    name="queue"
                    defaultValue={queue}
                    className="h-8 rounded-md border border-[#dbe2ea] bg-white px-2 text-[12px] font-semibold text-[#334155]"
                  >
                    {activeQueueOptions.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <label className="w-[220px] lg:w-[280px]">
                    <span className="sr-only">Search CRM inbox</span>
                    <input
                      name="search"
                      type="search"
                      defaultValue={search}
                      placeholder="Search name, phone, treatment..."
                      className="h-8 w-full rounded-md border border-[#dbe2ea] bg-[#f8fafc] px-2.5 text-[12px] font-semibold text-[#111827] outline-none transition placeholder:text-[#94a3b8] focus:border-[#6366f1] focus:bg-white"
                    />
                  </label>
                  <select
                    name="view"
                    defaultValue={viewPreset}
                    className="h-8 rounded-md border border-[#dbe2ea] bg-white px-2 text-[12px] font-semibold text-[#334155]"
                    title="Column preset"
                  >
                    {crmSettings.inboxColumnPresets.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="h-8 rounded-md border border-[#dbe2ea] bg-white px-2.5 text-[12px] font-bold text-[#475569]"
                    title="Columns"
                  >
                    Columns
                  </button>
                  {(queue || search || viewPreset !== "cs_booking") ? (
                    <span className="inline-flex h-8 items-center rounded-full bg-[#fef3c7] px-2.5 text-[11px] font-bold text-[#92400e]">
                      Filter applied
                    </span>
                  ) : null}
                </form>
              </div>
            ) : null}
          </div>

          {activeTab === "reports" && (            <>
          <section className="border-t border-[#f1f5f9] px-4 py-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-[13px] font-black text-[#111827]">
                  CRM 轉化概覽
                </h2>
                <p className="mt-0.5 text-[11px] font-semibold text-[#64748b]">
                  以 Lead created_at 計算；已預約只計 CS 確認預約，不包括客人偏好日期時間。
                </p>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#94a3b8]">
                {baseFilteredCases.length} cases in current view
              </p>
            </div>

            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
              <ConversionMetric label="Lead" value={conversion.totalLeads} />
              <ConversionMetric label="已聯絡" value={conversion.contacting} tone="blue" />
              <ConversionMetric label="已預約" value={conversion.booked} tone="emerald" />
              <ConversionMetric label="已到店" value={conversion.showed} tone="purple" />
              <ConversionMetric label="No-show" value={conversion.noShow} />
              <ConversionMetric label="Lost" value={conversion.lost} tone="red" />
            </div>

            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <ConversionMetric label="聯絡率" value={formatPercent(conversion.contactRate)} tone="blue" />
              <ConversionMetric label="預約率" value={formatPercent(conversion.bookingRate)} tone="emerald" />
              <ConversionMetric label="到店率" value={formatPercent(conversion.showRate)} tone="purple" />
            </div>

            <div className="mt-3 overflow-hidden rounded-lg border border-[#e5e7eb] bg-white">
              <table className="min-w-full text-left text-[11px]">
                <thead className="bg-[#f8fafc] text-[10px] font-black uppercase tracking-[0.08em] text-[#64748b]">
                  <tr>
                    <th className="px-3 py-2">Brand</th>
                    <th className="px-3 py-2">Treatment / offer</th>
                    <th className="px-3 py-2">Lead</th>
                    <th className="px-3 py-2">已預約</th>
                    <th className="px-3 py-2">已到店</th>
                    <th className="px-3 py-2">預約率</th>
                    <th className="px-3 py-2">到店率</th>
                  </tr>
                </thead>
                <tbody>
                  {conversionBreakdown.length > 0 ? (
                    conversionBreakdown.map((row) => (
                      <tr key={row.key} className="border-t border-[#eef2f6]">
                        <td className="px-3 py-2 font-bold text-[#111827]">{row.brand}</td>
                        <td className="px-3 py-2 font-semibold text-[#475569]">
                          {row.treatment}
                        </td>
                        <td className="px-3 py-2 font-semibold">{row.leads}</td>
                        <td className="px-3 py-2 font-semibold">{row.booked}</td>
                        <td className="px-3 py-2 font-semibold">{row.showed}</td>
                        <td className="px-3 py-2 font-semibold">
                          {formatPercent(row.bookingRate)}
                        </td>
                        <td className="px-3 py-2 font-semibold">
                          {formatPercent(row.showRate)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-[#64748b]">
                        No CRM conversion rows in this range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="border-t border-[#f1f5f9] px-4 py-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-[13px] font-black text-[#111827]">
                  Source Ranking
                </h2>
                <p className="mt-0.5 text-[11px] font-semibold text-[#64748b]">
                  用最簡單方式睇來源帶來幾多 Leads、已預約及已到店。
                </p>
              </div>
            </div>

            <SimpleSourceRankingTable rows={sourceQualityRows} />
          </section>

          <details className="border-t border-[#f1f5f9] bg-white">
            <summary className="cursor-pointer px-4 py-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-[13px] font-black text-[#111827]">
                    Technical Audit / 技術審核
                  </h2>
                  <p className="mt-0.5 text-[11px] font-semibold text-[#64748b]">
                    只供 Marketing / Admin 檢查追蹤與回傳準備，CS 不需要使用。
                  </p>
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#94a3b8]">
                  Advanced
                </p>
              </div>
            </summary>
            <div className="px-4 pb-3">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <ConversionMetric label="直接 Leads" value={directSummary.leads} tone="red" />
                <ConversionMetric label="直接佔比" value={formatPercent(directSummary.share)} tone="red" />
                <ConversionMetric label="直接已預約" value={directSummary.booked} tone="emerald" />
                <ConversionMetric label="直接已到店" value={directSummary.showed} tone="purple" />
              </div>
              <SourceQualityTable rows={sourceQualityRows} />
              <CampaignQualityTable rows={campaignQualityRows} />
            </div>

          <section className="border-t border-[#f1f5f9] px-4 py-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-[13px] font-black text-[#111827]">
                  Tracking Capture Audit / 追蹤欄位覆蓋
                </h2>
                <p className="mt-0.5 text-[11px] font-semibold text-[#64748b]">
                  內部檢查現有 Lead / source snapshot 是否足夠支援未來 Meta CAPI 或 offline conversion feedback；此區不會改變追蹤或送出任何事件。
                </p>
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#94a3b8]">
                Audit only
              </p>
            </div>

            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-11">
              <ConversionMetric label="Total leads" value={trackingCaptureAudit.summary.totalLeads} />
              <ConversionMetric label="Leads with UTM" value={trackingCaptureAudit.summary.withUtm} tone="blue" />
              <ConversionMetric label="Leads with fbclid" value={trackingCaptureAudit.summary.withFbclid} tone="emerald" />
              <ConversionMetric label="Leads with fbp" value={trackingCaptureAudit.summary.withFbp} />
              <ConversionMetric label="Leads with fbc" value={trackingCaptureAudit.summary.withFbc} />
              <ConversionMetric label="Meta campaign ID" value={trackingCaptureAudit.summary.withMetaCampaignId} />
              <ConversionMetric label="Meta adset ID" value={trackingCaptureAudit.summary.withMetaAdsetId} />
              <ConversionMetric label="Meta ad ID" value={trackingCaptureAudit.summary.withMetaAdId} />
              <ConversionMetric label="Direct / no tracking" value={trackingCaptureAudit.summary.directNoTracking} tone="red" />
              <ConversionMetric label="Strong tracking %" value={formatPercent(trackingCaptureAudit.summary.strongTrackingRate)} tone="emerald" />
              <ConversionMetric label="Missing tracking %" value={formatPercent(trackingCaptureAudit.summary.missingTrackingRate)} tone="red" />
            </div>

            <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[12px] font-semibold leading-5 text-blue-950">
              <p className="font-black">Source capture diagnosis</p>
              <p className="mt-1">
                UTM 對報表分析有用；但未來如要做 Meta CAPI / offline matching，fbclid、fbc、fbp 會更重要。Direct / no tracking Leads 暫時不能可靠配對回 Meta。此區只作 audit，不會改變 capture 行為，亦不會發送任何事件。
              </p>
            </div>

            <TrackingCoverageTable rows={trackingCaptureAudit.coverageRows} />
          </section>

          <section className="border-t border-[#f1f5f9] px-4 py-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-[13px] font-black text-[#111827]">
                  Outcome Feedback Preview / 事件回傳預覽
                </h2>
                <p className="mt-0.5 text-[11px] font-semibold text-[#64748b]">
                  內部審核用，尚未回傳 Meta 或任何外部平台。
                </p>
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#94a3b8]">
                Preview only
              </p>
            </div>

            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-9">
              <ConversionMetric label="Outcome 總數" value={outcomeSummary.total} />
              <ConversionMetric label="已預約" value={outcomeSummary.booked} tone="emerald" />
              <ConversionMetric label="已到店" value={outcomeSummary.showed} tone="purple" />
              <ConversionMetric label="No-show" value={outcomeSummary.noShow} tone="red" />
              <ConversionMetric label="已流失" value={outcomeSummary.lost} tone="red" />
              <ConversionMetric label="無效" value={outcomeSummary.invalid} />
              <ConversionMetric label="Tracking 強" value={outcomeSummary.strong} tone="emerald" />
              <ConversionMetric label="Tracking 不完整" value={outcomeSummary.partial} tone="blue" />
              <ConversionMetric label="直接 / 無追蹤" value={outcomeSummary.direct} tone="red" />
            </div>

            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
              <ConversionMetric label="Total outcome records" value={readinessSummary.total} />
              <ConversionMetric label="Ready for Meta feedback" value={readinessSummary.ready} tone="emerald" />
              <ConversionMetric label="Needs stronger tracking" value={readinessSummary.needsStrongerTracking} tone="blue" />
              <ConversionMetric label="CRM reporting only" value={readinessSummary.crmOnly} />
              <ConversionMetric label="Missing fbclid / fbc / fbp" value={readinessSummary.missingClickIds} tone="red" />
              <ConversionMetric label="Direct / no tracking" value={readinessSummary.directNoTracking} tone="red" />
              <ConversionMetric label="Strong tracking %" value={formatPercent(readinessSummary.strongTrackingRate)} tone="emerald" />
            </div>

            <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-[12px] font-semibold leading-5 text-amber-900">
              <p className="font-black">Outcome readiness audit</p>
              <p className="mt-1">
                這頁只作內部預覽及審核，現階段不會向 Meta 或任何外部平台回傳事件。Booked、showed、no_show、lost、invalid 均為 CRM 營運結果；客人在表格填寫的偏好日期時間不等於已預約。直接 / 無追蹤 Leads 暫時不能可靠配對回 Meta，除非之後改善 fbclid / fbc / fbp 或其他可用識別。
              </p>
            </div>

            <OutcomeFeedbackPreviewTable rows={outcomeRows} />
          </section>
          </details>
            </>
          )}


          {!runtime.actionsEnabled && (
            <p className="border-t border-amber-100 bg-amber-50 px-4 py-2 text-[12px] font-semibold text-amber-800">
              {runtime.disabledReason}
            </p>
          )}

          {error && (
            <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-[12px] font-semibold text-red-700">
              CRM inbox cannot read the latest records right now. Please try again later.
            </p>
          )}
        </header>

        {activeTab === "dashboard" ? (
          <CrmDashboardOverview cards={dashboardCards} />
        ) : activeTab === "reports" ? null : (
          <CrmInboxTable cases={visibleCases} preset={viewPreset} />
        )}
      </div>
    </CrmShell>
  );
}
function SourceQualityTable({ rows }: { rows: SourceQualityRow[] }) {
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-[#e5e7eb] bg-white">
      <div className="border-b border-[#eef2f6] px-3 py-2">
        <h3 className="text-[12px] font-black text-[#111827]">來源群組質素</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[1120px] text-left text-[11px]">
          <thead className="bg-[#f8fafc] text-[10px] font-black uppercase tracking-[0.08em] text-[#64748b]">
            <tr>
              <th className="px-3 py-2">來源群組</th>
              <th className="px-3 py-2">Lead</th>
              <th className="px-3 py-2">有效</th>
              <th className="px-3 py-2">已聯絡</th>
              <th className="px-3 py-2">已預約</th>
              <th className="px-3 py-2">已到店</th>
              <th className="px-3 py-2">No-show</th>
              <th className="px-3 py-2">已流失</th>
              <th className="px-3 py-2">無效</th>
              <th className="px-3 py-2">聯絡率</th>
              <th className="px-3 py-2">預約率</th>
              <th className="px-3 py-2">到店率</th>
              <th className="px-3 py-2">流失率</th>
              <th className="px-3 py-2">無效率</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <tr
                  key={row.key}
                  className={`border-t border-[#eef2f6] ${
                    row.isDirect ? "bg-red-50/45" : ""
                  }`}
                >
                  <td className="px-3 py-2">
                    <span className="font-bold text-[#111827]">{row.label}</span>
                    {row.isDirect ? (
                      <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] text-red-700">
                        追蹤較弱
                      </span>
                    ) : null}
                    <span className="block text-[10px] font-semibold text-[#64748b]">
                      {row.meta}
                    </span>
                  </td>
                  <NumberCell value={row.leads} />
                  <NumberCell value={row.validLeads} />
                  <NumberCell value={row.contacted} />
                  <NumberCell value={row.booked} />
                  <NumberCell value={row.showed} />
                  <NumberCell value={row.noShow} />
                  <NumberCell value={row.lost} />
                  <NumberCell value={row.invalid} />
                  <NumberCell value={formatPercent(row.contactRate)} />
                  <NumberCell value={formatPercent(row.bookingRate)} />
                  <NumberCell value={formatPercent(row.showRate)} />
                  <NumberCell value={formatPercent(row.lostRate)} />
                  <NumberCell value={formatPercent(row.invalidRate)} />
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={14} className="px-3 py-6 text-center text-[#64748b]">
                  這個日期範圍未有來源質素資料。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CampaignQualityTable({ rows }: { rows: CampaignQualityRow[] }) {
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-[#e5e7eb] bg-white">
      <div className="border-b border-[#eef2f6] px-3 py-2">
        <h3 className="text-[12px] font-black text-[#111827]">Campaign 質素</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[880px] text-left text-[11px]">
          <thead className="bg-[#f8fafc] text-[10px] font-black uppercase tracking-[0.08em] text-[#64748b]">
            <tr>
              <th className="px-3 py-2">Campaign</th>
              <th className="px-3 py-2">來源 / Medium</th>
              <th className="px-3 py-2">Lead</th>
              <th className="px-3 py-2">已預約</th>
              <th className="px-3 py-2">已到店</th>
              <th className="px-3 py-2">已流失</th>
              <th className="px-3 py-2">預約率</th>
              <th className="px-3 py-2">到店率</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <tr key={row.key} className="border-t border-[#eef2f6]">
                  <td className="px-3 py-2 font-bold text-[#111827]">{row.campaign}</td>
                  <td className="px-3 py-2 font-semibold text-[#475569]">{row.source}</td>
                  <NumberCell value={row.leads} />
                  <NumberCell value={row.booked} />
                  <NumberCell value={row.showed} />
                  <NumberCell value={row.lost} />
                  <NumberCell value={formatPercent(row.bookingRate)} />
                  <NumberCell value={formatPercent(row.showRate)} />
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-[#64748b]">
                  這個日期範圍未有 Campaign 質素資料。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TrackingCoverageTable({ rows }: { rows: TrackingCoverageRow[] }) {
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-[#e5e7eb] bg-white">
      <div className="border-b border-[#eef2f6] px-3 py-2">
        <h3 className="text-[12px] font-black text-[#111827]">追蹤欄位 coverage</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[760px] text-left text-[11px]">
          <thead className="bg-[#f8fafc] text-[10px] font-black uppercase tracking-[0.08em] text-[#64748b]">
            <tr>
              <th className="px-3 py-2">Field</th>
              <th className="px-3 py-2">Available count</th>
              <th className="px-3 py-2">Missing count</th>
              <th className="px-3 py-2">Coverage %</th>
              <th className="px-3 py-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.field} className="border-t border-[#eef2f6]">
                <td className="px-3 py-2 font-bold text-[#111827]">{row.field}</td>
                <NumberCell value={row.available} />
                <NumberCell value={row.missing} />
                <NumberCell value={formatPercent(row.coverageRate)} />
                <td className="px-3 py-2 font-semibold text-[#64748b]">{row.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SimpleSourceRankingTable({ rows }: { rows: SourceQualityRow[] }) {
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-[#e5e7eb] bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-[760px] text-left text-[11px]">
          <thead className="bg-[#f8fafc] text-[10px] font-black uppercase tracking-[0.08em] text-[#64748b]">
            <tr>
              <th className="px-3 py-2">Source / medium</th>
              <th className="px-3 py-2">Lead</th>
              <th className="px-3 py-2">已預約</th>
              <th className="px-3 py-2">已到店</th>
              <th className="px-3 py-2">預約率</th>
              <th className="px-3 py-2">到店率</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <tr key={row.key} className="border-t border-[#eef2f6]">
                  <td className="px-3 py-2">
                    <span className="font-bold text-[#111827]">{row.label}</span>
                    <span className="block text-[10px] font-semibold text-[#64748b]">
                      {row.meta}
                    </span>
                  </td>
                  <NumberCell value={row.leads} />
                  <NumberCell value={row.booked} />
                  <NumberCell value={row.showed} />
                  <NumberCell value={formatPercent(row.bookingRate)} />
                  <NumberCell value={formatPercent(row.showRate)} />
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-[#64748b]">
                  這個日期範圍未有來源資料。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NumberCell({ value }: { value: number | string }) {
  return <td className="px-3 py-2 font-semibold text-[#111827]">{value}</td>;
}

function OutcomeFeedbackPreviewTable({ rows }: { rows: OutcomeFeedbackRow[] }) {
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-[#e5e7eb] bg-white">
      <div className="flex items-center justify-between border-b border-[#eef2f6] px-3 py-2">
        <h3 className="text-[12px] font-black text-[#111827]">尚未回傳事件預覽</h3>
        <span className="rounded bg-amber-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-amber-700">
          Preview only
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[1320px] text-left text-[11px]">
          <thead className="bg-[#f8fafc] text-[10px] font-black uppercase tracking-[0.08em] text-[#64748b]">
            <tr>
              <th className="px-3 py-2">客人</th>
              <th className="px-3 py-2">電話</th>
              <th className="px-3 py-2">品牌</th>
              <th className="px-3 py-2">療程 / 優惠</th>
              <th className="px-3 py-2">CRM 狀態</th>
              <th className="px-3 py-2">Outcome</th>
              <th className="px-3 py-2">Outcome 時間</th>
              <th className="px-3 py-2">Created At</th>
              <th className="px-3 py-2">來源 / Medium</th>
              <th className="px-3 py-2">Campaign</th>
              <th className="px-3 py-2">Meta Campaign ID</th>
              <th className="px-3 py-2">Meta Ad Set ID</th>
              <th className="px-3 py-2">Meta Ad ID</th>
              <th className="px-3 py-2">fbclid</th>
              <th className="px-3 py-2">fbp</th>
              <th className="px-3 py-2">fbc</th>
              <th className="px-3 py-2">Tracking</th>
              <th className="px-3 py-2">Readiness</th>
              <th className="px-3 py-2">狀態</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <tr key={row.key} className="border-t border-[#eef2f6]">
                  <td className="px-3 py-2 font-bold text-[#111827]">{row.leadName}</td>
                  <td className="px-3 py-2 font-semibold text-[#475569]">{row.phone}</td>
                  <td className="px-3 py-2 font-semibold text-[#475569]">{row.brand}</td>
                  <td className="px-3 py-2 font-semibold text-[#475569]">
                    {row.treatmentOffer}
                  </td>
                  <td className="px-3 py-2 font-semibold text-[#111827]">{row.statusLabel}</td>
                  <td className="px-3 py-2 font-bold text-[#111827]">{row.outcomeLabel}</td>
                  <td className="px-3 py-2 font-semibold text-[#475569]">
                    {row.outcomeTimestamp}
                  </td>
                  <td className="px-3 py-2 font-semibold text-[#475569]">{row.createdAt}</td>
                  <td className="px-3 py-2 font-semibold text-[#475569]">{row.sourceMedium}</td>
                  <td className="px-3 py-2 font-semibold text-[#475569]">{row.campaign}</td>
                  <td className="px-3 py-2 font-semibold text-[#475569]">
                    {row.metaCampaignId}
                  </td>
                  <td className="px-3 py-2 font-semibold text-[#475569]">{row.metaAdsetId}</td>
                  <td className="px-3 py-2 font-semibold text-[#475569]">{row.metaAdId}</td>
                  <td className="px-3 py-2 font-semibold text-[#475569]">
                    {row.fbclidAvailability}
                  </td>
                  <td className="px-3 py-2 font-semibold text-[#475569]">
                    {row.fbpAvailability}
                  </td>
                  <td className="px-3 py-2 font-semibold text-[#475569]">
                    {row.fbcAvailability}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-2 py-1 text-[10px] font-black ${row.trackingClassName}`}>
                      {row.trackingQualityLabel}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-2 py-1 text-[10px] font-black ${row.readinessClassName}`}>
                      {row.readinessLabel}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-bold text-amber-700">尚未回傳</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={19} className="px-3 py-6 text-center text-[#64748b]">
                  這個範圍未有可預覽嘅 CRM outcome 記錄。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function applyBookingToCase(item: CrmLeadCase, booking: CrmBookingRecord | null): CrmLeadCase {
  if (!booking) return item;
  const bookingLabel =
    booking.booking_date && booking.booking_time
      ? `${booking.booking_date} ${booking.booking_time}`
      : booking.booking_date || "未有已確認預約";

  return {
    ...item,
    confirmedBookingDate: booking.booking_date,
    confirmedBookingTime: booking.booking_time,
    confirmedBookingLabel: bookingLabel,
    bookingStatus: booking.status,
  };
}

function getCommandCenterSummary(cases: CrmLeadCase[]) {
  const base = summarizeCrmCases(cases);
  return {
    newLeads: base.pendingFollowUp,
    contacting: base.contacting,
    booked: base.booked,
    todayFollowUp: cases.filter(isTodayFollowUp).length,
    overdueFollowUp: cases.filter(isOverdueFollowUp).length,
    todayBookings: cases.filter(isTodayBooking).length,
    pendingShowOutcome: cases.filter(isPendingShowOutcome).length,
    lost: base.lost,
    invalid: base.invalid,
  };
}

function CountChip({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: number;
  tone?: "slate" | "amber" | "red" | "purple";
}) {
  const toneClass = {
    slate: "border-[#e2e8f0] bg-white text-[#475569]",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
    red: "border-red-100 bg-red-50 text-red-700",
    purple: "border-purple-100 bg-purple-50 text-purple-700",
  };

  return (
    <span
      className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-black ${toneClass[tone]}`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </span>
  );
}

function CrmDashboardOverview({
  cards,
}: {
  cards: Array<{ label: string; value: number; href: string }>;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-[#f8fafc] p-4">
      <div className="grid gap-4">
        <section className="rounded-xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-[15px] font-black text-[#111827]">
                CRM 今日工作總覽
              </h2>
              <p className="mt-1 text-[12px] font-semibold leading-5 text-[#64748b]">
                快速查看需要跟進、今日預約及待標記到店結果。技術追蹤資料只放在報表頁。
              </p>
            </div>
            <span className="w-fit rounded-md bg-[#eef2ff] px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#4338ca]">
              CRM Home
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
              <a
                key={card.label}
                href={card.href}
                className="rounded-lg border border-[#e5e7eb] bg-[#fbfdff] p-3 transition hover:border-[#c7d2fe] hover:bg-[#f8fafc]"
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#64748b]">
                  {card.label}
                </p>
                <p className="mt-2 text-2xl font-black tabular-nums text-[#111827]">
                  {card.value}
                </p>
              </a>
            ))}
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-2">
          <QuickLinkCard
            title="Inbox / 工作台"
            body="處理新 leads、今日要跟及過期未跟。"
            href="/crm?tab=leads"
          />
          <QuickLinkCard
            title="Bookings / 預約"
            body="查看今日預約、已確認預約及待標記到店結果。"
            href="/crm?tab=bookings"
          />
        </section>
      </div>
    </div>
  );
}

function QuickLinkCard({
  title,
  body,
  href,
}: {
  title: string;
  body: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="rounded-xl border border-[#e5e7eb] bg-white p-4 shadow-sm transition hover:border-[#c7d2fe] hover:bg-[#fbfdff]"
    >
      <p className="text-[13px] font-black text-[#111827]">{title}</p>
      <p className="mt-1 text-[12px] font-semibold leading-5 text-[#64748b]">
        {body}
      </p>
      <p className="mt-3 text-[11px] font-black text-[#4338ca]">
        Open
      </p>
    </a>
  );
}

function ConversionMetric({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: number | string;
  tone?: ConversionTone;
}) {
  const toneClass: Record<ConversionTone, string> = {
    blue: "border-blue-100 bg-blue-50 text-blue-800",
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-800",
    purple: "border-purple-100 bg-purple-50 text-purple-800",
    red: "border-red-100 bg-red-50 text-red-800",
    slate: "border-slate-100 bg-white text-slate-800",
  };

  return (
    <div className={`rounded-lg border px-3 py-2 ${toneClass[tone]}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.08em] opacity-70">
        {label}
      </p>
      <p className="mt-1 text-lg font-black leading-none">{value}</p>
    </div>
  );
}

function getConversionOverview(cases: CrmLeadCase[]) {
  const totalLeads = cases.length;
  const validCases = cases.filter((item) => item.status !== "invalid");
  const validLeads = validCases.length;
  const newLeads = countStatuses(cases, ["new", "pending_follow_up"]);
  const contacting = countStatuses(cases, ["contacting", "contacted"]);
  const booked = countStatuses(cases, ["booked"]);
  const showed = countStatuses(cases, ["showed"]);
  const noShow = countStatuses(cases, ["no_show"]);
  const lost = countStatuses(cases, ["lost"]);
  const invalid = countStatuses(cases, ["invalid"]);
  const contactedOrOutcome = countStatuses(validCases, [
    "contacting",
    "contacted",
    "booked",
    "showed",
    "no_show",
    "lost",
  ]);
  const bookingOrOutcome = countStatuses(validCases, ["booked", "showed", "no_show"]);

  return {
    totalLeads,
    validLeads,
    newLeads,
    contacting,
    booked,
    showed,
    noShow,
    lost,
    invalid,
    contactRate: safeRate(contactedOrOutcome, validLeads),
    bookingRate: safeRate(bookingOrOutcome, validLeads),
    showRate: safeRate(showed, bookingOrOutcome),
    lostRate: safeRate(lost, validLeads),
  };
}

function getConversionBreakdown(cases: CrmLeadCase[]) {
  const rows = new Map<string, ConversionBreakdownRow>();

  cases.forEach((item) => {
    const key = `${item.brandName}|${item.treatmentOffer}`;
    const current =
      rows.get(key) ??
      ({
        key,
        brand: item.brandName,
        treatment: item.treatmentOffer,
        leads: 0,
        booked: 0,
        showed: 0,
        lost: 0,
        bookingRate: 0,
        showRate: 0,
      } satisfies ConversionBreakdownRow);

    current.leads += 1;
    if (isBookedOutcome(item)) current.booked += 1;
    if (item.status === "showed") current.showed += 1;
    if (item.status === "lost") current.lost += 1;
    rows.set(key, current);
  });

  return Array.from(rows.values())
    .map((row) => ({
      ...row,
      bookingRate: safeRate(row.booked, row.leads),
      showRate: safeRate(row.showed, row.booked),
    }))
    .sort((a, b) => b.leads - a.leads || a.brand.localeCompare(b.brand));
}

type ConversionBreakdownRow = {
  key: string;
  brand: string;
  treatment: string;
  leads: number;
  booked: number;
  showed: number;
  lost: number;
  bookingRate: number;
  showRate: number;
};

type SourceQualityRow = {
  key: string;
  label: string;
  meta: string;
  isDirect: boolean;
  leads: number;
  validLeads: number;
  contacted: number;
  booked: number;
  showed: number;
  noShow: number;
  lost: number;
  invalid: number;
  contactRate: number;
  bookingRate: number;
  showRate: number;
  lostRate: number;
  invalidRate: number;
};

type CampaignQualityRow = {
  key: string;
  campaign: string;
  source: string;
  leads: number;
  booked: number;
  showed: number;
  lost: number;
  bookingRate: number;
  showRate: number;
};

type TrackingCoverageRow = {
  field: string;
  available: number;
  missing: number;
  coverageRate: number;
  notes: string;
};

type OutcomeFeedbackRow = {
  key: string;
  leadName: string;
  phone: string;
  brand: string;
  treatmentOffer: string;
  statusLabel: string;
  outcomeType: string;
  outcomeLabel: string;
  outcomeTimestamp: string;
  createdAt: string;
  sourceMedium: string;
  campaign: string;
  metaCampaignId: string;
  metaAdsetId: string;
  metaAdId: string;
  fbclidAvailability: string;
  fbpAvailability: string;
  fbcAvailability: string;
  trackingQualityKey: TrackingQualityKey;
  trackingQualityLabel: string;
  trackingClassName: string;
  readinessKey: ReadinessKey;
  readinessLabel: string;
  readinessClassName: string;
  hasFbclid: boolean;
  hasFbp: boolean;
  hasFbc: boolean;
};

function getOutcomeFeedbackRows(
  cases: CrmLeadCase[],
  leadById: Map<string, LeadRow>,
  crmCasesByLeadId: Map<string, CrmLeadCaseRecord>
) {
  return cases
    .filter((item) => isFeedbackOutcomeStatus(item.status))
    .map((item) => {
      const lead = leadById.get(item.id) ?? null;
      const crmRecord = crmCasesByLeadId.get(item.id) ?? null;
      const snapshot = lead?.sourceSnapshot ?? null;
      const metaCampaignId = item.ctwa.campaign_id || snapshot?.meta_campaign_id || "";
      const metaAdsetId = item.ctwa.adset_id || snapshot?.meta_adset_id || "";
      const metaAdId = item.ctwa.ad_id || snapshot?.meta_ad_id || "";
      const fbclid = snapshot?.fbclid || "";
      const fbp = sourceSnapshotExtra(lead, "fbp");
      const fbc = sourceSnapshotExtra(lead, "fbc");
      const trackingQuality = getTrackingQuality(item, lead);
      const readiness = getOutcomeReadiness({
        trackingQualityKey: trackingQuality.key,
        hasFbclid: Boolean(fbclid),
        hasFbp: Boolean(fbp),
        hasFbc: Boolean(fbc),
      });

      return {
        key: `${item.id}-${item.status}`,
        leadName: item.customerName,
        phone: item.phone,
        brand: item.brandName,
        treatmentOffer: item.treatmentOffer,
        statusLabel: item.statusLabel,
        outcomeType: item.status,
        outcomeLabel: outcomeLabel(item.status),
        outcomeTimestamp: outcomeTimestamp(item, crmRecord),
        createdAt: item.createdLabel,
        sourceMedium: item.sourceLabel,
        campaign: cleanLabel(item.campaignLabel) || "未設定 Campaign",
        metaCampaignId: metaCampaignId || "-",
        metaAdsetId: metaAdsetId || "-",
        metaAdId: metaAdId || "-",
        fbclidAvailability: fbclid ? "有" : "無",
        fbpAvailability: fbp ? "有" : "未有欄位",
        fbcAvailability: fbc ? "有" : "未有欄位",
        trackingQualityKey: trackingQuality.key,
        trackingQualityLabel: trackingQuality.label,
        trackingClassName: trackingQuality.className,
        readinessKey: readiness.key,
        readinessLabel: readiness.label,
        readinessClassName: readiness.className,
        hasFbclid: Boolean(fbclid),
        hasFbp: Boolean(fbp),
        hasFbc: Boolean(fbc),
      } satisfies OutcomeFeedbackRow;
    })
    .sort((a, b) => {
      const outcomeOrder = ["booked", "showed", "no_show", "lost", "invalid"];
      return (
        outcomeOrder.indexOf(a.outcomeType) - outcomeOrder.indexOf(b.outcomeType) ||
        a.brand.localeCompare(b.brand) ||
        a.leadName.localeCompare(b.leadName)
      );
    });
}

function getOutcomeFeedbackSummary(rows: OutcomeFeedbackRow[]) {
  return {
    total: rows.length,
    booked: rows.filter((row) => row.outcomeType === "booked").length,
    showed: rows.filter((row) => row.outcomeType === "showed").length,
    noShow: rows.filter((row) => row.outcomeType === "no_show").length,
    lost: rows.filter((row) => row.outcomeType === "lost").length,
    invalid: rows.filter((row) => row.outcomeType === "invalid").length,
    strong: rows.filter((row) => row.trackingQualityKey === "strong").length,
    partial: rows.filter((row) => row.trackingQualityKey === "partial").length,
    direct: rows.filter((row) => row.trackingQualityKey === "direct").length,
    missing: rows.filter((row) => row.trackingQualityKey === "missing").length,
  };
}

function getOutcomeReadinessSummary(rows: OutcomeFeedbackRow[]) {
  const strongTracking = rows.filter((row) => row.trackingQualityKey === "strong").length;

  return {
    total: rows.length,
    ready: rows.filter((row) => row.readinessKey === "ready").length,
    needsStrongerTracking: rows.filter(
      (row) => row.readinessKey === "needs_stronger_tracking"
    ).length,
    crmOnly: rows.filter((row) => row.readinessKey === "crm_only").length,
    missingIdentifiers: rows.filter((row) => row.readinessKey === "missing_identifiers")
      .length,
    missingClickIds: rows.filter((row) => !row.hasFbclid && !row.hasFbp && !row.hasFbc)
      .length,
    directNoTracking: rows.filter((row) => row.trackingQualityKey === "direct").length,
    strongTrackingRate: safeRate(strongTracking, rows.length),
  };
}

function getOutcomeReadiness({
  trackingQualityKey,
  hasFbclid,
  hasFbp,
  hasFbc,
}: {
  trackingQualityKey: TrackingQualityKey;
  hasFbclid: boolean;
  hasFbp: boolean;
  hasFbc: boolean;
}) {
  if (hasFbclid || hasFbc) {
    return {
      key: "ready" as const,
      label: "Ready for Meta feedback",
      className: "bg-emerald-50 text-emerald-700",
    };
  }

  if (trackingQualityKey === "direct") {
    return {
      key: "crm_only" as const,
      label: "CRM reporting only",
      className: "bg-slate-100 text-slate-700",
    };
  }

  if (trackingQualityKey === "partial" || hasFbp) {
    return {
      key: "needs_stronger_tracking" as const,
      label: "Needs stronger tracking",
      className: "bg-blue-50 text-blue-700",
    };
  }

  return {
    key: "missing_identifiers" as const,
    label: "Missing identifiers",
    className: "bg-amber-50 text-amber-700",
  };
}

function isFeedbackOutcomeStatus(status: string) {
  return ["booked", "showed", "no_show", "lost", "invalid"].includes(status);
}

function outcomeLabel(status: string) {
  const labels: Record<string, string> = {
    booked: "已預約",
    showed: "已到店",
    no_show: "No-show",
    lost: "已流失",
    invalid: "無效",
  };
  return labels[status] ?? status;
}

function outcomeTimestamp(item: CrmLeadCase, crmRecord: CrmLeadCaseRecord | null) {
  if (item.status === "booked" && item.confirmedBookingLabel) {
    return item.confirmedBookingLabel;
  }
  if (crmRecord?.updated_at) return formatDateTime(crmRecord.updated_at);
  return item.lastActivityLabel || item.createdLabel || "-";
}

function getTrackingQuality(item: CrmLeadCase, lead: LeadRow | null) {
  const snapshot = lead?.sourceSnapshot ?? null;
  const hasFbclid = Boolean(snapshot?.fbclid);
  const hasFbp = Boolean(sourceSnapshotExtra(lead, "fbp"));
  const hasFbc = Boolean(sourceSnapshotExtra(lead, "fbc"));
  const hasMetaIds = Boolean(
    item.ctwa.campaign_id ||
      item.ctwa.adset_id ||
      item.ctwa.ad_id ||
      snapshot?.meta_campaign_id ||
      snapshot?.meta_adset_id ||
      snapshot?.meta_ad_id
  );
  const hasTrackedSource = !isDirectNoTracking(item);

  if (!hasTrackedSource) {
    return {
      key: "direct" as const,
      label: "直接 / 無追蹤",
      className: "bg-red-50 text-red-700",
    };
  }

  if ((hasFbclid || hasFbc) && (hasMetaIds || cleanLabel(item.campaignLabel))) {
    return {
      key: "strong" as const,
      label: "Tracking 強",
      className: "bg-emerald-50 text-emerald-700",
    };
  }

  if (
    hasFbp ||
    hasMetaIds ||
    cleanLabel(item.campaignLabel) ||
    cleanLabel(item.sourceLabel)
  ) {
    return {
      key: "partial" as const,
      label: "Tracking 不完整",
      className: "bg-blue-50 text-blue-700",
    };
  }

  return {
    key: "missing" as const,
    label: "缺少必要識別",
    className: "bg-amber-50 text-amber-700",
  };
}

function getSourceQualityRows(cases: CrmLeadCase[]) {
  const rows = new Map<string, SourceQualityRow>();

  cases.forEach((item) => {
    const source = getSourceGroup(item);
    const current =
      rows.get(source.key) ??
      ({
        key: source.key,
        label: source.label,
        meta: source.meta,
        isDirect: source.isDirect,
        leads: 0,
        validLeads: 0,
        contacted: 0,
        booked: 0,
        showed: 0,
        noShow: 0,
        lost: 0,
        invalid: 0,
        contactRate: 0,
        bookingRate: 0,
        showRate: 0,
        lostRate: 0,
        invalidRate: 0,
      } satisfies SourceQualityRow);

    current.leads += 1;
    if (item.status !== "invalid") current.validLeads += 1;
    if (isContactedOutcome(item)) current.contacted += 1;
    if (isBookedOutcome(item)) current.booked += 1;
    if (item.status === "showed") current.showed += 1;
    if (item.status === "no_show") current.noShow += 1;
    if (item.status === "lost") current.lost += 1;
    if (item.status === "invalid") current.invalid += 1;
    rows.set(source.key, current);
  });

  return Array.from(rows.values())
    .map((row) => ({
      ...row,
      contactRate: safeRate(row.contacted, row.validLeads),
      bookingRate: safeRate(row.booked, row.validLeads),
      showRate: safeRate(row.showed, row.booked),
      lostRate: safeRate(row.lost, row.validLeads),
      invalidRate: safeRate(row.invalid, row.leads),
    }))
    .sort((a, b) => {
      if (a.isDirect !== b.isDirect) return a.isDirect ? -1 : 1;
      return b.leads - a.leads || a.label.localeCompare(b.label);
    });
}

function getCampaignQualityRows(cases: CrmLeadCase[]) {
  const rows = new Map<string, CampaignQualityRow>();

  cases.forEach((item) => {
    const campaign = normalizeCampaignLabel(item.campaignLabel, item);
    const source = getSourceGroup(item).label;
    const key = `${source}|${campaign}`;
    const current =
      rows.get(key) ??
      ({
        key,
        campaign,
        source,
        leads: 0,
        booked: 0,
        showed: 0,
        lost: 0,
        bookingRate: 0,
        showRate: 0,
      } satisfies CampaignQualityRow);

    current.leads += 1;
    if (isBookedOutcome(item)) current.booked += 1;
    if (item.status === "showed") current.showed += 1;
    if (item.status === "lost") current.lost += 1;
    rows.set(key, current);
  });

  return Array.from(rows.values())
    .map((row) => ({
      ...row,
      bookingRate: safeRate(row.booked, row.leads),
      showRate: safeRate(row.showed, row.booked),
    }))
    .sort((a, b) => b.leads - a.leads || a.campaign.localeCompare(b.campaign));
}

function getDirectTrafficSummary(cases: CrmLeadCase[]) {
  const directCases = cases.filter((item) => getSourceGroup(item).isDirect);
  return {
    leads: directCases.length,
    share: safeRate(directCases.length, cases.length),
    booked: directCases.filter(isBookedOutcome).length,
    showed: directCases.filter((item) => item.status === "showed").length,
  };
}

function getTrackingCaptureAudit(cases: CrmLeadCase[], leadById: Map<string, LeadRow>) {
  const total = cases.length;
  const rows = cases.map((item) => ({
    item,
    lead: leadById.get(item.id) ?? null,
  }));

  const hasUtm = (lead: LeadRow | null) =>
    Boolean(
      cleanAttributionText(lead?.sourceSnapshot?.utm_source) ||
        cleanAttributionText(lead?.sourceSnapshot?.utm_medium) ||
        cleanAttributionText(lead?.sourceSnapshot?.utm_campaign) ||
        cleanAttributionText(lead?.sourceSnapshot?.utm_content)
    );
  const hasMetaId = (
    item: CrmLeadCase,
    lead: LeadRow | null,
    field: "campaign" | "adset" | "ad"
  ) => {
    if (field === "campaign") {
      return Boolean(
        cleanAttributionText(item.ctwa.campaign_id) ||
          cleanAttributionText(lead?.sourceSnapshot?.meta_campaign_id)
      );
    }
    if (field === "adset") {
      return Boolean(
        cleanAttributionText(item.ctwa.adset_id) ||
          cleanAttributionText(lead?.sourceSnapshot?.meta_adset_id)
      );
    }
    return Boolean(
      cleanAttributionText(item.ctwa.ad_id) ||
        cleanAttributionText(lead?.sourceSnapshot?.meta_ad_id)
    );
  };

  const withUtm = rows.filter(({ lead }) => hasUtm(lead)).length;
  const withFbclid = rows.filter(({ lead }) =>
    Boolean(cleanAttributionText(lead?.sourceSnapshot?.fbclid))
  ).length;
  const withFbp = rows.filter(({ lead }) => Boolean(sourceSnapshotExtra(lead, "fbp"))).length;
  const withFbc = rows.filter(({ lead }) => Boolean(sourceSnapshotExtra(lead, "fbc"))).length;
  const withMetaCampaignId = rows.filter(({ item, lead }) =>
    hasMetaId(item, lead, "campaign")
  ).length;
  const withMetaAdsetId = rows.filter(({ item, lead }) => hasMetaId(item, lead, "adset"))
    .length;
  const withMetaAdId = rows.filter(({ item, lead }) => hasMetaId(item, lead, "ad")).length;
  const directNoTracking = rows.filter(({ item }) => isDirectNoTracking(item)).length;
  const strongTracking = rows.filter(
    ({ lead }) =>
      Boolean(lead?.sourceSnapshot?.fbclid) ||
      Boolean(sourceSnapshotExtra(lead, "fbc")) ||
      Boolean(sourceSnapshotExtra(lead, "fbp"))
  ).length;
  const missingTracking = rows.filter(
    ({ item, lead }) =>
      !hasUtm(lead) &&
      !lead?.sourceSnapshot?.fbclid &&
      !sourceSnapshotExtra(lead, "fbp") &&
      !sourceSnapshotExtra(lead, "fbc") &&
      !hasMetaId(item, lead, "campaign") &&
      !hasMetaId(item, lead, "adset") &&
      !hasMetaId(item, lead, "ad")
  ).length;

  return {
    summary: {
      totalLeads: total,
      withUtm,
      withFbclid,
      withFbp,
      withFbc,
      withMetaCampaignId,
      withMetaAdsetId,
      withMetaAdId,
      directNoTracking,
      strongTrackingRate: safeRate(strongTracking, total),
      missingTrackingRate: safeRate(missingTracking, total),
    },
    coverageRows: [
      coverageRow("utm_source", total, rows.filter(({ lead }) => Boolean(cleanAttributionText(lead?.sourceSnapshot?.utm_source))).length, "主要來源，例如 meta / google。"),
      coverageRow("utm_medium", total, rows.filter(({ lead }) => Boolean(cleanAttributionText(lead?.sourceSnapshot?.utm_medium))).length, "媒介，例如 paid_social。"),
      coverageRow("utm_campaign", total, rows.filter(({ lead }) => Boolean(cleanAttributionText(lead?.sourceSnapshot?.utm_campaign))).length, "Campaign 報表與廣告組合分析。"),
      coverageRow("utm_content", total, rows.filter(({ lead }) => Boolean(cleanAttributionText(lead?.sourceSnapshot?.utm_content))).length, "廣告內容 / hook / creative。"),
      coverageRow("fbclid", total, withFbclid, "Meta click ID，對未來 matching 較重要。"),
      coverageRow("fbp", total, withFbp, "目前未見固定 typed source snapshot 欄位；建議未來安全保存。"),
      coverageRow("fbc", total, withFbc, "目前未見固定 typed source snapshot 欄位；可由 fbclid 建立。"),
      coverageRow("meta_campaign_id", total, withMetaCampaignId, "Meta campaign ID，如廣告平台或 URL 有提供。"),
      coverageRow("meta_adset_id", total, withMetaAdsetId, "Meta ad set ID，如廣告平台或 URL 有提供。"),
      coverageRow("meta_ad_id", total, withMetaAdId, "Meta ad ID，如廣告平台或 URL 有提供。"),
      coverageRow("parent_url", total, rows.filter(({ lead }) => Boolean(sourceSnapshotExtra(lead, "parent_url"))).length, "Wix parent URL 目前不是固定 typed 欄位；current_page_url / landing_page_url 只能部分輔助。"),
      coverageRow("landing_page_slug / slug", total, rows.filter(({ item }) => Boolean(item.landingPageSlug)).length, "由 landing page URL 或 CRM case landing_page_slug 推斷。"),
      coverageRow("form_id / form_token", total, rows.filter(({ lead }) => Boolean(lead?.form_id || lead?.form?.public_form_token)).length, "表格來源定位，可協助回查 campaign setup。"),
    ],
  };
}

function coverageRow(field: string, total: number, available: number, notes: string) {
  return {
    field,
    available,
    missing: Math.max(total - available, 0),
    coverageRate: safeRate(available, total),
    notes,
  } satisfies TrackingCoverageRow;
}

function sourceSnapshotExtra(lead: LeadRow | null, key: string) {
  const snapshot = (lead?.sourceSnapshot ?? {}) as Record<string, unknown>;
  const candidates = [
    snapshot,
    snapshot.submitted_touch_json,
    snapshot.latest_touch_json,
    snapshot.first_touch_json,
  ];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const value = stringValue((candidate as Record<string, unknown>)[key]);
    if (value) return value;
  }

  return "";
}

function getSourceGroup(item: CrmLeadCase) {
  if (isDirectNoTracking(item)) {
    return {
      key: "direct-no-tracking",
      label: "直接 / 無追蹤",
      meta: "缺少 UTM / click ID / campaign source",
      isDirect: true,
    };
  }

  const source = cleanLabel(item.sourceLabel) || item.sourceTypeRaw || "Unknown source";
  const campaign = cleanLabel(item.campaignLabel);
  const ad = cleanLabel(item.adLabel);
  const metaIds = [
    item.ctwa.campaign_id ? `campaign_id=${item.ctwa.campaign_id}` : null,
    item.ctwa.adset_id ? `adset_id=${item.ctwa.adset_id}` : null,
    item.ctwa.ad_id ? `ad_id=${item.ctwa.ad_id}` : null,
  ]
    .filter(Boolean)
    .join(" / ");

  return {
    key: [source, campaign, ad, metaIds].filter(Boolean).join("|"),
    label: source,
    meta: [campaign ? `Campaign: ${campaign}` : null, ad ? `Content: ${ad}` : null, metaIds || null]
      .filter(Boolean)
      .join(" / ") || "Tracked source",
    isDirect: false,
  };
}

function normalizeCampaignLabel(label: string, item: CrmLeadCase) {
  if (isDirectNoTracking(item)) return "直接 / 無追蹤";
  return cleanLabel(label) || item.ctwa.campaign_id || "未設定 Campaign";
}

function cleanLabel(value: string | null | undefined) {
  const text = cleanAttributionText(value) || "";
  if (!text || text === "-" || text.toLowerCase() === "unknown") return "";
  if (text.includes("未有") || text.includes("直接 / 無追蹤")) return "";
  return text;
}

function stringValue(value: unknown) {
  return cleanAttributionText(value) || "";
}

function isDirectNoTracking(item: CrmLeadCase) {
  const source = `${item.sourceLabel} ${item.sourceTypeRaw}`.toLowerCase();
  return (
    source.includes("organic_unknown") ||
    source.includes("direct") ||
    source.includes("no tracking") ||
    item.sourceLabel.includes("直接") ||
    item.sourceTypeRaw === "unknown"
  );
}

function isContactedOutcome(item: CrmLeadCase) {
  return ["contacting", "contacted", "booked", "showed", "no_show", "lost"].includes(
    item.status
  );
}

function isBookedOutcome(item: CrmLeadCase) {
  return ["booked", "showed", "no_show"].includes(item.status);
}

function countStatuses(cases: CrmLeadCase[], statuses: string[]) {
  return cases.filter((item) => statuses.includes(item.status)).length;
}

function safeRate(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function comparePriority(a: CrmLeadCase, b: CrmLeadCase) {
  const rankDelta = getPriorityRank(a) - getPriorityRank(b);
  if (rankDelta !== 0) return rankDelta;
  const aTime = getSortTime(a);
  const bTime = getSortTime(b);
  return aTime - bTime;
}

function getPriorityRank(item: CrmLeadCase) {
  if (isOverdueFollowUp(item)) return 0;
  if (isTodayFollowUp(item)) return 1;
  if (["new", "pending_follow_up"].includes(item.status)) return 2;
  if (["contacting", "contacted"].includes(item.status)) return 3;
  if (isPendingShowOutcome(item) || isTodayBooking(item)) return 4;
  if (item.status === "booked") return 5;
  return 6;
}

function getSortTime(item: CrmLeadCase) {
  if (item.nextFollowUpAt) return parseDate(item.nextFollowUpAt)?.getTime() ?? 0;
  if (item.confirmedBookingDate) {
    const bookingDate = parseBookingDateTime(item.confirmedBookingDate, item.confirmedBookingTime);
    if (bookingDate) return bookingDate.getTime();
  }
  return parseDate(item.createdAt)?.getTime() ?? 0;
}

function matchesQueue(item: CrmLeadCase, queue: string) {
  if (queue === "follow_up_today") return isTodayFollowUp(item);
  if (queue === "follow_up_overdue") return isOverdueFollowUp(item);
  if (queue === "today_bookings") return isTodayBooking(item);
  if (queue === "pending_show_outcome") return isPendingShowOutcome(item);
  if (queue === "contacting") return ["contacting", "contacted"].includes(item.status);
  if (queue === "new") return ["new", "pending_follow_up"].includes(item.status);
  return item.status === queue;
}

function isTodayFollowUp(item: CrmLeadCase) {
  return isToday(item.nextFollowUpAt);
}

function isOverdueFollowUp(item: CrmLeadCase) {
  const date = parseDate(item.nextFollowUpAt);
  if (!date) return false;
  return date.getTime() < Date.now() && !isToday(item.nextFollowUpAt);
}

function isTodayBooking(item: CrmLeadCase) {
  return item.status === "booked" && isTodayDateOnly(item.confirmedBookingDate);
}

function isPendingShowOutcome(item: CrmLeadCase) {
  if (item.status !== "booked") return false;
  const bookingDate = parseBookingDateTime(item.confirmedBookingDate, item.confirmedBookingTime);
  return Boolean(bookingDate && bookingDate.getTime() <= Date.now());
}

function isToday(value: string | null) {
  const date = parseDate(value);
  if (!date) return false;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function countTodayCreated(cases: CrmLeadCase[]) {
  return cases.filter((item) => isToday(item.createdAt)).length;
}

function isTodayDateOnly(value: string | null) {
  if (!value) return false;
  const today = new Date();
  const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return value === todayDate;
}

function parseDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseBookingDateTime(date: string | null, time: string | null) {
  if (!date) return null;
  const normalizedTime = time ? (time.length === 5 ? `${time}:00` : time) : "23:59:59";
  const parsed = new Date(`${date}T${normalizedTime}+08:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeInboxPreset(value: string | string[] | undefined): CrmInboxPreset {
  const preset = Array.isArray(value) ? value[0] : value;
  return crmInboxPresets.some((item) => item.key === preset)
    ? (preset as CrmInboxPreset)
    : "cs_booking";
}

function normalizeCrmTab(value: string | string[] | undefined): CrmTabKey {
  const tab = Array.isArray(value) ? value[0] : value;
  if (tab === "dashboard") return "dashboard";
  if (tab === "reports") return "reports";
  return tabs.some((item) => item.key === tab) ? (tab as CrmTabKey) : "leads";
}

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
