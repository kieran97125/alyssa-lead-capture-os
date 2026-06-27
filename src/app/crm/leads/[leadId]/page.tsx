import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { CrmStatusBadge } from "@/components/crm/CrmStatusBadge";
import { formatDateTime, getLeadRows } from "@/lib/data/businessMetrics";
import {
  crmPipelineStatuses,
  toCrmLeadCase,
  type CrmLeadCase,
} from "@/lib/crm/leadOps";
import {
  contactChannelOptions,
  followUpOutcomeOptions,
  getCrmAiReplyDrafts,
  invalidReasonOptions as configuredInvalidReasonOptions,
  lostReasonOptions as configuredLostReasonOptions,
  optionTuples,
  paidStatusOptions,
  quickReplyTemplates,
} from "@/lib/crm/settingsConfig";
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
  const runtime = await getCrmRuntimeStatus();
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
  const aiReplyDrafts = getCrmAiReplyDrafts({
    brandName: leadCase.brandName,
    treatmentOffer: leadCase.treatmentOffer,
    appointmentPreference: leadCase.appointmentLabel,
    confirmedAppointment: confirmedAppointmentLabel,
  });

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
                Phone-first identity: {leadCase.canonicalIdentity}
              </p>
            </div>
            {leadCase.whatsappUrl ? (
              <a
                href={leadCase.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 whitespace-nowrap rounded-md border border-[#bbf7d0] bg-[#f0fdf4] px-2.5 text-[10px] font-black text-[#15803d] transition hover:bg-[#dcfce7]"
              >
                <span className="self-center">WA</span>
              </a>
            ) : (
              <span className="inline-flex h-8 whitespace-nowrap rounded-md border border-[#e5e7eb] bg-[#f8fafc] px-2.5 text-[11px] font-bold text-[#94a3b8]">
                <span className="self-center">No WhatsApp</span>
              </span>
            )}
          </div>

          {error && (
            <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700">
              CRM detail could not refresh all latest records.
            </p>
          )}
          {!runtime.actionsEnabled && (
            <div className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-800">
              <p>{runtime.disabledReason}</p>
              {runtime.debug && (
                <dl className="mt-2 grid gap-1 rounded-md bg-white/70 p-2 font-mono text-[10px] leading-4 text-[#475569]">
                  <DebugLine label="operation" value={runtime.debug.operation} />
                  <DebugLine label="code" value={runtime.debug.code ?? "-"} />
                  <DebugLine label="message" value={runtime.debug.message} />
                  <DebugLine label="details" value={runtime.debug.details ?? "-"} />
                  <DebugLine label="hint" value={runtime.debug.hint ?? "-"} />
                </dl>
              )}
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
              {feedback.debug && (
                <dl className="mt-2 grid gap-1 rounded-md bg-white/70 p-2 font-mono text-[10px] leading-4 text-[#475569]">
                  <DebugLine label="operation" value={feedback.debug.operation} />
                  <DebugLine label="code" value={feedback.debug.code} />
                  <DebugLine label="message" value={feedback.debug.message} />
                  <DebugLine label="details" value={feedback.debug.details} />
                  <DebugLine label="hint" value={feedback.debug.hint} />
                </dl>
              )}
            </div>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-auto p-3.5">
          <div className="grid gap-3.5 xl:grid-cols-[360px_1fr]">
            <div className="grid gap-3.5">
              <Panel title="Contact">
                <InfoLine label="Name" value={leadCase.customerName} />
                <InfoLine label="Phone" value={leadCase.phone} />
                <InfoLine label="Email" value={leadCase.email} />
                <InfoLine label="Normalized" value={leadCase.normalizedPhone} />
                <InfoLine label="Brand" value={leadCase.brandName} />
                <InfoLine label="Assigned to" value={leadCase.assignedCsLabel} />
                <InfoLine label="Next follow-up" value={leadCase.nextFollowUpLabel} />
              </Panel>

              <Panel title="Treatment / Preference">
                <InfoLine label="Offer" value={leadCase.treatmentOffer} />
                <InfoLine label="Package" value={leadCase.packagePrice} />
                <InfoLine label="Branch" value={leadCase.branchName} />
                <InfoLine label="客人偏好日期時間" value={leadCase.appointmentLabel} />
                <InfoLine
                  label="CS 已確認預約"
                  value={hasConfirmedBooking ? "已確認" : "未確認"}
                />
                <InfoLine label="Created" value={leadCase.createdLabel} />
                <InfoLine label="Last activity" value={leadCase.lastActivityLabel} />
              </Panel>

              <Panel title="CS Confirmed Appointment">
                <InfoLine label="Confirmed date/time" value={confirmedAppointmentLabel} />
                <InfoLine label="Room arrangement" value={bookingMeta.roomArrangement || "-"} />
                <InfoLine label="Paid status" value={bookingMeta.paidStatusLabel} />
                <InfoLine label="Booking note" value={bookingMeta.bookingNote || "-"} />
                <InfoLine label="Booking record status" value={bundle.booking?.status || "-"} />
              </Panel>
            </div>

            <div className="grid gap-3.5">
              <div className="grid gap-3.5 xl:grid-cols-3">
                <ManualWhatsAppPanel leadCase={leadCase} />

                <ActionPanel
                  title="Assignment"
                  enabled={runtime.actionsEnabled}
                  action={assignCsAction.bind(null, leadId)}
                  submitLabel="Save assignment"
                >
                  <TextInput
                    name="assigned_to"
                    label="Assigned CS"
                    defaultValue={bundle.caseRecord?.assigned_to || ""}
                    placeholder="CS name"
                  />
                </ActionPanel>

                <ActionPanel
                  title="CS 跟進狀態"
                  enabled={runtime.actionsEnabled}
                  action={updateStatusAction.bind(null, leadId)}
                  submitLabel="Update status"
                >
                  <SelectInput
                    name="status"
                    label="Status"
                    defaultValue={leadCase.status}
                    options={crmPipelineStatuses.map((item) => [item.value, item.label])}
                  />
                  <TextAreaInput
                    name="status_note"
                    label="Status note"
                    placeholder="Optional note"
                  />
                </ActionPanel>

                <ActionPanel
                  title="Contact Attempt"
                  enabled={runtime.actionsEnabled}
                  action={recordContactAttemptAction.bind(null, leadId)}
                  submitLabel="Save contact attempt"
                >
                  <SelectInput
                    name="contact_channel"
                    label="Channel"
                    defaultValue="whatsapp"
                    options={optionTuples(contactChannelOptions)}
                  />
                  <SelectInput
                    name="contact_outcome"
                    label="Outcome"
                    defaultValue="pending"
                    options={optionTuples(followUpOutcomeOptions)}
                  />
                  <TextAreaInput
                    name="contact_note"
                    label="Follow-up note"
                    placeholder="例：WhatsApp 已發出，客人話明天下午再覆。"
                    maxLength={2000}
                  />
                  <TextInput
                    name="next_follow_up_at"
                    type="datetime-local"
                    label="Next follow-up"
                  />
                </ActionPanel>

                <ActionPanel
                  title="CS 確認預約"
                  enabled={runtime.actionsEnabled}
                  action={confirmBookingAction.bind(null, leadId)}
                  submitLabel="Confirm booking"
                >
                  <TextInput
                    name="branch_label"
                    label="Branch"
                    defaultValue={bundle.booking?.branch_label || leadCase.branchName}
                  />
                  <TextInput
                    name="treatment_label"
                    label="Treatment"
                    defaultValue={bundle.booking?.treatment_label || leadCase.treatmentOffer}
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <TextInput
                      type="date"
                      name="confirmed_appointment_date"
                      label="Confirmed date"
                      defaultValue={bundle.booking?.booking_date || ""}
                    />
                    <TextInput
                      type="time"
                      name="confirmed_appointment_time"
                      label="Confirmed time"
                      defaultValue={bundle.booking?.booking_time || ""}
                    />
                  </div>
                  <TextInput
                    name="room_arrangement"
                    label="Room arrangement"
                    defaultValue={bookingMeta.roomArrangement}
                    placeholder="例：CWB Room 1"
                  />
                  <SelectInput
                    name="paid_status"
                    label="Paid status"
                    defaultValue={bookingMeta.paidStatus}
                    options={optionTuples(paidStatusOptions)}
                  />
                  <TextAreaInput
                    name="booking_note"
                    label="Booking note"
                    defaultValue={bookingMeta.bookingNote}
                    placeholder="Internal booking note"
                  />
                </ActionPanel>

                <QuickActionsPanel
                  canMarkAttendance={canMarkAttendance}
                  showedAction={markShowedAction.bind(null, leadId)}
                  noShowAction={markNoShowAction.bind(null, leadId)}
                />

                <ActionPanel
                  title="Invalid Reason"
                  enabled={runtime.actionsEnabled}
                  action={markInvalidAction.bind(null, leadId)}
                  submitLabel="Mark invalid"
                >
                  <SelectInput
                    name="invalid_reason_code"
                    label="Reason"
                    defaultValue=""
                    options={[["", "請選擇原因"], ...optionTuples(configuredInvalidReasonOptions)]}
                  />
                  <TextAreaInput
                    name="invalid_reason_note"
                    label="Reason note"
                    placeholder="Optional note"
                  />
                </ActionPanel>

                <ActionPanel
                  title="Follow-up Task"
                  enabled={runtime.actionsEnabled}
                  action={createFollowUpTaskAction.bind(null, leadId)}
                  submitLabel="Create task"
                >
                  <TextInput
                    name="task_assigned_to"
                    label="CS owner"
                    defaultValue={bundle.caseRecord?.assigned_to || ""}
                  />
                  <TextInput name="due_at" type="datetime-local" label="Due at" />
                  <TextInput name="task_type" label="Task type" defaultValue="follow_up" />
                  <TextAreaInput
                    name="task_note"
                    label="Task note"
                    placeholder="Follow-up reminder"
                  />
                </ActionPanel>

                <ActionPanel
                  title="Lost Reason"
                  enabled={runtime.actionsEnabled}
                  action={saveLostReasonAction.bind(null, leadId)}
                  submitLabel="Save lost reason"
                >
                  <SelectInput
                    name="lost_reason_code"
                    label="Reason"
                    defaultValue=""
                    options={[["", "請選擇原因"], ...optionTuples(configuredLostReasonOptions)]}
                  />
                  <TextAreaInput
                    name="lost_reason_note"
                    label="Reason note"
                    defaultValue={bundle.caseRecord?.lost_reason || ""}
                    placeholder="Optional note"
                  />
                </ActionPanel>

                <TimelinePanel interactions={bundle.interactions} />
                <QuickReplyPanel templates={quickReplyTemplates} />
                <AiDraftPanel drafts={aiReplyDrafts} />
                <Placeholder title="Brand Knowledge" body="Treatment FAQ, policies, and brand information will support CS and AI responses." />
                <Placeholder title="Intent / Tagging" body="Inquiry intent, objections, budget, and treatment tags are reserved." />
                <Placeholder title="Next Best Action" body="Future CRM can recommend WhatsApp follow-up, booking confirmation, or payment reminders." />
                <MarketingTrackingPanel
                  leadCase={leadCase}
                  formToken={bundle.caseRecord?.form_token || "-"}
                  lostReason={bundle.caseRecord?.lost_reason || "-"}
                  hasCtwa={hasCtwa}
                />
              </div>
            </div>
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
  const debug = {
    operation: firstQueryValue(query?.crm_operation) || "-",
    code: firstQueryValue(query?.crm_code) || "-",
    message: firstQueryValue(query?.crm_message) || "-",
    details: firstQueryValue(query?.crm_details) || "-",
    hint: firstQueryValue(query?.crm_hint) || "-",
  };

  const successMessages: Record<string, string> = {
    assignment_saved: "Assignment saved.",
    status_updated: "Status updated. Timeline has been refreshed.",
    contact_attempt_saved: "Contact attempt saved. Timeline has been refreshed.",
    booking_confirmed: "Booking confirmed. Timeline has been refreshed.",
    showed_saved: "Lead marked as showed.",
    no_show_saved: "Lead marked as no-show.",
    invalid_saved: "Lead marked as invalid.",
    follow_up_saved: "Follow-up task saved.",
    lost_reason_saved: "Lost reason saved.",
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
      message:
        debug.message !== "-"
          ? debug.message
          : "CRM write actions are not enabled yet.",
      debug: debug.message !== "-" ? debug : undefined,
    };
  }

  if (error === "action_failed") {
    return {
      kind: "error" as const,
      message:
        debug.message !== "-"
          ? debug.message
          : "CRM action could not be saved. Please check CRM table setup and try again.",
      debug,
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
      paidStatus === "paid" ? "Paid" : paidStatus === "unpaid" ? "Unpaid" : "Unknown",
    roomArrangement: metadataString(metadata, "room_arrangement"),
    bookingNote: metadataString(metadata, "booking_note"),
  };
}

function metadataString(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : "";
}

function DebugLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[88px_1fr]">
      <dt className="font-bold uppercase text-[#64748b]">{label}</dt>
      <dd className="break-words text-[#111827]">{value}</dd>
    </div>
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

function ManualWhatsAppPanel({ leadCase }: { leadCase: CrmLeadCase }) {
  return (
    <section className="rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] p-3.5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[13px] font-bold text-[#111827]">
          Contact / WhatsApp
        </h2>
        <span className="rounded-md bg-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[#15803d]">
          Manual
        </span>
      </div>
      <dl className="mt-3 grid gap-2">
        <InfoLine label="Phone" value={leadCase.normalizedPhone || leadCase.phone || "-"} />
        <InfoLine label="Status" value="Open WhatsApp 後，請用 Contact Attempt 記錄結果。" />
      </dl>
      {leadCase.whatsappUrl ? (
        <a
          href={leadCase.whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex h-8 items-center justify-center rounded-md bg-[#16a34a] px-3 text-[11px] font-black text-white transition hover:bg-[#15803d]"
        >
          Open WhatsApp
        </a>
      ) : (
        <p className="mt-3 rounded-md bg-white/80 px-3 py-2 text-[11px] font-semibold text-[#64748b]">
          未有可用 WhatsApp link。這不是 WhatsApp API integration。
        </p>
      )}
    </section>
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
        <button
          type="submit"
          disabled={!enabled}
          className={`h-7 whitespace-nowrap rounded-md px-2.5 text-[10px] font-bold ${
            enabled
              ? "bg-[#111827] text-white transition hover:bg-[#0f172a]"
              : "bg-[#e5e7eb] text-[#94a3b8]"
          }`}
        >
          {submitLabel}
        </button>
      </form>
    </section>
  );
}

function AiDraftPanel({ drafts }: { drafts: Array<{ title: string; body: string }> }) {
  return (
    <section className="rounded-lg border border-[#dbeafe] bg-white p-3.5 xl:col-span-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-bold text-[#111827]">
            AI 回覆草稿 / 需人手發送
          </h2>
          <p className="mt-1 text-[11px] font-semibold text-[#64748b]">
            暫時是本地模板草稿，未接外部 AI，亦不會自動發送 WhatsApp。
          </p>
        </div>
        <span className="rounded-md bg-[#eff6ff] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[#1d4ed8]">
          Draft only
        </span>
      </div>
      <div className="mt-3 grid gap-2 lg:grid-cols-2">
        {drafts.map((draft) => (
          <article key={draft.title} className="rounded-md border border-[#e5e7eb] bg-[#f8fafc] p-3">
            <p className="text-[11px] font-black text-[#111827]">{draft.title}</p>
            <p className="mt-1 whitespace-pre-line text-[12px] font-semibold leading-5 text-[#475569]">
              {draft.body}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function QuickReplyPanel({ templates }: { templates: Array<{ title: string; body: string }> }) {
  return (
    <section className="rounded-lg border border-[#e5e7eb] bg-white p-3.5 xl:col-span-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-bold text-[#111827]">
            WhatsApp Quick Replies / 手動複製
          </h2>
          <p className="mt-1 text-[11px] font-semibold text-[#64748b]">
            這些是 settings-ready 模板。請複製文字後人手貼到 WhatsApp；系統不會自動發送。
          </p>
        </div>
        <span className="rounded-md bg-[#f0fdf4] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[#15803d]">
          Manual send
        </span>
      </div>
      <div className="mt-3 grid gap-2 lg:grid-cols-2">
        {templates.map((template) => (
          <article key={template.title} className="rounded-md border border-[#e5e7eb] bg-[#f8fafc] p-3">
            <p className="text-[11px] font-black text-[#111827]">{template.title}</p>
            <p className="mt-1 whitespace-pre-line text-[12px] font-semibold leading-5 text-[#475569]">
              {template.body}
            </p>
          </article>
        ))}
      </div>
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
    <section className="rounded-lg border border-[#e5e7eb] bg-white p-3.5 xl:col-span-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-bold text-[#111827]">
            Marketing / Tracking 資料（內部分析用）
          </h2>
          <p className="mt-1 text-[11px] font-semibold text-[#64748b]">
            這些資料只供報表及 Marketing 分析，不應用來判斷是否已預約。
          </p>
        </div>
        <span className="rounded-md bg-[#f1f5f9] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[#64748b]">
          Analysis only
        </span>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Panel title="Source">
          <InfoLine label="CRM source" value={leadCase.sourceLabel} />
          <InfoLine label="Raw source type" value={leadCase.sourceTypeRaw} />
          <InfoLine label="Landing page" value={leadCase.landingPageSlug || "-"} />
          <InfoLine label="Form token" value={formToken} />
          <InfoLine label="Page URL" value={leadCase.pageUrl || "-"} />
          <InfoLine label="Campaign" value={leadCase.campaignLabel} />
          <InfoLine label="Ad / Content" value={leadCase.adLabel} />
          <InfoLine label="Lost reason" value={lostReason} />
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
              No CTWA referral data yet. WhatsApp webhook/API can enrich this block later.
            </p>
          )}
        </Panel>
      </div>
    </section>
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
      <button
        type="submit"
        disabled={!enabled}
        className={`h-7 w-full whitespace-nowrap rounded-md px-2.5 text-[10px] font-bold ${
          enabled
            ? "border border-[#dbeafe] bg-[#eff6ff] text-[#1d4ed8] transition hover:bg-[#dbeafe]"
            : "bg-[#e5e7eb] text-[#94a3b8]"
        }`}
      >
        {label}
      </button>
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
        <h2 className="text-[13px] font-bold text-[#111827]">Timeline</h2>
        <span className="rounded-md bg-[#f1f5f9] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[#64748b]">
          crm_interactions
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
          No CRM interactions yet.
        </p>
      )}
    </section>
  );
}

function Placeholder({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-lg border border-dashed border-[#cbd5e1] bg-white p-3.5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[13px] font-bold text-[#111827]">{title}</h2>
        <span className="rounded-md bg-[#f1f5f9] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[#64748b]">
          Later
        </span>
      </div>
      <p className="mt-2 text-[12px] leading-5 text-[#64748b]">{body}</p>
      <button
        type="button"
        disabled
        className="mt-3 h-7 whitespace-nowrap rounded-md bg-[#e5e7eb] px-2.5 text-[10px] font-bold text-[#94a3b8]"
      >
        Coming soon
      </button>
    </section>
  );
}
