import "server-only";

import { randomUUID } from "crypto";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";
import {
  DEFAULT_GRAPH_API_VERSION,
  decryptConnectionAccessToken,
  getWhatsAppConnectionByBrandId,
  normalizeWhatsAppPhone,
  type WhatsAppConnectionRecord,
} from "@/lib/crm/whatsapp";
import { upsertWhatsAppConversation } from "@/lib/crm/whatsappInbox";

const LIVE_SEND_ENV = "WHATSAPP_CAMPAIGNS_LIVE_ENABLED";
const DEFAULT_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 25;
const MAX_AUDIENCE_ROWS = 5000;
const OPT_OUT_KEYWORDS = new Set([
  "stop",
  "unsubscribe",
  "停止",
  "取消訂閱",
  "不要再發",
  "唔好再發",
  "不要再傳送",
]);

export type WhatsAppCampaignStatus =
  | "draft"
  | "dry_run_ready"
  | "approved"
  | "queued"
  | "sending"
  | "paused"
  | "completed"
  | "cancelled"
  | "failed";

export type WhatsAppCampaignRecord = {
  id: string;
  brand_id: string;
  connection_id: string;
  template_id: string;
  name: string;
  status: WhatsAppCampaignStatus;
  audience_definition: Record<string, unknown> | null;
  frequency_cap_days: number;
  requires_approval: boolean;
  eligible_count: number;
  excluded_count: number;
  queued_count: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  opt_out_count: number;
  approved_by: string | null;
  approved_at: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  paused_at: string | null;
  last_error: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type WhatsAppCampaignTemplate = {
  id: string;
  template_name: string;
  language_code: string;
  category: string | null;
  status: string;
  components: unknown;
  connection_id: string | null;
  is_stale: boolean;
};

type CampaignRecipientClaim = {
  id: string;
  campaign_id: string;
  brand_id: string;
  contact_id: string | null;
  lead_id: string | null;
  normalized_phone: string;
  customer_name: string | null;
  template_variables: unknown;
  attempt_count: number;
};

type CandidateLead = {
  id: string;
  contact_id: string | null;
  name: string | null;
  phone: string | null;
  normalized_phone: string | null;
  created_at: string;
};

type ConsentRow = {
  normalized_phone: string;
  consent_status: string;
  consent_categories: unknown;
};

type SuppressionRow = {
  normalized_phone: string;
  active: boolean;
};

export function isWhatsAppCampaignLiveSendEnabled() {
  return process.env[LIVE_SEND_ENV]?.trim().toLowerCase() === "true";
}

export async function getWhatsAppCampaignDashboard(brandSlug = "ineffable") {
  if (!hasSupabaseAdminEnv()) {
    return emptyDashboard("supabase_admin_not_configured");
  }

  const supabase = createSupabaseAdminClient();
  const normalizedSlug = brandSlug === "ineffable-beauty" ? "ineffable" : clean(brandSlug, 120);
  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select("id,name,slug")
    .eq("slug", normalizedSlug)
    .maybeSingle();

  if (brandError || !brand) return emptyDashboard("brand_not_found");

  const [{ data: campaigns, error: campaignError }, { data: templates }, { count: consentCount }, { count: suppressionCount }] =
    await Promise.all([
      supabase
        .from("whatsapp_campaigns")
        .select("*")
        .eq("brand_id", brand.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("whatsapp_templates")
        .select("id,template_name,language_code,category,status,components,connection_id,is_stale")
        .eq("brand_id", brand.id)
        .eq("status", "APPROVED")
        .eq("is_stale", false)
        .order("template_name", { ascending: true }),
      supabase
        .from("whatsapp_contact_consents")
        .select("id", { count: "exact", head: true })
        .eq("brand_id", brand.id)
        .eq("consent_status", "granted"),
      supabase
        .from("whatsapp_suppressions")
        .select("id", { count: "exact", head: true })
        .eq("brand_id", brand.id)
        .eq("active", true),
    ]);

  if (campaignError) {
    return {
      ...emptyDashboard(isMissingCampaignTableError(campaignError) ? "migration_not_applied" : "campaign_read_failed"),
      brand,
    };
  }

  const marketingTemplates = ((templates || []) as WhatsAppCampaignTemplate[]).filter(
    (template) => (template.category || "").toUpperCase() === "MARKETING"
  );

  return {
    ok: true,
    tableReady: true,
    brand,
    campaigns: (campaigns || []) as WhatsAppCampaignRecord[],
    templates: marketingTemplates,
    consentCount: consentCount || 0,
    suppressionCount: suppressionCount || 0,
    liveSendEnabled: isWhatsAppCampaignLiveSendEnabled(),
    error: null,
  };
}

export async function recordWhatsAppMarketingConsent(input: {
  brandSlug: string;
  phone: string;
  source: string;
  evidenceNote: string;
  actor: string;
}) {
  const context = await resolveBrandContext(input.brandSlug);
  if (!context.ok) return context;

  const normalizedPhone = normalizeWhatsAppPhone(input.phone);
  const source = clean(input.source, 160);
  const evidenceNote = clean(input.evidenceNote, 1000);
  if (!normalizedPhone || normalizedPhone.length < 10) return failure("valid_phone_required");
  if (!source || !evidenceNote) return failure("consent_evidence_required");

  const contactId = await findContactIdByPhone(normalizedPhone);
  const now = new Date().toISOString();
  const { error } = await context.supabase.from("whatsapp_contact_consents").upsert(
    {
      brand_id: context.brand.id,
      contact_id: contactId,
      normalized_phone: normalizedPhone,
      consent_status: "granted",
      consent_categories: ["marketing"],
      consent_source: source,
      evidence_note: evidenceNote,
      evidence_payload: { recorded_from: "crm_whatsapp_campaigns" },
      captured_at: now,
      revoked_at: null,
      created_by: clean(input.actor, 160),
      updated_at: now,
    },
    { onConflict: "brand_id,normalized_phone" }
  );

  if (error) return failure("consent_write_failed", error.message);

  const { data: suppression } = await context.supabase
    .from("whatsapp_suppressions")
    .select("id,active")
    .eq("brand_id", context.brand.id)
    .eq("normalized_phone", normalizedPhone)
    .maybeSingle();

  return {
    ok: true,
    message: suppression?.active ? "consent_recorded_but_still_suppressed" : "consent_recorded",
    normalizedPhone,
  };
}

export async function createWhatsAppCampaign(input: {
  brandSlug: string;
  name: string;
  templateId: string;
  frequencyCapDays: number;
  actor: string;
}) {
  const context = await resolveBrandContext(input.brandSlug);
  if (!context.ok) return context;

  const name = clean(input.name, 200);
  const templateId = clean(input.templateId, 100);
  const frequencyCapDays = clampNumber(input.frequencyCapDays, 1, 365, 30);
  if (!name || !templateId) return failure("campaign_name_and_template_required");

  const [{ data: template }, { data: connection }] = await Promise.all([
    context.supabase
      .from("whatsapp_templates")
      .select("*")
      .eq("id", templateId)
      .eq("brand_id", context.brand.id)
      .eq("status", "APPROVED")
      .eq("is_stale", false)
      .maybeSingle(),
    context.supabase
      .from("whatsapp_connections")
      .select("id,status")
      .eq("brand_id", context.brand.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!template) return failure("approved_template_required");
  if ((template.category || "").toUpperCase() !== "MARKETING") {
    return failure("marketing_template_required");
  }
  if (!connection?.id) return failure("whatsapp_connection_required");

  const { data: campaign, error } = await context.supabase
    .from("whatsapp_campaigns")
    .insert({
      brand_id: context.brand.id,
      connection_id: connection.id,
      template_id: template.id,
      name,
      status: "draft",
      audience_definition: {
        segment: "all_brand_contacts",
        consent_category: "marketing",
        variable_keys: ["customer_name"],
      },
      frequency_cap_days: frequencyCapDays,
      requires_approval: true,
      created_by: clean(input.actor, 160),
    })
    .select("*")
    .single();

  if (error || !campaign) return failure("campaign_create_failed", error?.message);
  await insertCampaignEvent(context.supabase, campaign.id, "campaign_created", input.actor, {
    template_id: template.id,
    frequency_cap_days: frequencyCapDays,
  });
  return { ok: true, message: "campaign_created", campaign };
}

export async function runWhatsAppCampaignDryRun(campaignId: string, actor: string) {
  const campaignContext = await getCampaignContext(campaignId);
  if (!campaignContext.ok) return campaignContext;
  const { supabase, campaign, template } = campaignContext;

  if (!["draft", "dry_run_ready", "paused"].includes(campaign.status)) {
    return failure("campaign_not_dry_runnable");
  }

  const { data: leads, error: leadError } = await supabase
    .from("leads")
    .select("id,contact_id,name,phone,normalized_phone,created_at")
    .eq("brand_id", campaign.brand_id)
    .order("created_at", { ascending: false })
    .limit(MAX_AUDIENCE_ROWS);

  if (leadError) return failure("audience_load_failed", leadError.message);

  const deduped = new Map<string, CandidateLead>();
  for (const rawLead of (leads || []) as CandidateLead[]) {
    const normalizedPhone = normalizeWhatsAppPhone(rawLead.normalized_phone || rawLead.phone || "");
    if (!normalizedPhone || deduped.has(normalizedPhone)) continue;
    deduped.set(normalizedPhone, { ...rawLead, normalized_phone: normalizedPhone });
  }

  const phones = Array.from(deduped.keys());
  const [consents, suppressions, recentPhones] = await Promise.all([
    fetchRowsByPhone<ConsentRow>(supabase, "whatsapp_contact_consents", campaign.brand_id, phones, "normalized_phone,consent_status,consent_categories"),
    fetchRowsByPhone<SuppressionRow>(supabase, "whatsapp_suppressions", campaign.brand_id, phones, "normalized_phone,active"),
    fetchRecentlyMessagedPhones(supabase, campaign.brand_id, campaign.frequency_cap_days),
  ]);

  const consentByPhone = new Map(consents.map((row) => [row.normalized_phone, row]));
  const suppressedPhones = new Set(
    suppressions.filter((row) => row.active).map((row) => row.normalized_phone)
  );
  const requiredVariableCount = countTemplateBodyVariables(template.components);
  const recipientRows = Array.from(deduped.entries()).map(([phone, lead]) => {
    const consent = consentByPhone.get(phone);
    let exclusionReason: string | null = null;

    if (!hasMarketingConsent(consent)) exclusionReason = "marketing_consent_missing";
    else if (suppressedPhones.has(phone)) exclusionReason = "suppressed_or_opted_out";
    else if (recentPhones.has(phone)) exclusionReason = "frequency_cap_active";
    else if (requiredVariableCount > 1) exclusionReason = "template_variable_mapping_required";

    const customerName = clean(lead.name, 160) || "客戶";
    const variables = requiredVariableCount === 1 ? [customerName] : [];
    return {
      campaign_id: campaign.id,
      brand_id: campaign.brand_id,
      contact_id: lead.contact_id,
      lead_id: lead.id,
      normalized_phone: phone,
      customer_name: customerName,
      template_variables: variables,
      eligibility_status: exclusionReason ? "excluded" : "eligible",
      exclusion_reason: exclusionReason,
      send_status: exclusionReason ? "skipped" : "pending",
      idempotency_key: `${campaign.id}:${phone}`,
      updated_at: new Date().toISOString(),
    };
  });

  const { error: deleteError } = await supabase
    .from("whatsapp_campaign_recipients")
    .delete()
    .eq("campaign_id", campaign.id);
  if (deleteError) return failure("dry_run_reset_failed", deleteError.message);

  for (const chunk of chunkRows(recipientRows, 250)) {
    if (!chunk.length) continue;
    const { error } = await supabase.from("whatsapp_campaign_recipients").insert(chunk);
    if (error) return failure("dry_run_recipient_write_failed", error.message);
  }

  const eligibleCount = recipientRows.filter((row) => row.eligibility_status === "eligible").length;
  const excludedCount = recipientRows.length - eligibleCount;
  const { error: updateError } = await supabase
    .from("whatsapp_campaigns")
    .update({
      status: "dry_run_ready",
      eligible_count: eligibleCount,
      excluded_count: excludedCount,
      queued_count: 0,
      sent_count: 0,
      delivered_count: 0,
      read_count: 0,
      failed_count: 0,
      opt_out_count: 0,
      approved_by: null,
      approved_at: null,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaign.id);
  if (updateError) return failure("dry_run_summary_write_failed", updateError.message);

  await insertCampaignEvent(supabase, campaign.id, "dry_run_completed", actor, {
    audience_count: recipientRows.length,
    eligible_count: eligibleCount,
    excluded_count: excludedCount,
    required_template_variables: requiredVariableCount,
  });

  return {
    ok: true,
    message: "dry_run_completed",
    audienceCount: recipientRows.length,
    eligibleCount,
    excludedCount,
  };
}

export async function approveWhatsAppCampaign(campaignId: string, actor: string) {
  const context = await getCampaignContext(campaignId);
  if (!context.ok) return context;
  const { campaign, supabase } = context;
  if (campaign.status !== "dry_run_ready") return failure("dry_run_required_before_approval");
  if (campaign.eligible_count < 1) return failure("no_eligible_recipients");

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("whatsapp_campaigns")
    .update({
      status: "approved",
      approved_by: clean(actor, 160),
      approved_at: now,
      last_error: null,
      updated_at: now,
    })
    .eq("id", campaign.id)
    .eq("status", "dry_run_ready");
  if (error) return failure("campaign_approval_failed", error.message);

  await insertCampaignEvent(supabase, campaign.id, "campaign_approved", actor, {
    eligible_count: campaign.eligible_count,
  });
  return { ok: true, message: "campaign_approved" };
}

export async function queueWhatsAppCampaign(campaignId: string, actor: string) {
  if (!isWhatsAppCampaignLiveSendEnabled()) return failure("live_send_disabled");
  const context = await getCampaignContext(campaignId);
  if (!context.ok) return context;
  const { campaign, supabase } = context;
  if (campaign.status !== "approved") return failure("campaign_must_be_approved");

  const now = new Date().toISOString();
  const { error: recipientError } = await supabase
    .from("whatsapp_campaign_recipients")
    .update({ send_status: "queued", updated_at: now })
    .eq("campaign_id", campaign.id)
    .eq("eligibility_status", "eligible")
    .eq("send_status", "pending");
  if (recipientError) return failure("recipient_queue_failed", recipientError.message);

  const { error } = await supabase
    .from("whatsapp_campaigns")
    .update({
      status: "queued",
      queued_count: campaign.eligible_count,
      last_error: null,
      updated_at: now,
    })
    .eq("id", campaign.id)
    .eq("status", "approved");
  if (error) return failure("campaign_queue_failed", error.message);

  await insertCampaignEvent(supabase, campaign.id, "campaign_queued", actor, {});
  return { ok: true, message: "campaign_queued" };
}

export async function pauseWhatsAppCampaign(campaignId: string, actor: string, reason = "manual_pause") {
  if (!hasSupabaseAdminEnv()) return failure("supabase_admin_not_configured");
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("whatsapp_campaigns")
    .update({ status: "paused", paused_at: now, last_error: clean(reason, 500), updated_at: now })
    .eq("id", clean(campaignId, 100))
    .in("status", ["approved", "queued", "sending"]);
  if (error) return failure("campaign_pause_failed", error.message);
  await insertCampaignEvent(supabase, campaignId, "campaign_paused", actor, { reason });
  return { ok: true, message: "campaign_paused" };
}

export async function cancelWhatsAppCampaign(campaignId: string, actor: string) {
  if (!hasSupabaseAdminEnv()) return failure("supabase_admin_not_configured");
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("whatsapp_campaigns")
    .update({ status: "cancelled", updated_at: now })
    .eq("id", clean(campaignId, 100))
    .not("status", "in", "(completed,cancelled)");
  if (error) return failure("campaign_cancel_failed", error.message);
  await supabase
    .from("whatsapp_campaign_recipients")
    .update({ send_status: "skipped", last_error_code: "campaign_cancelled", updated_at: now })
    .eq("campaign_id", campaignId)
    .in("send_status", ["pending", "queued", "claimed"]);
  await insertCampaignEvent(supabase, campaignId, "campaign_cancelled", actor, {});
  return { ok: true, message: "campaign_cancelled" };
}

export async function processWhatsAppCampaignBatch(
  campaignId: string,
  actor = "campaign_worker",
  requestedBatchSize = DEFAULT_BATCH_SIZE
) {
  if (!isWhatsAppCampaignLiveSendEnabled()) return failure("live_send_disabled");
  const context = await getCampaignContext(campaignId);
  if (!context.ok) return context;
  const { campaign, template, supabase } = context;
  if (!["queued", "sending"].includes(campaign.status)) return failure("campaign_not_queued");

  const batchSize = clampNumber(requestedBatchSize, 1, MAX_BATCH_SIZE, DEFAULT_BATCH_SIZE);
  const claimToken = randomUUID();
  const now = new Date().toISOString();
  await supabase
    .from("whatsapp_campaigns")
    .update({ status: "sending", started_at: campaign.started_at || now, updated_at: now })
    .eq("id", campaign.id)
    .in("status", ["queued", "sending"]);

  const { data: claims, error: claimError } = await supabase.rpc(
    "claim_whatsapp_campaign_recipients",
    {
      p_campaign_id: campaign.id,
      p_limit: batchSize,
      p_claim_token: claimToken,
    }
  );
  if (claimError) {
    await pauseWhatsAppCampaign(campaign.id, actor, `queue_claim_failed:${claimError.message}`);
    return failure("queue_claim_failed", claimError.message);
  }

  const connection = await getWhatsAppConnectionByBrandId(campaign.brand_id, campaign.connection_id);
  if (!connection) {
    await pauseWhatsAppCampaign(campaign.id, actor, "whatsapp_connection_missing");
    return failure("whatsapp_connection_missing");
  }
  const token = decryptConnectionAccessToken(connection);
  if (!token || !connection.phone_number_id) {
    await pauseWhatsAppCampaign(campaign.id, actor, "whatsapp_credentials_unavailable");
    return failure("whatsapp_credentials_unavailable");
  }

  const results: Array<Record<string, unknown>> = [];
  for (const claim of (claims || []) as CampaignRecipientClaim[]) {
    const safety = await recheckRecipientSafety(supabase, campaign, claim);
    if (!safety.ok) {
      await markRecipientSkipped(supabase, claim.id, safety.message);
      results.push({ recipientId: claim.id, ok: false, skipped: safety.message });
      continue;
    }

    const sendResult = await sendCampaignTemplate({
      campaign,
      template,
      recipient: claim,
      connection,
      token,
      actor,
    });
    results.push({ recipientId: claim.id, ...sendResult });

    if (!sendResult.ok && sendResult.pauseCampaign) {
      await pauseWhatsAppCampaign(campaign.id, actor, sendResult.message);
      break;
    }
  }

  const summary = await refreshCampaignCounters(campaign.id);
  if (summary.remainingCount === 0 && summary.claimedCount === 0) {
    const completedAt = new Date().toISOString();
    await supabase
      .from("whatsapp_campaigns")
      .update({ status: "completed", completed_at: completedAt, updated_at: completedAt })
      .eq("id", campaign.id)
      .eq("status", "sending");
    await insertCampaignEvent(supabase, campaign.id, "campaign_completed", actor, summary);
  }

  return {
    ok: true,
    message: "campaign_batch_processed",
    claimed: (claims || []).length,
    results,
    summary,
  };
}

export async function processNextWhatsAppCampaigns(limit = 3) {
  if (!isWhatsAppCampaignLiveSendEnabled() || !hasSupabaseAdminEnv()) {
    return { ok: false, message: "live_send_disabled", processed: [] as unknown[] };
  }
  const supabase = createSupabaseAdminClient();
  const { data: campaigns, error } = await supabase
    .from("whatsapp_campaigns")
    .select("id")
    .in("status", ["queued", "sending"])
    .order("created_at", { ascending: true })
    .limit(clampNumber(limit, 1, 10, 3));
  if (error) return { ok: false, message: "campaign_queue_read_failed", processed: [] as unknown[] };

  const processed = [];
  for (const campaign of campaigns || []) {
    processed.push(await processWhatsAppCampaignBatch(campaign.id, "campaign_worker"));
  }
  return { ok: true, message: "campaign_worker_completed", processed };
}

export async function recordWhatsAppCampaignRecipientStatus(
  providerMessageId: string,
  status: string,
  rawPayload: Record<string, unknown>
) {
  if (!hasSupabaseAdminEnv() || !providerMessageId) return { ok: false };
  const supabase = createSupabaseAdminClient();
  const { data: recipient } = await supabase
    .from("whatsapp_campaign_recipients")
    .select("id,campaign_id,send_status")
    .eq("provider_message_id", providerMessageId)
    .maybeSingle();
  if (!recipient) return { ok: true, skipped: "campaign_recipient_not_found" };

  const nextStatus = normalizeProviderStatus(status);
  if (!nextStatus || statusRank(nextStatus) < statusRank(recipient.send_status)) {
    return { ok: true, skipped: "status_not_advanced" };
  }

  const now = new Date().toISOString();
  const timestampColumn =
    nextStatus === "delivered" ? { delivered_at: now } : nextStatus === "read" ? { read_at: now } : {};
  await supabase
    .from("whatsapp_campaign_recipients")
    .update({
      send_status: nextStatus,
      ...timestampColumn,
      last_error_payload: rawPayload,
      updated_at: now,
    })
    .eq("id", recipient.id);
  await refreshCampaignCounters(recipient.campaign_id);
  return { ok: true };
}

export async function handleWhatsAppCampaignOptOut(input: {
  brandId: string;
  normalizedPhone: string;
  body: string;
  messageId?: string;
}) {
  if (!hasSupabaseAdminEnv() || !isOptOutMessage(input.body)) {
    return { ok: true, optedOut: false };
  }

  const normalizedPhone = normalizeWhatsAppPhone(input.normalizedPhone);
  if (!normalizedPhone) return { ok: true, optedOut: false };
  const supabase = createSupabaseAdminClient();
  const contactId = await findContactIdByPhone(normalizedPhone);
  const now = new Date().toISOString();

  await supabase.from("whatsapp_suppressions").upsert(
    {
      brand_id: input.brandId,
      contact_id: contactId,
      normalized_phone: normalizedPhone,
      active: true,
      reason: "customer_opt_out",
      source: "whatsapp_inbound_keyword",
      evidence_payload: { message_id: clean(input.messageId, 200), body: clean(input.body, 200) },
      suppressed_at: now,
      released_at: null,
      updated_at: now,
    },
    { onConflict: "brand_id,normalized_phone" }
  );

  await supabase
    .from("whatsapp_contact_consents")
    .update({ consent_status: "revoked", revoked_at: now, updated_at: now })
    .eq("brand_id", input.brandId)
    .eq("normalized_phone", normalizedPhone);

  const { data: affected } = await supabase
    .from("whatsapp_campaign_recipients")
    .update({
      send_status: "opted_out",
      exclusion_reason: "customer_opt_out",
      updated_at: now,
    })
    .eq("brand_id", input.brandId)
    .eq("normalized_phone", normalizedPhone)
    .in("send_status", ["pending", "queued", "claimed"])
    .select("campaign_id");

  for (const campaignId of new Set((affected || []).map((row) => row.campaign_id).filter(Boolean))) {
    await refreshCampaignCounters(campaignId);
  }

  return { ok: true, optedOut: true };
}

function isOptOutMessage(body: string) {
  return OPT_OUT_KEYWORDS.has(clean(body, 120).toLowerCase());
}

async function sendCampaignTemplate(input: {
  campaign: WhatsAppCampaignRecord;
  template: WhatsAppCampaignTemplate;
  recipient: CampaignRecipientClaim;
  connection: WhatsAppConnectionRecord;
  token: string;
  actor: string;
}) {
  const { campaign, template, recipient, connection, token, actor } = input;
  const variables = Array.isArray(recipient.template_variables)
    ? recipient.template_variables.map((value) => clean(value, 1000)).filter(Boolean)
    : [];
  const graphVersion = connection.graph_api_version || DEFAULT_GRAPH_API_VERSION;
  const endpoint = `https://graph.facebook.com/${graphVersion}/${connection.phone_number_id}/messages`;
  const components = variables.length
    ? [
        {
          type: "body",
          parameters: variables.map((text) => ({ type: "text", text })),
        },
      ]
    : undefined;

  let response: Response;
  let responseJson: Record<string, unknown> | null = null;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipient.normalized_phone,
        type: "template",
        template: {
          name: template.template_name,
          language: { code: template.language_code },
          ...(components ? { components } : {}),
        },
      }),
    });
    responseJson = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  } catch (error) {
    await scheduleRecipientRetry(recipient, "meta_request_failed", {
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return { ok: false, message: "meta_request_failed", pauseCampaign: false };
  }

  if (!response.ok) {
    const code = getMetaErrorCode(responseJson);
    const hardStop = [400, 401, 403].includes(response.status) || isPolicyOrTemplateError(code, responseJson);
    if (response.status >= 500 || response.status === 429) {
      await scheduleRecipientRetry(recipient, `meta_${response.status}`, responseJson || {});
    } else {
      await markRecipientFailed(recipient.id, `meta_${response.status}_${code || "unknown"}`, responseJson || {});
    }
    return {
      ok: false,
      message: hardStop ? "meta_policy_or_template_error" : "meta_send_failed",
      status: response.status,
      code,
      pauseCampaign: hardStop,
    };
  }

  const responseMessages = Array.isArray(responseJson?.messages) ? responseJson?.messages : [];
  const providerMessageId = clean((responseMessages[0] as Record<string, unknown> | undefined)?.id, 300) || null;
  const sentAt = new Date().toISOString();
  const supabase = createSupabaseAdminClient();
  const summary = `[Campaign] ${campaign.name} · ${template.template_name}`;
  const conversation = await upsertWhatsAppConversation({
    brandId: campaign.brand_id,
    connectionId: connection.id,
    leadId: recipient.lead_id,
    customerPhone: recipient.normalized_phone,
    customerName: recipient.customer_name,
    direction: "outbound",
    body: summary,
    messageAt: sentAt,
  });

  await supabase.from("whatsapp_messages").insert({
    brand_id: campaign.brand_id,
    lead_id: recipient.lead_id,
    connection_id: connection.id,
    conversation_id: conversation.conversationId,
    direction: "outbound",
    message_type: "template",
    whatsapp_message_id: providerMessageId,
    from_phone: connection.display_phone_number,
    to_phone: recipient.normalized_phone,
    body: summary,
    template_name: template.template_name,
    status: "sent",
    raw_payload: responseJson || {},
    sent_by_user_id: clean(actor, 160),
  });

  await supabase
    .from("whatsapp_campaign_recipients")
    .update({
      send_status: "sent",
      provider_message_id: providerMessageId,
      sent_at: sentAt,
      last_error_code: null,
      last_error_payload: {},
      updated_at: sentAt,
    })
    .eq("id", recipient.id);
  await insertCampaignEvent(supabase, campaign.id, "recipient_sent", actor, {
    recipient_id: recipient.id,
    provider_message_id: providerMessageId,
  }, recipient.id);
  return { ok: true, message: "template_sent", providerMessageId, pauseCampaign: false };
}

async function recheckRecipientSafety(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  campaign: WhatsAppCampaignRecord,
  recipient: CampaignRecipientClaim
) {
  const [{ data: consent }, { data: suppression }] = await Promise.all([
    supabase
      .from("whatsapp_contact_consents")
      .select("consent_status,consent_categories")
      .eq("brand_id", campaign.brand_id)
      .eq("normalized_phone", recipient.normalized_phone)
      .maybeSingle(),
    supabase
      .from("whatsapp_suppressions")
      .select("active")
      .eq("brand_id", campaign.brand_id)
      .eq("normalized_phone", recipient.normalized_phone)
      .maybeSingle(),
  ]);
  if (!hasMarketingConsent(consent as ConsentRow | null)) return failure("marketing_consent_missing");
  if (suppression?.active) return failure("suppressed_or_opted_out");
  return { ok: true as const };
}

async function getCampaignContext(campaignId: string) {
  if (!hasSupabaseAdminEnv()) return failure("supabase_admin_not_configured");
  const supabase = createSupabaseAdminClient();
  const { data: campaign, error } = await supabase
    .from("whatsapp_campaigns")
    .select("*")
    .eq("id", clean(campaignId, 100))
    .maybeSingle();
  if (error || !campaign) return failure("campaign_not_found", error?.message);

  const { data: template } = await supabase
    .from("whatsapp_templates")
    .select("id,template_name,language_code,category,status,components,connection_id,is_stale")
    .eq("id", campaign.template_id)
    .eq("brand_id", campaign.brand_id)
    .eq("status", "APPROVED")
    .eq("is_stale", false)
    .maybeSingle();
  if (!template || (template.category || "").toUpperCase() !== "MARKETING") {
    return failure("approved_marketing_template_required");
  }

  return {
    ok: true as const,
    supabase,
    campaign: campaign as WhatsAppCampaignRecord,
    template: template as WhatsAppCampaignTemplate,
  };
}

async function resolveBrandContext(brandSlug: string) {
  if (!hasSupabaseAdminEnv()) return failure("supabase_admin_not_configured");
  const supabase = createSupabaseAdminClient();
  const normalizedSlug = brandSlug === "ineffable-beauty" ? "ineffable" : clean(brandSlug, 120);
  const { data: brand, error } = await supabase
    .from("brands")
    .select("id,name,slug")
    .eq("slug", normalizedSlug)
    .maybeSingle();
  if (error || !brand) return failure("brand_not_found", error?.message);
  return { ok: true as const, supabase, brand };
}

async function findContactIdByPhone(normalizedPhone: string) {
  if (!hasSupabaseAdminEnv()) return null;
  const supabase = createSupabaseAdminClient();
  const { data: contact } = await supabase
    .from("contacts")
    .select("id")
    .eq("normalized_phone", normalizedPhone)
    .maybeSingle();
  return contact?.id || null;
}

async function fetchRowsByPhone<T>(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  table: string,
  brandId: string,
  phones: string[],
  select: string
) {
  const rows: T[] = [];
  for (const chunk of chunkRows(phones, 200)) {
    if (!chunk.length) continue;
    const { data } = await supabase
      .from(table)
      .select(select)
      .eq("brand_id", brandId)
      .in("normalized_phone", chunk);
    rows.push(...((data || []) as T[]));
  }
  return rows;
}

async function fetchRecentlyMessagedPhones(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  brandId: string,
  frequencyCapDays: number
) {
  const cutoff = new Date(Date.now() - frequencyCapDays * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("whatsapp_campaign_recipients")
    .select("normalized_phone")
    .eq("brand_id", brandId)
    .in("send_status", ["sent", "delivered", "read"])
    .gte("sent_at", cutoff)
    .limit(MAX_AUDIENCE_ROWS);
  return new Set((data || []).map((row) => row.normalized_phone).filter(Boolean));
}

async function scheduleRecipientRetry(
  recipient: CampaignRecipientClaim,
  code: string,
  payload: Record<string, unknown>
) {
  const supabase = createSupabaseAdminClient();
  const retryMinutes = Math.min(60, Math.max(2, 2 ** Math.max(1, recipient.attempt_count)));
  await supabase
    .from("whatsapp_campaign_recipients")
    .update({
      send_status: recipient.attempt_count >= 3 ? "failed" : "queued",
      next_attempt_at:
        recipient.attempt_count >= 3
          ? null
          : new Date(Date.now() + retryMinutes * 60 * 1000).toISOString(),
      last_error_code: clean(code, 200),
      last_error_payload: payload,
      failed_at: recipient.attempt_count >= 3 ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", recipient.id);
}

async function markRecipientFailed(id: string, code: string, payload: Record<string, unknown>) {
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  await supabase
    .from("whatsapp_campaign_recipients")
    .update({
      send_status: "failed",
      last_error_code: clean(code, 200),
      last_error_payload: payload,
      failed_at: now,
      updated_at: now,
    })
    .eq("id", id);
}

async function markRecipientSkipped(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  id: string,
  reason: string
) {
  await supabase
    .from("whatsapp_campaign_recipients")
    .update({
      send_status: reason === "suppressed_or_opted_out" ? "opted_out" : "skipped",
      exclusion_reason: clean(reason, 240),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
}

async function refreshCampaignCounters(campaignId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: rows } = await supabase
    .from("whatsapp_campaign_recipients")
    .select("send_status,eligibility_status")
    .eq("campaign_id", campaignId)
    .limit(MAX_AUDIENCE_ROWS);
  const recipients = rows || [];
  const count = (status: string) => recipients.filter((row) => row.send_status === status).length;
  const eligibleCount = recipients.filter((row) => row.eligibility_status === "eligible").length;
  const excludedCount = recipients.length - eligibleCount;
  const queuedCount = count("queued") + count("pending");
  const sentCount = count("sent") + count("delivered") + count("read");
  const deliveredCount = count("delivered") + count("read");
  const readCount = count("read");
  const failedCount = count("failed");
  const optOutCount = count("opted_out");
  const claimedCount = count("claimed");
  const remainingCount = queuedCount;

  await supabase
    .from("whatsapp_campaigns")
    .update({
      eligible_count: eligibleCount,
      excluded_count: excludedCount,
      queued_count: queuedCount,
      sent_count: sentCount,
      delivered_count: deliveredCount,
      read_count: readCount,
      failed_count: failedCount,
      opt_out_count: optOutCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);
  return {
    eligibleCount,
    excludedCount,
    queuedCount,
    sentCount,
    deliveredCount,
    readCount,
    failedCount,
    optOutCount,
    claimedCount,
    remainingCount,
  };
}

async function insertCampaignEvent(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  campaignId: string,
  eventType: string,
  actor: string,
  metadata: Record<string, unknown>,
  recipientId: string | null = null
) {
  await supabase.from("whatsapp_campaign_events").insert({
    campaign_id: campaignId,
    recipient_id: recipientId,
    event_type: clean(eventType, 160),
    actor: clean(actor, 160) || null,
    metadata,
  });
}

function countTemplateBodyVariables(components: unknown) {
  if (!Array.isArray(components)) return 0;
  const body = components.find((component) => {
    const record = asRecord(component);
    return clean(record.type, 40).toUpperCase() === "BODY";
  });
  const text = clean(asRecord(body).text, 10000);
  const matches = Array.from(text.matchAll(/\{\{(\d+)\}\}/g)).map((match) => Number(match[1]));
  return matches.length ? Math.max(...matches) : 0;
}

function hasMarketingConsent(consent: ConsentRow | null | undefined) {
  if (!consent || consent.consent_status !== "granted") return false;
  if (!Array.isArray(consent.consent_categories)) return false;
  return consent.consent_categories.some((value) => clean(value, 80).toLowerCase() === "marketing");
}

function normalizeProviderStatus(status: string) {
  const normalized = clean(status, 40).toLowerCase();
  return ["sent", "delivered", "read", "failed"].includes(normalized) ? normalized : null;
}

function statusRank(status: string | null) {
  const rank: Record<string, number> = {
    pending: 0,
    queued: 1,
    claimed: 2,
    sent: 3,
    delivered: 4,
    read: 5,
    failed: 99,
    skipped: 99,
    opted_out: 99,
  };
  return rank[status || "pending"] ?? 0;
}

function getMetaErrorCode(payload: Record<string, unknown> | null) {
  const error = asRecord(payload?.error);
  const code = Number(error.code);
  return Number.isFinite(code) ? code : null;
}

function isPolicyOrTemplateError(code: number | null, payload: Record<string, unknown> | null) {
  const message = clean(asRecord(payload?.error).message, 1000).toLowerCase();
  return (
    [10, 100, 190, 131026, 131042, 132000, 132001, 132015, 132016].includes(code || 0) ||
    message.includes("template") ||
    message.includes("policy") ||
    message.includes("permission")
  );
}

function isMissingCampaignTableError(error: { code?: string; message?: string } | null) {
  const message = error?.message?.toLowerCase() || "";
  return error?.code === "42P01" || error?.code === "PGRST205" || message.includes("whatsapp_campaign");
}

function emptyDashboard(error: string) {
  return {
    ok: false,
    tableReady: error !== "migration_not_applied",
    brand: null,
    campaigns: [] as WhatsAppCampaignRecord[],
    templates: [] as WhatsAppCampaignTemplate[],
    consentCount: 0,
    suppressionCount: 0,
    liveSendEnabled: isWhatsAppCampaignLiveSendEnabled(),
    error,
  };
}

function failure(message: string, detail?: string | null) {
  return { ok: false as const, message, detail: detail || null };
}

function clean(value: unknown, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function chunkRows<T>(rows: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) chunks.push(rows.slice(index, index + size));
  return chunks;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
