import { CrmShell } from "@/components/crm/CrmShell";
import { WhatsAppBroadcastsPanel } from "@/components/crm/WhatsAppBroadcastsPanel";
import { getWhatsAppCampaignDashboard } from "@/lib/crm/whatsappCampaigns";

export const dynamic = "force-dynamic";

export default async function WhatsAppBroadcastsPage() {
  const dashboard = await getWhatsAppCampaignDashboard("ineffable");

  return (
    <CrmShell active="broadcasts">
      {!dashboard.ok || !dashboard.brand ? (
        <div className="p-6">
          <div className="rounded-2xl border border-[#fecaca] bg-[#fef2f2] p-5 text-sm font-bold text-[#991b1b]">
            {dashboard.error === "migration_not_applied"
              ? "WhatsApp Broadcast SQL migration 尚未套用。請先套用 docs/CRM_WHATSAPP_CAMPAIGNS_SAFE_APPLY.sql。"
              : `WhatsApp Broadcast 暫時未能載入：${dashboard.error || "unknown_error"}`}
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
