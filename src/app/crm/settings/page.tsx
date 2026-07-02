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
import { QuickRepliesSettingsTable } from "./QuickRepliesSettingsTable";

export const dynamic = "force-dynamic";

type StatusTone = "green" | "amber" | "blue" | "slate" | "red";

const sections = [
  ["overview", "Overview"],
  ["brand", "Brand Profile"],
  ["treatments", "Treatment Menu"],
  ["whatsapp", "WhatsApp"],
  ["ai", "AI Replies"],
  ["booking", "Booking Workflow"],
  ["inbox", "Inbox Presets"],
  ["team", "Team Access"],
  ["developer", "Developer Notes"],
] as const;

type SettingsSectionKey = (typeof sections)[number][0];

const overviewItems = [
  [
    "Brand setup",
    "Mock only",
    "品牌資料會以現有設定展示，暫時未能在此頁儲存修改。",
    "Next: Review current brand setup.",
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
    "Active",
    "CRM 狀態、lost / invalid reason 及跟進選項已套用目前設定。",
    "Next: Keep these settings view-only until a later phase.",
    "green",
  ],
  [
    "Inbox presets",
    "Active",
    "CS Booking View 等欄位 preset 已套用目前設定。",
    "Next: Keep presets view-only until a later phase.",
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
    "Editable settings",
    "Quick Replies editable",
    "目前只開放 Quick Replies 儲存，其餘設定仍然只供查看。",
    "Next: Enable more admin save flows later.",
    "green",
  ],
] as const;

const whatsappOverviewCards = [
  ["Current mode", "Manual WhatsApp", "目前仍使用手動開啟 WhatsApp。", "blue"],
  ["WhatsApp connection", "Not connected yet", "完成連接後，系統可協助同事直接發送已確認訊息。", "amber"],
  ["Message sending", "Not enabled yet", "訊息發送前仍需同事確認。", "amber"],
  ["Conversation sync", "Not enabled yet", "對話同步稍後啟用。", "slate"],
  ["Human approval", "Required", "所有回覆都要由同事檢查後先可以發送。", "green"],
] as const;

const whatsappProviderOptions = [
  ["manual", "Manual only", true],
  ["meta_cloud", "Meta Cloud API", false],
  ["360dialog", "360dialog", false],
  ["twilio", "Twilio", false],
  ["sleekflow", "SleekFlow / other provider", false],
] as const;

const whatsappConnectionFields = [
  ["Provider", "Manual only"],
  ["WhatsApp Business Account ID", "稍後設定"],
  ["Phone Number ID", "稍後設定"],
  ["Display phone number", "稍後設定"],
  ["Webhook URL", "稍後設定"],
  ["Verify token", "稍後設定"],
  ["Access token", "稍後設定"],
  ["App secret", "稍後設定"],
  ["Template namespace", "稍後設定"],
  ["Default send mode", "Human approval required"],
] as const;

const whatsappWebhookFields = [
  ["Webhook endpoint", "稍後設定"],
  ["Verification token", "稍後設定"],
  ["Incoming message sync", "Not active"],
  ["Delivery status sync", "Not active"],
] as const;

const whatsappTemplateRows = [
  ["Booking confirmation", "確認預約後發送", "Planned"],
  ["Reminder", "預約前提醒", "Planned"],
  ["No-show follow-up", "未到店後跟進", "Planned"],
  ["Re-engagement", "長時間未回覆後重新跟進", "Planned"],
  ["Payment reminder", "需要付款提示時使用", "Planned"],
] as const;

const aiMockFields = [
  ["Reply style", "Natural, concise, helpful"],
  ["Brand tone", "Friendly Hong Kong Traditional Chinese"],
  ["Reply language", "Traditional Chinese"],
  ["Future AI provider connection", "稍後設定"],
  ["Human approval", "Required"],
  ["Auto-send", "Off"],
] as const;

const aiKnowledgeSourceTypes = [
  ["Website URL", "可用作品牌及療程知識來源"],
  ["Manual note", "由管理員整理的品牌或 CS 指引"],
  ["Treatment FAQ", "療程常見問題及標準答案"],
  ["Brand policy", "價錢、療程限制及合規指引"],
  ["File upload / document source", "Planned"],
  ["Sitemap / full site scan", "Planned"],
] as const;

const aiWebsiteSourceFields = [
  ["Source name", "Ineffable Beauty website"],
  ["Website URL", "https://www.ineffablebeautyhk.com"],
  ["Source type", "Website"],
  ["Scan mode", "Single page / Full website / Sitemap"],
] as const;

const aiKnowledgeSourceRows = [
  ["Brand website", "Website", "https://www.ineffablebeautyhk.com", "Full website", "Ready to connect", "0", "-"],
  ["Treatment FAQ", "Treatment FAQ", "-", "Approved FAQ", "Waiting for scan", "0", "-"],
  ["Brand policy notes", "Brand policy", "-", "Manual notes", "Needs review", "0", "-"],
] as const;

const aiSafetyRuleRows = [
  ["Forbidden claims", "No guaranteed treatment results"],
  ["Price handling rules", "Use approved offer/package wording only"],
  ["Treatment limitation notes", "Explain that suitability and results depend on individual condition"],
  ["Medical / beauty compliance reminders", "No diagnosis or medical promise"],
  ["Human approval required", "Every AI suggestion must be reviewed by CS before sending"],
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
  ["Who can edit settings", "Future admin-only save boundary"],
  ["Who can view technical audit", "Future admin / marketing permission"],
  ["Who can connect WhatsApp API", "Future owner/admin-only permission"],
  ["Who can send messages", "No API sending exists yet"],
] as const;

export default async function CrmSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    section?: string | string[];
    settings_success?: string | string[];
    settings_error?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const feedback = getSettingsFeedback(query);
  const activeSection = getActiveSection(query?.section);
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
      ? "Current settings active"
      : "Default settings active";

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
                Settings Editor
              </h1>
              <p className="mt-1 text-[12px] font-semibold text-[#64748b]">
                Quick Replies 可以儲存，其他設定目前只供查看，方便之後逐步開放管理。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone="green">{settingsModeBadge}</StatusBadge>
              <StatusBadge tone="green">Quick Replies editable</StatusBadge>
              <StatusBadge tone="amber">Other settings view only</StatusBadge>
              <StatusBadge tone={runtime.actionsEnabled ? "green" : "amber"}>
                {runtime.actionsEnabled ? "CS actions enabled" : "Writes disabled"}
              </StatusBadge>
            </div>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[244px_1fr]">
          <aside className="hidden border-r border-[#e5e7eb] bg-white p-3 lg:block">
            <div className="sticky top-3 grid gap-1">
              {sections.map(([key, label]) => {
                const isActive = key === activeSection;
                return (
                  <a
                    key={key}
                    href={`/crm/settings?section=${key}`}
                    className={`rounded-md px-3 py-2 text-[12px] font-bold transition ${
                      isActive
                        ? "bg-[#5A2348] text-white shadow-sm"
                        : "text-[#475569] hover:bg-[#f1f5f9] hover:text-[#111827]"
                    }`}
                  >
                    {label}
                  </a>
                );
              })}
              <div className="mt-3 rounded-lg border border-[#fef3c7] bg-[#fffbeb] p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#92400e]">
                  Safe mode
                </p>
                <p className="mt-1 text-[12px] font-bold text-[#111827]">
                  Partial save enabled
                </p>
                <p className="mt-1 text-[11px] leading-4 text-[#92400e]">
                  Only Quick Replies can be saved. Other settings remain view-only for now.
                </p>
              </div>
            </div>
          </aside>

          <main className="min-h-0 overflow-auto p-4">
            <div className="mx-auto grid max-w-7xl gap-4">
              {feedback ? <SettingsFeedback feedback={feedback} /> : null}
              <div className="flex gap-2 overflow-x-auto rounded-lg border border-[#e5e7eb] bg-white p-2 lg:hidden">
                {sections.map(([key, label]) => {
                  const isActive = key === activeSection;
                  return (
                    <a
                      key={key}
                      href={`/crm/settings?section=${key}`}
                      className={`shrink-0 rounded-md px-3 py-2 text-[11px] font-black ${
                        isActive
                          ? "bg-[#5A2348] text-white"
                          : "bg-[#f8fafc] text-[#475569]"
                      }`}
                    >
                      {label}
                    </a>
                  );
                })}
              </div>
              {activeSection === "overview" ? (
              <SettingsSection
                id="overview"
                eyebrow="Control Center"
                title="Overview"
                description="Admin-friendly readiness view. It shows which areas are active, which are view-only, and the safest setup order."
                statusItems={[
                  ["Current settings active", "green"],
                  ["Quick Replies editable", "green"],
                ]}
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
              ) : null}

              {activeSection === "brand" ? (
              <SettingsSection
                id="brand"
                eyebrow="Brand"
                title="Brand Profile & Branch Setup"
                description="Brand profile, legal entity, contact display, and branch setup preview. Existing data is view-only here."
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
              ) : null}

              {activeSection === "treatments" ? (
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
              ) : null}

              {activeSection === "whatsapp" ? (
              <SettingsSection
                id="whatsapp"
                eyebrow="Messaging"
                title="WhatsApp Connection"
                description="Future WhatsApp connection setup. Manual WhatsApp remains the active mode today."
              >
                <ImportantNotice>
                  目前仍使用手動開啟 WhatsApp。完成連接後，系統可協助同事直接發送已確認訊息；訊息發送前仍需同事確認。
                </ImportantNotice>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  {whatsappOverviewCards.map(([title, status, body, tone]) => (
                    <ReadinessCard
                      key={title}
                      title={title}
                      status={status}
                      explanation={body}
                      nextAction="View only"
                      tone={tone}
                    />
                  ))}
                </div>

                <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
                  <div className="grid gap-3">
                    <SettingsSubsection
                      title="Provider setup"
                      description="Choose the future WhatsApp provider. Current selected mode is Manual only."
                    >
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {whatsappProviderOptions.map(([value, label, selected]) => (
                          <ProviderOption
                            key={value}
                            label={label}
                            selected={selected}
                          />
                        ))}
                      </div>
                    </SettingsSubsection>

                    <SettingsSubsection
                      title="Connection details"
                      description="Fields are prepared for future setup and are not editable yet."
                    >
                      <div className="grid gap-3 md:grid-cols-2">
                        {whatsappConnectionFields.map(([label, value]) => (
                          <MockInput key={label} label={label} value={value} />
                        ))}
                        <MockToggle label="Human approval required" checked />
                        <MockToggle label="Auto-send default" checked={false} />
                      </div>
                    </SettingsSubsection>
                  </div>

                  <div className="grid content-start gap-3">
                    <SettingsSubsection
                      title="Webhook readiness"
                      description="對話同步稍後啟用；目前不會改動任何現有 webhook 行為。"
                    >
                      <div className="grid gap-3">
                        {whatsappWebhookFields.map(([label, value]) => (
                          <MockInput key={label} label={label} value={value} />
                        ))}
                      </div>
                    </SettingsSubsection>

                    <SettingsSubsection
                      title="Test connection"
                      description="完成連接設定後，可在此測試連線。"
                    >
                      <button
                        type="button"
                        disabled
                        className="h-9 w-full rounded-md bg-[#e5e7eb] px-3 text-[12px] font-black text-[#94a3b8]"
                      >
                        Test WhatsApp connection
                      </button>
                    </SettingsSubsection>
                  </div>
                </div>

                <SettingsSubsection
                  title="Message templates"
                  description="Future template management. These are planned templates only and are not connected to sending."
                  className="mt-3"
                >
                  <div className="overflow-hidden rounded-lg border border-[#e5e7eb]">
                    <table className="w-full min-w-[680px] text-left text-[12px]">
                      <thead className="bg-[#f8fafc] text-[10px] font-black uppercase tracking-[0.08em] text-[#64748b]">
                        <tr>
                          <th className="px-3 py-2">Template</th>
                          <th className="px-3 py-2">Use case</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#eef2f6]">
                        {whatsappTemplateRows.map(([name, useCase, status]) => (
                          <tr key={name}>
                            <td className="px-3 py-2 font-black text-[#111827]">{name}</td>
                            <td className="px-3 py-2 font-semibold text-[#475569]">{useCase}</td>
                            <td className="px-3 py-2">
                              <StatusBadge tone="slate">{status}</StatusBadge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SettingsSubsection>

                <DisabledSaveBar />
              </SettingsSection>
              ) : null}

              {activeSection === "ai" ? (
              <SettingsSection
                id="ai"
                eyebrow="AI Reply Assistant"
                title="AI Reply Assistant / 智能回覆助手"
                description="Future smart reply setup for brand tone, approved knowledge sources, safety rules, and human review."
                statusItems={[
                  ["Quick Replies editable", "green"],
                  ["Other settings view only", "amber"],
                ]}
              >
                <ImportantNotice>
                  之後 AI 回覆會根據已核准嘅品牌、療程及 FAQ 資料生成建議。所有 AI 建議仍需同事確認後先可發送。
                </ImportantNotice>
                <StatusRow
                  items={[
                    ["Draft suggestions only", "blue"],
                    ["Future connection", "amber"],
                    ["Auto-send off", "slate"],
                    ["Manual review required", "amber"],
                  ]}
                />
                <div className="mb-3 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-[12px] font-semibold leading-5 text-emerald-800">
                  Quick Replies 是可直接使用的標準回覆範本；AI Assist 是另一個較自然的草稿工具，目前仍需人手檢查及發送。
                </div>

                <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
                  <div className="grid gap-3">
                    <SettingsSubsection
                      title="Reply style"
                      description="Tone and reply behavior for future AI suggestions."
                    >
                      <div className="grid gap-3 md:grid-cols-2">
                        {aiMockFields.map(([label, value]) => (
                          <MockInput key={label} label={label} value={value} />
                        ))}
                        <MockToggle label="Human approval required" checked />
                        <MockToggle label="Auto-send" checked={false} />
                      </div>
                    </SettingsSubsection>

                    <SettingsSubsection
                      title="Knowledge Sources / 知識來源"
                      description="網站來源可用嚟建立品牌知識，但正式掃描功能尚未啟用。"
                    >
                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {aiKnowledgeSourceTypes.map(([title, body]) => (
                          <div
                            key={title}
                            className="rounded-lg border border-[#e5e7eb] bg-[#f8fafc] px-3 py-2"
                          >
                            <p className="text-[12px] font-black text-[#111827]">{title}</p>
                            <p className="mt-1 text-[11px] font-semibold leading-5 text-[#64748b]">
                              {body}
                            </p>
                          </div>
                        ))}
                      </div>
                    </SettingsSubsection>

                    <SettingsSubsection
                      title="Website URL source"
                      description="Prepare a website knowledge source. This does not fetch or scan any URL yet."
                    >
                      <div className="grid gap-3 md:grid-cols-2">
                        {aiWebsiteSourceFields.map(([label, value]) => (
                          <MockInput key={label} label={label} value={value} />
                        ))}
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        {["Single page", "Full website", "Sitemap"].map((mode, index) => (
                          <ProviderOption
                            key={mode}
                            label={mode}
                            selected={index === 0}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        disabled
                        className="mt-3 h-9 rounded-md bg-[#e5e7eb] px-3 text-[12px] font-black text-[#94a3b8]"
                      >
                        Add source 尚未啟用
                      </button>
                    </SettingsSubsection>
                  </div>

                  <div className="grid content-start gap-3">
                    <SettingsSubsection
                      title="Safety rules"
                      description="Approved guardrails for future AI suggestions."
                    >
                      <div className="grid gap-3">
                        {aiSafetyRuleRows.map(([label, value]) => (
                          <MockTextarea key={label} label={label} value={value} />
                        ))}
                      </div>
                    </SettingsSubsection>
                  </div>
                </div>

                <SettingsSubsection
                  title="Source scan status"
                  description="Setup preview only. No website scan, URL fetch, or external service call happens in this phase."
                  className="mt-3"
                >
                  <div className="overflow-x-auto rounded-lg border border-[#e5e7eb]">
                    <table className="w-full min-w-[860px] text-left text-[12px]">
                      <thead className="bg-[#f8fafc] text-[10px] font-black uppercase tracking-[0.08em] text-[#64748b]">
                        <tr>
                          <th className="px-3 py-2">Source</th>
                          <th className="px-3 py-2">Type</th>
                          <th className="px-3 py-2">URL</th>
                          <th className="px-3 py-2">Scope</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Pages</th>
                          <th className="px-3 py-2">Last scanned</th>
                          <th className="px-3 py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#eef2f6]">
                        {aiKnowledgeSourceRows.map(([source, type, url, scope, status, pages, lastScanned]) => (
                          <tr key={source}>
                            <td className="px-3 py-2 font-black text-[#111827]">{source}</td>
                            <td className="px-3 py-2 font-semibold text-[#475569]">{type}</td>
                            <td className="px-3 py-2 font-mono text-[11px] font-semibold text-[#64748b]">{url}</td>
                            <td className="px-3 py-2 font-semibold text-[#475569]">{scope}</td>
                            <td className="px-3 py-2"><StatusBadge tone="slate">{status}</StatusBadge></td>
                            <td className="px-3 py-2 font-semibold text-[#475569]">{pages}</td>
                            <td className="px-3 py-2 font-semibold text-[#475569]">{lastScanned}</td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                disabled
                                className="h-7 rounded-md bg-[#e5e7eb] px-2.5 text-[10px] font-black text-[#94a3b8]"
                              >
                                Review later
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SettingsSubsection>

                <div className="mt-3">
                  <QuickRepliesSettingsTable templates={crmSettings.quickReplyTemplates} />
                </div>
              </SettingsSection>
              ) : null}

              {activeSection === "booking" ? (
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
              ) : null}

              {activeSection === "inbox" ? (
              <SettingsSection
                id="inbox"
                eyebrow="Inbox"
                title="Inbox Column Presets & CS View Preferences"
                description="Inbox column presets and future CS view preferences. Current presets are active and view-only here."
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
              ) : null}

              {activeSection === "team" ? (
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
              ) : null}

              {activeSection === "developer" ? (
              <SettingsSection
                id="developer"
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
              ) : null}
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
  statusItems,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  statusItems?: Array<[string, StatusTone]>;
  children: ReactNode;
}) {
  const badges = statusItems ?? [
    ["Mock only", "amber"],
    ["Save not enabled", "amber"],
  ] as Array<[string, StatusTone]>;

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
          {badges.map(([label, tone]) => (
            <StatusBadge key={label} tone={tone}>
              {label}
            </StatusBadge>
          ))}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function SettingsFeedback({
  feedback,
}: {
  feedback: { tone: StatusTone; title: string; body: string };
}) {
  const classes = {
    green: "border-emerald-100 bg-emerald-50 text-emerald-800",
    amber: "border-amber-100 bg-amber-50 text-amber-800",
    blue: "border-blue-100 bg-blue-50 text-blue-800",
    slate: "border-slate-200 bg-slate-100 text-slate-700",
    red: "border-red-100 bg-red-50 text-red-700",
  };

  return (
    <div className={`rounded-xl border px-4 py-3 ${classes[feedback.tone]}`}>
      <p className="text-[12px] font-black">{feedback.title}</p>
      <p className="mt-1 text-[12px] font-semibold leading-5">{feedback.body}</p>
    </div>
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

function SettingsSubsection({
  title,
  description,
  className = "",
  children,
}: {
  title: string;
  description: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <article className={`rounded-lg border border-[#e5e7eb] bg-white p-3 ${className}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[12px] font-black text-[#111827]">{title}</p>
          <p className="mt-1 text-[11px] font-semibold leading-5 text-[#64748b]">
            {description}
          </p>
        </div>
        <StatusBadge tone="amber">Coming soon</StatusBadge>
      </div>
      {children}
    </article>
  );
}

function ProviderOption({
  label,
  selected,
}: {
  label: string;
  selected: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 ${
        selected
          ? "border-[#bbf7d0] bg-[#f0fdf4]"
          : "border-[#e5e7eb] bg-[#f8fafc]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-black text-[#111827]">{label}</p>
        <span
          className={`h-3 w-3 rounded-full border ${
            selected ? "border-[#16a34a] bg-[#16a34a]" : "border-[#cbd5e1] bg-white"
          }`}
        />
      </div>
      <p className="mt-1 text-[11px] font-semibold text-[#64748b]">
        {selected ? "Current mode" : "Future option"}
      </p>
    </div>
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
            建議先整理業務資料，再處理連接、草稿、欄位同權限；目前只有 Quick Replies 可以儲存。
          </p>
        </div>
        <StatusBadge tone="green">Quick Replies editable</StatusBadge>
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
        <StatusBadge tone="green">Active setting</StatusBadge>
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
          <StatusBadge tone="green">Active setting</StatusBadge>
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
        View-only preview. Changes cannot be saved yet.
      </p>
    </div>
  );
}

function DisabledSaveBar() {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#eef2f6] bg-[#f8fafc] px-3 py-2">
      <p className="text-[11px] font-semibold text-[#64748b]">
        View-only in this section. Changes cannot be saved here yet.
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

function getActiveSection(value: string | string[] | undefined): SettingsSectionKey {
  const raw = firstParam(value);
  const match = sections.find(([key]) => key === raw);
  return match?.[0] ?? "overview";
}

function getSettingsFeedback(
  query:
    | {
        section?: string | string[];
        settings_success?: string | string[];
        settings_error?: string | string[];
      }
    | undefined
) {
  const success = firstParam(query?.settings_success);
  if (success === "quick_reply_saved") {
    return {
      tone: "green" as const,
      title: "Quick Reply saved",
      body: "Quick reply title and message have been updated. Lead detail templates will reflect the new wording after refresh.",
    };
  }

  const error = firstParam(query?.settings_error);
  if (!error) return null;

  const messages: Record<string, string> = {
    label_required: "Template title is required.",
    body_required: "Message text is required.",
    quick_reply_not_editable:
      "This quick reply cannot be edited because it is missing, disabled, or locked.",
    quick_reply_save_failed:
      "Quick reply could not be saved. Please check server logs for the safe error summary.",
  };

  return {
    tone: "red" as const,
    title: "Quick Reply not saved",
    body: messages[error] ?? messages.quick_reply_save_failed,
  };
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function compactList(values: Array<string | null | undefined>, fallback: string) {
  const cleaned = values
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  if (cleaned.length === 0) return fallback;
  return cleaned.slice(0, 4).join(" / ") + (cleaned.length > 4 ? ` +${cleaned.length - 4}` : "");
}
