import Link from "next/link";
import { notFound } from "next/navigation";
import { AppNav } from "@/components/alyssa/AppNav";
import { CopyButton } from "@/components/alyssa/CopyButton";
import { EmbedCodeCard } from "@/components/alyssa/EmbedCodeCard";
import { duplicateFormAction, updateFormAction } from "@/app/forms/actions";
import { getDefaultEmbedCode, getPublicEmbedPreviewUrl } from "@/lib/data/appUrl";
import {
  getBrand,
  getPackage,
  getTreatment,
  packagePriceLabel,
} from "@/lib/data/configuration";
import { getFormByIdOrSlug } from "@/lib/data/formManagement";

export const dynamic = "force-dynamic";

function formatDate(value: string | null | undefined) {
  if (!value) return "未設定";

  return new Intl.DateTimeFormat("zh-HK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function FormConfigPage({
  params,
  searchParams,
}: {
  params: Promise<{ formId: string }>;
  searchParams?: Promise<{ form_status?: string | string[] }>;
}) {
  const { formId } = await params;
  const query = await searchParams;
  const message =
    typeof query?.form_status === "string" ? query.form_status : null;
  const { form, config } = await getFormByIdOrSlug(formId);

  if (!form) notFound();

  const brand = getBrand(config, form.brandId);
  const selectedPackage = getPackage(config, form.defaultPackageId);
  const previewUrl = getPublicEmbedPreviewUrl(form.publicFormToken);
  const embedCode = getDefaultEmbedCode(form.publicFormToken, form.id);
  const linkedLandingPages = config.landingPages.filter(
    (page) => page.formId === form.id || page.formToken === form.publicFormToken
  );

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="alyssa-kicker">Form settings</p>
            <h1 className="mt-2 text-3xl font-bold text-[#321428]">
              {form.formName}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
              管理這張 Wix 登記表格的品牌、療程、套餐、分店和可使用網址。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/forms"
              className="rounded-full border border-[#d9b66f] bg-white px-5 py-3 text-sm font-bold text-[#5a2348]"
            >
              返回表格
            </Link>
            <Link
              href={`/embed/${form.publicFormToken}`}
              className="rounded-full bg-[#5a2348] px-5 py-3 text-sm font-bold text-white"
            >
              開啟表格預覽
            </Link>
          </div>
        </header>

        {message && (
          <div className="mt-5 rounded-2xl border border-[#d9b66f] bg-[#fff6f0] px-4 py-3 text-sm font-bold text-[#5a2348]">
            {message}
          </div>
        )}

        <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.78fr]">
          <form action={updateFormAction} className="alyssa-premium-card grid min-w-0 gap-5 p-5">
            <input type="hidden" name="formId" value={form.id} />

            <div>
              <p className="alyssa-kicker">表格設定</p>
              <h2 className="mt-2 text-xl font-bold text-[#321428]">基本資料</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="表格名稱" name="formName" value={form.formName} />
              <SelectField
                label="品牌"
                name="brandId"
                value={form.brandId}
                options={config.brands.map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
              />
              <SelectField
                label="療程"
                name="defaultTreatmentId"
                value={form.defaultTreatmentId ?? ""}
                options={config.treatments.map((item) => ({
                  value: item.id,
                  label: `${item.name} (${getBrand(config, item.brandId)?.name ?? "品牌"})`,
                }))}
              />
              <SelectField
                label="套餐價錢"
                name="defaultPackageId"
                value={form.defaultPackageId ?? ""}
                options={config.packages.map((item) => ({
                  value: item.id,
                  label: `${packagePriceLabel(item)} (${getTreatment(config, item.treatmentId)?.name ?? "療程"})`,
                }))}
              />
              <SelectField
                label="分店"
                name="defaultBranchId"
                value={form.defaultBranchId ?? ""}
                options={config.branches.map((item) => ({
                  value: item.id,
                  label: `${item.name} (${getBrand(config, item.brandId)?.name ?? "品牌"})`,
                }))}
              />
            </div>

            <label className="block min-w-0">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
                可使用網址
              </span>
              <textarea
                name="allowedDomains"
                rows={4}
                defaultValue={form.allowedDomains.join("\n")}
                className="mt-2 w-full rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-4 py-3 text-sm font-semibold leading-6 text-[#5a2348] outline-none transition focus:border-[#e46f64] focus:bg-white"
              />
            </label>

            <div className="rounded-2xl bg-[#fff6f0] p-4">
              <dl className="grid gap-3 sm:grid-cols-2">
                <InfoCell label="表格代號" value={form.publicFormToken} mono />
                <InfoCell label="狀態" value="可使用" />
                <InfoCell label="最後更新" value={formatDate(form.updatedAt)} />
                <InfoCell label="品牌" value={brand?.name ?? "未設定"} />
                <InfoCell label="套餐" value={packagePriceLabel(selectedPackage)} />
              </dl>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(228,111,100,0.22)] transition hover:-translate-y-1 hover:bg-[#d95f55]"
              >
                儲存表格
              </button>
              <CopyButton value={embedCode} label="複製 Wix 嵌入碼" />
              <CopyButton value={form.publicFormToken} label="複製表格代號" />
              <CopyButton value={previewUrl} label="複製預覽網址" />
            </div>
          </form>

          <aside className="grid h-fit min-w-0 gap-5">
            <EmbedCodeCard
              code={embedCode}
              title="Wix 嵌入碼"
              description="複製這段代碼到 Wix 頁面，即可顯示這張登記表格。"
            />

            <section className="alyssa-premium-card min-w-0 p-5">
              <p className="alyssa-kicker">Preview</p>
              <h2 className="mt-2 text-xl font-bold text-[#321428]">
                表格預覽
              </h2>
              <dl className="mt-4 grid gap-3">
                <InfoCell label="表格預覽網址" value={previewUrl} mono />
                <InfoCell
                  label="連接 Landing Pages"
                  value={
                    linkedLandingPages.length > 0
                      ? linkedLandingPages.map((page) => page.title).join(", ")
                      : "未連接"
                  }
                />
              </dl>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href={`/embed/${form.publicFormToken}`}
                  className="rounded-full bg-[#5a2348] px-5 py-3 text-sm font-bold text-white"
                >
                  開啟表格預覽
                </Link>
              </div>
            </section>

            <section className="alyssa-premium-card min-w-0 p-5">
              <p className="alyssa-kicker">Duplicate</p>
              <h2 className="mt-2 text-xl font-bold text-[#321428]">
                複製成新表格
              </h2>
              <form action={duplicateFormAction} className="mt-4">
                <input type="hidden" name="formId" value={form.id} />
                <button
                  type="submit"
                  className="w-full rounded-full border border-[#d9b66f] bg-white px-5 py-3 text-sm font-bold text-[#5a2348]"
                >
                  複製
                </button>
              </form>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}

function TextField({
  label,
  name,
  value,
}: {
  label: string;
  name: string;
  value: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {label}
      </span>
      <input
        name={name}
        required
        defaultValue={value}
        className="mt-2 w-full rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-4 py-3 text-sm font-semibold text-[#5a2348] outline-none transition focus:border-[#e46f64] focus:bg-white"
      />
    </label>
  );
}

function SelectField({
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
        required
        defaultValue={value}
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

function InfoCell({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-2xl bg-white/78 p-4">
      <dt className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {label}
      </dt>
      <dd
        className={`mt-2 break-words text-sm font-semibold text-[#5a2348] ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
