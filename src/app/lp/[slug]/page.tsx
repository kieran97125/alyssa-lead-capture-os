import { notFound } from "next/navigation";
import Script from "next/script";
import { alyssaBrand, alyssaPackages, alyssaTreatments } from "@/lib/data/alyssaConfig";
import { getEmbedScriptUrl } from "@/lib/data/appUrl";
import { getLandingPageBySlug } from "@/lib/data/landingPages";

export default async function PublicLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getLandingPageBySlug(slug);

  if (!page) notFound();

  const treatment = alyssaTreatments.find((item) => item.id === page.treatmentId);
  const selectedPackage = alyssaPackages.find((item) => item.id === page.packageId);
  const embedScriptUrl = getEmbedScriptUrl();

  return (
    <main className="min-h-screen bg-[#fff9f3] text-[#321428]">
      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div className="pt-6">
          <p className="w-fit rounded-full bg-[#fff6f0] px-4 py-2 text-sm font-bold text-[#9a5d76]">
            {page.offerBadge}
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
            {page.heroTitle}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#6d4a5c]">
            {page.heroSubtitle}
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <InfoPill label="Brand" value={alyssaBrand.name} />
            <InfoPill label="Treatment" value={treatment?.name ?? "未設定"} />
            <InfoPill
              label="Offer"
              value={
                selectedPackage
                  ? `${selectedPackage.name} HK$${selectedPackage.promoPrice}`
                  : "未設定"
              }
            />
          </div>
          <div className="mt-8 space-y-4">
            {page.sections.map((section) => (
              <section key={section.title} className="border-t border-[#ead9cf] pt-4">
                <h2 className="text-xl font-bold">{section.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">
                  {section.body}
                </p>
              </section>
            ))}
          </div>
        </div>

        <aside className="rounded-[28px] border border-[#ead9cf] bg-white p-4 shadow-[0_24px_70px_rgba(90,35,72,0.14)]">
          <div className="mb-4 flex items-center justify-between gap-3 px-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
                Campaign form
              </p>
              <h2 className="mt-1 text-xl font-bold">{page.ctaText}</h2>
            </div>
          </div>
          <div id="alyssa-lp-form-target" />
          <Script
            src={embedScriptUrl}
            strategy="afterInteractive"
            data-form-token={page.formToken}
            data-brand={alyssaBrand.slug}
            data-form-id={page.formId}
            data-target-id="alyssa-lp-form-target"
          />
        </aside>
      </section>
    </main>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#ead9cf] bg-white/80 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {label}
      </p>
      <p className="mt-2 text-sm font-bold text-[#5a2348]">{value}</p>
    </div>
  );
}
