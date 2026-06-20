import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";
import { MotionReveal } from "@/components/alyssa/MotionReveal";
import { getLeadRows } from "@/lib/data/businessMetrics";
import {
  summarizeCrmCases,
  toCrmLeadCase,
  type CrmLeadCase,
} from "@/lib/crm/leadOps";

export const dynamic = "force-dynamic";

export default async function CrmPage() {
  const { leads, error } = await getLeadRows("month", 500);
  const cases = leads.map(toCrmLeadCase);
  const summary = summarizeCrmCases(cases);

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <MotionReveal>
          <section className="rounded-[28px] border border-[#ead9cf] bg-white/86 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.1)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="alyssa-kicker">LeadOps CRM</p>
                <h1 className="mt-2 text-3xl font-bold text-[#321428]">
                  Phone-first CRM Inbox
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
                  以品牌 + 電話作為客人身份，集中查看表格、Landing Page 及日後 WhatsApp 廣告 Leads。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/leads"
                  className="alyssa-focus rounded-full border border-[#ead9cf] bg-white px-5 py-3 text-sm font-bold text-[#5a2348] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#fff6f0]"
                >
                  查看原始 Leads
                </Link>
                <Link
                  href="/campaigns/new"
                  className="alyssa-focus rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(228,111,100,0.24)] transition hover:-translate-y-0.5 hover:bg-[#d95f55]"
                >
                  建立 Campaign
                </Link>
              </div>
            </div>
            {error && (
              <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                CRM Inbox 暫時未能讀取最新資料，請稍後再試。
              </p>
            )}
          </section>
        </MotionReveal>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CrmStat label="Open cases" value={summary.total} />
          <CrmStat label="WhatsApp ad leads" value={summary.whatsappAds} />
          <CrmStat label="Form / Landing Page leads" value={summary.formLeads} />
          <CrmStat label="未設定下次跟進" value={summary.missingNextFollowUp} />
        </section>

        <MotionReveal delay={0.08}>
          <section className="alyssa-premium-card mt-6 min-w-0 p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="alyssa-kicker">CRM Inbox</p>
                <h2 className="mt-2 text-xl font-bold text-[#321428]">
                  最新 Lead Cases
                </h2>
              </div>
              <p className="text-sm font-semibold text-[#7b5a6a]">
                目前為唯讀視圖，跟進動作會於 CRM 寫入階段加入。
              </p>
            </div>

            <div className="mt-4 max-w-full overflow-x-auto">
              <table className="alyssa-table min-w-[1360px] text-left text-sm">
                <thead>
                  <tr className="text-xs font-bold uppercase tracking-[0.12em] text-[#9a5d76]">
                    {[
                      "Created / Last activity",
                      "客人",
                      "電話",
                      "品牌",
                      "療程 / Offer",
                      "來源",
                      "CTWA Source ID",
                      "Landing Page / URL",
                      "Campaign / Ad",
                      "狀態",
                      "CS",
                      "下次跟進",
                      "WhatsApp",
                      "詳情",
                    ].map((heading) => (
                      <th key={heading} className="border-b border-[#ead9cf] px-3 py-3">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cases.length > 0 ? (
                    cases.map((item) => <CrmRow key={item.id} item={item} />)
                  ) : (
                    <tr>
                      <td colSpan={14} className="px-3 py-8 text-center text-[#7b5a6a]">
                        暫時未有 CRM cases。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </MotionReveal>
      </div>
    </main>
  );
}

function CrmStat({ label, value }: { label: string; value: number }) {
  return (
    <MotionReveal>
      <div className="alyssa-premium-card min-w-0 p-4">
        <p className="alyssa-kicker">{label}</p>
        <p className="mt-2 text-3xl font-bold text-[#321428]">{value}</p>
      </div>
    </MotionReveal>
  );
}

function CrmRow({ item }: { item: CrmLeadCase }) {
  return (
    <tr className="align-top text-[#5a2348] transition hover:bg-[#fff6f0]/70">
      <td className="border-b border-[#f1e3dc] px-3 py-3">
        <span className="block font-semibold">{item.createdLabel}</span>
        <span className="mt-1 block text-xs text-[#7b5a6a]">
          Last: {item.lastActivityLabel}
        </span>
      </td>
      <td className="border-b border-[#f1e3dc] px-3 py-3 font-semibold">
        {item.customerName}
      </td>
      <td className="border-b border-[#f1e3dc] px-3 py-3">
        <span className="block font-semibold">{item.normalizedPhone}</span>
        <span className="mt-1 block text-xs text-[#7b5a6a]">
          {item.canonicalIdentity}
        </span>
      </td>
      <td className="border-b border-[#f1e3dc] px-3 py-3">{item.brandName}</td>
      <td className="border-b border-[#f1e3dc] px-3 py-3">
        <span className="block font-semibold">{item.treatmentOffer}</span>
        <span className="mt-1 block text-xs text-[#7b5a6a]">
          {item.packagePrice}
        </span>
      </td>
      <td className="border-b border-[#f1e3dc] px-3 py-3">
        <span className="rounded-full bg-[#fff6f0] px-3 py-1 text-xs font-bold text-[#9a5d76]">
          {item.sourceLabel}
        </span>
      </td>
      <td className="border-b border-[#f1e3dc] px-3 py-3">
        {item.ctwa.ctwa_source_id || "—"}
      </td>
      <td className="max-w-[220px] border-b border-[#f1e3dc] px-3 py-3">
        <span className="block font-semibold">{item.landingPageSlug || "—"}</span>
        <span className="mt-1 block truncate text-xs text-[#7b5a6a]">
          {item.pageUrl || "未有 Page URL"}
        </span>
      </td>
      <td className="border-b border-[#f1e3dc] px-3 py-3">
        <span className="block">{item.campaignLabel}</span>
        <span className="mt-1 block text-xs text-[#7b5a6a]">{item.adLabel}</span>
      </td>
      <td className="border-b border-[#f1e3dc] px-3 py-3">
        <span className="rounded-full bg-[#f6f2ff] px-3 py-1 text-xs font-bold text-[#5a2348]">
          {item.statusLabel}
        </span>
      </td>
      <td className="border-b border-[#f1e3dc] px-3 py-3">{item.assignedCsLabel}</td>
      <td className="border-b border-[#f1e3dc] px-3 py-3">{item.nextFollowUpLabel}</td>
      <td className="border-b border-[#f1e3dc] px-3 py-3">
        {item.whatsappUrl ? (
          <a
            href={item.whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="alyssa-focus rounded-full bg-[#e46f64] px-3 py-2 text-xs font-bold text-white"
          >
            WhatsApp
          </a>
        ) : (
          <span className="text-xs text-[#9a5d76]">未有電話</span>
        )}
      </td>
      <td className="border-b border-[#f1e3dc] px-3 py-3">
        <Link
          href={`/crm/leads/${item.id}`}
          className="alyssa-focus rounded-full border border-[#ead9cf] bg-white px-3 py-2 text-xs font-bold text-[#5a2348]"
        >
          開啟
        </Link>
      </td>
    </tr>
  );
}
