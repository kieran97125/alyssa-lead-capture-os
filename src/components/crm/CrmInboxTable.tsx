import Link from "next/link";
import type { ReactNode } from "react";
import { CrmStatusBadge } from "@/components/crm/CrmStatusBadge";
import type { CrmLeadCase } from "@/lib/crm/leadOps";

const headings = [
  "Created at",
  "Customer",
  "Phone",
  "Brand",
  "Treatment / Package",
  "偏好日期時間",
  "Source",
  "Campaign / Content",
  "Status",
  "Next follow-up",
  "Action",
];

export function CrmInboxTable({ cases }: { cases: CrmLeadCase[] }) {
  return (
    <div className="min-h-0 flex-1 overflow-hidden border-t border-[#e5e7eb] bg-white">
      <div className="h-full overflow-auto">
        <table className="min-w-[1320px] table-fixed border-separate border-spacing-0 text-left text-[12px] leading-5">
          <thead className="sticky top-0 z-10 bg-[#f9fafb]">
            <tr className="h-9 text-[10px] font-bold uppercase tracking-[0.08em] text-[#6b7280]">
              {headings.map((heading) => (
                <th key={heading} className="border-b border-[#e5e7eb] px-2.5 py-2">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cases.length > 0 ? (
              cases.map((item) => (
                <tr
                  key={item.id}
                  className="h-[50px] align-middle text-[#1f2933] transition hover:bg-[#f8fafc]"
                >
                  <Cell>
                    <span className="block whitespace-nowrap font-semibold">
                      {item.createdLabel}
                    </span>
                  </Cell>
                  <Cell>
                    <Link
                      href={`/crm/leads/${item.id}`}
                      className="block min-w-0 text-[12px] font-bold text-[#111827] hover:text-[#0f766e]"
                    >
                      <span className="block truncate">{item.customerName}</span>
                      <span className="block truncate font-mono text-[10px] font-semibold text-[#64748b]">
                        {item.canonicalIdentity}
                      </span>
                    </Link>
                  </Cell>
                  <Cell>
                    <span className="whitespace-nowrap font-semibold">
                      {item.normalizedPhone || item.phone}
                    </span>
                    <span className="block truncate text-[10px] text-[#64748b]">
                      {item.email}
                    </span>
                  </Cell>
                  <Cell>
                    <span className="block truncate font-semibold">{item.brandName}</span>
                    <span className="block truncate text-[10px] text-[#64748b]">
                      {item.branchName}
                    </span>
                  </Cell>
                  <Cell>
                    <span className="block truncate font-semibold">
                      {item.treatmentOffer}
                    </span>
                    <span className="block truncate text-[10px] text-[#64748b]">
                      {item.packagePrice}
                    </span>
                  </Cell>
                  <Cell>
                    <span className="block truncate font-semibold">
                      {item.appointmentLabel}
                    </span>
                  </Cell>
                  <Cell>
                    <span className="block whitespace-nowrap font-semibold">
                      {item.sourceLabel}
                    </span>
                    <span className="block truncate text-[10px] text-[#64748b]">
                      {item.sourceTypeRaw}
                    </span>
                  </Cell>
                  <Cell>
                    <span className="block truncate font-semibold">
                      {item.campaignLabel}
                    </span>
                    <span className="block truncate text-[10px] text-[#64748b]">
                      {item.adLabel}
                    </span>
                  </Cell>
                  <Cell>
                    <CrmStatusBadge status={item.status} label={item.statusLabel} />
                  </Cell>
                  <Cell>
                    <FollowUpCell value={item.nextFollowUpAt} label={item.nextFollowUpLabel} />
                  </Cell>
                  <Cell>
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      {item.whatsappUrl ? (
                        <a
                          href={item.whatsappUrl}
                          target="_blank"
                          rel="noreferrer"
                          title="Open WhatsApp"
                          className="inline-flex h-7 min-w-7 items-center justify-center rounded-md border border-[#bbf7d0] bg-[#f0fdf4] px-2 text-[10px] font-black text-[#15803d] transition hover:bg-[#dcfce7]"
                        >
                          WA
                        </a>
                      ) : null}
                      <Link
                        href={`/crm/leads/${item.id}`}
                        title="Open detail"
                        className="inline-flex h-7 min-w-7 items-center justify-center rounded-md border border-[#dbeafe] bg-[#eff6ff] px-2 text-[10px] font-bold text-[#1d4ed8] transition hover:bg-[#dbeafe]"
                      >
                        Open
                      </Link>
                    </div>
                  </Cell>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={headings.length} className="px-4 py-10 text-center text-[#64748b]">
                  No CRM inbox records.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Cell({ children }: { children: ReactNode }) {
  return <td className="border-b border-[#eef2f6] px-2.5 py-1.5">{children}</td>;
}

function FollowUpCell({ value, label }: { value: string | null; label: string }) {
  const state = getFollowUpState(value);

  return (
    <div className="grid gap-1">
      <span className="whitespace-nowrap text-[11px] font-semibold text-[#64748b]">
        {label}
      </span>
      {state ? (
        <span
          className={`w-fit rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] ${
            state === "overdue"
              ? "bg-red-50 text-red-700"
              : state === "today"
                ? "bg-amber-50 text-amber-700"
                : "bg-slate-100 text-slate-600"
          }`}
        >
          {state === "overdue" ? "過期" : state === "today" ? "今日" : "已安排"}
        </span>
      ) : null}
    </div>
  );
}

function getFollowUpState(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (date.getTime() < now.getTime() && !isSameDay) return "overdue";
  if (isSameDay) return "today";
  return "upcoming";
}
