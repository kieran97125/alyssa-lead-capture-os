import type { WhatsAppConnectionView } from "@/lib/crm/whatsapp";
import { brandsForScope, isAlyssaAllScope, type BrandScopeReference } from "@/lib/marketing/brandScope";

export type CrmChannelReadiness = {
  ready: boolean;
  label: string;
  description: string;
  tone: "success" | "warning" | "error";
};

type ChannelView = Pick<WhatsAppConnectionView, "ok" | "tableReady" | "encryptionConfigured"> & {
  connection: { status: string } | null;
};

/** A persisted credential record is not evidence of a working connection. */
export function resolveCrmChannelReadiness(view: ChannelView): CrmChannelReadiness {
  if (!view.ok || !view.tableReady) {
    return { ready: false, label: "暫未能確認", description: "連接狀態暫時未能讀取，請稍後重試。", tone: "warning" };
  }
  if (!view.connection || view.connection.status === "not_configured") {
    return { ready: false, label: "待設定", description: "尚未完成 WhatsApp 連接設定。", tone: "warning" };
  }
  if (!view.encryptionConfigured) {
    return { ready: false, label: "設定未完成", description: "連接安全設定尚未完成。", tone: "warning" };
  }
  if (view.connection.status === "test_succeeded") {
    return { ready: true, label: "測試成功", description: "最近一次發送測試成功。", tone: "success" };
  }
  if (view.connection.status === "error") {
    return { ready: false, label: "需要處理", description: "最近一次連接操作未成功，請檢查設定。", tone: "error" };
  }
  if (view.connection.status === "webhook_verified") {
    return { ready: false, label: "Webhook 已驗證", description: "接收端已驗證，尚未完成發送測試。", tone: "warning" };
  }
  if (view.connection.status === "saved") {
    return { ready: false, label: "待測試", description: "已儲存連接資料，尚未確認可正常發送。", tone: "warning" };
  }
  return { ready: false, label: "待確認", description: "請重新確認連接狀態及完成發送測試。", tone: "warning" };
}

/** Aggregate scopes cannot borrow the health state of a single brand. */
export function resolveSingleCrmBrand<T extends BrandScopeReference>(brands: T[], scope: string | null | undefined) {
  if (!scope || isAlyssaAllScope(scope)) return null;
  const matches = brandsForScope(brands, scope);
  return matches.length === 1 ? matches[0] : null;
}

export function crmWhatsAppSettingsHref(brand: Pick<BrandScopeReference, "id" | "slug">) {
  return `/crm/settings/whatsapp?brand=${encodeURIComponent(brand.slug || brand.id)}`;
}
