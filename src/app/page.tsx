import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";

const homeCards = [
  {
    href: "/campaigns/new",
    title: "建立 Campaign",
    body: "建立表格、Landing Page，或用現有表格快速測試新優惠。",
  },
  {
    href: "/landing-pages",
    title: "管理 Landing Pages",
    body: "查看草稿、已發布頁面和公開頁連結。",
  },
  {
    href: "/leads",
    title: "查看 Leads",
    body: "跟進最新登記紀錄、客人資料和預約狀態。",
  },
  {
    href: "/settings#brand-library",
    title: "Brand Library",
    body: "整理品牌、療程、優惠套餐和分店資料。",
  },
];

export default function HomePage() {
  return (
    <main className="alyssa-shell">
      <AppNav />
      <section className="mx-auto max-w-7xl px-5 py-10">
        <div className="rounded-[32px] border border-[#ead9cf] bg-white/86 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.1)] md:p-8">
          <p className="alyssa-kicker">LaunchHub</p>
          <h1 className="mt-3 text-4xl font-bold leading-tight text-[#321428] md:text-5xl">
            Campaign Launch OS
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[#6d4a5c] md:text-base">
            管理品牌登記表格、Landing Page、Leads 收集及來源追蹤。由 Launch 建立 Campaign，再到 Leads 和 Performance 查看成效。
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/campaigns/new"
              className="rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#d95f55]"
            >
              建立表格及 Landing Page
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full border border-[#d9b66f] bg-white/70 px-5 py-3 text-sm font-bold text-[#5a2348]"
            >
              查看 Dashboard
            </Link>
          </div>
        </div>

        <section className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {homeCards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="alyssa-premium-card alyssa-interactive-card alyssa-focus block h-full p-5"
            >
              <h2 className="text-xl font-bold text-[#321428]">{card.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">{card.body}</p>
            </Link>
          ))}
        </section>
      </section>
    </main>
  );
}
