import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";
import { MotionReveal } from "@/components/alyssa/MotionReveal";
import { SettingsNav } from "@/components/alyssa/SettingsNav";
import { getConfigurationData } from "@/lib/data/configuration";

export const dynamic = "force-dynamic";

const settingLinks = [
  { href: "/settings/brands", title: "品牌資料", body: "管理品牌名稱、顏色、WhatsApp 同完成登記後的去向。" },
  { href: "/settings/treatments", title: "療程資料", body: "查看療程名稱、介紹、狀態同可配搭套餐。" },
  { href: "/settings/packages", title: "套餐價錢", body: "查看套餐價值、優惠價同付款安排。" },
  { href: "/settings/branches", title: "分店資料", body: "查看分店、地址、營業時間同可用狀態。" },
  { href: "/settings/templates", title: "Landing Page 版型", body: "查看廣告落地頁可使用的內容版型。" },
  { href: "/settings/team", title: "團隊權限", body: "規劃角色、可使用功能同可查看品牌。" },
];

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
          <h1 className="mt-2 text-3xl font-bold text-[#321428]">
            設定中心
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
            這裡集中查看 Alyssa 的品牌、療程、套餐價錢、分店、表格連接同 Landing Page 版型。
            目前可查看，編輯功能稍後加入。
          </p>
          <SettingsNav />
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MiniStat label="品牌" value={config.brands.length.toString()} />
            <MiniStat label="療程" value={config.treatments.length.toString()} />
            <MiniStat label="套餐" value={config.packages.length.toString()} />
            <MiniStat label="分店" value={config.branches.length.toString()} />
            <MiniStat label="表格" value={config.forms.length.toString()} />
          </div>
        </section>

        <section className="mt-6 grid items-stretch gap-5 lg:grid-cols-2">
          {settingLinks.map((item) => (
            <MotionReveal key={item.href}>
            <Link
              href={item.href}
              className="alyssa-premium-card alyssa-interactive-card alyssa-focus block p-5"
            >
              <h2 className="text-xl font-bold text-[#321428]">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">{item.body}</p>
            </Link>
            </MotionReveal>
          ))}
        </section>
      </div>
    </main>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <MotionReveal>
    <div className="min-w-0 rounded-2xl bg-[#fff6f0] p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-[#321428]">{value}</p>
    </div>
    </MotionReveal>
  );
}
