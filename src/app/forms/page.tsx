import Link from "next/link";
import type { ReactNode } from "react";
import { AppNav } from "@/components/alyssa/AppNav";
import { CopyButton } from "@/components/alyssa/CopyButton";
import { MotionReveal } from "@/components/alyssa/MotionReveal";
import { duplicateFormAction } from "@/app/forms/actions";
import { getDefaultEmbedCode } from "@/lib/data/appUrl";
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

function linkedLandingPages(
  form: FormSetting,
  config: Awaited<ReturnType<typeof getConfigurationData>>
) {
  return config.landingPages.filter(
    (page) => page.formId === form.id || page.formToken === form.publicFormToken
  );
}

export default async function FormsPage({
  searchParams,
}: {
  searchParams?: Promise<{ form_status?: string | string[] }>;
}) {
  const config = await getConfigurationData();
  const query = await searchParams;
  const message =
    typeof query?.form_status === "string" ? query.form_status : null;

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="alyssa-kicker">Forms</p>
            <h1 className="mt-2 text-3xl font-bold text-[#321428]">
              登記表格管理
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
              建立可放入 Wix 或 Landing Page 的登記表格。
            </p>
          </div>
          <Link
            href="/forms/new"
            className="alyssa-focus w-fit rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(228,111,100,0.22)] transition hover:-translate-y-1 hover:bg-[#d95f55]"
          >
            建立登記表格
          </Link>
        </header>

        {message && (
          <div className="mt-5 rounded-2xl border border-[#d9b66f] bg-[#fff6f0] px-4 py-3 text-sm font-bold text-[#5a2348]">
            {message}
          </div>
        )}

        <section className="mt-6 grid gap-5">
          {config.forms.map((form, index) => {
            const brand = getBrand(config, form.brandId);
            const treatment = getTreatment(config, form.defaultTreatmentId);
            const selectedPackage = getPackage(config, form.defaultPackageId);
            const branch = getBranch(config, form.defaultBranchId);
            const pages = linkedLandingPages(form, config);
            const embedCode = getDefaultEmbedCode(form.publicFormToken, form.id);

            return (
              <MotionReveal key={form.id} delay={0.04 + index * 0.05}>
                <article className="alyssa-premium-card alyssa-interactive-card min-w-0 p-5">
                  <div className="grid min-w-0 gap-5 xl:grid-cols-[1fr_0.72fr]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill>可使用</StatusPill>
                        <StatusPill>{pages.length} 個 Landing Page</StatusPill>
                        <StatusPill>{form.allowedDomains.length} 個可用網域</StatusPill>
                      </div>
                      <h2 className="mt-4 text-2xl font-bold text-[#321428]">
                        {form.formName}
                      </h2>
                      <div className="mt-4 rounded-2xl border border-[#ead9cf] bg-[#fff6f0] p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
                          表格代號
                        </p>
                        <p className="mt-2 break-all font-mono text-sm font-bold text-[#5a2348]">
                          {form.publicFormToken}
                        </p>
                      </div>
                      <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        <InfoCell label="品牌" value={brand?.name ?? "未設定"} />
                        <InfoCell label="療程" value={treatment?.name ?? "未設定"} />
                        <InfoCell label="套餐 / 價錢" value={packagePriceLabel(selectedPackage)} />
                        <InfoCell label="分店" value={branch?.name ?? "未設定"} />
                        <InfoCell
                          label="連接 Landing Page"
                          value={
                            pages.length > 0
                              ? pages.map((page) => page.title).join(", ")
                              : "未連接"
                          }
                        />
                      </dl>
                    </div>

                    <div className="min-w-0 rounded-[22px] bg-[#fff6f0] p-4">
                      <p className="text-sm font-bold text-[#321428]">快速操作</p>
                      <div className="mt-4 grid gap-2">
                        <Link
                          href={`/forms/${form.id}`}
                          className="rounded-full bg-[#5a2348] px-4 py-2.5 text-center text-sm font-bold text-white"
                        >
                          查看 / 編輯
                        </Link>
                        <Link
                          href={`/embed/${form.publicFormToken}`}
                          className="rounded-full border border-[#d9b66f] bg-white px-4 py-2.5 text-center text-sm font-bold text-[#5a2348]"
                        >
                          預覽表格
                        </Link>
                        <CopyButton value={form.publicFormToken} label="複製表格代號" />
                        <CopyButton value={embedCode} label="複製嵌入碼" />
                        <form action={duplicateFormAction}>
                          <input type="hidden" name="formId" value={form.id} />
                          <button
                            type="submit"
                            className="w-full rounded-full border border-[#d9b66f] bg-white px-4 py-2.5 text-sm font-bold text-[#5a2348]"
                          >
                            複製成新表格
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                </article>
              </MotionReveal>
            );
          })}
        </section>
      </div>
    </main>
  );
}

function StatusPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-[#ead9cf] bg-[#fff6f0] px-3 py-1 text-xs font-bold text-[#9a5d76]">
      {children}
    </span>
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
