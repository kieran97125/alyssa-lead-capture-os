import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";
import { MotionReveal } from "@/components/alyssa/MotionReveal";
import { SettingsNav } from "@/components/alyssa/SettingsNav";
import { getConfigurationData } from "@/lib/data/configuration";

export const dynamic = "force-dynamic";

const settingLinks = [
  {
    href: "/settings/brands",
    title: "品牌資料",
    body: "品牌名稱、顏色、WhatsApp 和 Thank You Page。",
    countKey: "brands",
  },
  {
    href: "/settings/treatments",
    title: "療程資料",
    body: "Campaign 和表格可以選用的療程。",
    countKey: "treatments",
  },
  {
    href: "/settings/packages",
    title: "套餐價錢",
    body: "套餐名稱、原價、優惠價和付款要求。",
    countKey: "packages",
  },
  {
    href: "/settings/branches",
    title: "分店資料",
    body: "表格和 Campaign 可以選用的分店。",
    countKey: "branches",
  },
  {
    href: "/settings/templates",
    title: "Landing Page 版型",
    body: "查看可用的 Campaign Landing Page 版型。",
    countKey: "templates",
  },
  {
    href: "/settings/team",
    title: "團隊權限",
    body: "查看日後登入和角色權限安排。",
    countKey: null,
  },
] as const;

export default async function SettingsPage() {
  const config = await getConfigurationData();

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <section className="rounded-[28px] border border-[#ead9cf] bg-white/86 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.1)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
            Settings
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[#321428]">設定中心</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
            管理建立 Campaign、表格和 Landing Page 需要用到的基本資料。
          </p>
          <SettingsNav />
        </section>

        <section className="mt-6 grid items-stretch gap-5 lg:grid-cols-2">
          {settingLinks.map((item) => {
            const count =
              item.countKey && item.countKey in config
                ? config[item.countKey].length
                : null;

            return (
              <MotionReveal key={item.href}>
                <Link
                  href={item.href}
                  className="alyssa-premium-card alyssa-interactive-card alyssa-focus block p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-[#321428]">
                        {item.title}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">
                        {item.body}
                      </p>
                    </div>
                    {count !== null && (
                      <span className="rounded-full bg-[#fff6f0] px-3 py-1 text-sm font-bold text-[#5a2348]">
                        {count}
                      </span>
                    )}
                  </div>
                </Link>
              </MotionReveal>
            );
          })}
        </section>
      </div>
    </main>
  );
}
