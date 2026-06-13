import type { ReactNode } from "react";
import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type DashboardStatus = "local_noop" | "connected" | "query_failed";
type DateRangeKey = "today" | "yesterday" | "last7" | "month" | "custom";

type CountItem = {
  label: string;
  count: number;
};

type PerformanceRow = {
  key: string;
  label: string;
  leads: number;
  bookings: number;
  paid: number;
  amount: number;
  share?: number;
  meta?: string[];
};

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
  brandPerformance: PerformanceRow[];
  sourcePerformance: PerformanceRow[];
  treatmentPerformance: PerformanceRow[];
  branchPerformance: PerformanceRow[];
  audit: {
    sourceSnapshots: number;
    leadEvents: number;
    trackingStatus: CountItem[];
  };
};

const dateRangeOptions: Array<{ key: DateRangeKey; label: string }> = [
  { key: "today", label: "今日" },
  { key: "yesterday", label: "昨日" },
  { key: "last7", label: "近7日" },
  { key: "month", label: "本月" },
  { key: "custom", label: "自訂日期" },
];

const crmFeedback = [
  "booking_confirmed",
  "booking_rescheduled",
  "booking_cancelled",
  "crm_followup_started",
  "crm_followup_updated",
  "show_up",
  "no_show",
  "deal_paid",
  "deal_lost",
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

function contentLabel(lead: LeadRow) {
  const snapshot = relation(lead.lead_source_snapshots);
  return snapshot?.utm_content || "未設定";
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

function isBooking(lead: LeadRow) {
  return ["requested", "confirmed", "rescheduled", "show", "no_show"].includes(
    lead.booking_status ?? ""
  );
}

function isTrackable(lead: LeadRow) {
  const snapshot = relation(lead.lead_source_snapshots);
  return (
    lead.source_type !== "organic_unknown" &&
    snapshot?.tracking_status !== "organic_unknown" &&
    snapshot?.tracking_status !== "missing"
  );
}

function countBy<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  const counts = new Map<string, number>();

  rows.forEach((row) => {
    const value = typeof row[key] === "string" && row[key] ? row[key] : "未設定";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });

  return Array.from(counts, ([label, count]) => ({ label, count })).sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label)
  );
}

function addPerformance(
  rows: Map<string, PerformanceRow>,
  key: string,
  label: string,
  lead: LeadRow,
  meta: string[] = []
) {
  const current =
    rows.get(key) ??
    ({
      key,
      label,
      leads: 0,
      bookings: 0,
      paid: 0,
      amount: 0,
      meta,
    } satisfies PerformanceRow);

  current.leads += 1;
  current.bookings += isBooking(lead) ? 1 : 0;
  current.paid += lead.payment_status === "paid" ? 1 : 0;
  current.amount += asNumber(lead.price);
  rows.set(key, current);
}

function buildPerformance(leads: LeadRow[]) {
  const brands = new Map<string, PerformanceRow>();
  const sources = new Map<string, PerformanceRow>();
  const treatments = new Map<string, PerformanceRow>();
  const branches = new Map<string, PerformanceRow>();

  leads.forEach((lead) => {
    const brand = relation(lead.brands)?.name || "未設定品牌";
    const treatment = relation(lead.treatments)?.name || "未設定療程";
    const packageName = relation(lead.packages)?.name || "未設定套餐";
    const branch = relation(lead.branches)?.name || "未設定分店";
    const source = sourceLabel(lead);
    const campaign = campaignLabel(lead);
    const content = contentLabel(lead);

    addPerformance(brands, brand, brand, lead);
    addPerformance(
      sources,
      [source, campaign, content].join("|"),
      source,
      lead,
      [campaign, content]
    );
    addPerformance(
      treatments,
      [treatment, packageName].join("|"),
      treatment,
      lead,
      [packageName, money(asNumber(lead.price), lead.currency || "HKD")]
    );
    addPerformance(branches, branch, branch, lead);
  });

  return {
    brandPerformance: Array.from(brands.values()).sort((a, b) => b.leads - a.leads),
    sourcePerformance: Array.from(sources.values()).sort((a, b) => b.leads - a.leads),
    treatmentPerformance: Array.from(treatments.values()).sort(
      (a, b) => b.leads - a.leads
    ),
    branchPerformance: Array.from(branches.values())
      .map((row) => ({
        ...row,
        share: leads.length > 0 ? row.leads / leads.length : 0,
      }))
      .sort((a, b) => b.leads - a.leads),
  };
}

async function countRows(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  table: string
) {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });

  if (error) throw error;
  return count ?? 0;
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
      brandPerformance: [],
      sourcePerformance: [],
      treatmentPerformance: [],
      branchPerformance: [],
      audit: {
        sourceSnapshots: 0,
        leadEvents: 0,
        trackingStatus: [],
      },
    };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const [leadRowsResult, sourceSnapshots, leadEvents, snapshotRowsResult] =
      await Promise.all([
        supabase
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
          .limit(5000),
        countRows(supabase, "lead_source_snapshots"),
        countRows(supabase, "lead_events"),
        supabase.from("lead_source_snapshots").select("tracking_status").limit(5000),
      ]);

    if (leadRowsResult.error) throw leadRowsResult.error;
    if (snapshotRowsResult.error) throw snapshotRowsResult.error;

    const leads = (leadRowsResult.data ?? []) as LeadRow[];
    const performance = buildPerformance(leads);
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
      ...performance,
      audit: {
        sourceSnapshots,
        leadEvents,
        trackingStatus: countBy(snapshotRowsResult.data ?? [], "tracking_status"),
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
      brandPerformance: [],
      sourcePerformance: [],
      treatmentPerformance: [],
      branchPerformance: [],
      audit: {
        sourceSnapshots: 0,
        leadEvents: 0,
        trackingStatus: [],
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

        <LatestLeadsTable leads={summary.leads.slice(0, 20)} />

        <section className="mt-6 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <PerformanceTable
            title="品牌表現"
            columns={["品牌", "Leads", "預約", "已付款", "預計金額"]}
            rows={summary.brandPerformance}
            type="brand"
          />
          <PerformanceTable
            title="來源 / 廣告系列表現"
            columns={[
              "來源",
              "廣告系列",
              "素材 / Content",
              "Leads",
              "預約",
              "已付款",
              "預計金額",
            ]}
            rows={summary.sourcePerformance}
            type="source"
          />
        </section>

        <section className="mt-6 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <PerformanceTable
            title="療程 / 套餐表現"
            columns={["療程", "套餐", "價錢", "Leads", "預約", "已付款"]}
            rows={summary.treatmentPerformance}
            type="treatment"
          />
          <PerformanceTable
            title="分店表現"
            columns={["分店", "Leads", "預約", "佔比"]}
            rows={summary.branchPerformance}
            type="branch"
          />
        </section>

        <section className="mt-6 rounded-[24px] border border-[#ead9cf] bg-white/82 p-5 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
                系統稽核
              </p>
              <h2 className="mt-2 text-xl font-bold text-[#321428]">
                來源追蹤稽核
              </h2>
            </div>
            <p className="text-sm font-semibold text-[#7b5a6a]">
              最新登記：{formatDateTime(summary.latestLeadAt)}
            </p>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <AuditCard label="Source snapshots" value={summary.audit.sourceSnapshots} />
            <AuditCard label="Lead events" value={summary.audit.leadEvents} />
            <AuditCard label="CRM outcome" value="等待日後回寫" />
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {summary.audit.trackingStatus.length > 0 ? (
              summary.audit.trackingStatus.map((item) => (
                <div key={item.label} className="rounded-2xl bg-[#fff6f0] p-3">
                  <p className="font-mono text-xs font-bold text-[#5a2348]">
                    {item.label}
                  </p>
                  <p className="mt-1 text-lg font-bold text-[#321428]">{item.count}</p>
                </div>
              ))
            ) : (
              <p className="text-sm font-semibold text-[#7b5a6a]">
                未有來源追蹤分佈資料。
              </p>
            )}
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {crmFeedback.map((eventName) => (
              <div
                key={eventName}
                className="rounded-2xl border border-[#ead9cf] bg-[#fff6f0] p-3 text-xs font-bold text-[#5a2348]"
              >
                {eventName}
              </div>
            ))}
          </div>
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

function PerformanceTable({
  title,
  columns,
  rows,
  type,
}: {
  title: string;
  columns: string[];
  rows: PerformanceRow[];
  type: "brand" | "source" | "treatment" | "branch";
}) {
  return (
    <section className="rounded-[24px] border border-[#ead9cf] bg-white/82 p-5 shadow-sm">
      <h2 className="text-xl font-bold text-[#321428]">{title}</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-xs font-bold uppercase tracking-[0.12em] text-[#9a5d76]">
              {columns.map((column) => (
                <th key={column} className="border-b border-[#ead9cf] px-3 py-3">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <tr key={row.key} className="text-[#5a2348]">
                  {renderPerformanceCells(row, type)}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-6 text-center text-[#7b5a6a]"
                >
                  目前未有資料。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Cell({ children }: { children: ReactNode }) {
  return <td className="border-b border-[#f1e3dc] px-3 py-3">{children}</td>;
}

function renderPerformanceCells(row: PerformanceRow, type: PerformanceTableProps) {
  if (type === "source") {
    return (
      <>
        <Cell>{row.label}</Cell>
        <Cell>{row.meta?.[0] || "未設定"}</Cell>
        <Cell>{row.meta?.[1] || "未設定"}</Cell>
        <Cell>{row.leads}</Cell>
        <Cell>{row.bookings}</Cell>
        <Cell>{row.paid}</Cell>
        <Cell>{money(row.amount)}</Cell>
      </>
    );
  }

  if (type === "treatment") {
    return (
      <>
        <Cell>{row.label}</Cell>
        <Cell>{row.meta?.[0] || "未設定"}</Cell>
        <Cell>{row.meta?.[1] || "未設定"}</Cell>
        <Cell>{row.leads}</Cell>
        <Cell>{row.bookings}</Cell>
        <Cell>{row.paid}</Cell>
      </>
    );
  }

  if (type === "branch") {
    return (
      <>
        <Cell>{row.label}</Cell>
        <Cell>{row.leads}</Cell>
        <Cell>{row.bookings}</Cell>
        <Cell>{percent(row.share ?? 0)}</Cell>
      </>
    );
  }

  return (
    <>
      <Cell>{row.label}</Cell>
      <Cell>{row.leads}</Cell>
      <Cell>{row.bookings}</Cell>
      <Cell>{row.paid}</Cell>
      <Cell>{money(row.amount)}</Cell>
    </>
  );
}

type PerformanceTableProps = "brand" | "source" | "treatment" | "branch";

function AuditCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-[#ead9cf] bg-[#fff9f3] p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {label}
      </p>
      <p className="mt-2 text-lg font-bold text-[#321428]">{value}</p>
    </div>
  );
}
