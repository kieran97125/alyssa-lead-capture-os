"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canAccessInternalBrand, requireModuleAccess } from "@/lib/security/internalAccessServer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function readString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function redirectResult(ok: boolean, message: string): never {
  redirect(
    `/lead-audit?audit_status=${ok ? "success" : "error"}&message=${encodeURIComponent(
      message
    )}`
  );
}

export async function reviewLeadAuditChangeAction(formData: FormData) {
  const moduleAccess = await requireModuleAccess("lead_audit");
  if (!moduleAccess.allowed) {
    redirectResult(false, "你未獲授權檢視或處理 Lead Data Audit。");
  }
  const changeId = readString(formData, "changeId");
  const reviewStatus = readString(formData, "reviewStatus");
  const reviewNote = readString(formData, "reviewNote");
  if (
    !UUID_PATTERN.test(changeId) ||
    !["reviewed", "expected", "dismissed"].includes(reviewStatus) ||
    reviewNote.length > 1000
  ) {
    redirectResult(false, "請檢查審核狀態及備註內容。");
  }

  const supabase = createSupabaseAdminClient();
  const { data: change, error: changeError } = await supabase
    .from("lead_sheet_audit_changes")
    .select("brand_id,review_status")
    .eq("id", changeId)
    .maybeSingle();
  if (changeError || !change || change.review_status !== "open") {
    redirectResult(false, "呢項警報已被處理或已不存在，請重新載入。");
  }
  if (
    change.brand_id &&
    !canAccessInternalBrand(moduleAccess.access, String(change.brand_id))
  ) {
    redirectResult(false, "你未獲授權處理呢個品牌嘅警報。");
  }

  const { error } = await supabase.rpc("review_lead_sheet_audit_change", {
    p_change_id: changeId,
    p_member_id: moduleAccess.access.memberId ?? null,
    p_actor_email:
      moduleAccess.access.email ||
      (moduleAccess.access.accessLevel === "master"
        ? "master_lead_audit"
        : "assigned_lead_auditor"),
    p_review_status: reviewStatus,
    p_review_note: reviewNote || null,
  });
  if (error) {
    console.warn("lead_sheet_audit_review_failed", {
      code: error.code,
      message: error.message,
    });
    redirectResult(false, "警報審核未能儲存，請重新載入後再試。");
  }

  revalidatePath("/lead-audit");
  revalidatePath("/dashboard");
  redirectResult(
    true,
    reviewStatus === "expected"
      ? "已標記為正常操作。"
      : reviewStatus === "dismissed"
        ? "警報已忽略並保留審核紀錄。"
        : "警報已完成核對。"
  );
}
