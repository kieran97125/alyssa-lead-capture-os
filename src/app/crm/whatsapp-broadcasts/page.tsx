import { notFound } from "next/navigation";
import { CrmShell } from "@/components/crm/CrmShell";
import { WhatsAppBroadcastsPanel } from "@/components/crm/WhatsAppBroadcastsPanel";
import { getWhatsAppCampaignDashboard } from "@/lib/crm/whatsappCampaigns";
import { getConfigurationData } from "@/lib/data/configuration";

export const dynamic = "force-dynamic";

export default async function WhatsAppBroadcastsPage() {
  const config = await getConfigurationData();
  const brand = config.brands.find((item) =>
    ["ineffable", "ineffable-beauty"].includes(item.slug)
  );
  if (!brand) notFound();
  const dashboard = await getWhatsAppCampaignDashboard(brand.slug);

  return (
    <CrmShell active="broadcasts">
      {!dashboard.ok || !dashboard.brand ? (
        <div className="p-6">
          <div className="rounded-2xl border border-[#fecaca] bg-[#fef2f2] p-5 text-sm font-bold text-[#991b1b]">
            {dashboard.error === "migration_not_applied"
              ? "WhatsApp 群發功能尚未完成設定，請聯絡系統管理員。"
              : "WhatsApp 群發功能暫時未能載入，請稍後再試。"}
          </div>
        </div>
      ) : (
        <WhatsAppBroadcastsPanel
          brand={dashboard.brand}
          broadcasts={dashboard.campaigns}
          templates={dashboard.templates}
          consentCount={dashboard.consentCount}
          suppressionCount={dashboard.suppressionCount}
          liveSendEnabled={dashboard.liveSendEnabled}
        />
      )}
    </CrmShell>
  );
}
