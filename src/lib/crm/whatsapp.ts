import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/attribution/classify";
import {
  decryptWhatsAppSecret,
  encryptWhatsAppSecret,
  getWhatsAppCredentialKeyStatus,
} from "@/lib/crm/whatsappCrypto";
import { createCrmInteraction, safeError } from "@/lib/crm/store";

export const WHATSAPP_PROVIDER_META = "meta_whatsapp_cloud_api";
export const WHATSAPP_WEBHOOK_PATH = "/api/webhooks/whatsapp/meta";
export const DEFAULT_GRAPH_API_VERSION = "v21.0";

export type WhatsAppConnectionStatus =
  | "not_configured"
  | "saved"
  | "webhook_verified"
  | "test_succeeded"
  | "error";

export type WhatsAppConnectionRecord = {
  id: string;
  brand_id: string;
  provider: string;
  status: WhatsAppConnectionStatus | string;
  waba_id: string | null;
  phone_number_id: string | null;
  display_phone_number: string | null;
  app_id: string | null;
  app_secret_encrypted: string | null;
  access_token_encrypted: string | null;
  verify_token: string | null;
  webhook_url: string | null;
  graph_api_version: string | null;
  default_send_mode: string | null;
  last_verified_at: string | null;
  last_tested_at: string | null;
  last_error: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type WhatsAppMessageRecord = {
  id: string;
  brand_id: string;
  lead_id: string | null;
  connection_id: string | null;
  direction: "inbound" | "outbound" | string;
  message_type: string | null;
  whatsapp_message_id: string | null;
  from_phone: string | null;
  to_phone: string | null;
  body: string | null;
  template_name: string | null;
  status: string | null;
  raw_payload: Record<string, unknown> | null;
  sent_by_user_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type WhatsAppConnectionView = {
  ok: boolean;
  tableReady: boolean;
  brand: { id: string; name: string; slug: string } | null;
  connection: WhatsAppConnectionRecord | null;
  statusLabel: string;
  webhookUrl: string;
  verifyToken: string;
  encryptionConfigured: boolean;
  error: string | null;
};

type SaveConnectionInput = {
  brandId: string;
  provider: string;
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
  appId?: string;
  appSecret?: string;
  accessToken?: string;
  verifyToken: string;
  graphApiVersion?: string;
  defaultSendMode?: string;
};

function clean(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function isMissingTableError(error: { code?: string; message?: string } | null) {
  const message = error?.message?.toLowerCase() || "";
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    message.includes("whatsapp_connections") ||
    message.includes("whatsapp_messages")
  );
}

export function getWhatsAppWebhookUrl() {
  const base =
    process.env.NEXT_PUBLIC_ADMIN_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://go.beautytrialhk.com";

  try {
    return new URL(WHATSAPP_WEBHOOK_PATH, base).toString();
  } catch {
    return `https://go.beautytrialhk.com${WHATSAPP_WEBHOOK_PATH}`;
  }
}

export function getWhatsAppConnectionStatusLabel(
  status: string | null | undefined
) {
  const labels: Record<string, string> = {
    not_configured: "Not configured",
    saved: "Saved",
    webhook_verified: "Webhook verified",
    test_succeeded: "Test send succeeded",
    error: "Needs attention",
  };

  return labels[status || "not_configured"] || "Saved";
}

export async function getWhatsAppConnectionByBrandSlug(
  brandSlug = "ineffable"
): Promise<WhatsAppConnectionView> {
  const webhookUrl = getWhatsAppWebhookUrl();
  const encryptionStatus = getWhatsAppCredentialKeyStatus();
  const normalizedBrandSlug =
    brandSlug === "ineffable-beauty" ? "ineffable" : brandSlug;

  if (!hasSupabaseAdminEnv()) {
    return {
      ok: false,
      tableReady: false,
      brand: null,
      connection: null,
      statusLabel: "Supabase admin not configured",
      webhookUrl,
      verifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "",
      encryptionConfigured: encryptionStatus.configured,
      error: "supabase_admin_not_configured",
    };
  }

  const supabase = createSupabaseAdminClient();
  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select("id,name,slug")
    .eq("slug", normalizedBrandSlug)
    .maybeSingle();

  if (brandError || !brand) {
    return {
      ok: false,
      tableReady: false,
      brand: null,
      connection: null,
      statusLabel: "Brand not found",
      webhookUrl,
      verifyToken: "",
      encryptionConfigured: encryptionStatus.configured,
      error: "brand_not_found",
    };
  }

  const { data: connection, error } = await supabase
    .from("whatsapp_connections")
    .select("*")
    .eq("brand_id", brand.id)
    .eq("provider", WHATSAPP_PROVIDER_META)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      tableReady: !isMissingTableError(error),
      brand,
      connection: null,
      statusLabel: isMissingTableError(error)
        ? "SQL migration not applied"
        : "Needs attention",
      webhookUrl,
      verifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "",
      encryptionConfigured: encryptionStatus.configured,
      error: isMissingTableError(error) ? "table_missing" : "connection_read_failed",
    };
  }

  return {
    ok: true,
    tableReady: true,
    brand,
    connection: (connection as WhatsAppConnectionRecord | null) ?? null,
    statusLabel: getWhatsAppConnectionStatusLabel(connection?.status),
    webhookUrl: connection?.webhook_url || webhookUrl,
    verifyToken:
      connection?.verify_token || process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "",
    encryptionConfigured: encryptionStatus.configured,
    error: null,
  };
}

export async function saveWhatsAppConnection(input: SaveConnectionInput) {
  const provider = clean(input.provider, 80) || WHATSAPP_PROVIDER_META;
  const brandId = clean(input.brandId, 80);
  const wabaId = clean(input.wabaId, 120);
  const phoneNumberId = clean(input.phoneNumberId, 120);
  const displayPhoneNumber = clean(input.displayPhoneNumber, 80);
  const verifyToken = clean(input.verifyToken, 200);
  const appId = clean(input.appId, 120) || null;
  const graphApiVersion =
    clean(input.graphApiVersion, 30) || DEFAULT_GRAPH_API_VERSION;
  const defaultSendMode =
    clean(input.defaultSendMode, 80) || "template_required_for_first_contact";
  const appSecret = clean(input.appSecret, 5000);
  const accessToken = clean(input.accessToken, 5000);

  if (!brandId) return { ok: false, message: "brand_required" };
  if (provider !== WHATSAPP_PROVIDER_META) {
    return { ok: false, message: "provider_not_supported" };
  }
  if (!wabaId || !phoneNumberId || !displayPhoneNumber || !verifyToken) {
    return { ok: false, message: "required_fields_missing" };
  }
  if (!hasSupabaseAdminEnv()) {
    return { ok: false, message: "supabase_admin_not_configured" };
  }

  const supabase = createSupabaseAdminClient();
  const { data: existing, error: readError } = await supabase
    .from("whatsapp_connections")
    .select("*")
    .eq("brand_id", brandId)
    .eq("provider", provider)
    .maybeSingle();

  if (readError) {
    return {
      ok: false,
      message: isMissingTableError(readError)
        ? "whatsapp_tables_not_applied"
        : "connection_read_failed",
    };
  }

  if (!existing && (!appSecret || !accessToken)) {
    return { ok: false, message: "secrets_required_for_new_connection" };
  }

  let appSecretEncrypted = existing?.app_secret_encrypted ?? null;
  let accessTokenEncrypted = existing?.access_token_encrypted ?? null;

  try {
    if (appSecret) appSecretEncrypted = encryptWhatsAppSecret(appSecret);
    if (accessToken) accessTokenEncrypted = encryptWhatsAppSecret(accessToken);
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error && error.message === "whatsapp_encryption_key_missing"
          ? "whatsapp_encryption_key_missing"
          : "secret_encryption_failed",
    };
  }

  const payload = {
    brand_id: brandId,
    provider,
    status: existing?.status || "saved",
    waba_id: wabaId,
    phone_number_id: phoneNumberId,
    display_phone_number: displayPhoneNumber,
    app_id: appId,
    app_secret_encrypted: appSecretEncrypted,
    access_token_encrypted: accessTokenEncrypted,
    verify_token: verifyToken,
    webhook_url: getWhatsAppWebhookUrl(),
    graph_api_version: graphApiVersion,
    default_send_mode: defaultSendMode,
    last_error: null,
    updated_at: new Date().toISOString(),
  };

  const query = existing
    ? supabase.from("whatsapp_connections").update(payload).eq("id", existing.id)
    : supabase.from("whatsapp_connections").insert(payload);
  const { error: writeError } = await query;

  if (writeError) {
    return { ok: false, message: "connection_save_failed" };
  }

  return { ok: true, message: "connection_saved" };
}

export async function getWhatsAppConnectionByPhoneNumberId(
  phoneNumberId: string
) {
  if (!hasSupabaseAdminEnv()) return null;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("whatsapp_connections")
    .select("*")
    .eq("phone_number_id", phoneNumberId)
    .maybeSingle();

  if (error) return null;
  return (data as WhatsAppConnectionRecord | null) ?? null;
}

export async function markWhatsAppConnectionVerified(connectionId: string) {
  if (!hasSupabaseAdminEnv()) return;
  const supabase = createSupabaseAdminClient();
  await supabase
    .from("whatsapp_connections")
    .update({
      status: "webhook_verified",
      last_verified_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId);
}

export function verifyMetaSignature({
  body,
  signatureHeader,
  appSecret,
}: {
  body: string;
  signatureHeader: string | null;
  appSecret: string | null;
}) {
  if (!appSecret || !signatureHeader?.startsWith("sha256=")) return false;
  const digest = createHmac("sha256", appSecret).update(body).digest("hex");
  const expected = Buffer.from(`sha256=${digest}`);
  const actual = Buffer.from(signatureHeader);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function decryptConnectionAccessToken(connection: WhatsAppConnectionRecord) {
  return decryptWhatsAppSecret(connection.access_token_encrypted);
}

export function decryptConnectionAppSecret(connection: WhatsAppConnectionRecord) {
  return decryptWhatsAppSecret(connection.app_secret_encrypted);
}

export async function findLeadIdByPhone(normalizedPhone: string) {
  if (!hasSupabaseAdminEnv() || !normalizedPhone) return null;
  const supabase = createSupabaseAdminClient();
  const { data: contact } = await supabase
    .from("contacts")
    .select("id")
    .eq("normalized_phone", normalizedPhone)
    .maybeSingle();
  const contactId = contact?.id;
  if (!contactId) return null;

  const { data: lead } = await supabase
    .from("leads")
    .select("id")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return lead?.id ?? null;
}

export async function insertWhatsAppMessage(
  input: Omit<WhatsAppMessageRecord, "id" | "created_at" | "updated_at">
) {
  if (!hasSupabaseAdminEnv()) {
    return { ok: false, tableReady: false, message: "supabase_admin_not_configured" };
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("whatsapp_messages")
    .insert({
      ...input,
      raw_payload: input.raw_payload ?? {},
    })
    .select("*")
    .single();

  if (error) {
    return {
      ok: false,
      tableReady: !isMissingTableError(error),
      message: isMissingTableError(error)
        ? "whatsapp_tables_not_applied"
        : "message_insert_failed",
    };
  }

  return { ok: true, tableReady: true, message: "message_inserted", data };
}

export async function getWhatsAppConnectionByBrandId(
  brandId: string,
  connectionId?: string | null
) {
  if (!hasSupabaseAdminEnv()) return null;
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("whatsapp_connections")
    .select("*")
    .eq("brand_id", brandId)
    .eq("provider", WHATSAPP_PROVIDER_META);

  if (connectionId) query = query.eq("id", connectionId);

  const { data, error } = await query
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return (data as WhatsAppConnectionRecord | null) ?? null;
}

export async function sendWhatsAppTextMessage({
  brandId,
  leadId = null,
  connectionId = null,
  toPhone,
  body,
  sentByUserId = null,
  markAsTest = false,
}: {
  brandId: string;
  leadId?: string | null;
  connectionId?: string | null;
  toPhone: string;
  body: string;
  sentByUserId?: string | null;
  markAsTest?: boolean;
}) {
  const safeBody = clean(body, 4000);
  const normalizedTo = normalizeWhatsAppPhone(toPhone);

  if (!brandId) return { ok: false, message: "brand_required" };
  if (!normalizedTo || normalizedTo.length < 10) {
    return { ok: false, message: "valid_phone_required" };
  }
  if (!safeBody) return { ok: false, message: "message_body_required" };

  const connection = await getWhatsAppConnectionByBrandId(brandId, connectionId);
  if (!connection) return { ok: false, message: "whatsapp_connection_missing" };

  const token = decryptConnectionAccessToken(connection);
  if (!token) return { ok: false, message: "access_token_unavailable" };
  if (!connection.phone_number_id) {
    return { ok: false, message: "phone_number_id_missing" };
  }

  const graphVersion = connection.graph_api_version || DEFAULT_GRAPH_API_VERSION;
  const endpoint = `https://graph.facebook.com/${graphVersion}/${connection.phone_number_id}/messages`;
  let responseJson: Record<string, unknown> | null = null;
  let responseStatus = 0;

  try {
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
        type: "text",
        text: { preview_url: false, body: safeBody },
      }),
    });
    responseStatus = response.status;
    responseJson = (await response.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;

    if (!response.ok) {
      await markWhatsAppConnectionError(connection.id, `send_failed_${response.status}`);
      return {
        ok: false,
        message: "meta_send_failed",
        status: response.status,
        response: responseJson,
      };
    }
  } catch (error) {
    await markWhatsAppConnectionError(connection.id, "send_request_failed");
    return {
      ok: false,
      message: "meta_send_request_failed",
      error: error instanceof Error ? error.message : "unknown_error",
    };
  }

  const whatsappMessageId = getMetaMessageId(responseJson);
  const inserted = await insertWhatsAppMessage({
    brand_id: brandId,
    lead_id: leadId,
    connection_id: connection.id,
    direction: "outbound",
    message_type: "text",
    whatsapp_message_id: whatsappMessageId,
    from_phone: connection.display_phone_number,
    to_phone: normalizedTo,
    body: safeBody,
    template_name: null,
    status: "sent",
    raw_payload: responseJson ?? {},
    sent_by_user_id: sentByUserId,
  });

  if (hasSupabaseAdminEnv()) {
    const supabase = createSupabaseAdminClient();
    await supabase
      .from("whatsapp_connections")
      .update({
        status: markAsTest ? "test_succeeded" : connection.status || "saved",
        last_tested_at: markAsTest ? new Date().toISOString() : connection.last_tested_at,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id);
  }

  if (leadId) {
    await createBestEffortWhatsAppTimelineEntry({
      leadId,
      body: safeBody,
      whatsappMessageId,
      connectionId: connection.id,
      toPhone: normalizedTo,
    });
  }

  return {
    ok: true,
    message: "message_sent",
    status: responseStatus,
    whatsapp_message_id: whatsappMessageId,
    saved: inserted.ok,
  };
}

export async function getWhatsAppMessagesForLead(leadId: string, limit = 20) {
  if (!hasSupabaseAdminEnv()) {
    return { ok: false, tableReady: false, messages: [] as WhatsAppMessageRecord[] };
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("whatsapp_messages")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return {
      ok: false,
      tableReady: !isMissingTableError(error),
      messages: [] as WhatsAppMessageRecord[],
    };
  }

  return {
    ok: true,
    tableReady: true,
    messages: ((data ?? []) as WhatsAppMessageRecord[]).reverse(),
  };
}

async function markWhatsAppConnectionError(connectionId: string, lastError: string) {
  if (!hasSupabaseAdminEnv()) return;
  const supabase = createSupabaseAdminClient();
  await supabase
    .from("whatsapp_connections")
    .update({
      status: "error",
      last_error: lastError,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId);
}

function getMetaMessageId(response: Record<string, unknown> | null) {
  const messages = response?.messages;
  if (!Array.isArray(messages)) return null;
  const first = messages[0] as Record<string, unknown> | undefined;
  return typeof first?.id === "string" ? first.id : null;
}

export async function updateWhatsAppMessageStatus(
  whatsappMessageId: string,
  status: string,
  rawPayload: Record<string, unknown>
) {
  if (!hasSupabaseAdminEnv() || !whatsappMessageId) return;
  const supabase = createSupabaseAdminClient();
  await supabase
    .from("whatsapp_messages")
    .update({
      status,
      raw_payload: rawPayload,
      updated_at: new Date().toISOString(),
    })
    .eq("whatsapp_message_id", whatsappMessageId);
}

export function normalizeWhatsAppPhone(value: string) {
  const normalized = normalizePhone(value);
  if (!normalized) return "";
  if (normalized.length === 8) return `852${normalized}`;
  return normalized;
}

async function createBestEffortWhatsAppTimelineEntry({
  leadId,
  body,
  whatsappMessageId,
  connectionId,
  toPhone,
}: {
  leadId: string;
  body: string;
  whatsappMessageId: string | null;
  connectionId: string;
  toPhone: string;
}) {
  if (!hasSupabaseAdminEnv()) return;

  try {
    const supabase = createSupabaseAdminClient();
    const { data: leadCase, error } = await supabase
      .from("crm_lead_cases")
      .select("id,contact_id")
      .eq("source_lead_id", leadId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !leadCase?.id || !leadCase.contact_id) return;

    await createCrmInteraction({
      caseId: leadCase.id,
      contactId: leadCase.contact_id,
      interactionType: "whatsapp_outbound",
      direction: "outbound",
      body,
      author: "admin",
      sourceType: "whatsapp",
      metadata: {
        action: "whatsapp_api_send",
        whatsapp_message_id: whatsappMessageId,
        whatsapp_connection_id: connectionId,
        to_phone: toPhone,
      },
      operation: "whatsapp timeline insert failed",
    });
  } catch (error) {
    console.warn("whatsapp_timeline_insert_skipped", safeError(error));
  }
}
