import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { syncMarketingDataSource } from "@/lib/integrations/googleSheetsMarketingSync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SOURCE_ID = "8f125114-2728-4ea0-9c10-6e7c63291053";
const EXPECTED_TOKEN_HASH =
  "fa1ee67c81dda3a7273c69991719fb9febefcffd77460c80dba8a7651492f802";

function authorized(request: NextRequest) {
  if (process.env.VERCEL_ENV === "production") return false;
  const supplied = request.nextUrl.searchParams.get("token") || "";
  const digest = createHash("sha256").update(supplied).digest("hex");
  const expected = Buffer.from(EXPECTED_TOKEN_HASH, "hex");
  const received = Buffer.from(digest, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const result = await syncMarketingDataSource(SOURCE_ID, {
    actorIdentifier: "preview_one_shot_meta_lead_normalization",
  });
  return NextResponse.json({
    ok: result.ok,
    sourceId: result.sourceId,
    dataset: result.dataset,
    metricRows: result.metricRows,
    analysisRows: result.analysisRows,
    auditStatus: result.auditStatus ?? null,
  });
}
