import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";
import { createCampaignAction } from "@/app/campaigns/new/actions";
import {
  getBranch,
  getBrand,
  getConfigurationData,
  getPackage,
  getTreatment,
  packagePriceLabel,
  type FormSetting,
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
            <p className="alyssa-kicker">Launch</p>
            <h1 className="mt-2 text-3xl font-bold text-[#321428]">
              建立新 Campaign
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
              選擇今次 Campaign 要輸出 Wix 嵌入表格，還是完整 Landing Page。表格、Landing Page 和 Leads 會共用同一套品牌、療程、優惠和分店資料。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/settings#brand-library"
              className="rounded-full border border-[#d9b66f] bg-white px-5 py-3 text-sm font-bold text-[#5a2348]"
            >
              Brand Library
            </Link>
            <Link
              href="/landing-pages"
              className="rounded-full border border-[#d9b66f] bg-white px-5 py-3 text-sm font-bold text-[#5a2348]"
            >
              Landing Pages
            </Link>
          </div>
        </header>

        <section className="mt-5 rounded-2xl border border-[#ead9cf] bg-white/82 px-5 py-4 text-sm leading-6 text-[#6d4a5c]">
          Launch 會用 Brand Library 入面的品牌、療程、優惠套餐和分店資料建立 Campaign。若資料未齊，請先到 Brand Library 更新，再回來建立表格或 Landing Page。
        </section>

        {message && (
          <div className="mt-5 rounded-2xl border border-[#d9b66f] bg-[#fff6f0] px-4 py-3 text-sm font-bold text-[#5a2348]">
            {message}
          </div>
        )}

        <form action={createCampaignAction} className="mt-6 grid gap-6">
          <section className="alyssa-premium-card p-5">
            <p className="alyssa-kicker">1. 選擇建立方式</p>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <ChoiceCard
                value="new_landing_page"
                title="建立 Wix 登記表格及 Landing Page"
                body="適合測試新優惠、新療程或新文案角度。系統會建立新表格，並連接到新的 Landing Page。"
                defaultChecked
              />
              <ChoiceCard
                value="wix_form"
                title="只建立 Wix 登記表格"
                body="適合 Wix 頁面已有內容，只需要一張可嵌入的登記表格收集 Leads。"
              />
              <ChoiceCard
                value="existing_form_landing_page"
                title="用現有表格開 Landing Page"
                body="適合重用已準備好的登記表格，再開一頁新的廣告 Landing Page。"
              />
            </div>
          </section>

          <section className="alyssa-premium-card p-5">
            <p className="alyssa-kicker">2. 基本資料</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <TextField
                label="Campaign 名稱"
                name="campaignName"
                placeholder="例：Ineffable $388 柔清舒敏護理"
              />
              <TextField
                label="表格名稱"
                name="formName"
                placeholder="留空則使用 Campaign 名稱"
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
                    getBrand(config, treatment.brandId)?.name ?? "未設定品牌"
                  })`,
                }))}
              />
              <SelectField
                label="優惠 / 套餐"
                name="defaultPackageId"
                defaultValue={firstPackage?.id}
                options={config.packages.map((item) => ({
                  value: item.id,
                  label: `${packagePriceLabel(item)} (${
                    getTreatment(config, item.treatmentId)?.name ?? "未設定療程"
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
                    getBrand(config, branch.brandId)?.name ?? "未設定品牌"
                  })`,
                }))}
              />
            </div>

            <label className="mt-4 block min-w-0">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
                可使用表格的網站網址
              </span>
              <textarea
                name="allowedDomains"
                rows={3}
                placeholder="https://www.example.com&#10;https://campaign.example.com"
                className="mt-2 w-full rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-4 py-3 text-sm font-semibold leading-6 text-[#5a2348] outline-none transition focus:border-[#e46f64] focus:bg-white"
              />
            </label>
          </section>

          <section className="alyssa-premium-card p-5">
            <p className="alyssa-kicker">3. 現有表格</p>
            <h2 className="mt-2 text-xl font-bold text-[#321428]">
              如選擇重用表格，請指定要連接的登記表格
            </h2>
            {config.forms.length > 0 ? (
              <>
                <SelectField
                  label="選擇現有表格"
                  name="existingFormId"
                  defaultValue={config.forms[0]?.id}
                  required={false}
                  options={config.forms.map((form) => ({
                    value: form.id,
                    label: form.formName,
                  }))}
                />
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {config.forms.slice(0, 4).map((form) => (
                    <ExistingFormSummary
                      key={form.id}
                      form={form}
                      brand={getBrand(config, form.brandId)?.name ?? "未設定品牌"}
                      treatment={
                        getTreatment(config, form.defaultTreatmentId)?.name ??
                        "未設定療程"
                      }
                      packageLabel={packagePriceLabel(
                        getPackage(config, form.defaultPackageId)
                      )}
                      branch={
                        getBranch(config, form.defaultBranchId)?.name ??
                        "未設定分店"
                      }
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="mt-4 rounded-2xl border border-[#ead9cf] bg-[#fff6f0] p-4">
                <p className="text-sm font-semibold text-[#5a2348]">
                  暫時未有可重用的表格。
                </p>
                <Link
                  href="/forms/new"
                  className="mt-3 inline-flex rounded-full bg-[#5a2348] px-4 py-2 text-sm font-bold text-white"
                >
                  建立表格
                </Link>
              </div>
            )}
          </section>

          <section className="alyssa-premium-card p-5">
            <p className="alyssa-kicker">4. Landing Page 內容</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <TextField
                label="頁面標題"
                name="pageTitle"
                placeholder="例：$388 柔清舒敏護理首次體驗"
                required={false}
              />
              <TextField
                label="Hero 標題"
                name="heroTitle"
                placeholder="例：首次體驗柔清舒敏護理"
                required={false}
              />
              <TextField
                label="優惠標籤"
                name="offerBadge"
                placeholder="例：HK$388 首次體驗優惠"
                required={false}
              />
              <TextField
                label="CTA 按鈕文字"
                name="ctaText"
                placeholder="例：立即預約體驗"
                required={false}
              />
              <TextAreaField
                label="Hero 簡介"
                name="heroSubtitle"
                placeholder="簡短說明療程、優惠和預約安排。"
              />
            </div>
          </section>

          <section className="alyssa-premium-card p-5">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="alyssa-kicker">5. 建立</p>
                <h2 className="mt-2 text-xl font-bold text-[#321428]">
                  建立 Campaign 並進入下一步
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">
                  Wix 表格會前往表格詳情頁；Landing Page 會前往內容編輯頁。
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
          name="campaignMode"
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

function ExistingFormSummary({
  form,
  brand,
  treatment,
  packageLabel,
  branch,
}: {
  form: FormSetting;
  brand: string;
  treatment: string;
  packageLabel: string;
  branch: string;
}) {
  return (
    <article className="min-w-0 rounded-2xl border border-[#ead9cf] bg-[#fff6f0] p-4">
      <h3 className="font-bold text-[#321428]">{form.formName}</h3>
      <div className="mt-3 grid gap-2 text-xs font-semibold leading-5 text-[#6d4a5c]">
        <p>{brand}</p>
        <p>{treatment}</p>
        <p>{packageLabel}</p>
        <p>{branch}</p>
      </div>
    </article>
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
  required = true,
}: {
  label: string;
  name: string;
  options: Array<{ value: string; label: string }>;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {label}
      </span>
      <select
        name={name}
        required={required}
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
