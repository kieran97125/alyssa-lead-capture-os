import { AppNav } from "@/components/alyssa/AppNav";
import { SettingsNav } from "@/components/alyssa/SettingsNav";
import { getConfigurationData } from "@/lib/data/configuration";

export const dynamic = "force-dynamic";

export default async function TemplateSettingsPage() {
  const config = await getConfigurationData();

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <section className="rounded-[28px] border border-[#ead9cf] bg-white/86 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.1)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
            Landing Page Templates
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[#321428]">
            活動頁模板設定
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
            版型用於快速測試市場角度、優惠同廣告文案。Wix 仍然係主網站；
            呢度只處理簡單廣告落地頁內容，完整網站內容仍在 Wix 管理。
          </p>
          <SettingsNav />
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-2">
          {config.templates.map((template) => (
            <article
              key={template.id}
              className="alyssa-premium-card min-w-0 p-5"
            >
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-[#ead9cf] bg-[#fff6f0] px-3 py-1 text-xs font-bold text-[#9a5d76]">
                  {template.status === "prepared" ? "可使用" : "稍後加入"}
                </span>
                <span className="rounded-full border border-[#ead9cf] bg-[#fff6f0] px-3 py-1 text-xs font-bold text-[#9a5d76]">
                  廣告測試
                </span>
              </div>
              <h2 className="mt-4 text-2xl font-bold text-[#321428]">
                {template.name}
              </h2>
              <p className="mt-3 text-sm leading-6 text-[#6d4a5c]">
                {template.useCase}
              </p>
              <p className="mt-3 text-sm font-semibold text-[#5a2348]">
                建議用途：{template.recommendedFor}
              </p>
              <div className="mt-5 flex min-w-0 flex-wrap gap-2">
                {template.supportedSections.map((section) => (
                  <span
                    key={section}
                    className="min-w-0 rounded-full bg-[#fff6f0] px-3 py-1 text-xs font-bold text-[#5a2348]"
                  >
                    {section}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
