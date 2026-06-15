import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";
import { MotionReveal } from "@/components/alyssa/MotionReveal";
import {
  getLandingPageContext,
  getLandingPageImageStatus,
  type LandingPageConfig,
} from "@/lib/data/landingPages";
import { getLandingPageList } from "@/lib/data/landingPageStore";
import { getPublicLandingPageUrl } from "@/lib/data/appUrl";
import {
  getConfigurationData,
  getPackage,
  packagePriceLabel,
  type FormSetting,
} from "@/lib/data/configuration";

export const dynamic = "force-dynamic";

function modeLabel(mode: LandingPageConfig["mode"]) {
  return mode === "landing_page" ? "Landing Page" : "Wix 表格";
}

function statusLabel(status: LandingPageConfig["status"]) {
  if (status === "published") return "已發布";
  if (status === "draft") return "草稿";
  if (status === "archived") return "已封存";
  return status;
}

function findConnectedForm(page: LandingPageConfig, forms: FormSetting[]) {
  return (
    forms.find((form) => form.id === page.formId) ??
    forms.find((form) => form.publicFormToken === page.formToken) ??
    null
  );
}

export default async function LandingPagesPage() {
  const [{ pages }, config] = await Promise.all([
    getLandingPageList(),
    getConfigurationData(),
  ]);

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="alyssa-kicker">Landing Pages</p>
            <h1 className="mt-2 text-3xl font-bold text-[#321428]">
              Landing Page 列表
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
              管理用於測試優惠、文案和圖片角度的 Campaign Landing Pages。
            </p>
          </div>
          <Link
            href="/campaigns/new"
            className="w-fit rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(228,111,100,0.22)]"
          >
            建立 Campaign
          </Link>
        </header>

        <section className="mt-6 grid gap-5">
          {pages.map((page, index) => {
            const context = getLandingPageContext(page);
            const selectedPackage =
              getPackage(config, page.packageId) ??
              config.packages.find((item) => item.id === context.package?.id);
            const connectedForm = findConnectedForm(page, config.forms);
            const publicUrl = getPublicLandingPageUrl(page.slug);
            const publicLabel =
              page.status === "published" ? publicUrl : "草稿，發布後才會公開";

            return (
              <MotionReveal key={page.id} delay={0.04 + index * 0.06}>
                <article className="alyssa-premium-card alyssa-interactive-card min-w-0 p-5">
                  <div className="grid min-w-0 gap-5 xl:grid-cols-[1fr_0.78fr]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <StatusPill>{modeLabel(page.mode)}</StatusPill>
                        <StatusPill>{statusLabel(page.status)}</StatusPill>
                        <StatusPill>{getLandingPageImageStatus(page)}</StatusPill>
                      </div>
                      <h2 className="mt-4 text-2xl font-bold text-[#321428]">
                        {page.title}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">
                        {page.heroSubtitle}
                      </p>
                      <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        <InfoCell label="Slug" value={page.slug} mono />
                        <InfoCell label="品牌" value={context.brand?.name ?? "未設定"} />
                        <InfoCell label="療程" value={context.treatment?.name ?? "未設定"} />
                        <InfoCell label="套餐價錢" value={packagePriceLabel(selectedPackage)} />
                        <InfoCell label="分店" value={context.branch?.name ?? "未設定"} />
                        <InfoCell
                          label="連接表格"
                          value={connectedForm?.formName ?? page.formToken}
                        />
                      </dl>
                    </div>

                    <div className="min-w-0 rounded-[22px] bg-[#fff6f0] p-4">
                      <p className="text-sm font-bold text-[#321428]">連結</p>
                      <dl className="mt-4 grid gap-3">
                        <InfoCell
                          label="表格代號"
                          value={connectedForm?.publicFormToken ?? page.formToken}
                          mono
                        />
                        <InfoCell label="公開網址" value={publicLabel} mono />
                      </dl>
                      <div className="mt-5 flex flex-wrap gap-2">
                        <Link
                          href={`/landing-pages/${page.id}`}
                          className="rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(228,111,100,0.22)]"
                        >
                          編輯 Landing Page
                        </Link>
                        {page.status === "published" && (
                          <a
                            href={publicUrl}
                            className="rounded-full border border-[#d9b66f] bg-white px-5 py-3 text-sm font-bold text-[#5a2348]"
                          >
                            開啟公開頁
                          </a>
                        )}
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

function StatusPill({ children }: { children: string }) {
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
