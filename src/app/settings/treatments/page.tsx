import { AppNav } from "@/components/alyssa/AppNav";
import { SettingsNav } from "@/components/alyssa/SettingsNav";
import {
  getBrand,
  getConfigurationData,
  getLinkedForms,
  getLinkedLandingPages,
} from "@/lib/data/configuration";

export const dynamic = "force-dynamic";

export default async function TreatmentSettingsPage() {
  const config = await getConfigurationData();

  return (
    <main className="alyssa-shell">
      <AppNav showInternalWarning />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <section className="rounded-[28px] border border-[#ead9cf] bg-white/86 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.1)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
            療程設定
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[#321428]">
            Treatment configuration
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
            療程連接品牌、套餐價錢、表格同 landing page。現階段為設定檢視 /
            編輯功能預留。
          </p>
          <SettingsNav />
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-2">
          {config.treatments.map((treatment) => {
            const brand = getBrand(config, treatment.brandId);
            const linkedPackages = config.packages.filter(
              (item) => item.treatmentId === treatment.id
            );
            const linkedForms = getLinkedForms(
              config,
              (form) => form.defaultTreatmentId === treatment.id
            );
            const linkedPages = getLinkedLandingPages(
              config,
              (page) => page.treatmentId === treatment.id
            );

            return (
              <article
                key={treatment.id}
                className="rounded-[24px] border border-[#ead9cf] bg-white/86 p-5 shadow-sm"
              >
                <div className="flex flex-wrap gap-2">
                  <StatusPill>{treatment.status}</StatusPill>
                  <StatusPill>{brand?.name ?? "未設定品牌"}</StatusPill>
                </div>
                <h2 className="mt-4 text-2xl font-bold text-[#321428]">
                  {treatment.name}
                </h2>
                <p className="mt-1 font-mono text-sm text-[#7b5a6a]">
                  {treatment.slug}
                </p>
                <p className="mt-3 text-sm leading-6 text-[#6d4a5c]">
                  {treatment.description ?? "未有療程描述。"}
                </p>
                <div className="mt-5 grid gap-3">
                  <LinkedBlock
                    title="Linked packages"
                    items={linkedPackages.map((item) => item.name)}
                    empty="未有套餐"
                  />
                  <LinkedBlock
                    title="Linked forms"
                    items={linkedForms.map((item) => item.formName)}
                    empty="未有關聯表格"
                  />
                  <LinkedBlock
                    title="Linked landing pages"
                    items={linkedPages.map((item) => item.title)}
                    empty="未有關聯 landing page"
                  />
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}

function StatusPill({ children }: { children: string }) {
  return (
    <span className="rounded-full border border-[#ead9cf] bg-[#fff6f0] px-3 py-1 text-xs font-bold text-[#9a5d76]">
      {children}
    </span>
  );
}

function LinkedBlock({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <div className="rounded-2xl bg-[#fff6f0] p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {title}
      </p>
      <p className="mt-2 text-sm font-semibold text-[#5a2348]">
        {items.length > 0 ? items.join(", ") : empty}
      </p>
    </div>
  );
}
