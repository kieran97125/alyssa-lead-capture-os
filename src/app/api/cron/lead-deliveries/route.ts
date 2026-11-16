import { NextRequest, NextResponse } from "next/server";
import { processPublicLeadDeliveries } from "@/lib/capture/leadDelivery";
import { LEAD_DELIVERY_SIGNATURE_HEADER, LEAD_DELIVERY_TIMESTAMP_HEADER, verifyLeadDeliverySignature } from "@/lib/capture/leadDeliveryAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authorized = !request.nextUrl.search && verifyLeadDeliverySignature({
    method: request.method, path: request.nextUrl.pathname,
    timestamp: request.headers.get(LEAD_DELIVERY_TIMESTAMP_HEADER),
    signature: request.headers.get(LEAD_DELIVERY_SIGNATURE_HEADER),
    secret: process.env.LEAD_DELIVERY_SIGNING_SECRET,
  });
  if (!authorized) {
    return NextResponse.json({ ok: false, message: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await processPublicLeadDeliveries();
    return NextResponse.json(result, { status: result.ok ? 200 : 503 });
  } catch {
    return NextResponse.json({ ok: false, message: "lead_delivery_unavailable" }, { status: 503 });
  }
}
