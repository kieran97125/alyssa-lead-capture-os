import Link from "next/link";
import type { ReactNode } from "react";
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
    brand?: string | string[];
    settings_success?: string | string[];
    settings_error?: string | string[];
  }>;
}) {
  const [query, config] = await Promise.all([
    searchParams,
    getConfigurationData(),
  ]);
  const selectedBrandSlug = firstParam(query?.brand) || "ineffable";
  const selectedBrand =
    config.brands.find((brand) => brand.slug === selectedBrandSlug) ||
    config.brands.find((brand) => brand.slug === "ineffable") ||
    config.brands[0] ||
    null;
  const connectionView = await getWhatsAppConnectionByBrandSlug(
    selectedBrand?.slug || "ineffable"
  );
  const connection = connectionView.connection;
  const feedback =
    firstParam(query?.settings_success) || firstParam(query?.settings_error);
  const feedbackTone = firstParam(query?.settings_success) ? "success" : "error";

  return (
    <CrmShell active="settings">
      <main className="min-h-screen bg-[#f8fafc]">
        <header className="border-b border-[#e5e7eb] bg-white px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Link
                href="/crm/settings"
                className="text-[11px] font-bold text-[#64748b] hover:text-[#111827]"
              >
                Settings
              </Link>
              <h1 className="mt-1 text-2xl font-black text-[#111827]">
                WhatsApp Connection
              </h1>
              <p className="mt-1 text-sm font-semibold text-[#64748b]">
                WhatsApp 連線設定，先支援 Ineffable Beauty 的 Meta WhatsApp
                Cloud API；Alyssa 之後可以用同一套品牌設定加上。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone={connection ? "green" : "amber"}>
                {connectionView.statusLabel}
              </StatusBadge>
              <StatusBadge tone={connectionView.tableReady ? "green" : "amber"}>
                {connectionView.tableReady ? "DB ready" : "SQL required"}
              </StatusBadge>
              <StatusBadge
                tone={connectionView.encryptionConfigured ? "green" : "red"}
              >
                {connectionView.encryptionConfigured
                  ? "Encryption ready"
                  : "Encryption key missing"}
              </StatusBadge>
            </div>
          </div>
          {feedback && (
            <div
              className={`mt-3 rounded-lg border px-3 py-2 text-sm font-bold ${
                feedbackTone === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {feedback}
            </div>
          )}
        </header>

        <div className="grid gap-4 p-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="rounded-lg border border-[#e5e7eb] bg-white p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#64748b]">
              Brand
            </p>
            <div className="mt-3 grid gap-2">
              {config.brands
                .filter((brand) => ["ineffable", "alyssa"].includes(brand.slug))
                .map((brand) => {
                  const isAlyssa = brand.slug === "alyssa";
                  const active = selectedBrand?.slug === brand.slug;
                  return (
                    <Link
                      key={brand.id}
                      href={
                        isAlyssa
                          ? "#"
                          : `/crm/settings/whatsapp?brand=${brand.slug}`
                      }
                      className={`rounded-md border px-3 py-2 text-sm font-bold ${
                        active
                          ? "border-[#111827] bg-[#111827] text-white"
                          : "border-[#e5e7eb] bg-white text-[#111827]"
                      } ${isAlyssa ? "cursor-not-allowed opacity-50" : ""}`}
                    >
                      <span>{brand.name}</span>
                      <span className="mt-0.5 block text-[11px] font-semibold opacity-75">
                        {isAlyssa ? "Available later" : "Enabled"}
                      </span>
                    </Link>
                  );
                })}
            </div>
          </aside>

          <div className="grid gap-4">
            <section className="rounded-lg border border-[#e5e7eb] bg-white p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-black text-[#111827]">
                    Meta WhatsApp Cloud API
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-[#64748b]">
                    Settings are brand-specific. Saved secrets are masked and
                    never rendered back to the browser.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ProviderBadge label="Meta Cloud API" active />
                  <ProviderBadge label="360dialog" />
                  <ProviderBadge label="Twilio" />
                  <ProviderBadge label="SleekFlow / BSP" />
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-[#e5e7eb] bg-white p-4">
              <h2 className="text-base font-black text-[#111827]">
                Webhook setup
              </h2>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <CopyField
                  label="Webhook Callback URL"
                  value={connectionView.webhookUrl}
                />
                <CopyField
                  label="Verify Token"
                  value={connectionView.verifyToken || "Save connection first"}
                />
              </div>
              <p className="mt-3 text-xs font-semibold text-[#64748b]">
                Add the callback URL and verify token in the Meta App webhook
                settings. GET verification updates last verified time when the
                saved token matches.
              </p>
            </section>

            <form
              action={saveWhatsAppConnectionAction}
              className="rounded-lg border border-[#e5e7eb] bg-white p-4"
            >
              <input
                type="hidden"
                name="brandId"
                value={selectedBrand?.id || ""}
              />
              <input
                type="hidden"
                name="provider"
                value={WHATSAPP_PROVIDER_META}
              />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-black text-[#111827]">
                    Connection credentials
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-[#64748b]">
                    Leave Access Token / App Secret blank to keep the saved
                    secret.
                  </p>
                </div>
                <StatusBadge tone={connection ? "green" : "amber"}>
                  {connection ? "Saved connection" : "New connection"}
                </StatusBadge>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <Field
                  label="WABA ID"
                  name="wabaId"
                  required
                  defaultValue={connection?.waba_id}
                />
                <Field
                  label="Phone Number ID"
                  name="phoneNumberId"
                  required
                  defaultValue={connection?.phone_number_id}
                />
                <Field
                  label="Display Phone Number"
                  name="displayPhoneNumber"
                  required
                  defaultValue={connection?.display_phone_number}
                />
                <Field
                  label="Meta App ID"
                  name="appId"
                  defaultValue={connection?.app_id}
                />
                <Field
                  label="Verify Token"
                  name="verifyToken"
                  required
                  defaultValue={connection?.verify_token}
                />
                <Field
                  label="Graph API Version"
                  name="graphApiVersion"
                  defaultValue={
                    connection?.graph_api_version || DEFAULT_GRAPH_API_VERSION
                  }
                />
                <Field
                  label="Meta App Secret"
                  name="appSecret"
                  type="password"
                  placeholder={
                    connection?.app_secret_encrypted
                      ? "Saved secret hidden"
                      : "Required for new connection"
                  }
                />
                <Field
                  label="Access Token"
                  name="accessToken"
                  type="password"
                  placeholder={
                    connection?.access_token_encrypted
                      ? "Saved token hidden"
                      : "Required for new connection"
                  }
                />
                <label className="grid gap-1 text-sm font-bold text-[#111827]">
                  Default send mode
                  <select
                    name="defaultSendMode"
                    defaultValue={
                      connection?.default_send_mode ||
                      "template_required_for_first_contact"
                    }
                    className="h-10 rounded-md border border-[#d1d5db] px-3 text-sm"
                  >
                    <option value="manual">manual</option>
                    <option value="template_required_for_first_contact">
                      template_required_for_first_contact
                    </option>
                  </select>
                </label>
              </div>

              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
                Required env var: WHATSAPP_CREDENTIAL_ENCRYPTION_KEY. Without
                it, new secrets cannot be saved.
              </div>

              <button className="mt-4 h-10 rounded-md bg-[#111827] px-4 text-sm font-black text-white">
                Save WhatsApp connection
              </button>
            </form>

            <form
              action={testWhatsAppSendAction}
              className="rounded-lg border border-[#e5e7eb] bg-white p-4"
            >
              <input
                type="hidden"
                name="brandId"
                value={selectedBrand?.id || ""}
              />
              <input
                type="hidden"
                name="connectionId"
                value={connection?.id || ""}
              />
              <h2 className="text-base font-black text-[#111827]">Test send</h2>
              <p className="mt-1 text-sm font-semibold text-[#64748b]">
                Sends one server-side WhatsApp text message when credentials are
                valid. No token is exposed to the browser.
              </p>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <Field
                  label="Test phone number"
                  name="testPhone"
                  placeholder="85291234567"
                  required
                />
                <Field
                  label="Test message"
                  name="testMessage"
                  placeholder="WhatsApp connection test"
                  required
                />
              </div>
              <button className="mt-4 h-10 rounded-md border border-[#111827] px-4 text-sm font-black text-[#111827]">
                Test WhatsApp connection
              </button>
            </form>

            <section className="rounded-lg border border-[#e5e7eb] bg-white p-4">
              <h2 className="text-base font-black text-[#111827]">
                Template readiness
              </h2>
              <p className="mt-1 text-sm font-semibold text-[#64748b]">
                First contact or messages outside the customer service window may
                require approved WhatsApp templates. Template send is prepared
                for Phase 2B and not enabled for bulk broadcast.
              </p>
              <div className="mt-3 grid gap-3 lg:grid-cols-3">
                <ReadOnlyBox label="Template name" value="booking_confirmation" />
                <ReadOnlyBox label="Language code" value="zh_HK" />
                <ReadOnlyBox label="Variables JSON" value="Coming soon" />
              </div>
            </section>
          </div>
        </div>
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
    <label className="grid gap-1 text-sm font-bold text-[#111827]">
      {label}
      <input
        type={type}
        name={name}
        required={required}
        defaultValue={defaultValue || ""}
        placeholder={placeholder}
        className="h-10 rounded-md border border-[#d1d5db] px-3 text-sm"
      />
    </label>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#e5e7eb] bg-[#f8fafc] p-3">
      <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">
        {label}
      </p>
      <p className="mt-2 break-all font-mono text-sm font-bold text-[#111827]">
        {value}
      </p>
      <div className="mt-2">
        <CopyButton value={value} label={`Copy ${label}`} />
      </div>
    </div>
  );
}

function ReadOnlyBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#e5e7eb] bg-[#f8fafc] px-3 py-2">
      <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-[#111827]">{value}</p>
    </div>
  );
}

function ProviderBadge({
  label,
  active = false,
}: {
  label: string;
  active?: boolean;
}) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-[#e5e7eb] bg-[#f8fafc] text-[#94a3b8]"
      }`}
    >
      {label}
    </span>
  );
}

function StatusBadge({
  tone,
  children,
}: {
  tone: "green" | "amber" | "red";
  children: ReactNode;
}) {
  const styles = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${styles[tone]}`}
    >
      {children}
    </span>
  );
}
