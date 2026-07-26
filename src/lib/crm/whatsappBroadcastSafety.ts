import "server-only";

import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";

const DEFAULT_DAILY_CAP = 50;
const MAX_PER_BATCH = 10;
const MIN_FAILURE_SAMPLE = 10;
const FAILURE_PAUSE_RATE = 0.2;
const MIN_OPT_OUT_SAMPLE = 20;
const OPT_OUT_PAUSE_RATE = 0.05;

export function getWhatsAppBroadcastDailyCap() {
  const configured = Number(process.env.WHATSAPP_BROADCAST_DAILY_CAP || DEFAULT_DAILY_CAP);
  if (!Number.isFinite(configured)) return DEFAULT_DAILY_CAP;
  return Math.min(1000, Math.max(1, Math.round(configured)));
}

export async function getQueuedWhatsAppBroadcastIds(limit = 3) {
  if (!hasSupabaseAdminEnv()) return [] as string[];
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("whatsapp_campaigns")
    .select("id")
    .in("status", ["queued", "sending"])
    .order("created_at", { ascending: true })
    .limit(Math.min(10, Math.max(1, limit)));
  return (data || []).map((row) => row.id as string).filter(Boolean);
}

export async function getSafeWhatsAppBroadcastBatchSize(
  campaignId: string,
  requestedBatchSize = MAX_PER_BATCH
) {
  if (!hasSupabaseAdminEnv()) {
    return { ok: false as const, message: "supabase_admin_not_configured", batchSize: 0 };
  }
  const supabase = createSupabaseAdminClient();
  const { data: campaign } = await supabase
    .from("whatsapp_campaigns")
    .select("id,brand_id,connection_id,status")
    .eq("id", campaignId)
    .maybeSingle();
  if (!campaign || !["queued", "sending"].includes(campaign.status)) {
    return { ok: false as const, message: "campaign_not_sendable", batchSize: 0 };
  }

  const { data: connection } = await supabase
    .from("whatsapp_connections")
    .select("id,status,last_error")
    .eq("id", campaign.connection_id)
    .eq("brand_id", campaign.brand_id)
    .maybeSingle();
  if (!connection || connection.status === "error" || connection.last_error) {
    await pauseCampaign(campaignId, "connection_health_blocked");
    return { ok: false as const, message: "connection_health_blocked", batchSize: 0 };
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("whatsapp_campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("brand_id", campaign.brand_id)
    .gte("sent_at", since)
    .in("send_status", ["sent", "delivered", "read"]);

  const dailyCap = getWhatsAppBroadcastDailyCap();
  const sentLast24Hours = count || 0;
  const remaining = Math.max(0, dailyCap - sentLast24Hours);
  const requested = Number.isFinite(Number(requestedBatchSize))
    ? Math.round(Number(requestedBatchSize))
    : MAX_PER_BATCH;
  const batchSize = Math.min(MAX_PER_BATCH, Math.max(1, requested), remaining);

  if (remaining < 1) {
    await pauseCampaign(campaignId, "daily_cap_reached");
    return {
      ok: false as const,
      message: "daily_cap_reached",
      batchSize: 0,
      dailyCap,
      sentLast24Hours,
    };
  }

  return {
    ok: true as const,
    message: "safe_batch_ready",
    batchSize,
    dailyCap,
    sentLast24Hours,
    remaining,
  };
}

export async function evaluateWhatsAppBroadcastHealth(campaignId: string) {
  if (!hasSupabaseAdminEnv()) return { ok: false, paused: false };
  const supabase = createSupabaseAdminClient();
  const { data: rows } = await supabase
    .from("whatsapp_campaign_recipients")
    .select("send_status")
    .eq("campaign_id", campaignId)
    .limit(5000);

  const recipients = rows || [];
  const sent = recipients.filter((row) =>
    ["sent", "delivered", "read"].includes(row.send_status)
  ).length;
  const failed = recipients.filter((row) => row.send_status === "failed").length;
  const optedOut = recipients.filter((row) => row.send_status === "opted_out").length;
  const sendAttempts = sent + failed;
  const failureRate = sendAttempts ? failed / sendAttempts : 0;
  const optOutBase = sent + optedOut;
  const optOutRate = optOutBase ? optedOut / optOutBase : 0;

  let reason = "";
  if (sendAttempts >= MIN_FAILURE_SAMPLE && failureRate >= FAILURE_PAUSE_RATE) {
    reason = `automatic_pause_failure_rate_${failureRate.toFixed(3)}`;
  } else if (optOutBase >= MIN_OPT_OUT_SAMPLE && optOutRate >= OPT_OUT_PAUSE_RATE) {
    reason = `automatic_pause_opt_out_rate_${optOutRate.toFixed(3)}`;
  }

  if (reason) await pauseCampaign(campaignId, reason);
  return {
    ok: true,
    paused: Boolean(reason),
    reason: reason || null,
    sent,
    failed,
    optedOut,
    failureRate,
    optOutRate,
  };
}

async function pauseCampaign(campaignId: string, reason: string) {
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  await supabase
    .from("whatsapp_campaigns")
    .update({
      status: "paused",
      paused_at: now,
      last_error: reason,
      updated_at: now,
    })
    .eq("id", campaignId)
    .in("status", ["approved", "queued", "sending"]);
  await supabase.from("whatsapp_campaign_events").insert({
    campaign_id: campaignId,
    event_type: "automatic_safety_pause",
    actor: "broadcast_safety_guard",
    metadata: { reason },
  });
}
