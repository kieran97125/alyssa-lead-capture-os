import { notFound } from "next/navigation";
import Script from "next/script";
import { MotionAnchor, MotionReveal } from "@/components/alyssa/MotionReveal";
import { getEmbedScriptUrl } from "@/lib/data/appUrl";
import {
  getLandingPageBySlug,
  getLandingPageContext,
} from "@/lib/data/landingPages";

export default async function PublicLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getLandingPageBySlug(slug);

  if (!page) notFound();

  const context = getLandingPageContext(page);
  const embedScriptUrl = getEmbedScriptUrl();
  const selectedPackage = context.package;
  const price = selectedPackage ? `HK$${selectedPackage.promoPrice}` : "未設定";
  const heroImageUrl = page.heroImageUrl || page.mobileHeroImageUrl;

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
        aria-label="Alyssa medical beauty campaign hero"
      >
        <MotionReveal className="mx-auto w-full max-w-7xl">
          <MotionReveal delay={0.03}>
          <p className="w-fit rounded-full border border-white/35 bg-white/12 px-4 py-2 text-sm font-bold backdrop-blur">
            {page.offerBadge}
          </p>
          </MotionReveal>
          <MotionReveal delay={0.1}>
          <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
            Alyssa {page.heroTitle}
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
            Offer summary
          </p>
          <h2 className="mt-2 text-3xl font-bold text-[#321428]">
            {page.offerHeadline}
          </h2>
          <p className="mt-4 text-sm leading-7 text-[#6d4a5c]">{page.offerBody}</p>
          <div className="mt-6">
            <ImagePanel
              imageUrl={page.offerImageUrl}
              label="Offer visual"
              title="體驗價值與療程感覺"
              body="建議使用 treatment room、device close-up 或 premium wellness visual。"
              ratioClass="aspect-[4/3]"
            />
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <InfoCard label="Treatment" value={context.treatment?.name ?? "未設定"} />
            <InfoCard label="Package" value={selectedPackage?.name ?? "未設定"} />
            <InfoCard label="Branch" value={context.branch?.name ?? "可選分店"} />
            <InfoCard label="Payment" value="可先預約，未啟動付款 flow" />
          </div>
        </div>
        <div className="grid gap-3">
          <ImagePanel
            imageUrl={page.treatmentImageUrl}
            label="Treatment visual"
            title={context.treatment?.name ?? "療程重點"}
            body="用療程、產品或服務 visual 建立 desire 同 treatment value。"
            ratioClass="aspect-[4/3]"
          />
          {page.painPoints.map((item) => (
            <div key={item} className="rounded-[20px] border border-[#ead9cf] bg-white/86 p-5 shadow-sm">
              <p className="text-sm font-semibold leading-6 text-[#5a2348]">{item}</p>
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
                Benefit
              </p>
              <p className="mt-2 text-lg font-bold leading-7 text-[#321428]">{item}</p>
            </div>
          ))}
        </div>
      </section>
      </MotionReveal>

      <MotionReveal className="mx-auto grid max-w-7xl gap-6 px-5 py-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
            Why this campaign
          </p>
          <h2 className="mt-2 text-3xl font-bold text-[#321428]">
            由廣告到預約，一頁完成
          </h2>
          <p className="mt-4 text-sm leading-7 text-[#6d4a5c]">
            Landing page mode 係為快速 market testing 而設。Wix 主網站保持不變；
            呢頁集中講 offer、收集預約，同保存 campaign attribution。
          </p>
        </div>
        <div className="grid gap-3">
          {page.sections.map((section) => (
            <article key={section.title} className="rounded-[20px] bg-[#fff6f0] p-5">
              <h3 className="text-lg font-bold text-[#321428]">{section.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">{section.body}</p>
            </article>
          ))}
        </div>
      </MotionReveal>

      <MotionReveal>
      <section className="bg-[#321428] px-5 py-10 text-white">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/62">
            Process
          </p>
          <h2 className="mt-2 text-3xl font-bold">預約流程簡單清晰</h2>
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
                  label={`Step ${index + 1}`}
                />
                <h3 className="text-lg font-bold">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/72">{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      </MotionReveal>

      <MotionReveal className="mx-auto grid max-w-7xl gap-6 px-5 py-10 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
            Trust
          </p>
          <h2 className="mt-2 text-3xl font-bold text-[#321428]">
            為香港 campaign 同 WhatsApp 跟進而設
          </h2>
          <div className="mt-6">
            <ImagePanel
              imageUrl={page.trustImageUrl}
              label="Clinic / trust visual"
              title="乾淨專業的環境感"
              body="建議使用 clean clinic、reception 或 professional consultation visual。"
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
              Booking form
            </p>
            <h2 className="mt-2 text-3xl font-bold text-[#321428]">
              {page.ctaText}
            </h2>
            <p className="mt-4 text-sm leading-7 text-[#6d4a5c]">
              提交後，團隊會按你選擇的療程、套餐、分店同時段以 WhatsApp 跟進。
              表格會同時保留本頁 URL 上的 UTM / click ID，方便日後分析來源成效。
            </p>
          </div>
          <div className="rounded-[28px] border border-[#ead9cf] bg-white p-4 shadow-[0_24px_70px_rgba(90,35,72,0.14)]">
            <div id="alyssa-lp-form-target" />
            <Script
              src={embedScriptUrl}
              strategy="afterInteractive"
              data-form-token={page.formToken}
              data-brand={context.brand?.slug ?? "alyssa"}
              data-form-id={page.formId}
              data-target-id="alyssa-lp-form-target"
              data-height="900"
            />
          </div>
        </div>
      </section>
      </MotionReveal>

      <MotionReveal className="mx-auto max-w-4xl px-5 py-10">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
          FAQ
        </p>
        <h2 className="mt-2 text-3xl font-bold text-[#321428]">常見問題</h2>
        <div className="mt-6 divide-y divide-[#ead9cf] rounded-[24px] border border-[#ead9cf] bg-white/86">
          {page.faqs.map((item) => (
            <details key={item.question} className="group p-5">
              <summary className="cursor-pointer list-none text-base font-bold text-[#321428]">
                {item.question}
              </summary>
              <p className="mt-3 text-sm leading-6 text-[#6d4a5c]">{item.answer}</p>
            </details>
          ))}
        </div>
      </MotionReveal>
    </main>
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
          {hasImage ? label : `${label} placeholder`}
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
        {hasImage ? label : `${label} visual placeholder`}
      </p>
    </div>
  );
}
