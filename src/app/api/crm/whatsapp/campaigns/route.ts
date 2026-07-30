import { NextRequest, NextResponse } from "next/server";
import {
  canAccessInternalBrand,
  requireModuleAccess,
  verifyCurrentInternalAccess,
} from "@/lib/security/internalAccessServer";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";
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
  const session = await verifyCurrentInternalAccess();
  if (!session.ok) {
    return NextResponse.json({ ok: false, message: "unauthorized" }, { status: 401 });
  }
  const moduleAccess = await requireModuleAccess("crm");
  if (!moduleAccess.allowed) {
    return NextResponse.json({ ok: false, message: "forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ ok: false, message: "invalid_json" }, { status: 400 });
  }

  const action = text(body.action, 80);
  const campaignId = text(body.campaign_id, 120);
  if (
    session.access.source === "supabase_auth" &&
    session.access.accessLevel !== "master"
  ) {
    const brandId = await resolveCampaignBrandId(body, campaignId);
    if (!brandId || !canAccessInternalBrand(session.access, brandId)) {
      return NextResponse.json(
        { ok: false, message: "brand_forbidden" },
        { status: 403 }
      );
    }
  }
  const actor = session.access.email || "admin_session";
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

async function resolveCampaignBrandId(
  body: Record<string, unknown>,
  campaignId: string
) {
  if (!hasSupabaseAdminEnv()) return "";
  const supabase = createSupabaseAdminClient();
  if (campaignId) {
    const { data } = await supabase
      .from("whatsapp_campaigns")
      .select("brand_id")
      .eq("id", campaignId)
      .maybeSingle();
    return typeof data?.brand_id === "string" ? data.brand_id : "";
  }

  const brandSlug = text(body.brand_slug, 120) || "ineffable";
  const { data } = await supabase
    .from("brands")
    .select("id")
    .eq("slug", brandSlug)
    .maybeSingle();
  return typeof data?.id === "string" ? data.id : "";
}

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function numberValue(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
