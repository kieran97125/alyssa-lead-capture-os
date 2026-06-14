import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";
import { MotionReveal } from "@/components/alyssa/MotionReveal";
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
  money,
  parseRange,
  sourceLabel,
} from "@/lib/data/businessMetrics";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams?: Promise<{ range?: string | string[] }>;
}) {
  const params = await searchParams;
  const activeRange = parseRange(params?.range);
  const { range, leads, error } = await getLeadRows(activeRange, 100);

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <MotionReveal>
        <section className="rounded-[28px] border border-[#ead9cf] bg-white/82 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.1)]">
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
                Leads
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#321428]">
                最新登記紀錄
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
                查看每位客人的登記時間、品牌、療程、套餐、分店、來源、廣告系列同跟進狀態。
              </p>
            </div>
            <Link
              href="/performance"
              className="alyssa-focus rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(228,111,100,0.24)] transition hover:-translate-y-1 hover:bg-[#d95f55] hover:shadow-[0_18px_42px_rgba(228,111,100,0.32)] active:scale-[0.98]"
            >
              查看成效分析
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {dateRangeOptions.map((item) => (
              <Link
                key={item.key}
                href={`/leads?range=${item.key}`}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                  activeRange === item.key
                    ? "bg-[#5a2348] text-white"
                    : "border border-[#ead9cf] bg-white text-[#5a2348]"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {["品牌", "狀態", "來源"].map((label) => (
              <div key={label} className="min-w-0 rounded-2xl bg-[#fff6f0] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
                  {label}
                </p>
                <p className="mt-2 break-words text-sm font-semibold text-[#5a2348]">
                  篩選器準備中
                </p>
              </div>
            ))}
            <div className="min-w-0 rounded-2xl bg-[#fff6f0] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
                目前期間
              </p>
              <p className="mt-2 break-words text-sm font-semibold text-[#5a2348]">
                {range.label}
              </p>
            </div>
          </div>
          {error && (
            <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              資料暫時未能讀取，請稍後再試。
            </p>
          )}
        </section>
        </MotionReveal>

        <MotionReveal delay={0.12}>
        <section className="alyssa-premium-card mt-6 min-w-0 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="text-xl font-bold text-[#321428]">Lead feed</h2>
            <p className="text-sm font-semibold text-[#7b5a6a]">
              顯示最新 100 筆登記
            </p>
          </div>
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
        </MotionReveal>
      </div>
    </main>
  );
}
