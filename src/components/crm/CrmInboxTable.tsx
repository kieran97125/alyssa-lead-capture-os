import { IntentPrefetchLink } from "@/components/alyssa/IntentPrefetchLink";
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
    label: "CS 預約跟進",
    description: "日常跟進、預約及到店結果",
  },
  {
    key: "marketing",
    label: "營銷分析",
    description: "來源、Campaign、廣告內容",
  },
  {
    key: "technical",
    label: "追蹤檢查",
    description: "CTWA、表格、頁面及追蹤欄位",
  },
];

const defaultHeadings = [
  "",
  "最近聯絡",
  "負責人",
  "客人",
  "WhatsApp",
  "狀態",
  "電話",
  "療程／優惠",
  "偏好時間",
  "已確認預約",
  "跟進",
  "結果",
  "操作",
];

const marketingHeadings = [
  "來源",
  "Campaign",
  "廣告內容",
  "Meta campaign ID",
  "Meta adset ID",
  "Meta ad ID",
];

const technicalHeadings = [
  "Email",
  "建立時間",
  "CTWA Source ID",
  "CTWA Source URL",
  "登記頁",
  "表格／頁面網址",
  "fbclid / fbp / fbc",
];

const e2eInboxCases: CrmLeadCase[] = [
  {
    id: "playwright-layout-fixture",
    createdAt: "2026-07-17T01:00:00.000Z",
    lastActivityAt: "2026-07-17T02:00:00.000Z",
    createdLabel: "2026年7月17日 上午9:00",
    lastActivityLabel: "2026年7月17日 上午10:00",
    customerName: "Alyssa Layout Check",
    phone: "+85291234567",
    normalizedPhone: "+85291234567",
    email: "layout-check@example.invalid",
    brandName: "Alyssa",
    brandSlug: "alyssa",
    canonicalIdentity: "e2e:+85291234567",
    treatmentOffer: "CRM Desktop Acceptance",
    packagePrice: "HK$888",
    branchName: "Central",
    appointmentLabel: "2026-07-20 14:00",
    crmSourceType: "landing_form",
    sourceLabel: "Landing Page / 網站表格",
    sourceTypeRaw: "reg_form_utm",
    campaignLabel: "Playwright Acceptance",
    adLabel: "Horizontal Row Reference",
    landingPageSlug: "playwright-layout-check",
    pageUrl: "https://example.invalid/lp/playwright-layout-check",
    status: "new",
    statusLabel: "待跟進",
    assignedCsLabel: "未分配",
    nextFollowUpLabel: "今日跟進",
    nextFollowUpAt: "2026-07-17T04:00:00.000Z",
    confirmedBookingDate: null,
    confirmedBookingTime: null,
    confirmedBookingLabel: "未確認",
    bookingStatus: null,
    whatsappUrl: "https://wa.me/85291234567",
    ctwa: {
      ctwa_source_id: null,
      ctwa_source_url: null,
      ctwa_referral_headline: null,
      ctwa_referral_body: null,
      campaign_id: null,
      adset_id: null,
      ad_id: null,
      phone_number_id: null,
      whatsapp_business_account_id: null,
    },
  },
];

export function CrmInboxTable({
  cases,
  preset = "cs_booking",
}: {
  cases: CrmLeadCase[];
  preset?: CrmInboxPreset;
}) {
  const inboxCases =
    process.env.ALYSSA_E2E_FIXTURES === "1" ? e2eInboxCases : cases;
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
            {inboxCases.length > 0 ? (
              inboxCases.map((item) => (
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
                      建立於 {item.createdLabel}
                    </span>
                  </Cell>
                  <Cell>
                    <span className="inline-flex rounded-md bg-[#f1f5f9] px-2 py-1 text-[10px] font-black text-[#475569]">
                      {cleanUnknown(item.assignedCsLabel) || "未分配"}
                    </span>
                  </Cell>
                  <Cell>
                    <IntentPrefetchLink
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
                    </IntentPrefetchLink>
                  </Cell>
                  <Cell>
                    {item.whatsappUrl ? (
                      <a
                        href={item.whatsappUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="只會開啟 WhatsApp，不會自動發送"
                        className="inline-flex h-7 items-center justify-center rounded-md border border-[#bbf7d0] bg-[#f0fdf4] px-2 text-[10px] font-black text-[#15803d] transition hover:bg-[#dcfce7]"
                      >
                        WA
                      </a>
                    ) : (
                      <span className="text-[10px] font-semibold text-[#94a3b8]">
                        無 WhatsApp
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
                      <IntentPrefetchLink
                        href={`/crm/leads/${item.id}`}
                        title="開啟 Lead"
                        className="inline-flex h-7 min-w-7 items-center justify-center rounded-md border border-[#dbeafe] bg-[#eff6ff] px-2 text-[10px] font-bold text-[#1d4ed8] transition hover:bg-[#dbeafe]"
                      >
                        開啟
                      </IntentPrefetchLink>
                      {item.whatsappUrl ? (
                        <a
                          href={item.whatsappUrl}
                          target="_blank"
                          rel="noreferrer"
                          title="開啟 WhatsApp"
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
                  目前沒有符合條件嘅 Lead。
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
            來源網址
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
            頁面網址
          </a>
        ) : (
          "-"
        )}
      </Cell>
      <Cell>
        <span className="text-[10px] font-semibold text-[#94a3b8]">
          詳細追蹤欄位覆蓋可於報表查看。
        </span>
      </Cell>
    </>
  );
}

function Avatar({ name }: { name: string }) {
  const initial = (name.trim()[0] || "?").toUpperCase();

  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--crm-accent-soft)] text-[12px] font-black text-[var(--crm-accent)]">
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
              : "bg-sky-50 text-sky-700"
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
    return <OutcomeBadge tone="red">未到店</OutcomeBadge>;
  }
  if (item.status === "lost") {
    return <OutcomeBadge tone="slate">已流失</OutcomeBadge>;
  }
  if (item.status === "invalid") {
    return <OutcomeBadge tone="slate">無效</OutcomeBadge>;
  }
  if (item.status === "booked") {
    return <OutcomeBadge tone="sky">已預約</OutcomeBadge>;
  }
  return <OutcomeBadge tone="amber">待跟進</OutcomeBadge>;
}

function OutcomeBadge({
  tone,
  children,
}: {
  tone: "emerald" | "red" | "slate" | "sky" | "amber";
  children: ReactNode;
}) {
  const classes = {
    emerald: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-700",
    slate: "bg-slate-100 text-slate-700",
    sky: "bg-sky-50 text-sky-700",
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
    no_show: "未到店",
    cancelled: "已取消",
    no_reply: "未回覆",
    lost: "已流失",
    new: "待跟進",
    contacting: "已聯絡",
    confirmed: "已確認",
    paid: "已付款",
    invalid: "無效",
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
