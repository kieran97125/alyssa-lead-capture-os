import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/security/internalAccessServer";
import { canViewCreativeJob } from "@/lib/creative/access";
import { getCreativeJobAccessRecord } from "@/lib/creative/store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function safeFilename(value: string) {
  return value.replace(/[\r\n"\\/]/g, "_").slice(0, 180) || "creative-asset";
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string; assetId: string }> }
) {
  const moduleAccess = await requireModuleAccess("creative_jobs");
  if (!moduleAccess.allowed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { jobId, assetId } = await context.params;
  const record = await getCreativeJobAccessRecord(jobId);
  if (
    !record.job ||
    !canViewCreativeJob(moduleAccess.access, {
      brandId: String(record.job.brand_id),
      assigneeMemberId:
        typeof record.job.assignee_member_id === "string"
          ? record.job.assignee_member_id
          : null,
    })
  ) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: asset, error } = await supabase
    .from("creative_job_assets")
    .select("id,asset_kind,label,storage_path,mime_type")
    .eq("id", assetId)
    .eq("job_id", jobId)
    .is("removed_at", null)
    .maybeSingle();
  if (error || !asset || asset.asset_kind !== "upload" || !asset.storage_path) {
    return NextResponse.json({ error: "asset_not_found" }, { status: 404 });
  }

  const download = await supabase.storage
    .from("creative-job-assets")
    .download(String(asset.storage_path));
  if (download.error || !download.data) {
    return NextResponse.json({ error: "asset_unavailable" }, { status: 404 });
  }

  return new NextResponse(download.data.stream(), {
    status: 200,
    headers: {
      "Content-Type": String(asset.mime_type || download.data.type || "application/octet-stream"),
      "Content-Disposition": `inline; filename="${safeFilename(String(asset.label))}"`,
      "Cache-Control": "private, max-age=300, stale-while-revalidate=60",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'unsafe-inline'",
    },
  });
}
