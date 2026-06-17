import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { MotionAnchor, MotionReveal } from "@/components/alyssa/MotionReveal";
import { PublicLeadForm } from "@/components/alyssa/PublicLeadForm";
import {
  publicThemeStyle,
  resolvePublicBrandTheme,
} from "@/lib/brandThemes";
import { getConfigurationData } from "@/lib/data/configuration";
import { getLandingPageContext } from "@/lib/data/landingPages";
import { getPublishedLandingPageBySlug } from "@/lib/data/landingPageStore";
import {
  getBrandLegalProfile,
  getLegalFooterText,
} from "@/lib/legal/consent";

export const dynamic = "force-dynamic";

const ineffableAssets = {
  logo: "/ineffable-wix/assets/logo.png",
  hero: "/ineffable-wix/assets/hero-model.png",
  card388: "/ineffable-wix/assets/card-388.png",
  card588: "/ineffable-wix/assets/card-588.png",
  card780: "/ineffable-wix/assets/card-780.png",
};

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
  const isIneffable = theme.key === "ineffable";
  const brandDisplayName = isIneffable ? "Ineffable Beauty" : publicBrand.name;
  const promoPrice = Number(selectedPackage.promoPrice ?? 0);
  const price = promoPrice > 0 ? `HK$${promoPrice}` : "預約查詢";
  const heroTitle =
    page.heroTitle || (isIneffable ? "$388 針清舒緩護理" : page.title);
  const heroSubtitle =
    page.heroSubtitle ||
    "針對粉刺、閉口、毛孔堵塞及暗粒問題，配合舒緩護理，適合首次體驗及想改善膚況的客人。";
  const offerBadge = page.offerBadge || `${price} 首次體驗`;
  const ctaText = page.ctaText || "立即預約體驗";
  const secondaryCtaText = page.secondaryCtaText || "查看療程重點";
  const legalProfile = getBrandLegalProfile({
    brandSlug: publicBrand.slug,
    brandName: brandDisplayName,
  });

  return (
    <main
      className="min-h-screen overflow-hidden bg-[var(--public-bg)] text-[var(--public-text)]"
      style={themeStyle}
    >
      <section className="relative bg-[radial-gradient(circle_at_18%_10%,#FFF1F7_0,#FFF8FC_34%,#F6F2FF_100%)] px-5 pb-14 pt-8">
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
                  亮澤肌膚 · 溫和舒緩 · 清晰預約
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
                href="#treatment-value"
                className="rounded-full border border-[var(--public-border)] bg-white/80 px-7 py-3.5 text-sm font-bold text-[var(--public-accent)] transition hover:bg-white"
              >
                {secondaryCtaText}
              </MotionAnchor>
            </div>

            <div className="mt-9 grid max-w-3xl gap-3 sm:grid-cols-3">
              {["清理粉刺閉口", "舒緩泛紅不適", "改善毛孔堵塞"].map((item) => (
                <p
                  key={item}
                  className="rounded-3xl border border-[var(--public-border)] bg-white/80 px-4 py-4 text-sm font-bold text-[var(--public-heading)] shadow-sm"
                >
                  {item}
                </p>
              ))}
            </div>
          </MotionReveal>

          <MotionReveal delay={0.1}>
            <div className="relative">
              <div className="absolute -left-6 top-8 h-40 w-40 rounded-full bg-[#FFF1F7] blur-2xl" />
              <div className="absolute -right-4 bottom-8 h-48 w-48 rounded-full bg-[#EDE7FF] blur-2xl" />
              <img
                src={isIneffable ? ineffableAssets.hero : page.heroImageUrl || ineffableAssets.hero}
                alt={`${brandDisplayName} campaign visual`}
                className="relative z-10 min-h-[520px] w-full rounded-[44px] border border-white object-cover object-center shadow-[0_34px_90px_rgba(216,91,163,0.2)]"
              />
            </div>
          </MotionReveal>
        </div>
      </section>

      {isIneffable && (
        <MotionReveal>
          <section className="mx-auto max-w-7xl px-5 py-12">
            <SectionHeading
              eyebrow="Offer Menu"
              title="Ineffable Beauty 熱門體驗"
              body="目前頁面主推 $388 針清舒緩護理；其他療程卡可作日後 campaign 延伸。"
            />
            <div className="mt-7 grid gap-5 lg:grid-cols-3">
              <OfferCard
                imageUrl={ineffableAssets.card388}
                badge="主打優惠"
                title="$388 針清舒緩護理"
                body="針對粉刺、閉口及毛孔堵塞，適合首次體驗。"
                active
              />
              <OfferCard
                imageUrl={ineffableAssets.card588}
                badge="進階護理"
                title="$588 DEP 補濕 + Nano Peel"
                body="適合想同時提升細緻度及水潤感的客人。"
              />
              <OfferCard
                imageUrl={ineffableAssets.card780}
                badge="緊緻體驗"
                title="$780 BTL Exion 眼周護理"
                body="適合關注眼周細紋、膚質及輪廓感的客人。"
              />
            </div>
          </section>
        </MotionReveal>
      )}

      <MotionReveal>
        <section className="bg-white px-5 py-12">
          <div className="mx-auto max-w-7xl">
            <SectionHeading
              eyebrow="Skin Concerns"
              title="適合有以下肌膚困擾的你"
              body="公開頁只保留客人需要理解的療程價值，不顯示內部系統或追蹤說明。"
            />
            <div className="mt-7 grid gap-4 md:grid-cols-3">
              {[
                "粉刺、閉口、黑頭容易反覆出現",
                "清潔後仍覺得毛孔堵塞，膚質不夠細緻",
                "想改善暗粒、粗糙感，同時避免過度刺激",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-[28px] border border-[var(--public-border)] bg-[#FFF8FC] p-6 text-lg font-bold leading-8 text-[var(--public-heading)]"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>
      </MotionReveal>

      <MotionReveal>
        <section id="treatment-value" className="px-5 py-12">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.92fr_1.08fr]">
            <div>
              <SectionHeading
                eyebrow="Treatment Value"
                title={`${price} ${selectedPackage.name}`}
                body={page.offerBody || "由團隊按你的膚況及預約資料跟進，確認療程、分店及時間安排。"}
              />
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <InfoCard label="品牌" value={brandDisplayName} />
                <InfoCard label="療程" value={selectedTreatment.name} />
                <InfoCard label="套餐" value={selectedPackage.name} />
                <InfoCard label="分店" value={selectedBranch.name} />
              </div>
            </div>
            <div className="grid gap-4">
              {[
                "深層清潔毛孔，處理粉刺及閉口位置",
                "舒緩清理後的不適及泛紅感",
                "改善粗糙觸感，令膚況更乾淨透亮",
                "適合首次體驗，預約前清楚知道價錢及安排",
                "由團隊跟進預約，減少來回溝通時間",
              ].map((item) => (
                <p
                  key={item}
                  className="rounded-[24px] border border-[var(--public-border)] bg-white px-5 py-4 text-sm font-bold leading-6 text-[var(--public-heading)] shadow-sm"
                >
                  {item}
                </p>
              ))}
            </div>
          </div>
        </section>
      </MotionReveal>

      <MotionReveal>
        <section className="bg-[#F6F2FF] px-5 py-12">
          <div className="mx-auto max-w-7xl">
            <SectionHeading
              eyebrow="Booking Flow"
              title="三步完成預約"
              body="提交資料後，團隊會按你選擇的療程、套餐及分店跟進。"
            />
            <div className="mt-7 grid gap-5 md:grid-cols-3">
              {[
                ["1", "填寫預約資料", "留下姓名、電話、心水日期及時間。"],
                ["2", "團隊跟進確認", "透過 WhatsApp 確認分店及療程安排。"],
                ["3", "到店體驗護理", "按確認時間到店，進行療程體驗。"],
              ].map(([step, title, body]) => (
                <article
                  key={step}
                  className="rounded-[30px] bg-white p-6 shadow-[0_20px_55px_rgba(141,123,232,0.16)]"
                >
                  <p className="grid h-11 w-11 place-items-center rounded-full bg-[var(--public-cta)] text-sm font-bold text-white">
                    {step}
                  </p>
                  <h3 className="mt-5 text-xl font-bold text-[var(--public-heading)]">
                    {title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-[var(--public-muted)]">
                    {body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </MotionReveal>

      <MotionReveal>
        <section className="px-5 py-12">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.8fr_1.2fr]">
            <SectionHeading
              eyebrow="Trust"
              title="清楚、專業、以客人感受為先"
              body="療程效果及適合程度會因個人膚況而異；團隊會按實際情況提供建議。"
            />
            <div className="grid gap-4 sm:grid-cols-3">
              {["專業療程環境", "清楚價錢安排", "WhatsApp 跟進預約"].map(
                (item) => (
                  <p
                    key={item}
                    className="rounded-[26px] border border-[var(--public-border)] bg-white px-5 py-6 text-center text-sm font-bold text-[var(--public-heading)]"
                  >
                    {item}
                  </p>
                )
              )}
            </div>
          </div>
        </section>
      </MotionReveal>

      <MotionReveal>
        <section id="lead-form" className="bg-[#FFF1F7] px-5 py-12">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.82fr_1.18fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--public-accent)]">
                Book Now
              </p>
              <h2 className="mt-3 text-4xl font-bold leading-tight text-[var(--public-heading)]">
                {ctaText}
              </h2>
              <p className="mt-4 text-sm leading-7 text-[var(--public-muted)]">
                填寫後，團隊會按你的療程、分店及心水時間跟進預約安排。
              </p>
            </div>
            <PublicLeadForm
              formToken={connectedForm.publicFormToken}
              formId={connectedForm.id}
              brandSlug={publicBrand.slug}
            />
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
      <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--public-muted)]">
        {body}
      </p>
    </div>
  );
}

function OfferCard({
  imageUrl,
  badge,
  title,
  body,
  active = false,
}: {
  imageUrl: string;
  badge: string;
  title: string;
  body: string;
  active?: boolean;
}) {
  return (
    <article
      className={`overflow-hidden rounded-[32px] border bg-white shadow-[0_24px_70px_rgba(216,91,163,0.12)] ${
        active ? "border-[var(--public-cta)]" : "border-[var(--public-border)]"
      }`}
    >
      <img src={imageUrl} alt={title} className="aspect-[4/3] w-full object-cover" />
      <div className="p-5">
        <p className="w-fit rounded-full bg-[#FFF1F7] px-3 py-1 text-xs font-bold text-[var(--public-accent)]">
          {badge}
        </p>
        <h3 className="mt-4 text-xl font-bold text-[var(--public-heading)]">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-6 text-[var(--public-muted)]">{body}</p>
      </div>
    </article>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-[var(--public-border)] bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--public-accent)]">
        {label}
      </p>
      <p className="mt-2 text-sm font-bold text-[var(--public-heading)]">{value}</p>
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
    <footer className="border-t border-[var(--public-border)] bg-white px-5 py-6">
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
          <a className="underline underline-offset-4" href="#lead-form">
            預約 / 查詢
          </a>
        </nav>
      </div>
    </footer>
  );
}
