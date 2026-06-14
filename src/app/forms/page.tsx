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
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
              表格管理
            </p>
            <h1 className="mt-2 text-3xl font-bold text-[#321428]">
              Wix 登記表格
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
              這裡用來建立可以放入 Wix 的登記表格。Wix 頁面已有內容時，複製嵌入碼即可；
              如果要建立完整廣告落地頁，請到 Landing Pages。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/settings"
              className="rounded-full border border-[#d9b66f] bg-white px-5 py-3 text-sm font-bold text-[#5a2348]"
            >
              查看設定中心
            </Link>
            <Link
              href="/embed-preview"
              className="rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#d95f55]"
            >
              測試 Wix 預覽
            </Link>
          </div>
        </div>

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
                  className="alyssa-premium-card min-w-0 p-5"
                >
                  <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
                        {form.status}
                      </p>
                      <h2 className="mt-3 text-2xl font-bold text-[#321428]">
                        {form.formName}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">
                        這張表格連接指定品牌、療程、套餐同分店，可放入 Wix 頁面，
                        亦可連接 Landing Page。
                      </p>
                    </div>
                    <span className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
                      可放入 Wix
                    </span>
                  </div>

                  <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                    <InfoCell label="品牌" value={brand?.name ?? "未設定"} />
                    <InfoCell label="療程" value={treatment?.name ?? "未設定"} />
                    <InfoCell label="套餐 / 價錢" value={packagePriceLabel(selectedPackage)} />
                    <InfoCell label="分店" value={branch?.name ?? "未設定"} />
                    <InfoCell label="表格代號" value={form.publicFormToken} mono />
                    <InfoCell
                      label="允許嵌入網域"
                      value={form.allowedDomains.length > 0 ? form.allowedDomains.join(", ") : "未設定"}
                    />
                    <InfoCell
                      label="已連接 Landing Pages"
                      value={linkedPages.length > 0 ? linkedPages.map((page) => page.title).join(", ") : "未有關聯"}
                    />
                    <InfoCell label="Wix 嵌入程式" value={embedScriptUrl} mono />
                  </dl>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link
                      href={`/forms/${form.id}`}
                      className="rounded-full bg-[#5a2348] px-5 py-3 text-sm font-bold text-white"
                    >
                      開啟詳情
                    </Link>
                    <Link
                      href={`/embed/${form.publicFormToken}`}
                      className="rounded-full border border-[#d9b66f] bg-white px-5 py-3 text-sm font-bold text-[#5a2348]"
                    >
                      預覽表格
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>

          <EmbedCodeCard
            code={embedCode}
            title="Wix 嵌入碼"
            description="將呢段嵌入碼放入 Wix 頁面，表格會沿用所選品牌、療程、套餐同分店設定。"
          />
        </section>
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
    <div className="min-w-0 rounded-2xl bg-[#fff6f0] p-4">
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
