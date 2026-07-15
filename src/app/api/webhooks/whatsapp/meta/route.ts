import { NextRequest, NextResponse } from "next/server";
import {
  decryptConnectionAppSecret,
  findLeadIdByPhone,
  getWhatsAppConnectionByPhoneNumberId,
  insertWhatsAppMessage,
  markWhatsAppConnectionVerified,
  normalizeWhatsAppPhone,
  verifyMetaSignature,
} from "@/lib/crm/whatsapp";
import {
  attachWhatsAppMessageToConversation,
  recordWhatsAppMessageStatus,
  upsertWhatsAppConversation,
} from "@/lib/crm/whatsappInbox";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  if (mode !== "subscribe" || !token || !challenge) {
    return NextResponse.json({ ok: false, error: "invalid_verification" }, { status: 400 });
  }

  const connection = await findConnectionByVerifyToken(token);
  const envToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim() || "";

  if (connection) {
    await markWhatsAppConnectionVerified(connection.id);
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  if (envToken && token === envToken) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return NextResponse.json({ ok: false, error: "verify_token_mismatch" }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const payload = safeJson(rawBody);
  if (!payload) {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  const results: Array<Record<string, unknown>> = [];

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = asRecord(change?.value);
      const metadata = asRecord(value.metadata);
      const phoneNumberId = stringValue(metadata.phone_number_id);
      const connection = phoneNumberId
        ? await getWhatsAppConnectionByPhoneNumberId(phoneNumberId)
        : null;

      if (!connection) {
        results.push({ ok: true, skipped: "connection_not_found", phoneNumberId });
        continue;
      }

      const appSecret = decryptConnectionAppSecret(connection);
      const signatureOk = verifyMetaSignature({
        body: rawBody,
        signatureHeader: request.headers.get("x-hub-signature-256"),
        appSecret,
      });

      if (!signatureOk && process.env.NODE_ENV === "production") {
        return NextResponse.json(
          { ok: false, error: "invalid_signature" },
          { status: 401 }
        );
      }

      if (!signatureOk) {
        console.warn("whatsapp_webhook_signature_not_verified", {
          phone_number_id: phoneNumberId,
          reason: appSecret ? "signature_mismatch" : "app_secret_missing",
        });
      }

      const messages = Array.isArray(value.messages) ? value.messages : [];
      for (const message of messages) {
        results.push(await handleInboundMessage(connection, message, value));
      }

      const statuses = Array.isArray(value.statuses) ? value.statuses : [];
      for (const status of statuses) {
        const messageId = stringValue(status?.id);
        const nextStatus = stringValue(status?.status) || "unknown";
        if (messageId) {
          await recordWhatsAppMessageStatus({
            whatsappMessageId: messageId,
            status: nextStatus,
            rawPayload: status,
          });
        }
        results.push({ ok: true, status_update: nextStatus, whatsapp_message_id: messageId });
      }

      if (hasSupabaseAdminEnv()) {
        const supabase = createSupabaseAdminClient();
        await supabase
          .from("whatsapp_connections")
          .update({
            last_webhook_at: new Date().toISOString(),
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", connection.id);
      }
    }
  }

  return NextResponse.json({ ok: true, results });
}

async function findConnectionByVerifyToken(token: string) {
  if (!hasSupabaseAdminEnv()) return null;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("whatsapp_connections")
    .select("*")
    .eq("verify_token", token)
    .maybeSingle();

  if (error) return null;
  return data as { id: string } | null;
}

async function handleInboundMessage(
  connection: {
    id: string;
    brand_id: string;
    display_phone_number: string | null;
  },
  message: Record<string, unknown>,
  value: Record<string, unknown>
) {
  const fromPhone = stringValue(message.from);
  const normalizedPhone = normalizeWhatsAppPhone(fromPhone);
  const leadId = await findLeadIdByPhone(normalizedPhone);
  const parsed = parseMessage(message);
  const customerName = getCustomerName(value, fromPhone);
  const timestamp = parseMetaTimestamp(stringValue(message.timestamp));

  const inserted = await insertWhatsAppMessage({
    brand_id: connection.brand_id,
    lead_id: leadId,
    connection_id: connection.id,
    direction: "inbound",
    message_type: parsed.type,
    whatsapp_message_id: stringValue(message.id),
    from_phone: normalizedPhone || fromPhone,
    to_phone:
      stringValue(asRecord(value.metadata).display_phone_number) ||
      connection.display_phone_number,
    body: parsed.body,
    template_name: null,
    status: "received",
    raw_payload: message,
    sent_by_user_id: null,
  });

  const conversation = await upsertWhatsAppConversation({
    brandId: connection.brand_id,
    connectionId: connection.id,
    leadId,
    customerPhone: normalizedPhone || fromPhone,
    customerName,
    direction: "inbound",
    body: parsed.body,
    messageAt: timestamp,
  });

  const insertedMessageId =
    inserted.ok && inserted.data && typeof inserted.data.id === "string"
      ? inserted.data.id
      : "";
  if (insertedMessageId && conversation.conversationId) {
    await attachWhatsAppMessageToConversation(
      insertedMessageId,
      conversation.conversationId
    );
  }

  return {
    ok: inserted.ok,
    tableReady: inserted.tableReady && conversation.tableReady,
    lead_id: leadId,
    conversation_id: conversation.conversationId,
    from_phone: normalizedPhone || fromPhone,
    message_type: parsed.type,
    message: inserted.message,
  };
}

function parseMessage(message: Record<string, unknown>) {
  const type = stringValue(message.type) || "unknown";
  if (type === "text") {
    const text = asRecord(message.text);
    return { type, body: stringValue(text.body) || "" };
  }
  if (type === "interactive") {
    const interactive = asRecord(message.interactive);
    const buttonReply = asRecord(interactive.button_reply);
    const listReply = asRecord(interactive.list_reply);
    const label =
      stringValue(buttonReply.title) ||
      stringValue(listReply.title) ||
      stringValue(listReply.description);
    return { type, body: label || "[interactive message]" };
  }
  if (type === "location") {
    const location = asRecord(message.location);
    const label = [stringValue(location.name), stringValue(location.address)]
      .filter(Boolean)
      .join(" · ");
    return { type, body: label ? `[location] ${label}` : "[location message]" };
  }
  if (type === "image") return { type, body: "[image message]" };
  if (type === "document") return { type, body: "[document message]" };
  if (type === "audio") return { type, body: "[audio message]" };
  if (type === "video") return { type, body: "[video message]" };
  if (type === "contacts") return { type, body: "[contacts message]" };
  return { type: "unknown", body: `[${type || "unknown"} message]` };
}

function getCustomerName(value: Record<string, unknown>, fromPhone: string) {
  const contacts = Array.isArray(value.contacts) ? value.contacts : [];
  const matched = contacts.find((contact) => {
    const record = asRecord(contact);
    return !fromPhone || stringValue(record.wa_id) === fromPhone;
  });
  const profile = asRecord(asRecord(matched).profile);
  return stringValue(profile.name) || null;
}

function parseMetaTimestamp(value: string) {
  if (!value) return new Date().toISOString();
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return new Date().toISOString();
  return new Date(seconds * 1000).toISOString();
}

function safeJson(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
