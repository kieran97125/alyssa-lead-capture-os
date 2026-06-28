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
  ["brands", "Brand Settings"],
  ["treatments", "Treatment Settings"],
  ["whatsapp", "WhatsApp Settings"],
  ["ai", "AI Reply Settings"],
  ["booking", "Booking Settings"],
  ["inbox", "Inbox Settings"],
  ["team", "Team & Permissions"],
  ["technical", "Technical Notes"],
] as const;

const whatsappFields = [
  ["Connection mode", "Manual open currently active", "green"],
  ["API provider", "Not connected", "amber"],
  ["WhatsApp phone number", "Future setting", "slate"],
  ["Business account ID", "Not connected", "slate"],
  ["Message templates", "Planned", "blue"],
  ["Webhook status", "Not connected", "amber"],
  ["Auto-reply", "Off", "slate"],
  ["Human approval required", "On", "green"],
] as const;

const aiFields = [
  ["AI mode", "Template drafts only", "green"],
  ["External AI API", "Not connected", "amber"],
  ["Brand tone", "Friendly, concise, Hong Kong Traditional Chinese", "blue"],
  ["Reply language", "Traditional Chinese / English ready", "blue"],
  ["Forbidden claims", "No guaranteed treatment results", "green"],
  ["Price handling rules", "Use approved offer/package wording only", "green"],
  ["Treatment FAQ knowledge", "Planned settings library", "blue"],
  ["Human approval required", "On", "green"],
  ["Auto-send", "Off", "green"],
] as const;

const teamPermissionRows = [
  ["CS role", "Can follow up leads, confirm bookings, mark outcomes, use manual replies."],
  ["Marketing role", "Can review reports and technical tracking audit when enabled."],
  ["Admin role", "Can manage settings after editable DB config is applied."],
  ["Who can edit settings", "Future admin-only mutation boundary."],
  ["Who can view technical audit", "Future admin / marketing permission."],
  ["Who can connect WhatsApp API", "Future owner/admin-only permission with secret storage."],
  ["Who can send messages", "No API sending exists yet. Manual WhatsApp only."],
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
  const overviewCards = [
    ["Brand setup", config.brands.length > 0 ? "Ready from existing data" : "Planned", config.brands.length > 0 ? "green" : "blue"],
    ["Treatment setup", config.treatments.length > 0 ? "Ready from existing data" : "Planned", config.treatments.length > 0 ? "green" : "blue"],
    ["WhatsApp connection", "Manual open active / API not connected", "amber"],
    ["AI reply templates", "Ready from code defaults", "green"],
    ["Booking workflow", runtime.actionsEnabled ? "CRM actions enabled" : "Read-only / writes disabled", runtime.actionsEnabled ? "green" : "amber"],
    ["Inbox presets", "Ready from settings loader", "green"],
    ["Team permissions", "Planned", "blue"],
    ["DB editable settings", crmSettings.status.dbAvailable ? "DB readable" : "Needs DB settings table", crmSettings.status.dbAvailable ? "green" : "amber"],
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
                Settings Control Center
              </h1>
              <p className="mt-1 text-[12px] font-semibold text-[#64748b]">
                管理 CRM 未來可編輯設定的 read-only control center。現階段不會儲存設定、不連接 WhatsApp API、不使用外部 AI。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
              <div className="mt-3 rounded-lg border border-[#e5e7eb] bg-[#f8fafc] p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#64748b]">
                  Active source
                </p>
                <p className="mt-1 text-[12px] font-bold text-[#111827]">
                  {crmSettings.status.label}
                </p>
                <p className="mt-1 text-[11px] leading-4 text-[#64748b]">
                  {crmSettings.status.warning ?? "DB config optional. Code defaults remain fallback."}
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
                description="高層次 readiness view。這裡只顯示狀態，不會儲存或套用任何設定。"
              >
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {overviewCards.map(([label, status, tone]) => (
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
                description="品牌資料目前來自現有設定 / database fallback。未來可由 App Settings 做 brand-level override。"
              >
                <div className="grid gap-3 xl:grid-cols-2">
                  {brands.map((brand) => (
                    <BrandCard
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
                description="療程、優惠、分店可用性與 FAQ/護理資訊的 future settings surface。現階段只讀現有資料。"
              >
                <div className="overflow-hidden rounded-lg border border-[#e5e7eb] bg-white">
                  <table className="min-w-full text-left text-[12px]">
                    <thead className="bg-[#f8fafc] text-[10px] font-black uppercase tracking-[0.08em] text-[#64748b]">
                      <tr>
                        <th className="px-3 py-2">Treatment</th>
                        <th className="px-3 py-2">Brand</th>
                        <th className="px-3 py-2">Offer price</th>
                        <th className="px-3 py-2">Availability</th>
                        <th className="px-3 py-2">Future settings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {treatmentRows.map(({ treatment, brand, packages, branches }) => (
                        <TreatmentRow
                          key={treatment.id}
                          treatment={treatment}
                          brand={brand}
                          packages={packages}
                          branches={branches}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </SettingsSection>

              <SettingsSection
                id="whatsapp"
                eyebrow="Messaging"
                title="WhatsApp Settings"
                description="目前只支援手動開啟 WhatsApp；未連接 WhatsApp API、Webhook 或自動發送。"
              >
                <ImportantNotice>
                  目前只支援 CS 手動開啟 WhatsApp，並不代表已連接 WhatsApp API；訊息仍需人手複製及發送。
                </ImportantNotice>
                <FieldGrid fields={whatsappFields} />
              </SettingsSection>

              <SettingsSection
                id="ai"
                eyebrow="AI Assist"
                title="AI Reply Settings"
                description="AI 回覆目前是 template-based draft only。未連接外部 AI API，不會自動發送。"
              >
                <ImportantNotice>
                  AI replies are drafts only。CS 必須自行檢查、複製，再用 WhatsApp 手動發送。
                </ImportantNotice>
                <FieldGrid fields={aiFields} />
                <div className="mt-3 grid gap-2 lg:grid-cols-2">
                  {crmSettings.quickReplyTemplates.slice(0, 4).map((template) => (
                    <PreviewCard
                      key={template.key}
                      title={template.title}
                      meta={template.group}
                      body={template.useCase}
                    />
                  ))}
                </div>
              </SettingsSection>

              <SettingsSection
                id="booking"
                eyebrow="Workflow"
                title="Booking Settings"
                description="Booking-first CS workflow settings。現階段由 settingsLoader + code defaults 提供。"
              >
                <div className="grid gap-3 xl:grid-cols-2">
                  <OptionPanel title="Paid status options" values={optionTuples(crmSettings.paidStatusOptions)} />
                  <OptionPanel title="Room options" values={optionTuples(crmSettings.roomOptionPlaceholders)} />
                  <OptionPanel title="Lost reasons" values={optionTuples(crmSettings.lostReasonOptions)} />
                  <OptionPanel title="Invalid reasons" values={optionTuples(crmSettings.invalidReasonOptions)} />
                  <OptionPanel title="Contact channels" values={optionTuples(crmSettings.contactChannelOptions)} />
                  <OptionPanel title="Follow-up outcomes" values={optionTuples(crmSettings.followUpOutcomeOptions)} />
                </div>
                <div className="mt-3 rounded-lg border border-[#e5e7eb] bg-[#f8fafc] p-3">
                  <p className="text-[12px] font-bold text-[#111827]">Booking rules</p>
                  <p className="mt-1 text-[12px] leading-5 text-[#64748b]">
                    Form submission = 待跟進。客人選擇的日期時間只是偏好；只有 CS 確認後才是已預約。Show / no-show 只可以在已確認預約時間後由 CS 操作。
                  </p>
                </div>
              </SettingsSection>

              <SettingsSection
                id="inbox"
                eyebrow="Inbox"
                title="Inbox Settings"
                description="Column presets are read through the fallback settings loader. Persistence is planned, not active."
              >
                <div className="grid gap-3 lg:grid-cols-3">
                  {crmSettings.inboxColumnPresets.map((preset) => (
                    <PresetCard
                      key={preset.key}
                      title={preset.label}
                      body={preset.description}
                      active={preset.key === "cs_booking"}
                    />
                  ))}
                </div>
                <div className="mt-3 rounded-lg border border-[#e5e7eb] bg-white p-3">
                  <FieldLabel label="Default view" value="CS Booking View" />
                  <FieldLabel label="Future" value="Save user/team column preferences after editable settings table is applied." />
                </div>
              </SettingsSection>

              <SettingsSection
                id="team"
                eyebrow="Access"
                title="Team & Permissions"
                description="Future permission model preview only. No auth or role behavior is changed in this phase."
              >
                <div className="grid gap-2 lg:grid-cols-2">
                  {teamPermissionRows.map(([label, value]) => (
                    <FieldLabel key={label} label={label} value={value} />
                  ))}
                </div>
              </SettingsSection>

              <SettingsSection
                id="technical"
                eyebrow="Developer"
                title="Technical / Developer Notes"
                description="SQL/apply plan and loader status stay here, away from the main admin UX."
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
                      ["DB settings table", "Not required / not applied by this phase"],
                      ["SQL proposal", "docs/CRM_PHASE_3_0_EDITABLE_SETTINGS_PLAN.sql"],
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
      <div className="border-b border-[#eef2f6] px-4 py-3">
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#64748b]">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-[15px] font-black text-[#111827]">{title}</h2>
        <p className="mt-1 text-[12px] font-semibold leading-5 text-[#64748b]">
          {description}
        </p>
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

function BrandCard({
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
        <StatusBadge tone="green">Existing data</StatusBadge>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <FieldLabel label="Legal company" value={legalProfile.operatingCompanyName ?? "YISSA GROUP LIMITED"} />
        <FieldLabel label="Default language" value="zh-HK / Traditional Chinese" />
        <FieldLabel label="Default WhatsApp" value={brand.whatsappNumber || "Future setting"} />
        <FieldLabel label="Business hours" value={compactList(branches.map((item) => item.openingHours).filter(Boolean), "Future setting")} />
        <FieldLabel label="Branches" value={compactList(branches.map((item) => item.name), "No branch configured")} />
        <FieldLabel label="Booking policy note" value="CS confirmation required before booked status." />
      </div>
    </article>
  );
}

function TreatmentRow({
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
    <tr className="border-t border-[#eef2f6]">
      <td className="px-3 py-2 align-top">
        <p className="font-black text-[#111827]">{treatment.name}</p>
        <p className="mt-0.5 font-mono text-[10px] text-[#64748b]">{treatment.slug}</p>
      </td>
      <td className="px-3 py-2 align-top font-semibold text-[#475569]">
        {brand?.name ?? "Unknown brand"}
      </td>
      <td className="px-3 py-2 align-top font-semibold text-[#475569]">
        {packages.length > 0
          ? packages.map((item) => packagePriceLabel(item)).join(" / ")
          : "Future offer setting"}
      </td>
      <td className="px-3 py-2 align-top font-semibold text-[#475569]">
        {compactList(branches.map((item) => item.name), "Future branch setting")}
      </td>
      <td className="px-3 py-2 align-top text-[11px] leading-5 text-[#64748b]">
        Duration, room requirement, booking buffer, FAQ replies, pre-treatment notes, aftercare notes.
      </td>
    </tr>
  );
}

function FieldGrid({
  fields,
}: {
  fields: readonly (readonly [string, string, StatusTone])[];
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {fields.map(([label, value, tone]) => (
        <div key={label} className="rounded-lg border border-[#e5e7eb] bg-[#fbfdff] p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#64748b]">
            {label}
          </p>
          <div className="mt-2">
            <StatusBadge tone={tone}>{value}</StatusBadge>
          </div>
        </div>
      ))}
    </div>
  );
}

function OptionPanel({
  title,
  values,
}: {
  title: string;
  values: Array<[string, string]>;
}) {
  return (
    <article className="rounded-lg border border-[#e5e7eb] bg-white p-3">
      <p className="text-[12px] font-black text-[#111827]">{title}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {values.map(([value, label]) => (
          <span
            key={value}
            className="rounded-md bg-[#f1f5f9] px-2 py-1 text-[10px] font-bold text-[#475569]"
          >
            {label}
          </span>
        ))}
      </div>
    </article>
  );
}

function PreviewCard({
  title,
  meta,
  body,
}: {
  title: string;
  meta: string;
  body: string;
}) {
  return (
    <article className="rounded-lg border border-[#e5e7eb] bg-[#fbfdff] p-3">
      <p className="text-[12px] font-black text-[#111827]">{title}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#64748b]">
        {meta}
      </p>
      <p className="mt-2 text-[12px] leading-5 text-[#475569]">{body}</p>
    </article>
  );
}

function PresetCard({
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
        {active ? <StatusBadge tone="green">Default</StatusBadge> : null}
      </div>
      <p className="mt-2 text-[12px] leading-5 text-[#64748b]">{body}</p>
    </article>
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
          <FieldLabel key={label} label={label} value={value} />
        ))}
      </div>
    </article>
  );
}

function FieldLabel({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#eef2f6] bg-[#f8fafc] px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#64748b]">
        {label}
      </p>
      <p className="mt-1 break-words text-[12px] font-semibold leading-5 text-[#111827]">
        {value}
      </p>
    </div>
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
