import Link from "next/link";
import {
  archiveLandingPageAction,
  deleteLandingPageAction,
} from "@/app/landing-pages/actions";
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
import {
  isLegacyLandingPageCandidate,
  legacyReasonLabel,
  matchesArchiveView,
  parseArchiveView,
  type ArchiveView,
} from "@/lib/data/legacyCleanup";

export const dynamic = "force-dynamic";

type LandingPagesSearchParams = {
  brand?: string | string[];
  archive?: string | string[];
  landing_status?: string | string[];
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

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

function archiveViewLabel(view: ArchiveView) {
  if (view === "archived") return "Archived / legacy";
  if (view === "all") return "All";
  return "Active";
}

function buildLandingPagesHref(view: ArchiveView, brand: string) {
  const params = new URLSearchParams();
  params.set("archive", view);
  if (brand) params.set("brand", brand);
  return `/landing-pages?${params.toString()}`;
}

export default async function LandingPagesPage({
  searchParams,
}: {
  searchParams?: Promise<LandingPagesSearchParams>;
}) {
  const query = await searchParams;
  const selectedBrandParam = firstParam(query?.brand);
  const selectedArchive = parseArchiveView(firstParam(query?.archive));
  const message = firstParam(query?.landing_status);
  const [{ pages }, config] = await Promise.all([
    getLandingPageList(),
    getConfigurationData(),
  ]);
  const selectedBrand =
    config.brands.find(
      (brand) => brand.slug === selectedBrandParam || brand.id === selectedBrandParam
    ) ?? null;
  const scopedPages = selectedBrand
    ? pages.filter((page) => page.brandId === selectedBrand.id)
    : pages;
  const filteredPages = scopedPages.filter((page) =>
    matchesArchiveView(selectedArchive, {
      status: page.status,
      isLegacy: isLegacyLandingPageCandidate(page),
    })
  );
  const archivedCount = scopedPages.filter((page) =>
    matchesArchiveView("archived", {
      status: page.status,
      isLegacy: isLegacyLandingPageCandidate(page),
    })
  ).length;
  const activeCount = scopedPages.length - archivedCount;
  const currentListPath = buildLandingPagesHref(selectedArchive, selectedBrandParam);

  return (
    <main data-testid="landing-pages-screen" className="alyssa-shell">
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

        {message && (
          <div className="mt-5 rounded-2xl border border-[#d9b66f] bg-[#fff6f0] px-4 py-3 text-sm font-bold text-[#5a2348]">
            {message}
          </div>
        )}

        <section className="mt-6 rounded-[24px] border border-[#ead9cf] bg-white/86 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[#321428]">
                View: {archiveViewLabel(selectedArchive)}
              </p>
              <p className="mt-1 text-xs font-semibold text-[#7b5a6a]">
                Active hides archived pages and known Alyssa UXV2/test/demo landing pages by default.
              </p>
              {selectedBrand && (
                <p className="mt-1 text-xs font-semibold text-[#7b5a6a]">
                  Brand scope: {selectedBrand.name}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {([
                ["active", `Active (${activeCount})`],
                ["archived", `Archived / legacy (${archivedCount})`],
                ["all", `All (${scopedPages.length})`],
              ] as Array<[ArchiveView, string]>).map(([view, label]) => (
                <Link
                  key={view}
                  href={buildLandingPagesHref(view, selectedBrandParam)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                    selectedArchive === view
                      ? "border-[#5a2348] bg-[#5a2348] text-white"
                      : "border-[#ead9cf] bg-white text-[#5a2348]"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-[#f1e3dc] pt-4">
            <Link
              href={buildLandingPagesHref(selectedArchive, "")}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                !selectedBrand
                  ? "border-[#5a2348] bg-[#5a2348] text-white"
                  : "border-[#ead9cf] bg-white text-[#5a2348]"
              }`}
            >
              All brands
            </Link>
            {config.brands.map((brand) => (
              <Link
                key={brand.id}
                href={buildLandingPagesHref(selectedArchive, brand.slug)}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                  brand.id === selectedBrand?.id
                    ? "border-[#5a2348] bg-[#5a2348] text-white"
                    : "border-[#ead9cf] bg-white text-[#5a2348]"
                }`}
              >
                {brand.name}
              </Link>
            ))}
          </div>
        </section>

        <section data-testid="landing-page-list" className="mt-6 grid gap-5">
          {filteredPages.map((page, index) => {
            const context = getLandingPageContext(page);
            const selectedPackage =
              getPackage(config, page.packageId) ??
              config.packages.find((item) => item.id === context.package?.id);
            const connectedForm = findConnectedForm(page, config.forms);
            const publicUrl = getPublicLandingPageUrl(page.slug);
            const publicLabel =
              page.status === "published" ? publicUrl : "草稿，發布後才會公開";
            const isLegacy = isLegacyLandingPageCandidate(page);
            const legacyReason = legacyReasonLabel(isLegacy);

            return (
              <MotionReveal key={page.id} delay={0.04 + index * 0.06}>
                <article
                  data-testid="landing-page-row"
                  className="alyssa-premium-card alyssa-interactive-card min-w-0 p-5"
                >
                  <div className="grid min-w-0 gap-5 xl:grid-cols-[1fr_0.78fr]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <StatusPill>{modeLabel(page.mode)}</StatusPill>
                        <StatusPill>{statusLabel(page.status)}</StatusPill>
                        {legacyReason && <StatusPill>{legacyReason}</StatusPill>}
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
                        <details>
                          <summary className="cursor-pointer rounded-full border border-[#ead9cf] bg-white px-5 py-3 text-sm font-bold text-[#5a2348]">
                            Archive / Delete
                          </summary>
                          <div className="mt-2 w-80 rounded-2xl border border-[#ead9cf] bg-white p-3 shadow-[0_18px_42px_rgba(90,35,72,0.12)]">
                            <p className="text-xs font-semibold leading-5 text-[#7b5a6a]">
                              Archive hides this page from active lists. Safe delete only works when no linked form, versions, or lead snapshots are found.
                            </p>
                            <form action={archiveLandingPageAction} className="mt-3 grid gap-2">
                              <input type="hidden" name="pageId" value={page.id} />
                              <input type="hidden" name="returnTo" value={currentListPath} />
                              <label className="flex items-center gap-2 text-xs font-bold text-[#5a2348]">
                                <input
                                  type="checkbox"
                                  name="confirmArchive"
                                  value="yes"
                                  className="h-4 w-4"
                                />
                                Confirm archive
                              </label>
                              <button
                                type="submit"
                                className="rounded-full bg-[#5a2348] px-3 py-1.5 text-xs font-bold text-white"
                              >
                                Archive
                              </button>
                            </form>
                            <form
                              action={deleteLandingPageAction}
                              className="mt-3 grid gap-2 border-t border-[#f1e3dc] pt-3"
                            >
                              <input type="hidden" name="pageId" value={page.id} />
                              <input type="hidden" name="returnTo" value={currentListPath} />
                              <label className="flex items-center gap-2 text-xs font-bold text-[#8a2732]">
                                <input
                                  type="checkbox"
                                  name="confirmDelete"
                                  value="yes"
                                  className="h-4 w-4"
                                />
                                Confirm permanent delete
                              </label>
                              <button
                                type="submit"
                                className="rounded-full border border-[#e7b8b8] bg-[#fff5f5] px-3 py-1.5 text-xs font-bold text-[#8a2732]"
                              >
                                Safe delete
                              </button>
                            </form>
                          </div>
                        </details>
                      </div>
                    </div>
                  </div>
                </article>
              </MotionReveal>
            );
          })}
          {filteredPages.length === 0 && (
            <div className="rounded-[24px] border border-[#ead9cf] bg-white/86 px-5 py-10 text-center text-sm font-semibold text-[#7b5a6a]">
              No Landing Pages match this view.
            </div>
          )}
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
