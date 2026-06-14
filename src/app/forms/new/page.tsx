import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";
import { createFormAction } from "@/app/forms/actions";
import {
  getBrand,
  getConfigurationData,
  getTreatment,
  packagePriceLabel,
} from "@/lib/data/configuration";

export const dynamic = "force-dynamic";

export default async function NewFormPage({
  searchParams,
}: {
  searchParams?: Promise<{ form_status?: string | string[] }>;
}) {
  const config = await getConfigurationData();
  const query = await searchParams;
  const message =
    typeof query?.form_status === "string" ? query.form_status : null;
  const firstBrand = config.brands[0];
  const firstTreatment = config.treatments.find(
    (item) => item.brandId === firstBrand?.id
  );
  const firstPackage = config.packages.find(
    (item) => item.treatmentId === firstTreatment?.id
  );
  const firstBranch = config.branches.find((item) => item.brandId === firstBrand?.id);

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-5xl px-5 py-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="alyssa-kicker">New form</p>
            <h1 className="mt-2 text-3xl font-bold text-[#321428]">
              建立登記表格
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
              選好品牌、療程、套餐及分店後，系統會產生獨立表格代號及嵌入碼。
            </p>
          </div>
          <Link
            href="/forms"
            className="w-fit rounded-full border border-[#d9b66f] bg-white px-5 py-3 text-sm font-bold text-[#5a2348]"
          >
            返回表格
          </Link>
        </header>

        {message && (
          <div className="mt-5 rounded-2xl border border-[#d9b66f] bg-[#fff6f0] px-4 py-3 text-sm font-bold text-[#5a2348]">
            {message}
          </div>
        )}

        <form action={createFormAction} className="alyssa-premium-card mt-6 grid gap-5 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              label="表格名稱"
              name="formName"
              placeholder="例如：Alyssa HK$388 Trial Form"
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
                label: `${treatment.name} (${getBrand(config, treatment.brandId)?.name ?? "品牌"})`,
              }))}
            />
            <SelectField
              label="套餐 / 價錢"
              name="defaultPackageId"
              defaultValue={firstPackage?.id}
              options={config.packages.map((item) => ({
                value: item.id,
                label: `${packagePriceLabel(item)} (${getTreatment(config, item.treatmentId)?.name ?? "療程"})`,
              }))}
            />
            <SelectField
              label="分店"
              name="defaultBranchId"
              defaultValue={firstBranch?.id}
              options={config.branches.map((branch) => ({
                value: branch.id,
                label: `${branch.name} (${getBrand(config, branch.brandId)?.name ?? "品牌"})`,
              }))}
            />
          </div>

          <label className="block min-w-0">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
              可使用網域
            </span>
            <textarea
              name="allowedDomains"
              rows={4}
              placeholder="https://www.example.com&#10;https://campaign.example.com"
              className="mt-2 w-full rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-4 py-3 text-sm font-semibold leading-6 text-[#5a2348] outline-none transition focus:border-[#e46f64] focus:bg-white"
            />
            <span className="mt-2 block text-xs font-semibold leading-5 text-[#7b5a6a]">
              請填寫網站 origin，例如 https://example.com；一行一個。
            </span>
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              className="rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(228,111,100,0.22)] transition hover:-translate-y-1 hover:bg-[#d95f55]"
            >
              建立表格
            </button>
            <Link
              href="/forms"
              className="rounded-full border border-[#d9b66f] bg-white px-5 py-3 text-sm font-bold text-[#5a2348]"
            >
              取消
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}

function TextField({
  label,
  name,
  placeholder,
}: {
  label: string;
  name: string;
  placeholder?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {label}
      </span>
      <input
        name={name}
        required
        placeholder={placeholder}
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
