import { NextRequest, NextResponse } from "next/server";
import { cleanText } from "@/lib/attribution/classify";
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const leadId = cleanText(payload?.lead_id, 80);
  const status = cleanText(payload?.payment_status, 40);

  if (!leadId || !["paid", "failed", "cancelled", "pending"].includes(status ?? "")) {
    return NextResponse.json({ ok: false, error: "invalid_payment_payload" }, { status: 400 });
  }

  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({ ok: true, mode: "local_noop" }, { status: 202 });
  }

  const supabase = createSupabaseAdminClient();
  await supabase.from("leads").update({ payment_status: status }).eq("id", leadId);
  await supabase.from("lead_events").insert({
    lead_id: leadId,
    event_type:
      status === "paid"
        ? "payment_success"
        : status === "failed"
          ? "payment_failed"
          : status === "cancelled"
            ? "payment_cancelled"
            : "payment_initiated",
    event_payload_json: payload ?? {},
  });

  return NextResponse.json({ ok: true });
}
