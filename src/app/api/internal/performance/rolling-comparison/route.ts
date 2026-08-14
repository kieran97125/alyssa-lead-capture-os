import { NextResponse } from "next/server";
import { getRollingSevenDaySnapshot } from "@/lib/marketing/rollingComparison";
import { requireModuleAccess } from "@/lib/security/internalAccessServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const access = await requireModuleAccess("performance");
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, message: "你未獲授權查看成效比較。" },
        { status: 403, headers: { "cache-control": "private, no-store" } }
      );
    }
    const url = new URL(request.url);
    const brand = url.searchParams.get("brand")?.trim() || "";
    const snapshot = await getRollingSevenDaySnapshot(brand);
    return NextResponse.json(
      { ok: true, snapshot },
      {
        status: 200,
        headers: {
          "cache-control": "private, no-store, max-age=0",
          "x-content-type-options": "nosniff",
        },
      }
    );
  } catch (error) {
    console.error("rolling_comparison_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { ok: false, message: "近 7 日對比暫時未能讀取。" },
      { status: 500, headers: { "cache-control": "private, no-store" } }
    );
  }
}
