import { AppNav } from "@/components/alyssa/AppNav";
import { SettingsNav } from "@/components/alyssa/SettingsNav";
import {
  getConfigurationData,
  getTreatment,
  packagePriceLabel,
} from "@/lib/data/configuration";

export const dynamic = "force-dynamic";

function money(value: number | string | null, currency: string) {
  const amount = typeof value === "string" ? Number(value) : value;
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "未設定";
  return new Intl.NumberFormat("zh-HK", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function PackageSettingsPage() {
  const config = await getConfigurationData();

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <section className="rounded-[28px] border border-[#ead9cf] bg-white/86 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.1)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
            套餐 / 價錢
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[#321428]">
            Package and price configuration
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
            套餐價錢代表客人選擇的 offer value；付款狀態代表付款流程進度。
            booking_only 只代表未啟動付款 flow，不代表套餐價錢係 0。
          </p>
          <SettingsNav />
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-2">
          {config.packages.map((item) => {
            const treatment = getTreatment(config, item.treatmentId);
            return (
              <article
                key={item.id}
                className="rounded-[24px] border border-[#ead9cf] bg-white/86 p-5 shadow-sm"
              >
                <div className="flex flex-wrap gap-2">
                  <StatusPill>{item.status}</StatusPill>
                  <StatusPill>
                    {item.paymentRequired ? "需要付款 flow" : "可只預約"}
                  </StatusPill>
                </div>
                <h2 className="mt-4 text-2xl font-bold text-[#321428]">
                  {item.name}
                </h2>
                <p className="mt-2 text-sm font-semibold text-[#7b5a6a]">
                  {treatment?.name ?? "未設定療程"}
                </p>
                <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                  <InfoCell label="Original price" value={money(item.originalPrice, item.currency)} />
                  <InfoCell label="Promo price" value={money(item.promoPrice, item.currency)} />
                  <InfoCell label="Currency" value={item.currency} />
                  <InfoCell label="Display offer" value={packagePriceLabel(item)} />
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
