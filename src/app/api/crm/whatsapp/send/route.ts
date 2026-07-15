import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  adminSessionCookieName,
  verifySignedAdminSession,
} from "@/lib/security/internalAccess";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";
import { sendWhatsAppTextMessage } from "@/lib/crm/whatsapp";
import {
  attachWhatsAppMessageToConversation,
  getWhatsAppConversationWorkspace,
  sendWhatsAppTemplateMessage,
  upsertWhatsAppConversation,
} from "@/lib/crm/whatsappInbox";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const session = await verifySignedAdminSession(
    cookieStore.get(adminSessionCookieName)?.value
  );

  if (!session.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const mode = stringValue(body.mode, 40) || "text";
  const leadId = stringValue(body.lead_id);
  const explicitBrandId = stringValue(body.brand_id);
  const conversationId = stringValue(body.conversation_id) || null;
  const connectionId = stringValue(body.connection_id) || null;

  if (!leadId && !explicitBrandId && !conversationId) {
    return NextResponse.json(
      { ok: false, error: "lead_id_brand_id_or_conversation_id_required" },
      { status: 400 }
    );
  }

  const conversationWorkspace = conversationId
    ? await getWhatsAppConversationWorkspace(conversationId)
    : null;
  const conversation = conversationWorkspace?.conversation || null;
  const leadContext = leadId ? await getLeadSendContext(leadId) : null;
  const brandId = explicitBrandId || conversation?.brand_id || leadContext?.brand_id || "";
  const resolvedLeadId = leadId || conversation?.lead_id || null;

  if (mode === "template") {
    if (!conversationId) {
      return NextResponse.json(
        { ok: false, error: "conversation_id_required_for_template" },
        { status: 400 }
      );
    }
    const templateId = stringValue(body.template_id, 100);
    if (!templateId) {
      return NextResponse.json(
        { ok: false, error: "template_id_required" },
        { status: 400 }
      );
    }
    const variables = Array.isArray(body.variables)
      ? body.variables.map((value) => stringValue(value, 1000)).filter(Boolean)
      : [];
    const result = await sendWhatsAppTemplateMessage({
      brandId,
      conversationId,
      leadId: resolvedLeadId,
      templateId,
      variables,
      sentByUserId: "admin",
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }

  if (mode !== "text") {
    return NextResponse.json({ ok: false, error: "unsupported_send_mode" }, { status: 400 });
  }

  const messageBody = stringValue(body.body, 4000);
  if (!messageBody) {
    return NextResponse.json(
      { ok: false, error: "message_body_required" },
      { status: 400 }
    );
  }

  // First contact and closed/unknown service windows require an approved template.
  if (!conversation || conversationWorkspace?.serviceWindowState !== "open") {
    return NextResponse.json(
      {
        ok: false,
        error: "template_required",
        service_window_state:
          conversationWorkspace?.serviceWindowState || "unknown",
      },
      { status: 400 }
    );
  }

  const toPhone =
    stringValue(body.to_phone) || conversation.customer_phone || leadContext?.phone || "";
  const result = await sendWhatsAppTextMessage({
    brandId,
    leadId: resolvedLeadId,
    connectionId: connectionId || conversation.connection_id,
    toPhone,
    body: messageBody,
    sentByUserId: "admin",
  });

  if (result.ok && result.whatsapp_message_id) {
    const conversationUpdate = await upsertWhatsAppConversation({
      brandId,
      connectionId: connection.connection_id,
      leadId: resolvedLeadId,
      customerPhone: toPhone,
      customerName: conversation.customer_name,
      direction: "outbound",
      body: messageBody,
    });
    if (conversationUpdate.conversationId && hasSupabaseAdminEnv()) {
      const supabase = createSupabaseAdminClient();
      const { data: message } = await supabase
        .from("whatsapp_messages")
        .select("id")
        .eq("whatsapp_message_id", result.whatsapp_message_id)
        .maybeSingle();
      if (message?.id) {
        await attachWhatsAppMessageToConversation(
          message.id,
          conversationUpdate.conversationId
        );
      }
    }
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

async function getLeadSendContext(leadId: string) {
  if (!hasSupabaseAdminEnv()) return null;
  const supabase = createSupabaseAdminClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("id,brand_id,phone,normalized_phone,contact_id")
    .eq("id", leadId)
    .maybeSingle();

  if (!lead) return null;
  if (lead.normalized_phone || lead.phone) {
    return {
      brand_id: lead.brand_id as string,
      phone: (lead.normalized_phone || lead.phone || "") as string,
    };
  }

  if (!lead.contact_id) {
    return { brand_id: lead.brand_id as string, phone: "" };
  }

  const { data: contact } = await supabase
    .from("contacts")
    .select("phone,normalized_phone")
    .eq("id", lead.contact_id)
    .maybeSingle();

  return {
    brand_id: lead.brand_id as string,
    phone: ((contact?.normalized_phone || contact?.phone || "") as string) || "",
  };
}

function stringValue(value: unknown, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}
