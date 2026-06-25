import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";
import { MotionReveal } from "@/components/alyssa/MotionReveal";
import {
  asNumber,
  campaignLabel,
  contentLabel,
  dateRangeOptions,
  displayCustomerName,
  displayPhone,
  formatAppointment,
  formatDateTime,
  getLeadRows,
  intakeStatus,
  isLikelyTestLead,
  isTrackable,
  money,
  parseRange,
  sourceLabel,
} from "@/lib/data/businessMetrics";
import { getConfigurationData } from "@/lib/data/configuration";

export const dynamic = "force-dynamic";

type LeadsSearchParams = {
  range?: string | string[];
  brand?: string | string[];
  source?: string | string[];
  campaign?: string | string[];
  treatment?: string | string[];
  branch?: string | string[];
  q?: string | string[];
  include_tests?: string | string[];
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

function buildLeadsHref(
  nextRange: string,
  current: {
    brandId: string;
    source: string;
    campaign: string;
    treatmentId: string;
    branchId: string;
    query: string;
    includeTests: boolean;
  }
) {
  const params = new URLSearchParams();
  params.set("range", nextRange);
  if (current.brandId) params.set("brand", current.brandId);
  if (current.source) params.set("source", current.source);
  if (current.campaign) params.set("campaign", current.campaign);
  if (current.treatmentId) params.set("treatment", current.treatmentId);
  if (current.branchId) params.set("branch", current.branchId);
  if (current.query) params.set("q", current.query);
  if (current.includeTests) params.set("include_tests", "1");

  return `/leads?${params.toString()}`;
}

function pageUrl(lead: Awaited<ReturnType<typeof getLeadRows>>["leads"][number]) {
  return (
    lead.sourceSnapshot?.current_page_url ||
    lead.sourceSnapshot?.landing_page_url ||
    "-"
  );
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams?: Promise<LeadsSearchParams>;
}) {
  const params = await searchParams;
  const activeRange = parseRange(params?.range);
  const selectedBrandId = firstParam(params?.brand);
  const selectedSource = firstParam(params?.source);
  const campaignSearch = firstParam(params?.campaign).trim();
  const selectedTreatmentId = firstParam(params?.treatment);
  const selectedBranchId = firstParam(params?.branch);
  const query = firstParam(params?.q).trim();
  const includeTests = firstParam(params?.include_tests) === "1";
  const config = await getConfigurationData();
  const selectedBrand = config.brands.find((brand) => brand.id === selectedBrandId);
  const brandTreatments = config.treatments.filter(
    (treatment) => !selectedBrand || treatment.brandId === selectedBrand.id
  );
  const brandBranches = config.branches.filter(
    (branch) => !selectedBrand || branch.brandId === selectedBrand.id
  );
  const { range, leads, error } = await getLeadRows(activeRange, 250, {
    brandId: selectedBrandId,
    source: selectedSource,
    campaign: campaignSearch,
    treatmentId: selectedTreatmentId,
    branchId: selectedBranchId,
    query,
    includeTestData: includeTests,
  });
  const realLeads = leads.filter((lead) => !isLikelyTestLead(lead));
  const trackedCount = realLeads.filter(isTrackable).length;
  const brandCount = new Set(realLeads.map((lead) => lead.brand_id).filter(Boolean)).size;
  const currentFilters = {
    brandId: selectedBrandId,
    source: selectedSource,
    campaign: campaignSearch,
    treatmentId: selectedTreatmentId,
    branchId: selectedBranchId,
    query,
    includeTests,
  };

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <MotionReveal>
          <section className="rounded-[28px] border border-[#ead9cf] bg-white/86 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.1)]">
            <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
                  Enquiry Records
                </p>
                <h1 className="mt-2 text-3xl font-bold text-[#321428]">
                  登記查詢紀錄
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
                  查看表格提交、品牌、療程、分店及來源資料。實際預約、到店、付款或流失結果由 CRM / CS 跟進後確認。
                </p>
              </div>
              <Link
                href="/performance"
                className="alyssa-focus rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(228,111,100,0.24)] transition hover:-translate-y-1 hover:bg-[#d95f55] hover:shadow-[0_18px_42px_rgba(228,111,100,0.32)] active:scale-[0.98]"
              >
                查看來源成效
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {dateRangeOptions.map((item) => (
                <Link
                  key={item.key}
                  href={buildLeadsHref(item.key, currentFilters)}
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

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard label="真實登記紀錄" value={`${realLeads.length}`} />
              <SummaryCard label="可追蹤來源" value={`${trackedCount}`} />
              <SummaryCard label="涉及品牌" value={`${brandCount}`} />
              <SummaryCard label="日期範圍" value={range.label} />
            </div>

            {error && (
              <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                登記紀錄暫時未能讀取，請稍後再試。
              </p>
            )}
          </section>
        </MotionReveal>

        <MotionReveal delay={0.08}>
          <section className="alyssa-premium-card mt-6 p-5">
            <form className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_1fr_1fr_1.2fr_auto]" method="get">
              <input type="hidden" name="range" value={activeRange} />
              <FilterSelect
                label="品牌"
                name="brand"
                value={selectedBrandId}
                options={config.brands.map((brand) => ({
                  value: brand.id,
                  label: brand.name,
                }))}
              />
              <FilterSelect
                label="來源"
                name="source"
                value={selectedSource}
                options={[
                  { value: "meta", label: "Meta" },
                  { value: "google", label: "Google" },
                  { value: "直接", label: "直接 / 無追蹤" },
                  { value: "whatsapp", label: "WhatsApp" },
                ]}
              />
              <FilterSelect
                label="療程"
                name="treatment"
                value={selectedTreatmentId}
                options={brandTreatments.map((treatment) => ({
                  value: treatment.id,
                  label: treatment.name,
                }))}
              />
              <FilterSelect
                label="分店"
                name="branch"
                value={selectedBranchId}
                options={brandBranches.map((branch) => ({
                  value: branch.id,
                  label: branch.name,
                }))}
              />
              <TextFilter
                label="Campaign / 內容"
                name="campaign"
                value={campaignSearch}
                placeholder="campaign / content"
              />
              <TextFilter
                label="客人 / 電話"
                name="q"
                value={query}
                placeholder="姓名 / 電話"
              />
              <button className="self-end rounded-full bg-[#5a2348] px-5 py-3 text-sm font-bold text-white">
                篩選
              </button>
              <label className="lg:col-span-7 flex items-center gap-2 text-xs font-bold text-[#7b5a6a]">
                <input
                  type="checkbox"
                  name="include_tests"
                  value="1"
                  defaultChecked={includeTests}
                />
                <span>顯示內部測試資料</span>
                <span className="font-semibold text-[#9a5d76]">
                  測試資料只供檢查，不會計入上方真實數字。
                </span>
              </label>
            </form>
          </section>
        </MotionReveal>

        <MotionReveal delay={0.12}>
          <section className="alyssa-premium-card mt-6 min-w-0 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <h2 className="text-xl font-bold text-[#321428]">最新登記紀錄</h2>
              <p className="text-sm font-semibold text-[#7b5a6a]">
                預設隱藏明顯內部測試資料，最多顯示 250 筆。
              </p>
            </div>
            <div className="mt-4 max-w-full overflow-x-auto">
              <table className="alyssa-table min-w-[1320px] text-left text-sm">
                <thead>
                  <tr className="text-xs font-bold uppercase tracking-[0.12em] text-[#9a5d76]">
                    {[
                      "登記時間",
                      "品牌",
                      "客人",
                      "電話",
                      "療程 / 套餐",
                      "分店",
                      "偏好日期時間",
                      "來源",
                      "Campaign / 內容",
                      "Page URL",
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
                      const isTestLead = isLikelyTestLead(lead);

                      return (
                      <tr key={lead.id} className="align-top text-[#5a2348] transition hover:bg-[#fff6f0]/70">
                        <td className="border-b border-[#f1e3dc] px-3 py-3">
                          {formatDateTime(lead.created_at)}
                        </td>
                        <td className="border-b border-[#f1e3dc] px-3 py-3">
                          {lead.brand?.name || "未標記"}
                        </td>
                        <td className="border-b border-[#f1e3dc] px-3 py-3 font-bold text-[#321428]">
                          {displayCustomerName(lead)}
                          {isTestLead && (
                            <span className="ml-2 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                              內部測試
                            </span>
                          )}
                        </td>
                        <td className="border-b border-[#f1e3dc] px-3 py-3">
                          {displayPhone(lead)}
                        </td>
                        <td className="border-b border-[#f1e3dc] px-3 py-3">
                          <span className="block font-semibold">
                            {lead.treatment?.name || "未標記"}
                          </span>
                          <span className="mt-1 block text-xs font-semibold text-[#7b5a6a]">
                            {lead.package?.name || "未標記"} ·{" "}
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
                          <span className="block font-semibold">
                            {campaignLabel(lead)}
                          </span>
                          <span className="mt-1 block text-xs font-semibold text-[#7b5a6a]">
                            {contentLabel(lead)}
                          </span>
                        </td>
                        <td className="max-w-[280px] border-b border-[#f1e3dc] px-3 py-3">
                          <span className="line-clamp-2 break-all text-xs font-semibold text-[#7b5a6a]">
                            {pageUrl(lead)}
                          </span>
                        </td>
                        <td className="border-b border-[#f1e3dc] px-3 py-3">
                          <span className="rounded-full bg-[#fff6f0] px-3 py-1 text-xs font-bold text-[#9a5d76]">
                            {intakeStatus(lead)}
                          </span>
                        </td>
                      </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={11} className="px-3 py-10 text-center text-sm font-semibold text-[#7b5a6a]">
                        {error
                          ? "登記紀錄暫時未能讀取，請稍後再試。"
                          : query ||
                              selectedBrandId ||
                              selectedSource ||
                              campaignSearch ||
                              selectedTreatmentId ||
                              selectedBranchId
                            ? "沒有符合篩選的登記紀錄。"
                            : "暫未有登記紀錄。"}
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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-[#fff6f0] p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {label}
      </p>
      <p className="mt-2 break-words text-lg font-bold text-[#321428]">
        {value}
      </p>
    </div>
  );
}

function FilterSelect({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {label}
      </span>
      <select
        name={name}
        defaultValue={value}
        className="mt-2 w-full rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-4 py-3 text-sm font-semibold text-[#5a2348] outline-none focus:border-[#e46f64] focus:bg-white"
      >
        <option value="">全部</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextFilter({
  label,
  name,
  value,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  placeholder: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {label}
      </span>
      <input
        name={name}
        defaultValue={value}
        placeholder={placeholder}
        className="mt-2 w-full rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-4 py-3 text-sm font-semibold text-[#5a2348] outline-none focus:border-[#e46f64] focus:bg-white"
      />
    </label>
  );
}
