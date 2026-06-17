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
  getLegalLinks,
  LEGAL_CONSENT_REQUIRED_MESSAGE,
  LEGAL_CONSENT_TEXT,
} from "@/lib/legal/consent";
import { appendLeadToGoogleSheet } from "@/lib/integrations/googleSheetsLeadSync";
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
  legalConsentAccepted?: boolean | string;
};

const DUPLICATE_WINDOW_MS = 3 * 60 * 1000;
const IP_RATE_WINDOW_MS = 3 * 60 * 1000;
const IP_RATE_LIMIT = 8;
const publicSubmitAttempts = new Map<string, number[]>();

const publicMessages = {
  validation: "未能提交表格，請檢查資料後再試。",
  duplicate: "登記已收到，請稍後再試或等候團隊聯絡。",
  unavailable: "表格暫時未能使用，請稍後再試。",
  spam: "未能提交表格，請稍後再試。",
};

function hasAcceptedLegalConsent(value: LeadSubmitPayload["legalConsentAccepted"]) {
  return value === true;
}

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

function normalizeOrigin(value: string | null | undefined) {
  if (!value) return null;
  const cleaned = String(value).trim();

  if (!cleaned) return null;

  try {
    return new URL(cleaned).origin.toLowerCase();
  } catch {
    try {
      return new URL(`https://${cleaned}`).origin.toLowerCase();
    } catch {
      return null;
    }
  }
}

function uniqueOrigins(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map(normalizeOrigin).filter((value): value is string => Boolean(value)))
  );
}

function isAllowedOrigin(
  allowedOrigins: string[],
  candidateOrigin: string,
  rawAllowedDomains: string[]
) {
  if (allowedOrigins.includes(candidateOrigin)) return true;

  try {
    const candidateUrl = new URL(candidateOrigin);
    return rawAllowedDomains.some((domain) => {
      const cleaned = String(domain).trim().toLowerCase();
      return (
        (cleaned === "localhost" || cleaned === "127.0.0.1") &&
        candidateUrl.hostname === cleaned
      );
    });
  } catch {
    return false;
  }
}

function getOriginValidation(
  allowedDomains: string[],
  candidateValues: Array<string | null | undefined>
) {
  const allowedOrigins = uniqueOrigins(allowedDomains);
  const receivedOrigins = uniqueOrigins(candidateValues);

  if (allowedDomains.length === 0) {
    return { allowed: true, allowedOrigins, receivedOrigins };
  }

  const allowed = receivedOrigins.some((origin) =>
    isAllowedOrigin(allowedOrigins, origin, allowedDomains)
  );

  return { allowed, allowedOrigins, receivedOrigins };
}

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const forwardedIp = forwardedFor?.split(",")[0]?.trim();

  return (
    forwardedIp ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-vercel-forwarded-for") ||
    request.headers.get("cf-connecting-ip") ||
    null
  );
}

function isIpRateLimited(ip: string | null) {
  if (!ip) return false;

  const now = Date.now();
  const recentAttempts = (publicSubmitAttempts.get(ip) ?? []).filter(
    (timestamp) => now - timestamp < IP_RATE_WINDOW_MS
  );

  if (recentAttempts.length >= IP_RATE_LIMIT) {
    publicSubmitAttempts.set(ip, recentAttempts);
    return true;
  }

  recentAttempts.push(now);
  publicSubmitAttempts.set(ip, recentAttempts);
  return false;
}

function shortUserAgent(request: NextRequest) {
  return (request.headers.get("user-agent") ?? "").slice(0, 160);
}

function logPublicSubmitFailure(
  request: NextRequest,
  input: {
    reason: string;
    formToken?: string | null;
    normalizedPhone?: string | null;
  }
) {
  console.warn("[LaunchHub] public_lead_submit_rejected", {
    reason: input.reason,
    form_token: input.formToken || null,
    normalized_phone: input.normalizedPhone || null,
    request_origin: normalizeOrigin(request.headers.get("origin")),
    referer_origin: normalizeOrigin(request.headers.get("referer")),
    user_agent: shortUserAgent(request),
    timestamp: new Date().toISOString(),
  });
}

function rejectPublicSubmit(
  request: NextRequest,
  status: number,
  error: string,
  message: string,
  input: {
    formToken?: string | null;
    normalizedPhone?: string | null;
  } = {}
) {
  logPublicSubmitFailure(request, {
    reason: error,
    formToken: input.formToken,
    normalizedPhone: input.normalizedPhone,
  });

  return NextResponse.json({ ok: false, error, message }, { status });
}

function isValidNormalizedPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

function isValidEmail(value: string | null) {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isReasonableDate(value: string | null) {
  if (!value) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isReasonableTime(value: string | null) {
  if (!value) return true;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
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
    return rejectPublicSubmit(
      request,
      400,
      "invalid_json",
      publicMessages.validation
    );
  }

  if (cleanText(payload.honeypot)) {
    return rejectPublicSubmit(
      request,
      400,
      "spam_rejected",
      publicMessages.spam,
      { formToken: cleanText(payload.form_token, 300) }
    );
  }

  if (!hasAcceptedLegalConsent(payload.legalConsentAccepted)) {
    return rejectPublicSubmit(
      request,
      400,
      "legal_consent_missing",
      LEGAL_CONSENT_REQUIRED_MESSAGE,
      { formToken: cleanText(payload.form_token, 300) }
    );
  }

  const formToken = cleanText(payload.form_token, 300);
  const customerName = cleanText(payload.customer_name, 120);
  const phone = cleanText(payload.phone, 80);
  const normalizedPhone = phone ? normalizePhone(phone) : "";
  const email = cleanText(payload.email, 200);
  const appointmentDate = cleanText(payload.appointment_date, 20);
  const appointmentTime = cleanText(payload.appointment_time, 20);
  const clientIp = getClientIp(request);

  if (!formToken || !customerName || !phone || !isValidNormalizedPhone(normalizedPhone)) {
    return rejectPublicSubmit(
      request,
      400,
      "required_fields_missing",
      publicMessages.validation,
      { formToken, normalizedPhone }
    );
  }

  if (!isValidEmail(email)) {
    return rejectPublicSubmit(
      request,
      400,
      "invalid_email",
      publicMessages.validation,
      { formToken, normalizedPhone }
    );
  }

  if (!isReasonableDate(appointmentDate) || !isReasonableTime(appointmentTime)) {
    return rejectPublicSubmit(
      request,
      400,
      "invalid_booking_time",
      publicMessages.validation,
      { formToken, normalizedPhone }
    );
  }

  if (isIpRateLimited(clientIp)) {
    return rejectPublicSubmit(
      request,
      429,
      "rate_limited",
      publicMessages.duplicate,
      { formToken, normalizedPhone }
    );
  }

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
      return rejectPublicSubmit(
        request,
        403,
        "invalid_form",
        publicMessages.unavailable,
        { formToken, normalizedPhone }
      );
    }

    return createLocalResponse(payload);
  }

  const supabase = createSupabaseAdminClient();
  const { data: form, error: formError } = await supabase
    .from("forms")
    .select("*")
    .eq("public_form_token", formToken)
    .single();

  if (formError || !form) {
    return rejectPublicSubmit(
      request,
      403,
      "invalid_form",
      publicMessages.unavailable,
      { formToken, normalizedPhone }
    );
  }

  const currentPageUrl = cleanText(submittedTouch.current_page_url, 2000);
  const allowedDomains = (form.allowed_domains ?? []) as string[];
  const originValidation = getOriginValidation(allowedDomains, [
    request.headers.get("origin"),
    request.headers.get("referer"),
    submittedTouch.parent_origin,
    submittedTouch.current_page_url,
    submittedTouch.landing_page_url,
    payload.first_touch_json?.parent_origin,
    payload.first_touch_json?.current_page_url,
    payload.first_touch_json?.landing_page_url,
    payload.latest_touch_json?.parent_origin,
    payload.latest_touch_json?.current_page_url,
    payload.latest_touch_json?.landing_page_url,
    payload.submitted_touch_json?.parent_origin,
    payload.submitted_touch_json?.current_page_url,
    payload.submitted_touch_json?.landing_page_url,
  ]);

  if (!originValidation.allowed) {
    console.warn("[LaunchHub] domain_not_allowed", {
      form_token: formToken,
      received_origins: originValidation.receivedOrigins,
      allowed_origins: originValidation.allowedOrigins,
    });
    logPublicSubmitFailure(request, {
      reason: "domain_not_allowed",
      formToken,
      normalizedPhone,
    });

    return NextResponse.json(
      {
        ok: false,
        error: "domain_not_allowed",
        message: publicMessages.unavailable,
        received_origins: originValidation.receivedOrigins,
        allowed_origins: originValidation.allowedOrigins,
      },
      { status: 403 }
    );
  }

  const treatmentId = cleanText(payload.treatment_id, 80) || form.default_treatment_id;
  const branchId = cleanText(payload.branch_id, 80) || form.default_branch_id;
  const packageId = cleanText(payload.package_id, 80) || form.default_package_id;

  const [
    { data: packageRecord },
    { data: treatmentRecord },
    { data: branchRecord },
    { data: brandRecord },
  ] = await Promise.all([
      supabase
        .from("packages")
        .select("*")
        .eq("id", packageId)
        .eq("status", "active")
        .single(),
      supabase
        .from("treatments")
        .select("id, brand_id, name")
        .eq("id", treatmentId)
        .eq("brand_id", form.brand_id)
        .eq("status", "active")
        .single(),
      supabase
        .from("branches")
        .select("id, brand_id, name")
        .eq("id", branchId)
        .eq("brand_id", form.brand_id)
        .eq("status", "active")
        .single(),
      supabase
        .from("brands")
        .select("slug, name")
        .eq("id", form.brand_id)
        .maybeSingle(),
    ]);

  if (!packageRecord) {
    return rejectPublicSubmit(
      request,
      400,
      "invalid_package",
      publicMessages.validation,
      { formToken, normalizedPhone }
    );
  }

  if (!treatmentRecord) {
    return rejectPublicSubmit(
      request,
      400,
      "invalid_treatment",
      publicMessages.validation,
      { formToken, normalizedPhone }
    );
  }

  if (!branchRecord) {
    return rejectPublicSubmit(
      request,
      400,
      "invalid_branch",
      publicMessages.validation,
      { formToken, normalizedPhone }
    );
  }

  if (packageRecord.treatment_id !== treatmentId) {
    return rejectPublicSubmit(
      request,
      400,
      "package_treatment_mismatch",
      publicMessages.validation,
      { formToken, normalizedPhone }
    );
  }

  const duplicateWindowStart = new Date(
    Date.now() - DUPLICATE_WINDOW_MS
  ).toISOString();
  const { data: shortWindowDuplicate, error: duplicateCheckError } = await supabase
    .from("leads")
    .select("id")
    .eq("normalized_phone", normalizedPhone)
    .eq("form_id", form.id)
    .gte("created_at", duplicateWindowStart)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (duplicateCheckError) {
    console.warn("[LaunchHub] duplicate_check_failed", {
      code: duplicateCheckError.code,
      message: duplicateCheckError.message,
      form_token: formToken,
      normalized_phone: normalizedPhone,
    });
  }

  if (shortWindowDuplicate) {
    return rejectPublicSubmit(
      request,
      429,
      "duplicate_recent_submission",
      publicMessages.duplicate,
      { formToken, normalizedPhone }
    );
  }

  // booking_only means a booking request was submitted without starting payment.
  const paymentStatus =
    packageRecord.payment_required && payload.payment_option === "pay_now"
      ? "pending"
      : "booking_only";
  const packageDisplayPrice =
    packageRecord.promo_price ?? packageRecord.original_price ?? 0;

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .upsert(
      {
        customer_name: customerName,
        phone,
        normalized_phone: normalizedPhone,
        email,
      },
      { onConflict: "normalized_phone" }
    )
    .select("id")
    .single();

  if (contactError || !contact) {
    return rejectPublicSubmit(
      request,
      500,
      "contact_upsert_failed",
      publicMessages.unavailable,
      { formToken, normalizedPhone }
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
    return rejectPublicSubmit(
      request,
      500,
      "snapshot_create_failed",
      publicMessages.unavailable,
      { formToken, normalizedPhone }
    );
  }

  const submittedAt = new Date().toISOString();

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
      appointment_date: appointmentDate,
      appointment_time: appointmentTime,
      price: packageDisplayPrice,
      currency: packageRecord.currency || "HKD",
      payment_status: paymentStatus,
      lead_status: isDuplicate ? "duplicate" : "submitted",
      booking_status: "requested",
      submitted_at: submittedAt,
    })
    .select("id")
    .single();

  if (leadError || !lead) {
    return rejectPublicSubmit(
      request,
      500,
      "lead_create_failed",
      publicMessages.unavailable,
      { formToken, normalizedPhone }
    );
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
    appointment_date: appointmentDate,
    appointment_time: appointmentTime,
    booking_status: "requested",
    created_by_source: classification.sourceType,
  });

  const legalLinks = getLegalLinks(cleanText(brandRecord?.slug, 120) || "brand");
  const legalConsentPayload = {
    consent_event: "legal_consent_accepted",
    accepted_at: new Date().toISOString(),
    consent_text: LEGAL_CONSENT_TEXT,
    privacy_policy_url: legalLinks.privacyPolicyUrl,
    terms_url: legalLinks.termsUrl,
    disclaimer_url: legalLinks.disclaimerUrl,
    form_token: formToken,
    landing_page_url: cleanText(submittedTouch.landing_page_url, 2000),
    current_page_url: currentPageUrl,
    request_origin: normalizeOrigin(request.headers.get("origin")),
    user_agent: shortUserAgent(request),
  };

  const { error: leadEventsError } = await supabase.from("lead_events").insert([
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
      event_type: "form_submit_success",
      event_payload_json: legalConsentPayload,
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

  if (leadEventsError) {
    console.warn("[LaunchHub] lead_events_insert_failed", {
      lead_id: lead.id,
      code: leadEventsError.code,
      message: leadEventsError.message,
    });
  } else if (isDuplicate) {
    console.warn("[LaunchHub] google_sheets_sync_skipped", {
      reason: "duplicate_lead",
      lead_id: lead.id,
    });
  } else {
    try {
      const sheetResult = await appendLeadToGoogleSheet({
        createdAt: submittedAt,
        customerName,
        phone: normalizedPhone,
        email,
        brandName: brandRecord?.name || "",
        treatmentName: treatmentRecord.name || "",
        packageName: packageRecord.name || "",
        price: packageDisplayPrice,
        branchName: branchRecord.name || "",
        appointmentDate,
        appointmentTime,
        pageUrl: currentPageUrl,
        touch: submittedTouch,
      });

      if (sheetResult.skipped) {
        console.warn("[LaunchHub] google_sheets_sync_skipped", {
          reason: sheetResult.reason,
          missing: sheetResult.missing,
        });
      }
    } catch (error) {
      console.warn("[LaunchHub] google_sheets_sync_failed", {
        lead_id: lead.id,
        message: error instanceof Error ? error.message : "unknown_error",
      });
    }
  }

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
