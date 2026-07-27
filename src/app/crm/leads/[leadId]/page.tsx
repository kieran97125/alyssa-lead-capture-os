import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { CrmStatusBadge } from "@/components/crm/CrmStatusBadge";
import { ReplyComposer } from "@/components/crm/ReplyComposer";
import { WhatsAppSendBox } from "@/components/crm/WhatsAppSendBox";
import { formatDateTime, getLeadRows } from "@/lib/data/businessMetrics";
import {
  crmPipelineStatuses,
  toCrmLeadCase,
  type CrmLeadCase,
} from "@/lib/crm/leadOps";
import {
  getCrmAiReplyDraftsFromSettings,
  getCrmSettings,
} from "@/lib/crm/settingsLoader";
import { optionTuples } from "@/lib/crm/settingsConfig";
import {
  assignCsAction,
  captureWhatsAppDemandSignalAction,
  confirmBookingAction,
  createFollowUpTaskAction,
  markInvalidAction,
  markNoShowAction,
  markShowedAction,
  recordContactAttemptAction,
  saveLostReasonAction,
  updateStatusAction,
} from "./actions";
import { getDemandSignalsForLead } from "@/lib/demandSignals/service";
import {
  demandSignalSourceLabels,
  demandSignalStatusLabels,
  demandSignalTypeLabels,
  demandSignalTypes,
  type DemandSignalSource,
  type DemandSignalStatus,
  type DemandSignalType,
} from "@/lib/demandSignals/types";
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
  const aiReplyDrafts = getCrmAiReplyDraftsFromSettings(
    crmSettings,
    {
      brandName: leadCase.brandName,
      treatmentOffer: leadCase.treatmentOffer,
      appointmentPreference: leadCase.appointmentLabel,
      confirmedAppointment: confirmedAppointmentLabel,
    }
  );
  const latestContactNote = getLatestContactNote(bundle.interactions);
  const [whatsappConnectionView, whatsappMessagesResult, demandSignals] = await Promise.all([
    getWhatsAppConnectionByBrandSlug(leadCase.brandSlug),
    getWhatsAppMessagesForLead(lead.id, 20),
    getDemandSignalsForLead(lead.brand_id || "", lead.id),
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

        <div className="min-h-0 flex-1 overflow-auto bg-[#f8fafc] p-3.5">
          <div className="grid gap-3.5">
            <BookingSummaryPanel
              leadCase={leadCase}
              confirmedAppointmentLabel={confirmedAppointmentLabel}
              hasConfirmedBooking={hasConfirmedBooking}
            />
            <CsActionRow
              whatsappUrl={leadCase.whatsappUrl}
              canMarkAttendance={canMarkAttendance}
            />

            <div className="grid gap-3.5 xl:grid-cols-[minmax(0,1fr)_390px]">
              <div className="grid gap-3.5">
                <ConversationPanel
                  interactions={bundle.interactions}
                  leadCase={leadCase}
                  confirmedAppointmentLabel={confirmedAppointmentLabel}
                />

                <WhatsAppConnectionPanel
                  leadId={lead.id}
                  brandId={lead.brand_id || ""}
                  phone={leadCase.normalizedPhone || leadCase.phone}
                  connectionView={whatsappConnectionView}
                  messages={whatsappMessagesResult.messages}
                  messagesTableReady={whatsappMessagesResult.tableReady}
                  captureEnabled={runtime.actionsEnabled}
                />

                <ReplyComposer
                  quickReplies={crmSettings.quickReplyTemplates}
                  aiDrafts={aiReplyDrafts}
                  context={{
                    customerName: leadCase.customerName,
                    brandName: leadCase.brandName,
                    treatmentOffer: leadCase.treatmentOffer,
                    statusLabel: leadCase.statusLabel,
                    appointmentPreference: leadCase.appointmentLabel,
                    confirmedAppointment: confirmedAppointmentLabel,
                    latestContactNote,
                    whatsappUrl: leadCase.whatsappUrl,
                  }}
                />

                <section id="timeline">
                  <TimelinePanel interactions={bundle.interactions} />
                </section>
              </div>

              <aside className="grid content-start gap-3.5">
                <Panel title="Customer">
                  <InfoLine label="Name" value={leadCase.customerName} />
                  <InfoLine label="Phone" value={leadCase.phone} />
                  <InfoLine label="Email" value={leadCase.email} />
                  <InfoLine label="Brand" value={leadCase.brandName} />
                  <InfoLine label="Assigned to" value={leadCase.assignedCsLabel} />
                </Panel>

                <Panel title="Booking Details">
                  <InfoLine label="Treatment / offer" value={leadCase.treatmentOffer} />
                  <InfoLine label="Package" value={leadCase.packagePrice} />
                  <InfoLine label="Branch" value={leadCase.branchName} />
                  <InfoLine label="Preferred time" value={leadCase.appointmentLabel} />
                  <InfoLine label="Confirmed time" value={confirmedAppointmentLabel} />
                  <InfoLine label="Room" value={bookingMeta.roomArrangement || "-"} />
                  <InfoLine label="Paid status" value={bookingMeta.paidStatusLabel} />
                </Panel>

                <DemandSignalsPanel signals={demandSignals} />

                <section id="contact-actions" className="grid gap-3.5">
                  <ManualWhatsAppPanel leadCase={leadCase} />
                  <ActionPanel
                    title="Log contact attempt"
                    enabled={runtime.actionsEnabled}
                    action={recordContactAttemptAction.bind(null, leadId)}
                    submitLabel="Save contact attempt"
                  >
                    <SelectInput
                      name="contact_channel"
                      label="Channel"
                      defaultValue="whatsapp"
                      options={optionTuples(crmSettings.contactChannelOptions)}
                    />
                    <SelectInput
                      name="contact_outcome"
                      label="Outcome"
                      defaultValue="pending"
                      options={optionTuples(crmSettings.followUpOutcomeOptions)}
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
                </section>

                <section id="confirm-booking">
                  <ActionPanel
                    title="Confirm booking"
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
                      options={optionTuples(crmSettings.paidStatusOptions)}
                    />
                    <TextAreaInput
                      name="booking_note"
                      label="Booking note"
                      defaultValue={bookingMeta.bookingNote}
                      placeholder="Internal booking note"
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
                    title="Mark lost"
                    enabled={runtime.actionsEnabled}
                    action={saveLostReasonAction.bind(null, leadId)}
                    submitLabel="Save lost reason"
                  >
                    <SelectInput
                      name="lost_reason_code"
                      label="Reason"
                      defaultValue=""
                      options={[["", "請選擇原因"], ...optionTuples(crmSettings.lostReasonOptions)]}
                    />
                    <TextAreaInput
                      name="lost_reason_note"
                      label="Reason note"
                      defaultValue={bundle.caseRecord?.lost_reason || ""}
                      placeholder="Optional note"
                    />
                  </ActionPanel>

                  <ActionPanel
                    title="Mark invalid"
                    enabled={runtime.actionsEnabled}
                    action={markInvalidAction.bind(null, leadId)}
                    submitLabel="Mark invalid"
                  >
                    <SelectInput
                      name="invalid_reason_code"
                      label="Reason"
                      defaultValue=""
                      options={[["", "請選擇原因"], ...optionTuples(crmSettings.invalidReasonOptions)]}
                    />
                    <TextAreaInput
                      name="invalid_reason_note"
                      label="Reason note"
                      placeholder="Optional note"
                    />
                  </ActionPanel>
                </section>

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

                <Placeholder title="Brand Knowledge" body="Treatment FAQ, policies, and brand information will support CS and AI responses." />
                <Placeholder title="Next Best Action" body="Future CRM can recommend WhatsApp follow-up, booking confirmation, or payment reminders." />
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
    demand_signal_created: "Demand Signal captured for human review.",
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

function getLatestContactNote(interactions: CrmInteractionRecord[]) {
  const contactInteraction = interactions.find((item) =>
    ["contact_attempt", "note", "status_change"].includes(item.interaction_type)
  );
  return contactInteraction?.body?.trim().slice(0, 180) ?? "";
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

function BookingSummaryPanel({
  leadCase,
  confirmedAppointmentLabel,
  hasConfirmedBooking,
}: {
  leadCase: CrmLeadCase;
  confirmedAppointmentLabel: string;
  hasConfirmedBooking: boolean;
}) {
  return (
    <section className="rounded-lg border border-[#e5e7eb] bg-white p-3.5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#64748b]">
            Booking summary
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h2 className="truncate text-xl font-black text-[#111827]">
              {leadCase.customerName}
            </h2>
            <CrmStatusBadge status={leadCase.status} label={leadCase.statusLabel} />
          </div>
          <p className="mt-1 text-[12px] font-semibold text-[#475569]">
            {leadCase.phone} · {leadCase.treatmentOffer}
          </p>
        </div>
        <div className="rounded-md border border-[#eef2f6] bg-[#f8fafc] px-3 py-2 text-[11px] font-semibold text-[#475569]">
          <span className="font-black text-[#111827]">Booking rule:</span>{" "}
          客人偏好日期時間不等於已預約；只有 CS 確認後才是已預約。
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <SummaryItem label="Phone / WhatsApp" value={leadCase.normalizedPhone || leadCase.phone || "-"} />
        <SummaryItem label="Treatment / offer" value={leadCase.treatmentOffer} />
        <SummaryItem label="客人偏好日期時間" value={leadCase.appointmentLabel} />
        <SummaryItem
          label="CS 已確認預約"
          value={hasConfirmedBooking ? confirmedAppointmentLabel : "未確認"}
          tone={hasConfirmedBooking ? "success" : "neutral"}
        />
        <SummaryItem label="Follow-up / next" value={leadCase.nextFollowUpLabel} />
        <SummaryItem label="Branch" value={leadCase.branchName} />
        <SummaryItem label="Package" value={leadCase.packagePrice} />
        <SummaryItem label="Last updated" value={leadCase.lastActivityLabel} />
      </div>
    </section>
  );
}

function SummaryItem({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "success";
}) {
  return (
    <div
      className={`rounded-md border px-3 py-2 ${
        tone === "success"
          ? "border-[#bbf7d0] bg-[#f0fdf4]"
          : "border-[#eef2f6] bg-[#f8fafc]"
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#64748b]">
        {label}
      </p>
      <p className="mt-1 min-w-0 break-words text-[12px] font-black text-[#111827]">
        {value}
      </p>
    </div>
  );
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
            Open WhatsApp
          </a>
        ) : (
          <span className="inline-flex h-8 items-center rounded-md bg-[#e5e7eb] px-3 text-[11px] font-black text-[#94a3b8]">
            No WhatsApp
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

function ConversationPanel({
  interactions,
  leadCase,
  confirmedAppointmentLabel,
}: {
  interactions: CrmInteractionRecord[];
  leadCase: CrmLeadCase;
  confirmedAppointmentLabel: string;
}) {
  const contextEvents = buildConversationContextEvents(
    interactions,
    leadCase,
    confirmedAppointmentLabel
  );

  return (
    <section className="min-h-[360px] rounded-lg border border-[#e5e7eb] bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eef2f6] px-3.5 py-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#64748b]">
            Conversation
          </p>
          <h2 className="mt-1 text-[15px] font-black text-[#111827]">
            WhatsApp 對話工作區
          </h2>
          <p className="mt-1 text-[12px] font-semibold leading-5 text-[#64748b]">
            完成 WhatsApp 連接後，對話紀錄會顯示喺呢度。現階段下方只顯示內部跟進脈絡，方便 CS 回覆前參考。
          </p>
        </div>
        <span className="rounded-md bg-[#f8fafc] px-2 py-1 text-[10px] font-black text-[#64748b]">
          Manual WhatsApp
        </span>
      </div>

      <div className="grid gap-3 p-3.5">
        <div className="rounded-lg border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-3 py-4 text-center">
          <p className="text-[13px] font-black text-[#111827]">
            完成 WhatsApp 連接後，對話紀錄會顯示喺呢度。
          </p>
          <p className="mt-1 text-[12px] font-semibold leading-5 text-[#64748b]">
            目前仍需人手開啟 WhatsApp；智能回覆只會填入草稿，需同事確認。
          </p>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-[12px] font-black text-[#111827]">
              Internal context
            </h3>
            <span className="text-[10px] font-bold text-[#94a3b8]">
              Not synced messages
            </span>
          </div>
          <ol className="grid gap-2">
            {contextEvents.map((event) => (
              <li
                key={`${event.label}-${event.time}-${event.body}`}
                className="rounded-lg border border-[#eef2f6] bg-[#fbfdff] px-3 py-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-black text-[#111827]">
                    {event.label}
                  </span>
                  <span className="text-[10px] font-semibold text-[#64748b]">
                    {event.time}
                  </span>
                </div>
                <p className="mt-1 text-[12px] font-semibold leading-5 text-[#475569]">
                  {event.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
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
  captureEnabled,
}: {
  leadId: string;
  brandId: string;
  phone: string;
  connectionView: WhatsAppConnectionView;
  messages: WhatsAppMessageRecord[];
  messagesTableReady: boolean;
  captureEnabled: boolean;
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
            Synced WhatsApp messages appear here after the Meta Cloud API
            connection and SQL migration are active.
          </p>
        </div>
        <Link
          href="/crm/settings/whatsapp"
          className="rounded-md border border-[#e5e7eb] bg-[#f8fafc] px-2.5 py-1.5 text-[11px] font-black text-[#111827]"
        >
          Open WhatsApp Settings
        </Link>
      </div>
      <div className="grid gap-3 p-3.5">
        <div className="grid gap-2 rounded-lg border border-[#eef2f6] bg-[#f8fafc] px-3 py-2 text-[12px] font-semibold text-[#475569] sm:grid-cols-3">
          <InfoLine label="Customer phone" value={phone || "-"} />
          <InfoLine label="Connection" value={connectionView.statusLabel} />
          <InfoLine
            label="Message table"
            value={messagesTableReady ? "Ready" : "SQL required"}
          />
        </div>

        {!connected && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-bold text-amber-900">
            WhatsApp is not ready yet. Apply the SQL migration, set
            `WHATSAPP_CREDENTIAL_ENCRYPTION_KEY`, then save the Ineffable
            connection in settings.
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
                {message.direction === "inbound" && message.body && (
                  <form
                    action={captureWhatsAppDemandSignalAction.bind(null, leadId)}
                    className="mt-2 grid gap-2 rounded-md border border-[#dbeafe] bg-[#eff6ff] p-2 sm:grid-cols-[150px_minmax(0,1fr)_auto]"
                  >
                    <input type="hidden" name="brand_id" value={brandId} />
                    <input
                      type="hidden"
                      name="source_record_id"
                      value={message.id}
                    />
                    <select
                      name="signal_type"
                      aria-label="Demand Signal type"
                      defaultValue="need"
                      className="h-8 rounded-md border border-[#bfdbfe] bg-white px-2 text-[11px] font-bold text-[#1e3a8a]"
                    >
                      {demandSignalTypes.map((type) => (
                        <option key={type} value={type}>
                          {demandSignalTypeLabels[type]}
                        </option>
                      ))}
                    </select>
                    <input
                      required
                      name="normalized_tag"
                      aria-label="Demand Signal tag"
                      placeholder="例如：results_timeline"
                      className="h-8 min-w-0 rounded-md border border-[#bfdbfe] bg-white px-2 text-[11px] font-semibold text-[#111827]"
                    />
                    <button
                      type="submit"
                      disabled={!captureEnabled}
                      className="h-8 whitespace-nowrap rounded-md bg-[#1d4ed8] px-2.5 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:bg-[#94a3b8]"
                    >
                      Capture Signal
                    </button>
                  </form>
                )}
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

function DemandSignalsPanel({
  signals,
}: {
  signals: Array<{
    id: string;
    signal_type: DemandSignalType;
    exact_quote: string;
    normalized_tag: string;
    source_type: DemandSignalSource;
    status: DemandSignalStatus;
    occurred_at: string;
  }>;
}) {
  return (
    <Panel title="Demand Signals">
      {signals.length ? (
        <ol className="grid gap-2">
          {signals.map((signal) => (
            <li
              key={signal.id}
              className="rounded-md border border-[#e0e7ff] bg-[#f8fafc] px-2.5 py-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-black text-[#3730a3]">
                  {demandSignalTypeLabels[signal.signal_type]} · {signal.normalized_tag}
                </span>
                <span className="text-[9px] font-bold uppercase text-[#64748b]">
                  {demandSignalStatusLabels[signal.status]}
                </span>
              </div>
              <p className="mt-1 text-[11px] font-semibold leading-5 text-[#334155]">
                {signal.exact_quote}
              </p>
              <p className="mt-1 text-[9px] font-bold text-[#94a3b8]">
                {demandSignalSourceLabels[signal.source_type]} · {formatDateTime(signal.occurred_at)}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-md border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-3 py-3 text-[11px] font-semibold text-[#64748b]">
          未有 Demand Signal。可由 inbound WhatsApp 訊息或已啟用問題嘅表格擷取。
        </p>
      )}
      <Link
        href="/growth-intelligence/demand-signals"
        className="mt-2 inline-flex text-[10px] font-black text-[#1d4ed8]"
      >
        Open Demand Signals →
      </Link>
    </Panel>
  );
}

function buildConversationContextEvents(
  interactions: CrmInteractionRecord[],
  leadCase: CrmLeadCase,
  confirmedAppointmentLabel: string
) {
  const initialEvent = {
    label: "Form submission",
    time: leadCase.createdLabel,
    body: `${leadCase.customerName} submitted interest in ${leadCase.treatmentOffer}. Preferred appointment: ${leadCase.appointmentLabel}.`,
  };

  const internalEvents = interactions.slice(0, 6).map((item) => ({
    label: interactionLabel(item.interaction_type),
    time: formatDateTime(item.created_at),
    body: item.body || "Internal CRM activity recorded.",
  }));

  const bookingEvent =
    confirmedAppointmentLabel && !confirmedAppointmentLabel.includes("未")
      ? [
          {
            label: "Confirmed booking",
            time: leadCase.lastActivityLabel,
            body: `CS confirmed appointment: ${confirmedAppointmentLabel}.`,
          },
        ]
      : [];

  return [initialEvent, ...bookingEvent, ...internalEvents];
}

function interactionLabel(type: string) {
  const labels: Record<string, string> = {
    contact_attempt: "Contact attempt",
    status_change: "Status update",
    note: "Internal note",
    booking_confirmed: "Booking confirmed",
    showed: "Marked showed",
    no_show: "Marked no-show",
    lost: "Marked lost",
    invalid: "Marked invalid",
  };

  return labels[type] ?? "Internal activity";
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
          未有可用 WhatsApp link。請先用電話或其他方式聯絡客人。
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
              Marketing / Tracking 資料（內部分析用）
            </h2>
            <p className="mt-1 text-[11px] font-semibold text-[#64748b]">
              預設收合。這些資料只供報表及 Marketing 分析，不應用來判斷是否已預約。
            </p>
          </div>
          <span className="rounded-md bg-[#f1f5f9] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[#64748b]">
            Analysis only
          </span>
        </div>
      </summary>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold text-[#64748b]">
            展開後只供內部分析排查；CS booking workflow 不需要依賴這些欄位。
          </p>
        </div>
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
              No WhatsApp ad referral data yet. Future connection can enrich this block later.
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
          Internal log
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
