import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";
import { createCampaignAction } from "@/app/campaigns/new/actions";
import {
  getBrand,
  getConfigurationData,
  getTreatment,
  packagePriceLabel,
} from "@/lib/data/configuration";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams?: Promise<{ campaign_status?: string | string[] }>;
}) {
  const config = await getConfigurationData();
  const query = await searchParams;
  const message =
    typeof query?.campaign_status === "string" ? query.campaign_status : null;
  const firstBrand = config.brands[0];
  const firstTreatment = config.treatments.find(
    (item) => item.brandId === firstBrand?.id
  );
  const firstPackage = config.packages.find(
    (item) => item.treatmentId === firstTreatment?.id
  );
  const firstBranch = config.branches.find(
    (item) => item.brandId === firstBrand?.id
  );

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-6xl px-5 py-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="alyssa-kicker">建立 Campaign</p>
            <h1 className="mt-2 text-3xl font-bold text-[#321428]">
              建立新 Campaign
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
              選擇建立 Wix 登記表格，或建立一頁簡單廣告 Landing Page 連接同一張表格。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/forms"
              className="rounded-full border border-[#d9b66f] bg-white px-5 py-3 text-sm font-bold text-[#5a2348]"
            >
              查看表格
            </Link>
            <Link
              href="/landing-pages"
              className="rounded-full border border-[#d9b66f] bg-white px-5 py-3 text-sm font-bold text-[#5a2348]"
            >
              查看 Landing Pages
            </Link>
          </div>
        </header>

        {message && (
          <div className="mt-5 rounded-2xl border border-[#d9b66f] bg-[#fff6f0] px-4 py-3 text-sm font-bold text-[#5a2348]">
            {message}
          </div>
        )}

        <form action={createCampaignAction} className="mt-6 grid gap-6">
          <section className="alyssa-premium-card p-5">
            <p className="alyssa-kicker">1. Campaign 類型</p>
            <h2 className="mt-2 text-xl font-bold text-[#321428]">
              今次需要建立什麼？
            </h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <ChoiceCard
                value="wix_form"
                title="Wix 登記表格"
                body="適合 Wix 頁面已經有內容，只需要嵌入登記表格收集 Leads。"
                defaultChecked
              />
              <ChoiceCard
                value="landing_page"
                title="廣告 Landing Page"
                body="適合快速測試新優惠、新療程或新文案角度，並連接一張新登記表格。"
              />
            </div>
          </section>

          <section className="alyssa-premium-card p-5">
            <p className="alyssa-kicker">2. 基本設定</p>
            <h2 className="mt-2 text-xl font-bold text-[#321428]">
              選擇品牌、療程、套餐價錢及分店
            </h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <TextField
                label="Campaign 名稱"
                name="campaignName"
                placeholder="例如：Alyssa HK$388 首次體驗"
              />
              <TextField
                label="表格名稱"
                name="formName"
                placeholder="留空會沿用 Campaign 名稱"
                required={false}
              />
              <SelectField
                label="品牌"
                name="brandId"
                defaultValue={firstBrand?.id}
                options={config.brands.map((brand) => ({
                  value: brand.id,
                  label: brand.name,
                }))}
              />
              <SelectField
                label="療程"
                name="defaultTreatmentId"
                defaultValue={firstTreatment?.id}
                options={config.treatments.map((treatment) => ({
                  value: treatment.id,
                  label: `${treatment.name} (${
                    getBrand(config, treatment.brandId)?.name ?? "品牌"
                  })`,
                }))}
              />
              <SelectField
                label="套餐價錢"
                name="defaultPackageId"
                defaultValue={firstPackage?.id}
                options={config.packages.map((item) => ({
                  value: item.id,
                  label: `${packagePriceLabel(item)} (${
                    getTreatment(config, item.treatmentId)?.name ?? "療程"
                  })`,
                }))}
              />
              <SelectField
                label="分店"
                name="defaultBranchId"
                defaultValue={firstBranch?.id}
                options={config.branches.map((branch) => ({
                  value: branch.id,
                  label: `${branch.name} (${
                    getBrand(config, branch.brandId)?.name ?? "品牌"
                  })`,
                }))}
              />
            </div>

            <label className="mt-4 block min-w-0">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
                可使用此表格的網站
              </span>
              <textarea
                name="allowedDomains"
                rows={4}
                placeholder="https://www.example.com&#10;https://campaign.example.com"
                className="mt-2 w-full rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-4 py-3 text-sm font-semibold leading-6 text-[#5a2348] outline-none transition focus:border-[#e46f64] focus:bg-white"
              />
              <span className="mt-2 block text-xs font-semibold leading-5 text-[#7b5a6a]">
                如只用系統產生的 Landing Page，可暫時留空；如嵌入 Wix，請加入 Wix 頁面網址。
              </span>
            </label>
          </section>

          <section className="alyssa-premium-card p-5">
            <p className="alyssa-kicker">3. Landing Page 內容</p>
            <h2 className="mt-2 text-xl font-bold text-[#321428]">
              如果選擇 Landing Page，可先填寫基本文案
            </h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <TextField
                label="頁面標題"
                name="pageTitle"
                placeholder="例如：Alyssa 首次體驗優惠"
                required={false}
              />
              <TextField
                label="Hero 標題"
                name="heroTitle"
                placeholder="留空會沿用頁面標題"
                required={false}
              />
              <TextField
                label="優惠標籤"
                name="offerBadge"
                placeholder="例如：HK$388 首次體驗"
                required={false}
              />
              <TextField
                label="CTA 文字"
                name="ctaText"
                placeholder="例如：立即預約體驗"
                required={false}
              />
              <TextAreaField
                label="Hero 副標題"
                name="heroSubtitle"
                placeholder="簡短說明今次優惠、療程價值或適合人群。"
              />
            </div>
          </section>

          <section className="alyssa-premium-card p-5">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="alyssa-kicker">4. 建立</p>
                <h2 className="mt-2 text-xl font-bold text-[#321428]">
                  建立 Campaign 後即可預覽及使用
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">
                  Wix 表格會前往表格設定；Landing Page 會前往內容編輯頁，並連接新表格。
                </p>
              </div>
              <button
                type="submit"
                className="rounded-full bg-[#e46f64] px-6 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(228,111,100,0.22)] transition hover:-translate-y-1 hover:bg-[#d95f55]"
              >
                建立 Campaign
              </button>
            </div>
          </section>
        </form>
      </div>
    </main>
  );
}

function ChoiceCard({
  value,
  title,
  body,
  defaultChecked = false,
}: {
  value: string;
  title: string;
  body: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="block min-w-0 cursor-pointer rounded-[22px] border border-[#ead9cf] bg-[#fff6f0] p-4 transition hover:border-[#c9828e] hover:bg-white">
      <div className="flex items-start gap-3">
        <input
          type="radio"
          name="outputType"
          value={value}
          defaultChecked={defaultChecked}
          className="mt-1"
        />
        <span>
          <span className="block text-lg font-bold text-[#321428]">{title}</span>
          <span className="mt-2 block text-sm font-semibold leading-6 text-[#6d4a5c]">
            {body}
          </span>
        </span>
      </div>
    </label>
  );
}

function TextField({
  label,
  name,
  placeholder,
  required = true,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {label}
      </span>
      <input
        name={name}
        required={required}
        placeholder={placeholder}
        className="mt-2 w-full rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-4 py-3 text-sm font-semibold text-[#5a2348] outline-none transition focus:border-[#e46f64] focus:bg-white"
      />
    </label>
  );
}

function TextAreaField({
  label,
  name,
  placeholder,
}: {
  label: string;
  name: string;
  placeholder?: string;
}) {
  return (
    <label className="block min-w-0 md:col-span-2">
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {label}
      </span>
      <textarea
        name={name}
        rows={4}
        placeholder={placeholder}
        className="mt-2 w-full rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-4 py-3 text-sm font-semibold leading-6 text-[#5a2348] outline-none transition focus:border-[#e46f64] focus:bg-white"
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  options,
  defaultValue,
}: {
  label: string;
  name: string;
  options: Array<{ value: string; label: string }>;
  defaultValue?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {label}
      </span>
      <select
        name={name}
        required
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-4 py-3 text-sm font-semibold text-[#5a2348] outline-none transition focus:border-[#e46f64] focus:bg-white"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
