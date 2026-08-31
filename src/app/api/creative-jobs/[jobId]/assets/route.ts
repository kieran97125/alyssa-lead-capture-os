import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/security/internalAccessServer";
import { canContributeCreativeAssets } from "@/lib/creative/access";
import {
  getCreativeJobAccessRecord,
  writeCreativeAudit,
} from "@/lib/creative/store";
import { creativeAssetPurposes } from "@/lib/creative/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  const moduleAccess = await requireModuleAccess("creative_jobs");
  if (!moduleAccess.allowed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { jobId } = await context.params;
  const record = await getCreativeJobAccessRecord(jobId);
  if (!record.job) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (
    !canContributeCreativeAssets(moduleAccess.access, {
      brandId: String(record.job.brand_id),
      assigneeMemberId:
        typeof record.job.assignee_member_id === "string"
          ? record.job.assignee_member_id
          : null,
    })
  ) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const purposeValue = String(formData.get("purpose") ?? "brief");
  const purpose = creativeAssetPurposes.includes(purposeValue as never)
    ? purposeValue
    : "brief";
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file_required" }, { status: 400 });
  }
  const extension = allowedTypes.get(file.type);
  if (!extension) {
    return NextResponse.json(
      { error: "unsupported_file_type" },
      { status: 415 }
    );
  }
  if (file.size <= 0 || file.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "file_too_large" }, { status: 413 });
  }

  const supabase = createSupabaseAdminClient();
  const storagePath = `${jobId}/${new Date().getUTCFullYear()}/${randomUUID()}.${extension}`;
  const upload = await supabase.storage
    .from("creative-job-assets")
    .upload(storagePath, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
  if (upload.error) {
    console.warn("creative_asset_upload_failed", {
      message: upload.error.message,
    });
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }

  const label = String(formData.get("label") ?? file.name).trim().slice(0, 240) ||
    `Brief image ${new Date().toISOString()}`;
  const { data: asset, error } = await supabase
    .from("creative_job_assets")
    .insert({
      job_id: jobId,
      asset_kind: "upload",
      purpose,
      label,
      storage_path: storagePath,
      mime_type: file.type,
      file_size: file.size,
      inserted_in_brief: purpose === "brief",
      created_by_member_id: moduleAccess.access.memberId ?? null,
      created_by_email: moduleAccess.access.email ?? null,
    })
    .select("id,created_at")
    .single();
  if (error || !asset) {
    await supabase.storage.from("creative-job-assets").remove([storagePath]);
    return NextResponse.json({ error: "asset_record_failed" }, { status: 500 });
  }

  await writeCreativeAudit({
    jobId,
    access: moduleAccess.access,
    action: "creative_asset.uploaded",
    after: {
      assetId: asset.id,
      label,
      purpose,
      mimeType: file.type,
      fileSize: file.size,
    },
  });

  return NextResponse.json({
    ok: true,
    asset: {
      id: asset.id,
      jobId,
      assetKind: "upload",
      purpose,
      label,
      externalUrl: null,
      storagePath,
      mimeType: file.type,
      fileSize: file.size,
      createdByEmail: moduleAccess.access.email ?? null,
      createdAt: asset.created_at,
      url: `/api/creative-jobs/${jobId}/assets/${asset.id}`,
    },
  });
}
