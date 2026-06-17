import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Script from "next/script";
import type { CSSProperties } from "react";
import { MotionAnchor, MotionReveal } from "@/components/alyssa/MotionReveal";
import {
  publicThemeStyle,
  resolvePublicBrandTheme,
} from "@/lib/brandThemes";
import { getEmbedScriptUrl } from "@/lib/data/appUrl";
import { getConfigurationData } from "@/lib/data/configuration";
import { getLandingPageContext } from "@/lib/data/landingPages";
import { getPublishedLandingPageBySlug } from "@/lib/data/landingPageStore";
import {
  getBrandLegalProfile,
  getLegalFooterText,
} from "@/lib/legal/consent";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublishedLandingPageBySlug(slug);

  if (!page) {
    return {
      title: "Campaign 頁面暫時未能開啟",
      description: "這個 Campaign 頁面目前未能開啟，請確認最新連結。",
    };
  }

  return {
    title: page.title,
    description:
      page.heroSubtitle || page.offerBody || `${page.title} - 預約療程體驗。`,
  };
}

export default async function PublicLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [page, config] = await Promise.all([
    getPublishedLandingPageBySlug(slug),
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

  const theme = resolvePublicBrandTheme({
    brandSlug: publicBrand.slug,
    brandName: publicBrand.name,
  });
  const themeStyle = publicThemeStyle(theme) as CSSProperties;
  const brandDisplayName = publicBrand.name || theme.brandName;
  const brandSlug = publicBrand.slug || theme.key;
  const embedScriptUrl = getEmbedScriptUrl();
  const price = `HK$${selectedPackage.promoPrice}`;
  const heroImageUrl = page.heroImageUrl || page.mobileHeroImageUrl;
  const hasOfferContent =
    Boolean(page.offerHeadline || page.offerBody || page.offerImageUrl) ||
    page.painPoints.length > 0;
  const hasSections = page.sections.length > 0;
  const hasBenefits = page.benefits.length > 0;
  const hasProcess = page.processSteps.length > 0;
  const hasTrust = page.trustItems.length > 0 || Boolean(page.trustImageUrl);
  const hasFaqs = page.faqs.length > 0;
  const legalProfile = getBrandLegalProfile({
    brandSlug,
    brandName: brandDisplayName,
  });

  return (
    <main
      className="min-h-screen bg-[var(--public-bg)] text-[var(--public-text)]"
      style={themeStyle}
    >
      <section
        className="relative flex min-h-[86vh] items-end overflow-hidden bg-[var(--public-dark)] px-5 pb-12 pt-24 text-white md:min-h-[760px] md:pb-16"
        style={
          heroImageUrl
            ? {
                backgroundImage: `linear-gradient(90deg, color-mix(in srgb, var(--public-dark) 88%, transparent), color-mix(in srgb, var(--public-cta) 54%, transparent), color-mix(in srgb, var(--public-dark) 18%, transparent)), url(${heroImageUrl})`,
                backgroundPosition: "center",
                backgroundSize: "cover",
              }
            : undefined
        }
        aria-label="醫學美容 Campaign Landing Page"
      >
        <MotionReveal className="mx-auto w-full max-w-7xl">
          {page.offerBadge && (
            <MotionReveal delay={0.03}>
              <p className="w-fit rounded-full border border-white/35 bg-white/12 px-4 py-2 text-sm font-bold backdrop-blur">
                {page.offerBadge}
              </p>
            </MotionReveal>
          )}
          <MotionReveal delay={0.1}>
            <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
              {page.heroTitle}
            </h1>
          </MotionReveal>
          {page.heroSubtitle && (
            <MotionReveal delay={0.17}>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/86 md:text-lg">
                {page.heroSubtitle}
              </p>
            </MotionReveal>
          )}
          <MotionReveal delay={0.24}>
            <div className="mt-8 flex flex-wrap gap-3">
              <MotionAnchor
                href="#alyssa-lp-form"
                className="rounded-full bg-[var(--public-cta)] px-6 py-3 text-sm font-bold text-[var(--public-cta-text)] shadow-[0_16px_40px_rgba(0,0,0,0.18)] transition hover:bg-[var(--public-cta-hover)] hover:shadow-[0_22px_55px_rgba(0,0,0,0.22)]"
              >
                {page.ctaText}
              </MotionAnchor>
              {page.secondaryCtaText && (
                <MotionAnchor
                  href="#treatment-summary"
                  className="rounded-full border border-white/55 bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/18"
                >
                  {page.secondaryCtaText}
                </MotionAnchor>
              )}
            </div>
          </MotionReveal>
          <MotionReveal delay={0.31}>
            <div className="mt-10 grid max-w-4xl gap-3 sm:grid-cols-3">
              <HeroMetric label="品牌" value={brandDisplayName} />
              <HeroMetric label="療程" value={selectedTreatment.name} />
              <HeroMetric label="體驗價" value={price} />
            </div>
          </MotionReveal>
        </MotionReveal>
      </section>

      {hasOfferContent && (
        <MotionReveal>
          <section
            id="treatment-summary"
            className="mx-auto grid max-w-7xl gap-5 px-5 py-10 lg:grid-cols-[0.95fr_1.05fr]"
          >
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--public-accent)]">
                優惠摘要
              </p>
              {page.offerHeadline && (
                <h2 className="mt-2 text-3xl font-bold text-[var(--public-heading)]">
                  {page.offerHeadline}
                </h2>
              )}
              {page.offerBody && (
                <p className="mt-4 text-sm leading-7 text-[var(--public-muted)]">
                  {page.offerBody}
                </p>
              )}
              <div className="mt-6">
                <ImagePanel
                  imageUrl={page.offerImageUrl}
                  label="優惠圖片"
                  title="療程體驗重點"
                  body="可放置療程室、儀器細節、服務體驗或優惠主視覺，幫助客人理解體驗價值。"
                  ratioClass="aspect-[4/3]"
                />
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <InfoCard label="療程" value={selectedTreatment.name} />
                <InfoCard label="套餐" value={selectedPackage.name} />
                <InfoCard label="分店" value={selectedBranch.name} />
                <InfoCard label="付款方式" value="先預約，再由團隊確認安排" />
              </div>
            </div>
            <div className="grid gap-3">
              <ImagePanel
                imageUrl={page.treatmentImageUrl}
                label="療程圖片"
                title={selectedTreatment.name}
                body="可展示療程、產品、儀器或體驗環境，保持高級、乾淨、可信賴的視覺感。"
                ratioClass="aspect-[4/3]"
              />
              {page.painPoints.map((item) => (
                <div
                  key={item}
                  className="rounded-[20px] border border-[var(--public-border)] bg-[var(--public-card)] p-5 shadow-sm"
                >
                  <p className="text-sm font-semibold leading-6 text-[var(--public-cta)]">
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </MotionReveal>
      )}

      {hasBenefits && (
        <MotionReveal>
          <section className="border-y border-[var(--public-border)] bg-[var(--public-card)]">
            <div className="mx-auto grid max-w-7xl gap-5 px-5 py-10 md:grid-cols-3">
              {page.benefits.map((item) => (
                <div key={item}>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--public-accent)]">
                    賣點
                  </p>
                  <p className="mt-2 text-lg font-bold leading-7 text-[var(--public-heading)]">
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </MotionReveal>
      )}

      {hasSections && (
        <MotionReveal className="mx-auto grid max-w-7xl gap-6 px-5 py-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--public-accent)]">
              為何選擇這個體驗
            </p>
            <h2 className="mt-2 text-3xl font-bold text-[var(--public-heading)]">
              清楚了解療程、優惠及預約安排
            </h2>
          </div>
          <div className="grid gap-3">
            {page.sections.map((section) => (
              <article
                key={section.title}
                className="rounded-[20px] bg-[var(--public-soft-bg)] p-5"
              >
                <h3 className="text-lg font-bold text-[var(--public-heading)]">
                  {section.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--public-muted)]">
                  {section.body}
                </p>
              </article>
            ))}
          </div>
        </MotionReveal>
      )}

      {hasProcess && (
        <MotionReveal>
          <section className="bg-[var(--public-dark)] px-5 py-10 text-white">
            <div className="mx-auto max-w-7xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/62">
                預約流程
              </p>
              <h2 className="mt-2 text-3xl font-bold">
                由登記到確認安排，流程清晰簡單
              </h2>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {page.processSteps.map((step, index) => (
                  <article
                    key={step.title}
                    className="rounded-[20px] border border-white/14 bg-white/8 p-5"
                  >
                    <ProcessImage
                      imageUrl={
                        [
                          page.processImage1Url,
                          page.processImage2Url,
                          page.processImage3Url,
                        ][index] ?? ""
                      }
                      label={`步驟 ${index + 1}`}
                    />
                    <h3 className="text-lg font-bold">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-white/72">
                      {step.body}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </MotionReveal>
      )}

      {hasTrust && (
        <MotionReveal className="mx-auto grid max-w-7xl gap-6 px-5 py-10 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--public-accent)]">
              信任與環境
            </p>
            <h2 className="mt-2 text-3xl font-bold text-[var(--public-heading)]">
              專業、乾淨、安心的體驗環境
            </h2>
            <div className="mt-6">
              <ImagePanel
                imageUrl={page.trustImageUrl}
                label="診所 / 環境圖片"
                title="專業環境與服務信任"
                body="可展示診所環境、接待區、療程房或專業團隊視覺，提升預約信心。"
                ratioClass="aspect-video"
              />
            </div>
          </div>
          <div className="grid gap-3">
            {page.trustItems.map((item) => (
              <p
                key={item}
                className="rounded-[20px] border border-[var(--public-border)] bg-[var(--public-card)] px-5 py-4 text-sm font-semibold leading-6 text-[var(--public-cta)] shadow-sm"
              >
                {item}
              </p>
            ))}
          </div>
        </MotionReveal>
      )}

      <MotionReveal>
        <section id="alyssa-lp-form" className="bg-[var(--public-soft-bg)] px-5 py-10">
          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.82fr_1.18fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--public-accent)]">
                預約表格
              </p>
              <h2 className="mt-2 text-3xl font-bold text-[var(--public-heading)]">
                {page.ctaText}
              </h2>
              <p className="mt-4 text-sm leading-7 text-[var(--public-muted)]">
                填寫資料後，團隊會按你選擇的療程、套餐及分店安排跟進。
              </p>
            </div>
            <div className="rounded-[28px] border border-[var(--public-border)] bg-[var(--public-card)] p-4 shadow-[0_24px_70px_rgba(58,36,28,0.14)]">
              <div id="alyssa-lp-form-target" />
              <Script
                src={embedScriptUrl}
                strategy="afterInteractive"
                data-form-token={connectedForm.publicFormToken}
                data-brand={brandSlug}
                data-form-id={connectedForm.id}
                data-target-id="alyssa-lp-form-target"
                data-height="900"
              />
            </div>
          </div>
        </section>
      </MotionReveal>

      {hasFaqs && (
        <MotionReveal className="mx-auto max-w-4xl px-5 py-10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--public-accent)]">
            常見問題
          </p>
          <h2 className="mt-2 text-3xl font-bold text-[var(--public-heading)]">
            預約前可以先了解
          </h2>
          <div className="mt-6 divide-y divide-[var(--public-border)] rounded-[24px] border border-[var(--public-border)] bg-[var(--public-card)]">
            {page.faqs.map((item) => (
              <details key={item.question} className="group p-5">
                <summary className="cursor-pointer list-none text-base font-bold text-[var(--public-heading)]">
                  {item.question}
                </summary>
                <p className="mt-3 text-sm leading-6 text-[var(--public-muted)]">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </MotionReveal>
      )}

      <PublicLegalFooter
        footerText={getLegalFooterText(legalProfile)}
        privacyPolicyUrl={legalProfile.privacyPolicyUrl}
        termsUrl={legalProfile.termsUrl}
        disclaimerUrl={legalProfile.disclaimerUrl}
      />
    </main>
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
    <footer className="border-t border-[var(--public-border)] bg-[var(--public-card)] px-5 py-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 text-xs font-semibold leading-5 text-[var(--public-muted)] md:flex-row md:items-center md:justify-between">
        <p>{footerText}</p>
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
          <a className="underline underline-offset-4" href="#alyssa-lp-form">
            預約 / 查詢
          </a>
        </nav>
      </div>
    </footer>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-white/30 pt-3">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/62">
        {label}
      </p>
      <p className="mt-2 text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-[var(--public-border)] bg-[var(--public-card)] p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--public-accent)]">
        {label}
      </p>
      <p className="mt-2 text-sm font-bold text-[var(--public-cta)]">{value}</p>
    </div>
  );
}

function ImagePanel({
  imageUrl,
  label,
  title,
  body,
  ratioClass,
}: {
  imageUrl: string;
  label: string;
  title: string;
  body: string;
  ratioClass: string;
}) {
  const hasImage = Boolean(imageUrl);

  return (
    <div
      className={`flex ${ratioClass} min-h-64 items-end overflow-hidden rounded-[24px] border border-[var(--public-border)] bg-[var(--public-dark)] p-5 text-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_55px_rgba(58,36,28,0.16)]`}
      style={
        hasImage
          ? {
              backgroundImage: `linear-gradient(180deg, color-mix(in srgb, var(--public-dark) 8%, transparent), color-mix(in srgb, var(--public-dark) 78%, transparent)), url(${imageUrl})`,
              backgroundPosition: "center",
              backgroundSize: "cover",
            }
          : undefined
      }
    >
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/66">
          {label}
        </p>
        <h3 className="mt-2 text-xl font-bold">{title}</h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-white/74">{body}</p>
      </div>
    </div>
  );
}

function ProcessImage({ imageUrl, label }: { imageUrl: string; label: string }) {
  const hasImage = Boolean(imageUrl);

  return (
    <div
      className="mb-4 flex aspect-square items-end overflow-hidden rounded-[18px] border border-white/12 bg-white/10 p-4 transition duration-300 hover:-translate-y-1 hover:bg-white/14"
      style={
        hasImage
          ? {
              backgroundImage: `linear-gradient(180deg, rgba(50,20,40,0.04), rgba(50,20,40,0.72)), url(${imageUrl})`,
              backgroundPosition: "center",
              backgroundSize: "cover",
            }
          : undefined
      }
    >
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/70">
        {label}
      </p>
    </div>
  );
}
