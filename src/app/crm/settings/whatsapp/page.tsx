import Link from "next/link";
import { CopyButton } from "@/components/alyssa/CopyButton";
import { CrmShell } from "@/components/crm/CrmShell";
import {
  DEFAULT_GRAPH_API_VERSION,
  WHATSAPP_PROVIDER_META,
  getWhatsAppConnectionByBrandSlug,
} from "@/lib/crm/whatsapp";
import { getConfigurationData } from "@/lib/data/configuration";
import {
  saveWhatsAppConnectionAction,
  testWhatsAppSendAction,
} from "./actions";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function WhatsAppConnectionPage({
  searchParams,
}: {
  searchParams?: Promise<{
    settings_success?: string | string[];
    settings_error?: string | string[];
  }>;
}) {
  const [query, config] = await Promise.all([searchParams, getConfigurationData()]);
  const brand =
    config.brands.find((item) => item.slug === "ineffable") || config.brands[0] || null;
  const connectionView = await getWhatsAppConnectionByBrandSlug("ineffable");
  const connection = connectionView.connection;
  const feedback = firstParam(query?.settings_success) || firstParam(query?.settings_error);
  const success = Boolean(firstParam(query?.settings_success));
  const setupReady = connectionView.tableReady && connectionView.encryptionConfigured;

  return (
    <CrmShell active="settings">
      <main className="min-h-screen bg-[#f6f8fb]">
        <header className="border-b border-[#e5e7eb] bg-white px-4 py-4 lg:px-6">
          <Link href="/crm/settings" className="text-xs font-black text-[#6366f1]">
            ← 返回設定
          </Link>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-black text-[#111827]">連接 WhatsApp</h1>
              <p className="mt-1 text-sm font-semibold text-[#64748b]">
                將 Meta 顯示的資料貼入，儲存後測試一次即可。
              </p>
            </div>
            <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-black ${connection ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
              {connection ? "已儲存" : "尚未連接"}
            </span>
          </div>
          {feedback ? (
            <div className={`mt-3 rounded-lg border px-3 py-2 text-sm font-bold ${success ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>
              {feedback}
            </div>
          ) : null}
        </header>

        <section className="mx-auto grid max-w-4xl gap-4 p-4 lg:p-6">
          {!setupReady ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
              系統安全設定尚未完成，暫時未能儲存連接資料。
            </div>
          ) : null}

          <section className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
            <div className="border-b border-[#eef2f7] px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#6366f1]">步驟 1</p>
              <h2 className="mt-1 text-base font-black text-[#111827]">在 Meta 複製兩項資料</h2>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <CopyField label="Webhook URL" value={connectionView.webhookUrl} />
              <CopyField label="Verify Token" value={connectionView.verifyToken || "儲存後顯示"} />
            </div>
          </section>

          <form action={saveWhatsAppConnectionAction} className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
            <input type="hidden" name="brandId" value={brand?.id || ""} />
            <input type="hidden" name="provider" value={WHATSAPP_PROVIDER_META} />
            <input type="hidden" name="defaultSendMode" value="template_required_for_first_contact" />
            <input type="hidden" name="graphApiVersion" value={connection?.graph_api_version || DEFAULT_GRAPH_API_VERSION} />

            <div className="border-b border-[#eef2f7] px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#6366f1]">步驟 2</p>
              <h2 className="mt-1 text-base font-black text-[#111827]">貼上 Meta 連接資料</h2>
              <p className="mt-1 text-xs font-semibold text-[#64748b]">所有密鑰只會加密儲存，不會再顯示。</p>
            </div>

            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <Field label="WhatsApp Business Account ID" name="wabaId" required defaultValue={connection?.waba_id} />
              <Field label="Phone Number ID" name="phoneNumberId" required defaultValue={connection?.phone_number_id} />
              <Field label="WhatsApp 電話號碼" name="displayPhoneNumber" required defaultValue={connection?.display_phone_number} />
              <Field label="Meta App ID" name="appId" defaultValue={connection?.app_id} />
              <Field label="Meta App Secret" name="appSecret" type="password" placeholder={connection?.app_secret_encrypted ? "已儲存；留空即可保留" : "貼上 App Secret"} />
              <Field label="永久 Access Token" name="accessToken" type="password" placeholder={connection?.access_token_encrypted ? "已儲存；留空即可保留" : "貼上 Access Token"} />
              <details className="sm:col-span-2 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2">
                <summary className="cursor-pointer text-xs font-black text-[#475569]">進階設定</summary>
                <div className="mt-3">
                  <Field label="Verify Token" name="verifyToken" required defaultValue={connection?.verify_token} />
                </div>
              </details>
            </div>

            <div className="border-t border-[#eef2f7] px-4 py-3">
              <button disabled={!setupReady} className="h-10 rounded-lg bg-[#111827] px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">
                儲存連接
              </button>
            </div>
          </form>

          <form action={testWhatsAppSendAction} className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
            <input type="hidden" name="brandId" value={brand?.id || ""} />
            <input type="hidden" name="connectionId" value={connection?.id || ""} />
            <div className="border-b border-[#eef2f7] px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#6366f1]">步驟 3</p>
              <h2 className="mt-1 text-base font-black text-[#111827]">發送測試訊息</h2>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <Field label="測試電話" name="testPhone" placeholder="85291234567" required />
              <Field label="測試內容" name="testMessage" defaultValue="Ineffable Beauty WhatsApp connection test" required />
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-[#eef2f7] px-4 py-3">
              <button disabled={!connection} className="h-10 rounded-lg bg-[#16a34a] px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">
                發送測試
              </button>
              <Link href="/crm/whatsapp/templates" className="text-xs font-black text-[#4f46e5]">
                下一步：設定訊息範本 →
              </Link>
            </div>
          </form>
        </section>
      </main>
    </CrmShell>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-black text-[#475569]">
      {label}
      <input
        type={type}
        name={name}
        required={required}
        defaultValue={defaultValue || ""}
        placeholder={placeholder}
        className="h-10 rounded-lg border border-[#cbd5e1] bg-white px-3 text-sm font-semibold text-[#111827] outline-none focus:border-[#6366f1]"
      />
    </label>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
      <p className="text-xs font-black text-[#475569]">{label}</p>
      <p className="mt-1 break-all font-mono text-xs font-semibold text-[#111827]">{value}</p>
      <div className="mt-2"><CopyButton value={value} label={`複製 ${label}`} /></div>
    </div>
  );
}
