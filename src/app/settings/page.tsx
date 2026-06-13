import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";
import { SettingsNav } from "@/components/alyssa/SettingsNav";
import { getConfigurationData } from "@/lib/data/configuration";

export const dynamic = "force-dynamic";

const hierarchy = [
  ["Brand", "品牌定位、顏色、WhatsApp 同 thank-you destination"],
  ["Treatment", "療程類別、描述同品牌歸屬"],
  ["Package / Price", "套餐、原價、優惠價同是否需要付款 flow"],
  ["Branch", "分店、地址、營業時間同可預約地點"],
  ["Form", "選定品牌、療程、套餐、分店後產生 embed form"],
  ["Output mode", "Form-only embed 或 Landing page mode"],
];

const settingLinks = [
  { href: "/settings/brands", title: "品牌設定", body: "品牌資料、顏色、WhatsApp、thank-you URL。" },
  { href: "/settings/treatments", title: "療程設定", body: "療程名稱、描述、狀態同套餐關聯。" },
  { href: "/settings/packages", title: "套餐 / 價錢", body: "套餐價值、優惠價同付款語意。" },
  { href: "/settings/branches", title: "分店設定", body: "分店、地址、營業時間同可用狀態。" },
  { href: "/settings/templates", title: "Landing Page Templates", body: "Campaign page template foundation。" },
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
            Configuration Foundation V1
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
            呢一層定義 Alyssa campaign testing 的基本配置：品牌、療程、套餐價錢、
            分店、表格連接同 Landing Page 模板。現階段係設定檢視，完整編輯功能預留。
          </p>
          <SettingsNav />
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <MiniStat label="品牌" value={config.brands.length.toString()} />
            <MiniStat label="療程" value={config.treatments.length.toString()} />
            <MiniStat label="套餐" value={config.packages.length.toString()} />
            <MiniStat label="分店" value={config.branches.length.toString()} />
            <MiniStat label="表格" value={config.forms.length.toString()} />
          </div>
        </section>

        <section className="mt-6 rounded-[24px] border border-[#ead9cf] bg-white/86 p-5 shadow-sm">
          <h2 className="text-xl font-bold text-[#321428]">設定層級</h2>
          <div className="mt-5 grid gap-3 lg:grid-cols-6">
            {hierarchy.map(([title, body], index) => (
              <div key={title} className="rounded-2xl bg-[#fff6f0] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
                  Step {index + 1}
                </p>
                <h3 className="mt-2 text-lg font-bold text-[#321428]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-2">
          {settingLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-[24px] border border-[#ead9cf] bg-white/86 p-5 shadow-sm transition hover:border-[#c9828e] hover:bg-white"
            >
              <h2 className="text-xl font-bold text-[#321428]">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">{item.body}</p>
              <p className="mt-4 text-sm font-bold text-[#5a2348]">設定檢視 / 編輯功能預留</p>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#fff6f0] p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-[#321428]">{value}</p>
    </div>
  );
}
