import { NextRequest, NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/security/internalAccessServer";
import { canEditCreativeBrief } from "@/lib/creative/access";
import {
  getCreativeJobAccessRecord,
  writeCreativeAudit,
} from "@/lib/creative/store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function PUT(
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
    !canEditCreativeBrief(moduleAccess.access, {
      brandId: String(record.job.brand_id),
      assigneeMemberId:
        typeof record.job.assignee_member_id === "string"
          ? record.job.assignee_member_id
          : null,
    })
  ) {
    return NextResponse.json({ error: "read_only" }, { status: 403 });
  }

  const rawBody = await request.text();
  if (rawBody.length > 1_500_000) {
    return NextResponse.json({ error: "brief_too_large" }, { status: 413 });
  }
  let body: {
    document?: unknown;
    plainText?: unknown;
    createVersion?: unknown;
  };
  try {
    body = JSON.parse(rawBody) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (
    !body.document ||
    typeof body.document !== "object" ||
    Array.isArray(body.document)
  ) {
    return NextResponse.json({ error: "invalid_document" }, { status: 400 });
  }
  const plainText = String(body.plainText ?? "").slice(0, 200_000);
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("creative_jobs")
    .update({
      brief_document: body.document,
      brief_plain_text: plainText,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
  if (error) {
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }

  const { data: latest } = await supabase
    .from("creative_job_brief_versions")
    .select("version_no,created_at")
    .eq("job_id", jobId)
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  const latestAt = latest?.created_at
    ? new Date(String(latest.created_at)).getTime()
    : 0;
  const shouldCreateVersion =
    body.createVersion === true || Date.now() - latestAt >= 5 * 60 * 1000;
  let versionNo = Number(latest?.version_no || 0);
  if (shouldCreateVersion) {
    versionNo += 1;
    await supabase.from("creative_job_brief_versions").insert({
      job_id: jobId,
      version_no: versionNo,
      document: body.document,
      plain_text: plainText,
      reason: body.createVersion === true ? "manual" : "autosave",
      created_by_member_id: moduleAccess.access.memberId ?? null,
      created_by_email: moduleAccess.access.email ?? null,
    });
  }

  if (body.createVersion === true) {
    await writeCreativeAudit({
      jobId,
      access: moduleAccess.access,
      action: "creative_brief.version_created",
      after: { versionNo },
    });
  }

  return NextResponse.json({
    ok: true,
    savedAt: new Date().toISOString(),
    versionNo,
  });
}
