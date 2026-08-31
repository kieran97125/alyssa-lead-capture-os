"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canEditCreativeBrief } from "@/lib/creative/access";
import {
  getCreativeJobAccessRecord,
  writeCreativeAudit,
} from "@/lib/creative/store";
import { requireModuleAccess } from "@/lib/security/internalAccessServer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function readString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function safePath(value: string, jobId: string) {
  return value === `/creative-jobs/${jobId}` ||
    value.startsWith(`/creative-jobs/${jobId}?`)
    ? value
    : `/creative-jobs/${jobId}`;
}

function redirectWithMessage(path: string, ok: boolean, message: string): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(
    `${path}${separator}creative_status=${ok ? "success" : "error"}&creative_message=${encodeURIComponent(
      message
    )}`
  );
}

export async function restoreCreativeBriefVersionAction(formData: FormData) {
  const moduleAccess = await requireModuleAccess("creative_jobs");
  const jobId = readString(formData, "jobId");
  const versionId = readString(formData, "versionId");
  const returnPath = safePath(readString(formData, "returnPath"), jobId);
  if (!moduleAccess.allowed) {
    redirectWithMessage(returnPath, false, "你未獲授權使用設計工作。" );
  }

  const record = await getCreativeJobAccessRecord(jobId);
  if (
    !record.job ||
    !canEditCreativeBrief(moduleAccess.access, {
      brandId: String(record.job.brand_id),
      assigneeMemberId:
        typeof record.job.assignee_member_id === "string"
          ? record.job.assignee_member_id
          : null,
    })
  ) {
    redirectWithMessage(returnPath, false, "你未獲授權恢復呢份 Brief。" );
  }

  const supabase = createSupabaseAdminClient();
  const { data: version, error: versionError } = await supabase
    .from("creative_job_brief_versions")
    .select("id,version_no,document,plain_text")
    .eq("id", versionId)
    .eq("job_id", jobId)
    .maybeSingle();
  if (versionError || !version) {
    redirectWithMessage(returnPath, false, "搵唔到要恢復嘅 Brief 版本。" );
  }

  const { data: latest } = await supabase
    .from("creative_job_brief_versions")
    .select("version_no")
    .eq("job_id", jobId)
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersionNo = Number(latest?.version_no || 0) + 1;
  const { error } = await supabase.rpc("restore_creative_brief_version", {
    p_job_id: jobId,
    p_source_version_id: versionId,
    p_new_version_no: nextVersionNo,
    p_actor_member_id: moduleAccess.access.memberId ?? null,
    p_actor_email: moduleAccess.access.email ?? null,
  });
  if (error) {
    console.warn("creative_brief_restore_failed", {
      code: error.code,
      message: error.message,
    });
    redirectWithMessage(returnPath, false, "未能恢復 Brief 版本。" );
  }

  await writeCreativeAudit({
    jobId,
    access: moduleAccess.access,
    action: "creative_brief.restored",
    before: { currentVersionNo: Number(latest?.version_no || 0) },
    after: {
      restoredFromVersionNo: Number(version.version_no),
      newVersionNo: nextVersionNo,
    },
  });
  revalidatePath(`/creative-jobs/${jobId}`);
  redirectWithMessage(
    returnPath,
    true,
    `已恢復 Version ${version.version_no}；恢復前內容仍保留喺版本紀錄。`
  );
}
