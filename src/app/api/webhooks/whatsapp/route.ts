import { NextRequest, NextResponse } from "next/server";
import {
  classifyAttribution,
  cleanText,
  normalizePhone,
} from "@/lib/attribution/classify";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const phone = cleanText(payload?.phone || payload?.wa_id, 80);
  const normalizedPhone = phone ? normalizePhone(phone) : "";
  const referral = payload?.referral ?? {};
  const submittedTouch = {
    source_capture_method: "whatsapp_webhook",
    ctwa_id: cleanText(payload?.ctwa_id || referral?.ctwa_clid, 300),
    whatsapp_message_id: cleanText(payload?.message_id, 300),
    whatsapp_conversation_id: cleanText(payload?.conversation_id, 300),
    whatsapp_phone_number_id: cleanText(payload?.phone_number_id, 300),
    meta_ad_id: cleanText(referral?.source_id || payload?.meta_ad_id, 300),
    meta_adset_id: cleanText(payload?.meta_adset_id, 300),
    meta_campaign_id: cleanText(payload?.meta_campaign_id, 300),
    meta_source_url: cleanText(referral?.source_url, 2000),
    whatsapp_referral_headline: cleanText(referral?.headline, 500),
    whatsapp_referral_body: cleanText(referral?.body, 1000),
    whatsapp_referral_source_type: cleanText(referral?.source_type, 120),
    whatsapp_referral_source_id: cleanText(referral?.source_id, 300),
  };
  const classification = classifyAttribution(submittedTouch);

  if (!phone || normalizedPhone.length < 8) {
    return NextResponse.json({ ok: false, error: "phone_required" }, { status: 400 });
  }

  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({
      ok: true,
      mode: "local_noop",
      source_type: classification.sourceType,
      tracking_status: classification.trackingStatus,
    });
  }

  const supabase = createSupabaseAdminClient();
  const { data: contact } = await supabase
    .from("contacts")
    .upsert(
      {
        customer_name: cleanText(payload?.profile_name, 120),
        phone,
        normalized_phone: normalizedPhone,
      },
      { onConflict: "normalized_phone" }
    )
    .select("id")
    .single();

  const { data: snapshot } = await supabase
    .from("lead_source_snapshots")
    .insert({
      source_type: classification.sourceType,
      contact_id: contact?.id,
      submitted_touch_json: submittedTouch,
      whatsapp_referral_json: referral,
      raw_payload_json: payload,
      ...submittedTouch,
      attribution_quality: classification.attributionQuality,
      tracking_status: classification.trackingStatus,
      audit_reason: classification.auditReason,
    })
    .select("id")
    .single();

  await supabase.from("lead_events").insert([
    {
      contact_id: contact?.id,
      source_snapshot_id: snapshot?.id,
      event_type: "whatsapp_inbound_received",
      event_payload_json: payload ?? {},
    },
    {
      contact_id: contact?.id,
      source_snapshot_id: snapshot?.id,
      event_type:
        classification.sourceType === "whatsapp_ctwa"
          ? "ctwa_source_detected"
          : "organic_source_assigned",
      event_payload_json: {
        source_type: classification.sourceType,
        audit_reason: classification.auditReason,
      },
    },
  ]);

  return NextResponse.json({
    ok: true,
    contact_id: contact?.id,
    source_snapshot_id: snapshot?.id,
    source_type: classification.sourceType,
    tracking_status: classification.trackingStatus,
  });
}
