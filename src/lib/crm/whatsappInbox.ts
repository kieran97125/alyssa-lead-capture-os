import "server-only";

import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import {
  DEFAULT_GRAPH_API_VERSION,
  decryptConnectionAccessToken,
  getWhatsAppConnectionByBrandId,
  normalizeWhatsAppPhone,
  type WhatsAppConnectionRecord,
} from "@/lib/crm/whatsapp";
import { createCrmInteraction, safeError } from "@/lib/crm/store";

export const WHATSAPP_SERVICE_WINDOW_HOURS = 24;

export type WhatsAppServiceWindowState = "open" | "template_required" | "unknown";

export type WhatsAppConversationRecord = {
  id: string;
  brand_id: string;
  connection_id: string;
  lead_id: string | null;
  customer_phone: string;
  customer_name: string | null;
  status: string;
  unread_count: number;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  service_window_expires_at: string | null;
  assigned_user_id: string | null;
  linked_at: string | null;
  linked_by: string | null;
  created_at: string;
  updated_at: string;
};

export type WhatsAppTemplateRecord = {
  id: string;
  brand_id: string;
  connection_id: string | null;
  template_name: string;
  language_code: string;
  status: string;
  category: string | null;
  components: unknown;
  provider_template_id: string | null;
  is_stale: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WhatsAppThreadMessage = {
  id: string;
  conversation_id: string | null;
  lead_id: string | null;
  direction: string;
  message_type: string;
  whatsapp_message_id: string | null;
  from_phone: string | null;
  to_phone: string | null;
  body: string | null;
  template_name: string | null;
  status: string | null;
  raw_payload: Record<string, unknown> | null;
  sent_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type WhatsAppInboxRow = WhatsAppConversationRecord & {
  brand_name: string;
  lead_status: string | null;
  service_window_state: WhatsAppServiceWindowState;
  needs_reply: boolean;
};

type UpsertConversationInput = {
  brandId: string;
  connectionId: string;
  leadId?: string | null;
  customerPhone: string;
  customerName?: string | null;
  direction: "inbound" | "outbound";
  body?: string | null;
  messageAt?: string | null;
};

const STATUS_RANK: Record<string, number> = {
  queued: 0,
  accepted: 1,
  sent: 2,
  delivered: 3,
  read: 4,
  failed: 99,
};

function clean(value: unknown, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isMissingTableError(error: { code?: string; message?: string } | null) {
  const message = error?.message?.toLowerCase() || "";
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    message.includes("whatsapp_conversations") ||
    message.includes("conversation_id")
  );
}

export function getWhatsAppServiceWindowState(
  lastInboundAt: string | null | undefined,
  now = new Date()
): WhatsAppServiceWindowState {
  if (!lastInboundAt) return "unknown";
  const inboundTime = new Date(lastInboundAt);
  if (Number.isNaN(inboundTime.getTime())) return "unknown";
  const expiresAt = new Date(
    inboundTime.getTime() + WHATSAPP_SERVICE_WINDOW_HOURS * 60 * 60 * 1000
  );
  return expiresAt.getTime() > now.getTime() ? "open" : "template_required";
}

export function getWhatsAppServiceWindowExpiry(lastInboundAt: string | null) {
  if (!lastInboundAt) return null;
  const inboundTime = new Date(lastInboundAt);
  if (Number.isNaN(inboundTime.getTime())) return null;
  return new Date(
    inboundTime.getTime() + WHATSAPP_SERVICE_WINDOW_HOURS * 60 * 60 * 1000
  ).toISOString();
}

export function shouldAdvanceWhatsAppStatus(currentStatus: string | null, nextStatus: string) {
  if (nextStatus === "failed") return currentStatus !== "read";
  if (currentStatus === "failed" || currentStatus === "read") return false;
  return (STATUS_RANK[nextStatus] ?? 0) >= (STATUS_RANK[currentStatus || "queued"] ?? 0);
}

export async function upsertWhatsAppConversation(input: UpsertConversationInput) {
  if (!hasSupabaseAdminEnv()) {
    return { ok: false, tableReady: false, conversationId: null as string | null };
  }

  const customerPhone = normalizeWhatsAppPhone(input.customerPhone);
  if (!customerPhone) {
    return { ok: false, tableReady: true, conversationId: null as string | null };
  }

  const supabase = createSupabaseAdminClient();
  const messageAt = input.messageAt || new Date().toISOString();
  const preview = clean(input.body || `[${input.direction} message]`, 240);
  const { data: existing, error: readError } = await supabase
    .from("whatsapp_conversations")
    .select("*")
    .eq("connection_id", input.connectionId)
    .eq("customer_phone", customerPhone)
    .maybeSingle();

  if (readError) {
    return {
      ok: false,
      tableReady: !isMissingTableError(readError),
      conversationId: null as string | null,
    };
  }

  const common = {
    brand_id: input.brandId,
    connection_id: input.connectionId,
    lead_id: input.leadId || existing?.lead_id || null,
    customer_phone: customerPhone,
    customer_name: clean(input.customerName, 160) || existing?.customer_name || null,
    status: existing?.status || "active",
    last_message_at: messageAt,
    last_message_preview: preview,
    updated_at: new Date().toISOString(),
  };

  const payload =
    input.direction === "inbound"
      ? {
          ...common,
          unread_count: Math.max(0, Number(existing?.unread_count || 0)) + 1,
          last_inbound_at: messageAt,
          service_window_expires_at: getWhatsAppServiceWindowExpiry(messageAt),
        }
      : {
          ...common,
          unread_count: Math.max(0, Number(existing?.unread_count || 0)),
          last_outbound_at: messageAt,
        };

  const query = existing?.id
    ? supabase
        .from("whatsapp_conversations")
        .update(payload)
        .eq("id", existing.id)
        .select("id")
        .single()
    : supabase
        .from("whatsapp_conversations")
        .insert(payload)
        .select("id")
        .single();

  const { data, error } = await query;
  if (error) {
    return {
      ok: false,
      tableReady: !isMissingTableError(error),
      conversationId: null as string | null,
    };
  }

  const healthUpdate =
    input.direction === "inbound"
      ? { last_webhook_at: messageAt, last_inbound_at: messageAt }
      : { last_outbound_at: messageAt };
  await supabase
    .from("whatsapp_connections")
    .update({ ...healthUpdate, updated_at: new Date().toISOString() })
    .eq("id", input.connectionId);

  return { ok: true, tableReady: true, conversationId: data.id as string };
}

export async function attachWhatsAppMessageToConversation(
  messageId: string,
  conversationId: string
) {
  if (!hasSupabaseAdminEnv() || !messageId || !conversationId) return;
  const supabase = createSupabaseAdminClient();
  await supabase
    .from("whatsapp_messages")
    .update({ conversation_id: conversationId, updated_at: new Date().toISOString() })
    .eq("id", messageId);
}

export async function getWhatsAppInbox({
  brandSlug = "ineffable",
  filter = "all",
  search = "",
  limit = 100,
}: {
  brandSlug?: string;
  filter?: string;
  search?: string;
  limit?: number;
}) {
  if (!hasSupabaseAdminEnv()) {
    return { ok: false, tableReady: false, rows: [] as WhatsAppInboxRow[], unreadCount: 0 };
  }

  const supabase = createSupabaseAdminClient();
  const { data: brand } = await supabase
    .from("brands")
    .select("id,name,slug")
    .eq("slug", brandSlug === "ineffable-beauty" ? "ineffable" : brandSlug)
    .maybeSingle();
  if (!brand) {
    return { ok: false, tableReady: true, rows: [] as WhatsAppInboxRow[], unreadCount: 0 };
  }

  let query = supabase
    .from("whatsapp_conversations")
    .select("*")
    .eq("brand_id", brand.id)
    .eq("status", filter === "archived" ? "archived" : "active")
    .order("unread_count", { ascending: false })
    .order("last_message_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 250));

  if (filter === "unread") query = query.gt("unread_count", 0);
  if (filter === "unmatched") query = query.is("lead_id", null);
  if (filter === "matched") query = query.not("lead_id", "is", null);
  if (search.trim()) {
    const safeSearch = search.trim().replace(/[,%()]/g, " ").slice(0, 120);
    query = query.or(
      `customer_phone.ilike.%${safeSearch}%,customer_name.ilike.%${safeSearch}%,last_message_preview.ilike.%${safeSearch}%`
    );
  }

  const { data, error } = await query;
  if (error) {
    return {
      ok: false,
      tableReady: !isMissingTableError(error),
      rows: [] as WhatsAppInboxRow[],
      unreadCount: 0,
    };
  }

  const conversations = (data || []) as WhatsAppConversationRecord[];
  const leadIds = conversations.map((item) => item.lead_id).filter(Boolean) as string[];
  const caseStatusByLeadId = new Map<string, string>();
  if (leadIds.length) {
    const { data: cases } = await supabase
      .from("crm_lead_cases")
      .select("source_lead_id,status")
      .in("source_lead_id", leadIds);
    for (const item of cases || []) {
      if (item.source_lead_id) caseStatusByLeadId.set(item.source_lead_id, item.status || "new");
    }
  }

  const rows = conversations.map((conversation) => {
    const serviceWindowState = getWhatsAppServiceWindowState(conversation.last_inbound_at);
    const lastInbound = conversation.last_inbound_at
      ? new Date(conversation.last_inbound_at).getTime()
      : 0;
    const lastOutbound = conversation.last_outbound_at
      ? new Date(conversation.last_outbound_at).getTime()
      : 0;
    return {
      ...conversation,
      brand_name: brand.name as string,
      lead_status: conversation.lead_id
        ? caseStatusByLeadId.get(conversation.lead_id) || "new"
        : null,
      service_window_state: serviceWindowState,
      needs_reply: lastInbound > lastOutbound,
    } satisfies WhatsAppInboxRow;
  });

  const unreadCount = rows.reduce((total, row) => total + Math.max(0, row.unread_count || 0), 0);
  return { ok: true, tableReady: true, rows, unreadCount };
}

export async function getWhatsAppConversationWorkspace(conversationId: string) {
  if (!hasSupabaseAdminEnv()) {
    return { ok: false, tableReady: false, conversation: null, messages: [], templates: [] };
  }
  const supabase = createSupabaseAdminClient();
  const { data: conversation, error } = await supabase
    .from("whatsapp_conversations")
    .select("*")
    .eq("id", conversationId)
    .maybeSingle();
  if (error || !conversation) {
    return {
      ok: false,
      tableReady: !isMissingTableError(error),
      conversation: null,
      messages: [] as WhatsAppThreadMessage[],
      templates: [] as WhatsAppTemplateRecord[],
    };
  }

  const [{ data: messages }, { data: templates }] = await Promise.all([
    supabase
      .from("whatsapp_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(500),
    supabase
      .from("whatsapp_templates")
      .select("*")
      .eq("brand_id", conversation.brand_id)
      .eq("status", "APPROVED")
      .eq("is_stale", false)
      .order("template_name", { ascending: true }),
  ]);

  return {
    ok: true,
    tableReady: true,
    conversation: conversation as WhatsAppConversationRecord,
    messages: (messages || []) as WhatsAppThreadMessage[],
    templates: (templates || []) as WhatsAppTemplateRecord[],
    serviceWindowState: getWhatsAppServiceWindowState(conversation.last_inbound_at),
  };
}

export async function markWhatsAppConversationRead(conversationId: string) {
  if (!hasSupabaseAdminEnv()) return { ok: false, message: "supabase_admin_not_configured" };
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("whatsapp_conversations")
    .update({ unread_count: 0, updated_at: new Date().toISOString() })
    .eq("id", conversationId);
  return { ok: !error, message: error ? "conversation_mark_read_failed" : "conversation_marked_read" };
}

export async function getUnreadWhatsAppCount(brandSlug = "ineffable") {
  const result = await getWhatsAppInbox({ brandSlug, filter: "unread", limit: 250 });
  return result.unreadCount;
}

export async function findLeadCandidatesForConversation(conversationId: string) {
  if (!hasSupabaseAdminEnv()) return [];
  const supabase = createSupabaseAdminClient();
  const { data: conversation } = await supabase
    .from("whatsapp_conversations")
    .select("id,brand_id,customer_phone")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conversation) return [];

  const phone = normalizeWhatsAppPhone(conversation.customer_phone || "");
  const variants = Array.from(
    new Set([phone, phone.startsWith("852") ? phone.slice(3) : phone].filter(Boolean))
  );

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id,name,phone,normalized_phone")
    .in("normalized_phone", variants);
  const contactIds = (contacts || []).map((item) => item.id);
  if (!contactIds.length) return [];

  const { data: leads } = await supabase
    .from("leads")
    .select("id,brand_id,contact_id,created_at")
    .eq("brand_id", conversation.brand_id)
    .in("contact_id", contactIds)
    .order("created_at", { ascending: false })
    .limit(20);
  const contactById = new Map((contacts || []).map((item) => [item.id, item]));
  return (leads || []).map((lead) => ({
    id: lead.id as string,
    created_at: lead.created_at as string,
    contact: contactById.get(lead.contact_id),
  }));
}

export async function linkWhatsAppConversationToLead({
  conversationId,
  leadId,
  linkedBy,
}: {
  conversationId: string;
  leadId: string;
  linkedBy: string;
}) {
  if (!hasSupabaseAdminEnv()) return { ok: false, message: "supabase_admin_not_configured" };
  const supabase = createSupabaseAdminClient();
  const [{ data: conversation }, { data: lead }] = await Promise.all([
    supabase
      .from("whatsapp_conversations")
      .select("id,brand_id,customer_phone")
      .eq("id", conversationId)
      .maybeSingle(),
    supabase.from("leads").select("id,brand_id").eq("id", leadId).maybeSingle(),
  ]);

  if (!conversation || !lead) return { ok: false, message: "conversation_or_lead_not_found" };
  if (conversation.brand_id !== lead.brand_id) {
    return { ok: false, message: "cross_brand_link_blocked" };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("whatsapp_conversations")
    .update({ lead_id: leadId, linked_at: now, linked_by: clean(linkedBy, 160), updated_at: now })
    .eq("id", conversationId);
  if (error) return { ok: false, message: "conversation_link_failed" };

  await supabase
    .from("whatsapp_messages")
    .update({ lead_id: leadId, updated_at: now })
    .eq("conversation_id", conversationId)
    .is("lead_id", null);

  await createConversationTimelineEntry({
    leadId,
    body: `WhatsApp conversation linked: ${conversation.customer_phone}`,
    interactionType: "whatsapp_conversation_linked",
    metadata: { conversation_id: conversationId, linked_by: linkedBy },
  });

  return { ok: true, message: "conversation_linked" };
}

export async function syncWhatsAppTemplates(connectionId: string) {
  if (!hasSupabaseAdminEnv()) return { ok: false, message: "supabase_admin_not_configured" };
  const supabase = createSupabaseAdminClient();
  const { data: connection } = await supabase
    .from("whatsapp_connections")
    .select("*")
    .eq("id", connectionId)
    .maybeSingle();
  if (!connection) return { ok: false, message: "whatsapp_connection_missing" };

  const typedConnection = connection as WhatsAppConnectionRecord;
  const token = decryptConnectionAccessToken(typedConnection);
  if (!token) return { ok: false, message: "access_token_unavailable" };
  if (!typedConnection.waba_id) return { ok: false, message: "waba_id_missing" };

  const graphVersion = typedConnection.graph_api_version || DEFAULT_GRAPH_API_VERSION;
  let nextUrl: string | null = `https://graph.facebook.com/${graphVersion}/${typedConnection.waba_id}/message_templates?fields=id,name,status,category,language,components&limit=100`;
  const templates: Array<Record<string, unknown>> = [];
  let pageCount = 0;

  while (nextUrl && pageCount < 10) {
    pageCount += 1;
    const response = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok || !payload) {
      await supabase
        .from("whatsapp_connections")
        .update({ last_error: `template_sync_failed_${response.status}`, updated_at: new Date().toISOString() })
        .eq("id", connectionId);
      return { ok: false, message: "template_sync_failed", status: response.status };
    }
    const data = Array.isArray(payload.data) ? payload.data : [];
    templates.push(...(data as Array<Record<string, unknown>>));
    const paging = (payload.paging || {}) as Record<string, unknown>;
    const next = typeof paging.next === "string" ? paging.next : "";
    nextUrl = next || null;
  }

  const syncedAt = new Date().toISOString();
  await supabase
    .from("whatsapp_templates")
    .update({ is_stale: true, updated_at: syncedAt })
    .eq("connection_id", connectionId);

  for (const template of templates) {
    const name = clean(template.name, 240);
    const language = clean(template.language, 40) || "zh_HK";
    if (!name) continue;
    await supabase.from("whatsapp_templates").upsert(
      {
        brand_id: typedConnection.brand_id,
        connection_id: connectionId,
        provider_template_id: clean(template.id, 160) || null,
        template_name: name,
        language_code: language,
        status: clean(template.status, 80) || "UNKNOWN",
        category: clean(template.category, 80) || null,
        components: template.components || [],
        is_stale: false,
        last_synced_at: syncedAt,
        updated_at: syncedAt,
      },
      { onConflict: "connection_id,template_name,language_code" }
    );
  }

  await supabase
    .from("whatsapp_connections")
    .update({ last_template_sync_at: syncedAt, last_error: null, updated_at: syncedAt })
    .eq("id", connectionId);

  return { ok: true, message: "templates_synced", count: templates.length };
}

export async function sendWhatsAppTemplateMessage({
  brandId,
  conversationId,
  leadId = null,
  templateId,
  variables = [],
  sentByUserId = null,
}: {
  brandId: string;
  conversationId: string;
  leadId?: string | null;
  templateId: string;
  variables?: string[];
  sentByUserId?: string | null;
}) {
  if (!hasSupabaseAdminEnv()) return { ok: false, message: "supabase_admin_not_configured" };
  const supabase = createSupabaseAdminClient();
  const [{ data: conversation }, { data: template }] = await Promise.all([
    supabase
      .from("whatsapp_conversations")
      .select("*")
      .eq("id", conversationId)
      .eq("brand_id", brandId)
      .maybeSingle(),
    supabase
      .from("whatsapp_templates")
      .select("*")
      .eq("id", templateId)
      .eq("brand_id", brandId)
      .eq("status", "APPROVED")
      .eq("is_stale", false)
      .maybeSingle(),
  ]);
  if (!conversation) return { ok: false, message: "conversation_not_found" };
  if (!template) return { ok: false, message: "approved_template_required" };

  const connection = await getWhatsAppConnectionByBrandId(brandId, conversation.connection_id);
  if (!connection) return { ok: false, message: "whatsapp_connection_missing" };
  const token = decryptConnectionAccessToken(connection);
  if (!token) return { ok: false, message: "access_token_unavailable" };

  const normalizedTo = normalizeWhatsAppPhone(conversation.customer_phone || "");
  if (!normalizedTo) return { ok: false, message: "valid_phone_required" };
  const graphVersion = connection.graph_api_version || DEFAULT_GRAPH_API_VERSION;
  const endpoint = `https://graph.facebook.com/${graphVersion}/${connection.phone_number_id}/messages`;
  const safeVariables = variables.map((item) => clean(item, 1000)).filter(Boolean);
  const components = safeVariables.length
    ? [
        {
          type: "body",
          parameters: safeVariables.map((text) => ({ type: "text", text })),
        },
      ]
    : undefined;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizedTo,
      type: "template",
      template: {
        name: template.template_name,
        language: { code: template.language_code },
        ...(components ? { components } : {}),
      },
    }),
  });
  const responseJson = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    return { ok: false, message: "meta_template_send_failed", status: response.status };
  }

  const responseMessages = Array.isArray(responseJson?.messages) ? responseJson?.messages : [];
  const firstMessage = responseMessages[0] as Record<string, unknown> | undefined;
  const providerMessageId = typeof firstMessage?.id === "string" ? firstMessage.id : null;
  const summary = `[Template] ${template.template_name}${safeVariables.length ? ` · ${safeVariables.join(" | ")}` : ""}`;
  const { data: inserted } = await supabase
    .from("whatsapp_messages")
    .insert({
      brand_id: brandId,
      lead_id: leadId || conversation.lead_id || null,
      connection_id: connection.id,
      conversation_id: conversationId,
      direction: "outbound",
      message_type: "template",
      whatsapp_message_id: providerMessageId,
      from_phone: connection.display_phone_number,
      to_phone: normalizedTo,
      body: summary,
      template_name: template.template_name,
      status: "sent",
      raw_payload: responseJson || {},
      sent_by_user_id: sentByUserId,
    })
    .select("id,created_at")
    .single();

  await upsertWhatsAppConversation({
    brandId,
    connectionId: connection.id,
    leadId: leadId || conversation.lead_id || null,
    customerPhone: normalizedTo,
    customerName: conversation.customer_name,
    direction: "outbound",
    body: summary,
    messageAt: inserted?.created_at || new Date().toISOString(),
  });

  if (leadId || conversation.lead_id) {
    await createConversationTimelineEntry({
      leadId: leadId || conversation.lead_id,
      body: summary,
      interactionType: "whatsapp_template_outbound",
      metadata: {
        conversation_id: conversationId,
        template_name: template.template_name,
        whatsapp_message_id: providerMessageId,
      },
    });
  }

  return { ok: true, message: "template_sent", whatsapp_message_id: providerMessageId };
}

export async function recordWhatsAppMessageStatus({
  whatsappMessageId,
  status,
  rawPayload,
}: {
  whatsappMessageId: string;
  status: string;
  rawPayload: Record<string, unknown>;
}) {
  if (!hasSupabaseAdminEnv() || !whatsappMessageId) return { ok: false };
  const supabase = createSupabaseAdminClient();
  const { data: message } = await supabase
    .from("whatsapp_messages")
    .select("id,status")
    .eq("whatsapp_message_id", whatsappMessageId)
    .maybeSingle();
  if (!message) return { ok: true, skipped: "message_not_found" };

  if (shouldAdvanceWhatsAppStatus(message.status, status)) {
    await supabase
      .from("whatsapp_messages")
      .update({ status, raw_payload: rawPayload, updated_at: new Date().toISOString() })
      .eq("id", message.id);
  }

  const { data: existingEvent } = await supabase
    .from("whatsapp_message_events")
    .select("id")
    .eq("message_id", message.id)
    .eq("event_type", "status")
    .eq("status", status)
    .limit(1)
    .maybeSingle();
  if (!existingEvent) {
    await supabase.from("whatsapp_message_events").insert({
      message_id: message.id,
      event_type: "status",
      status,
      raw_payload: rawPayload,
    });
  }
  return { ok: true };
}

async function createConversationTimelineEntry({
  leadId,
  body,
  interactionType,
  metadata,
}: {
  leadId: string | null;
  body: string;
  interactionType: string;
  metadata: Record<string, unknown>;
}) {
  if (!leadId || !hasSupabaseAdminEnv()) return;
  try {
    const supabase = createSupabaseAdminClient();
    const { data: leadCase } = await supabase
      .from("crm_lead_cases")
      .select("id,contact_id")
      .eq("source_lead_id", leadId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!leadCase?.id || !leadCase.contact_id) return;
    await createCrmInteraction({
      caseId: leadCase.id,
      contactId: leadCase.contact_id,
      interactionType,
      direction: "internal",
      body,
      author: "admin",
      sourceType: "whatsapp",
      metadata,
      operation: "whatsapp phase2b timeline insert failed",
    });
  } catch (error) {
    console.warn("whatsapp_phase2b_timeline_insert_skipped", safeError(error));
  }
}
