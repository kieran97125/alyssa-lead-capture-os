import { CrmShell } from "@/components/crm/CrmShell";
import { getCrmRuntimeStatus } from "@/lib/crm/store";
import {
  contactChannelOptions,
  followUpOutcomeOptions,
  invalidReasonOptions,
  lostReasonOptions,
  optionTuples,
  paidStatusOptions,
  quickReplyTemplates,
  roomOptionPlaceholders,
} from "@/lib/crm/settingsConfig";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

const channelFields = [
  ["Brand", "Configured after whatsapp_channels is deployed"],
  ["Provider", "Meta WhatsApp Cloud API"],
  ["WABA ID", "-"],
  ["Phone Number ID", "-"],
  ["Display Phone Number", "-"],
  ["Business Account ID", "-"],
  ["Token Secret Ref", "Store a secret reference only"],
  ["Webhook Status", "Pending setup"],
  ["Status", "Draft"],
];

const templateFields = [
  ["Template Name", "Future approved template"],
  ["Language", "zh_HK / en"],
  ["Category", "marketing / utility / authentication"],
  ["Status", "Draft / submitted / approved / rejected"],
];

const workflowSettings = [
  ["CS status labels", "待跟進 / 已聯絡 / 已預約 / 已到店 / No-show / 已流失 / 無效"],
  ["Contact channels", "phone / WhatsApp / Inbox / other"],
  ["Follow-up outcomes", "reached / no_answer / replied / pending / other"],
  ["Lost reasons", "no_reply / price_concern / time_not_fit / location_not_fit / changed_mind / duplicate / other"],
  ["Invalid reasons", "fake_contact / wrong_number / spam / duplicate / other"],
  ["Paid status", "unknown / unpaid / paid"],
];

const replySettings = [
  ["WhatsApp quick replies", "Future brand-approved manual reply templates"],
  ["AI reply tone", "Friendly, concise, Hong Kong Traditional Chinese"],
  ["Booking confirmation", "Future confirmation template by brand and branch"],
  ["Treatment FAQ replies", "Future treatment-specific FAQ and policy replies"],
  ["Branch / room options", "Future branch room labels for CS booking confirmation"],
];

const configModulePreview = [
  ["Contact channels", optionTuples(contactChannelOptions).map(([, label]) => label).join(" / ")],
  ["Follow-up outcomes", optionTuples(followUpOutcomeOptions).map(([, label]) => label).join(" / ")],
  ["Lost reasons", optionTuples(lostReasonOptions).map(([, label]) => label).join(" / ")],
  ["Invalid reasons", optionTuples(invalidReasonOptions).map(([, label]) => label).join(" / ")],
  ["Paid status", optionTuples(paidStatusOptions).map(([, label]) => label).join(" / ")],
  ["Room placeholders", optionTuples(roomOptionPlaceholders).map(([, label]) => label).join(" / ")],
  ["Quick replies", quickReplyTemplates.map((item) => item.title).join(" / ")],
];

export default async function CrmSettingsPage() {
  const runtime = await getCrmRuntimeStatus();

  return (
    <CrmShell active="settings">
      <div className="flex h-screen min-w-0 flex-col">
        <header className="shrink-0 border-b border-[#e5e7eb] bg-white px-4 py-2.5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-lg font-bold text-[#111827]">
                WhatsApp Channel Settings
              </h1>
              <p className="mt-1 text-[11px] font-semibold text-[#64748b]">
                Configure channel architecture without exposing raw tokens or calling WhatsApp APIs.
              </p>
            </div>
            <span className="w-fit rounded-md bg-[#fef3c7] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#92400e]">
              {runtime.actionsEnabled ? "CS actions enabled" : "Writes disabled"}
            </span>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-auto p-3.5">
          <div className="grid gap-3.5 xl:grid-cols-[1.1fr_0.9fr]">
            <SettingsPanel
              title="WhatsApp Channels"
              description="Channel records will live in whatsapp_channels. Token values must stay in a secure secret manager; the CRM should only store a secret reference."
            >
              <div className="grid gap-2 sm:grid-cols-2">
                {channelFields.map(([label, value]) => (
                  <ReadOnlyField key={label} label={label} value={value} />
                ))}
              </div>
            </SettingsPanel>

            <SettingsPanel
              title="Message Templates"
              description="Template metadata can be mirrored from Meta later. This screen does not submit templates or send messages."
            >
              <div className="grid gap-2">
                {templateFields.map(([label, value]) => (
                  <ReadOnlyField key={label} label={label} value={value} />
                ))}
              </div>
            </SettingsPanel>

            <SettingsPanel
              title="Webhook Events"
              description="Future webhook payloads can be stored in whatsapp_webhook_events before processing into CRM contacts, cases, and interactions."
            >
              <div className="grid gap-2 sm:grid-cols-3">
                <ReadOnlyField label="Event Type" value="messages / statuses" />
                <ReadOnlyField label="Processing" value="Not connected" />
                <ReadOnlyField label="Raw Payload" value="Stored server-side only" />
              </div>
            </SettingsPanel>

            <SettingsPanel
              title="CS Workflow Settings Foundation"
              description="Read-only planning view for future app settings. Current CRM uses safe code defaults; no settings are saved from this page."
            >
              <div className="grid gap-2">
                {workflowSettings.map(([label, value]) => (
                  <ReadOnlyField key={label} label={label} value={value} />
                ))}
              </div>
            </SettingsPanel>

            <SettingsPanel
              title="Current Config Module Defaults"
              description="These values now come from src/lib/crm/settingsConfig.ts. They are still code defaults until a reviewed settings table is applied."
            >
              <div className="grid gap-2">
                {configModulePreview.map(([label, value]) => (
                  <ReadOnlyField key={label} label={label} value={value} />
                ))}
              </div>
            </SettingsPanel>

            <SettingsPanel
              title="Reply Drafts / AI Assist Foundation"
              description="Planning area for future quick replies and AI-assisted drafts. Nothing is auto-sent and no external AI API is connected here."
            >
              <div className="grid gap-2">
                {replySettings.map(([label, value]) => (
                  <ReadOnlyField key={label} label={label} value={value} />
                ))}
              </div>
            </SettingsPanel>

            <SettingsPanel
              title="Security Boundary"
              description="No token value input is active in this version. Token setup should be a future secure admin step."
            >
              <ul className="grid gap-2 text-[12px] font-semibold leading-5 text-[#475569]">
                <li>Store a secret reference only, not the token value.</li>
                <li>Store a hashed webhook verify token only.</li>
                <li>No Meta / WhatsApp API calls are made from this page.</li>
                <li>No send-message endpoint is enabled.</li>
              </ul>
            </SettingsPanel>
          </div>
        </div>
      </div>
    </CrmShell>
  );
}

function SettingsPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[#e5e7eb] bg-white shadow-sm">
      <div className="border-b border-[#eef2f6] px-3.5 py-2.5">
        <h2 className="text-[13px] font-bold text-[#111827]">{title}</h2>
        <p className="mt-1 text-[11px] font-semibold leading-5 text-[#64748b]">
          {description}
        </p>
      </div>
      <div className="p-3.5">{children}</div>
    </section>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#64748b]">
        {label}
      </span>
      <input
        disabled
        defaultValue={value}
        className="mt-1.5 h-8 w-full rounded-md border border-[#e5e7eb] bg-[#f8fafc] px-2.5 text-[12px] font-semibold text-[#475569]"
      />
    </label>
  );
}
