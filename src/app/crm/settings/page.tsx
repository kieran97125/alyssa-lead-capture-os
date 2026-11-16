import Link from "next/link";
import { notFound } from "next/navigation";
import { CrmShell } from "@/components/crm/CrmShell";
import { getWhatsAppConnectionByBrandSlug } from "@/lib/crm/whatsapp";
import { getConfiguredBrands } from "@/lib/data/configuration";
import { SystemButton } from "@/components/system/SystemButton";
import { crmWhatsAppSettingsHref, resolveCrmChannelReadiness, resolveSingleCrmBrand } from "@/lib/crm/channelReadiness";

export const dynamic = "force-dynamic";

const settingsItems = [
  {
    title: "WhatsApp 連接",
    description: "輸入 Meta 提供的資料，完成接駁及測試。",
    href: "/crm/settings/whatsapp",
    action: "開始設定",
  },
  {
    title: "訊息範本",
    description: "管理首次聯絡、預約確認及預約提醒。",
    href: "/crm/whatsapp/templates",
    action: "查看範本",
  },
  {
    title: "營運設定",
    description: "管理標籤、跟進時限、自動化及付款狀態。",
    href: "/crm/operations",
    action: "開啟設定",
  },
] as const;

export default async function CrmSettingsPage({ searchParams }: {
  searchParams?: Promise<{ brand?: string | string[] }>;
}) {
  const [query, brands] = await Promise.all([searchParams, getConfiguredBrands()]);
  const requestedBrand = Array.isArray(query?.brand) ? query.brand[0] : query?.brand;
  const brand = requestedBrand ? resolveSingleCrmBrand(brands, requestedBrand) : brands[0] ?? null;
  if (requestedBrand && !brand) notFound();
  const whatsapp = brand ? await getWhatsAppConnectionByBrandSlug(brand.slug) : null;
  const readiness = whatsapp ? resolveCrmChannelReadiness(whatsapp) : null;
  const readinessClass = readiness?.tone === "success"
    ? "bg-emerald-50 text-emerald-700"
    : readiness?.tone === "error" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800";

  return (
    <CrmShell active="settings" brandScope={brand?.slug}>
      <main className="min-h-screen bg-[#f6f8fb]">
        <header className="border-b border-[#e5e7eb] bg-white px-4 py-4 lg:px-6">
          <h1 className="text-xl font-black text-[#111827]">設定</h1>
          <p className="mt-1 text-sm font-semibold text-[#64748b]">
            揀一項需要處理的設定即可。
          </p>
        </header>

        <section className="mx-auto max-w-4xl p-4 lg:p-6">
          {brands.length > 0 ? (
            <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
              <label className="grid gap-1 text-xs font-semibold text-system-muted-foreground">
                設定品牌
                <select name="brand" defaultValue={brand?.slug} className="h-[var(--control-height-sm)] rounded-[var(--radius-control)] border border-system-input bg-system-card px-3 text-xs text-system-foreground focus-visible:outline-system-ring">
                  {brands.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
                </select>
              </label>
              <SystemButton type="submit" density="compact">切換品牌</SystemButton>
            </form>
          ) : null}
          <div data-testid="crm-channel-settings-status" className="mb-4 flex items-center justify-between rounded-xl border border-[#e2e8f0] bg-white px-4 py-3 shadow-sm">
            <div>
              <p className="text-sm font-black text-[#111827]">{brand ? `${brand.name} WhatsApp` : "WhatsApp 連接"}</p>
              <p className="mt-0.5 text-xs font-semibold text-[#64748b]">
                {readiness?.description || "請先由管理員設定可管理的品牌。"}
              </p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${readinessClass}`}>
              {readiness?.label || "待設定"}
            </span>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
            {settingsItems.map((item) => (
              <Link
                key={item.href}
                href={item.href === "/crm/settings/whatsapp" && brand ? crmWhatsAppSettingsHref(brand) : item.href}
                className="grid gap-2 border-b border-[#eef2f7] px-4 py-4 transition last:border-0 hover:bg-[#f8fafc] sm:grid-cols-[minmax(0,1fr)_120px] sm:items-center"
              >
                <div className="min-w-0">
                  <h2 className="text-sm font-black text-[#111827]">{item.title}</h2>
                  <p className="mt-1 text-xs font-semibold text-[#64748b]">{item.description}</p>
                </div>
                <span className="text-left text-xs font-black text-[var(--crm-accent)] sm:text-right">
                  {item.action} →
                </span>
              </Link>
            ))}
          </div>

          <p className="mt-4 text-xs font-semibold text-[#94a3b8]">
            品牌、療程、分店及系統技術資料由管理員維護，不會顯示於日常設定頁。
          </p>
        </section>
      </main>
    </CrmShell>
  );
}
