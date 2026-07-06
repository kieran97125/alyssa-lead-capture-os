import Link from "next/link";
import { updateBrandAction } from "@/app/settings/actions";
import { AppNav } from "@/components/alyssa/AppNav";
import { MotionReveal } from "@/components/alyssa/MotionReveal";
import { SettingsNav } from "@/components/alyssa/SettingsNav";
import { getVisibleBrands } from "@/lib/data/brandOperations";
import { getConfigurationData } from "@/lib/data/configuration";
import {
  DEFAULT_SINGLE_LEGAL_LINK_LABEL,
  getBrandLegalProfileFromSettings,
} from "@/lib/legal/consent";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    brand?: string | string[];
    settings_status?: string | string[];
    message?: string | string[];
  }>;
}) {
  const [config, query] = await Promise.all([
    getConfigurationData(),
    searchParams,
  ]);
  const visibleBrands = getVisibleBrands(config.brands);
  const selectedBrandParam = firstParam(query?.brand);
  const message = firstParam(query?.message);
  const status = firstParam(query?.settings_status);
  const selectedBrand =
    visibleBrands.find(
      (brand) => brand.slug === selectedBrandParam || brand.id === selectedBrandParam
    ) ?? visibleBrands[0] ?? null;
  const selectedTreatmentIds = new Set(
    config.treatments
      .filter((treatment) => treatment.brandId === selectedBrand?.id)
      .map((treatment) => treatment.id)
  );
  const treatments = config.treatments.filter(
    (treatment) => treatment.brandId === selectedBrand?.id
  );
  const packages = config.packages.filter((item) =>
    selectedTreatmentIds.has(item.treatmentId)
  );
  const branches = config.branches.filter(
    (branch) => branch.brandId === selectedBrand?.id
  );
  const forms = config.forms.filter((form) => form.brandId === selectedBrand?.id);
  const brandSlug = selectedBrand?.slug || "";
  const legalProfile = getBrandLegalProfileFromSettings(selectedBrand);
  const libraryLinks = [
    {
      href: "/settings/brands",
      title: "Brands 品牌",
      body: "管理所有 Campaign、表格及 Landing Page 可使用的品牌資料。",
      count: visibleBrands.length,
      scope: "全部真實品牌",
      emptyAction: null,
    },
    {
      href: `/settings/treatments${brandSlug ? `?brand=${brandSlug}` : ""}`,
      title: "Treatments 療程",
      body: "管理此品牌可用於表格、優惠及 Campaign 的療程資料。",
      count: treatments.length,
      scope: selectedBrand?.name || "請先選擇品牌",
      emptyAction: "新增療程",
    },
    {
      href: "/settings/packages",
      title: "Offers / Packages 優惠套餐",
      body: "管理此品牌的優惠名稱、價錢及付款設定，供表格及 Landing Page 使用。",
      count: packages.length,
      scope: selectedBrand?.name || "請先選擇品牌",
      emptyAction: "新增優惠",
    },
    {
      href: `/settings/branches${brandSlug ? `?brand=${brandSlug}` : ""}`,
      title: "Branches 分店",
      body: "管理此品牌可供客人選擇的分店資料。",
      count: branches.length,
      scope: selectedBrand?.name || "請先選擇品牌",
      emptyAction: "新增分店",
    },
    {
      href: `/legal/${brandSlug || "ineffable"}/terms`,
      title: "Legal / Operator 法律及營運方",
      body: "查看此品牌公開頁及表格使用的法律、私隱及營運方資料。",
      count: null,
      scope: selectedBrand?.name || "請先選擇品牌",
      emptyAction: null,
    },
    {
      href: `/forms${brandSlug ? `?brand=${brandSlug}` : ""}`,
      title: "Form Defaults 表格預設",
      body: "查看此品牌已建立的登記表格、預設療程、套餐及分店設定。",
      count: forms.length,
      scope: selectedBrand?.name || "請先選擇品牌",
      emptyAction: "建立表格",
    },
  ];

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <section className="rounded-[28px] border border-[#ead9cf] bg-white/86 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.1)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
                Settings
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#321428]">
                Brand Library
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
                先選擇品牌，再管理該品牌的療程、優惠、分店、法律資料及表格預設，避免混合 Alyssa 和 Ineffable 的營運資料。
              </p>
            </div>
            <Link
              href="/system-audit"
              className="rounded-full border border-[#ead9cf] bg-white px-5 py-3 text-sm font-bold text-[#5a2348] transition hover:border-[#c9828e]"
            >
              System Audit
            </Link>
          </div>
          <SettingsNav />
        </section>

        {message && <StatusMessage tone={status}>{message}</StatusMessage>}

        <section id="brand-library" className="mt-6 scroll-mt-28">
          <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="alyssa-kicker">Brand-scoped library</p>
              <h2 className="mt-2 text-2xl font-bold text-[#321428]">
                {selectedBrand?.name || "請先選擇品牌"}
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {visibleBrands.map((brand) => (
                <Link
                  key={brand.id}
                  href={`/settings?brand=${brand.slug}#brand-library`}
                  className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
                    brand.id === selectedBrand?.id
                      ? "border-[#e46f64] bg-[#e46f64] text-white"
                      : "border-[#ead9cf] bg-white text-[#5a2348]"
                  }`}
                >
                  {brand.name}
                </Link>
              ))}
            </div>
          </div>

          <div className="grid items-stretch gap-5 lg:grid-cols-2">
            {libraryLinks.map((item) => (
              <MotionReveal key={item.href}>
                <Link
                  href={item.href}
                  className="alyssa-premium-card alyssa-interactive-card alyssa-focus block h-full p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#9a5d76]">
                        {item.scope}
                      </p>
                      <h3 className="mt-2 text-xl font-bold text-[#321428]">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">
                        {item.body}
                      </p>
                      {item.count === 0 && item.emptyAction && (
                        <span className="mt-4 inline-flex rounded-full border border-[#d9b66f] bg-white px-4 py-2 text-xs font-bold text-[#5a2348]">
                          {item.emptyAction}
                        </span>
                      )}
                    </div>
                    {item.count !== null && (
                      <span className="rounded-full bg-[#fff6f0] px-3 py-1 text-sm font-bold text-[#5a2348]">
                        {item.count}
                      </span>
                    )}
                  </div>
                </Link>
              </MotionReveal>
            ))}
          </div>

          {selectedBrand && (
            <MotionReveal>
              <section className="mt-6 rounded-[28px] border border-[#ead9cf] bg-white/90 p-5 shadow-[0_18px_50px_rgba(90,35,72,0.08)]">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="alyssa-kicker">Legal / Operator</p>
                    <h3 className="mt-2 text-2xl font-bold text-[#321428]">
                      法律及營運方
                    </h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6d4a5c]">
                      此設定會套用到同一品牌所有表格及 Landing Page 頁尾法律連結。
                    </p>
                  </div>
                  <a
                    href={legalProfile.legalPageUrl || legalProfile.termsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-[#ead9cf] bg-white px-5 py-3 text-sm font-bold text-[#5a2348]"
                  >
                    開啟目前法律頁
                  </a>
                </div>

                <form
                  action={updateBrandAction}
                  className="mt-5 grid gap-4 lg:grid-cols-3"
                >
                  <input type="hidden" name="id" value={selectedBrand.id} />
                  <input
                    type="hidden"
                    name="returnPath"
                    value={`/settings?brand=${selectedBrand.slug}`}
                  />
                  <input type="hidden" name="name" value={selectedBrand.name} />
                  <input type="hidden" name="slug" value={selectedBrand.slug} />
                  <input
                    type="hidden"
                    name="whatsappNumber"
                    value={selectedBrand.whatsappNumber ?? ""}
                  />
                  <input
                    type="hidden"
                    name="primaryColor"
                    value={selectedBrand.primaryColor ?? ""}
                  />
                  <input
                    type="hidden"
                    name="secondaryColor"
                    value={selectedBrand.secondaryColor ?? ""}
                  />
                  <input
                    type="hidden"
                    name="logoUrl"
                    value={selectedBrand.logoUrl ?? ""}
                  />

                  <TextInput
                    label="Operator / company"
                    name="operatorName"
                    defaultValue={legalProfile.operatingCompanyName || ""}
                    placeholder={
                      selectedBrand.slug === "alyssa"
                        ? "Alyssa Group Limited"
                        : "YISSA GROUP LIMITED"
                    }
                  />
                  <TextInput
                    label="Privacy Policy URL"
                    name="privacyUrl"
                    type="url"
                    defaultValue={
                      selectedBrand.privacyUrl ||
                      legalProfile.privacyPolicyUrl ||
                      ""
                    }
                    placeholder="https://www.alyssa.hk/privacy"
                    required={false}
                  />
                  <TextInput
                    label="Disclaimer URL"
                    name="disclaimerUrl"
                    type="url"
                    defaultValue={
                      selectedBrand.disclaimerUrl ||
                      legalProfile.disclaimerUrl ||
                      ""
                    }
                    placeholder="https://www.alyssa.hk/disclaimer"
                    required={false}
                  />
                  <TextInput
                    label="Legal page URL"
                    name="legalPageUrl"
                    type="url"
                    defaultValue={legalProfile.legalPageUrl ?? ""}
                    placeholder="https://www.ineffablebeautyhk.com/legal"
                    required={false}
                  />
                  <TextInput
                    label="Legal link label"
                    name="legalLinkLabel"
                    defaultValue={
                      selectedBrand.legalLinkLabel ||
                      legalProfile.legalLinkLabel ||
                      DEFAULT_SINGLE_LEGAL_LINK_LABEL
                    }
                    placeholder={DEFAULT_SINGLE_LEGAL_LINK_LABEL}
                    required={false}
                  />
                  <TextInput
                    label="Default thank-you URL"
                    name="defaultThankYouUrl"
                    defaultValue={selectedBrand.defaultThankYouUrl ?? ""}
                    placeholder="https://www.alyssa.hk/thankyou"
                    required={false}
                  />
                  <div className="flex items-end lg:col-span-3">
                    <button className="rounded-full bg-[#5a2348] px-6 py-3 text-sm font-bold text-white">
                      儲存法律設定
                    </button>
                  </div>
                </form>
              </section>
            </MotionReveal>
          )}
        </section>
      </div>
    </main>
  );
}

function StatusMessage({
  tone,
  children,
}: {
  tone: string | string[] | undefined;
  children: string;
}) {
  const isSuccess = tone === "success";
  return (
    <div
      className={`mt-5 rounded-2xl border px-4 py-3 text-sm font-bold ${
        isSuccess
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-[#d9b66f] bg-[#fff6f0] text-[#5a2348]"
      }`}
    >
      {children}
    </div>
  );
}

function TextInput({
  label,
  name,
  type = "text",
  defaultValue = "",
  placeholder,
  required = true,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#9a5d76]">
        {label}
      </span>
      <input
        type={type}
        name={name}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-2 w-full rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-4 py-3 text-sm font-semibold text-[#5a2348] outline-none transition focus:border-[#e46f64] focus:bg-white"
      />
    </label>
  );
}
