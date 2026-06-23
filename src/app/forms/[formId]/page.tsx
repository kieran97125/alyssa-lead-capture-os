import Link from "next/link";
import { notFound } from "next/navigation";
import { AppNav } from "@/components/alyssa/AppNav";
import { CopyButton } from "@/components/alyssa/CopyButton";
import { EmbedCodeCard } from "@/components/alyssa/EmbedCodeCard";
import { duplicateFormAction, updateFormAction } from "@/app/forms/actions";
import {
  META_URL_PARAMETER_GUIDE,
  getFormOperations,
} from "@/lib/data/brandOperations";
import {
  getTreatment,
  packagePriceLabel,
} from "@/lib/data/configuration";
import { getFormByIdOrSlug } from "@/lib/data/formManagement";

export const dynamic = "force-dynamic";

function formatDate(value: string | null | undefined) {
  if (!value) return "未有紀錄";

  return new Intl.DateTimeFormat("zh-HK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Hong_Kong",
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

  const ops = getFormOperations(config, form);
  const linkedLandingPages = config.landingPages.filter(
    (page) => page.formId === form.id || page.formToken === form.publicFormToken
  );
  const brandTreatments = config.treatments.filter(
    (item) => item.brandId === form.brandId
  );
  const brandBranches = config.branches.filter((item) => item.brandId === form.brandId);
  const brandTreatmentIds = new Set(brandTreatments.map((item) => item.id));
  const brandPackages = config.packages.filter((item) =>
    brandTreatmentIds.has(item.treatmentId)
  );

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <header className="rounded-[28px] border border-[#ead9cf] bg-white/86 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.1)]">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="alyssa-kicker">Form Settings</p>
              <h1 className="mt-2 text-3xl font-bold text-[#321428]">
                {form.formName}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
                This form belongs to {ops.brand?.name || "未設定品牌"}。請勿將此品牌的 form token 或 Pixel 用到其他品牌 Wix 頁面。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/brands?brand=${ops.brand?.slug || ""}`}
                className="rounded-full border border-[#ead9cf] bg-white px-5 py-3 text-sm font-bold text-[#5a2348]"
              >
                Brand Workspace
              </Link>
              <Link
                href={`/embed/${form.publicFormToken}`}
                className="rounded-full bg-[#5a2348] px-5 py-3 text-sm font-bold text-white"
              >
                Open Test Form
              </Link>
            </div>
          </div>
        </header>

        {message && (
          <div className="mt-5 rounded-2xl border border-[#d9b66f] bg-[#fff6f0] px-4 py-3 text-sm font-bold text-[#5a2348]">
            {message}
          </div>
        )}

        <section className="mt-6 grid gap-5 lg:grid-cols-4">
          <StatusCard label="Brand" value={ops.brand?.name || "未設定"} />
          <StatusCard label="Treatment" value={ops.treatment?.name || "未設定"} />
          <StatusCard label="Package" value={ops.packageLabel} />
          <StatusCard
            label="Pixel"
            value={ops.pixelConfigured ? ops.pixelId : "Missing"}
            warning={!ops.pixelConfigured}
          />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.82fr]">
          <form action={updateFormAction} className="alyssa-premium-card grid min-w-0 gap-5 p-5">
            <input type="hidden" name="formId" value={form.id} />

            <div>
              <p className="alyssa-kicker">Brand-safe settings</p>
              <h2 className="mt-2 text-xl font-bold text-[#321428]">
                表格設定
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="Form name" name="formName" value={form.formName} />
              <SelectField
                label="Brand"
                name="brandId"
                value={form.brandId}
                options={config.brands.map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
              />
              <SelectField
                label="Treatment"
                name="defaultTreatmentId"
                value={form.defaultTreatmentId ?? ""}
                options={brandTreatments.map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
              />
              <SelectField
                label="Package / price"
                name="defaultPackageId"
                value={form.defaultPackageId ?? ""}
                options={brandPackages.map((item) => ({
                  value: item.id,
                  label: `${packagePriceLabel(item)} (${getTreatment(config, item.treatmentId)?.name ?? "療程"})`,
                }))}
              />
              <SelectField
                label="Branch"
                name="defaultBranchId"
                value={form.defaultBranchId ?? ""}
                options={brandBranches.map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
              />
            </div>

            <label className="block min-w-0">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
                Allowed domains
              </span>
              <textarea
                name="allowedDomains"
                rows={4}
                defaultValue={form.allowedDomains.join("\n")}
                className="mt-2 w-full rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-4 py-3 text-sm font-semibold leading-6 text-[#5a2348] outline-none transition focus:border-[#e46f64] focus:bg-white"
              />
              <span className="mt-2 block text-xs font-semibold leading-5 text-[#7b5a6a]">
                建議：{ops.suggestedDomains.join(", ")}
              </span>
            </label>

            <div className="rounded-2xl bg-[#fff6f0] p-4">
              <dl className="grid gap-3 sm:grid-cols-2">
                <InfoCell label="Form token" value={form.publicFormToken} mono />
                <InfoCell label="Status" value="可使用" />
                <InfoCell label="Updated" value={formatDate(form.updatedAt)} />
                <InfoCell label="Branch" value={ops.branch?.name || "未設定"} />
                <InfoCell label="Preview URL" value={ops.previewUrl} mono />
                <InfoCell
                  label="Landing Pages"
                  value={
                    linkedLandingPages.length > 0
                      ? linkedLandingPages.map((page) => page.title).join(", ")
                      : "未連接"
                  }
                />
              </dl>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(228,111,100,0.22)] transition hover:-translate-y-1 hover:bg-[#d95f55]"
              >
                Save Form
              </button>
              <CopyButton value={ops.embedCode} label="Copy Wix Embed" />
              <CopyButton value={form.publicFormToken} label="Copy Token" />
              <CopyButton value={ops.previewUrl} label="Copy Test URL" />
            </div>
          </form>

          <aside className="grid h-fit min-w-0 gap-5">
            <EmbedCodeCard
              code={ops.embedCode}
              title="Ready-to-paste Wix embed"
              description={
                ops.pixelConfigured
                  ? "此 snippet 已包含此品牌的 data-pixel-id，成功儲存 lead 後會發送 CompleteRegistration beacon。"
                  : "此品牌未設定 Pixel，snippet 會省略 data-pixel-id。"
              }
            />

            <section className="alyssa-premium-card min-w-0 p-5">
              <p className="alyssa-kicker">Meta URL Parameters</p>
              <h2 className="mt-2 text-xl font-bold text-[#321428]">
                廣告 URL 參數
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">
                貼到 Meta Ads。正式廣告不要加入 pixel_debug=1 或 attribution_debug=1。
              </p>
              <div className="mt-4">
                <CopyButton value={META_URL_PARAMETER_GUIDE} label="Copy URL Parameters" />
              </div>
              <pre className="mt-4 max-h-44 overflow-auto rounded-2xl bg-[#321428] p-4 text-xs leading-6 text-[#fff9f3]">
                {META_URL_PARAMETER_GUIDE}
              </pre>
            </section>

            <section className="alyssa-premium-card min-w-0 p-5">
              <p className="alyssa-kicker">Brand safety</p>
              <h2 className="mt-2 text-xl font-bold text-[#321428]">
                上線前提醒
              </h2>
              <ul className="mt-3 grid gap-2 text-sm font-semibold leading-6 text-[#6d4a5c]">
                <li>This form belongs to {ops.brand?.name || "此品牌"}。</li>
                <li>Do not use Alyssa Pixel on Ineffable pages.</li>
                <li>Do not use Ineffable form token on Alyssa Wix page.</li>
                <li>Website URL 應為乾淨 Wix URL，不要帶 debug params。</li>
              </ul>
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
                  Duplicate
                </button>
              </form>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}

function StatusCard({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <section className="alyssa-premium-card p-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {label}
      </p>
      <p
        className={`mt-3 break-words text-lg font-bold ${
          warning ? "text-amber-700" : "text-[#321428]"
        }`}
      >
        {value}
      </p>
    </section>
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
