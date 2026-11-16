import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const captureResponseSchema = z.object({
  ok: z.literal(true), lead_id: z.uuid(), contact_id: z.uuid(), source_snapshot_id: z.uuid(),
  form_id: z.uuid(), delivery_id: z.uuid(),
  delivery_status: z.enum(["pending", "skipped"]), event_id: z.string().min(1).max(120),
  conversion_mode: z.string(), success_redirect_url: z.string().nullable(),
  value: z.number(), source_type: z.string(), tracking_status: z.string(), audit_reason: z.string(),
  attribution_trace_id: z.string(),
}).passthrough();
export type CaptureResponse = z.infer<typeof captureResponseSchema>;

export class PublicCaptureError extends Error {
  constructor(public readonly code: string) { super(code); }
}

export function publicCaptureRequestHash(input: {
  formId: string; customerName: string; phone: string; email: string | null;
  treatmentId: string; packageId: string; branchId: string;
  appointmentDate: string | null; appointmentTime: string | null; paymentOption: string | null;
}) {
  // Only immutable business input participates. Retry timestamps, attribution recovery,
  // current offer price and tracing IDs must not turn a retry into another registration.
  // Selection IDs are the declared request values (empty when omitted), so
  // later changes to server-side defaults do not invalidate an accepted receipt.
  return createHash("sha256").update(JSON.stringify([
    input.formId, input.customerName, input.phone, input.email,
    input.treatmentId, input.packageId, input.branchId,
    input.appointmentDate, input.appointmentTime, input.paymentOption,
  ])).digest("hex");
}

export function normalizedSubmissionId(value: unknown) {
  // Old embedded clients remain valid; serialized same-form duplicate handling
  // still protects them. Stable replay across network failures requires the new key.
  if (value == null || value === "") return randomUUID();
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) throw new PublicCaptureError("capture_invalid_submission_id");
  return parsed.data;
}

export async function persistPublicCapture(input: {
  formId: string; submissionId: string; requestHash: string;
  contact: Record<string, unknown>; snapshot: Record<string, unknown>;
  lead: Record<string, unknown>; events: Array<Record<string, unknown>>;
  delivery: Record<string, unknown>; response: Record<string, unknown>;
}) {
  const { data, error } = await createSupabaseAdminClient().rpc("capture_public_lead_v1", {
    p_form_id: input.formId, p_submission_id: input.submissionId, p_request_hash: input.requestHash,
    p_contact: input.contact, p_snapshot: input.snapshot, p_lead: input.lead,
    p_events: input.events, p_delivery: input.delivery, p_response: input.response,
  });
  if (error) {
    const known = ["capture_idempotency_conflict", "capture_duplicate_recent", "capture_form_changed", "capture_offer_changed", "capture_invalid_request", "capture_package_not_allowed", "capture_branch_not_allowed", "capture_invalid_events"];
    const code = known.find((item) => String(error.message).includes(item));
    if (!code) console.error("public_capture_transaction_failed", { code: error.code ?? "unknown" });
    throw new PublicCaptureError(code ?? "capture_transaction_unavailable");
  }
  const result = z.object({ response: captureResponseSchema, replayed: z.boolean() }).safeParse(data);
  if (!result.success) throw new PublicCaptureError("capture_invalid_receipt");
  return result.data;
}

export async function readPublicCaptureReceipt(input: { formId: string; submissionId: string; requestHash: string }) {
  const { data, error } = await createSupabaseAdminClient().from("public_lead_capture_receipts")
    .select("request_hash,response_json").eq("form_id", input.formId).eq("submission_id", input.submissionId).maybeSingle();
  if (error) throw new PublicCaptureError("capture_transaction_unavailable");
  if (!data) return null;
  if (data.request_hash !== input.requestHash) throw new PublicCaptureError("capture_idempotency_conflict");
  const result = captureResponseSchema.safeParse(data.response_json);
  if (!result.success) throw new PublicCaptureError("capture_invalid_receipt");
  return result.data;
}
