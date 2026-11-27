import { randomUUID } from "node:crypto";
import { after, NextResponse } from "next/server";
import { authenticGosWixWebhook, gosWixEvent, gosWixSheetPayload } from "@/lib/capture/gosWixRegistration";
import { processPublicLeadDeliveries } from "@/lib/capture/leadDelivery";
import { GOS_BRAND_ID } from "@/lib/data/systemBrands";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const maxBytes = 16_384;
  if (Number(request.headers.get("content-length")) > maxBytes) return new Response(null, { status: 413 });
  const raw = await request.text();
  if (Buffer.byteLength(raw) > maxBytes) return new Response(null, { status: 413 });
  let input;
  try { input = JSON.parse(raw); } catch { return new Response(null, { status: 400 }); }
  if (!authenticGosWixWebhook(input?.key, process.env.GOS_WIX_REGISTRATION_KEY_SHA256)) {
    return new Response(null, { status: 401 });
  }
  // Bookings created by staff or another integration are not website registrations.
  if (input.kind === "booking" && ["USER","APP"].includes(input.initiator)) return new Response(null, { status: 204 });
  const parsed = gosWixEvent.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error:"invalid_registration" }, { status:422 });
  const event = parsed.data;
  const leadId = randomUUID();
  let payload;
  try { payload = gosWixSheetPayload(event, leadId); } catch {
    return NextResponse.json({ error:"invalid_registration_date" }, { status:422 });
  }
  const db = createSupabaseAdminClient();
  const { data, error } = await db.from("gos_wix_registration_deliveries").upsert({
    source_kind:event.kind, source_id:event.eventId, lead_id:leadId, brand_id:GOS_BRAND_ID, payload_json:payload,
  }, { onConflict:"source_kind,source_id", ignoreDuplicates:true }).select("id").maybeSingle();
  if (error) return NextResponse.json({ error:"registration_capture_unavailable" }, { status:503 });
  if (data?.id) {
    const deliveryId = data.id;
    try {
      after(async () => {
        try { await processPublicLeadDeliveries({ source:"gos_wix", deliveryId, limit:1 }); }
        catch { console.error("gos_wix_delivery_deferred", { deliveryId }); }
      });
    } catch {
      // The scheduled worker still owns the committed registration.
      console.error("gos_wix_delivery_deferred", { deliveryId });
    }
  }
  return NextResponse.json({ accepted:true }, { status:202 });
}
