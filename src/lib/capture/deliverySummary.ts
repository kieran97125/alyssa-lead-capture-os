import "server-only";
import { z } from "zod";
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";

export const leadDeliveryStatuses = ["pending", "retry", "processing", "delivered", "blocked", "uncertain", "skipped"] as const;
export type LeadDeliveryStatus = typeof leadDeliveryStatuses[number];
export type LeadDeliveryCounts = Record<LeadDeliveryStatus, number>;
export type LeadDeliverySummary =
  | { available: true; counts: LeadDeliveryCounts; total: number; checkedAt: string }
  | { available: false; reason: "not_configured" | "read_failed" };

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const summarySchema = z.object({
  counts: z.object({
    pending: count, retry: count, processing: count, delivered: count,
    blocked: count, uncertain: count, skipped: count,
  }).strict(),
  checked_at: z.iso.datetime(),
}).strict();

/** Master audit only: all counts and their timestamp share one SQL snapshot. */
export async function getLeadDeliverySummary(): Promise<LeadDeliverySummary> {
  if (!hasSupabaseAdminEnv()) return { available: false, reason: "not_configured" };
  try {
    const result = await createSupabaseAdminClient().rpc("get_public_lead_delivery_summary");
    if (result.error) return { available: false, reason: "read_failed" };
    const parsed = summarySchema.safeParse(result.data);
    if (!parsed.success) return { available: false, reason: "read_failed" };
    const counts = parsed.data.counts;
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    if (!Number.isSafeInteger(total)) return { available: false, reason: "read_failed" };
    return {
      available: true,
      counts,
      total,
      checkedAt: parsed.data.checked_at,
    };
  } catch {
    // Do not expose provider messages, row contents, identifiers or destinations.
    return { available: false, reason: "read_failed" };
  }
}
