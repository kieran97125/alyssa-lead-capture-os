import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";
import { CopyButton } from "@/components/alyssa/CopyButton";
import { createFormAction } from "@/app/forms/actions";
import {
  META_URL_PARAMETER_GUIDE,
  getBrandPixelId,
  getBrandSuggestedDomains,
} from "@/lib/data/brandOperations";
import { getBrandDisplayDefaults } from "@/lib/data/brandDefaults";
import {
  getConfigurationData,
  packagePriceLabel,
} from "@/lib/data/configuration";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

function suggestedFormName(brandName: string, treatmentName?: string) {
  return [brandName, treatmentName, "Wix Form"].filter(Boolean).join(" ");
}

export default async function NewFormPage({
  searchParams,
}: {
  searchParams?: Promise<{ brand?: string | string[]; form_status?: string | string[] }>;
}) {
  const config = await getConfigurationData();
  const query = await searchParams;
  const selectedBrandParam = firstParam(query?.brand);
  const message = firstParam(query?.form_status);
  const selectedBrand =
    config.brands.find(
      (brand) => brand.slug === selectedBrandParam || brand.id === selectedBrandParam
    ) ?? config.brands[0];
  const brandTreatments = config.treatments.filter(
    (item) => item.brandId === selectedBrand?.id
  );
  const selectedTreatment = brandTreatments[0];
  const treatmentIds = new Set(brandTreatments.map((item) => item.id));
  const brandPackages = config.packages.filter((item) =>
    treatmentIds.has(item.treatmentId)
  );
  const firstPackage = brandPackages.find(
    (item) => item.treatmentId === selectedTreatment?.id
  ) ?? brandPackages[0];
  const brandBranches = config.branches.filter(
    (item) => item.brandId === selectedBrand?.id
  );
  const firstBranch = brandBranches[0];
  const pixelId = getBrandPixelId(selectedBrand?.slug);
  const suggestedDomains = getBrandSuggestedDomains(selectedBrand?.slug);
  const brandDefaults = getBrandDisplayDefaults(selectedBrand);

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-6xl px-5 py-8">
        <header className="rounded-[28px] border border-[#ead9cf] bg-white/86 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.1)]">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="alyssa-kicker">Create Wix Form</p>
              <h1 className="mt-2 text-3xl font-bold text-[#321428]">
                建立品牌登記表格
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
                先選品牌，再選療程、優惠同分店。表格建立後會生成可直接貼入 Wix 的 embed code。
              </p>
            </div>
            <Link
              href="/forms"
              className="w-fit rounded-full border border-[#d9b66f] bg-white px-5 py-3 text-sm font-bold text-[#5a2348]"
            >
              返回 Forms
            </Link>
          </div>
        </header>

        {message && (
          <div className="mt-5 rounded-2xl border border-[#d9b66f] bg-[#fff6f0] px-4 py-3 text-sm font-bold text-[#5a2348]">
            {message}
          </div>
        )}

        <section className="mt-6 rounded-[28px] border border-[#ead9cf] bg-white/86 p-5">
          <p className="alyssa-kicker">Step 1</p>
          <h2 className="mt-2 text-xl font-bold text-[#321428]">Choose brand</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {config.brands.map((brand) => (
              <Link
                key={brand.id}
                href={`/forms/new?brand=${brand.slug}`}
                className={`rounded-full border px-4 py-2 text-sm font-bold ${
                  brand.id === selectedBrand?.id
                    ? "border-[#e46f64] bg-[#e46f64] text-white"
                    : "border-[#ead9cf] bg-white text-[#5a2348]"
                }`}
              >
                {brand.name}
              </Link>
            ))}
          </div>
        </section>

        <form action={createFormAction} className="mt-6 grid gap-5">
          <input type="hidden" name="brandId" value={selectedBrand?.id || ""} />

          <section className="alyssa-premium-card grid gap-5 p-5">
            <div>
              <p className="alyssa-kicker">Step 2</p>
              <h2 className="mt-2 text-xl font-bold text-[#321428]">
                Treatment / offer
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">
                只顯示 {selectedBrand?.name || "此品牌"} 的療程及套餐，避免跨品牌混用。
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                label="Form name"
                name="formName"
                defaultValue={suggestedFormName(
                  selectedBrand?.name || "Brand",
                  selectedTreatment?.name
                )}
              />
              <SelectField
                label="Treatment"
                name="defaultTreatmentId"
                defaultValue={selectedTreatment?.id}
                options={brandTreatments.map((treatment) => ({
                  value: treatment.id,
                  label: treatment.name,
                }))}
              />
              <SelectField
                label="Campaign Offer / value"
                name="defaultPackageId"
                defaultValue={firstPackage?.id}
                options={brandPackages.map((item) => ({
                  value: item.id,
                  label: packagePriceLabel(item),
                }))}
              />
              <ReadonlyInfo label="Default payment option" value="booking_only" />
            </div>
          </section>

          <section className="alyssa-premium-card grid gap-5 p-5">
            <div>
              <p className="alyssa-kicker">Step 3</p>
              <h2 className="mt-2 text-xl font-bold text-[#321428]">
                Branch selection
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">
                目前每張表格連接一個主分店；如同一療程要多分店測試，可複製表格再改分店。
              </p>
            </div>
            <BranchSelection
              branches={brandBranches}
              selectedBranchIds={firstBranch ? [firstBranch.id] : []}
              defaultBranchId={firstBranch?.id || ""}
            />
          </section>

          <section className="alyssa-premium-card grid gap-5 p-5">
            <div>
              <p className="alyssa-kicker">Step 4</p>
              <h2 className="mt-2 text-xl font-bold text-[#321428]">
                Form settings
              </h2>
            </div>
            <label className="block min-w-0">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
                Allowed domains
              </span>
              <textarea
                name="allowedDomains"
                rows={4}
                defaultValue={suggestedDomains.join("\n")}
                className="mt-2 w-full rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-4 py-3 text-sm font-semibold leading-6 text-[#5a2348] outline-none transition focus:border-[#e46f64] focus:bg-white"
              />
              <span className="mt-2 block text-xs font-semibold leading-5 text-[#7b5a6a]">
                表格會用這些 origin 做上線檢查；如 Wix 有新 domain，先加入這裡。
              </span>
            </label>
            <div className="grid gap-3 md:grid-cols-3">
              <ReadonlyInfo label="Legal consent" value="Enabled" />
              <ReadonlyInfo
                label="Thank-you handling"
                value={`${brandDefaults.conversionMode} → ${brandDefaults.thankYouUrl || "Default brand flow"}`}
              />
              <ReadonlyInfo label="Status" value="可使用" />
            </div>
          </section>

          <section className="alyssa-premium-card grid gap-5 p-5">
            <div>
              <p className="alyssa-kicker">Step 5</p>
              <h2 className="mt-2 text-xl font-bold text-[#321428]">
                Tracking / Pixel
              </h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <ReadonlyInfo
                label="Brand Pixel reference"
                value={
                  brandDefaults.conversionMode === "thank_you_redirect"
                    ? `${brandDefaults.pixelIdReference || pixelId || "Not set"} - handled on Wix thank-you page`
                    : pixelId
                      ? `Configured: ${pixelId}`
                      : "Missing - form can still be created"
                }
                warning={!pixelId && !brandDefaults.pixelIdReference}
              />
              <ReadonlyInfo
                label="Wix embed"
                value={
                  brandDefaults.conversionMode === "thank_you_redirect"
                    ? "Embed redirects to brand thank-you page and omits data-pixel-id"
                    : pixelId
                      ? "Embed snippet will include data-pixel-id"
                      : "Embed snippet will omit data-pixel-id"
                }
              />
            </div>
            <div>
              <CopyButton value={META_URL_PARAMETER_GUIDE} label="Copy Meta URL Parameters" />
              <p className="mt-2 text-xs font-semibold leading-5 text-[#7b5a6a]">
                正式廣告不要使用 pixel_debug=1 或 attribution_debug=1。
              </p>
            </div>
          </section>

          <section className="alyssa-premium-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="alyssa-kicker">Step 6</p>
              <h2 className="mt-2 text-xl font-bold text-[#321428]">
                Publish / Embed
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">
                建立後會前往 form detail，直接複製 Wix embed code、test URL 同 Meta URL parameters。
              </p>
            </div>
            <button
              type="submit"
              className="rounded-full bg-[#e46f64] px-6 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(228,111,100,0.22)] transition hover:-translate-y-1 hover:bg-[#d95f55]"
            >
              建立表格
            </button>
          </section>
        </form>
      </div>
    </main>
  );
}

function TextField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {label}
      </span>
      <input
        name={name}
        required
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-4 py-3 text-sm font-semibold text-[#5a2348] outline-none transition focus:border-[#e46f64] focus:bg-white"
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

function BranchSelection({
  branches,
  selectedBranchIds,
  defaultBranchId,
}: {
  branches: Array<{ id: string; name: string }>;
  selectedBranchIds: string[];
  defaultBranchId: string;
}) {
  return (
    <div className="block min-w-0 md:col-span-2">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        Branches shown on this form
      </p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {branches.map((branch) => {
          const selected = selectedBranchIds.includes(branch.id);
          const isDefault = branch.id === defaultBranchId;

          return (
            <div
              key={branch.id}
              className="rounded-2xl border border-[#ead9cf] bg-[#fff6f0] p-4"
            >
              <label className="flex items-start gap-3 text-sm font-bold text-[#5a2348]">
                <input
                  type="checkbox"
                  name="branchIds"
                  value={branch.id}
                  defaultChecked={selected}
                  className="mt-1"
                />
                <span>{branch.name}</span>
              </label>
              <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#7b5a6a]">
                <input
                  type="radio"
                  name="defaultBranchId"
                  value={branch.id}
                  defaultChecked={isDefault}
                />
                <span>Default selected branch</span>
              </label>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs font-semibold leading-5 text-[#7b5a6a]">
        Customers will choose one of the selected branches before submitting.
      </p>
    </div>
  );
}

function ReadonlyInfo({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-[#fff6f0] p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {label}
      </p>
      <p
        className={`mt-2 text-sm font-bold ${
          warning ? "text-amber-700" : "text-[#5a2348]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
