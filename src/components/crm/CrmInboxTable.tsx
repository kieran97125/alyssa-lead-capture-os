import Link from "next/link";
import type { ReactNode } from "react";
import { CrmStatusBadge } from "@/components/crm/CrmStatusBadge";
import type { CrmLeadCase } from "@/lib/crm/leadOps";

const headings = [
  "Status",
  "Customer",
  "Phone / WhatsApp",
  "Treatment / Offer",
  "偏好日期時間",
  "CS 確認預約",
  "Follow-up",
  "Booking outcome",
  "Last updated",
  "Action",
];

export function CrmInboxTable({ cases }: { cases: CrmLeadCase[] }) {
  return (
    <div className="min-h-0 flex-1 overflow-hidden border-t border-[#e5e7eb] bg-white">
      <div className="h-full overflow-auto">
        <table className="min-w-[1260px] table-fixed border-separate border-spacing-0 text-left text-[12px] leading-5">
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
                  className="h-[52px] align-middle text-[#1f2933] transition hover:bg-[#f8fafc]"
                >
                  <Cell>
                    <CrmStatusBadge status={item.status} label={item.statusLabel} />
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
                    <span className="block whitespace-nowrap font-semibold">
                      {item.normalizedPhone || item.phone}
                    </span>
                    <div className="mt-1 flex items-center gap-1.5 whitespace-nowrap">
                      {item.whatsappUrl ? (
                        <a
                          href={item.whatsappUrl}
                          target="_blank"
                          rel="noreferrer"
                          title="Open WhatsApp manually"
                          className="inline-flex h-6 items-center justify-center rounded-md border border-[#bbf7d0] bg-[#f0fdf4] px-2 text-[10px] font-black text-[#15803d] transition hover:bg-[#dcfce7]"
                        >
                          Open WA
                        </a>
                      ) : (
                        <span className="text-[10px] font-semibold text-[#94a3b8]">
                          No WA link
                        </span>
                      )}
                    </div>
                  </Cell>
                  <Cell>
                    <span className="block truncate font-semibold">
                      {item.treatmentOffer}
                    </span>
                    <span className="block truncate text-[10px] text-[#64748b]">
                      {item.packagePrice} / {item.branchName}
                    </span>
                  </Cell>
                  <Cell>
                    <span className="block truncate font-semibold">
                      {item.appointmentLabel}
                    </span>
                    <span className="block truncate text-[10px] text-[#64748b]">
                      客人填寫，未等於已預約
                    </span>
                  </Cell>
                  <Cell>
                    <BookingCell item={item} />
                  </Cell>
                  <Cell>
                    <FollowUpCell value={item.nextFollowUpAt} label={item.nextFollowUpLabel} />
                  </Cell>
                  <Cell>
                    <BookingOutcomeCell item={item} />
                  </Cell>
                  <Cell>
                    <span className="block whitespace-nowrap font-semibold">
                      {item.lastActivityLabel}
                    </span>
                    <span className="block whitespace-nowrap text-[10px] text-[#64748b]">
                      Created {item.createdLabel}
                    </span>
                  </Cell>
                  <Cell>
                    <Link
                      href={`/crm/leads/${item.id}`}
                      title="Open detail"
                      className="inline-flex h-7 min-w-7 items-center justify-center rounded-md border border-[#dbeafe] bg-[#eff6ff] px-2 text-[10px] font-bold text-[#1d4ed8] transition hover:bg-[#dbeafe]"
                    >
                      Open
                    </Link>
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

function BookingCell({ item }: { item: CrmLeadCase }) {
  const state = getBookingState(item);

  return (
    <div className="grid gap-1">
      <span className="whitespace-nowrap text-[11px] font-semibold text-[#64748b]">
        {item.confirmedBookingLabel}
      </span>
      {state ? (
        <span
          className={`w-fit rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] ${
            state === "pending"
              ? "bg-orange-50 text-orange-700"
              : "bg-purple-50 text-purple-700"
          }`}
        >
          {state === "pending" ? "待標記結果" : "今日預約"}
        </span>
      ) : null}
    </div>
  );
}

function BookingOutcomeCell({ item }: { item: CrmLeadCase }) {
  if (item.status === "showed") {
    return <OutcomeBadge tone="emerald">已到店</OutcomeBadge>;
  }
  if (item.status === "no_show") {
    return <OutcomeBadge tone="red">No-show</OutcomeBadge>;
  }
  if (item.status === "lost") {
    return <OutcomeBadge tone="slate">已流失</OutcomeBadge>;
  }
  if (item.status === "invalid") {
    return <OutcomeBadge tone="slate">無效</OutcomeBadge>;
  }
  if (item.status === "booked") {
    return <OutcomeBadge tone="purple">已預約</OutcomeBadge>;
  }
  return <OutcomeBadge tone="amber">待跟進</OutcomeBadge>;
}

function OutcomeBadge({
  tone,
  children,
}: {
  tone: "emerald" | "red" | "slate" | "purple" | "amber";
  children: ReactNode;
}) {
  const classes = {
    emerald: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-700",
    slate: "bg-slate-100 text-slate-700",
    purple: "bg-purple-50 text-purple-700",
    amber: "bg-amber-50 text-amber-700",
  };

  return (
    <span className={`w-fit rounded px-1.5 py-0.5 text-[10px] font-black ${classes[tone]}`}>
      {children}
    </span>
  );
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
          {state === "overdue" ? "過期" : state === "today" ? "今日" : "稍後"}
        </span>
      ) : null}
    </div>
  );
}

function getBookingState(item: CrmLeadCase) {
  if (item.status !== "booked") return null;
  const bookingDate = parseBookingDateTime(item.confirmedBookingDate, item.confirmedBookingTime);
  if (bookingDate && bookingDate.getTime() <= Date.now()) return "pending";
  if (isTodayDateOnly(item.confirmedBookingDate)) return "today";
  return null;
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

function isTodayDateOnly(value: string | null) {
  if (!value) return false;
  const today = new Date();
  const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return value === todayDate;
}

function parseBookingDateTime(date: string | null, time: string | null) {
  if (!date) return null;
  const normalizedTime = time ? (time.length === 5 ? `${time}:00` : time) : "23:59:59";
  const parsed = new Date(`${date}T${normalizedTime}+08:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
