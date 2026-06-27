import { CrmInboxTable } from "@/components/crm/CrmInboxTable";
import { CrmShell } from "@/components/crm/CrmShell";
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
} from "@/lib/crm/store";
import { dateRangeOptions, getLeadRows, parseRange } from "@/lib/data/businessMetrics";

export const dynamic = "force-dynamic";

const tabs = ["Leads", "Bookings", "Contacts", "Follow-up", "Reports"];

const queueOptions = [
  ["", "All"],
  ["new", "New"],
  ["contacting", "Contacting"],
  ["booked", "Booked"],
  ["follow_up_today", "Today follow-up"],
  ["follow_up_overdue", "Overdue follow-up"],
  ["today_bookings", "Today bookings"],
  ["pending_show_outcome", "Pending show outcome"],
  ["showed", "Showed"],
  ["no_show", "No-show"],
  ["lost", "Lost"],
  ["invalid", "Invalid"],
];

export default async function CrmPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const range = parseRange(query?.range);
  const search = firstQueryValue(query?.search)?.trim() || "";
  const brand = firstQueryValue(query?.brand)?.trim().toLowerCase() || "";
  const treatment = firstQueryValue(query?.treatment)?.trim().toLowerCase() || "";
  const queue = firstQueryValue(query?.queue)?.trim() || "";
  const source = firstQueryValue(query?.source)?.trim().toLowerCase() || "";
  const { leads, error } = await getLeadRows(range, 500, { query: search });
  const [runtime, crmCasesByLeadId] = await Promise.all([
    getCrmRuntimeStatus(),
    getCrmCasesBySourceLeadIds(leads.map((lead) => lead.id)),
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
  const cases = baseFilteredCases
    .filter((item) => (queue ? matchesQueue(item, queue) : true))
    .sort(comparePriority);

  return (
    <CrmShell>
      <div className="flex h-screen min-w-0 flex-col">
        <header className="shrink-0 border-b border-[#e5e7eb] bg-white">
          <div className="flex flex-col gap-2.5 px-4 py-2.5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg font-bold text-[#111827]">CS Command Center</h1>
                <span className="rounded-md bg-[#ecfdf5] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#047857]">
                  {runtime.actionsEnabled ? "Actions enabled" : "Read-only"}
                </span>
              </div>
              <p className="mt-1 text-[11px] font-semibold text-[#64748b]">
                每日跟進工作台：先處理過期跟進、今日跟進，再處理新 Leads 及今日預約。
              </p>
            </div>
          </div>

          <div className="grid gap-2 border-t border-[#f1f5f9] px-4 py-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-9">
            <SummaryCard label="待跟進" value={summary.newLeads} tone="blue" />
            <SummaryCard label="已聯絡" value={summary.contacting} tone="slate" />
            <SummaryCard label="已預約" value={summary.booked} tone="emerald" />
            <SummaryCard label="今日要跟" value={summary.todayFollowUp} tone="amber" />
            <SummaryCard label="過期未跟" value={summary.overdueFollowUp} tone="red" />
            <SummaryCard label="今日預約" value={summary.todayBookings} tone="purple" />
            <SummaryCard label="待標記到店結果" value={summary.pendingShowOutcome} tone="orange" />
            <SummaryCard label="Lost" value={summary.lost} tone="slate" />
            <SummaryCard label="Invalid" value={summary.invalid} tone="slate" />
          </div>

          <div className="flex min-w-0 flex-col gap-2 border-t border-[#f1f5f9] px-4 py-2 xl:flex-row xl:items-center xl:justify-between">
            <nav className="flex gap-0.5 overflow-x-auto">
              {tabs.map((tab, index) => (
                <button
                  key={tab}
                  type="button"
                  disabled={index !== 0}
                  className={`h-8 whitespace-nowrap rounded-md px-2.5 text-[13px] font-semibold ${
                    index === 0
                      ? "bg-[#111827] text-white"
                      : "text-[#94a3b8] hover:bg-[#f8fafc]"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </nav>

            <form className="flex min-w-0 flex-wrap items-center gap-2">
              <select
                name="range"
                defaultValue={range}
                className="h-9 rounded-md border border-[#dbe2ea] bg-white px-2.5 text-[12px] font-semibold text-[#334155]"
              >
                {dateRangeOptions.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
              <input
                name="brand"
                defaultValue={firstQueryValue(query?.brand) || ""}
                placeholder="Brand"
                className="h-9 w-[120px] rounded-md border border-[#dbe2ea] bg-white px-2.5 text-[12px] font-semibold text-[#334155]"
              />
              <input
                name="treatment"
                defaultValue={firstQueryValue(query?.treatment) || ""}
                placeholder="Treatment"
                className="h-9 w-[140px] rounded-md border border-[#dbe2ea] bg-white px-2.5 text-[12px] font-semibold text-[#334155]"
              />
              <select
                name="queue"
                defaultValue={queue}
                className="h-9 rounded-md border border-[#dbe2ea] bg-white px-2.5 text-[12px] font-semibold text-[#334155]"
              >
                {queueOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                name="source"
                defaultValue={firstQueryValue(query?.source) || ""}
                placeholder="Source / campaign"
                className="h-9 w-[160px] rounded-md border border-[#dbe2ea] bg-white px-2.5 text-[12px] font-semibold text-[#334155]"
              />
              <label className="min-w-[220px] flex-1 xl:w-[320px] xl:flex-none">
                <span className="sr-only">Search CRM inbox</span>
                <input
                  name="search"
                  type="search"
                  defaultValue={search}
                  placeholder="Search name, phone, CTWA ID, campaign..."
                  className="h-9 w-full rounded-md border border-[#dbe2ea] bg-[#f8fafc] px-3 text-[12px] font-semibold text-[#111827] outline-none transition placeholder:text-[#94a3b8] focus:border-[#2563eb] focus:bg-white"
                />
              </label>
              <button
                type="submit"
                className="h-9 whitespace-nowrap rounded-md bg-[#111827] px-3 text-[12px] font-bold text-white"
              >
                Filter
              </button>
            </form>
          </div>

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

        <CrmInboxTable cases={cases} />
      </div>
    </CrmShell>
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

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "blue" | "emerald" | "amber" | "red" | "purple" | "orange" | "slate";
}) {
  const toneClass: Record<typeof tone, string> = {
    blue: "border-blue-100 bg-blue-50 text-blue-800",
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-800",
    amber: "border-amber-100 bg-amber-50 text-amber-800",
    red: "border-red-100 bg-red-50 text-red-800",
    purple: "border-purple-100 bg-purple-50 text-purple-800",
    orange: "border-orange-100 bg-orange-50 text-orange-800",
    slate: "border-slate-100 bg-slate-50 text-slate-700",
  };

  return (
    <div className={`rounded-lg border px-3 py-2 ${toneClass[tone]}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.08em] opacity-75">
        {label}
      </p>
      <p className="mt-1 text-xl font-black leading-none">{value}</p>
    </div>
  );
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

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
