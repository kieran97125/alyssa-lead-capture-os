import { CrmShell } from "@/components/crm/CrmShell";
import { getCrmSettings } from "@/lib/crm/settingsLoader";
import { getCrmRuntimeStatus } from "@/lib/crm/store";
import { optionTuples } from "@/lib/crm/settingsConfig";
import {
  getBrand,
  getConfigurationData,
  packagePriceLabel,
  type BrandSetting,
  type BranchSetting,
  type PackageSetting,
  type TreatmentSetting,
} from "@/lib/data/configuration";
import { getBrandLegalProfileFromSettings } from "@/lib/legal/consent";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

type StatusTone = "green" | "amber" | "blue" | "slate" | "red";

const sections = [
  ["overview", "Overview"],
  ["brands", "Brand"],
  ["treatments", "Treatment"],
  ["whatsapp", "WhatsApp"],
  ["ai", "AI Replies"],
  ["booking", "Booking"],
  ["inbox", "Inbox"],
  ["team", "Team"],
  ["technical", "Developer"],
] as const;

const overviewItems = [
  ["Brand setup", "Preview only", "blue"],
  ["Treatment setup", "Preview only", "blue"],
  ["WhatsApp connection", "Not connected", "amber"],
  ["AI replies", "Template draft only", "green"],
  ["Booking workflow", "Code defaults active", "green"],
  ["Inbox presets", "Code defaults active", "green"],
  ["Team permissions", "Planned", "slate"],
  ["DB editable settings", "Not applied", "amber"],
] as const;

const whatsappMockFields = [
  ["Connection mode", "Manual open currently active"],
  ["API provider", "Not connected"],
  ["WhatsApp phone number", "Future setting"],
  ["Business Account ID", "Not connected"],
  ["Webhook URL", "Not connected"],
  ["Message templates", "Planned"],
] as const;

const aiMockFields = [
  ["AI mode", "Template draft only"],
  ["Brand tone", "Friendly, concise, Hong Kong Traditional Chinese"],
  ["Reply language", "Traditional Chinese"],
  ["Forbidden claims", "No guaranteed treatment results"],
  ["Price handling rules", "Use approved offer/package wording only"],
  ["Treatment FAQ knowledge source", "Future treatment settings"],
  ["External AI API", "Not connected"],
] as const;

const teamPermissionRows = [
  ["CS role", "Follow up leads, confirm bookings, mark outcomes, use manual replies"],
  ["Marketing role", "Review simple reports and source ranking"],
  ["Admin role", "Future settings editor access"],
  ["Who can edit settings", "Future admin-only mutation boundary"],
  ["Who can view technical audit", "Future admin / marketing permission"],
  ["Who can connect WhatsApp API", "Future owner/admin-only permission"],
  ["Who can send messages", "No API sending exists yet"],
] as const;

export default async function CrmSettingsPage() {
  const [runtime, crmSettings, config] = await Promise.all([
    getCrmRuntimeStatus(),
    getCrmSettings(),
    getConfigurationData(),
  ]);
  const brands = config.brands.slice(0, 6);
  const treatmentRows = config.treatments.slice(0, 8).map((treatment) => {
    const brand = getBrand(config, treatment.brandId);
    const packages = config.packages.filter((item) => item.treatmentId === treatment.id);
    const branches = brand
      ? config.branches.filter((branch) => branch.brandId === brand.id)
      : [];
    return { treatment, brand, packages, branches };
  });
  const bookingOptionGroups = [
    ["Paid status options", optionTuples(crmSettings.paidStatusOptions)],
    ["Room options", optionTuples(crmSettings.roomOptionPlaceholders)],
    ["Lost reasons", optionTuples(crmSettings.lostReasonOptions)],
    ["Invalid reasons", optionTuples(crmSettings.invalidReasonOptions)],
    ["Contact channels", optionTuples(crmSettings.contactChannelOptions)],
    ["Follow-up outcomes", optionTuples(crmSettings.followUpOutcomeOptions)],
  ] as const;

  return (
    <CrmShell active="settings">
      <div className="flex h-screen min-w-0 flex-col bg-[#f8fafc]">
        <header className="shrink-0 border-b border-[#e5e7eb] bg-white px-5 py-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#64748b]">
                CRM Settings
              </p>
              <h1 className="mt-1 text-xl font-black text-[#111827]">
                Settings Editor Mock UX
              </h1>
              <p className="mt-1 text-[12px] font-semibold text-[#64748b]">
                設定中心預覽。欄位以可編輯介面展示，但目前全部為 mock only，未儲存到 DB。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone="amber">Mock only / 未啟用儲存</StatusBadge>
              <StatusBadge tone={runtime.actionsEnabled ? "green" : "amber"}>
                {runtime.actionsEnabled ? "CS actions enabled" : "Writes disabled"}
              </StatusBadge>
              <StatusBadge tone={settingsSourceTone(crmSettings.status.activeSource)}>
                {crmSettings.status.label}
              </StatusBadge>
            </div>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[244px_1fr]">
          <aside className="hidden border-r border-[#e5e7eb] bg-white p-3 lg:block">
            <div className="sticky top-3 grid gap-1">
              {sections.map(([href, label]) => (
                <a
                  key={href}
                  href={`#${href}`}
                  className="rounded-md px-3 py-2 text-[12px] font-bold text-[#475569] transition hover:bg-[#f1f5f9] hover:text-[#111827]"
                >
                  {label}
                </a>
              ))}
              <div className="mt-3 rounded-lg border border-[#fef3c7] bg-[#fffbeb] p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#92400e]">
                  Safe mode
                </p>
                <p className="mt-1 text-[12px] font-bold text-[#111827]">
                  No DB save
                </p>
                <p className="mt-1 text-[11px] leading-4 text-[#92400e]">
                  crm_app_settings table is not required. Code defaults remain the safety net.
                </p>
              </div>
            </div>
          </aside>

          <main className="min-h-0 overflow-auto p-4">
            <div className="mx-auto grid max-w-7xl gap-4">
              <SettingsSection
                id="overview"
                eyebrow="Control Center"
                title="Overview"
                description="高層次 readiness cards。全部狀態只供 admin preview，不會執行任何設定更新。"
              >
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {overviewItems.map(([label, status, tone]) => (
                    <ReadinessCard
                      key={label}
                      title={label}
                      status={status}
                      tone={tone}
                    />
                  ))}
                </div>
              </SettingsSection>

              <SettingsSection
                id="brands"
                eyebrow="Brand"
                title="Brand Settings"
                description="Mock editor for brand-level settings. Existing data is shown where available; save is disabled."
              >
                <div className="grid gap-3 xl:grid-cols-2">
                  {brands.map((brand) => (
                    <BrandEditorCard
                      key={brand.id}
                      brand={brand}
                      branches={config.branches.filter((branch) => branch.brandId === brand.id)}
                    />
                  ))}
                </div>
              </SettingsSection>

              <SettingsSection
                id="treatments"
                eyebrow="Treatment"
                title="Treatment Settings"
                description="Mock editor for offer, booking, room, FAQ, pre-treatment, and aftercare settings."
              >
                <div className="grid gap-3">
                  {treatmentRows.map(({ treatment, brand, packages, branches }) => (
                    <TreatmentEditorCard
                      key={treatment.id}
                      treatment={treatment}
                      brand={brand}
                      packages={packages}
                      branches={branches}
                    />
                  ))}
                </div>
              </SettingsSection>

              <SettingsSection
                id="whatsapp"
                eyebrow="Messaging"
                title="WhatsApp Settings"
                description="Future-ready WhatsApp API settings UI. Manual WhatsApp open remains the only active behavior."
              >
                <ImportantNotice>
                  目前只支援手動開啟 WhatsApp，並未連接 WhatsApp API；訊息仍需人手複製及發送。
                </ImportantNotice>
                <div className="grid gap-3 xl:grid-cols-2">
                  {whatsappMockFields.map(([label, value]) => (
                    <MockInput key={label} label={label} value={value} />
                  ))}
                  <MockToggle label="Auto-reply" checked={false} />
                  <MockToggle label="Human approval required" checked />
                </div>
                <DisabledSaveBar />
              </SettingsSection>

              <SettingsSection
                id="ai"
                eyebrow="AI Assist"
                title="AI Reply Settings"
                description="Template draft settings UI only. No external AI API, no auto-send."
              >
                <ImportantNotice>
                  AI 回覆只係草稿，必須由 CS 人手檢查、複製及發送。
                </ImportantNotice>
                <div className="grid gap-3 xl:grid-cols-2">
                  {aiMockFields.map(([label, value]) => (
                    <MockInput key={label} label={label} value={value} />
                  ))}
                  <MockToggle label="Human approval required" checked />
                  <MockToggle label="Auto-send" checked={false} />
                </div>
                <div className="mt-3 grid gap-2 lg:grid-cols-2">
                  {crmSettings.quickReplyTemplates.slice(0, 4).map((template) => (
                    <MockTextarea
                      key={template.key}
                      label={`${template.group} / ${template.title}`}
                      value={template.body}
                    />
                  ))}
                </div>
                <DisabledSaveBar />
              </SettingsSection>

              <SettingsSection
                id="booking"
                eyebrow="Workflow"
                title="Booking Settings"
                description="Mock editor for CRM status labels, booking rules, paid status, room options, lost/invalid reasons, and follow-up outcomes."
              >
                <div className="grid gap-3 xl:grid-cols-2">
                  <MockTextarea
                    label="Confirm booking rules"
                    value="Form submission is pending follow-up. Customer preferred date/time is not booked. CS must confirm before status becomes booked."
                  />
                  <MockTextarea
                    label="Show / no-show rules"
                    value="Show / no-show can only be marked after CS confirmed booking and appointment time has passed."
                  />
                  {bookingOptionGroups.map(([title, values]) => (
                    <OptionEditor key={title} title={title} values={values} />
                  ))}
                  <MockTextarea
                    label="Reminder templates"
                    value="Future reminder templates by brand, branch, treatment, and confirmed appointment time."
                  />
                </div>
                <DisabledSaveBar />
              </SettingsSection>

              <SettingsSection
                id="inbox"
                eyebrow="Inbox"
                title="Inbox Settings"
                description="Mock editor for column presets and future user/team preferences."
              >
                <div className="grid gap-3 lg:grid-cols-3">
                  {crmSettings.inboxColumnPresets.map((preset) => (
                    <PresetEditorCard
                      key={preset.key}
                      title={preset.label}
                      body={preset.description}
                      active={preset.key === "cs_booking"}
                    />
                  ))}
                </div>
                <div className="mt-3 grid gap-3 xl:grid-cols-2">
                  <MockInput label="Default inbox view" value="CS Booking View" />
                  <MockInput label="Future preference scope" value="User-level or brand-level preset" />
                  <MockTextarea
                    label="Column visibility note"
                    value="Future editable settings can control CS, Marketing, and Technical column presets without changing CRM code."
                  />
                </div>
                <DisabledSaveBar />
              </SettingsSection>

              <SettingsSection
                id="team"
                eyebrow="Access"
                title="Team & Permissions"
                description="Future-ready permission settings UI. No real auth or permission logic changes in this phase."
              >
                <div className="grid gap-3 xl:grid-cols-2">
                  {teamPermissionRows.map(([label, value]) => (
                    <MockInput key={label} label={label} value={value} />
                  ))}
                </div>
                <DisabledSaveBar />
              </SettingsSection>

              <SettingsSection
                id="technical"
                eyebrow="Developer"
                title="Technical / Developer Notes"
                description="Implementation status and safety boundary. Technical details stay away from CS workflows."
              >
                <div className="grid gap-3 lg:grid-cols-2">
                  <TechCard
                    title="Settings loader"
                    rows={[
                      ["Active source", crmSettings.status.label],
                      ["DB attempted", crmSettings.status.dbAttempted ? "Yes" : "No"],
                      ["DB available", crmSettings.status.dbAvailable ? "Yes" : "No"],
                      ["DB rows loaded", String(crmSettings.status.dbRowsLoaded)],
                      ["Warning", crmSettings.status.warning ?? "No warning"],
                    ]}
                  />
                  <TechCard
                    title="Apply status"
                    rows={[
                      ["crm_app_settings SQL proposal", "docs/CRM_PHASE_3_0_EDITABLE_SETTINGS_PLAN.sql"],
                      ["DB settings table", "Not required yet"],
                      ["Live mutation", "Disabled"],
                      ["Code defaults", "Safety net active"],
                      ["WhatsApp API", "Not connected"],
                      ["External AI API", "Not connected"],
                      ["Meta event sending", "Not connected"],
                    ]}
                  />
                </div>
              </SettingsSection>
            </div>
          </main>
        </div>
      </div>
    </CrmShell>
  );
}

function SettingsSection({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-4 rounded-xl border border-[#e5e7eb] bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-[#eef2f6] px-4 py-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#64748b]">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-[15px] font-black text-[#111827]">{title}</h2>
          <p className="mt-1 text-[12px] font-semibold leading-5 text-[#64748b]">
            {description}
          </p>
        </div>
        <StatusBadge tone="amber">Mock editor / Coming soon</StatusBadge>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function ReadinessCard({
  title,
  status,
  tone,
}: {
  title: string;
  status: string;
  tone: StatusTone;
}) {
  return (
    <article className="rounded-lg border border-[#e5e7eb] bg-[#fbfdff] p-3">
      <p className="text-[12px] font-black text-[#111827]">{title}</p>
      <div className="mt-2">
        <StatusBadge tone={tone}>{status}</StatusBadge>
      </div>
    </article>
  );
}

function BrandEditorCard({
  brand,
  branches,
}: {
  brand: BrandSetting;
  branches: BranchSetting[];
}) {
  const legalProfile = getBrandLegalProfileFromSettings(brand);

  return (
    <article className="rounded-lg border border-[#e5e7eb] bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-black text-[#111827]">{brand.name}</p>
          <p className="mt-0.5 font-mono text-[10px] font-semibold text-[#64748b]">
            {brand.slug}
          </p>
        </div>
        <StatusBadge tone="blue">Preview only</StatusBadge>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <MockInput label="Brand name" value={brand.name} />
        <MockInput label="Brand slug" value={brand.slug} />
        <MockInput
          label="Legal company name"
          value={legalProfile.operatingCompanyName ?? "YISSA GROUP LIMITED"}
        />
        <MockInput label="Default language" value="zh-HK / Traditional Chinese" />
        <MockInput label="Default WhatsApp contact" value={brand.whatsappNumber || "Future setting"} />
        <MockTextarea
          label="Booking policy note"
          value="CS confirmation is required before a lead becomes booked."
        />
        <MockTextarea
          label="Branch list / display names"
          value={compactList(branches.map((item) => item.name), "No branch configured")}
        />
      </div>
      <DisabledSaveBar />
    </article>
  );
}

function TreatmentEditorCard({
  treatment,
  brand,
  packages,
  branches,
}: {
  treatment: TreatmentSetting;
  brand: BrandSetting | null;
  packages: PackageSetting[];
  branches: BranchSetting[];
}) {
  return (
    <article className="rounded-lg border border-[#e5e7eb] bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-black text-[#111827]">{treatment.name}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-[#64748b]">
            {brand?.name ?? "Unknown brand"} / {treatment.slug}
          </p>
        </div>
        <StatusBadge tone="blue">Preview only</StatusBadge>
      </div>
      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        <MockInput label="Treatment name" value={treatment.name} />
        <MockInput label="Offer label" value={packages[0]?.name ?? treatment.name} />
        <MockInput
          label="Price"
          value={packages.length > 0 ? packages.map((item) => packagePriceLabel(item)).join(" / ") : "Future price"}
        />
        <MockInput label="Duration" value="Future setting" />
        <MockInput
          label="Branch availability"
          value={compactList(branches.map((item) => item.name), "Future branch setting")}
        />
        <MockInput label="Room requirement" value="Future room option" />
        <MockInput label="Booking buffer" value="Future setting" />
        <MockTextarea label="FAQ reply" value="Future treatment-specific FAQ reply." />
        <MockTextarea label="Pre-treatment note" value="Future pre-treatment note." />
        <MockTextarea label="Aftercare note" value="Future aftercare note." />
      </div>
      <DisabledSaveBar />
    </article>
  );
}

function OptionEditor({
  title,
  values,
}: {
  title: string;
  values: readonly [string, string][];
}) {
  return (
    <article className="rounded-lg border border-[#e5e7eb] bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] font-black text-[#111827]">{title}</p>
        <StatusBadge tone="green">Code defaults</StatusBadge>
      </div>
      <div className="mt-3 grid gap-2">
        {values.map(([value, label]) => (
          <div key={value} className="grid gap-2 sm:grid-cols-[140px_1fr]">
            <MockInput label="Key" value={value} />
            <MockInput label="Label" value={label} />
          </div>
        ))}
      </div>
    </article>
  );
}

function PresetEditorCard({
  title,
  body,
  active,
}: {
  title: string;
  body: string;
  active: boolean;
}) {
  return (
    <article className="rounded-lg border border-[#e5e7eb] bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] font-black text-[#111827]">{title}</p>
        {active ? <StatusBadge tone="green">Default</StatusBadge> : <StatusBadge tone="blue">Preset</StatusBadge>}
      </div>
      <MockTextarea label="Column preset notes" value={body} />
      <button
        type="button"
        disabled
        className="mt-3 h-8 rounded-md bg-[#e5e7eb] px-3 text-[11px] font-black text-[#94a3b8]"
      >
        Edit columns coming soon
      </button>
    </article>
  );
}

function MockInput({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="text-[10px] font-black uppercase tracking-[0.08em] text-[#64748b]">
        {label}
      </span>
      <input
        disabled
        value={value}
        readOnly
        className="mt-1.5 h-8 w-full rounded-md border border-[#dbe2ea] bg-[#f8fafc] px-2.5 text-[12px] font-semibold text-[#475569]"
      />
    </label>
  );
}

function MockTextarea({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="text-[10px] font-black uppercase tracking-[0.08em] text-[#64748b]">
        {label}
      </span>
      <textarea
        disabled
        value={value}
        readOnly
        rows={3}
        className="mt-1.5 min-h-20 w-full resize-y rounded-md border border-[#dbe2ea] bg-[#f8fafc] px-2.5 py-2 text-[12px] font-semibold leading-5 text-[#475569]"
      />
    </label>
  );
}

function MockToggle({ label, checked }: { label: string; checked: boolean }) {
  return (
    <div className="rounded-lg border border-[#e5e7eb] bg-[#fbfdff] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] font-black text-[#111827]">{label}</p>
        <span
          className={`inline-flex h-5 w-9 items-center rounded-full px-0.5 ${
            checked ? "bg-emerald-500" : "bg-slate-300"
          }`}
        >
          <span
            className={`h-4 w-4 rounded-full bg-white transition ${
              checked ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </span>
      </div>
      <p className="mt-1 text-[11px] font-semibold text-[#64748b]">
        Disabled preview. Future editable setting.
      </p>
    </div>
  );
}

function DisabledSaveBar() {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#eef2f6] bg-[#f8fafc] px-3 py-2">
      <p className="text-[11px] font-semibold text-[#64748b]">
        Mock only. DB settings table not applied yet.
      </p>
      <button
        type="button"
        disabled
        className="h-8 rounded-md bg-[#e5e7eb] px-3 text-[11px] font-black text-[#94a3b8]"
      >
        Save coming soon
      </button>
    </div>
  );
}

function TechCard({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, string]>;
}) {
  return (
    <article className="rounded-lg border border-[#e5e7eb] bg-[#fbfdff] p-3">
      <p className="text-[12px] font-black text-[#111827]">{title}</p>
      <div className="mt-3 grid gap-2">
        {rows.map(([label, value]) => (
          <MockInput key={label} label={label} value={value} />
        ))}
      </div>
    </article>
  );
}

function ImportantNotice({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 rounded-lg border border-[#fef3c7] bg-[#fffbeb] px-3 py-2 text-[12px] font-semibold leading-5 text-[#92400e]">
      {children}
    </div>
  );
}

function StatusBadge({
  tone,
  children,
}: {
  tone: StatusTone;
  children: ReactNode;
}) {
  const classes = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    red: "bg-red-50 text-red-700 border-red-100",
  };

  return (
    <span className={`inline-flex w-fit items-center rounded-md border px-2 py-1 text-[10px] font-black ${classes[tone]}`}>
      {children}
    </span>
  );
}

function settingsSourceTone(source: string): StatusTone {
  if (source === "db_override") return "green";
  if (source === "db_unavailable_code_defaults") return "amber";
  return "blue";
}

function compactList(values: Array<string | null | undefined>, fallback: string) {
  const cleaned = values
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  if (cleaned.length === 0) return fallback;
  return cleaned.slice(0, 4).join(" / ") + (cleaned.length > 4 ? ` +${cleaned.length - 4}` : "");
}
