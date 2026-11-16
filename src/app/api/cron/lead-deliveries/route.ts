import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { processPublicLeadDeliveries } from "@/lib/capture/leadDelivery";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET?.trim() || "";
  const authorization = request.headers.get("authorization") || "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  const left = Buffer.from(expected), right = Buffer.from(supplied);
  if (!left.length || left.length !== right.length || !timingSafeEqual(left, right)) {
    return NextResponse.json({ ok: false, message: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await processPublicLeadDeliveries();
    return NextResponse.json(result, { status: result.ok ? 200 : 503 });
  } catch {
    return NextResponse.json({ ok: false, message: "lead_delivery_unavailable" }, { status: 503 });
  }
}
