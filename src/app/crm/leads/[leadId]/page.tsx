import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { CrmStatusBadge } from "@/components/crm/CrmStatusBadge";
import { WhatsAppSendBox } from "@/components/crm/WhatsAppSendBox";
import { SubmitButton } from "@/components/alyssa/SubmitButton";
import { formatDateTime, getLeadRows } from "@/lib/data/businessMetrics";
import {
  crmPipelineStatuses,
  toCrmLeadCase,
  type CrmLeadCase,
} from "@/lib/crm/leadOps";
import { getCrmSettings } from "@/lib/crm/settingsLoader";
import { optionTuples } from "@/lib/crm/settingsConfig";
import {
  assignCsAction,
  confirmBookingAction,
  createFollowUpTaskAction,
  markInvalidAction,
  markNoShowAction,
  markShowedAction,
  recordContactAttemptAction,
  saveLostReasonAction,
  updateStatusAction,
} from "./actions";
import {
  applyCrmRecordToLeadCase,
  bootstrapCrmLeadCaseFromLead,
  getCrmCaseBundleByCaseRecord,
  getCrmCaseBundleBySourceLeadId,
  getCrmRuntimeStatus,
  type CrmInteractionRecord,
} from "@/lib/crm/store";
import {
  getWhatsAppConnectionByBrandSlug,
  getWhatsAppMessagesForLead,
  type WhatsAppConnectionView,
  type WhatsAppMessageRecord,
} from "@/lib/crm/whatsapp";

export const dynamic = "force-dynamic";

const lostReasonOptions: Array<[string, string]> = [
  ["", "請選擇原因"],
  ["no_reply", "一直未回覆"],
  ["price_concern", "價錢考慮"],
  ["time_not_fit", "時間不合"],
  ["location_not_fit", "地點不合"],
  ["changed_mind", "改變主意"],
  ["duplicate", "重複個案"],
  ["other", "其他"],
];

const invalidReasonOptions: Array<[string, string]> = [
  ["", "請選擇原因"],
  ["fake_contact", "假資料"],
  ["wrong_number", "電話錯誤"],
  ["spam", "Spam"],
  ["duplicate", "重複個案"],
  ["other", "其他"],
];

void lostReasonOptions;
void invalidReasonOptions;

export default async function CrmLeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ leadId: string }>;
  searchParams?: Promise<{
    crm_success?: string | string[];
    crm_error?: string | string[];
    crm_operation?: string | string[];
    crm_code?: string | string[];
    crm_message?: string | string[];
    crm_details?: string | string[];
    crm_hint?: string | string[];
  }>;
}) {
  const { leadId } = await params;
  const query = await searchParams;
  const feedback = getCrmFeedback(query);
  const { leads, error } = await getLeadRows("month", 5000);
  const lead = leads.find((item) => item.id === leadId);

  if (!lead) notFound();

  const baseLeadCase = toCrmLeadCase(lead);
  const [runtime, crmSettings] = await Promise.all([
    getCrmRuntimeStatus(),
    getCrmSettings({ brandSlug: baseLeadCase.brandSlug }),
  ]);
  const bootstrappedCase = runtime.actionsEnabled
    ? await bootstrapCrmLeadCaseFromLead(lead)
    : null;
  const bundle = bootstrappedCase
    ? await getCrmCaseBundleByCaseRecord(bootstrappedCase)
    : await getCrmCaseBundleBySourceLeadId(lead.id);
  const leadCase = applyCrmRecordToLeadCase(
    baseLeadCase,
    bundle.caseRecord ?? bootstrappedCase
  );
  const hasCtwa = Object.values(leadCase.ctwa).some(Boolean);
  const bookingMeta = getBookingMeta(bundle.booking?.metadata_json);
  const hasConfirmedBooking = Boolean(
    bundle.booking &&
      ["booked", "confirmed", "showed", "no_show"].includes(bundle.booking.status)
  );
  const confirmedAppointmentLabel =
    hasConfirmedBooking && bundle.booking?.booking_date && bundle.booking?.booking_time
      ? `${bundle.booking.booking_date} ${bundle.booking.booking_time}`
      : "未有已確認預約";
  const canMarkAttendance = runtime.actionsEnabled && leadCase.status === "booked";
  const [whatsappConnectionView, whatsappMessagesResult] = await Promise.all([
    getWhatsAppConnectionByBrandSlug(leadCase.brandSlug),
    getWhatsAppMessagesForLead(lead.id, 20),
  ]);

  return (
    <CrmShell>
      <div className="flex h-screen min-w-0 flex-col">
        <header className="shrink-0 border-b border-[#e5e7eb] bg-white px-4 py-2.5">
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <Link
                href="/crm"
                className="text-[11px] font-bold text-[#64748b] transition hover:text-[#111827]"
              >
                Back to Inbox
              </Link>
              <div className="mt-2 flex min-w-0 flex-wrap items-center gap-3">
                <h1 className="truncate text-lg font-bold text-[#111827]">
                  {leadCase.customerName}
                </h1>
                <CrmStatusBadge status={leadCase.status} label={leadCase.statusLabel} />
              </div>
              <p className="mt-1 truncate font-mono text-[10px] font-semibold text-[#64748b]">
                {leadCase.phone} · {leadCase.treatmentOffer}
              </p>
            </div>
            {leadCase.whatsappUrl ? (
              <a
                href={leadCase.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center whitespace-nowrap rounded-xl border border-[#16a34a] bg-[#16a34a] px-4 text-xs font-black text-white shadow-sm transition hover:bg-[#15803d]"
              >
                WhatsApp 客人
              </a>
            ) : (
              <span className="inline-flex h-8 whitespace-nowrap rounded-md border border-[#e5e7eb] bg-[#f8fafc] px-2.5 text-[11px] font-bold text-[#94a3b8]">
                <span className="self-center">無 WhatsApp</span>
              </span>
            )}
          </div>

          {error && (
            <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700">
              暫時未能更新全部最新紀錄，請稍後再試。
            </p>
          )}
          {!runtime.actionsEnabled && (
            <div className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-800">
              CRM 目前只供查看；資料服務恢復後即可更新紀錄。
            </div>
          )}
          {feedback && (
            <div
              className={`mt-2 rounded-md px-3 py-2 text-[12px] font-semibold ${
                feedback.kind === "success"
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-red-50 text-red-700"
              }`}
            >
              <p>{feedback.message}</p>
            </div>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-auto bg-[#f8fafc] p-3">
          <div className="grid gap-3">
            <section className="overflow-hidden rounded-2xl border border-[#dbe4f0] bg-white shadow-sm">
              <div className="border-b border-[#eef2f7] bg-gradient-to-r from-[#f8f7ff] via-white to-[#f0fdf4] px-5 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--crm-accent)]">Customer 360</p>
                    <h2 className="mt-1 text-lg font-black text-[#111827]">{leadCase.customerName}</h2>
                    <p className="mt-1 text-xs font-semibold text-[#64748b]">{leadCase.brandName} · {leadCase.treatmentOffer}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-black text-sky-700">{leadCase.statusLabel}</span>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600">CS：{leadCase.assignedCsLabel}</span>
                  </div>
                </div>
              </div>
              <div className="grid gap-px bg-[#e8edf4] sm:grid-cols-2 xl:grid-cols-5">
                {[
                  ["電話 / WhatsApp", leadCase.phone],
                  ["療程 / Offer", leadCase.treatmentOffer],
                  ["分店", leadCase.branchName],
                  ["客人偏好", leadCase.appointmentLabel],
                  ["正式預約", confirmedAppointmentLabel],
                ].map(([label, value]) => (
                  <div key={label} className="bg-white px-4 py-3">
                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#94a3b8]">{label}</p>
                    <p className="mt-1 text-sm font-black leading-5 text-[#1e293b]">{value}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eef2f7] bg-[#fbfcfe] px-5 py-3">
                <p className="text-xs font-semibold text-[#64748b]">客人偏好時間唔等於已確認預約；必須由同事完成預約確認。</p>
                <a href="/crm/operations" className="text-xs font-black text-[var(--crm-accent)] hover:text-[#0f688a]">查看營運狀態 →</a>
              </div>
            </section>
            <CsActionRow
              whatsappUrl={leadCase.whatsappUrl}
              canMarkAttendance={canMarkAttendance}
            />

            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="grid gap-3.5">
                <WhatsAppConnectionPanel
                  leadId={lead.id}
                  brandId={lead.brand_id || ""}
                  phone={leadCase.normalizedPhone || leadCase.phone}
                  connectionView={whatsappConnectionView}
                  messages={whatsappMessagesResult.messages}
                  messagesTableReady={whatsappMessagesResult.tableReady}
                />

                <details id="timeline" className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
                  <summary className="cursor-pointer text-sm font-black text-[#334155]">活動紀錄、表格提交及系統事件</summary>
                  <p className="mt-1 text-xs font-semibold text-[#94a3b8]">日常操作毋須展開；需要追查紀錄時先查看。</p>
                  <div className="mt-3">
                    <TimelinePanel interactions={bundle.interactions} />
                  </div>
                </details>
              </div>

              <aside className="grid content-start gap-3.5">
                <section id="contact-actions" className="grid gap-3.5">
                  <ActionPanel
                    title="記錄聯絡"
                    enabled={runtime.actionsEnabled}
                    action={recordContactAttemptAction.bind(null, leadId)}
                    submitLabel="保存聯絡紀錄"
                  >
                    <SelectInput
                      name="contact_channel"
                      label="聯絡渠道"
                      defaultValue="whatsapp"
                      options={optionTuples(crmSettings.contactChannelOptions)}
                    />
                    <SelectInput
                      name="contact_outcome"
                      label="聯絡結果"
                      defaultValue="pending"
                      options={optionTuples(crmSettings.followUpOutcomeOptions)}
                    />
                    <TextAreaInput
                      name="contact_note"
                      label="跟進備註"
                      placeholder="例：WhatsApp 已發出，客人話明天下午再覆。"
                      maxLength={2000}
                    />
                    <TextInput
                      name="next_follow_up_at"
                      type="datetime-local"
                      label="下次跟進"
                    />
                  </ActionPanel>
                </section>

                <section id="confirm-booking">
                  <ActionPanel
                    title="確認預約"
                    enabled={runtime.actionsEnabled}
                    action={confirmBookingAction.bind(null, leadId)}
                    submitLabel="確認預約"
                  >
                    <TextInput
                      name="branch_label"
                      label="分店"
                      defaultValue={bundle.booking?.branch_label || leadCase.branchName}
                    />
                    <TextInput
                      name="treatment_label"
                      label="療程"
                      defaultValue={bundle.booking?.treatment_label || leadCase.treatmentOffer}
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <TextInput
                        type="date"
                        name="confirmed_appointment_date"
                        label="確認日期"
                        defaultValue={bundle.booking?.booking_date || ""}
                      />
                      <TextInput
                        type="time"
                        name="confirmed_appointment_time"
                        label="確認時間"
                        defaultValue={bundle.booking?.booking_time || ""}
                      />
                    </div>
                    <TextInput
                      name="room_arrangement"
                      label="房間安排"
                      defaultValue={bookingMeta.roomArrangement}
                      placeholder="例：CWB Room 1"
                    />
                    <SelectInput
                      name="paid_status"
                      label="付款狀態"
                      defaultValue={bookingMeta.paidStatus}
                      options={optionTuples(crmSettings.paidStatusOptions)}
                    />
                    <TextAreaInput
                      name="booking_note"
                      label="預約備註"
                      defaultValue={bookingMeta.bookingNote}
                      placeholder="只供內部查看嘅預約備註"
                    />
                  </ActionPanel>
                </section>

                <section id="booking-outcomes" className="grid gap-3.5">
                  <QuickActionsPanel
                    canMarkAttendance={canMarkAttendance}
                    showedAction={markShowedAction.bind(null, leadId)}
                    noShowAction={markNoShowAction.bind(null, leadId)}
                  />

                  <ActionPanel
                    title="標記流失"
                    enabled={runtime.actionsEnabled}
                    action={saveLostReasonAction.bind(null, leadId)}
                    submitLabel="保存流失原因"
                  >
                    <SelectInput
                      name="lost_reason_code"
                      label="原因"
                      defaultValue=""
                      options={[["", "請選擇原因"], ...optionTuples(crmSettings.lostReasonOptions)]}
                    />
                    <TextAreaInput
                      name="lost_reason_note"
                      label="原因備註"
                      defaultValue={bundle.caseRecord?.lost_reason || ""}
                      placeholder="可選填"
                    />
                  </ActionPanel>

                  <ActionPanel
                    title="標記無效"
                    enabled={runtime.actionsEnabled}
                    action={markInvalidAction.bind(null, leadId)}
                    submitLabel="標記無效"
                  >
                    <SelectInput
                      name="invalid_reason_code"
                      label="原因"
                      defaultValue=""
                      options={[["", "請選擇原因"], ...optionTuples(crmSettings.invalidReasonOptions)]}
                    />
                    <TextAreaInput
                      name="invalid_reason_note"
                      label="原因備註"
                      placeholder="可選填"
                    />
                  </ActionPanel>
                </section>

                <ActionPanel
                  title="CS 跟進狀態"
                  enabled={runtime.actionsEnabled}
                  action={updateStatusAction.bind(null, leadId)}
                  submitLabel="更新狀態"
                >
                  <SelectInput
                    name="status"
                    label="狀態"
                    defaultValue={leadCase.status}
                    options={crmPipelineStatuses.map((item) => [item.value, item.label])}
                  />
                  <TextAreaInput
                    name="status_note"
                    label="狀態備註"
                    placeholder="可選填"
                  />
                </ActionPanel>

                <ActionPanel
                  title="負責人"
                  enabled={runtime.actionsEnabled}
                  action={assignCsAction.bind(null, leadId)}
                  submitLabel="保存負責人"
                >
                  <TextInput
                    name="assigned_to"
                    label="負責同事"
                    defaultValue={bundle.caseRecord?.assigned_to || ""}
                    placeholder="同事姓名"
                  />
                </ActionPanel>

                <ActionPanel
                  title="跟進任務"
                  enabled={runtime.actionsEnabled}
                  action={createFollowUpTaskAction.bind(null, leadId)}
                  submitLabel="建立任務"
                >
                  <TextInput
                    name="task_assigned_to"
                    label="負責同事"
                    defaultValue={bundle.caseRecord?.assigned_to || ""}
                  />
                  <TextInput name="due_at" type="datetime-local" label="到期時間" />
                  <TextInput name="task_type" label="任務類型" defaultValue="follow_up" />
                  <TextAreaInput
                    name="task_note"
                    label="任務備註"
                    placeholder="跟進提醒"
                  />
                </ActionPanel>

              </aside>
            </div>
            <MarketingTrackingPanel
              leadCase={leadCase}
              formToken={bundle.caseRecord?.form_token || "-"}
              lostReason={bundle.caseRecord?.lost_reason || "-"}
              hasCtwa={hasCtwa}
            />
          </div>
        </div>
      </div>
    </CrmShell>
  );
}

function getCrmFeedback(
  query:
    | {
        crm_success?: string | string[];
        crm_error?: string | string[];
        crm_operation?: string | string[];
        crm_code?: string | string[];
        crm_message?: string | string[];
        crm_details?: string | string[];
        crm_hint?: string | string[];
      }
    | undefined
) {
  const success = firstQueryValue(query?.crm_success);
  const error = firstQueryValue(query?.crm_error);
  const successMessages: Record<string, string> = {
    assignment_saved: "負責人已更新。",
    status_updated: "狀態已更新。",
    contact_attempt_saved: "聯絡紀錄已保存。",
    booking_confirmed: "預約已確認。",
    showed_saved: "已標記客人到店。",
    no_show_saved: "已標記客人未到店。",
    invalid_saved: "已標記為無效 Lead。",
    follow_up_saved: "跟進安排已保存。",
    lost_reason_saved: "流失原因已保存。",
  };

  if (success && successMessages[success]) {
    return {
      kind: "success" as const,
      message: successMessages[success],
    };
  }

  if (error === "write_disabled") {
    return {
      kind: "error" as const,
      message: "CRM 目前只供查看，暫時未能更新紀錄。",
    };
  }

  if (error === "action_failed") {
    return {
      kind: "error" as const,
      message: "未能保存呢次操作，請稍後再試。",
    };
  }

  return null;
}

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getBookingMeta(metadata: Record<string, unknown> | null | undefined) {
  const paidStatus = metadataString(metadata, "paid_status") || "unknown";
  return {
    paidStatus,
    paidStatusLabel:
      paidStatus === "paid" ? "已付款" : paidStatus === "unpaid" ? "未付款" : "未確認",
    roomArrangement: metadataString(metadata, "room_arrangement"),
    bookingNote: metadataString(metadata, "booking_note"),
  };
}

function metadataString(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : "";
}

function CsActionRow({
  whatsappUrl,
  canMarkAttendance,
}: {
  whatsappUrl: string | null;
  canMarkAttendance: boolean;
}) {
  const actions = [
    { href: "#contact-actions", label: "Log contact attempt", primary: false },
    { href: "#confirm-booking", label: "Confirm booking", primary: true },
    { href: "#booking-outcomes", label: "Mark showed", primary: false, muted: !canMarkAttendance },
    { href: "#booking-outcomes", label: "Mark no-show", primary: false, muted: !canMarkAttendance },
    { href: "#booking-outcomes", label: "Mark lost", primary: false },
    { href: "#booking-outcomes", label: "Mark invalid", primary: false },
  ];

  return (
    <section className="rounded-lg border border-[#e5e7eb] bg-white px-3.5 py-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        {whatsappUrl ? (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center rounded-md bg-[#16a34a] px-3 text-[11px] font-black text-white transition hover:bg-[#15803d]"
          >
            開啟 WhatsApp
          </a>
        ) : (
          <span className="inline-flex h-8 items-center rounded-md bg-[#e5e7eb] px-3 text-[11px] font-black text-[#94a3b8]">
            無 WhatsApp
          </span>
        )}
        {actions.map((action) => (
          <a
            key={action.label}
            href={action.href}
            className={`inline-flex h-8 items-center rounded-md border px-3 text-[11px] font-black transition ${
              action.primary
                ? "border-[#111827] bg-[#111827] text-white hover:bg-[#0f172a]"
                : action.muted
                  ? "border-[#e5e7eb] bg-[#f8fafc] text-[#94a3b8]"
                  : "border-[#e5e7eb] bg-white text-[#111827] hover:bg-[#f8fafc]"
            }`}
          >
            {action.label}
          </a>
        ))}
      </div>
      <p className="mt-2 text-[11px] font-semibold text-[#64748b]">
        所有訊息仍需 CS 人手發送；狀態只由 CS operational action 更新。
      </p>
    </section>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-[#e5e7eb] bg-white shadow-sm">
      <div className="border-b border-[#eef2f6] px-3.5 py-2.5">
        <h2 className="text-[13px] font-bold text-[#111827]">{title}</h2>
      </div>
      <div className="grid gap-2 p-3.5">{children}</div>
    </section>
  );
}

function WhatsAppConnectionPanel({
  leadId,
  brandId,
  phone,
  connectionView,
  messages,
  messagesTableReady,
}: {
  leadId: string;
  brandId: string;
  phone: string;
  connectionView: WhatsAppConnectionView;
  messages: WhatsAppMessageRecord[];
  messagesTableReady: boolean;
}) {
  const connected = Boolean(
    connectionView.connection &&
      connectionView.tableReady &&
      connectionView.connection.access_token_encrypted
  );

  return (
    <section className="rounded-lg border border-[#e5e7eb] bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eef2f6] px-3.5 py-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#64748b]">
            WhatsApp API
          </p>
          <h2 className="mt-1 text-[15px] font-black text-[#111827]">
            WhatsApp messages
          </h2>
          <p className="mt-1 text-[12px] font-semibold leading-5 text-[#64748b]">
            完成 WhatsApp 連接後，訊息會同步顯示喺呢度。
          </p>
        </div>
        <Link
          href="/crm/settings/whatsapp"
          className="rounded-md border border-[#e5e7eb] bg-[#f8fafc] px-2.5 py-1.5 text-[11px] font-black text-[#111827]"
        >
          WhatsApp 設定
        </Link>
      </div>
      <div className="grid gap-3 p-3.5">
        <div className="grid gap-2 rounded-lg border border-[#eef2f6] bg-[#f8fafc] px-3 py-2 text-[12px] font-semibold text-[#475569] sm:grid-cols-3">
          <InfoLine label="客人電話" value={phone || "-"} />
          <InfoLine label="連接狀態" value={connectionView.statusLabel} />
          <InfoLine
            label="訊息紀錄"
            value={messagesTableReady ? "正常" : "尚未就緒"}
          />
        </div>

        {!connected && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-bold text-amber-900">
            WhatsApp 尚未完成設定，請聯絡系統管理員。
          </div>
        )}

        <div className="grid gap-2">
          {messages.length > 0 ? (
            messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-lg border px-3 py-2 ${
                  message.direction === "outbound"
                    ? "ml-8 border-emerald-100 bg-emerald-50"
                    : "mr-8 border-[#e5e7eb] bg-white"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-black text-[#111827]">
                    {message.direction} · {message.message_type || "text"}
                  </span>
                  <span className="text-[10px] font-semibold text-[#64748b]">
                    {formatDateTime(message.created_at)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-[12px] font-semibold leading-5 text-[#475569]">
                  {message.body || "-"}
                </p>
                <p className="mt-1 text-[10px] font-bold text-[#94a3b8]">
                  Status: {message.status || "-"}
                </p>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-3 py-4 text-center text-[12px] font-semibold text-[#64748b]">
              No synced WhatsApp messages yet.
            </div>
          )}
        </div>

        <WhatsAppSendBox leadId={leadId} brandId={brandId} disabled={!connected} />
      </div>
    </section>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-md bg-[#f8fafc] px-2.5 py-2 sm:grid-cols-[118px_1fr]">
      <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#64748b]">
        {label}
      </dt>
      <dd className="min-w-0 break-words text-[12px] font-semibold text-[#111827]">
        {value}
      </dd>
    </div>
  );
}

function ActionPanel({
  title,
  enabled,
  action,
  submitLabel,
  children,
}: {
  title: string;
  enabled: boolean;
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[#e5e7eb] bg-white p-3.5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[13px] font-bold text-[#111827]">{title}</h2>
        <span
          className={`rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${
            enabled
              ? "bg-[#ecfdf5] text-[#047857]"
              : "bg-[#fef3c7] text-[#92400e]"
          }`}
        >
          {enabled ? "Enabled" : "Disabled"}
        </span>
      </div>
      <form action={action} className="mt-3 grid gap-2">
        <fieldset disabled={!enabled} className="grid gap-2 disabled:opacity-70">
          {children}
        </fieldset>
        <SubmitButton
          disabled={!enabled}
          className={`h-7 whitespace-nowrap rounded-md px-2.5 text-[10px] font-bold ${
            enabled
              ? "bg-[#111827] text-white transition hover:bg-[#0f172a]"
              : "bg-[#e5e7eb] text-[#94a3b8]"
          }`}
          pendingLabel="處理中…"
        >
          {submitLabel}
        </SubmitButton>
      </form>
    </section>
  );
}

function MarketingTrackingPanel({
  leadCase,
  formToken,
  lostReason,
  hasCtwa,
}: {
  leadCase: CrmLeadCase;
  formToken: string;
  lostReason: string;
  hasCtwa: boolean;
}) {
  return (
    <details className="rounded-lg border border-[#e5e7eb] bg-white p-3.5 xl:col-span-3">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[13px] font-bold text-[#111827]">
              營銷及追蹤資料
            </h2>
            <p className="mt-1 text-[11px] font-semibold text-[#64748b]">
              預設收合。這些資料只供報表及 Marketing 分析，不應用來判斷是否已預約。
            </p>
          </div>
          <span className="rounded-md bg-[#f1f5f9] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[#64748b]">
            只供分析
          </span>
        </div>
      </summary>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold text-[#64748b]">
            呢啲欄位只供營銷分析，預約狀態以已確認預約為準。
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Panel title="來源">
          <InfoLine label="CRM 來源" value={leadCase.sourceLabel} />
          <InfoLine label="來源類型" value={leadCase.sourceTypeRaw} />
          <InfoLine label="登記頁" value={leadCase.landingPageSlug || "-"} />
          <InfoLine label="表格識別" value={formToken} />
          <InfoLine label="頁面網址" value={leadCase.pageUrl || "-"} />
          <InfoLine label="Campaign" value={leadCase.campaignLabel} />
          <InfoLine label="廣告內容" value={leadCase.adLabel} />
          <InfoLine label="流失原因" value={lostReason} />
        </Panel>

        <Panel title="CTWA / WhatsApp Ad">
          {hasCtwa ? (
            <>
              <InfoLine label="CTWA Source ID" value={leadCase.ctwa.ctwa_source_id || "-"} />
              <InfoLine label="CTWA Source URL" value={leadCase.ctwa.ctwa_source_url || "-"} />
              <InfoLine label="Headline" value={leadCase.ctwa.ctwa_referral_headline || "-"} />
              <InfoLine label="Body" value={leadCase.ctwa.ctwa_referral_body || "-"} />
              <InfoLine label="Campaign ID" value={leadCase.ctwa.campaign_id || "-"} />
              <InfoLine label="Ad Set ID" value={leadCase.ctwa.adset_id || "-"} />
              <InfoLine label="Ad ID" value={leadCase.ctwa.ad_id || "-"} />
              <InfoLine label="Phone Number ID" value={leadCase.ctwa.phone_number_id || "-"} />
            </>
          ) : (
            <p className="text-[12px] leading-5 text-[#64748b]">
              暫未有 WhatsApp 廣告來源資料。
            </p>
          )}
        </Panel>
      </div>
    </details>
  );
}

function QuickActionsPanel({
  canMarkAttendance,
  showedAction,
  noShowAction,
}: {
  canMarkAttendance: boolean;
  showedAction: () => Promise<void>;
  noShowAction: () => Promise<void>;
}) {
  return (
    <section className="rounded-lg border border-[#e5e7eb] bg-white p-3.5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[13px] font-bold text-[#111827]">Attendance</h2>
        <span className="rounded-md bg-[#f1f5f9] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[#64748b]">
          CS only
        </span>
      </div>
      <div className="mt-3 grid gap-2">
        <QuickActionButton
          action={showedAction}
          enabled={canMarkAttendance}
          label="Mark showed"
        />
        <QuickActionButton
          action={noShowAction}
          enabled={canMarkAttendance}
          label="Mark no-show"
        />
      </div>
      {!canMarkAttendance && (
        <p className="mt-3 text-[11px] leading-4 text-[#64748b]">
          Show / no-show can only be marked after CS confirmed a booking and the appointment time has passed.
        </p>
      )}
    </section>
  );
}

function QuickActionButton({
  action,
  enabled,
  label,
}: {
  action: () => Promise<void>;
  enabled: boolean;
  label: string;
}) {
  return (
    <form action={action}>
      <SubmitButton
        disabled={!enabled}
        className={`h-7 w-full whitespace-nowrap rounded-md px-2.5 text-[10px] font-bold ${
          enabled
            ? "border border-[#dbeafe] bg-[#eff6ff] text-[#1d4ed8] transition hover:bg-[#dbeafe]"
            : "bg-[#e5e7eb] text-[#94a3b8]"
        }`}
        pendingLabel="處理中…"
      >
        {label}
      </SubmitButton>
    </form>
  );
}

function TextInput({
  label,
  name,
  type = "text",
  defaultValue = "",
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#64748b]">
        {label}
      </span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-1.5 h-8 w-full rounded-md border border-[#e5e7eb] bg-[#f8fafc] px-2.5 text-[12px] font-semibold text-[#111827] outline-none focus:border-[#2563eb] focus:bg-white"
      />
    </label>
  );
}

function TextAreaInput({
  label,
  name,
  defaultValue = "",
  placeholder,
  maxLength,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#64748b]">
        {label}
      </span>
      <textarea
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        maxLength={maxLength}
        className="mt-1.5 min-h-16 w-full resize-y rounded-md border border-[#e5e7eb] bg-[#f8fafc] px-2.5 py-2 text-[12px] font-semibold text-[#111827] outline-none focus:border-[#2563eb] focus:bg-white"
      />
    </label>
  );
}

function SelectInput({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: Array<[string, string]>;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#64748b]">
        {label}
      </span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="mt-1.5 h-8 w-full rounded-md border border-[#e5e7eb] bg-[#f8fafc] px-2.5 text-[12px] font-semibold text-[#111827] outline-none focus:border-[#2563eb] focus:bg-white"
      >
        {options.map(([value, labelText]) => (
          <option key={value} value={value}>
            {labelText}
          </option>
        ))}
      </select>
    </label>
  );
}

function TimelinePanel({ interactions }: { interactions: CrmInteractionRecord[] }) {
  return (
    <section className="rounded-lg border border-[#e5e7eb] bg-white p-3.5 xl:col-span-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[13px] font-bold text-[#111827]">活動紀錄</h2>
        <span className="rounded-md bg-[#f1f5f9] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[#64748b]">
          內部紀錄
        </span>
      </div>
      {interactions.length > 0 ? (
        <ol className="mt-3 grid gap-2">
          {interactions.map((item) => (
            <li
              key={item.id}
              className="rounded-md border border-[#eef2f6] bg-[#f8fafc] px-3 py-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-[#111827]">
                  {item.interaction_type}
                </span>
                <span className="text-[10px] font-semibold text-[#64748b]">
                  {formatDateTime(item.created_at)}
                </span>
              </div>
              <p className="mt-1 text-[12px] leading-5 text-[#475569]">
                {item.body || "-"}
              </p>
              <p className="mt-1 text-[10px] font-semibold text-[#94a3b8]">
                {item.author || "CS"} / {item.source_type || "crm"}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 rounded-md bg-[#f8fafc] px-3 py-3 text-[12px] font-semibold text-[#64748b]">
          暫未有活動紀錄。
        </p>
      )}
    </section>
  );
}
