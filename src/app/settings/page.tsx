import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";
import { MotionReveal } from "@/components/alyssa/MotionReveal";
import { SettingsNav } from "@/components/alyssa/SettingsNav";
import { getConfigurationData } from "@/lib/data/configuration";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const config = await getConfigurationData();
  const libraryLinks = [
    {
      href: "/settings/brands",
      title: "Brands 品牌",
      body: "管理 Campaign、表格和 Landing Page 可選用的品牌資料。",
      count: config.brands.length,
    },
    {
      href: "/settings/treatments",
      title: "Treatments 療程",
      body: "整理不同品牌可推廣的療程，讓建立 Campaign 時直接選用。",
      count: config.treatments.length,
    },
    {
      href: "/settings/packages",
      title: "Offers / Packages 優惠套餐",
      body: "管理優惠名稱、價錢和付款設定，供表格與 Landing Page 共用。",
      count: config.packages.length,
    },
    {
      href: "/settings/branches",
      title: "Branches 分店",
      body: "維護可供客人預約的分店資料。",
      count: config.branches.length,
    },
    {
      href: "/legal/ineffable/terms",
      title: "Legal / Operator 法律及營運方",
      body: "查看公開法律頁及營運方顯示；正式修改前請先完成品牌法律審核。",
      count: null,
    },
    {
      href: "/forms",
      title: "Form Defaults 表格預設",
      body: "查看現有表格使用的品牌、療程、優惠套餐及分店預設。",
      count: config.forms.length,
    },
  ];

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <section className="rounded-[28px] border border-[#ead9cf] bg-white/86 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.1)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
                Settings
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#321428]">
                Brand Library
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
                先整理品牌、療程、優惠套餐和分店資料，再用 Launch 建立 Campaign。每日操作應由這裡選取資料，而不是每次重新輸入。
              </p>
            </div>
            <Link
              href="/system-audit"
              className="rounded-full border border-[#ead9cf] bg-white px-5 py-3 text-sm font-bold text-[#5a2348] transition hover:border-[#c9828e]"
            >
              System Audit
            </Link>
          </div>
          <SettingsNav />
        </section>

        <section id="brand-library" className="mt-6 scroll-mt-28">
          <div className="mb-4">
            <p className="alyssa-kicker">Campaign 資料庫</p>
            <h2 className="mt-2 text-2xl font-bold text-[#321428]">
              建立 Campaign 前先確認資料
            </h2>
          </div>

          <div className="grid items-stretch gap-5 lg:grid-cols-2">
            {libraryLinks.map((item) => (
              <MotionReveal key={item.href}>
                <Link
                  href={item.href}
                  className="alyssa-premium-card alyssa-interactive-card alyssa-focus block h-full p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-bold text-[#321428]">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">
                        {item.body}
                      </p>
                    </div>
                    {item.count !== null && (
                      <span className="rounded-full bg-[#fff6f0] px-3 py-1 text-sm font-bold text-[#5a2348]">
                        {item.count}
                      </span>
                    )}
                  </div>
                </Link>
              </MotionReveal>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
