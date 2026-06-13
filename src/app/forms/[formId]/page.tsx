import Link from "next/link";
import { notFound } from "next/navigation";
import { AppNav } from "@/components/alyssa/AppNav";
import { EmbedCodeCard } from "@/components/alyssa/EmbedCodeCard";
import { alyssaDefaultForm } from "@/lib/data/alyssaConfig";
import { getDefaultEmbedCode, getEmbedScriptUrl } from "@/lib/data/appUrl";
import {
  getBranch,
  getBrand,
  getConfigurationData,
  getPackage,
  getTreatment,
  packagePriceLabel,
} from "@/lib/data/configuration";

export const dynamic = "force-dynamic";

export default async function FormConfigPage({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const { formId } = await params;
  const config = await getConfigurationData();
  const form =
    config.forms.find((item) => item.id === formId) ??
    (formId === alyssaDefaultForm.id
      ? config.forms.find(
          (item) => item.publicFormToken === alyssaDefaultForm.publicFormToken
        )
      : null);

  if (!form) notFound();

  const brand = getBrand(config, form.brandId);
  const treatment = getTreatment(config, form.defaultTreatmentId);
  const selectedPackage = getPackage(config, form.defaultPackageId);
  const branch = getBranch(config, form.defaultBranchId);
  const linkedLandingPages = config.landingPages.filter(
    (page) => page.formId === form.id || page.formToken === form.publicFormToken
  );
  const embedCode = getDefaultEmbedCode(form.publicFormToken, form.id);
  const scriptUrl = getEmbedScriptUrl();

  return (
    <main className="alyssa-shell">
      <AppNav showInternalWarning />
      <div className="mx-auto max-w-6xl px-5 py-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
              表格設定
            </p>
            <h1 className="mt-2 text-3xl font-bold text-[#321428]">
              {form.formName}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
              呢張表格由 configuration layer 選定品牌、療程、套餐同分店。
              同一份設定可輸出 Wix form-only embed，亦可被 landing page mode 使用。
            </p>
          </div>
          <Link
            href="/settings"
            className="rounded-full border border-[#d9b66f] bg-white px-5 py-3 text-sm font-bold text-[#5a2348]"
          >
            查看設定層
          </Link>
        </div>

        <section className="mt-6 rounded-[24px] border border-[#ead9cf] bg-[#fff6f0] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
            設定狀態
          </p>
          <p className="mt-2 text-sm leading-6 text-[#5a2348]">
            目前係設定檢視 / 編輯功能預留。表格提交、來源擷取、套餐驗證同 lead
            寫入流程保持不變。
          </p>
        </section>

        <div className="mt-6 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-[24px] border border-[#ead9cf] bg-white/86 p-5 shadow-sm">
            <h2 className="text-xl font-bold text-[#321428]">營運設定</h2>
            <dl className="mt-5 grid gap-3">
              <InfoCell label="表格狀態" value={form.status} />
              <InfoCell label="品牌" value={brand?.name ?? "未設定"} />
              <InfoCell label="療程" value={treatment?.name ?? "未設定"} />
              <InfoCell label="套餐 / 價錢" value={packagePriceLabel(selectedPackage)} />
              <InfoCell label="分店" value={branch?.name ?? "未設定"} />
              <InfoCell label="表格 Token" value={form.publicFormToken} mono />
              <InfoCell
                label="允許嵌入網域"
                value={form.allowedDomains.length > 0 ? form.allowedDomains.join(", ") : "未設定"}
              />
              <InfoCell
                label="Linked landing page mode"
                value={
                  linkedLandingPages.length > 0
                    ? linkedLandingPages.map((page) => page.title).join(", ")
                    : "未有關聯 landing page"
                }
              />
            </dl>
          </section>

          <div className="space-y-5">
            <EmbedCodeCard
              code={embedCode}
              title="Wix 嵌入碼"
              description="將呢段 code 放入 Wix 頁面需要顯示登記表格的位置。"
            />
            <section className="rounded-[24px] border border-[#ead9cf] bg-white/86 p-5 shadow-sm">
              <h2 className="text-xl font-bold text-[#321428]">Script endpoint</h2>
              <div className="mt-4 rounded-2xl bg-[#fff6f0] p-4">
                <p className="break-all text-sm font-semibold text-[#5a2348]">
                  {scriptUrl}
                </p>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/embed-preview"
                  className="rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white"
                >
                  測試 Parent Embed
                </Link>
                <Link
                  href={`/embed/${form.publicFormToken}`}
                  className="rounded-full border border-[#d9b66f] bg-white px-5 py-3 text-sm font-bold text-[#5a2348]"
                >
                  直接打開 iframe
                </Link>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
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
    <div className="rounded-2xl bg-[#fff6f0] p-4">
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
