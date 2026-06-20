import Link from "next/link";
import type { ReactNode } from "react";
import { AppNav } from "@/components/alyssa/AppNav";
import { MotionReveal } from "@/components/alyssa/MotionReveal";
import { StatCard } from "@/components/alyssa/ui";
import {
  asNumber,
  getLeadRows,
  money,
  type LeadRow,
} from "@/lib/data/businessMetrics";
import { getConfigurationData } from "@/lib/data/configuration";
import { getLandingPageList } from "@/lib/data/landingPageStore";

export const dynamic = "force-dynamic";

async function getDashboardOverview() {
  const [today, week, config, landingPages] = await Promise.all([
    getLeadRows("today", 5000),
    getLeadRows("last7", 5000),
    getConfigurationData(),
    getLandingPageList(),
  ]);
  const weekLeads = week.leads;
  const latestLeadAt = weekLeads[0]?.created_at ?? today.leads[0]?.created_at ?? null;
  const latestPageAt =
    landingPages.pages
      .map((page) => page.updatedAt || page.publishedAt || page.createdAt)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;

  return {
    todayLeads: today.leads.length,
    weekLeads,
    weekLeadCount: weekLeads.length,
    publishedLandingPages: landingPages.pages.filter(
      (page) => page.status === "published"
    ).length,
    formCount: config.forms.length,
    latestUpdate: latestLeadAt || latestPageAt,
    estimatedAmount: weekLeads.reduce(
      (sum, lead) => sum + asNumber(lead.price),
      0
    ),
    errorMessage:
      today.error || week.error ? "資料暫時未能讀取，請稍後再試。" : null,
  };
}

export default async function DashboardPage() {
  const overview = await getDashboardOverview();

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <section className="rounded-[28px] border border-[#ead9cf] bg-white/86 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.1)]">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="alyssa-kicker">Dashboard</p>
              <h1 className="mt-2 text-3xl font-bold text-[#321428]">
                Campaign Launch OS
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
                管理品牌登記表格、Landing Page、Leads 收集及來源追蹤。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <PrimaryAction href="/campaigns/new">
                建立表格及 Landing Page
              </PrimaryAction>
              <SecondaryAction href="/leads">查看 Leads</SecondaryAction>
              <SecondaryAction href="/landing-pages">
                管理 Landing Pages
              </SecondaryAction>
              <SecondaryAction href="/crm">開啟 LeadOps CRM</SecondaryAction>
            </div>
          </div>

          {overview.errorMessage && (
            <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {overview.errorMessage}
            </p>
          )}
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard label="今日 Leads" value={overview.todayLeads.toString()} />
          <KpiCard label="本週 Leads" value={overview.weekLeadCount.toString()} />
          <KpiCard
            label="已發布 Landing Pages"
            value={overview.publishedLandingPages.toString()}
          />
          <KpiCard label="可用登記表格" value={overview.formCount.toString()} />
          <KpiCard
            label="最近更新"
            value={formatShortDateTime(overview.latestUpdate)}
          />
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <MotionReveal delay={0.08}>
            <LatestLeadsTable leads={overview.weekLeads.slice(0, 6)} />
          </MotionReveal>

          <MotionReveal delay={0.14}>
            <section className="alyssa-premium-card p-5">
              <p className="alyssa-kicker">本週預計金額</p>
              <p className="mt-3 text-4xl font-bold text-[#321428]">
                {money(overview.estimatedAmount)}
              </p>
              <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">
                以已提交 Leads 所選套餐價錢計算，實際收入需待團隊跟進確認。
              </p>
              <div className="mt-5 grid gap-3">
                <SecondaryAction href="/performance">查看成效</SecondaryAction>
                <SecondaryAction href="/settings#brand-library">
                  管理 Brand Library
                </SecondaryAction>
              </div>
            </section>
          </MotionReveal>
        </section>

        <section className="mt-6">
          <div className="mb-4">
            <p className="alyssa-kicker">Launch 快捷入口</p>
            <h2 className="mt-2 text-2xl font-bold text-[#321428]">
              選擇今次 Campaign 的建立方式
            </h2>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            <LaunchCard
              title="建立表格及 Landing Page"
              body="適合測試新優惠、新療程或新文案角度。"
            />
            <LaunchCard
              title="只建立 Wix 登記表格"
              body="適合 Wix 頁面已有內容，只需要一張可嵌入的登記表格收集 Leads。"
            />
            <LaunchCard
              title="用現有表格開 Landing Page"
              body="適合重用已準備好的登記表格，再開一頁新的廣告 Landing Page。"
            />
          </div>
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

function PrimaryAction({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex justify-center rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(228,111,100,0.2)] transition hover:-translate-y-0.5 hover:bg-[#d95f55]"
    >
      {children}
    </Link>
  );
}

function SecondaryAction({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex justify-center rounded-full border border-[#ead9cf] bg-white px-5 py-3 text-sm font-bold text-[#5a2348] transition hover:border-[#c9828e]"
    >
      {children}
    </Link>
  );
}

function LaunchCard({ title, body }: { title: string; body: string }) {
  return (
    <MotionReveal>
      <Link
        href="/campaigns/new"
        className="alyssa-premium-card alyssa-interactive-card alyssa-focus block h-full p-5"
      >
        <h3 className="text-xl font-bold text-[#321428]">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">{body}</p>
      </Link>
    </MotionReveal>
  );
}

function LatestLeadsTable({ leads }: { leads: LeadRow[] }) {
  return (
    <section className="alyssa-premium-card min-w-0 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="alyssa-kicker">最新 Leads</p>
          <h2 className="mt-2 text-xl font-bold text-[#321428]">
            最近登記紀錄
          </h2>
        </div>
        <Link
          href="/leads"
          className="rounded-full border border-[#ead9cf] bg-white px-4 py-2 text-sm font-bold text-[#5a2348]"
        >
          查看全部
        </Link>
      </div>
      <div className="mt-4 max-w-full overflow-x-auto">
        <table className="alyssa-table min-w-[780px] text-left text-sm">
          <thead>
            <tr className="text-xs font-bold uppercase tracking-[0.12em] text-[#9a5d76]">
              {["登記時間", "客人", "電話", "品牌", "療程 / 優惠", "狀態"].map(
                (heading) => (
                  <th key={heading} className="border-b border-[#ead9cf] px-3 py-3">
                    {heading}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {leads.length > 0 ? (
              leads.map((lead) => (
                <tr
                  key={lead.id}
                  className="align-top text-[#5a2348] transition hover:bg-[#fff6f0]/70"
                >
                  <td className="border-b border-[#f1e3dc] px-3 py-3">
                    {formatShortDateTime(lead.created_at)}
                  </td>
                  <td className="border-b border-[#f1e3dc] px-3 py-3">
                    {lead.customer_name || lead.contact?.customer_name || "未提供"}
                  </td>
                  <td className="border-b border-[#f1e3dc] px-3 py-3">
                    {lead.phone || lead.normalized_phone || lead.contact?.phone || "未提供"}
                  </td>
                  <td className="border-b border-[#f1e3dc] px-3 py-3">
                    {lead.brand?.name || "未設定"}
                  </td>
                  <td className="border-b border-[#f1e3dc] px-3 py-3">
                    {lead.treatment?.name || "未設定"}
                    <span className="block font-bold text-[#321428]">
                      {lead.package?.name || "未設定"} ·{" "}
                      {money(asNumber(lead.price), lead.currency || "HKD")}
                    </span>
                  </td>
                  <td className="border-b border-[#f1e3dc] px-3 py-3">
                    <span className="rounded-full bg-[#fff6f0] px-3 py-1 text-xs font-bold text-[#9a5d76]">
                      {leadStatusLabel(lead)}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-[#7b5a6a]">
                  暫時未有最新登記。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function leadStatusLabel(lead: LeadRow) {
  const bookingStatus = lead.booking?.booking_status || lead.booking_status;
  if (lead.payment_status === "paid") return "已付款";
  if (bookingStatus === "confirmed") return "已確認預約";
  if (lead.payment_status === "booking_only") return "只預約";
  if (lead.payment_status === "pending") return "待付款";
  if (lead.lead_status === "lost") return "已流失";
  if (lead.lead_status === "submitted") return "已提交";
  return "待跟進";
}

function formatShortDateTime(value: string | null | undefined) {
  if (!value) return "暫未有記錄";

  return new Intl.DateTimeFormat("zh-HK", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Hong_Kong",
  }).format(new Date(value));
}
