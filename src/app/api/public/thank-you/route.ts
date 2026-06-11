import { NextRequest, NextResponse } from "next/server";
import { cleanText } from "@/lib/attribution/classify";
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const leadId = cleanText(payload?.lead_id, 80);
  const snapshotId = cleanText(payload?.source_snapshot_id, 80);

  if (!leadId && !snapshotId) {
    return NextResponse.json({ ok: false, error: "lead_or_snapshot_required" }, { status: 400 });
  }

  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({ ok: true, mode: "local_noop" }, { status: 202 });
  }

  const supabase = createSupabaseAdminClient();
  await supabase.from("lead_events").insert({
    lead_id: leadId,
    source_snapshot_id: snapshotId,
    event_type: "thank_you_viewed",
    event_payload_json: payload ?? {},
    page_url: cleanText(payload?.page_url, 2000),
    referrer: cleanText(payload?.referrer, 2000),
  });

  if (leadId) {
    await supabase
      .from("leads")
      .update({ payment_status: "verification_needed" })
      .eq("id", leadId)
      .in("payment_status", ["pending", "unpaid"]);
  }

  return NextResponse.json({ ok: true });
}
