"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLeadRows } from "@/lib/data/businessMetrics";
import {
  bootstrapCrmLeadCaseFromLead,
  createCrmInteraction,
  CrmOperationError,
  getCrmCaseBundleByCaseRecord,
  getCrmRuntimeStatus,
  insertCrmInteraction,
  safeError,
  safeText,
  type CrmLeadCaseRecord,
} from "@/lib/crm/store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { CrmStatus } from "@/lib/crm/leadOps";

const allowedStatuses: CrmStatus[] = [
  "new",
  "contacting",
  "booked",
  "showed",
  "no_show",
  "lost",
  "invalid",
];

const contactChannels = ["phone", "whatsapp", "inbox", "other"] as const;
const contactOutcomes = ["reached", "no_answer", "replied", "pending", "other"] as const;
const lostReasonCodes = [
  "no_reply",
  "price_concern",
  "time_not_fit",
  "location_not_fit",
  "changed_mind",
  "duplicate",
  "other",
] as const;
const invalidReasonCodes = [
  "fake_contact",
  "wrong_number",
  "spam",
  "duplicate",
  "other",
] as const;

const contactChannelLabels: Record<(typeof contactChannels)[number], string> = {
  phone: "Phone",
  whatsapp: "WhatsApp",
  inbox: "Inbox",
  other: "Other",
};

const contactOutcomeLabels: Record<(typeof contactOutcomes)[number], string> = {
  reached: "reached",
  no_answer: "no answer",
  replied: "replied",
  pending: "pending",
  other: "other",
};

const lostReasonLabels: Record<(typeof lostReasonCodes)[number], string> = {
  no_reply: "no reply",
  price_concern: "price concern",
  time_not_fit: "time not fit",
  location_not_fit: "location not fit",
  changed_mind: "changed mind",
  duplicate: "duplicate",
  other: "other",
};

const invalidReasonLabels: Record<(typeof invalidReasonCodes)[number], string> = {
  fake_contact: "fake contact",
  wrong_number: "wrong number",
  spam: "spam",
  duplicate: "duplicate",
  other: "other",
};

function isContactChannel(value: string): value is (typeof contactChannels)[number] {
  return (contactChannels as readonly string[]).includes(value);
}

function isContactOutcome(value: string): value is (typeof contactOutcomes)[number] {
  return (contactOutcomes as readonly string[]).includes(value);
}

function isLostReasonCode(value: string): value is (typeof lostReasonCodes)[number] {
  return (lostReasonCodes as readonly string[]).includes(value);
}

function isInvalidReasonCode(value: string): value is (typeof invalidReasonCodes)[number] {
  return (invalidReasonCodes as readonly string[]).includes(value);
}

async function getWritableCase(leadId: string) {
  const runtime = await getCrmRuntimeStatus();
  if (!runtime.actionsEnabled) return null;

  const { leads } = await getLeadRows("month", 5000);
  const lead = leads.find((item) => item.id === leadId);
  if (!lead) return null;

  return bootstrapCrmLeadCaseFromLead(lead);
}

async function runCrmAction(
  leadId: string,
  success: string,
  handler: (caseRecord: CrmLeadCaseRecord) => Promise<void>
) {
  let redirectKey: "crm_success" | "crm_error" = "crm_success";
  let redirectValue = success;
  let redirectError: unknown;

  try {
    const caseRecord = await getWritableCase(leadId);
    if (!caseRecord) {
      console.warn("crm_action_skipped", {
        leadId,
        reason: "write_actions_not_enabled_or_lead_not_found",
      });
      redirectKey = "crm_error";
      redirectValue = "write_disabled";
    } else {
      await handler(caseRecord);
    }
  } catch (error) {
    console.warn("crm_action_failed", safeError(error));
    redirectKey = "crm_error";
    redirectValue = "action_failed";
    redirectError = error;
  } finally {
    revalidatePath("/crm");
    revalidatePath(`/crm/leads/${leadId}`);
  }

  redirect(crmLeadDetailUrl(leadId, redirectKey, redirectValue, redirectError));
}

export async function assignCsAction(leadId: string, formData: FormData) {
  await runCrmAction(leadId, "assignment_saved", async (caseRecord) => {
    const assignedTo = safeText(formData.get("assigned_to"), 120);
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("crm_lead_cases")
      .update({
        assigned_to: assignedTo || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", caseRecord.id);

    if (error) throw error;

    await insertCrmInteraction({
      caseId: caseRecord.id,
      contactId: caseRecord.contact_id,
      interactionType: "system",
      body: assignedTo
        ? `Assigned CS changed to ${assignedTo}.`
        : "Assigned CS cleared.",
    });
  });
}

export async function updateStatusAction(leadId: string, formData: FormData) {
  await runCrmAction(leadId, "status_updated", async (caseRecord) => {
    const nextStatus = safeText(formData.get("status"), 40) as CrmStatus;
    const note = safeText(formData.get("status_note"), 500);

    if (!allowedStatuses.includes(nextStatus)) return;

    const supabase = createSupabaseAdminClient();
    const previousStatus = caseRecord.status;
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("crm_lead_cases")
      .update({
        status: nextStatus,
        updated_at: now,
      })
      .eq("id", caseRecord.id);

    if (updateError) throw updateError;

    const { error: historyError } = await supabase
      .from("crm_status_history")
      .insert({
        case_id: caseRecord.id,
        previous_status: previousStatus,
        new_status: nextStatus,
        changed_by: "CS",
        note: note || null,
      });

    if (historyError) throw historyError;

    await insertCrmInteraction({
      caseId: caseRecord.id,
      contactId: caseRecord.contact_id,
      interactionType: "status_change",
      body: note || `Status changed from ${previousStatus} to ${nextStatus}.`,
      metadata: {
        previous_status: previousStatus,
        new_status: nextStatus,
      },
    });
  });
}

export async function recordContactAttemptAction(leadId: string, formData: FormData) {
  await runCrmAction(leadId, "contact_attempt_saved", async (caseRecord) => {
    const rawChannel = safeText(formData.get("contact_channel"), 40);
    const rawOutcome = safeText(formData.get("contact_outcome"), 40);
    const note = safeText(formData.get("contact_note"), 2000);
    const nextFollowUpAt = parseDateTimeValue(
      safeText(formData.get("next_follow_up_at"), 80)
    );
    const channel = isContactChannel(rawChannel) ? rawChannel : "whatsapp";
    const outcome = isContactOutcome(rawOutcome) ? rawOutcome : "pending";

    if (!note) {
      throw new Error("Follow-up note is required.");
    }

    const supabase = createSupabaseAdminClient();
    const now = new Date().toISOString();
    const interactionType =
      channel === "phone"
        ? "call"
        : channel === "whatsapp"
          ? "whatsapp_outbound"
          : "note";
    const body = [
      `${contactChannelLabels[channel]} attempt: ${contactOutcomeLabels[outcome]}.`,
      note,
      nextFollowUpAt ? `Next follow-up: ${nextFollowUpAt}` : null,
    ]
      .filter(Boolean)
      .join(" ");

    await createCrmInteraction({
      caseId: caseRecord.id,
      contactId: caseRecord.contact_id,
      interactionType,
      body,
      author: "admin",
      sourceType: "crm",
      direction: "outbound",
      metadata: {
        action: "contact_attempt",
        channel,
        outcome,
        note,
        next_follow_up_at: nextFollowUpAt,
      },
      operation: "contact attempt insert failed",
    });

    if (caseRecord.status === "new" || caseRecord.status === "pending_follow_up") {
      const { error: statusError } = await supabase
        .from("crm_lead_cases")
        .update({
          status: "contacting",
          updated_at: now,
        })
        .eq("id", caseRecord.id);
      if (statusError) throw statusError;

      const { error: historyError } = await supabase
        .from("crm_status_history")
        .insert({
          case_id: caseRecord.id,
          previous_status: caseRecord.status,
          new_status: "contacting",
          changed_by: "CS",
          note: body,
        });
      if (historyError) throw historyError;
    }

    if (nextFollowUpAt) {
      const { error: taskError } = await supabase.from("crm_follow_up_tasks").insert({
        case_id: caseRecord.id,
        contact_id: caseRecord.contact_id,
        assigned_to: caseRecord.assigned_to || null,
        due_at: nextFollowUpAt,
        task_type: "follow_up",
        note,
        status: "open",
      });
      if (taskError) throw taskError;

      const { error: caseUpdateError } = await supabase
        .from("crm_lead_cases")
        .update({
          next_follow_up_at: nextFollowUpAt,
          updated_at: now,
        })
        .eq("id", caseRecord.id);
      if (caseUpdateError) throw caseUpdateError;
    }
  });
}

function crmLeadDetailUrl(
  leadId: string,
  key: "crm_success" | "crm_error",
  value: string,
  error?: unknown
) {
  const params = new URLSearchParams({ [key]: value });

  if (error instanceof CrmOperationError) {
    params.set("crm_operation", error.debug.operation);
    if (error.debug.code) params.set("crm_code", error.debug.code);
    params.set("crm_message", error.debug.message);
    if (error.debug.details) params.set("crm_details", error.debug.details);
    if (error.debug.hint) params.set("crm_hint", error.debug.hint);
  } else if (error instanceof Error) {
    params.set("crm_operation", "crm action");
    params.set("crm_message", error.message.slice(0, 600));
  }

  return `/crm/leads/${encodeURIComponent(leadId)}?${params.toString()}`;
}

export async function confirmBookingAction(leadId: string, formData: FormData) {
  await runCrmAction(leadId, "booking_confirmed", async (caseRecord) => {
    const confirmedDate = safeText(formData.get("confirmed_appointment_date"), 20);
    const confirmedTime = safeText(formData.get("confirmed_appointment_time"), 20);
    const branchLabel = safeText(formData.get("branch_label"), 160);
    const treatmentLabel = safeText(formData.get("treatment_label"), 200);
    const roomArrangement = safeText(formData.get("room_arrangement"), 160);
    const bookingNote = safeText(formData.get("booking_note"), 800);
    const paidStatusRaw = safeText(formData.get("paid_status"), 40) || "unknown";
    const paidStatus = ["paid", "unpaid", "unknown"].includes(paidStatusRaw)
      ? paidStatusRaw
      : "unknown";

    if (!confirmedDate || !confirmedTime) {
      throw new Error("Confirmed appointment date and time are required.");
    }

    const supabase = createSupabaseAdminClient();
    const bundle = await getCrmCaseBundleByCaseRecord(caseRecord);
    const now = new Date().toISOString();
    const previousMetadata = bundle.booking?.metadata_json ?? {};
    const metadata = {
      ...previousMetadata,
      paid_status: paidStatus,
      room_arrangement: roomArrangement || null,
      booking_note: bookingNote || null,
      booking_confirmed_at:
        typeof previousMetadata.booking_confirmed_at === "string"
          ? previousMetadata.booking_confirmed_at
          : now,
    };
    const payload = {
      branch_label: branchLabel || null,
      treatment_label: treatmentLabel || caseRecord.treatment_label || caseRecord.offer_label || null,
      booking_date: confirmedDate,
      booking_time: confirmedTime,
      status: "booked",
      created_by: "CS",
      metadata_json: metadata,
      updated_at: now,
    };
    let bookingId = bundle.booking?.id ?? null;

    if (bundle.booking) {
      const { error } = await supabase
        .from("crm_bookings")
        .update(payload)
        .eq("id", bundle.booking.id);
      if (error) throw error;
    } else {
      const { data, error } = await supabase
        .from("crm_bookings")
        .insert({
          ...payload,
          case_id: caseRecord.id,
          contact_id: caseRecord.contact_id,
          brand_slug: caseRecord.brand_slug,
        })
        .select("id")
        .single();

      if (error || !data) throw error ?? new Error("crm_booking_create_failed");
      bookingId = String(data.id);
    }

    const { error: caseUpdateError } = await supabase
      .from("crm_lead_cases")
      .update({
        booking_id: bookingId,
        status: "booked",
        updated_at: now,
      })
      .eq("id", caseRecord.id);
    if (caseUpdateError) throw caseUpdateError;

    if (caseRecord.status !== "booked") {
      const { error: historyError } = await supabase
        .from("crm_status_history")
        .insert({
          case_id: caseRecord.id,
          previous_status: caseRecord.status,
          new_status: "booked",
          changed_by: "CS",
          note: "CS confirmed booking.",
        });
      if (historyError) throw historyError;
    }

    await insertCrmInteraction({
      caseId: caseRecord.id,
      contactId: caseRecord.contact_id,
      interactionType: "booking",
      body: [
        `CS confirmed booking: ${confirmedDate} ${confirmedTime}`,
        roomArrangement ? `room: ${roomArrangement}` : null,
        `paid: ${paidStatus}`,
        bookingNote ? `note: ${bookingNote}` : null,
      ]
        .filter(Boolean)
        .join(", "),
      metadata: {
        confirmed_appointment_date: confirmedDate,
        confirmed_appointment_time: confirmedTime,
        room_arrangement: roomArrangement || null,
        booking_note: bookingNote || null,
        paid_status: paidStatus,
      },
    });
  });
}

export async function markShowedAction(leadId: string) {
  await markBookedCaseOutcome(leadId, "showed", "showed_saved", "Marked as showed");
}

export async function markNoShowAction(leadId: string) {
  await markBookedCaseOutcome(leadId, "no_show", "no_show_saved", "Marked as no-show");
}

export async function markInvalidAction(leadId: string, formData: FormData) {
  await runCrmAction(leadId, "invalid_saved", async (caseRecord) => {
    const rawReason = safeText(formData.get("invalid_reason_code"), 60);
    const reasonCode = isInvalidReasonCode(rawReason) ? rawReason : null;
    const reasonNote = safeText(formData.get("invalid_reason_note"), 800);

    if (!reasonCode) {
      throw new Error("Invalid reason is required.");
    }

    const supabase = createSupabaseAdminClient();
    const previousStatus = caseRecord.status;
    const now = new Date().toISOString();
    const reasonLabel = invalidReasonLabels[reasonCode];
    const body = `Invalid reason: ${reasonLabel}${reasonNote ? `. ${reasonNote}` : ""}`;

    const { error: updateError } = await supabase
      .from("crm_lead_cases")
      .update({
        status: "invalid",
        metadata_json: {
          ...(caseRecord.metadata_json ?? {}),
          invalid_reason_code: reasonCode,
          invalid_reason_note: reasonNote || null,
          invalid_marked_at: now,
        },
        updated_at: now,
      })
      .eq("id", caseRecord.id);
    if (updateError) throw updateError;

    if (previousStatus !== "invalid") {
      const { error: historyError } = await supabase
        .from("crm_status_history")
        .insert({
          case_id: caseRecord.id,
          previous_status: previousStatus,
          new_status: "invalid",
          changed_by: "CS",
          note: body,
        });
      if (historyError) throw historyError;
    }

    await insertCrmInteraction({
      caseId: caseRecord.id,
      contactId: caseRecord.contact_id,
      interactionType: "status_change",
      body,
      metadata: {
        previous_status: previousStatus,
        new_status: "invalid",
        invalid_reason_code: reasonCode,
        invalid_reason_note: reasonNote || null,
      },
    });
  });
}

async function markBookedCaseOutcome(
  leadId: string,
  nextStatus: "showed" | "no_show",
  success: string,
  body: string
) {
  await runCrmAction(leadId, success, async (caseRecord) => {
    if (caseRecord.status !== "booked") {
      throw new Error("Show / no-show can only be marked after CS confirmed booking.");
    }

    const supabase = createSupabaseAdminClient();
    const bundle = await getCrmCaseBundleByCaseRecord(caseRecord);
    if (!bookingDateTimeHasPassed(bundle.booking?.booking_date, bundle.booking?.booking_time)) {
      throw new Error("Show / no-show can only be marked after the confirmed appointment time.");
    }

    const now = new Date().toISOString();
    if (bundle.booking) {
      const { error: bookingError } = await supabase
        .from("crm_bookings")
        .update({
          status: nextStatus,
          metadata_json: {
            ...(bundle.booking.metadata_json ?? {}),
            outcome_recorded_at: now,
          },
          updated_at: now,
        })
        .eq("id", bundle.booking.id);
      if (bookingError) throw bookingError;
    }

    const { error: caseUpdateError } = await supabase
      .from("crm_lead_cases")
      .update({
        status: nextStatus,
        updated_at: now,
      })
      .eq("id", caseRecord.id);
    if (caseUpdateError) throw caseUpdateError;

    const { error: historyError } = await supabase
      .from("crm_status_history")
      .insert({
        case_id: caseRecord.id,
        previous_status: caseRecord.status,
        new_status: nextStatus,
        changed_by: "CS",
        note: body,
      });
    if (historyError) throw historyError;

    await insertCrmInteraction({
      caseId: caseRecord.id,
      contactId: caseRecord.contact_id,
      interactionType: "status_change",
      body,
      metadata: {
        previous_status: caseRecord.status,
        new_status: nextStatus,
      },
    });
  });
}

export async function createFollowUpTaskAction(leadId: string, formData: FormData) {
  await runCrmAction(leadId, "follow_up_saved", async (caseRecord) => {
    const assignedTo = safeText(formData.get("task_assigned_to"), 120);
    const taskType = safeText(formData.get("task_type"), 80) || "follow_up";
    const note = safeText(formData.get("task_note"), 800);
    const dueAtRaw = safeText(formData.get("due_at"), 80);
    const dueAt = parseDateTimeValue(dueAtRaw);
    const supabase = createSupabaseAdminClient();
    const now = new Date().toISOString();

    const { error } = await supabase.from("crm_follow_up_tasks").insert({
      case_id: caseRecord.id,
      contact_id: caseRecord.contact_id,
      assigned_to: assignedTo || null,
      due_at: dueAt,
      task_type: taskType,
      note: note || null,
      status: "open",
    });

    if (error) throw error;

    const { error: updateError } = await supabase
      .from("crm_lead_cases")
      .update({
        next_follow_up_at: dueAt,
        updated_at: now,
      })
      .eq("id", caseRecord.id);

    if (updateError) throw updateError;

    await insertCrmInteraction({
      caseId: caseRecord.id,
      contactId: caseRecord.contact_id,
      interactionType: "system",
      body: note || `Follow-up task created${dueAt ? ` for ${dueAt}` : ""}.`,
    });
  });
}

export async function saveLostReasonAction(leadId: string, formData: FormData) {
  await runCrmAction(leadId, "lost_reason_saved", async (caseRecord) => {
    const rawReason = safeText(formData.get("lost_reason_code"), 60);
    const reasonCode = isLostReasonCode(rawReason) ? rawReason : null;
    const reasonNote = safeText(formData.get("lost_reason_note"), 800);

    if (!reasonCode) {
      throw new Error("Lost reason is required.");
    }

    const supabase = createSupabaseAdminClient();
    const previousStatus = caseRecord.status;
    const now = new Date().toISOString();
    const reasonLabel = lostReasonLabels[reasonCode];
    const lostReason = `${reasonLabel}${reasonNote ? `: ${reasonNote}` : ""}`;
    const { error: updateError } = await supabase
      .from("crm_lead_cases")
      .update({
        lost_reason: lostReason,
        status: "lost",
        metadata_json: {
          ...(caseRecord.metadata_json ?? {}),
          lost_reason_code: reasonCode,
          lost_reason_note: reasonNote || null,
          lost_marked_at: now,
        },
        updated_at: now,
      })
      .eq("id", caseRecord.id);

    if (updateError) throw updateError;

    if (previousStatus !== "lost") {
      const { error: historyError } = await supabase
        .from("crm_status_history")
        .insert({
          case_id: caseRecord.id,
          previous_status: previousStatus,
          new_status: "lost",
          changed_by: "CS",
          note: lostReason,
        });

      if (historyError) throw historyError;
    }

    await insertCrmInteraction({
      caseId: caseRecord.id,
      contactId: caseRecord.contact_id,
      interactionType: "status_change",
      body: `Lost reason: ${lostReason}`,
      metadata: {
        previous_status: previousStatus,
        new_status: "lost",
        lost_reason_code: reasonCode,
        lost_reason_note: reasonNote || null,
      },
    });
  });
}

function parseDateTimeValue(value: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function bookingDateTimeHasPassed(date: string | null | undefined, time: string | null | undefined) {
  if (!date || !time) return false;
  const normalizedTime = time.length === 5 ? `${time}:00` : time;
  const parsed = new Date(`${date}T${normalizedTime}+08:00`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() <= Date.now();
}
