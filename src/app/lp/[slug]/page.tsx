import type { Metadata } from "next";
import Script from "next/script";
import { notFound, redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { MotionAnchor, MotionReveal } from "@/components/alyssa/MotionReveal";
import { PublicLeadForm } from "@/components/alyssa/PublicLeadForm";
import {
  publicThemeStyle,
  resolvePublicBrandTheme,
} from "@/lib/brandThemes";
import { getConfigurationData } from "@/lib/data/configuration";
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

function getMetaPixelId() {
  const rawPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? "";
  const pixelId = rawPixelId.replace(/[^0-9]/g, "");
  return pixelId || null;
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

  if (canonicalSlug !== slug) {
    redirect(`/lp/${canonicalSlug}${serializeSearchParams(query)}`);
  }

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
  const legalProfile = getBrandLegalProfile({
    brandSlug: isIneffable ? "ineffable" : publicBrand.slug,
    brandName: brandDisplayName,
  });
  const contentSections = getResolvedLandingPageContentSections(page).filter(
    hasVisibleSectionContent
  );
  const metaPixelId = getMetaPixelId();

  return (
    <main
      className="min-h-screen overflow-hidden bg-[var(--public-bg)] text-[var(--public-text)]"
      style={themeStyle}
    >
      <PublicMetaPixel pixelId={metaPixelId} />
      <section id="hero" className="relative scroll-mt-6 bg-[radial-gradient(circle_at_18%_10%,#FFF1F7_0,#FFF8FC_34%,#F6F2FF_100%)] px-5 pb-14 pt-8">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <MotionReveal>
            <div className="flex items-center gap-4">
              {isIneffable && (
                <img
                  src={ineffableAssets.logo}
                  alt="Ineffable Beauty"
                  className="h-14 w-14 rounded-full object-cover"
                />
              )}
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--public-accent)]">
                  {brandDisplayName}
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--public-muted)]">
                  銅鑼灣 · 針清護理 · 首次體驗
                </p>
              </div>
            </div>

            <p className="mt-10 inline-flex rounded-full border border-[var(--public-border)] bg-white/80 px-4 py-2 text-sm font-bold text-[var(--public-accent)] shadow-sm">
              {offerBadge}
            </p>
            <h1 className="mt-5 max-w-3xl text-5xl font-bold leading-[1.05] text-[var(--public-heading)] md:text-7xl">
              {heroTitle}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-[var(--public-muted)] md:text-lg">
              {heroSubtitle}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <MotionAnchor
                href="#lead-form"
                className="rounded-full bg-[var(--public-cta)] px-7 py-3.5 text-sm font-bold text-white shadow-[0_20px_46px_rgba(216,91,163,0.28)] transition hover:bg-[var(--public-cta-hover)]"
              >
                {ctaText}
              </MotionAnchor>
              <MotionAnchor
                href="#offer-summary"
                className="rounded-full border border-[var(--public-border)] bg-white/80 px-7 py-3.5 text-sm font-bold text-[var(--public-accent)] transition hover:bg-white"
              >
                {secondaryCtaText}
              </MotionAnchor>
            </div>
          </MotionReveal>

          {heroImageUrl && (
            <MotionReveal delay={0.1}>
              <div className="relative">
                <div className="absolute -left-6 top-8 h-40 w-40 rounded-full bg-[#FFF1F7] blur-2xl" />
                <div className="absolute -right-4 bottom-8 h-48 w-48 rounded-full bg-[#EDE7FF] blur-2xl" />
                <img
                  src={heroImageUrl}
                  alt={`${brandDisplayName} campaign visual`}
                  className="relative z-10 min-h-[520px] w-full rounded-[44px] border border-white object-cover object-center shadow-[0_34px_90px_rgba(216,91,163,0.2)]"
                />
              </div>
            </MotionReveal>
          )}
        </div>
      </section>

      <MotionReveal>
        <section id="quick-cta" className="scroll-mt-6 bg-white px-5 py-8">
          <div className="mx-auto max-w-7xl rounded-[34px] border border-[var(--public-border)] bg-[linear-gradient(135deg,#FFFFFF_0%,#FFF1F7_52%,#F6F2FF_100%)] p-6 shadow-[0_24px_70px_rgba(216,91,163,0.12)] md:p-8">
            <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--public-accent)]">
                  快速登記
                </p>
                <h2 className="mt-3 text-3xl font-bold leading-tight text-[var(--public-heading)] md:text-4xl">
                  立即登記 $388 首次體驗
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--public-muted)]">
                  填寫簡單資料，Ineffable Beauty 團隊會透過 WhatsApp 跟進確認。
                </p>
              </div>
              <MotionAnchor
                href="#lead-form"
                className="inline-flex justify-center rounded-full bg-[var(--public-cta)] px-8 py-4 text-sm font-bold text-white shadow-[0_20px_46px_rgba(216,91,163,0.28)] transition hover:bg-[var(--public-cta-hover)]"
              >
                立即登記
              </MotionAnchor>
            </div>
          </div>
        </section>
      </MotionReveal>

      <MotionReveal>
        <section id="offer-summary" className="scroll-mt-6 px-5 py-12">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            {offerSummaryImageUrl && (
              <img
                src={offerSummaryImageUrl}
                alt={`${selectedPackage.name} offer visual`}
                className="min-h-[320px] w-full rounded-[36px] border border-[var(--public-border)] bg-white object-contain p-3 shadow-[0_24px_70px_rgba(216,91,163,0.12)]"
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
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
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
          <section className="px-5 py-12">
            <div className="mx-auto grid max-w-7xl gap-8">
              {contentSections.map((section) => (
                <ContentSectionBlock key={section.id} section={section} />
              ))}
            </div>
          </section>
        </MotionReveal>
      )}

      <MotionReveal>
        <section id="lead-form" className="scroll-mt-6 bg-[#FFF1F7] px-5 py-12">
          <div
            className={`mx-auto grid max-w-7xl gap-8 ${
              formSideImageUrl ? "lg:grid-cols-[0.92fr_1.08fr]" : ""
            }`}
          >
            {formSideImageUrl && (
              <div>
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
                  className="mt-6 min-h-[340px] w-full rounded-[34px] border border-[var(--public-border)] bg-white object-contain p-3 shadow-[0_24px_70px_rgba(216,91,163,0.12)]"
                />
              </div>
            )}
            <div>
              {!formSideImageUrl && (
                <div className="mb-6">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--public-accent)]">
                    預約表格
                  </p>
                  <h2 className="mt-3 text-4xl font-bold leading-tight text-[var(--public-heading)]">
                    立即預約 $388 優惠
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-[var(--public-muted)]">
                    填寫資料後，Ineffable Beauty 團隊會透過 WhatsApp 跟進確認。
                  </p>
                </div>
              )}
              <PublicLeadForm
                formToken={connectedForm.publicFormToken}
                formId={connectedForm.id}
                brandSlug={isIneffable ? "ineffable" : publicBrand.slug}
              />
            </div>
          </div>
        </section>
      </MotionReveal>

      <PublicLegalFooter
        footerText={getLegalFooterText(legalProfile)}
        privacyPolicyUrl={legalProfile.privacyPolicyUrl}
        termsUrl={legalProfile.termsUrl}
        disclaimerUrl={legalProfile.disclaimerUrl}
      />
    </main>
  );
}

function PublicMetaPixel({ pixelId }: { pixelId: string | null }) {
  if (!pixelId) return null;

  return (
    <>
      <Script
        id="meta-pixel-pageview"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId}');
fbq('track', 'PageView');
          `.trim(),
        }}
      />
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
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
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--public-accent)]">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-bold leading-tight text-[var(--public-heading)] md:text-4xl">
        {title}
      </h2>
      {body && (
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--public-muted)]">
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
      <section id={sectionId} className="scroll-mt-6 rounded-[34px] border border-[var(--public-border)] bg-white p-7 shadow-[0_24px_70px_rgba(216,91,163,0.1)]">
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
      <section id={sectionId} className="scroll-mt-6 rounded-[34px] border border-[var(--public-border)] bg-white p-5 shadow-[0_24px_70px_rgba(216,91,163,0.1)] md:p-7">
        <div className="grid gap-7 lg:grid-cols-2 lg:items-center">
          {firstItem?.imageUrl && (
            <img
              src={firstItem.imageUrl}
              alt={firstItem.title || section.title}
              className="min-h-[320px] w-full rounded-[28px] border border-[var(--public-border)] bg-[#FFF8FC] object-contain p-3"
            />
          )}
          <div className={firstItem?.imageUrl ? "" : "lg:col-span-2"}>
            <SectionHeading
              eyebrow={section.label || "內容"}
              title={section.title || firstItem?.title || ""}
              body={section.subtitle || firstItem?.body || ""}
            />
            {firstItem && (firstItem.title || firstItem.body) && section.title && (
              <div className="mt-5 rounded-[24px] bg-[#FFF8FC] p-5">
                {firstItem.title && (
                  <h3 className="text-xl font-bold text-[var(--public-heading)]">
                    {firstItem.title}
                  </h3>
                )}
                {firstItem.body && (
                  <p className="mt-3 text-sm leading-7 text-[var(--public-muted)]">
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
      <section id={sectionId} className="scroll-mt-6 rounded-[34px] border border-[var(--public-border)] bg-white p-7 shadow-[0_24px_70px_rgba(216,91,163,0.1)]">
        <SectionHeading
          eyebrow={section.label || "FAQ"}
          title={section.title}
          body={section.subtitle}
        />
        <div className="mt-7 grid gap-4">
          {items.map((item, index) => (
            <article
              key={`${section.id}-${index}`}
              className="rounded-[26px] border border-[var(--public-border)] bg-[#FFF8FC] p-6"
            >
              <h3 className="text-lg font-bold text-[var(--public-heading)]">
                {item.title || `問題 ${index + 1}`}
              </h3>
              {item.body && (
                <p className="mt-3 text-sm leading-7 text-[var(--public-muted)]">
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
    <section id={sectionId} className="scroll-mt-6 rounded-[34px] border border-[var(--public-border)] bg-white p-7 shadow-[0_24px_70px_rgba(216,91,163,0.1)]">
      <SectionHeading
        eyebrow={section.label || "內容"}
        title={section.title}
        body={section.subtitle}
      />
      <div className={`mt-7 grid gap-5 ${gridClass}`}>
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
  privacyPolicyUrl,
  termsUrl,
  disclaimerUrl,
}: {
  footerText: string;
  privacyPolicyUrl: string;
  termsUrl: string;
  disclaimerUrl: string;
}) {
  return (
    <footer id="legal-footer" className="scroll-mt-6 border-t border-[var(--public-border)] bg-white px-5 py-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 text-xs font-semibold leading-5 text-[var(--public-muted)] md:flex-row md:items-center md:justify-between">
        <div className="grid gap-1">
          <p>{footerText}</p>
          <p>{IMAGE_REFERENCE_FOOTER_NOTE}</p>
        </div>
        <nav className="flex flex-wrap gap-x-4 gap-y-2">
          <a className="underline underline-offset-4" href={privacyPolicyUrl}>
            私隱政策
          </a>
          <a className="underline underline-offset-4" href={termsUrl}>
            條款及細則
          </a>
          <a className="underline underline-offset-4" href={disclaimerUrl}>
            免責聲明
          </a>
          <a className="underline underline-offset-4" href="#lead-form">
            預約表格
          </a>
        </nav>
      </div>
    </footer>
  );
}
