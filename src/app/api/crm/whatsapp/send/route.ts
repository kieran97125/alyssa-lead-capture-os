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

  const leadId = stringValue(body.lead_id);
  const explicitBrandId = stringValue(body.brand_id);
  const messageBody = stringValue(body.body, 4000);
  const connectionId = stringValue(body.connection_id) || null;

  if (!leadId && !explicitBrandId) {
    return NextResponse.json(
      { ok: false, error: "lead_id_or_brand_id_required" },
      { status: 400 }
    );
  }

  if (!messageBody) {
    return NextResponse.json(
      { ok: false, error: "message_body_required" },
      { status: 400 }
    );
  }

  const leadContext = leadId ? await getLeadSendContext(leadId) : null;
  const brandId = explicitBrandId || leadContext?.brand_id || "";
  const toPhone = stringValue(body.to_phone) || leadContext?.phone || "";

  const result = await sendWhatsAppTextMessage({
    brandId,
    leadId: leadId || null,
    connectionId,
    toPhone,
    body: messageBody,
  });

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
