import "server-only";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { deliverCapturedLeadToNativeSheet } from "@/lib/integrations/googleSheetsLeadNative";
import { GOOGLE_SHEETS_LEAD_HEADERS, GOOGLE_SHEETS_LEAD_SCHEMA_VERSION, type GoogleSheetsLeadWebhookPayload } from "@/lib/integrations/googleSheetsLeadSync";
import type { PublicLeadDeliveryOutcome } from "@/lib/capture/deliveryPolicy";

const targetSchema = z.object({
  sourceId: z.uuid(), spreadsheetId: z.string().regex(/^[A-Za-z0-9_-]{20,}$/),
  tabName: z.string().min(1).max(100), headerRow: z.number().int().min(1).max(100),
  sheetBrand: z.string().min(1).max(200), account: z.string().min(1).max(200),
});
const jobSchema = z.object({
  id: z.uuid(), lead_id: z.uuid(), brand_id: z.uuid(), lease_token: z.uuid(),
  attempt_count: z.number().int().min(1), append_started_at: z.string().nullable(),
  destination_json: z.unknown(), payload_json: z.unknown(),
});
const payloadSchema = z.object({
  secret: z.literal(""), schemaVersion: z.literal(GOOGLE_SHEETS_LEAD_SCHEMA_VERSION),
  leadKey: z.uuid(), brand: z.string().min(1), phone: z.string().min(8).max(80),
  headers: z.array(z.string()).length(GOOGLE_SHEETS_LEAD_HEADERS.length),
  rowValues: z.array(z.string().max(4000)).length(GOOGLE_SHEETS_LEAD_HEADERS.length),
}).passthrough().refine((payload) => payload.headers.every((header, index) => header === GOOGLE_SHEETS_LEAD_HEADERS[index]));

export async function processPublicLeadDeliveries(input: { deliveryId?: string; limit?: number } = {}) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("claim_public_lead_deliveries", {
    p_delivery_id: input.deliveryId ?? null, p_limit: Math.max(1, Math.min(input.limit ?? 3, 3)),
  });
  if (error || !Array.isArray(data)) {
    console.error("public_lead_delivery_claim_failed", { code: error?.code ?? "invalid_claim" });
    return { ok: false, claimed: 0, delivered: 0, retry: 0, blocked: 0, uncertain: 0, failed: 1 };
  }
  const outcomes = await Promise.all(data.map(async (raw: unknown) => {
    const parsed = jobSchema.safeParse(raw);
    if (!parsed.success) return "failed" as const;
    const job = parsed.data;
    async function journal(patch: Record<string, unknown>) {
      const { data: rows, error: writeError } = await supabase.from("public_lead_delivery_outbox")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", job.id).eq("lease_token", job.lease_token).eq("status", "processing")
        .gt("lease_expires_at", new Date().toISOString()).select("id");
      if (writeError) throw new Error("delivery_journal_unavailable");
      return Array.isArray(rows) && rows.length === 1;
    }
    let outcome: PublicLeadDeliveryOutcome;
    const parsedPayload = payloadSchema.safeParse(job.payload_json);
    const target = job.destination_json == null ? null : targetSchema.safeParse(job.destination_json);
    if (!parsedPayload.success || parsedPayload.data.leadKey !== job.lead_id || (target && !target.success)) {
      outcome = { status: "blocked", code: "delivery_payload_invalid" };
    } else if (process.env.GOOGLE_SHEETS_SYNC_ENABLED?.trim().toLowerCase() !== "true") {
      outcome = { status: "blocked", code: "sync_disabled", safeToRetry: true };
    } else {
      outcome = await deliverCapturedLeadToNativeSheet({
        brandId: job.brand_id, payload: parsedPayload.data as unknown as GoogleSheetsLeadWebhookPayload,
        pinnedTarget: target?.success ? target.data : null,
        reconcileOnly: job.append_started_at !== null,
        beforeAppend: async (destination) => journal({
          destination_json: destination, append_started_at: new Date().toISOString(),
        }),
      });
    }
    const now = Date.now();
    const status = outcome.status === "retry" && job.attempt_count >= 8 ? "blocked" : outcome.status;
    try {
      const updated = await journal({
        status, last_error_code: status === "delivered" ? null : outcome.code,
        result_json: { code: outcome.code, transport: "native_oauth", updated_range: outcome.updatedRange ?? null },
        ...(outcome.target ? { destination_json: outcome.target } : {}),
        ...(outcome.safeToRetry && !job.append_started_at ? { append_started_at: null } : {}),
        delivered_at: status === "delivered" ? new Date(now).toISOString() : null,
        next_attempt_at: new Date(now + (status === "uncertain" ? 300_000 : Math.min(3_600_000, 30_000 * 2 ** job.attempt_count))).toISOString(),
        lease_token: null, lease_expires_at: null,
      });
      return updated ? status : "failed" as const;
    } catch {
      // A lost final journal response never authorizes another append. The expired
      // processing lease is claimed as reconciliation-only by the database.
      console.error("public_lead_delivery_journal_failed", { delivery_id: job.id });
      return "failed" as const;
    }
  }));
  const count = (state: string) => outcomes.filter((outcome) => outcome === state).length;
  return { ok: count("failed") === 0, claimed: data.length, delivered: count("delivered"), retry: count("retry"), blocked: count("blocked"), uncertain: count("uncertain"), failed: count("failed") };
}
