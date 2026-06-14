import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";
import { MotionReveal } from "@/components/alyssa/MotionReveal";
import {
  alyssaLandingPages,
  getLandingPageImageStatus,
  getLandingPageContext,
  type LandingPageConfig,
} from "@/lib/data/landingPages";

function formatPrice(page: LandingPageConfig) {
  const context = getLandingPageContext(page);
  const selectedPackage = context.package;

  if (!selectedPackage) return "未設定";
  return `${selectedPackage.name} · HK$${selectedPackage.promoPrice}`;
}

function modeLabel(mode: LandingPageConfig["mode"]) {
  return mode === "landing_page" ? "Landing page" : "Form-only";
}

function testingLabel(status: LandingPageConfig["testingStatus"]) {
  return status === "ready_for_testing" ? "可開始測試" : "Foundation";
}

export default function LandingPagesPage() {
  return (
    <main className="alyssa-shell">
      <AppNav showInternalWarning />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <section className="rounded-[28px] border border-[#ead9cf] bg-white/86 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.1)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
                Landing Pages
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#321428]">
                Campaign landing page 管理
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
                用同一份表格設定產生兩種輸出：Wix 內容頁用 form-only embed；
                快速測試 offer、campaign 同 market angle 時，用 landing page mode。
                Wix 仍然係主網站，Lead Capture OS 只做 campaign testing layer。
              </p>
            </div>
            <Link
              href="/settings/templates"
              className="rounded-full border border-[#d9b66f] bg-white px-5 py-3 text-sm font-bold text-[#5a2348]"
            >
              查看模板設定
            </Link>
          </div>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-2">
          <ModeCard
            title="Form-only mode"
            description="Wix 已有頁面內容時，只嵌入 Alyssa 表格。系統負責表格提交、來源擷取、套餐驗證同 lead base 寫入。"
            status="已可用"
          />
          <ModeCard
            title="Landing page mode"
            description="在同一份表格設定上加入 hero、offer、sections、FAQ 同 CTA，產生簡單 campaign page。這是 V1 config-preview，不是完整拖拉式 builder。"
            status="V1 foundation"
          />
        </section>

        <section className="mt-6">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#321428]">Campaign pages</h2>
              <p className="mt-1 text-sm text-[#6d4a5c]">
                目前由 configuration foundation 管理；日後可升級為後台 editable templates。
              </p>
            </div>
            <span className="w-fit rounded-full bg-[#fff6f0] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#9a5d76]">
              {alyssaLandingPages.length} config
            </span>
          </div>
          <div className="grid gap-5">
            {alyssaLandingPages.map((page, index) => {
              const context = getLandingPageContext(page);
              const previewUrl = `/lp/${page.slug}`;

              return (
                <MotionReveal key={page.id} delay={0.05 + index * 0.07}>
                <article className="alyssa-premium-card p-5 transition hover:-translate-y-0.5 hover:border-[#c9828e] hover:shadow-[0_18px_45px_rgba(90,35,72,0.12)]">
                  <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <StatusPill>{modeLabel(page.mode)}</StatusPill>
                        <StatusPill>{testingLabel(page.testingStatus)}</StatusPill>
                        <StatusPill>{page.status}</StatusPill>
                      </div>
                      <h3 className="mt-4 text-2xl font-bold text-[#321428]">
                        {page.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">
                        {page.heroSubtitle}
                      </p>
                      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                        <InfoCell label="Slug" value={page.slug} mono />
                        <InfoCell label="Template" value={page.templateName} />
                        <InfoCell label="Brand" value={context.brand?.name ?? "未設定"} />
                        <InfoCell label="Treatment" value={context.treatment?.name ?? "未設定"} />
                        <InfoCell label="Package / price" value={formatPrice(page)} />
                        <InfoCell label="Branch" value={context.branch?.name ?? "未設定"} />
                        <InfoCell label="圖片素材" value={getLandingPageImageStatus(page)} />
                      </dl>
                    </div>

                    <div className="rounded-[20px] bg-[#fff6f0] p-5">
                      <h4 className="text-lg font-bold text-[#321428]">
                        Form connection
                      </h4>
                      <dl className="mt-4 grid gap-3">
                        <InfoCell label="Form ID" value={page.formId} mono />
                        <InfoCell label="Form token" value={page.formToken} mono />
                        <InfoCell label="Preview URL" value={previewUrl} mono />
                        <InfoCell label="Public URL" value={previewUrl} mono />
                      </dl>
                      <div className="mt-5 flex flex-wrap gap-2">
                        <Link
                          href={`/landing-pages/${page.id}`}
                          className="alyssa-focus rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(228,111,100,0.22)]"
                        >
                          開啟設定
                        </Link>
                        <Link
                          href={previewUrl}
                          className="rounded-full border border-[#d9b66f] bg-white px-5 py-3 text-sm font-bold text-[#5a2348]"
                        >
                          Preview
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
                </MotionReveal>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}

function ModeCard({
  title,
  description,
  status,
}: {
  title: string;
  description: string;
  status: string;
}) {
  return (
    <section className="alyssa-premium-card p-5">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-xl font-bold text-[#321428]">{title}</h2>
        <span className="rounded-full bg-[#fff6f0] px-3 py-1 text-xs font-bold text-[#9a5d76]">
          {status}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-[#6d4a5c]">{description}</p>
    </section>
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
