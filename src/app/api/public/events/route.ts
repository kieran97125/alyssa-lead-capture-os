import { NextRequest, NextResponse } from "next/server";
import { readPublicEventRequest } from "@/lib/attribution/publicEvents";
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const event = await readPublicEventRequest(request);
  if (!event.ok) {
    return NextResponse.json({ ok: false, error: event.error }, { status: event.status });
  }

  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({ ok: true, mode: "local_noop" }, { status: 202 });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("lead_events").insert(event.row);

  if (error) {
    return NextResponse.json({ ok: false, error: "event_insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
