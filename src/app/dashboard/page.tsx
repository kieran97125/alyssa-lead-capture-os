import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type DashboardStatus = "local_noop" | "connected" | "query_failed";
type DateRangeKey = "today" | "yesterday" | "last7" | "month" | "custom";

type LeadRow = {
  id: string;
  created_at: string;
  submitted_at: string | null;
  customer_name: string | null;
  phone: string | null;
  appointment_date: string | null;
  appointment_time: string | null;
  price: number | string | null;
  currency: string | null;
  source_type: string | null;
  payment_status: string | null;
  lead_status: string | null;
  booking_status: string | null;
  brands?: { name: string | null } | { name: string | null }[] | null;
  treatments?: { name: string | null } | { name: string | null }[] | null;
  packages?:
    | { name: string | null; promo_price: number | string | null }
    | { name: string | null; promo_price: number | string | null }[]
    | null;
  branches?: { name: string | null } | { name: string | null }[] | null;
  lead_source_snapshots?:
    | {
        utm_source: string | null;
        utm_medium: string | null;
        utm_campaign: string | null;
        utm_content: string | null;
        tracking_status: string | null;
        audit_reason: string | null;
      }
    | {
        utm_source: string | null;
        utm_medium: string | null;
        utm_campaign: string | null;
        utm_content: string | null;
        tracking_status: string | null;
        audit_reason: string | null;
      }[]
    | null;
};

type DashboardSummary = {
  status: DashboardStatus;
  statusLabel: string;
  statusDescription: string;
  activeRange: DateRangeKey;
  rangeLabel: string;
  rangeStart: string;
  rangeEnd: string;
  latestLeadAt: string | null;
  errorMessage: string | null;
  leads: LeadRow[];
  kpis: {
    totalLeads: number;
    newBookings: number;
    bookingOnly: number;
    paidLeads: number;
    estimatedAmount: number;
    trackableRate: number;
  };
};

const dateRangeOptions: Array<{ key: DateRangeKey; label: string }> = [
  { key: "today", label: "今日" },
  { key: "yesterday", label: "昨日" },
  { key: "last7", label: "近7日" },
  { key: "month", label: "本月" },
  { key: "custom", label: "自訂日期" },
];

function relation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function asNumber(value: number | string | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function money(value: number, currency = "HKD") {
  return new Intl.NumberFormat("zh-HK", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatDateTime(value: string | null) {
  if (!value) return "未有登記";

  return new Intl.DateTimeFormat("zh-HK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Hong_Kong",
  }).format(new Date(value));
}

function formatAppointment(lead: LeadRow) {
  if (!lead.appointment_date && !lead.appointment_time) return "未選";
  return [lead.appointment_date, lead.appointment_time].filter(Boolean).join(" ");
}

function hkDateToUtcIso(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day) - 8 * 60 * 60 * 1000).toISOString();
}

function getDateRange(range: DateRangeKey) {
  const now = new Date();
  const hkNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const year = hkNow.getUTCFullYear();
  const month = hkNow.getUTCMonth();
  const day = hkNow.getUTCDate();

  if (range === "today") {
    return {
      key: range,
      label: "今日",
      start: hkDateToUtcIso(year, month, day),
      end: hkDateToUtcIso(year, month, day + 1),
    };
  }

  if (range === "yesterday") {
    return {
      key: range,
      label: "昨日",
      start: hkDateToUtcIso(year, month, day - 1),
      end: hkDateToUtcIso(year, month, day),
    };
  }

  if (range === "month") {
    return {
      key: range,
      label: "本月",
      start: hkDateToUtcIso(year, month, 1),
      end: hkDateToUtcIso(year, month + 1, 1),
    };
  }

  return {
    key: range,
    label: range === "custom" ? "自訂日期（暫用近7日）" : "近7日",
    start: hkDateToUtcIso(year, month, day - 6),
    end: hkDateToUtcIso(year, month, day + 1),
  };
}

function parseRange(value: string | string[] | undefined): DateRangeKey {
  const raw = Array.isArray(value) ? value[0] : value;
  return dateRangeOptions.some((item) => item.key === raw)
    ? (raw as DateRangeKey)
    : "last7";
}

function sourceLabel(lead: LeadRow) {
  const snapshot = relation(lead.lead_source_snapshots);

  if (lead.source_type === "whatsapp_ctwa") return "WhatsApp CTWA";
  if (lead.source_type === "organic_unknown") return "Organic / unknown";
  if (lead.source_type === "manual") return "Manual";
  if (lead.source_type === "imported") return "Imported";

  return [snapshot?.utm_source, snapshot?.utm_medium]
    .filter(Boolean)
    .join(" / ") || "可追蹤來源";
}

function campaignLabel(lead: LeadRow) {
  const snapshot = relation(lead.lead_source_snapshots);
  return snapshot?.utm_campaign || "未設定";
}

function businessStatus(lead: LeadRow) {
  if (lead.payment_status === "paid") return "已付款";
  if (lead.lead_status === "lost") return "已流失";
  if (lead.booking_status === "confirmed") return "已確認預約";
  if (lead.payment_status === "pending") return "待付款確認";
  if (lead.payment_status === "booking_only") return "只預約未付款";
  if (lead.lead_status === "submitted") return "已提交";
  return lead.lead_status || "未設定";
}

function isTrackable(lead: LeadRow) {
  const snapshot = relation(lead.lead_source_snapshots);
  return (
    lead.source_type !== "organic_unknown" &&
    snapshot?.tracking_status !== "organic_unknown" &&
    snapshot?.tracking_status !== "missing"
  );
}

async function getDashboardSummary(rangeKey: DateRangeKey): Promise<DashboardSummary> {
  const range = getDateRange(rangeKey);

  if (!hasSupabaseAdminEnv()) {
    return {
      status: "local_noop",
      statusLabel: "系統狀態：等待資料庫連接",
      statusDescription:
        "目前未偵測到正式資料庫設定，dashboard 不會顯示假數字。",
      activeRange: range.key,
      rangeLabel: range.label,
      rangeStart: range.start,
      rangeEnd: range.end,
      latestLeadAt: null,
      errorMessage: null,
      leads: [],
      kpis: {
        totalLeads: 0,
        newBookings: 0,
        bookingOnly: 0,
        paidLeads: 0,
        estimatedAmount: 0,
        trackableRate: 0,
      },
    };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const leadRowsResult = await supabase
      .from("leads")
      .select(
        `
          id,
          created_at,
          submitted_at,
          customer_name,
          phone,
          appointment_date,
          appointment_time,
          price,
          currency,
          source_type,
          payment_status,
          lead_status,
          booking_status,
          brands(name),
          treatments(name),
          packages(name,promo_price),
          branches(name),
          lead_source_snapshots(
            utm_source,
            utm_medium,
            utm_campaign,
            utm_content,
            tracking_status,
            audit_reason
          )
        `
      )
      .gte("created_at", range.start)
      .lt("created_at", range.end)
      .order("created_at", { ascending: false })
      .limit(5000);

    if (leadRowsResult.error) throw leadRowsResult.error;

    const leads = (leadRowsResult.data ?? []) as LeadRow[];
    const totalLeads = leads.length;
    const trackableCount = leads.filter(isTrackable).length;

    return {
      status: "connected",
      statusLabel: "系統狀態：資料庫已連接",
      statusDescription:
        "正在讀取正式登記資料；最新登記、來源、療程、套餐、分店同預約狀態已同步。",
      activeRange: range.key,
      rangeLabel: range.label,
      rangeStart: range.start,
      rangeEnd: range.end,
      latestLeadAt: leads[0]?.created_at ?? null,
      errorMessage: null,
      leads,
      kpis: {
        totalLeads,
        newBookings: leads.filter((lead) => lead.booking_status === "requested").length,
        bookingOnly: leads.filter((lead) => lead.payment_status === "booking_only")
          .length,
        paidLeads: leads.filter((lead) => lead.payment_status === "paid").length,
        estimatedAmount: leads.reduce((sum, lead) => sum + asNumber(lead.price), 0),
        trackableRate: totalLeads > 0 ? trackableCount / totalLeads : 0,
      },
    };
  } catch (error) {
    return {
      status: "query_failed",
      statusLabel: "系統狀態：資料庫已設定，但讀取失敗",
      statusDescription:
        "已偵測到正式資料庫設定，但 dashboard 暫時未能讀取資料。請檢查 Vercel env、service role key 或資料表權限。",
      activeRange: range.key,
      rangeLabel: range.label,
      rangeStart: range.start,
      rangeEnd: range.end,
      latestLeadAt: null,
      errorMessage: error instanceof Error ? error.message : "unknown_query_error",
      leads: [],
      kpis: {
        totalLeads: 0,
        newBookings: 0,
        bookingOnly: 0,
        paidLeads: 0,
        estimatedAmount: 0,
        trackableRate: 0,
      },
    };
  }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ range?: string | string[] }>;
}) {
  const params = await searchParams;
  const summary = await getDashboardSummary(parseRange(params?.range));

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <section className="rounded-[28px] border border-[#ead9cf] bg-white/82 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.1)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
                Lead performance dashboard
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#321428]">
                Alyssa 登記及來源成效
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
                用正式登記資料追蹤品牌、療程、套餐、分店、來源同廣告系列表現。
                CRM 結果會等待未來 WhatsApp CRM app 回寫。
              </p>
            </div>
            <div className="rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-4 py-3 text-sm font-semibold text-[#5a2348]">
              {summary.statusLabel}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {dateRangeOptions.map((item) => (
              <Link
                key={item.key}
                href={`/dashboard?range=${item.key}`}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                  summary.activeRange === item.key
                    ? "bg-[#5a2348] text-white"
                    : "border border-[#ead9cf] bg-white text-[#5a2348]"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <p className="mt-3 text-xs font-semibold text-[#7b5a6a]">
            目前範圍：{summary.rangeLabel}。自訂日期 UI 已預留，完整日期輸入下一步接入。
          </p>
          {summary.errorMessage && (
            <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              系統讀取錯誤：{summary.errorMessage}
            </p>
          )}
        </section>

        <section className="mt-6 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <KpiCard label="總 Leads" value={summary.kpis.totalLeads.toString()} />
          <KpiCard label="新預約" value={summary.kpis.newBookings.toString()} />
          <KpiCard label="只預約未付款" value={summary.kpis.bookingOnly.toString()} />
          <KpiCard label="已付款 Leads" value={summary.kpis.paidLeads.toString()} />
          <KpiCard
            label="預計療程金額"
            value={money(summary.kpis.estimatedAmount)}
          />
          <KpiCard label="可追蹤來源比例" value={percent(summary.kpis.trackableRate)} />
        </section>

        <LatestLeadsTable leads={summary.leads.slice(0, 5)} />

        <section className="mt-6 grid gap-5 lg:grid-cols-3">
          <QuickLinkCard
            href="/leads"
            title="查看所有 Leads"
            description="進入完整 latest leads feed，查看客人、電話、療程、套餐、分店、來源同狀態。"
          />
          <QuickLinkCard
            href="/performance"
            title="查看成效分析"
            description="按品牌、來源、廣告系列、療程套餐同分店分析表現。"
          />
          <QuickLinkCard
            href="/system-audit"
            title="查看系統稽核"
            description="技術追蹤、事件紀錄同 CRM 回寫 contract 已移到內部頁。"
          />
        </section>

        <section className="mt-6 rounded-[24px] border border-[#ead9cf] bg-[#fff6f0] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
            CRM 結果
          </p>
          <h2 className="mt-2 text-xl font-bold text-[#321428]">
            等待未來 WhatsApp CRM app 回寫
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">
            Dashboard 目前只顯示 Lead Capture OS 已有的登記、預約、來源同 package
            金額資料。show / no-show / lost / paid conversion 會等 CRM app 寫回後再顯示。
          </p>
        </section>
      </div>
    </main>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#ead9cf] bg-white/82 p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-[#321428]">{value}</p>
    </div>
  );
}

function QuickLinkCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-[24px] border border-[#ead9cf] bg-white/82 p-5 shadow-sm transition hover:border-[#c9828e]"
    >
      <h2 className="text-xl font-bold text-[#321428]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">{description}</p>
    </Link>
  );
}

function LatestLeadsTable({ leads }: { leads: LeadRow[] }) {
  return (
    <section className="mt-6 rounded-[24px] border border-[#ead9cf] bg-white/82 p-5 shadow-sm">
      <h2 className="text-xl font-bold text-[#321428]">最新登記</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-[1180px] w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-xs font-bold uppercase tracking-[0.12em] text-[#9a5d76]">
              {[
                "登記時間",
                "品牌",
                "客人",
                "電話",
                "療程",
                "套餐 / 價錢",
                "分店",
                "預約日期時間",
                "來源",
                "廣告系列",
                "狀態",
              ].map((heading) => (
                <th key={heading} className="border-b border-[#ead9cf] px-3 py-3">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leads.length > 0 ? (
              leads.map((lead) => {
                const brand = relation(lead.brands)?.name || "未設定";
                const treatment = relation(lead.treatments)?.name || "未設定";
                const packageName = relation(lead.packages)?.name || "未設定";
                const branch = relation(lead.branches)?.name || "未設定";

                return (
                  <tr key={lead.id} className="align-top text-[#5a2348]">
                    <td className="border-b border-[#f1e3dc] px-3 py-3">
                      {formatDateTime(lead.created_at)}
                    </td>
                    <td className="border-b border-[#f1e3dc] px-3 py-3">{brand}</td>
                    <td className="border-b border-[#f1e3dc] px-3 py-3">
                      {lead.customer_name || "未填"}
                    </td>
                    <td className="border-b border-[#f1e3dc] px-3 py-3">
                      {lead.phone || "未填"}
                    </td>
                    <td className="border-b border-[#f1e3dc] px-3 py-3">
                      {treatment}
                    </td>
                    <td className="border-b border-[#f1e3dc] px-3 py-3">
                      {packageName}
                      <span className="block font-bold text-[#321428]">
                        {money(asNumber(lead.price), lead.currency || "HKD")}
                      </span>
                    </td>
                    <td className="border-b border-[#f1e3dc] px-3 py-3">{branch}</td>
                    <td className="border-b border-[#f1e3dc] px-3 py-3">
                      {formatAppointment(lead)}
                    </td>
                    <td className="border-b border-[#f1e3dc] px-3 py-3">
                      {sourceLabel(lead)}
                    </td>
                    <td className="border-b border-[#f1e3dc] px-3 py-3">
                      {campaignLabel(lead)}
                    </td>
                    <td className="border-b border-[#f1e3dc] px-3 py-3">
                      <span className="rounded-full bg-[#fff6f0] px-3 py-1 text-xs font-bold text-[#9a5d76]">
                        {businessStatus(lead)}
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={11} className="px-3 py-6 text-center text-[#7b5a6a]">
                  目前日期範圍未有正式登記資料。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
