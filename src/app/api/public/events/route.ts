import { NextRequest, NextResponse } from "next/server";
import { cleanText } from "@/lib/attribution/classify";
import { leadEventTypes } from "@/lib/attribution/types";
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const eventType = cleanText(payload?.event_type, 80);

  if (!eventType || !leadEventTypes.includes(eventType as never)) {
    return NextResponse.json({ ok: false, error: "invalid_event_type" }, { status: 400 });
  }

  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({ ok: true, mode: "local_noop" }, { status: 202 });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("lead_events").insert({
    lead_id: cleanText(payload?.lead_id, 80),
    contact_id: cleanText(payload?.contact_id, 80),
    source_snapshot_id: cleanText(payload?.source_snapshot_id, 80),
    visitor_id: cleanText(payload?.visitor_id, 120),
    session_id: cleanText(payload?.session_id, 120),
    event_type: eventType,
    event_payload_json: payload?.event_payload_json ?? {},
    page_url: cleanText(payload?.page_url, 2000),
    referrer: cleanText(payload?.referrer, 2000),
  });

  if (error) {
    return NextResponse.json({ ok: false, error: "event_insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
