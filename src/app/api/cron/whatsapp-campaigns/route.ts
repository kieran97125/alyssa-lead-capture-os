import { NextRequest, NextResponse } from "next/server";
import { processNextWhatsAppCampaigns } from "@/lib/crm/whatsappCampaigns";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}

async function run(request: NextRequest) {
  const configuredSecret = process.env.CRON_SECRET?.trim() || "";
  const authorization = request.headers.get("authorization") || "";
  const suppliedSecret = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : request.headers.get("x-cron-secret")?.trim() || "";

  if (!configuredSecret || suppliedSecret !== configuredSecret) {
    return NextResponse.json({ ok: false, message: "unauthorized" }, { status: 401 });
  }

  const result = await processNextWhatsAppCampaigns(3);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
