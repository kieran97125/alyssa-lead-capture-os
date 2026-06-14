import Link from "next/link";
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
  type FormSetting,
} from "@/lib/data/configuration";

export const dynamic = "force-dynamic";

function getLinkedLandingPages(form: FormSetting, config: Awaited<ReturnType<typeof getConfigurationData>>) {
  return config.landingPages.filter(
    (page) => page.formId === form.id || page.formToken === form.publicFormToken
  );
}

export default async function FormsPage() {
  const config = await getConfigurationData();
  const primaryForm =
    config.forms.find((form) => form.publicFormToken === alyssaDefaultForm.publicFormToken) ??
    config.forms[0];
  const embedCode = primaryForm
    ? getDefaultEmbedCode(primaryForm.publicFormToken, primaryForm.id)
    : getDefaultEmbedCode(alyssaDefaultForm.publicFormToken, alyssaDefaultForm.id);
  const embedScriptUrl = getEmbedScriptUrl();

  return (
    <main className="alyssa-shell">
      <AppNav showInternalWarning />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
              表格管理
            </p>
            <h1 className="mt-2 text-3xl font-bold text-[#321428]">
              Form connection layer
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
              表格由品牌、療程、套餐價錢同分店設定組成。Form-only mode 產生 Wix
              embed script；Landing page mode 則用同一份表格連接產生 campaign page。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/settings"
              className="rounded-full border border-[#d9b66f] bg-white px-5 py-3 text-sm font-bold text-[#5a2348]"
            >
              查看設定層
            </Link>
            <Link
              href="/embed-preview"
              className="rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#d95f55]"
            >
              測試 Wix 預覽
            </Link>
          </div>
        </div>

        <section className="mt-6 grid gap-3 md:grid-cols-4">
          <StateCard label="設定來源" value={config.sourceLabel} />
          <StateCard label="輸出模式" value="Form-only / Landing page" />
          <StateCard label="Public script" value="可產生 Wix embed" />
          <StateCard label="編輯狀態" value="設定檢視 / 編輯功能預留" />
        </section>

        <section className="mt-7 grid gap-5 xl:grid-cols-[1fr_0.92fr]">
          <div className="grid gap-5">
            {config.forms.map((form) => {
              const brand = getBrand(config, form.brandId);
              const treatment = getTreatment(config, form.defaultTreatmentId);
              const selectedPackage = getPackage(config, form.defaultPackageId);
              const branch = getBranch(config, form.defaultBranchId);
              const linkedPages = getLinkedLandingPages(form, config);

              return (
                <article
                  key={form.id}
                  className="alyssa-premium-card p-5"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
                        {form.status}
                      </p>
                      <h2 className="mt-3 text-2xl font-bold text-[#321428]">
                        {form.formName}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">
                        這張表格連接指定品牌、療程、套餐同分店，可作 Wix form-only
                        embed，亦可連接 Landing Page mode。
                      </p>
                    </div>
                    <span className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
                      Form-only ready
                    </span>
                  </div>

                  <dl className="mt-5 grid gap-3 sm:grid-cols-2">
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
                      label="Linked landing pages"
                      value={linkedPages.length > 0 ? linkedPages.map((page) => page.title).join(", ") : "未有關聯"}
                    />
                    <InfoCell label="Public script" value={embedScriptUrl} mono />
                  </dl>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link
                      href={`/forms/${form.id}`}
                      className="rounded-full bg-[#5a2348] px-5 py-3 text-sm font-bold text-white"
                    >
                      開啟設定
                    </Link>
                    <Link
                      href={`/embed/${form.publicFormToken}`}
                      className="rounded-full border border-[#d9b66f] bg-white px-5 py-3 text-sm font-bold text-[#5a2348]"
                    >
                      直接打開 iframe
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>

          <EmbedCodeCard
            code={embedCode}
            title="Wix 嵌入碼"
            description="將呢段 script 放入 Wix parent page，表格會沿用所選品牌、療程、套餐同分店設定。"
          />
        </section>
      </div>
    </main>
  );
}

function StateCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#ead9cf] bg-white/86 p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {label}
      </p>
      <p className="mt-2 text-sm font-bold text-[#5a2348]">{value}</p>
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
