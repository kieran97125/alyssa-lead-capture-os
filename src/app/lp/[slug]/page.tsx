import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { MetaPixelPageView } from "@/components/alyssa/MetaPixelPageView";
import { MotionAnchor, MotionReveal } from "@/components/alyssa/MotionReveal";
import { PublicLeadForm } from "@/components/alyssa/PublicLeadForm";
import { PublicLpAttributionCapture } from "@/components/alyssa/PublicLpAttributionCapture";
import {
  publicThemeStyle,
  resolvePublicBrandTheme,
} from "@/lib/brandThemes";
import { getConfigurationData } from "@/lib/data/configuration";
import {
  LOCKED_PUBLIC_ATTRIBUTION_STORAGE_KEY,
  PUBLIC_ATTRIBUTION_CLIENT_COOKIE_NAME,
  PUBLIC_ATTRIBUTION_COOKIE_MAX_AGE_SECONDS,
  PUBLIC_ATTRIBUTION_COOKIE_NAME,
  createPublicAttributionCookiePayload,
  decodePublicAttributionCookie,
  encodePublicAttributionCookie,
  hasPublicAttributionTracking,
  normalizePublicAttributionFields,
  publicAttributionParamKeys,
} from "@/lib/attribution/publicAttributionCookie";
import {
  getLandingPageContext,
  getResolvedLandingPageContentSections,
  type LandingPageContentSection,
  type LandingPageContentSectionItem,
} from "@/lib/data/landingPages";
import {
  getCanonicalLandingPageSlug,
  getPublishedLandingPageBySlug,
  isIneffableLandingPageSlug,
} from "@/lib/data/landingPageStore";
import {
  IMAGE_REFERENCE_FOOTER_NOTE,
  getBrandLegalProfile,
  getLegalFooterLinks,
  getLegalFooterText,
} from "@/lib/legal/consent";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ineffableAssets = {
  logo: "/ineffable-wix/assets/logo.png",
  hero: "/ineffable-wix/assets/hero-model.png",
};

function serializeSearchParams(
  params: Record<string, string | string[] | undefined> | undefined
) {
  if (!params) return "";

  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => searchParams.append(key, item));
      return;
    }

    if (value) searchParams.set(key, value);
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function cleanMetaPixelEnv(value: string | undefined) {
  const pixelId = value?.trim().replace(/[^0-9]/g, "") ?? "";
  return pixelId || null;
}

function getMetaPixelEnvName(brandSlug: string) {
  const suffix = brandSlug
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();

  return suffix ? `NEXT_PUBLIC_META_PIXEL_ID_${suffix}` : null;
}

function getMetaPixelIdForBrand(brandSlug: string) {
  const normalizedBrandSlug = brandSlug.trim().toLowerCase();

  if (
    normalizedBrandSlug === "ineffable" ||
    normalizedBrandSlug === "ineffable-beauty"
  ) {
    return (
      cleanMetaPixelEnv(process.env.NEXT_PUBLIC_META_PIXEL_ID_INEFFABLE) ||
      cleanMetaPixelEnv(process.env.NEXT_PUBLIC_META_PIXEL_ID)
    );
  }

  if (normalizedBrandSlug === "alyssa") {
    return cleanMetaPixelEnv(process.env.NEXT_PUBLIC_META_PIXEL_ID_ALYSSA);
  }

  const envName = getMetaPixelEnvName(normalizedBrandSlug);
  return envName ? cleanMetaPixelEnv(process.env[envName]) : null;
}

function getPublicLandingPageUrl(
  slug: string,
  search: string,
  requestOrigin: string | null
) {
  const baseUrl =
    process.env.NEXT_PUBLIC_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "") ||
    requestOrigin ||
    "";

  return baseUrl ? `${baseUrl}/lp/${slug}${search}` : undefined;
}

async function getRequestOrigin() {
  const headerStore = await headers();
  const host =
    headerStore.get("x-forwarded-host") ??
    headerStore.get("host") ??
    "";
  if (!host) return null;

  const proto =
    headerStore.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
  return `${proto}://${host.split(",")[0]?.trim()}`;
}

function getInitialAttributionCookieValue(pageUrl: string | undefined) {
  if (!pageUrl) return null;

  try {
    const payload = createPublicAttributionCookiePayload(new URL(pageUrl));
    return payload ? encodePublicAttributionCookie(payload) : null;
  } catch {
    return null;
  }
}

function getServerInitialAttribution(pageUrl: string | undefined) {
  if (!pageUrl) return null;

  try {
    const url = new URL(pageUrl);
    const tracking = normalizePublicAttributionFields(
      Object.fromEntries(
        publicAttributionParamKeys
          .map((key) => [key, url.searchParams.get(key)] as const)
          .filter(([, value]) => Boolean(value))
      )
    );

    if (!hasPublicAttributionTracking(tracking)) return null;

    return {
      source_capture_method: "server_public_lp_initial_search",
      attribution_source_used: "server_initial",
      captured_at: new Date().toISOString(),
      current_page_url: pageUrl,
      landing_page_url: pageUrl,
      page_path: url.pathname,
      ...tracking,
    };
  } catch {
    return null;
  }
}

function getInlineBootstrapAttribution(pageUrl: string | undefined) {
  if (!pageUrl) return null;

  try {
    const url = new URL(pageUrl);
    const tracking = normalizePublicAttributionFields(
      Object.fromEntries(
        publicAttributionParamKeys
        .map((key) => [key, url.searchParams.get(key)] as const)
        .filter(([, value]) => Boolean(value))
      )
    );

    if (!hasPublicAttributionTracking(tracking)) return null;

    return {
      source_capture_method: "server_inline_bootstrap_first_touch",
      attribution_source_used: "inline_bootstrap",
      captured_at: new Date().toISOString(),
      current_page_url: pageUrl,
      landing_page_url: pageUrl,
      page_path: url.pathname,
      ...tracking,
    };
  } catch {
    return null;
  }
}

async function getProxyAttributionPageUrl(initialQueryString: string) {
  if (
    hasPublicAttributionTracking(
      normalizePublicAttributionFields(
        Object.fromEntries(new URLSearchParams(initialQueryString))
      )
    )
  ) {
    return undefined;
  }

  const cookieStore = await cookies();
  const proxyAttribution = decodePublicAttributionCookie(
    cookieStore.get(PUBLIC_ATTRIBUTION_COOKIE_NAME)?.value
  );

  return proxyAttribution?.current_page_url;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublishedLandingPageBySlug(
    getCanonicalLandingPageSlug(slug)
  );

  if (!page) {
    return {
      title: "Campaign Landing Page",
      description: "Ineffable Beauty campaign landing page",
    };
  }

  return {
    title: page.title,
    description:
      page.heroSubtitle ||
      page.offerBody ||
      `${page.title} - 預約體驗及了解療程詳情`,
  };
}

export default async function PublicLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const canonicalSlug = getCanonicalLandingPageSlug(slug);
  const initialQueryString = serializeSearchParams(query);
  const [proxyAttributionPageUrl, requestOrigin] = await Promise.all([
    getProxyAttributionPageUrl(initialQueryString),
    getRequestOrigin(),
  ]);
  const requestPageUrl = getPublicLandingPageUrl(
    canonicalSlug,
    initialQueryString,
    requestOrigin
  );
  const preservedPageUrl =
    proxyAttributionPageUrl ??
    requestPageUrl;
  const inlineBootstrapAttribution =
    getInlineBootstrapAttribution(requestPageUrl);
  const serverInitialAttribution =
    inlineBootstrapAttribution ?? getServerInitialAttribution(preservedPageUrl);
  const initialAttributionCookieValue =
    getInitialAttributionCookieValue(preservedPageUrl);

  const [page, config] = await Promise.all([
    getPublishedLandingPageBySlug(canonicalSlug),
    getConfigurationData(),
  ]);

  if (!page) notFound();

  const context = getLandingPageContext(page);
  const connectedForm =
    config.forms.find((form) => form.id === page.formId) ??
    config.forms.find((form) => form.publicFormToken === page.formToken) ??
    null;

  if (!connectedForm) notFound();

  const publicBrand =
    config.brands.find((brand) => brand.id === connectedForm.brandId) ??
    config.brands.find((brand) => brand.id === page.brandId) ??
    context.brand ??
    null;
  const selectedTreatment =
    config.treatments.find((item) => item.id === page.treatmentId) ??
    config.treatments.find(
      (item) => item.id === connectedForm.defaultTreatmentId
    ) ??
    context.treatment ??
    null;
  const selectedPackage =
    config.packages.find((item) => item.id === page.packageId) ??
    config.packages.find((item) => item.id === connectedForm.defaultPackageId) ??
    context.package ??
    null;
  const selectedBranch =
    config.branches.find((item) => item.id === page.branchId) ??
    config.branches.find((item) => item.id === connectedForm.defaultBranchId) ??
    context.branch ??
    null;

  if (!publicBrand || !selectedTreatment || !selectedPackage || !selectedBranch) {
    notFound();
  }

  const isIneffableCanonical = isIneffableLandingPageSlug(page.slug);
  const theme = resolvePublicBrandTheme({
    brandSlug: isIneffableCanonical ? "ineffable" : publicBrand.slug,
    brandName: isIneffableCanonical ? "Ineffable Beauty" : publicBrand.name,
  });
  const themeStyle = publicThemeStyle(theme) as CSSProperties;
  const isIneffable = theme.key === "ineffable" || isIneffableCanonical;
  const brandDisplayName = isIneffable ? "Ineffable Beauty" : publicBrand.name;
  const promoPrice = Number(selectedPackage.promoPrice ?? 0);
  const price = promoPrice > 0 ? `HK$${promoPrice}` : "預約查詢";
  const heroTitle =
    page.heroTitle || (isIneffable ? "$388 柔清舒敏針清" : page.title);
  const heroSubtitle =
    page.heroSubtitle ||
    "針對粉刺、粗糙及敏感後修護需要，提供清晰療程、價錢及分店安排。";
  const offerBadge = page.offerBadge || `${price} 首次體驗`;
  const ctaText = page.ctaText || "立即預約體驗";
  const secondaryCtaText = page.secondaryCtaText || "查看療程詳情";
  const offerSummaryImageUrl = page.offerImageUrl;
  const formSideImageUrl = page.treatmentImageUrl || page.offerImageUrl;
  const heroImageUrl =
    page.heroImageUrl || (isIneffable ? ineffableAssets.hero : "");
  const publicBrandLegalSettings = publicBrand as typeof publicBrand & {
    legalPageUrl?: string | null;
    legalLinkLabel?: string | null;
    operatorName?: string | null;
  };
  const legalProfile = getBrandLegalProfile({
    brandSlug: isIneffable ? "ineffable" : publicBrand.slug,
    brandName: brandDisplayName,
    legalPageUrl: publicBrandLegalSettings.legalPageUrl,
    legalLinkLabel: publicBrandLegalSettings.legalLinkLabel,
    operatorName: publicBrandLegalSettings.operatorName,
  });
  const contentSections = getResolvedLandingPageContentSections(page).filter(
    hasVisibleSectionContent
  );
  const publicBrandSlug = isIneffable ? "ineffable" : publicBrand.slug;
  const metaPixelId = getMetaPixelIdForBrand(publicBrandSlug);

  return (
    <main
      className="min-h-screen overflow-x-hidden bg-[var(--public-bg)] text-[var(--public-text)]"
      style={themeStyle}
    >
      <PublicAttributionCookieScript
        cookieValue={initialAttributionCookieValue}
        inlineBootstrapAttribution={inlineBootstrapAttribution}
      />
      <PublicLpAttributionCapture
        formToken={connectedForm.publicFormToken}
        formId={connectedForm.id}
        brandSlug={publicBrandSlug}
        initialQueryString={initialQueryString}
        serverInitialAttribution={serverInitialAttribution}
      />
      <MetaPixelPageView
        pixelId={metaPixelId}
        preservedPageUrl={preservedPageUrl}
        initialQueryString={initialQueryString}
      />
      <section id="hero" className="relative scroll-mt-6 bg-[radial-gradient(circle_at_18%_10%,#FFF1F7_0,#FFF8FC_34%,#F6F2FF_100%)] px-4 pb-10 pt-6 sm:px-5 sm:pb-14 sm:pt-8">
        <div className="mx-auto grid max-w-7xl items-center gap-7 sm:gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <MotionReveal>
            <div className="flex items-center gap-3 sm:gap-4">
              {isIneffable && (
                <img
                  src={ineffableAssets.logo}
                  alt="Ineffable Beauty"
                  className="h-11 w-11 rounded-full object-cover sm:h-14 sm:w-14"
                />
              )}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--public-accent)] sm:text-xs sm:tracking-[0.24em]">
                  {brandDisplayName}
                </p>
                <p className="mt-1 text-[13px] font-semibold leading-5 text-[var(--public-muted)] sm:text-sm">
                  銅鑼灣 · 針清護理 · 首次體驗
                </p>
              </div>
            </div>

            <p className="mt-6 inline-flex rounded-full border border-[var(--public-border)] bg-white/80 px-3 py-1.5 text-xs font-bold text-[var(--public-accent)] shadow-sm sm:mt-10 sm:px-4 sm:py-2 sm:text-sm">
              {offerBadge}
            </p>
            <h1 className="mt-3 max-w-3xl text-[30px] font-bold leading-[1.12] text-[var(--public-heading)] sm:mt-5 sm:text-5xl md:text-7xl">
              {heroTitle}
            </h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-7 text-[var(--public-muted)] sm:mt-6 sm:text-base sm:leading-8 md:text-lg">
              {heroSubtitle}
            </p>

            <div className="mt-6 flex flex-col gap-2.5 sm:mt-8 sm:flex-row sm:flex-wrap sm:gap-3">
              <MotionAnchor
                href="#lead-form"
                className="inline-flex justify-center rounded-full bg-[var(--public-cta)] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_28px_rgba(216,91,163,0.2)] transition hover:bg-[var(--public-cta-hover)] sm:px-7 sm:py-3.5 sm:shadow-[0_20px_46px_rgba(216,91,163,0.28)]"
              >
                {ctaText}
              </MotionAnchor>
              <MotionAnchor
                href="#offer-summary"
                className="inline-flex justify-center rounded-full border border-[var(--public-border)] bg-white/80 px-5 py-3 text-sm font-bold text-[var(--public-accent)] transition hover:bg-white sm:px-7 sm:py-3.5"
              >
                {secondaryCtaText}
              </MotionAnchor>
            </div>
          </MotionReveal>

          {heroImageUrl && (
            <MotionReveal delay={0.1}>
              <div className="relative hidden sm:block">
                <div className="absolute -left-6 top-8 h-40 w-40 rounded-full bg-[#FFF1F7] blur-2xl" />
                <div className="absolute -right-4 bottom-8 h-48 w-48 rounded-full bg-[#EDE7FF] blur-2xl" />
                <img
                  src={heroImageUrl}
                  alt={`${brandDisplayName} campaign visual`}
                  fetchPriority="high"
                  className="relative z-10 min-h-[520px] w-full rounded-[44px] border border-white object-cover object-center shadow-[0_34px_90px_rgba(216,91,163,0.2)]"
                />
              </div>
            </MotionReveal>
          )}
        </div>
      </section>

      <MotionReveal>
        <section id="quick-cta" className="scroll-mt-6 bg-white px-4 py-6 sm:px-5 sm:py-8">
          <div className="mx-auto max-w-7xl rounded-[20px] border border-[var(--public-border)] bg-white p-4 shadow-[0_10px_30px_rgba(216,91,163,0.08)] sm:rounded-[34px] sm:bg-[linear-gradient(135deg,#FFFFFF_0%,#FFF1F7_52%,#F6F2FF_100%)] sm:p-6 sm:shadow-[0_24px_70px_rgba(216,91,163,0.12)] md:p-8">
            <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--public-accent)]">
                  快速登記
                </p>
                <h2 className="mt-2 text-[22px] font-bold leading-tight text-[var(--public-heading)] sm:mt-3 sm:text-3xl md:text-4xl">
                  立即登記 $388 首次體驗
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--public-muted)] sm:mt-3 sm:leading-7">
                  填寫簡單資料，Ineffable Beauty 團隊會透過 WhatsApp 跟進確認。
                </p>
              </div>
              <MotionAnchor
                href="#lead-form"
                className="inline-flex justify-center rounded-full bg-[var(--public-cta)] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_28px_rgba(216,91,163,0.2)] transition hover:bg-[var(--public-cta-hover)] sm:px-8 sm:py-4 sm:shadow-[0_20px_46px_rgba(216,91,163,0.28)]"
              >
                立即登記
              </MotionAnchor>
            </div>
          </div>
        </section>
      </MotionReveal>

      <MotionReveal>
        <section id="offer-summary" className="scroll-mt-6 px-4 py-9 sm:px-5 sm:py-12">
          <div className="mx-auto grid max-w-7xl gap-5 sm:gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            {offerSummaryImageUrl && (
              <img
                src={offerSummaryImageUrl}
                alt={`${selectedPackage.name} offer visual`}
                loading="lazy"
                decoding="async"
                className="min-h-[220px] w-full rounded-[20px] border border-[var(--public-border)] bg-white object-contain p-2 shadow-[0_10px_30px_rgba(216,91,163,0.08)] sm:min-h-[320px] sm:rounded-[36px] sm:p-3 sm:shadow-[0_24px_70px_rgba(216,91,163,0.12)]"
              />
            )}
            <div className={offerSummaryImageUrl ? "" : "lg:col-span-2"}>
              <SectionHeading
                eyebrow="優惠摘要"
                title={`${price} ${selectedPackage.name}`}
                body={
                  page.offerBody ||
                  "客人預約前可以清楚了解療程、價錢、分店及跟進安排。"
                }
              />
              <div className="mt-5 grid gap-2.5 sm:mt-7 sm:grid-cols-2 sm:gap-3">
                <InfoCard label="品牌" value={brandDisplayName} />
                <InfoCard label="療程" value={selectedTreatment.name} />
                <InfoCard label="套餐" value={selectedPackage.name} />
                <InfoCard label="分店" value={selectedBranch.name} />
              </div>
            </div>
          </div>
        </section>
      </MotionReveal>

      {contentSections.length > 0 && (
        <MotionReveal>
          <section className="px-4 py-9 sm:px-5 sm:py-12">
            <div className="mx-auto grid max-w-7xl gap-5 sm:gap-8">
              {contentSections.map((section) => (
                <ContentSectionBlock key={section.id} section={section} />
              ))}
            </div>
          </section>
        </MotionReveal>
      )}

      <MotionReveal>
        <section id="lead-form" className="scroll-mt-6 bg-[#FFF1F7] px-2 py-9 sm:px-5 sm:py-12">
          <div
            className={`mx-auto grid max-w-7xl gap-5 sm:gap-8 ${
              formSideImageUrl ? "lg:grid-cols-[0.92fr_1.08fr]" : ""
            }`}
          >
            {formSideImageUrl && (
              <div className="hidden sm:block">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--public-accent)]">
                  預約表格
                </p>
                <h2 className="mt-3 text-4xl font-bold leading-tight text-[var(--public-heading)]">
                  立即預約 $388 優惠
                </h2>
                <p className="mt-4 text-sm leading-7 text-[var(--public-muted)]">
                  填寫資料後，Ineffable Beauty 團隊會透過 WhatsApp 跟進確認。
                </p>
                <img
                  src={formSideImageUrl}
                  alt={`${selectedPackage.name} form visual`}
                  loading="lazy"
                  decoding="async"
                  className="mt-6 min-h-[340px] w-full rounded-[34px] border border-[var(--public-border)] bg-white object-contain p-3 shadow-[0_24px_70px_rgba(216,91,163,0.12)]"
                />
              </div>
            )}
            <div>
              {!formSideImageUrl && (
                <div className="mb-4 px-2 sm:mb-6 sm:px-0">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--public-accent)]">
                    預約表格
                  </p>
                  <h2 className="mt-2 text-[24px] font-bold leading-tight text-[var(--public-heading)] sm:mt-3 sm:text-4xl">
                    立即預約 $388 優惠
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-[var(--public-muted)] sm:mt-4 sm:leading-7">
                    填寫資料後，Ineffable Beauty 團隊會透過 WhatsApp 跟進確認。
                  </p>
                </div>
              )}
              <PublicLeadForm
                formToken={connectedForm.publicFormToken}
                formId={connectedForm.id}
                brandSlug={publicBrandSlug}
                initialQueryString={initialQueryString}
                serverInitialAttribution={serverInitialAttribution}
              />
            </div>
          </div>
        </section>
      </MotionReveal>

      <PublicLegalFooter
        footerText={getLegalFooterText(legalProfile)}
        links={getLegalFooterLinks(legalProfile)}
      />
    </main>
  );
}

function PublicAttributionCookieScript({
  cookieValue,
  inlineBootstrapAttribution,
}: {
  cookieValue: string | null;
  inlineBootstrapAttribution: Record<string, unknown> | null;
}) {
  if (!cookieValue && !inlineBootstrapAttribution) return null;

  const script = `
(function () {
  try {
    var cookieValue = ${JSON.stringify(cookieValue)};
    var secure = window.location.protocol === "https:" ? "; Secure" : "";
    var trackingKeys = ${JSON.stringify(publicAttributionParamKeys)};
    var lockedKey = ${JSON.stringify(LOCKED_PUBLIC_ATTRIBUTION_STORAGE_KEY)};
    var bootstrapFlagKey = "launchhub_attribution_bootstrap_ran";
    var bootstrapPayload = ${JSON.stringify(inlineBootstrapAttribution)};
    function hasTracking(value) {
      if (!value || typeof value !== "object") return false;
      return trackingKeys.some(function (key) {
        return typeof value[key] === "string" && value[key].trim();
      });
    }
    function readStorage(storage, key) {
      try {
        var value = storage.getItem(key);
        return value ? JSON.parse(value) : null;
      } catch (error) {
        return null;
      }
    }
    function writeStorage(storage, key, value) {
      try {
        storage.setItem(key, JSON.stringify(value));
      } catch (error) {}
    }
    if (cookieValue) {
      document.cookie = ${JSON.stringify(PUBLIC_ATTRIBUTION_COOKIE_NAME)} + "=" + cookieValue + "; Path=/; Max-Age=${PUBLIC_ATTRIBUTION_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax" + secure;
    }
    if (!hasTracking(bootstrapPayload)) return;
    var existingSession = readStorage(window.sessionStorage, lockedKey);
    var existingLocal = readStorage(window.localStorage, lockedKey);
    if (!hasTracking(existingSession)) {
      writeStorage(window.sessionStorage, lockedKey, bootstrapPayload);
    }
    if (!hasTracking(existingLocal)) {
      writeStorage(window.localStorage, lockedKey, bootstrapPayload);
    }
    writeStorage(window.sessionStorage, bootstrapFlagKey, {
      ran: true,
      captured_at: bootstrapPayload.captured_at || new Date().toISOString(),
      source_capture_method: bootstrapPayload.source_capture_method
    });
    var clientCookieValue = encodeURIComponent(JSON.stringify(bootstrapPayload));
    document.cookie = ${JSON.stringify(PUBLIC_ATTRIBUTION_CLIENT_COOKIE_NAME)} + "=" + clientCookieValue + "; Path=/; Max-Age=${PUBLIC_ATTRIBUTION_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax" + secure;
  } catch (error) {}
})();
`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

function SectionHeading({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--public-accent)] sm:text-sm sm:tracking-[0.22em]">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-[24px] font-bold leading-tight text-[var(--public-heading)] sm:mt-3 sm:text-3xl md:text-4xl">
        {title}
      </h2>
      {body && (
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--public-muted)] sm:mt-4 sm:leading-7">
          {body}
        </p>
      )}
    </div>
  );
}

function hasVisibleItemContent(item: LandingPageContentSectionItem) {
  return Boolean(
    item.title ||
      item.body ||
      item.imageUrl ||
      item.caption ||
      item.ctaText ||
      item.ctaUrl
  );
}

function hasVisibleSectionContent(section: LandingPageContentSection) {
  return Boolean(
    section.title ||
      section.subtitle ||
      section.items.some(hasVisibleItemContent)
  );
}

function visibleItemsForSection(section: LandingPageContentSection) {
  return section.items.filter((item) => {
    if (!hasVisibleItemContent(item)) return false;
    if (section.itemImageMode === "required" && !item.imageUrl) return false;
    return true;
  });
}

function gridClassForColumns(columns: number) {
  if (columns === 1) return "lg:grid-cols-1";
  if (columns === 2) return "lg:grid-cols-2";
  if (columns === 4) return "md:grid-cols-2 xl:grid-cols-4";
  return "md:grid-cols-2 xl:grid-cols-3";
}

function ContentSectionBlock({
  section,
}: {
  section: LandingPageContentSection;
}) {
  const items = visibleItemsForSection(section);
  const sectionId = `section-${section.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

  if (!section.title && !section.subtitle && items.length === 0) return null;

  if (section.type === "text") {
    return (
      <section id={sectionId} className="scroll-mt-6 rounded-[20px] border border-[var(--public-border)] bg-white p-4 shadow-[0_10px_30px_rgba(216,91,163,0.08)] sm:rounded-[34px] sm:p-7 sm:shadow-[0_24px_70px_rgba(216,91,163,0.1)]">
        <SectionHeading
          eyebrow={section.label || "內容"}
          title={section.title}
          body={section.subtitle}
        />
      </section>
    );
  }

  if (section.type === "image_text") {
    const firstItem = items[0];
    return (
      <section id={sectionId} className="scroll-mt-6 rounded-[20px] border border-[var(--public-border)] bg-white p-4 shadow-[0_10px_30px_rgba(216,91,163,0.08)] sm:rounded-[34px] sm:p-5 sm:shadow-[0_24px_70px_rgba(216,91,163,0.1)] md:p-7">
        <div className="grid gap-5 sm:gap-7 lg:grid-cols-2 lg:items-center">
          {firstItem?.imageUrl && (
            <img
              src={firstItem.imageUrl}
              alt={firstItem.title || section.title}
              loading="lazy"
              decoding="async"
              className="min-h-[220px] w-full rounded-[18px] border border-[var(--public-border)] bg-[#FFF8FC] object-contain p-2 sm:min-h-[320px] sm:rounded-[28px] sm:p-3"
            />
          )}
          <div className={firstItem?.imageUrl ? "" : "lg:col-span-2"}>
            <SectionHeading
              eyebrow={section.label || "內容"}
              title={section.title || firstItem?.title || ""}
              body={section.subtitle || firstItem?.body || ""}
            />
            {firstItem && (firstItem.title || firstItem.body) && section.title && (
              <div className="mt-4 rounded-[18px] bg-[#FFF8FC] p-4 sm:mt-5 sm:rounded-[24px] sm:p-5">
                {firstItem.title && (
                  <h3 className="text-[18px] font-bold text-[var(--public-heading)] sm:text-xl">
                    {firstItem.title}
                  </h3>
                )}
                {firstItem.body && (
                  <p className="mt-2 text-sm leading-6 text-[var(--public-muted)] sm:mt-3 sm:leading-7">
                    {firstItem.body}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  if (section.type === "faq") {
    return (
      <section id={sectionId} className="scroll-mt-6 rounded-[20px] border border-[var(--public-border)] bg-white p-4 shadow-[0_10px_30px_rgba(216,91,163,0.08)] sm:rounded-[34px] sm:p-7 sm:shadow-[0_24px_70px_rgba(216,91,163,0.1)]">
        <SectionHeading
          eyebrow={section.label || "FAQ"}
          title={section.title}
          body={section.subtitle}
        />
        <div className="mt-5 grid gap-3.5 sm:mt-7 sm:gap-4">
          {items.map((item, index) => (
            <article
              key={`${section.id}-${index}`}
              className="rounded-[18px] border border-[var(--public-border)] bg-[#FFF8FC] p-4 sm:rounded-[26px] sm:p-6"
            >
              <h3 className="text-[17px] font-bold text-[var(--public-heading)] sm:text-lg">
                {item.title || `問題 ${index + 1}`}
              </h3>
              {item.body && (
                <p className="mt-2 text-sm leading-6 text-[var(--public-muted)] sm:mt-3 sm:leading-7">
                  {item.body}
                </p>
              )}
            </article>
          ))}
        </div>
      </section>
    );
  }

  const gridClass = gridClassForColumns(section.columns);

  return (
    <section id={sectionId} className="scroll-mt-6 rounded-[20px] border border-[var(--public-border)] bg-white p-4 shadow-[0_10px_30px_rgba(216,91,163,0.08)] sm:rounded-[34px] sm:p-7 sm:shadow-[0_24px_70px_rgba(216,91,163,0.1)]">
      <SectionHeading
        eyebrow={section.label || "內容"}
        title={section.title}
        body={section.subtitle}
      />
      <div className={`mt-5 grid gap-3.5 sm:mt-7 sm:gap-5 ${gridClass}`}>
        {items.map((item, index) => (
          <ContentCard
            key={`${section.id}-${index}`}
            item={item}
            index={index}
            imageOnly={section.type === "image_grid"}
            labelPrefix={section.type === "steps" ? "STEP" : "ITEM"}
          />
        ))}
      </div>
    </section>
  );
}

function ContentCard({
  item,
  index,
  imageOnly = false,
  labelPrefix = "ITEM",
}: {
  item: LandingPageContentSectionItem;
  index: number;
  imageOnly?: boolean;
  labelPrefix?: "ITEM" | "STEP";
}) {
  return (
    <article className="overflow-hidden rounded-[34px] border border-[var(--public-border)] bg-white shadow-[0_24px_70px_rgba(216,91,163,0.12)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_30px_85px_rgba(216,91,163,0.18)]">
      {item.imageUrl && (
        <a
          href={item.imageUrl}
          target="_blank"
          rel="noreferrer"
          className="group block bg-[#FFF8FC] p-3"
          aria-label={`${item.title || `項目 ${index + 1}`} 圖片放大`}
        >
          <span className="relative block overflow-hidden rounded-[26px] border border-[var(--public-border)] bg-white">
            <img
              src={item.imageUrl}
              alt={item.title || `項目 ${index + 1}`}
              className="h-[260px] w-full object-contain transition duration-300 group-hover:scale-[1.02] sm:h-[320px]"
            />
            <span className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-[var(--public-accent)] shadow-sm">
              點擊放大
            </span>
          </span>
        </a>
      )}
      {!imageOnly && (
        <div className="px-6 pb-7 pt-5">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--public-accent)]">
            {`${labelPrefix} ${index + 1}`}
          </p>
          {item.title && (
            <h3 className="mt-3 text-xl font-bold leading-tight text-[var(--public-heading)]">
              {item.title}
            </h3>
          )}
          {item.body && (
            <p className="mt-3 text-sm leading-7 text-[var(--public-muted)]">
              {item.body}
            </p>
          )}
          {item.caption && (
            <p className="mt-3 text-xs font-semibold leading-5 text-[var(--public-muted)]">
              {item.caption}
            </p>
          )}
          {item.ctaText && item.ctaUrl && (
            <a
              href={item.ctaUrl}
              className="mt-5 inline-flex rounded-full bg-[var(--public-cta)] px-5 py-3 text-sm font-bold text-white"
            >
              {item.ctaText}
            </a>
          )}
        </div>
      )}
      {imageOnly && (item.title || item.body) && (
        <div className="px-6 pb-7 pt-5">
          {item.title && (
            <h3 className="text-xl font-bold leading-tight text-[var(--public-heading)]">
              {item.title}
            </h3>
          )}
          {item.body && (
          <p className="mt-3 text-sm leading-7 text-[var(--public-muted)]">
            {item.body}
          </p>
          )}
          {item.caption && (
            <p className="mt-3 text-xs font-semibold leading-5 text-[var(--public-muted)]">
              {item.caption}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-[var(--public-border)] bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--public-accent)]">
        {label}
      </p>
      <p className="mt-2 text-sm font-bold text-[var(--public-heading)]">
        {value}
      </p>
    </div>
  );
}

function PublicLegalFooter({
  footerText,
  links,
}: {
  footerText: string;
  links: Array<{ label: string; href: string }>;
}) {
  return (
    <footer id="legal-footer" className="scroll-mt-6 border-t border-[var(--public-border)] bg-white px-5 py-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 text-xs font-semibold leading-5 text-[var(--public-muted)] md:flex-row md:items-center md:justify-between">
        <div className="grid gap-1">
          <p>{footerText}</p>
          <p>{IMAGE_REFERENCE_FOOTER_NOTE}</p>
        </div>
        <nav className="flex flex-wrap gap-x-4 gap-y-2">
          {links.map((link) => (
            <a
              key={`${link.label}:${link.href}`}
              className="underline underline-offset-4"
              href={link.href}
              target={link.href.startsWith("http") ? "_blank" : undefined}
              rel={link.href.startsWith("http") ? "noreferrer" : undefined}
            >
              {link.label}
            </a>
          ))}
          <a className="underline underline-offset-4" href="#lead-form">
            預約表格
          </a>
        </nav>
      </div>
    </footer>
  );
}
