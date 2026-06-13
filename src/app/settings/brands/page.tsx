import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";
import { SettingsNav } from "@/components/alyssa/SettingsNav";
import {
  getConfigurationData,
  getLinkedForms,
  getLinkedLandingPages,
} from "@/lib/data/configuration";

export const dynamic = "force-dynamic";

export default async function BrandSettingsPage() {
  const config = await getConfigurationData();

  return (
    <main className="alyssa-shell">
      <AppNav showInternalWarning />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <section className="rounded-[28px] border border-[#ead9cf] bg-white/86 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.1)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
            品牌設定
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[#321428]">
            Brand configuration
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
            管理品牌名稱、品牌色、WhatsApp 同預設 thank-you destination。
            現階段為設定檢視 / 編輯功能預留。
          </p>
          <SettingsNav />
        </section>

        <section className="mt-6 grid gap-5">
          {config.brands.map((brand) => {
            const linkedForms = getLinkedForms(
              config,
              (form) => form.brandId === brand.id
            );
            const linkedPages = getLinkedLandingPages(
              config,
              (page) => page.brandId === brand.id
            );

            return (
              <article
                key={brand.id}
                className="rounded-[24px] border border-[#ead9cf] bg-white/86 p-5 shadow-sm"
              >
                <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <ColorPill label="Primary" value={brand.primaryColor} />
                      <ColorPill label="Secondary" value={brand.secondaryColor} />
                    </div>
                    <h2 className="mt-4 text-2xl font-bold text-[#321428]">
                      {brand.name}
                    </h2>
                    <p className="mt-2 font-mono text-sm text-[#7b5a6a]">
                      {brand.slug}
                    </p>
                    <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                      <InfoCell label="WhatsApp" value={brand.whatsappNumber ?? "未設定"} />
                      <InfoCell
                        label="Default thank-you URL"
                        value={brand.defaultThankYouUrl ?? "未設定"}
                      />
                    </dl>
                  </div>
                  <div className="rounded-[20px] bg-[#fff6f0] p-5">
                    <h3 className="text-lg font-bold text-[#321428]">關聯項目</h3>
                    <LinkedList
                      title="Linked forms"
                      items={linkedForms.map((form) => form.formName)}
                      empty="未有關聯表格"
                    />
                    <LinkedList
                      title="Linked landing pages"
                      items={linkedPages.map((page) => page.title)}
                      empty="未有關聯 landing page"
                    />
                    <Link
                      href="/forms"
                      className="mt-4 inline-flex rounded-full bg-[#5a2348] px-5 py-3 text-sm font-bold text-white"
                    >
                      查看表格連接
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}

function ColorPill({ label, value }: { label: string; value: string | null }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[#ead9cf] bg-[#fff6f0] px-3 py-1 text-xs font-bold text-[#9a5d76]">
      <span
        className="h-3 w-3 rounded-full border border-[#ead9cf]"
        style={{ backgroundColor: value ?? "#fff" }}
      />
      {label}: {value ?? "未設定"}
    </span>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#fff6f0] p-4">
      <dt className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {label}
      </dt>
      <dd className="mt-2 break-words text-sm font-semibold text-[#5a2348]">
        {value}
      </dd>
    </div>
  );
}

function LinkedList({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <div className="mt-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {title}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.length > 0 ? (
          items.map((item) => (
            <span
              key={item}
              className="rounded-full bg-white/78 px-3 py-1 text-xs font-bold text-[#5a2348]"
            >
              {item}
            </span>
          ))
        ) : (
          <span className="text-sm font-semibold text-[#7b5a6a]">{empty}</span>
        )}
      </div>
    </div>
  );
}
