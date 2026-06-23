import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";
import { CopyButton } from "@/components/alyssa/CopyButton";
import { duplicateFormAction } from "@/app/forms/actions";
import { getFormOperations } from "@/lib/data/brandOperations";
import {
  getConfigurationData,
  type FormSetting,
} from "@/lib/data/configuration";

export const dynamic = "force-dynamic";

type FormsSearchParams = {
  brand?: string | string[];
  treatment?: string | string[];
  branch?: string | string[];
  status?: string | string[];
  q?: string | string[];
  form_status?: string | string[];
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

function formMatchesSearch(form: FormSetting, search: string) {
  if (!search) return true;
  const needle = search.toLowerCase();
  return (
    form.formName.toLowerCase().includes(needle) ||
    form.publicFormToken.toLowerCase().includes(needle) ||
    form.id.toLowerCase().includes(needle)
  );
}

export default async function FormsPage({
  searchParams,
}: {
  searchParams?: Promise<FormsSearchParams>;
}) {
  const config = await getConfigurationData();
  const query = await searchParams;
  const selectedBrand = firstParam(query?.brand);
  const selectedTreatment = firstParam(query?.treatment);
  const selectedBranch = firstParam(query?.branch);
  const selectedStatus = firstParam(query?.status);
  const search = firstParam(query?.q).trim();
  const message = firstParam(query?.form_status);
  const brand =
    config.brands.find((item) => item.slug === selectedBrand || item.id === selectedBrand) ??
    null;
  const filteredForms = config.forms.filter((form) => {
    const ops = getFormOperations(config, form);
    if (brand && form.brandId !== brand.id) return false;
    if (selectedTreatment && form.defaultTreatmentId !== selectedTreatment) {
      return false;
    }
    if (
      selectedBranch &&
      !ops.branches.some((branch) => branch.id === selectedBranch)
    ) {
      return false;
    }
    if (selectedStatus && form.status !== selectedStatus) return false;
    return formMatchesSearch(form, search);
  });

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <header className="rounded-[28px] border border-[#ead9cf] bg-white/86 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.1)]">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="alyssa-kicker">Forms</p>
              <h1 className="mt-2 text-3xl font-bold text-[#321428]">
                Wix 登記表格
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
                按品牌、療程、分店管理可嵌入 Wix 的登記表格，避免 Alyssa 同 Ineffable 設定混用。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/forms/new${brand ? `?brand=${brand.slug}` : ""}`}
                className="rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(228,111,100,0.22)]"
              >
                建立 Wix Form
              </Link>
              <Link
                href="/brands"
                className="rounded-full border border-[#ead9cf] bg-white px-5 py-3 text-sm font-bold text-[#5a2348]"
              >
                Brand Workspace
              </Link>
            </div>
          </div>
        </header>

        {message && (
          <div className="mt-5 rounded-2xl border border-[#d9b66f] bg-[#fff6f0] px-4 py-3 text-sm font-bold text-[#5a2348]">
            {message}
          </div>
        )}

        <section className="mt-6 rounded-[28px] border border-[#ead9cf] bg-white/86 p-5">
          <form className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_1fr_1.2fr_auto]" method="get">
            <FilterSelect
              label="Brand"
              name="brand"
              value={brand?.slug || ""}
              options={config.brands.map((item) => ({
                value: item.slug,
                label: item.name,
              }))}
            />
            <FilterSelect
              label="Treatment"
              name="treatment"
              value={selectedTreatment}
              options={config.treatments
                .filter((item) => !brand || item.brandId === brand.id)
                .map((item) => ({ value: item.id, label: item.name }))}
            />
            <FilterSelect
              label="Branch"
              name="branch"
              value={selectedBranch}
              options={config.branches
                .filter((item) => !brand || item.brandId === brand.id)
                .map((item) => ({ value: item.id, label: item.name }))}
            />
            <FilterSelect
              label="Status"
              name="status"
              value={selectedStatus}
              options={Array.from(new Set(config.forms.map((form) => form.status))).map(
                (status) => ({ value: status, label: status || "可使用" })
              )}
            />
            <label className="block min-w-0">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
                Search
              </span>
              <input
                name="q"
                defaultValue={search}
                placeholder="Form name / token / ID"
                className="mt-2 w-full rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-4 py-3 text-sm font-semibold text-[#5a2348] outline-none focus:border-[#e46f64] focus:bg-white"
              />
            </label>
            <button className="self-end rounded-full bg-[#5a2348] px-5 py-3 text-sm font-bold text-white">
              Filter
            </button>
          </form>
        </section>

        <section className="mt-6 overflow-hidden rounded-[28px] border border-[#ead9cf] bg-white/90 shadow-[0_24px_70px_rgba(90,35,72,0.08)]">
          <div className="max-w-full overflow-x-auto">
            <table className="min-w-[1180px] text-left text-sm">
              <thead className="bg-[#fff6f0] text-xs font-bold uppercase tracking-[0.12em] text-[#9a5d76]">
                <tr>
                  {[
                    "Form name",
                    "Brand",
                    "Treatment / package",
                    "Branch",
                    "Form token",
                    "Status",
                    "Updated",
                    "Actions",
                  ].map((heading) => (
                    <th key={heading} className="px-4 py-3">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredForms.map((form) => {
                  const ops = getFormOperations(config, form);
                  return (
                    <tr
                      key={form.id}
                      className="align-top transition hover:bg-[#fff9f3]"
                    >
                      <td className="border-t border-[#f1e3dc] px-4 py-4">
                        <Link
                          href={`/forms/${form.id}`}
                          className="font-bold text-[#321428] underline-offset-4 hover:underline"
                        >
                          {form.formName}
                        </Link>
                        <p className="mt-1 text-xs font-semibold text-[#7b5a6a]">
                          This form belongs to {ops.brand?.name || "未設定品牌"}
                        </p>
                      </td>
                      <td className="border-t border-[#f1e3dc] px-4 py-4 font-semibold text-[#5a2348]">
                        {ops.brand?.name || "未設定"}
                      </td>
                      <td className="border-t border-[#f1e3dc] px-4 py-4">
                        <p className="font-semibold text-[#5a2348]">
                          {ops.treatment?.name || "未設定療程"}
                        </p>
                        <p className="mt-1 text-xs font-bold text-[#321428]">
                          {ops.packageLabel}
                        </p>
                      </td>
                      <td className="border-t border-[#f1e3dc] px-4 py-4 font-semibold text-[#5a2348]">
                        {ops.branchLabel}
                      </td>
                      <td className="border-t border-[#f1e3dc] px-4 py-4">
                        <p className="max-w-[250px] break-all font-mono text-xs font-bold text-[#5a2348]">
                          {form.publicFormToken}
                        </p>
                      </td>
                      <td className="border-t border-[#f1e3dc] px-4 py-4">
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                          可使用
                        </span>
                      </td>
                      <td className="border-t border-[#f1e3dc] px-4 py-4 text-xs font-semibold text-[#7b5a6a]">
                        {form.updatedAt || form.createdAt || "-"}
                      </td>
                      <td className="border-t border-[#f1e3dc] px-4 py-4">
                        <div className="flex min-w-[280px] flex-wrap gap-2">
                          <CopyButton value={ops.embedCode} label="Copy Wix Embed" />
                          <Link
                            href={`/embed/${form.publicFormToken}`}
                            className="rounded-full border border-[#d9b66f] bg-white px-3 py-1.5 text-xs font-bold text-[#5a2348]"
                          >
                            Open Test Form
                          </Link>
                          <Link
                            href={`/forms/${form.id}`}
                            className="rounded-full bg-[#5a2348] px-3 py-1.5 text-xs font-bold text-white"
                          >
                            Edit
                          </Link>
                          <Link
                            href={`/leads?form=${form.publicFormToken}`}
                            className="rounded-full border border-[#ead9cf] bg-white px-3 py-1.5 text-xs font-bold text-[#5a2348]"
                          >
                            View Leads
                          </Link>
                          <form action={duplicateFormAction}>
                            <input type="hidden" name="formId" value={form.id} />
                            <button
                              type="submit"
                              className="rounded-full border border-[#ead9cf] bg-white px-3 py-1.5 text-xs font-bold text-[#5a2348]"
                            >
                              Duplicate
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredForms.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm font-semibold text-[#7b5a6a]">
                      找不到符合條件的表格。請切換品牌或建立新的 Wix Form。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
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
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
