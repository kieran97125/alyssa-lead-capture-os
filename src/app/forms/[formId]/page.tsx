import Link from "next/link";
import { notFound } from "next/navigation";
import { AppNav } from "@/components/alyssa/AppNav";
import { CopyButton } from "@/components/alyssa/CopyButton";
import { EmbedCodeCard } from "@/components/alyssa/EmbedCodeCard";
import { FormPackageSelection } from "@/components/alyssa/FormPackageSelection";
import { SubmitButton } from "@/components/alyssa/SubmitButton";
import { duplicateFormAction, updateFormAction } from "@/app/forms/actions";
import {
  META_URL_PARAMETER_GUIDE,
  getFormOperations,
} from "@/lib/data/brandOperations";
import {
  getFormPackageSettings,
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
  const selectedBranchIds =
    ops.branches.length > 0
      ? ops.branches.map((branch) => branch.id)
      : form.defaultBranchId
        ? [form.defaultBranchId]
        : [];
  const brandTreatmentIds = new Set(brandTreatments.map((item) => item.id));
  const brandPackages = config.packages.filter((item) =>
    brandTreatmentIds.has(item.treatmentId)
  );
  const treatmentNames = Object.fromEntries(
    brandTreatments.map((item) => [item.id, item.name])
  );
  const selectedPackageIds = getFormPackageSettings(config, form).map(
    (item) => item.packageId
  );

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <header className="rounded-[28px] border border-[#ead9cf] bg-white/86 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.1)]">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="alyssa-kicker">表格設定</p>
              <h1 className="mt-2 text-3xl font-bold text-[#321428]">
                {form.formName}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
                此表格屬於 {ops.brand?.name || "未設定品牌"}。請勿將表格識別碼或 Pixel 用到其他品牌 Wix 頁面。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/brands?brand=${ops.brand?.slug || ""}`}
                className="rounded-full border border-[#ead9cf] bg-white px-5 py-3 text-sm font-bold text-[#5a2348]"
              >
                品牌工作區
              </Link>
              <Link
                href={`/embed/${form.publicFormToken}`}
                className="rounded-full bg-[#5a2348] px-5 py-3 text-sm font-bold text-white"
              >
                預覽表格
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
          <StatusCard label="品牌" value={ops.brand?.name || "未設定"} />
          <StatusCard label="療程" value={ops.treatment?.name || "未設定"} />
          <StatusCard label="Package" value={ops.packageLabel} />
          <StatusCard
            label="Pixel"
            value={ops.pixelConfigured ? ops.pixelId : "Missing"}
            warning={!ops.pixelConfigured}
          />
        </section>

        <section className="mt-6 grid items-start gap-6 xl:grid-cols-[1fr_0.82fr]">
          <form
            action={updateFormAction}
            className="alyssa-premium-card grid min-w-0 self-start gap-5 p-5"
            data-testid="form-settings-card"
          >
            <input type="hidden" name="formId" value={form.id} />

            <div>
              <p className="alyssa-kicker">Brand-safe settings</p>
              <h2 className="mt-2 text-xl font-bold text-[#321428]">
                表格設定
              </h2>
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
                options={brandTreatments.map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
              />
              <FormPackageSelection
                packages={brandPackages}
                defaultPackageId={form.defaultPackageId}
                selectedPackageIds={selectedPackageIds}
                selectionMode={form.packageSelectionMode}
                treatmentNames={treatmentNames}
              />
              <BranchSelection
                branches={brandBranches}
                selectedBranchIds={selectedBranchIds}
                defaultBranchId={ops.branch?.id || form.defaultBranchId || ""}
              />
            </div>

            <label className="block min-w-0">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
                允許網域
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
                <InfoCell label="表格識別" value={form.publicFormToken} mono />
                <InfoCell label="狀態" value="可使用" />
                <InfoCell label="更新時間" value={formatDate(form.updatedAt)} />
                <InfoCell label="分店" value={ops.branchLabel} />
                <InfoCell label="預覽網址" value={ops.previewUrl} mono />
                <InfoCell label="轉化方式" value={ops.conversionMode} />
                <InfoCell
                  label="成功後轉址"
                  value={ops.successRedirectUrl || "未設定"}
                  mono
                />
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

            <div
              className="flex flex-wrap items-center gap-3"
              data-testid="form-settings-actions"
            >
              <SubmitButton
                className="rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(228,111,100,0.22)] transition hover:-translate-y-1 hover:bg-[#d95f55]"
                pendingLabel="儲存中…"
              >
                儲存表格
              </SubmitButton>
              <CopyButton value={ops.embedCode} label="複製 Wix 嵌入碼" />
              <CopyButton value={form.publicFormToken} label="複製表格識別碼" />
              <CopyButton value={ops.previewUrl} label="複製預覽網址" />
            </div>
          </form>

          <aside className="grid h-fit min-w-0 gap-5">
            <EmbedCodeCard
              code={ops.embedCode}
              title="Wix 嵌入碼"
              description={
                ops.conversionMode === "thank_you_redirect"
                  ? "客人成功提交後會前往已設定嘅 Wix 成功頁，由成功頁記錄轉化。"
                  : ops.pixelConfigured
                  ? "嵌入碼已包含此品牌嘅 Pixel，客人成功提交後會記錄完成登記。"
                  : "此品牌未設定 Pixel，嵌入碼不會加入 Pixel。"
              }
            />

            <EmbedCodeCard
              code={ops.wixAttributionBridgeCode}
              title="Wix UTM Bridge（每個表格頁面設定一次）"
              description="貼到 Wix Page Code，並將 #html1 改成該頁 HTML Embed 元件 ID。呢段 bridge 會將 Wix 頁面 UTM 安全傳入 Growth OS 表格。"
            />

            <section className="alyssa-premium-card min-w-0 p-5">
              <p className="alyssa-kicker">Meta URL Parameters</p>
              <h2 className="mt-2 text-xl font-bold text-[#321428]">
                廣告 URL 參數
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">
                貼到 Meta Ads；正式廣告請使用不含測試參數嘅連結。
              </p>
              <div className="mt-4">
                <CopyButton value={META_URL_PARAMETER_GUIDE} label="複製 URL 參數" />
              </div>
              <pre className="mt-4 max-h-44 overflow-auto rounded-2xl bg-[#321428] p-4 text-xs leading-6 text-[#fff9f3]">
                {META_URL_PARAMETER_GUIDE}
              </pre>
            </section>

            <section className="alyssa-premium-card min-w-0 p-5">
              <p className="alyssa-kicker">品牌安全</p>
              <h2 className="mt-2 text-xl font-bold text-[#321428]">
                上線前提醒
              </h2>
              <ul className="mt-3 grid gap-2 text-sm font-semibold leading-6 text-[#6d4a5c]">
                <li>此表格屬於 {ops.brand?.name || "此品牌"}。</li>
                <li>只可使用該品牌嘅 Pixel 設定。</li>
                <li>表格識別碼只可用喺所屬品牌 Wix 頁面。</li>
                <li>正式廣告請使用不含測試參數嘅 Wix 網址。</li>
              </ul>
            </section>

            <section className="alyssa-premium-card min-w-0 p-5">
              <p className="alyssa-kicker">複製表格</p>
              <h2 className="mt-2 text-xl font-bold text-[#321428]">
                複製成新表格
              </h2>
              <form action={duplicateFormAction} className="mt-4">
                <input type="hidden" name="formId" value={form.id} />
                <SubmitButton
                  className="w-full rounded-full border border-[#d9b66f] bg-white px-5 py-3 text-sm font-bold text-[#5a2348]"
                  pendingLabel="複製中…"
                >
                  複製表格
                </SubmitButton>
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
