"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireModuleAccess } from "@/lib/security/internalAccessServer";
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import { processPublicLeadDeliveries } from "@/lib/capture/leadDelivery";

export type LeadDeliveryRecoveryAccess =
  | { allowed: true }
  | { allowed: false; reason: "permission_required" | "member_required" | "access_unavailable" };

async function getRecoveryActor(): Promise<
  | { allowed: true; actorId: string }
  | Exclude<LeadDeliveryRecoveryAccess, { allowed: true }>
> {
  try {
    const { access, allowed } = await requireModuleAccess("system_audit");
    if (!allowed || access.accessLevel !== "master") return { allowed: false, reason: "permission_required" };
    const actor = z.uuid().safeParse(access.memberId);
    if (access.source !== "supabase_auth" || !actor.success) return { allowed: false, reason: "member_required" };
    return { allowed: true, actorId: actor.data };
  } catch {
    return { allowed: false, reason: "access_unavailable" };
  }
}

export async function getLeadDeliveryRecoveryAccess(): Promise<LeadDeliveryRecoveryAccess> {
  const actor = await getRecoveryActor();
  return actor.allowed ? { allowed: true } : actor;
}

function redirectFeedback(status: "scheduled" | "failed" | "forbidden" | "member_required" | "unavailable", count?: number): never {
  const query = new URLSearchParams({ delivery_recheck: status });
  if (status === "scheduled" && Number.isInteger(count) && count! >= 0 && count! <= 10) query.set("delivery_count", String(count));
  redirect(`/system-audit?${query.toString()}`);
}

export async function recheckLeadDeliveriesAction(): Promise<void> {
  const actor = await getRecoveryActor();
  if (!actor.allowed) {
    redirectFeedback(actor.reason === "member_required" ? "member_required" : actor.reason === "access_unavailable" ? "unavailable" : "forbidden");
  }
  if (!hasSupabaseAdminEnv()) redirectFeedback("unavailable");

  let count: number;
  try {
    const result = await createSupabaseAdminClient().rpc("recheck_public_lead_deliveries", {
      p_actor_id: actor.actorId,
      p_limit: 10,
    });
    if (result.error || !Number.isInteger(result.data) || result.data < 0 || result.data > 10) {
      throw new Error("delivery_recheck_unavailable");
    }
    count = result.data;
  } catch {
    // The fixed failure code never echoes provider messages or job identifiers.
    redirectFeedback("failed");
  }

  revalidatePath("/system-audit");
  if (count > 0) {
    try {
      after(async () => {
        try { await processPublicLeadDeliveries({ limit: 3 }); }
        catch { console.warn("lead_delivery_recheck_worker_unavailable"); }
      });
    } catch {
      // Rechecks are already durably scheduled; the protected cron can resume them.
      console.warn("lead_delivery_recheck_deferred_to_cron");
    }
  }
  redirectFeedback("scheduled", count);
}
