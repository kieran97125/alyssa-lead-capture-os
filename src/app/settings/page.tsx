import Link from "next/link";
import { updateBrandAction } from "@/app/settings/actions";
import { AppNav } from "@/components/alyssa/AppNav";
import { SettingsBrandPicker } from "@/components/alyssa/SettingsBrandPicker";
import { SettingsNav } from "@/components/alyssa/SettingsNav";
import {
  getBrandPixelId,
  getVisibleBrands,
} from "@/lib/data/brandOperations";
import {
  getConfigurationData,
  type BrandSetting,
} from "@/lib/data/configuration";
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
  const selectedBrand =
    visibleBrands.find(
      (brand) =>
        brand.slug === selectedBrandParam || brand.id === selectedBrandParam
    ) ??
    visibleBrands[0] ??
    null;
  const message = firstParam(query?.message);
  const status = firstParam(query?.settings_status);
  const brandSlug = selectedBrand?.slug || "";
  const treatments = config.treatments.filter(
    (item) => item.brandId === selectedBrand?.id
  );
  const treatmentIds = new Set(treatments.map((item) => item.id));
  const packages = config.packages.filter((item) =>
    treatmentIds.has(item.treatmentId)
  );
  const branches = config.branches.filter(
    (item) => item.brandId === selectedBrand?.id
  );
  const forms = config.forms.filter(
    (item) => item.brandId === selectedBrand?.id
  );
  const landingPages = config.landingPages.filter(
    (item) => item.brandId === selectedBrand?.id
  );
  const legalProfile = selectedBrand
    ? getBrandLegalProfileFromSettings(selectedBrand)
    : null;
  const effectivePixelId = getBrandPixelId(
    selectedBrand?.slug,
    selectedBrand?.metaPixelId
  );
  const managementRows = [
    {
      href: "/settings/brands",
      title: "品牌資料",
      description: "名稱、Logo、品牌色、WhatsApp 及 Thank You Page",
      count: null,
    },
    {
      href: `/settings/treatments?brand=${brandSlug}`,
      title: "療程",
      description: "管理可供表格及 Campaign 使用的療程",
      count: treatments.length,
    },
    {
      href: `/settings/packages?brand=${brandSlug}`,
      title: "Offer／項目及價錢",
      description: "同一療程下的計劃組別、項目、原價及優惠價",
      count: packages.length,
    },
    {
      href: `/settings/branches?brand=${brandSlug}`,
      title: "分店",
      description: "地址、營業時間及表格可選分店",
      count: branches.length,
    },
    {
      href: `/forms?brand=${brandSlug}`,
      title: "表格",
      description: "表格欄位、預設療程、Offer、分店及嵌入設定",
      count: forms.length,
    },
    {
      href: `/landing-pages?brand=${brandSlug}`,
      title: "Landing Pages",
      description: "已建立及已發布的廣告頁面",
      count: landingPages.length,
    },
  ];

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <header className="rounded-[28px] border border-[#ead9cf] bg-white/88 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.08)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="alyssa-kicker">Settings</p>
              <h1 className="mt-2 text-3xl font-bold text-[#321428]">
                品牌設定
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
                先選品牌，再管理療程、Offer、分店、表格及追蹤設定。
              </p>
            </div>
            <SettingsBrandPicker
              brands={visibleBrands}
              selectedBrandId={selectedBrand?.id}
              basePath="/settings"
            />
          </div>
          <SettingsNav />
        </header>

        {message && <StatusMessage tone={status}>{message}</StatusMessage>}

        {selectedBrand && (
          <>
            <section
              aria-labelledby="management-heading"
              className="mt-6 overflow-hidden rounded-[24px] border border-[#ead9cf] bg-white/92 shadow-[0_18px_50px_rgba(90,35,72,0.06)]"
            >
              <div className="border-b border-[#ead9cf] px-5 py-4">
                <p className="alyssa-kicker">Brand Library</p>
                <h2
                  id="management-heading"
                  className="mt-1 text-xl font-bold text-[#321428]"
                >
                  {selectedBrand.name}
                </h2>
              </div>
              <div data-testid="settings-management-list">
                {managementRows.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="grid gap-2 border-b border-[#f1e3dc] px-5 py-4 transition last:border-b-0 hover:bg-[#fff9f3] sm:grid-cols-[minmax(170px,0.55fr)_minmax(280px,1.25fr)_90px_70px] sm:items-center"
                  >
                    <span className="font-bold text-[#321428]">
                      {item.title}
                    </span>
                    <span className="text-sm font-semibold leading-6 text-[#6d4a5c]">
                      {item.description}
                    </span>
                    <span className="text-sm font-bold text-[#9a5d76]">
                      {item.count === null ? "共用設定" : `${item.count} 項`}
                    </span>
                    <span className="text-right text-sm font-bold text-[#5a2348]">
                      管理 →
                    </span>
                  </Link>
                ))}
              </div>
            </section>

            <section className="mt-6 rounded-[24px] border border-[#ead9cf] bg-white/92 p-5 shadow-[0_18px_50px_rgba(90,35,72,0.06)]">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="alyssa-kicker">Tracking</p>
                  <h2 className="mt-1 text-xl font-bold text-[#321428]">
                    Meta Pixel
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
                    儲存一次後，LaunchHub Landing Page、表格及新生成的 Wix Embed
                    會自動使用此品牌 Pixel。
                  </p>
                </div>
                <span
                  className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${
                    effectivePixelId
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-800"
                  }`}
                >
                  {selectedBrand.metaPixelId
                    ? "品牌設定已啟用"
                    : effectivePixelId
                      ? "使用舊環境設定"
                      : "未設定"}
                </span>
              </div>

              <form
                action={updateBrandAction}
                className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.2fr_auto]"
              >
                <BrandHiddenFields brand={selectedBrand} includePixel={false} />
                <input
                  type="hidden"
                  name="returnPath"
                  value={`/settings?brand=${selectedBrand.slug}`}
                />
                <TextInput
                  label="Meta Pixel ID"
                  name="metaPixelId"
                  defaultValue={selectedBrand.metaPixelId ?? ""}
                  placeholder="只輸入數字 ID"
                  inputMode="numeric"
                  required={false}
                />
                <label className="flex min-w-0 items-start gap-3 rounded-2xl border border-[#ead9cf] bg-[#fff9f3] px-4 py-3">
                  <input
                    type="checkbox"
                    name="metaPixelPageViewOnEmbed"
                    defaultChecked={selectedBrand.metaPixelPageViewOnEmbed}
                    className="mt-1 h-4 w-4 shrink-0"
                  />
                  <span>
                    <span className="block text-sm font-bold text-[#321428]">
                      Wix Embed 亦由 LaunchHub 發 PageView
                    </span>
                    <span className="mt-1 block text-xs font-semibold leading-5 text-[#7b5a6a]">
                      如果 Wix 已經經 Meta Integration 安裝同一 Pixel，請保持關閉，避免重複
                      PageView。
                    </span>
                  </span>
                </label>
                <button className="self-end rounded-full bg-[#5a2348] px-5 py-3 text-sm font-bold text-white">
                  儲存 Pixel
                </button>
              </form>
            </section>

            <details className="mt-5 rounded-[24px] border border-[#ead9cf] bg-white/88">
              <summary className="cursor-pointer px-5 py-4 text-sm font-bold text-[#321428]">
                法律及營運方設定
              </summary>
              <form
                action={updateBrandAction}
                className="grid gap-4 border-t border-[#f1e3dc] p-5 lg:grid-cols-3"
              >
                <BrandHiddenFields brand={selectedBrand} includePixel />
                <input
                  type="hidden"
                  name="returnPath"
                  value={`/settings?brand=${selectedBrand.slug}`}
                />
                <TextInput
                  label="Operator / company"
                  name="operatorName"
                  defaultValue={legalProfile?.operatingCompanyName || ""}
                />
                <TextInput
                  label="Legal page URL"
                  name="legalPageUrl"
                  defaultValue={legalProfile?.legalPageUrl || ""}
                  required={false}
                />
                <TextInput
                  label="Legal link label"
                  name="legalLinkLabel"
                  defaultValue={
                    legalProfile?.legalLinkLabel ||
                    DEFAULT_SINGLE_LEGAL_LINK_LABEL
                  }
                  required={false}
                />
                <TextInput
                  label="Privacy Policy URL"
                  name="privacyUrl"
                  defaultValue={legalProfile?.privacyPolicyUrl || ""}
                  required={false}
                />
                <TextInput
                  label="Disclaimer URL"
                  name="disclaimerUrl"
                  defaultValue={legalProfile?.disclaimerUrl || ""}
                  required={false}
                />
                <div className="flex items-end">
                  <button className="rounded-full bg-[#5a2348] px-5 py-3 text-sm font-bold text-white">
                    儲存法律設定
                  </button>
                </div>
              </form>
            </details>

            <details className="mt-5 rounded-[24px] border border-[#ead9cf] bg-white/88">
              <summary className="cursor-pointer px-5 py-4 text-sm font-bold text-[#321428]">
                進階及低頻設定
              </summary>
              <div className="grid border-t border-[#f1e3dc] sm:grid-cols-3">
                <AdvancedLink
                  href="/settings/templates"
                  title="Landing Page 版型"
                />
                <AdvancedLink href="/settings/team" title="團隊權限" />
                <AdvancedLink href="/system-audit" title="System Audit" />
              </div>
            </details>
          </>
        )}
      </div>
    </main>
  );
}

function BrandHiddenFields({
  brand,
  includePixel,
}: {
  brand: BrandSetting;
  includePixel: boolean;
}) {
  return (
    <>
      <input type="hidden" name="id" value={brand.id} />
      <input type="hidden" name="name" value={brand.name} />
      <input type="hidden" name="slug" value={brand.slug} />
      <input
        type="hidden"
        name="whatsappNumber"
        value={brand.whatsappNumber ?? ""}
      />
      <input
        type="hidden"
        name="defaultThankYouUrl"
        value={brand.defaultThankYouUrl ?? ""}
      />
      <input type="hidden" name="logoUrl" value={brand.logoUrl ?? ""} />
      <input
        type="hidden"
        name="primaryColor"
        value={brand.primaryColor ?? ""}
      />
      <input
        type="hidden"
        name="secondaryColor"
        value={brand.secondaryColor ?? ""}
      />
      {!includePixel && (
        <>
          <input
            type="hidden"
            name="legalPageUrl"
            value={brand.legalPageUrl ?? ""}
          />
          <input
            type="hidden"
            name="legalLinkLabel"
            value={brand.legalLinkLabel ?? ""}
          />
          <input
            type="hidden"
            name="privacyUrl"
            value={brand.privacyUrl ?? ""}
          />
          <input
            type="hidden"
            name="disclaimerUrl"
            value={brand.disclaimerUrl ?? ""}
          />
          <input
            type="hidden"
            name="operatorName"
            value={brand.operatorName ?? ""}
          />
        </>
      )}
      {includePixel && (
        <>
          <input
            type="hidden"
            name="metaPixelId"
            value={brand.metaPixelId ?? ""}
          />
          {brand.metaPixelPageViewOnEmbed && (
            <input
              type="hidden"
              name="metaPixelPageViewOnEmbed"
              value="true"
            />
          )}
        </>
      )}
    </>
  );
}

function AdvancedLink({ href, title }: { href: string; title: string }) {
  return (
    <Link
      href={href}
      className="border-b border-[#f1e3dc] px-5 py-4 text-sm font-bold text-[#5a2348] transition hover:bg-[#fff9f3] sm:border-b-0 sm:border-r sm:last:border-r-0"
    >
      {title} →
    </Link>
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
  defaultValue = "",
  placeholder,
  inputMode,
  required = true,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  inputMode?: "numeric";
  required?: boolean;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#9a5d76]">
        {label}
      </span>
      <input
        name={name}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        inputMode={inputMode}
        className="mt-2 w-full rounded-2xl border border-[#ead9cf] bg-[#fff9f3] px-4 py-3 text-sm font-semibold text-[#5a2348] outline-none transition focus:border-[#e46f64] focus:bg-white"
      />
    </label>
  );
}
