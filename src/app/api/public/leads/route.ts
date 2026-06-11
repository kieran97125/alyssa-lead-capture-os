import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  classifyAttribution,
  cleanText,
  normalizePhone,
} from "@/lib/attribution/classify";
import { TouchPayload } from "@/lib/attribution/types";
import { alyssaDefaultForm } from "@/lib/data/alyssaConfig";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";

type LeadSubmitPayload = {
  form_token?: string;
  form_id?: string;
  brand_id?: string;
  treatment_id?: string;
  package_id?: string;
  branch_id?: string;
  customer_name?: string;
  phone?: string;
  email?: string;
  appointment_date?: string;
  appointment_time?: string;
  payment_option?: "pay_now" | "booking_only";
  first_touch_json?: TouchPayload;
  latest_touch_json?: TouchPayload;
  submitted_touch_json?: TouchPayload;
  honeypot?: string;
};

function getStorageRecoverySource(touch: TouchPayload) {
  if (touch.source_capture_method === "parent_embed_script_local_storage_recovered") {
    return "local";
  }

  if (touch.source_capture_method === "parent_embed_script_session_storage_recovered") {
    return "session";
  }

  return null;
}

function classifySubmittedTouch(touch: TouchPayload) {
  return classifyAttribution(touch, {
    parentPayloadMissing: Object.keys(touch).length === 0,
    recoveredFromStorage: getStorageRecoverySource(touch),
  });
}

function getHostnameFromUrl(value: string | null) {
  if (!value) return null;

  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isAllowedDomain(allowedDomains: string[], currentPageUrl: string | null) {
  if (allowedDomains.length === 0) return true;

  const hostname = getHostnameFromUrl(currentPageUrl);
  if (!hostname) return false;

  return allowedDomains.some((domain) => {
    const cleaned = String(domain).trim().toLowerCase();
    return hostname === cleaned || hostname.endsWith(`.${cleaned}`);
  });
}

async function createLocalResponse(payload: LeadSubmitPayload) {
  const submittedTouch = payload.submitted_touch_json ?? {};
  const classification = classifySubmittedTouch(submittedTouch);

  return NextResponse.json(
    {
      ok: true,
      mode: "local_noop",
      lead_id: randomUUID(),
      contact_id: randomUUID(),
      source_snapshot_id: randomUUID(),
      source_type: classification.sourceType,
      tracking_status: classification.trackingStatus,
      audit_reason: classification.auditReason,
    },
    { status: 201 }
  );
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as
    | LeadSubmitPayload
    | null;

  if (!payload) {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (cleanText(payload.honeypot)) {
    return NextResponse.json({ ok: false, error: "spam_rejected" }, { status: 400 });
  }

  const formToken = cleanText(payload.form_token, 300);
  const customerName = cleanText(payload.customer_name, 120);
  const phone = cleanText(payload.phone, 80);
  const normalizedPhone = phone ? normalizePhone(phone) : "";

  if (!formToken || !phone || normalizedPhone.length < 8) {
    return NextResponse.json(
      {
        ok: false,
        error: "required_fields_missing",
        message: "請輸入有效 WhatsApp 電話號碼。",
      },
      { status: 400 }
    );
  }

  const submittedTouch = payload.submitted_touch_json ?? {};
  const classification = classifySubmittedTouch(submittedTouch);

  if (!hasSupabaseAdminEnv()) {
    if (formToken !== alyssaDefaultForm.publicFormToken) {
      return NextResponse.json({ ok: false, error: "invalid_form" }, { status: 403 });
    }

    return createLocalResponse(payload);
  }

  const supabase = createSupabaseAdminClient();
  const { data: form, error: formError } = await supabase
    .from("forms")
    .select("*")
    .eq("public_form_token", formToken)
    .eq("status", "active")
    .single();

  if (formError || !form) {
    return NextResponse.json({ ok: false, error: "invalid_form" }, { status: 403 });
  }

  const currentPageUrl = cleanText(submittedTouch.current_page_url, 2000);
  const allowedDomains = (form.allowed_domains ?? []) as string[];

  if (!isAllowedDomain(allowedDomains, currentPageUrl)) {
    return NextResponse.json({ ok: false, error: "domain_not_allowed" }, { status: 403 });
  }

  const treatmentId = cleanText(payload.treatment_id, 80) || form.default_treatment_id;
  const branchId = cleanText(payload.branch_id, 80) || form.default_branch_id;
  const packageId = cleanText(payload.package_id, 80) || form.default_package_id;

  const [{ data: packageRecord }, { data: treatmentRecord }, { data: branchRecord }] =
    await Promise.all([
      supabase
        .from("packages")
        .select("*")
        .eq("id", packageId)
        .eq("status", "active")
        .single(),
      supabase
        .from("treatments")
        .select("id, brand_id")
        .eq("id", treatmentId)
        .eq("brand_id", form.brand_id)
        .eq("status", "active")
        .single(),
      supabase
        .from("branches")
        .select("id, brand_id")
        .eq("id", branchId)
        .eq("brand_id", form.brand_id)
        .eq("status", "active")
        .single(),
    ]);

  if (!packageRecord) {
    return NextResponse.json({ ok: false, error: "invalid_package" }, { status: 400 });
  }

  if (!treatmentRecord) {
    return NextResponse.json({ ok: false, error: "invalid_treatment" }, { status: 400 });
  }

  if (!branchRecord) {
    return NextResponse.json({ ok: false, error: "invalid_branch" }, { status: 400 });
  }

  if (packageRecord.treatment_id !== treatmentId) {
    return NextResponse.json(
      { ok: false, error: "package_treatment_mismatch" },
      { status: 400 }
    );
  }

  const paymentStatus = packageRecord.payment_required
    ? "pending"
    : payload.payment_option === "booking_only"
      ? "booking_only"
      : "unpaid";

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .upsert(
      {
        customer_name: customerName,
        phone,
        normalized_phone: normalizedPhone,
        email: cleanText(payload.email, 200),
      },
      { onConflict: "normalized_phone" }
    )
    .select("id")
    .single();

  if (contactError || !contact) {
    return NextResponse.json(
      { ok: false, error: "contact_upsert_failed" },
      { status: 500 }
    );
  }

  const { data: recentDuplicate } = await supabase
    .from("leads")
    .select("id, payment_status, booking_status")
    .eq("normalized_phone", normalizedPhone)
    .eq("brand_id", form.brand_id)
    .eq("treatment_id", treatmentId)
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const isDuplicate =
    Boolean(recentDuplicate) &&
    recentDuplicate?.payment_status !== "paid" &&
    recentDuplicate?.booking_status !== "confirmed";

  const { data: snapshot, error: snapshotError } = await supabase
    .from("lead_source_snapshots")
    .insert({
      source_type: classification.sourceType,
      visitor_id: cleanText(submittedTouch.visitor_id, 120),
      session_id: cleanText(submittedTouch.session_id, 120),
      contact_id: contact.id,
      first_touch_json: payload.first_touch_json ?? {},
      latest_touch_json: payload.latest_touch_json ?? {},
      submitted_touch_json: submittedTouch,
      raw_payload_json: payload,
      utm_source: cleanText(submittedTouch.utm_source, 300),
      utm_medium: cleanText(submittedTouch.utm_medium, 300),
      utm_campaign: cleanText(submittedTouch.utm_campaign, 500),
      utm_id: cleanText(submittedTouch.utm_id, 300),
      utm_content: cleanText(submittedTouch.utm_content, 500),
      utm_term: cleanText(submittedTouch.utm_term, 500),
      fbclid: cleanText(submittedTouch.fbclid, 1000),
      gclid: cleanText(submittedTouch.gclid, 1000),
      ttclid: cleanText(submittedTouch.ttclid, 1000),
      msclkid: cleanText(submittedTouch.msclkid, 1000),
      wbraid: cleanText(submittedTouch.wbraid, 1000),
      gbraid: cleanText(submittedTouch.gbraid, 1000),
      referrer: cleanText(submittedTouch.referrer, 2000),
      landing_page_url: cleanText(submittedTouch.landing_page_url, 2000),
      current_page_url: currentPageUrl,
      page_path: cleanText(submittedTouch.page_path, 500),
      page_title: cleanText(submittedTouch.page_title, 500),
      source_capture_method: cleanText(submittedTouch.source_capture_method, 120),
      attribution_quality: classification.attributionQuality,
      tracking_status: classification.trackingStatus,
      audit_reason: classification.auditReason,
      ctwa_id: cleanText(submittedTouch.ctwa_id, 300),
      whatsapp_message_id: cleanText(submittedTouch.whatsapp_message_id, 300),
      whatsapp_conversation_id: cleanText(
        submittedTouch.whatsapp_conversation_id,
        300
      ),
      whatsapp_phone_number_id: cleanText(
        submittedTouch.whatsapp_phone_number_id,
        300
      ),
      meta_ad_id: cleanText(submittedTouch.meta_ad_id, 300),
      meta_adset_id: cleanText(submittedTouch.meta_adset_id, 300),
      meta_campaign_id: cleanText(submittedTouch.meta_campaign_id, 300),
      meta_source_url: cleanText(submittedTouch.meta_source_url, 2000),
      whatsapp_referral_headline: cleanText(
        submittedTouch.whatsapp_referral_headline,
        500
      ),
      whatsapp_referral_body: cleanText(submittedTouch.whatsapp_referral_body, 1000),
      whatsapp_referral_source_type: cleanText(
        submittedTouch.whatsapp_referral_source_type,
        120
      ),
      whatsapp_referral_source_id: cleanText(
        submittedTouch.whatsapp_referral_source_id,
        300
      ),
      first_seen_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (snapshotError || !snapshot) {
    return NextResponse.json(
      { ok: false, error: "snapshot_create_failed" },
      { status: 500 }
    );
  }

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .insert({
      contact_id: contact.id,
      lead_uid: randomUUID(),
      source_snapshot_id: snapshot.id,
      source_type: classification.sourceType,
      form_id: form.id,
      brand_id: form.brand_id,
      treatment_id: treatmentId,
      package_id: packageRecord.id,
      branch_id: branchId,
      customer_name: customerName,
      phone,
      normalized_phone: normalizedPhone,
      appointment_date: cleanText(payload.appointment_date, 20),
      appointment_time: cleanText(payload.appointment_time, 20),
      price: packageRecord.promo_price,
      currency: packageRecord.currency || "HKD",
      payment_status: paymentStatus,
      lead_status: isDuplicate ? "duplicate" : "submitted",
      booking_status: "requested",
      submitted_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (leadError || !lead) {
    return NextResponse.json({ ok: false, error: "lead_create_failed" }, { status: 500 });
  }

  await supabase
    .from("lead_source_snapshots")
    .update({ lead_id: lead.id })
    .eq("id", snapshot.id);

  await supabase.from("bookings").insert({
    lead_id: lead.id,
    contact_id: contact.id,
    brand_id: form.brand_id,
    treatment_id: treatmentId,
    branch_id: branchId,
    appointment_date: cleanText(payload.appointment_date, 20),
    appointment_time: cleanText(payload.appointment_time, 20),
    booking_status: "requested",
    created_by_source: classification.sourceType,
  });

  await supabase.from("lead_events").insert([
    {
      lead_id: lead.id,
      contact_id: contact.id,
      source_snapshot_id: snapshot.id,
      visitor_id: cleanText(submittedTouch.visitor_id, 120),
      session_id: cleanText(submittedTouch.session_id, 120),
      event_type: "form_submit_success",
      event_payload_json: {
        source_type: classification.sourceType,
        is_duplicate: isDuplicate,
      },
      page_url: currentPageUrl,
      referrer: cleanText(submittedTouch.referrer, 2000),
    },
    {
      lead_id: lead.id,
      contact_id: contact.id,
      source_snapshot_id: snapshot.id,
      visitor_id: cleanText(submittedTouch.visitor_id, 120),
      session_id: cleanText(submittedTouch.session_id, 120),
      event_type: "booking_created",
      event_payload_json: {
        booking_status: "requested",
        created_by_source: classification.sourceType,
      },
      page_url: currentPageUrl,
      referrer: cleanText(submittedTouch.referrer, 2000),
    },
    ...(classification.sourceType === "organic_unknown"
      ? [
          {
            lead_id: lead.id,
            contact_id: contact.id,
            source_snapshot_id: snapshot.id,
            visitor_id: cleanText(submittedTouch.visitor_id, 120),
            session_id: cleanText(submittedTouch.session_id, 120),
            event_type: "organic_source_assigned",
            event_payload_json: { audit_reason: classification.auditReason },
            page_url: currentPageUrl,
            referrer: cleanText(submittedTouch.referrer, 2000),
          },
        ]
      : []),
    ...(isDuplicate
      ? [
          {
            lead_id: lead.id,
            contact_id: contact.id,
            source_snapshot_id: snapshot.id,
            event_type: "duplicate_detected",
            event_payload_json: { duplicate_of_lead_id: recentDuplicate?.id },
          },
        ]
      : []),
  ]);

  return NextResponse.json(
    {
      ok: true,
      lead_id: lead.id,
      contact_id: contact.id,
      source_snapshot_id: snapshot.id,
      source_type: classification.sourceType,
      tracking_status: classification.trackingStatus,
      audit_reason: classification.auditReason,
    },
    { status: 201 }
  );
}
