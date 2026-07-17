import Link from "next/link";
import type { ReactNode } from "react";
import { CrmStatusBadge } from "@/components/crm/CrmStatusBadge";
import type { CrmLeadCase, CrmStatus } from "@/lib/crm/leadOps";

export type CrmInboxPreset = "cs_booking" | "marketing" | "technical";

export const crmInboxPresets: Array<{
  key: CrmInboxPreset;
  label: string;
  description: string;
}> = [
  {
    key: "cs_booking",
    label: "CS Booking View",
    description: "日常跟進、預約及到店結果",
  },
  {
    key: "marketing",
    label: "Marketing View",
    description: "來源、Campaign、廣告內容",
  },
  {
    key: "technical",
    label: "Technical Audit View",
    description: "CTWA、表格、頁面及追蹤欄位",
  },
];

const defaultHeadings = [
  "",
  "Last contact",
  "Assigned to",
  "Customer",
  "WhatsApp",
  "Status",
  "Phone",
  "Treatment / offer",
  "Preferred appointment",
  "Confirmed booking",
  "Follow-up",
  "Outcome",
  "Actions",
];

const marketingHeadings = [
  "Source",
  "Campaign",
  "Content",
  "Meta campaign ID",
  "Meta adset ID",
  "Meta ad ID",
];

const technicalHeadings = [
  "Email",
  "Contact created",
  "CTWA Source ID",
  "CTWA Source URL",
  "Landing page",
  "Form / page URL",
  "fbclid / fbp / fbc",
];

export function CrmInboxTable({
  cases,
  preset = "cs_booking",
}: {
  cases: CrmLeadCase[];
  preset?: CrmInboxPreset;
}) {
  const extraHeadings =
    preset === "marketing"
      ? marketingHeadings
      : preset === "technical"
        ? technicalHeadings
        : [];
  const colSpan = defaultHeadings.length + extraHeadings.length;

  return (
    <div
      data-testid="crm-inbox-layout"
      className="min-h-0 flex-1 overflow-hidden border-t border-[#e5e7eb] bg-white"
    >
      <div className="h-full overflow-auto">
        <table
          data-testid="crm-inbox-table"
          className="min-w-[1380px] table-fixed border-separate border-spacing-0 text-left text-[12px] leading-5"
        >
          <thead className="sticky top-0 z-10 bg-[#f9fafb]">
            <tr className="h-9 text-[10px] font-bold uppercase tracking-[0.08em] text-[#6b7280]">
              {[...defaultHeadings, ...extraHeadings].map((heading, index) => (
                <th key={`${heading}-${index}`} className="border-b border-[#e5e7eb] px-2.5 py-2">
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
                  data-testid="crm-inbox-row"
                  className="h-[54px] align-middle text-[#1f2933] transition hover:bg-[#f8fafc]"
                >
                  <Cell narrow>
                    <input
                      type="checkbox"
                      aria-label={`Select ${item.customerName}`}
                      className="h-3.5 w-3.5 rounded border-[#cbd5e1]"
                    />
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
                    <span className="inline-flex rounded-md bg-[#f1f5f9] px-2 py-1 text-[10px] font-black text-[#475569]">
                      {cleanUnknown(item.assignedCsLabel) || "未分配"}
                    </span>
                  </Cell>
                  <Cell>
                    <Link
                      href={`/crm/leads/${item.id}`}
                      className="flex min-w-0 items-center gap-2 text-[12px] font-bold text-[#111827] hover:text-[#0f766e]"
                    >
                      <Avatar name={item.customerName} />
                      <span className="min-w-0">
                        <span className="block truncate">{item.customerName}</span>
                        <span className="block truncate font-mono text-[10px] font-semibold text-[#64748b]">
                          {item.canonicalIdentity}
                        </span>
                      </span>
                    </Link>
                  </Cell>
                  <Cell>
                    {item.whatsappUrl ? (
                      <a
                        href={item.whatsappUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="Manual WhatsApp open only"
                        className="inline-flex h-7 items-center justify-center rounded-md border border-[#bbf7d0] bg-[#f0fdf4] px-2 text-[10px] font-black text-[#15803d] transition hover:bg-[#dcfce7]"
                      >
                        WA
                      </a>
                    ) : (
                      <span className="text-[10px] font-semibold text-[#94a3b8]">
                        No WA
                      </span>
                    )}
                  </Cell>
                  <Cell>
                    <CrmStatusBadge status={item.status} label={statusLabel(item.status)} />
                  </Cell>
                  <Cell>
                    <span className="block whitespace-nowrap font-semibold">
                      {item.normalizedPhone || item.phone || "-"}
                    </span>
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
                      客人偏好時間，未等於已預約
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
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <Link
                        href={`/crm/leads/${item.id}`}
                        title="Open lead"
                        className="inline-flex h-7 min-w-7 items-center justify-center rounded-md border border-[#dbeafe] bg-[#eff6ff] px-2 text-[10px] font-bold text-[#1d4ed8] transition hover:bg-[#dbeafe]"
                      >
                        Open
                      </Link>
                      {item.whatsappUrl ? (
                        <a
                          href={item.whatsappUrl}
                          target="_blank"
                          rel="noreferrer"
                          title="Open WhatsApp manually"
                          className="inline-flex h-7 min-w-7 items-center justify-center rounded-md border border-[#bbf7d0] bg-[#f0fdf4] px-2 text-[10px] font-bold text-[#15803d] transition hover:bg-[#dcfce7]"
                        >
                          WA
                        </a>
                      ) : null}
                    </div>
                  </Cell>

                  {preset === "marketing" ? <MarketingCells item={item} /> : null}
                  {preset === "technical" ? <TechnicalCells item={item} /> : null}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={colSpan} className="px-4 py-10 text-center text-[#64748b]">
                  目前沒有符合條件的 CRM inbox records。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Cell({
  children,
  narrow = false,
}: {
  children: ReactNode;
  narrow?: boolean;
}) {
  return (
    <td className={`border-b border-[#eef2f6] px-2.5 py-1.5 ${narrow ? "w-9" : ""}`}>
      {children}
    </td>
  );
}

function MarketingCells({ item }: { item: CrmLeadCase }) {
  return (
    <>
      <Cell>{cleanUnknown(item.sourceLabel) || "-"}</Cell>
      <Cell>{cleanUnknown(item.campaignLabel) || "-"}</Cell>
      <Cell>{cleanUnknown(item.adLabel) || "-"}</Cell>
      <Cell>{item.ctwa.campaign_id || "-"}</Cell>
      <Cell>{item.ctwa.adset_id || "-"}</Cell>
      <Cell>{item.ctwa.ad_id || "-"}</Cell>
    </>
  );
}

function TechnicalCells({ item }: { item: CrmLeadCase }) {
  return (
    <>
      <Cell>{cleanUnknown(item.email) || "-"}</Cell>
      <Cell>{item.createdLabel}</Cell>
      <Cell>{item.ctwa.ctwa_source_id || "-"}</Cell>
      <Cell>
        {item.ctwa.ctwa_source_url ? (
          <a
            href={item.ctwa.ctwa_source_url}
            target="_blank"
            rel="noreferrer"
            className="font-bold text-[#2563eb] hover:underline"
          >
            Source URL
          </a>
        ) : (
          "-"
        )}
      </Cell>
      <Cell>{item.landingPageSlug || "-"}</Cell>
      <Cell>
        {item.pageUrl ? (
          <a
            href={item.pageUrl}
            target="_blank"
            rel="noreferrer"
            className="font-bold text-[#2563eb] hover:underline"
          >
            Page URL
          </a>
        ) : (
          "-"
        )}
      </Cell>
      <Cell>
        <span className="text-[10px] font-semibold text-[#94a3b8]">
          Detailed fbclid / fbp / fbc coverage is in Reports.
        </span>
      </Cell>
    </>
  );
}

function Avatar({ name }: { name: string }) {
  const initial = (name.trim()[0] || "?").toUpperCase();

  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#eef2ff] text-[12px] font-black text-[#4338ca]">
      {initial}
    </span>
  );
}

function BookingCell({ item }: { item: CrmLeadCase }) {
  const state = getBookingState(item);

  return (
    <div className="grid gap-1">
      <span className="whitespace-nowrap text-[11px] font-semibold text-[#64748b]">
        {cleanUnconfirmed(item.confirmedBookingLabel)}
      </span>
      {state ? (
        <span
          className={`w-fit rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] ${
            state === "pending"
              ? "bg-orange-50 text-orange-700"
              : "bg-purple-50 text-purple-700"
          }`}
        >
          {state === "pending" ? "待標記到店" : "今日預約"}
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
    return <OutcomeBadge tone="slate">Lost</OutcomeBadge>;
  }
  if (item.status === "invalid") {
    return <OutcomeBadge tone="slate">Invalid</OutcomeBadge>;
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
        {cleanUnknown(label) || "未設定"}
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

function statusLabel(status: CrmStatus) {
  const labels: Record<CrmStatus, string> = {
    pending_follow_up: "待跟進",
    contacted: "已聯絡",
    booked: "已預約",
    showed: "已到店",
    no_show: "No-show",
    cancelled: "已取消",
    no_reply: "未回覆",
    lost: "Lost",
    new: "待跟進",
    contacting: "已聯絡",
    confirmed: "已確認",
    paid: "已付款",
    invalid: "Invalid",
  };
  return labels[status] ?? status;
}

function cleanUnknown(value: string | null | undefined) {
  const text = (value ?? "").trim();
  if (!text || text.includes("?") || text.toLowerCase() === "unknown") return "";
  return text;
}

function cleanUnconfirmed(value: string | null | undefined) {
  const cleaned = cleanUnknown(value);
  return cleaned || "未確認預約";
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
