import { NextRequest, NextResponse } from "next/server";
import { processWhatsAppCampaignBatch } from "@/lib/crm/whatsappCampaigns";
import {
  evaluateWhatsAppBroadcastHealth,
  getQueuedWhatsAppBroadcastIds,
  getSafeWhatsAppBroadcastBatchSize,
} from "@/lib/crm/whatsappBroadcastSafety";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}

async function run(request: NextRequest) {
  const configuredSecret = process.env.CRON_SECRET?.trim() || "";
  const authorization = request.headers.get("authorization") || "";
  const suppliedSecret = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : request.headers.get("x-cron-secret")?.trim() || "";

  if (!configuredSecret || suppliedSecret !== configuredSecret) {
    return NextResponse.json({ ok: false, message: "unauthorized" }, { status: 401 });
  }

  const campaignIds = await getQueuedWhatsAppBroadcastIds(3);
  const processed: Array<Record<string, unknown>> = [];

  for (const campaignId of campaignIds) {
    const safety = await getSafeWhatsAppBroadcastBatchSize(campaignId, 10);
    if (!safety.ok || safety.batchSize < 1) {
      processed.push({ campaignId, ...safety });
      continue;
    }

    const result = await processWhatsAppCampaignBatch(
      campaignId,
      "broadcast_worker",
      safety.batchSize
    );
    const health = await evaluateWhatsAppBroadcastHealth(campaignId);
    processed.push({ campaignId, ...result, safety, health });
  }

  return NextResponse.json({
    ok: true,
    message: "broadcast_worker_completed",
    processed,
  });
}
