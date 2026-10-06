import { updateBrandAction } from "@/app/settings/actions";
import { AppNav } from "@/components/alyssa/AppNav";
import { SettingsBrandPicker } from "@/components/alyssa/SettingsBrandPicker";
import { SystemDetails } from "@/components/system/SystemDetails";
import { IntentPrefetchLink } from "@/components/alyssa/IntentPrefetchLink";
import { SubmitButton } from "@/components/alyssa/SubmitButton";
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
      href: "/settings/planning",
      title: "月度 Budget／KPI",
      count: null,
    },
    {
      href: "/data-sources",
      title: "資料來源",
      count: null,
    },
    {
      href: "/settings/brands",
      title: "品牌資料",
      count: null,
    },
    {
      href: `/settings/treatments?brand=${brandSlug}`,
      title: "療程",
      count: treatments.length,
    },
    {
      href: `/settings/packages?brand=${brandSlug}`,
      title: "Offer／項目及價錢",
      count: packages.length,
    },
    {
      href: `/settings/branches?brand=${brandSlug}`,
      title: "分店",
      count: branches.length,
    },
    {
      href: `/forms?brand=${brandSlug}`,
      title: "表格",
      count: forms.length,
    },
    {
      href: `/landing-pages?brand=${brandSlug}`,
      title: "Landing Pages",
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
              <p className="alyssa-kicker">系統設定</p>
              <h1 className="mt-2 text-3xl font-bold text-[#321428]">
                品牌設定
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
                管理品牌及營運設定。
              </p>
            </div>
            <SettingsBrandPicker
              brands={visibleBrands}
              selectedBrandId={selectedBrand?.id}
              basePath="/settings"
            />
          </div>
        </header>

        {message && <StatusMessage tone={status}>{message}</StatusMessage>}

        {selectedBrand && (
          <>
            <section
              aria-labelledby="management-heading"
              className="mt-6 overflow-hidden rounded-[24px] border border-[#ead9cf] bg-white/92 shadow-[0_18px_50px_rgba(90,35,72,0.06)]"
            >
              <div className="border-b border-[#ead9cf] px-5 py-4">
                <p className="alyssa-kicker">品牌資料</p>
                <h2
                  id="management-heading"
                  className="mt-1 text-xl font-bold text-[#321428]"
                >
                  {selectedBrand.name}
                </h2>
              </div>
              <div data-testid="settings-management-list">
                {managementRows.map((item) => (
                  <IntentPrefetchLink
                    key={item.href}
                    href={item.href}
                    className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-[#f1e3dc] px-5 py-4 transition last:border-b-0 hover:bg-[#fff9f3]"
                  >
                    <span className="font-bold text-[#321428]">
                      {item.title}
                    </span>
                    <span className="text-sm font-bold text-[#9a5d76]">
                      {item.count === null ? "" : `${item.count} 項`}
                    </span>
                    <span className="text-right text-sm font-bold text-[#5a2348]">
                      管理 →
                    </span>
                  </IntentPrefetchLink>
                ))}
              </div>
            </section>

            <SystemDetails title={`追蹤設定 · Meta Pixel · ${effectivePixelId ? "已設定" : "未設定"}`} className="mt-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="alyssa-kicker">Tracking</p>
                  <h2 className="mt-1 text-xl font-bold text-[#321428]">
                    Meta Pixel
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
                    套用於此品牌的廣告頁及表格。
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
                      嵌入表格發送 PageView
                    </span>
                    <span className="mt-1 block text-xs font-semibold leading-5 text-[#7b5a6a]">
                      Wix 已安裝同一 Pixel 時請關閉，避免重複 PageView。
                    </span>
                  </span>
                </label>
                <SubmitButton
                  className="self-end rounded-full bg-[#5a2348] px-5 py-3 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-70"
                  pendingLabel="儲存 Pixel…"
                >
                  儲存 Pixel
                </SubmitButton>
              </form>
            </SystemDetails>

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
                  <SubmitButton
                    className="rounded-full bg-[#5a2348] px-5 py-3 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-70"
                    pendingLabel="儲存設定…"
                  >
                    儲存法律設定
                  </SubmitButton>
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
                <AdvancedLink href="/system-audit" title="系統狀態" />
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
    <IntentPrefetchLink
      href={href}
      className="border-b border-[#f1e3dc] px-5 py-4 text-sm font-bold text-[#5a2348] transition hover:bg-[#fff9f3] sm:border-b-0 sm:border-r sm:last:border-r-0"
    >
      {title} →
    </IntentPrefetchLink>
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
