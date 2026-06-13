import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";
import { alyssaLandingPages } from "@/lib/data/landingPages";

export default function LandingPagesPage() {
  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <section className="rounded-[28px] border border-[#ead9cf] bg-white/82 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.1)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
            Landing Pages
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[#321428]">
            Campaign testing layer
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
            Alyssa Lead Capture OS 支援 Form-only embed 同簡單 campaign landing
            page。Wix 仍然係主網站；landing page mode 用於快速 market testing。
          </p>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-2">
          <ModeCard
            title="Form-only embed"
            description="設定品牌、療程、套餐、分店同 form token，產生 Wix embed script。Lead App 負責表格、UTM、source snapshot 同 attribution。"
            status="已實作"
          />
          <ModeCard
            title="Campaign landing page"
            description="用同一份 form config 包裝 hero、offer、CTA、FAQ/testimonial 等內容，快速測試 campaign。不是 Wix replacement。"
            status="Foundation ready"
          />
        </section>

        <section className="mt-6 rounded-[24px] border border-[#ead9cf] bg-white/82 p-5 shadow-sm">
          <h2 className="text-xl font-bold text-[#321428]">Landing page configs</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {alyssaLandingPages.map((page) => (
              <article key={page.id} className="rounded-2xl bg-[#fff6f0] p-5">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
                  {page.mode}
                </p>
                <h3 className="mt-2 text-xl font-bold text-[#321428]">
                  {page.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">
                  {page.heroSubtitle}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/landing-pages/${page.id}`}
                    className="rounded-full bg-[#5a2348] px-4 py-2 text-sm font-bold text-white"
                  >
                    設定
                  </Link>
                  <Link
                    href={`/lp/${page.slug}`}
                    className="rounded-full border border-[#d9b66f] bg-white px-4 py-2 text-sm font-bold text-[#5a2348]"
                  >
                    Preview
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function ModeCard({
  title,
  description,
  status,
}: {
  title: string;
  description: string;
  status: string;
}) {
  return (
    <section className="rounded-[24px] border border-[#ead9cf] bg-white/82 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-xl font-bold text-[#321428]">{title}</h2>
        <span className="rounded-full bg-[#fff6f0] px-3 py-1 text-xs font-bold text-[#9a5d76]">
          {status}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-[#6d4a5c]">{description}</p>
    </section>
  );
}
