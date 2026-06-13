import { AppNav } from "@/components/alyssa/AppNav";
import { SettingsNav } from "@/components/alyssa/SettingsNav";
import {
  getBrand,
  getConfigurationData,
  getLinkedForms,
} from "@/lib/data/configuration";

export const dynamic = "force-dynamic";

export default async function BranchSettingsPage() {
  const config = await getConfigurationData();

  return (
    <main className="alyssa-shell">
      <AppNav showInternalWarning />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <section className="rounded-[28px] border border-[#ead9cf] bg-white/86 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.1)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
            分店設定
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[#321428]">
            Branch configuration
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
            分店設定會影響表格預設分店同客人預約位置。現階段為設定檢視 /
            編輯功能預留。
          </p>
          <SettingsNav />
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-3">
          {config.branches.map((branch) => {
            const brand = getBrand(config, branch.brandId);
            const linkedForms = getLinkedForms(
              config,
              (form) => form.defaultBranchId === branch.id
            );

            return (
              <article
                key={branch.id}
                className="rounded-[24px] border border-[#ead9cf] bg-white/86 p-5 shadow-sm"
              >
                <div className="flex flex-wrap gap-2">
                  <StatusPill>{branch.status}</StatusPill>
                  <StatusPill>{brand?.name ?? "未設定品牌"}</StatusPill>
                </div>
                <h2 className="mt-4 text-2xl font-bold text-[#321428]">
                  {branch.name}
                </h2>
                <p className="mt-1 font-mono text-sm text-[#7b5a6a]">
                  {branch.slug}
                </p>
                <dl className="mt-5 grid gap-3">
                  <InfoCell label="Address" value={branch.address ?? "未設定"} />
                  <InfoCell label="Opening hours" value={branch.openingHours ?? "未設定"} />
                  <InfoCell
                    label="Linked forms"
                    value={
                      linkedForms.length > 0
                        ? linkedForms.map((form) => form.formName).join(", ")
                        : "未有關聯表格"
                    }
                  />
                </dl>
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
