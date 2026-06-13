import Link from "next/link";
import { notFound } from "next/navigation";
import { AppNav } from "@/components/alyssa/AppNav";
import { getLandingPageById } from "@/lib/data/landingPages";

export default async function LandingPageConfigPage({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { pageId } = await params;
  const page = getLandingPageById(pageId);

  if (!page) notFound();

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-6xl px-5 py-8">
        <section className="rounded-[28px] border border-[#ead9cf] bg-white/82 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.1)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
            Landing page config
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[#321428]">{page.title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
            這是 lightweight config preview，為日後 landing page builder 做準備。
            目前未建立完整 editor，不會產生假功能。
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href={`/lp/${page.slug}`}
              className="rounded-full bg-[#5a2348] px-5 py-3 text-sm font-bold text-white"
            >
              開啟 public preview
            </Link>
            <Link
              href="/landing-pages"
              className="rounded-full border border-[#d9b66f] bg-white px-5 py-3 text-sm font-bold text-[#5a2348]"
            >
              返回 Landing Pages
            </Link>
          </div>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-2">
          <ConfigPanel
            title="Mode"
            rows={[
              ["mode", page.mode],
              ["status", page.status],
              ["slug", page.slug],
              ["form_id", page.formId],
              ["form_token", page.formToken],
            ]}
          />
          <ConfigPanel
            title="Offer"
            rows={[
              ["hero_title", page.heroTitle],
              ["offer_badge", page.offerBadge],
              ["cta_text", page.ctaText],
              ["treatment_id", page.treatmentId],
              ["package_id", page.packageId],
            ]}
          />
        </section>

        <section className="mt-6 rounded-[24px] border border-[#ead9cf] bg-white/82 p-5 shadow-sm">
          <h2 className="text-xl font-bold text-[#321428]">Sections</h2>
          <div className="mt-4 grid gap-3">
            {page.sections.map((section) => (
              <div key={section.title} className="rounded-2xl bg-[#fff6f0] p-4">
                <h3 className="font-bold text-[#321428]">{section.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">
                  {section.body}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function ConfigPanel({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, string]>;
}) {
  return (
    <section className="rounded-[24px] border border-[#ead9cf] bg-white/82 p-5 shadow-sm">
      <h2 className="text-xl font-bold text-[#321428]">{title}</h2>
      <dl className="mt-4 grid gap-3">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-[#fff6f0] p-4">
            <dt className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
              {label}
            </dt>
            <dd className="mt-2 break-words text-sm font-semibold text-[#5a2348]">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
