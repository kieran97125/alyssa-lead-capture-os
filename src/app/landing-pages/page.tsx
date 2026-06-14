import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";
import { MotionReveal } from "@/components/alyssa/MotionReveal";
import {
  getLandingPageImageStatus,
  getLandingPageContext,
  type LandingPageConfig,
} from "@/lib/data/landingPages";
import { getLandingPageList } from "@/lib/data/landingPageStore";

export const dynamic = "force-dynamic";

function formatPrice(page: LandingPageConfig) {
  const context = getLandingPageContext(page);
  const selectedPackage = context.package;

  if (!selectedPackage) return "未設定";
  return `${selectedPackage.name} · HK$${selectedPackage.promoPrice}`;
}

function modeLabel(mode: LandingPageConfig["mode"]) {
  return mode === "landing_page" ? "廣告落地頁" : "Wix 表格嵌入";
}

function testingLabel(status: LandingPageConfig["testingStatus"]) {
  return status === "ready_for_testing" ? "可開始測試" : "目前可查看";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "未發布";

  return new Intl.DateTimeFormat("zh-HK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function LandingPagesPage() {
  const { pages, canPersist } = await getLandingPageList();

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <section className="rounded-[28px] border border-[#ead9cf] bg-white/86 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.1)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
                Landing Pages
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#321428]">
                Landing Page 管理
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
                建立簡單廣告落地頁，快速測試新療程、新優惠同新文案角度。
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

        <section className="mt-6">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#321428]">廣告落地頁</h2>
              <p className="mt-1 text-sm text-[#6d4a5c]">
                目前可查看和準備內容；更完整的版型管理稍後加入。
              </p>
            </div>
            <span className="w-fit rounded-full bg-[#fff6f0] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#9a5d76]">
              {pages.length} {canPersist ? "可儲存及發布" : "目前只可查看"}
            </span>
          </div>
          <div className="grid gap-5">
            {pages.map((page, index) => {
              const context = getLandingPageContext(page);
              const previewUrl = `/lp/${page.slug}`;

              return (
                <MotionReveal key={page.id} delay={0.05 + index * 0.07}>
                <article className="alyssa-premium-card alyssa-interactive-card min-w-0 p-5">
                  <div className="grid min-w-0 gap-5 xl:grid-cols-[1.05fr_0.95fr]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <StatusPill>{modeLabel(page.mode)}</StatusPill>
                        <StatusPill>{testingLabel(page.testingStatus)}</StatusPill>
                        <StatusPill>{page.status}</StatusPill>
                        <StatusPill>
                          {canPersist ? "可儲存及發布" : "目前只可查看"}
                        </StatusPill>
                      </div>
                      <h3 className="mt-4 text-2xl font-bold text-[#321428]">
                        {page.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">
                        {page.heroSubtitle}
                      </p>
                      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                        <InfoCell label="網址代號" value={page.slug} mono />
                        <InfoCell label="版型" value={page.templateName} />
                        <InfoCell label="品牌" value={context.brand?.name ?? "未設定"} />
                        <InfoCell label="療程" value={context.treatment?.name ?? "未設定"} />
                        <InfoCell label="套餐 / 價錢" value={formatPrice(page)} />
                        <InfoCell label="最後更新" value={formatDate(page.updatedAt)} />
                        <InfoCell label="發布時間" value={formatDate(page.publishedAt)} />
                        <InfoCell label="分店" value={context.branch?.name ?? "未設定"} />
                        <InfoCell label="圖片素材" value={getLandingPageImageStatus(page)} />
                      </dl>
                    </div>

                    <div className="min-w-0 rounded-[20px] bg-[#fff6f0] p-5">
                      <h4 className="text-lg font-bold text-[#321428]">
                        登記表格連接
                      </h4>
                      <dl className="mt-4 grid gap-3">
                        <InfoCell label="表格代號" value={page.formId} mono />
                        <InfoCell label="公開表格代號" value={page.formToken} mono />
                        <InfoCell label="預覽連結" value={previewUrl} mono />
                        <InfoCell label="公開連結" value={previewUrl} mono />
                      </dl>
                      <div className="mt-5 flex flex-wrap gap-2">
                        <Link
                          href={`/landing-pages/${page.id}`}
                          className="alyssa-focus rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(228,111,100,0.22)]"
                        >
                          編輯內容
                        </Link>
                        <Link
                          href={previewUrl}
                          className="rounded-full border border-[#d9b66f] bg-white px-5 py-3 text-sm font-bold text-[#5a2348]"
                        >
                          開啟預覽
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

function StatusPill({ children }: { children: string }) {
  return (
    <span className="min-w-0 rounded-full border border-[#ead9cf] bg-[#fff6f0] px-3 py-1 text-xs font-bold text-[#9a5d76]">
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
