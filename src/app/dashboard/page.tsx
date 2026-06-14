import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";
import { MotionReveal } from "@/components/alyssa/MotionReveal";
import { StatCard } from "@/components/alyssa/ui";
import {
  asNumber,
  businessStatus,
  campaignLabel,
  dateRangeOptions,
  displayCustomerName,
  displayPhone,
  formatAppointment,
  formatDateTime,
  getLeadRows,
  isTrackable,
  money,
  parseRange,
  percent,
  sourceLabel,
  type DateRangeKey,
  type LeadRow,
} from "@/lib/data/businessMetrics";

export const dynamic = "force-dynamic";

type DashboardSummary = {
  activeRange: DateRangeKey;
  rangeLabel: string;
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

async function getDashboardSummary(rangeKey: DateRangeKey): Promise<DashboardSummary> {
  const { range, leads, error } = await getLeadRows(rangeKey, 5000);
  const totalLeads = leads.length;
  const trackableCount = leads.filter(isTrackable).length;

  return {
    activeRange: range.key,
    rangeLabel: range.label,
    latestLeadAt: leads[0]?.created_at ?? null,
    errorMessage: error ? "資料暫時未能讀取，請稍後再試" : null,
    leads,
    kpis: {
      totalLeads,
      newBookings: leads.filter((lead) => lead.booking_status === "requested").length,
      bookingOnly: leads.filter((lead) => lead.payment_status === "booking_only").length,
      paidLeads: leads.filter((lead) => lead.payment_status === "paid").length,
      estimatedAmount: leads.reduce((sum, lead) => sum + asNumber(lead.price), 0),
      trackableRate: totalLeads > 0 ? trackableCount / totalLeads : 0,
    },
  };
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
          <div className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
                Lead performance dashboard
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#321428]">
                Alyssa 登記成效總覽
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
                查看最新登記、預約狀態、套餐金額同來源成效。
              </p>
            </div>
            <div className="rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-4 py-3 text-sm font-semibold text-[#5a2348]">
              正式登記資料
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
            目前期間：{summary.rangeLabel}
            {summary.latestLeadAt ? `；最新登記：${formatDateTime(summary.latestLeadAt)}` : ""}
          </p>
          {summary.errorMessage && (
            <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {summary.errorMessage}
            </p>
          )}
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          <KpiCard label="總 Leads" value={summary.kpis.totalLeads.toString()} />
          <KpiCard label="新預約" value={summary.kpis.newBookings.toString()} />
          <KpiCard label="只預約未付款" value={summary.kpis.bookingOnly.toString()} />
          <KpiCard label="已付款 Leads" value={summary.kpis.paidLeads.toString()} />
          <KpiCard label="預計療程金額" value={money(summary.kpis.estimatedAmount)} />
          <KpiCard label="可追蹤來源比例" value={percent(summary.kpis.trackableRate)} />
        </section>

        <MotionReveal delay={0.16}>
          <LatestLeadsTable leads={summary.leads.slice(0, 5)} />
        </MotionReveal>

        <section className="mt-6 grid gap-5 lg:grid-cols-3">
          <QuickLinkCard
            href="/leads"
            title="查看所有 Leads"
            description="進入完整最新登記紀錄，查看客人、電話、療程、套餐、分店、來源同狀態。"
            delay={0.06}
          />
          <QuickLinkCard
            href="/performance"
            title="查看成效分析"
            description="按品牌、來源、廣告系列、療程、套餐同分店拆解登記成效。"
            delay={0.12}
          />
          <QuickLinkCard
            href="/system-audit"
            title="查看系統稽核"
            description="查看內部追蹤、事件紀錄同系統狀態。"
            delay={0.18}
          />
        </section>

      </div>
    </main>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <MotionReveal>
      <StatCard label={label} value={value} />
    </MotionReveal>
  );
}

function QuickLinkCard({
  href,
  title,
  description,
  delay = 0,
}: {
  href: string;
  title: string;
  description: string;
  delay?: number;
}) {
  return (
    <MotionReveal delay={delay}>
    <Link
      href={href}
      className="alyssa-premium-card alyssa-interactive-card alyssa-focus block min-w-0 p-5"
    >
      <h2 className="text-xl font-bold text-[#321428]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">{description}</p>
    </Link>
    </MotionReveal>
  );
}

function LatestLeadsTable({ leads }: { leads: LeadRow[] }) {
  return (
    <section className="alyssa-premium-card mt-6 min-w-0 p-5">
      <h2 className="text-xl font-bold text-[#321428]">最新登記紀錄</h2>
      <div className="mt-4 max-w-full overflow-x-auto">
        <table className="alyssa-table min-w-[1180px] text-left text-sm">
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
              leads.map((lead) => (
                <tr key={lead.id} className="align-top text-[#5a2348] transition hover:bg-[#fff6f0]/70">
                  <td className="border-b border-[#f1e3dc] px-3 py-3">
                    {formatDateTime(lead.created_at)}
                  </td>
                  <td className="border-b border-[#f1e3dc] px-3 py-3">
                    {lead.brand?.name || "未標記"}
                  </td>
                  <td className="border-b border-[#f1e3dc] px-3 py-3">
                    {displayCustomerName(lead)}
                  </td>
                  <td className="border-b border-[#f1e3dc] px-3 py-3">
                    {displayPhone(lead)}
                  </td>
                  <td className="border-b border-[#f1e3dc] px-3 py-3">
                    {lead.treatment?.name || "未標記"}
                  </td>
                  <td className="border-b border-[#f1e3dc] px-3 py-3">
                    {lead.package?.name || "未標記"}
                    <span className="block font-bold text-[#321428]">
                      {money(asNumber(lead.price), lead.currency || "HKD")}
                    </span>
                  </td>
                  <td className="border-b border-[#f1e3dc] px-3 py-3">
                    {lead.branch?.name || "未標記"}
                  </td>
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
              ))
            ) : (
              <tr>
                <td colSpan={11} className="px-3 py-6 text-center text-[#7b5a6a]">
                  目前期間未有登記紀錄。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
