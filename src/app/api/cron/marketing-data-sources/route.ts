import { NextRequest, NextResponse } from "next/server";
import { syncAllMarketingGoogleSheets } from "@/lib/integrations/googleSheetsMarketingSync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function hasValidCronSecret(request: NextRequest) {
  const configuredSecret = process.env.CRON_SECRET?.trim() || "";
  const authorization = request.headers.get("authorization") || "";
  const suppliedSecret = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : request.headers.get("x-cron-secret")?.trim() || "";
  return Boolean(configuredSecret && suppliedSecret === configuredSecret);
}

export async function GET(request: NextRequest) {
  if (!hasValidCronSecret(request)) {
    return NextResponse.json(
      { ok: false, message: "unauthorized" },
      { status: 401 }
    );
  }

  try {
    const results = await syncAllMarketingGoogleSheets();
    const failed = results.filter((result) => !result.ok);
    return NextResponse.json(
      {
        ok: failed.length === 0,
        message:
          failed.length === 0
            ? "marketing_data_sources_synced"
            : "marketing_data_sources_partially_synced",
        sourceCount: results.length,
        successCount: results.length - failed.length,
        failureCount: failed.length,
        results,
      },
      { status: failed.length === results.length && results.length > 0 ? 502 : 200 }
    );
  } catch (error) {
    console.error("marketing_data_sources_cron_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { ok: false, message: "marketing_data_sources_sync_failed" },
      { status: 500 }
    );
  }
}
