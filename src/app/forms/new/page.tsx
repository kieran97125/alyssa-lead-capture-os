import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";
import { CopyButton } from "@/components/alyssa/CopyButton";
import { FormPackageSelection } from "@/components/alyssa/FormPackageSelection";
import { SubmitButton } from "@/components/alyssa/SubmitButton";
import { createFormAction } from "@/app/forms/actions";
import {
  META_URL_PARAMETER_GUIDE,
  getBrandPixelId,
  getBrandSuggestedDomains,
} from "@/lib/data/brandOperations";
import { getBrandDisplayDefaults } from "@/lib/data/brandDefaults";
import { getConfigurationData } from "@/lib/data/configuration";

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
    (item) =>
      item.treatmentId === selectedTreatment?.id && item.status === "active"
  ) ?? brandPackages.find((item) => item.status === "active");
  const treatmentNames = Object.fromEntries(
    brandTreatments.map((item) => [item.id, item.name])
  );
  const brandBranches = config.branches.filter(
    (item) => item.brandId === selectedBrand?.id
  );
  const firstBranch = brandBranches[0];
  const pixelId = getBrandPixelId(
    selectedBrand?.slug,
    selectedBrand?.metaPixelId
  );
  const suggestedDomains = getBrandSuggestedDomains(selectedBrand?.slug);
  const brandDefaults = getBrandDisplayDefaults(selectedBrand);

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-6xl px-5 py-8">
        <header className="rounded-[28px] border border-[#ead9cf] bg-white/86 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.1)]">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="alyssa-kicker">建立 Wix 表格</p>
              <h1 className="mt-2 text-3xl font-bold text-[#321428]">
                建立品牌登記表格
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
                先選品牌，再選療程、優惠同分店。表格建立後會生成可直接貼入 Wix 嘅嵌入碼。
              </p>
            </div>
            <Link
              href="/forms"
              className="w-fit rounded-full border border-[#d9b66f] bg-white px-5 py-3 text-sm font-bold text-[#5a2348]"
            >
              返回表格管理
            </Link>
          </div>
        </header>

        {message && (
          <div className="mt-5 rounded-2xl border border-[#d9b66f] bg-[#fff6f0] px-4 py-3 text-sm font-bold text-[#5a2348]">
            {message}
          </div>
        )}

        <section className="mt-6 rounded-[28px] border border-[#ead9cf] bg-white/86 p-5">
          <p className="alyssa-kicker">步驟 1</p>
          <h2 className="mt-2 text-xl font-bold text-[#321428]">選擇品牌</h2>
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
              <p className="alyssa-kicker">步驟 2</p>
              <h2 className="mt-2 text-xl font-bold text-[#321428]">
                療程／優惠
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">
                只顯示 {selectedBrand?.name || "此品牌"} 的療程及套餐，避免跨品牌混用。
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                label="表格名稱"
                name="formName"
                defaultValue={suggestedFormName(
                  selectedBrand?.name || "Brand",
                  selectedTreatment?.name
                )}
              />
              <SelectField
                label="療程"
                name="defaultTreatmentId"
                defaultValue={selectedTreatment?.id}
                options={brandTreatments.map((treatment) => ({
                  value: treatment.id,
                  label: treatment.name,
                }))}
              />
              <FormPackageSelection
                packages={brandPackages}
                defaultPackageId={firstPackage?.id}
                selectedPackageIds={firstPackage ? [firstPackage.id] : []}
                treatmentNames={treatmentNames}
              />
              <ReadonlyInfo label="付款方式" value="只需預約" />
            </div>
          </section>

          <section className="alyssa-premium-card grid gap-5 p-5">
            <div>
              <p className="alyssa-kicker">步驟 3</p>
              <h2 className="mt-2 text-xl font-bold text-[#321428]">
                分店選擇
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
              <p className="alyssa-kicker">步驟 4</p>
              <h2 className="mt-2 text-xl font-bold text-[#321428]">
                表格設定
              </h2>
            </div>
            <label className="block min-w-0">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
                允許網域
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
              <ReadonlyInfo label="私隱同意" value="已啟用" />
              <ReadonlyInfo
                label="完成後安排"
                value={brandDefaults.thankYouUrl || "使用品牌預設流程"}
              />
              <ReadonlyInfo label="Status" value="可使用" />
            </div>
          </section>

          <section className="alyssa-premium-card grid gap-5 p-5">
            <div>
              <p className="alyssa-kicker">步驟 5</p>
              <h2 className="mt-2 text-xl font-bold text-[#321428]">
                追蹤設定
              </h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <ReadonlyInfo
                label="品牌 Pixel"
                value={
                  brandDefaults.conversionMode === "thank_you_redirect"
                    ? `${brandDefaults.pixelIdReference || pixelId || "未設定"} · 由 Wix 成功頁處理`
                    : pixelId
                      ? `已設定：${pixelId}`
                      : "未設定；仍可建立表格"
                }
                warning={!pixelId && !brandDefaults.pixelIdReference}
              />
              <ReadonlyInfo
                label="Wix 嵌入設定"
                value={
                  brandDefaults.conversionMode === "thank_you_redirect"
                    ? "提交後轉到品牌成功頁，由成功頁處理轉化"
                    : pixelId
                      ? "嵌入碼會加入品牌 Pixel"
                      : "嵌入碼不會加入 Pixel"
                }
              />
            </div>
            <div>
              <CopyButton value={META_URL_PARAMETER_GUIDE} label="複製 Meta URL 參數" />
              <p className="mt-2 text-xs font-semibold leading-5 text-[#7b5a6a]">
                正式廣告請使用不含測試參數嘅連結。
              </p>
            </div>
          </section>

          <section className="alyssa-premium-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="alyssa-kicker">步驟 6</p>
              <h2 className="mt-2 text-xl font-bold text-[#321428]">
                建立及嵌入
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">
                建立後會前往表格詳情，直接複製 Wix 嵌入碼、預覽網址同 Meta URL 參數。
              </p>
            </div>
            <SubmitButton
              className="rounded-full bg-[#e46f64] px-6 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(228,111,100,0.22)] transition hover:-translate-y-1 hover:bg-[#d95f55]"
              pendingLabel="建立中…"
            >
              建立表格
            </SubmitButton>
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
                <span>預設選擇此分店</span>
              </label>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs font-semibold leading-5 text-[#7b5a6a]">
        客人提交前需要選擇其中一間已啟用分店。
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
