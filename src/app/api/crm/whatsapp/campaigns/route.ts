import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  adminSessionCookieName,
  verifySignedAdminSession,
} from "@/lib/security/internalAccess";
import {
  approveWhatsAppCampaign,
  cancelWhatsAppCampaign,
  createWhatsAppCampaign,
  pauseWhatsAppCampaign,
  processWhatsAppCampaignBatch,
  queueWhatsAppCampaign,
  recordWhatsAppMarketingConsent,
  runWhatsAppCampaignDryRun,
} from "@/lib/crm/whatsappCampaigns";
import {
  evaluateWhatsAppBroadcastHealth,
  getSafeWhatsAppBroadcastBatchSize,
} from "@/lib/crm/whatsappBroadcastSafety";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const session = await verifySignedAdminSession(
    cookieStore.get(adminSessionCookieName)?.value
  );
  if (!session.ok) {
    return NextResponse.json({ ok: false, message: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ ok: false, message: "invalid_json" }, { status: 400 });
  }

  const action = text(body.action, 80);
  const campaignId = text(body.campaign_id, 120);
  const actor = "admin_session";
  let result: Record<string, unknown>;

  switch (action) {
    case "create_campaign":
      result = await createWhatsAppCampaign({
        brandSlug: text(body.brand_slug, 120) || "ineffable",
        name: text(body.name, 200),
        templateId: text(body.template_id, 120),
        frequencyCapDays: numberValue(body.frequency_cap_days, 30),
        actor,
      });
      break;
    case "record_consent":
      result = await recordWhatsAppMarketingConsent({
        brandSlug: text(body.brand_slug, 120) || "ineffable",
        phone: text(body.phone, 80),
        source: text(body.consent_source, 160),
        evidenceNote: text(body.evidence_note, 1000),
        actor,
      });
      break;
    case "dry_run":
      result = campaignId
        ? await runWhatsAppCampaignDryRun(campaignId, actor)
        : { ok: false, message: "campaign_id_required" };
      break;
    case "approve":
      result = campaignId
        ? await approveWhatsAppCampaign(campaignId, actor)
        : { ok: false, message: "campaign_id_required" };
      break;
    case "queue":
      result = campaignId
        ? await queueWhatsAppCampaign(campaignId, actor)
        : { ok: false, message: "campaign_id_required" };
      break;
    case "process_batch": {
      if (!campaignId) {
        result = { ok: false, message: "campaign_id_required" };
        break;
      }
      const safety = await getSafeWhatsAppBroadcastBatchSize(
        campaignId,
        numberValue(body.batch_size, 10)
      );
      if (!safety.ok || safety.batchSize < 1) {
        result = safety;
        break;
      }
      result = await processWhatsAppCampaignBatch(
        campaignId,
        actor,
        safety.batchSize
      );
      const health = await evaluateWhatsAppBroadcastHealth(campaignId);
      result = { ...result, safety, health };
      break;
    }
    case "pause":
      result = campaignId
        ? await pauseWhatsAppCampaign(
            campaignId,
            actor,
            text(body.reason, 500) || "manual_pause"
          )
        : { ok: false, message: "campaign_id_required" };
      break;
    case "cancel":
      result = campaignId
        ? await cancelWhatsAppCampaign(campaignId, actor)
        : { ok: false, message: "campaign_id_required" };
      break;
    default:
      result = { ok: false, message: "unsupported_action" };
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function numberValue(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
