import { CrmInboxTable } from "@/components/crm/CrmInboxTable";
import { CrmShell } from "@/components/crm/CrmShell";
import { summarizeCrmCases, toCrmLeadCase } from "@/lib/crm/leadOps";
import {
  applyCrmRecordToLeadCase,
  getCrmCasesBySourceLeadIds,
  getCrmRuntimeStatus,
} from "@/lib/crm/store";
import { dateRangeOptions, getLeadRows, parseRange } from "@/lib/data/businessMetrics";

export const dynamic = "force-dynamic";

const tabs = ["Leads", "Bookings", "Contacts", "Follow-up", "Reports"];

const queueOptions = [
  ["", "All queues"],
  ["new", "待跟進"],
  ["contacting", "已聯絡"],
  ["booked", "已預約"],
  ["follow_up_today", "今日 follow-up"],
  ["follow_up_overdue", "過期 follow-up"],
  ["showed", "已完成 / 已到店"],
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
  const cases = leads
    .map((lead) =>
      applyCrmRecordToLeadCase(toCrmLeadCase(lead), crmCasesByLeadId.get(lead.id) ?? null)
    )
    .filter((item) => {
      if (brand && !item.brandName.toLowerCase().includes(brand)) return false;
      if (treatment && !item.treatmentOffer.toLowerCase().includes(treatment)) return false;
      if (queue && !matchesQueue(item.status, item.nextFollowUpAt, queue)) return false;
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
  const summary = summarizeCrmCases(cases);

  return (
    <CrmShell>
      <div className="flex h-screen min-w-0 flex-col">
        <header className="shrink-0 border-b border-[#e5e7eb] bg-white">
          <div className="flex flex-col gap-2.5 px-4 py-2.5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg font-bold text-[#111827]">Inbox</h1>
                <span className="rounded-md bg-[#ecfdf5] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#047857]">
                  {runtime.actionsEnabled ? "Actions enabled" : "Read-only"}
                </span>
              </div>
              <p className="mt-1 text-[11px] font-semibold text-[#64748b]">
                CS follow-up workbench for lead, confirmed booking, show and no-show monitoring.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[10px] font-bold text-[#475569] sm:flex">
              <Metric label="待跟進" value={summary.pendingFollowUp} />
              <Metric label="有跟進時間" value={summary.nextFollowUp} />
              <Metric label="已預約" value={summary.booked} />
              <Metric label="已到店" value={summary.showed} />
              <Metric label="No-show" value={summary.noShow} />
            </div>
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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-[#e5e7eb] bg-[#f8fafc] px-2.5 py-1.5">
      <span className="text-[#64748b]">{label}</span>
      <span className="ml-2 text-[#111827]">{value}</span>
    </div>
  );
}

function matchesQueue(status: string, nextFollowUpAt: string | null, queue: string) {
  if (queue === "follow_up_today") return isToday(nextFollowUpAt);
  if (queue === "follow_up_overdue") return isOverdue(nextFollowUpAt);
  return status === queue;
}

function isToday(value: string | null) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function isOverdue(value: string | null) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() < Date.now() && !isToday(value);
}

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
