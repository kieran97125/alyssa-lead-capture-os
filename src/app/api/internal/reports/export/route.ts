import { NextResponse } from "next/server";
import {
  buildReportSnapshot,
  normalizeReportExportRequest,
  ReportExportError,
} from "@/lib/reports/snapshot";
import { requireModuleAccess } from "@/lib/security/internalAccessServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function reportFilename(startDate: string, endDate: string, extension: string) {
  return `growth-report-${startDate}-${endDate}.${extension}`;
}

export async function POST(request: Request) {
  try {
    const access = await requireModuleAccess("performance");
    if (!access.allowed) {
      return NextResponse.json(
        { message: "你未獲授權生成成效報告。", code: "permission_denied" },
        { status: 403 }
      );
    }
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      throw new ReportExportError("報告請求格式不正確。", 415, "invalid_content_type");
    }
    const input = await request.json().catch(() => null);
    const normalized = normalizeReportExportRequest(input);
    const snapshot = await buildReportSnapshot(normalized);
    const headers = new Headers({
      "cache-control": "private, no-store, max-age=0",
      "content-disposition": `attachment; filename="${reportFilename(normalized.startDate, normalized.endDate, normalized.format)}"`,
      "x-content-type-options": "nosniff",
      "x-report-id": snapshot.reportId,
      "x-report-snapshot-id": snapshot.snapshotId,
    });

    if (normalized.format === "txt") {
      const { renderReportText } = await import("@/lib/reports/text");
      const output = renderReportText(snapshot);
      headers.set("content-type", "text/plain; charset=utf-8");
      return new Response(output, { status: 200, headers });
    }

    if (normalized.format === "pptx") {
      const { renderReportPptx } = await import("@/lib/reports/pptx");
      const output = await renderReportPptx(snapshot);
      headers.set("content-type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
      const body = output.buffer.slice(
        output.byteOffset,
        output.byteOffset + output.byteLength
      ) as ArrayBuffer;
      return new Response(body, { status: 200, headers });
    }

    const { renderReportPdf } = await import("@/lib/reports/pdf");
    const output = await renderReportPdf(snapshot);
    headers.set("content-type", "application/pdf");
    return new Response(new Uint8Array(output), { status: 200, headers });
  } catch (error) {
    if (error instanceof ReportExportError) {
      return NextResponse.json(
        { message: error.message, code: error.code },
        { status: error.status, headers: { "cache-control": "no-store" } }
      );
    }
    console.error("report_export_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { message: "報告生成失敗，請稍後再試。", code: "report_export_failed" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
