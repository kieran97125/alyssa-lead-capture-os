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
  ["brands", "Brand Profile"],
  ["treatments", "Treatment Menu"],
  ["whatsapp", "WhatsApp"],
  ["ai", "AI Replies"],
  ["booking", "Booking Workflow"],
  ["inbox", "Inbox Presets"],
  ["team", "Team Access"],
  ["technical", "Developer Notes"],
] as const;

const overviewItems = [
  [
    "Brand setup",
    "Mock only",
    "品牌資料會以現有設定展示，暫時未能在此頁儲存修改。",
    "Next: Review active DB-backed defaults.",
    "blue",
  ],
  [
    "Treatment setup",
    "Mock only",
    "療程、優惠、分店及 FAQ 會用現有設定預覽。",
    "Next: Enable editable config later.",
    "blue",
  ],
  [
    "WhatsApp connection",
    "API not connected",
    "目前只支援手動開啟 WhatsApp，沒有自動發送或同步對話。",
    "Next: Connect WhatsApp API later.",
    "amber",
  ],
  [
    "AI replies",
    "Manual only",
    "回覆內容來自預設草稿，CS 需要人手檢查、複製及發送。",
    "Next: Connect AI API later if approved.",
    "green",
  ],
  [
    "Booking workflow",
    "Active from code defaults",
    "CRM 狀態、lost / invalid reason 及跟進選項目前由 code defaults 提供。",
    "Next: Keep using defaults until DB settings are applied.",
    "green",
  ],
  [
    "Inbox presets",
    "Active from code defaults",
    "CS Booking View 等欄位 preset 目前由 code defaults 控制。",
    "Next: Save presets in settings DB later.",
    "green",
  ],
  [
    "Team permissions",
    "Coming soon",
    "現階段只展示未來權限方向，未改動任何 access control。",
    "Next: Define admin-only editing boundary.",
    "slate",
  ],
  [
    "DB editable settings",
    "DB settings applied",
    "crm_app_settings 已套用並完成 default seed；目前只讀取設定，不會儲存修改。",
    "Next: Enable admin save flow later.",
    "green",
  ],
] as const;

const whatsappMockFields = [
  ["Current mode", "Manual WhatsApp open"],
  ["API status", "Not connected"],
  ["Auto-send", "Off"],
  ["Human approval", "Required"],
  ["Template sending", "Not enabled"],
  ["Webhook sync", "Not connected"],
] as const;

const aiMockFields = [
  ["Current mode", "Template drafts only"],
  ["External AI API", "Not connected"],
  ["Auto-send", "Off"],
  ["Human approval", "Required"],
  ["Brand tone", "Friendly, concise, Hong Kong Traditional Chinese"],
  ["Reply language", "Traditional Chinese"],
  ["Forbidden claims", "No guaranteed treatment results"],
  ["Price handling rules", "Use approved offer/package wording only"],
  ["Treatment FAQ knowledge source", "Future treatment settings"],
] as const;

const recommendedSetupOrder = [
  ["1", "Brand", "確認品牌 profile、法律資料、分店及 WhatsApp 顯示資料。"],
  ["2", "Treatments", "整理療程 menu、優惠、package、分店可用性及 FAQ 草稿。"],
  ["3", "Booking rules", "確認 booked / showed / no-show / lost / invalid 的 CS 操作規則。"],
  ["4", "WhatsApp connection", "目前先用 manual open；日後才接 WhatsApp API。"],
  ["5", "AI reply templates", "先整理人工審核用草稿，日後才接外部 AI API。"],
  ["6", "Inbox presets", "決定 CS Booking View、Marketing View 及 Technical Audit View 的欄位。"],
  ["7", "Team permissions", "最後才定義誰可編輯設定、查看報表及管理 API connection。"],
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
  const settingsModeBadge =
    crmSettings.status.activeSource === "db_defaults" ||
    crmSettings.status.activeSource === "db_override"
      ? "DB settings loaded"
      : "Code defaults fallback";

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
                設定中心預覽。DB default settings 已可讀取；此頁仍然 read-only，不會儲存任何改動。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone="green">{settingsModeBadge}</StatusBadge>
              <StatusBadge tone="amber">Mock only</StatusBadge>
              <StatusBadge tone="amber">Save not enabled</StatusBadge>
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
                  Save not enabled
                </p>
                <p className="mt-1 text-[11px] leading-4 text-[#92400e]">
                  Settings DB is applied and seeded. Changes still cannot be saved; code defaults remain fallback.
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
                description="Admin-friendly readiness view. It shows DB-backed defaults, read-only editor status, and the safest setup order."
              >
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {overviewItems.map(([label, status, explanation, nextAction, tone]) => (
                    <ReadinessCard
                      key={label}
                      title={label}
                      status={status}
                      explanation={explanation}
                      nextAction={nextAction}
                      tone={tone}
                    />
                  ))}
                </div>
                <RecommendedSetupOrder />
              </SettingsSection>

              <SettingsSection
                id="brands"
                eyebrow="Brand"
                title="Brand Profile & Branch Setup"
                description="Brand profile, legal entity, contact display, and branch setup preview. Existing data is read-only here."
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
                title="Treatment Menu / Package Setup"
                description="Treatment menu, offer/package, branch availability, FAQ, pre-treatment, and aftercare setup preview."
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
                title="WhatsApp Mode, Connection & Templates"
                description="Connection, template, and manual/API mode preview. Manual WhatsApp open is the only active behavior."
              >
                <ImportantNotice>
                  目前只會協助 CS 開啟 WhatsApp，訊息仍需人手複製及發送。
                </ImportantNotice>
                <StatusRow
                  items={[
                    ["Manual only", "blue"],
                    ["API not connected", "amber"],
                    ["Auto-send off", "slate"],
                    ["Save not enabled", "amber"],
                  ]}
                />
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
                title="AI Reply Tone, Knowledge & Safety"
                description="Tone, reply knowledge, safety rules, and template draft preview. No external AI API is connected."
              >
                <ImportantNotice>
                  目前 AI 回覆只係預設草稿，不會自動回覆客人。
                </ImportantNotice>
                <StatusRow
                  items={[
                    ["Manual only", "blue"],
                    ["API not connected", "amber"],
                    ["Auto-send off", "slate"],
                    ["Save not enabled", "amber"],
                  ]}
                />
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
                title="Booking Status, Reasons, Rooms & Rules"
                description="Booking workflow preview for status labels, paid status, room options, lost/invalid reasons, and follow-up outcomes."
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
                title="Inbox Column Presets & CS View Preferences"
                description="Inbox column presets and future CS view preferences. Current CS Booking View still comes from code defaults."
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
                title="Team Roles & Access Control"
                description="Future team settings preview. This phase does not change login, roles, or permissions."
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
                description="Implementation status and safety boundary. Technical details stay separated from admin setup and CS workflows."
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
                      ["settingsLoader fallback", "Active"],
                      ["Code defaults", "Active fallback"],
                      ["crm_app_settings SQL proposal", "docs/CRM_PHASE_3_0_EDITABLE_SETTINGS_PLAN.sql"],
                      ["SQL proposal status", "Applied manually"],
                      ["crm_app_settings schema", "Applied"],
                      ["Default settings seed", "Applied manually"],
                      ["Live mutation", "Disabled"],
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
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone="amber">Mock only</StatusBadge>
          <StatusBadge tone="amber">Save not enabled</StatusBadge>
        </div>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function ReadinessCard({
  title,
  status,
  explanation,
  nextAction,
  tone,
}: {
  title: string;
  status: string;
  explanation: string;
  nextAction: string;
  tone: StatusTone;
}) {
  return (
    <article className="rounded-lg border border-[#e5e7eb] bg-[#fbfdff] p-3">
      <p className="text-[12px] font-black text-[#111827]">{title}</p>
      <div className="mt-2">
        <StatusBadge tone={tone}>{status}</StatusBadge>
      </div>
      <p className="mt-2 text-[11px] font-semibold leading-5 text-[#475569]">
        {explanation}
      </p>
      <p className="mt-2 rounded-md bg-white px-2 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-[#64748b]">
        {nextAction}
      </p>
    </article>
  );
}

function StatusRow({ items }: { items: Array<[string, StatusTone]> }) {
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {items.map(([label, tone]) => (
        <StatusBadge key={label} tone={tone}>
          {label}
        </StatusBadge>
      ))}
    </div>
  );
}

function RecommendedSetupOrder() {
  return (
    <article className="mt-3 rounded-lg border border-[#e5e7eb] bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[12px] font-black text-[#111827]">
            Recommended next setup order
          </p>
          <p className="mt-1 text-[11px] font-semibold leading-5 text-[#64748b]">
            建議先整理業務資料，再處理連接、草稿、欄位同權限；所有項目目前仍然不會儲存。
          </p>
        </div>
        <StatusBadge tone="amber">Save not enabled</StatusBadge>
      </div>
      <ol className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {recommendedSetupOrder.map(([step, title, body]) => (
          <li
            key={step}
            className="grid grid-cols-[28px_1fr] gap-2 rounded-lg border border-[#eef2f6] bg-[#fbfdff] p-2"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#5A2348] text-[11px] font-black text-white">
              {step}
            </span>
            <span>
              <span className="block text-[12px] font-black text-[#111827]">{title}</span>
              <span className="mt-0.5 block text-[11px] font-semibold leading-4 text-[#64748b]">
                {body}
              </span>
            </span>
          </li>
        ))}
      </ol>
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
        <StatusBadge tone="blue">Mock only</StatusBadge>
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
        <StatusBadge tone="blue">Mock only</StatusBadge>
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
        <StatusBadge tone="green">Active from code defaults</StatusBadge>
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
        {active ? (
          <StatusBadge tone="green">Active from code defaults</StatusBadge>
        ) : (
          <StatusBadge tone="blue">Mock only</StatusBadge>
        )}
      </div>
      <MockTextarea label="Column preset notes" value={body} />
      <button
        type="button"
        disabled
        className="mt-3 h-8 rounded-md bg-[#e5e7eb] px-3 text-[11px] font-black text-[#94a3b8]"
      >
        儲存尚未啟用
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
        Read-only preview. Changes cannot be saved yet.
      </p>
    </div>
  );
}

function DisabledSaveBar() {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#eef2f6] bg-[#f8fafc] px-3 py-2">
      <p className="text-[11px] font-semibold text-[#64748b]">
        Mock only. Changes cannot be saved yet; active CRM still uses code defaults.
      </p>
      <button
        type="button"
        disabled
        className="h-8 rounded-md bg-[#e5e7eb] px-3 text-[11px] font-black text-[#94a3b8]"
      >
        儲存尚未啟用
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
  if (source === "db_defaults") return "green";
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
