import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Script from "next/script";
import { MotionAnchor, MotionReveal } from "@/components/alyssa/MotionReveal";
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
      page.heroSubtitle ||
      page.offerBody ||
      "適合用作廣告測試及預約收集，系統會同時記錄來源資料，方便之後跟進成效。",
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

  if (page.formId && !connectedForm) {
    notFound();
  }

  const embedScriptUrl = getEmbedScriptUrl();
  const selectedPackage = context.package;
  const price = selectedPackage ? `HK$${selectedPackage.promoPrice}` : "未設定";
  const heroImageUrl = page.heroImageUrl || page.mobileHeroImageUrl;
  const legalProfile = getBrandLegalProfile({
    brandSlug: context.brand?.slug,
    brandName: context.brand?.name,
  });

  return (
    <main className="min-h-screen bg-[#fff9f3] text-[#321428]">
      <section
        className="relative flex min-h-[86vh] items-end overflow-hidden bg-[#321428] px-5 pb-12 pt-24 text-white md:min-h-[760px] md:pb-16"
        style={
          heroImageUrl
            ? {
                backgroundImage: `linear-gradient(90deg, rgba(50,20,40,0.88), rgba(90,35,72,0.56), rgba(50,20,40,0.2)), url(${heroImageUrl})`,
                backgroundPosition: "center",
                backgroundSize: "cover",
              }
            : undefined
        }
        aria-label="醫學美容 Campaign Landing Page"
      >
        <MotionReveal className="mx-auto w-full max-w-7xl">
          <MotionReveal delay={0.03}>
            <p className="w-fit rounded-full border border-white/35 bg-white/12 px-4 py-2 text-sm font-bold backdrop-blur">
              {page.offerBadge}
            </p>
          </MotionReveal>
          <MotionReveal delay={0.1}>
            <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
              {page.heroTitle}
            </h1>
          </MotionReveal>
          <MotionReveal delay={0.17}>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/86 md:text-lg">
              {page.heroSubtitle}
            </p>
          </MotionReveal>
          <MotionReveal delay={0.24}>
            <div className="mt-8 flex flex-wrap gap-3">
              <MotionAnchor
                href="#alyssa-lp-form"
                className="rounded-full bg-white px-6 py-3 text-sm font-bold text-[#5a2348] shadow-[0_16px_40px_rgba(255,255,255,0.18)] transition hover:bg-[#fff6f0] hover:shadow-[0_22px_55px_rgba(255,255,255,0.24)]"
              >
                {page.ctaText}
              </MotionAnchor>
              <MotionAnchor
                href="#treatment-summary"
                className="rounded-full border border-white/55 bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/18"
              >
                {page.secondaryCtaText}
              </MotionAnchor>
            </div>
          </MotionReveal>
          <MotionReveal delay={0.31}>
            <div className="mt-10 grid max-w-4xl gap-3 sm:grid-cols-3">
              <HeroMetric label="品牌" value={context.brand?.name ?? "Alyssa"} />
              <HeroMetric label="療程" value={context.treatment?.name ?? "未設定"} />
              <HeroMetric label="體驗價" value={price} />
            </div>
          </MotionReveal>
        </MotionReveal>
      </section>

      <MotionReveal>
        <section
          id="treatment-summary"
          className="mx-auto grid max-w-7xl gap-5 px-5 py-10 lg:grid-cols-[0.95fr_1.05fr]"
        >
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
              優惠摘要
            </p>
            <h2 className="mt-2 text-3xl font-bold text-[#321428]">
              {page.offerHeadline}
            </h2>
            <p className="mt-4 text-sm leading-7 text-[#6d4a5c]">
              {page.offerBody}
            </p>
            <div className="mt-6">
              <ImagePanel
                imageUrl={page.offerImageUrl}
                label="優惠圖片"
                title="體驗優惠重點"
                body="建議使用療程房、儀器細節或高質感醫美視覺，突出今次體驗價值。"
                ratioClass="aspect-[4/3]"
              />
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <InfoCard label="療程" value={context.treatment?.name ?? "未設定"} />
              <InfoCard label="套餐" value={selectedPackage?.name ?? "未設定"} />
              <InfoCard label="分店" value={context.branch?.name ?? "可選分店"} />
              <InfoCard label="付款方式" value="可先預約，稍後由團隊跟進付款安排" />
            </div>
          </div>
          <div className="grid gap-3">
            <ImagePanel
              imageUrl={page.treatmentImageUrl}
              label="療程圖片"
              title={context.treatment?.name ?? "療程體驗"}
              body="可放療程、膚質分析、儀器或診所環境圖片，建立信任感和療程期待。"
              ratioClass="aspect-[4/3]"
            />
            {page.painPoints.map((item) => (
              <div
                key={item}
                className="rounded-[20px] border border-[#ead9cf] bg-white/86 p-5 shadow-sm"
              >
                <p className="text-sm font-semibold leading-6 text-[#5a2348]">
                  {item}
                </p>
              </div>
            ))}
          </div>
        </section>
      </MotionReveal>

      <MotionReveal>
        <section className="border-y border-[#ead9cf] bg-white/70">
          <div className="mx-auto grid max-w-7xl gap-5 px-5 py-10 md:grid-cols-3">
            {page.benefits.map((item) => (
              <div key={item}>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
                  賣點
                </p>
                <p className="mt-2 text-lg font-bold leading-7 text-[#321428]">
                  {item}
                </p>
              </div>
            ))}
          </div>
        </section>
      </MotionReveal>

      <MotionReveal className="mx-auto grid max-w-7xl gap-6 px-5 py-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
            為何選擇這個體驗
          </p>
          <h2 className="mt-2 text-3xl font-bold text-[#321428]">
            清楚介紹療程、優惠和預約安排
          </h2>
          <p className="mt-4 text-sm leading-7 text-[#6d4a5c]">
            適合用作廣告測試及預約收集，系統會同時記錄來源資料，方便之後跟進成效。
          </p>
        </div>
        <div className="grid gap-3">
          {page.sections.map((section) => (
            <article key={section.title} className="rounded-[20px] bg-[#fff6f0] p-5">
              <h3 className="text-lg font-bold text-[#321428]">{section.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">
                {section.body}
              </p>
            </article>
          ))}
        </div>
      </MotionReveal>

      <MotionReveal>
        <section className="bg-[#321428] px-5 py-10 text-white">
          <div className="mx-auto max-w-7xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/62">
              預約流程
            </p>
            <h2 className="mt-2 text-3xl font-bold">由了解療程到預約跟進</h2>
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

      <MotionReveal className="mx-auto grid max-w-7xl gap-6 px-5 py-10 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
            信心保證
          </p>
          <h2 className="mt-2 text-3xl font-bold text-[#321428]">
            讓客人預約前有清楚資訊
          </h2>
          <div className="mt-6">
            <ImagePanel
              imageUrl={page.trustImageUrl}
              label="診所環境"
              title="乾淨、專業、可信任的環境"
              body="建議使用診所、接待區或專業諮詢圖片，提升預約信心。"
              ratioClass="aspect-video"
            />
          </div>
        </div>
        <div className="grid gap-3">
          {page.trustItems.map((item) => (
            <p
              key={item}
              className="rounded-[20px] border border-[#ead9cf] bg-white/86 px-5 py-4 text-sm font-semibold leading-6 text-[#5a2348] shadow-sm"
            >
              {item}
            </p>
          ))}
        </div>
      </MotionReveal>

      <MotionReveal>
        <section id="alyssa-lp-form" className="bg-[#fff6f0] px-5 py-10">
          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.82fr_1.18fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
                預約表格
              </p>
              <h2 className="mt-2 text-3xl font-bold text-[#321428]">
                {page.ctaText}
              </h2>
              <p className="mt-4 text-sm leading-7 text-[#6d4a5c]">
                填寫資料後，團隊可按你選擇的療程、套餐及分店安排跟進。若你由廣告或社交平台進入，系統會保留來源資料，方便之後分析 Campaign 成效。
              </p>
            </div>
            <div className="rounded-[28px] border border-[#ead9cf] bg-white p-4 shadow-[0_24px_70px_rgba(90,35,72,0.14)]">
              <div id="alyssa-lp-form-target" />
              <Script
                src={embedScriptUrl}
                strategy="afterInteractive"
                data-form-token={connectedForm?.publicFormToken ?? page.formToken}
                data-brand={context.brand?.slug ?? "alyssa"}
                data-form-id={connectedForm?.id ?? page.formId}
                data-target-id="alyssa-lp-form-target"
                data-height="900"
              />
            </div>
          </div>
        </section>
      </MotionReveal>

      <MotionReveal className="mx-auto max-w-4xl px-5 py-10">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
          常見問題
        </p>
        <h2 className="mt-2 text-3xl font-bold text-[#321428]">預約前想知道</h2>
        <div className="mt-6 divide-y divide-[#ead9cf] rounded-[24px] border border-[#ead9cf] bg-white/86">
          {page.faqs.map((item) => (
            <details key={item.question} className="group p-5">
              <summary className="cursor-pointer list-none text-base font-bold text-[#321428]">
                {item.question}
              </summary>
              <p className="mt-3 text-sm leading-6 text-[#6d4a5c]">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
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
    <footer className="border-t border-[#ead9cf] bg-white/74 px-5 py-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 text-xs font-semibold leading-5 text-[#7b5a6a] md:flex-row md:items-center md:justify-between">
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
            聯絡 / 預約
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
    <div className="rounded-[20px] border border-[#ead9cf] bg-white/86 p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {label}
      </p>
      <p className="mt-2 text-sm font-bold text-[#5a2348]">{value}</p>
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
      className={`flex ${ratioClass} min-h-64 items-end overflow-hidden rounded-[24px] border border-[#ead9cf] bg-[#321428] p-5 text-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_55px_rgba(90,35,72,0.16)]`}
      style={
        hasImage
          ? {
              backgroundImage: `linear-gradient(180deg, rgba(50,20,40,0.08), rgba(50,20,40,0.78)), url(${imageUrl})`,
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
