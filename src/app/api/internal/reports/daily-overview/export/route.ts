import { NextRequest } from "next/server";
import { getDailyOverviewSnapshot } from "@/lib/marketing/dailyOverview";
import { buildDailyOverviewExcelWorkbook } from "@/lib/marketing/dailyOverviewExcel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function firstParam(request: NextRequest, name: string) {
  return request.nextUrl.searchParams.get(name)?.trim() || "";
}

export async function GET(request: NextRequest) {
  const snapshot = await getDailyOverviewSnapshot({
    month: firstParam(request, "month"),
    brand: firstParam(request, "brand"),
  });
  const workbook = buildDailyOverviewExcelWorkbook(snapshot);
  const encodedFilename = encodeURIComponent(workbook.filename);

  return new Response(workbook.body, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="Daily_Overview.xls"; filename*=UTF-8''${encodedFilename}`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
