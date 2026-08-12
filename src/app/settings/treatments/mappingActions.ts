"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createTreatmentMappingRule,
  updateTreatmentMappingRule,
  type TreatmentMappingMutationResult,
  type TreatmentMappingRuleInput,
} from "@/lib/marketing/treatmentMappingStore";
import { syncMarketingDataSource } from "@/lib/integrations/googleSheetsMarketingSync";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";
import {
  canAccessInternalBrand,
  requireModuleAccess,
  verifyCurrentInternalAccess,
} from "@/lib/security/internalAccessServer";

function readString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function readBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function readInteger(formData: FormData, key: string, fallback = 0) {
  const raw = readString(formData, key);
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isInteger(value) ? value : Number.NaN;
}

function returnPath(formData: FormData) {
  const value = readString(formData, "returnPath");
  return value.startsWith("/settings/treatments")
    ? value
    : "/settings/treatments";
}

function redirectBack(path: string, result: TreatmentMappingMutationResult): never {
  const [base, hash] = path.split("#", 2);
  const separator = base.includes("?") ? "&" : "?";
  redirect(
    `${base}${separator}settings_status=${result.ok ? "success" : "error"}&message=${encodeURIComponent(result.message)}${hash ? `#${hash}` : "#lead-classification-rules"}`
  );
}

function mappingInput(formData: FormData): TreatmentMappingRuleInput {
  return {
    id: readString(formData, "id") || undefined,
    brandId: readString(formData, "brandId"),
    itemCode: readString(formData, "itemCode"),
    keywords: readString(formData, "keywords"),
    outputLabel: readString(formData, "outputLabel"),
    dashboardLabel: readString(formData, "dashboardLabel"),
    note: readString(formData, "note"),
    enabled: readBoolean(formData, "enabled"),
    sortOrder: readInteger(formData, "sortOrder", 0),
    expectedRevision: readInteger(formData, "revision", 0) || null,
  };
}

async function requireMappingAccess(path: string, brandId: string) {
  const session = await verifyCurrentInternalAccess();
  if (!session.ok) redirect(`/login?next=${encodeURIComponent(path)}`);
  const moduleAccess = await requireModuleAccess("settings");
  if (!moduleAccess.allowed || !canAccessInternalBrand(session.access, brandId)) {
    redirectBack(path, {
      ok: false,
      message: "你未獲授權修改呢個品牌嘅療程分類規則。",
    });
  }
  return session.access;
}

function revalidateTreatmentMapping() {
  [
    "/settings/treatments",
    "/dashboard",
    "/performance",
    "/period-comparison",
    "/reports",
    "/daily-overview",
  ].forEach((path) => revalidatePath(path));
}

async function syncLeadClassification(actorIdentifier: string) {
  if (!hasSupabaseAdminEnv()) {
    return { ok: false, message: "正式資料服務尚未連接。" };
  }
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("marketing_data_sources")
    .select("id,display_name,configuration")
    .eq("provider_key", "google_sheets")
    .neq("status", "paused")
    .limit(50);
  if (error) {
    return { ok: false, message: "未能找到 Lead Sheet 同步來源。" };
  }
  const leadSource = (data ?? []).find((row) => {
    const configuration =
      row.configuration && typeof row.configuration === "object"
        ? (row.configuration as Record<string, unknown>)
        : {};
    return configuration.sourceProfile === "alyssa_workspace_lead_funnel";
  });
  if (!leadSource) {
    return { ok: false, message: "Lead Sheet 同步來源未配置。" };
  }
  const result = await syncMarketingDataSource(leadSource.id, {
    actorIdentifier,
  });
  return {
    ok: result.ok,
    message: result.message,
  };
}

async function finishMutation(
  path: string,
  result: TreatmentMappingMutationResult,
  actorIdentifier: string
): Promise<never> {
  revalidateTreatmentMapping();
  if (!result.ok) redirectBack(path, result);

  const sync = await syncLeadClassification(actorIdentifier);
  revalidateTreatmentMapping();
  redirectBack(path, {
    ok: true,
    message: sync.ok
      ? `${result.message} Lead Sheet 已即時重新分類，同期比較及療程成效已同步。`
      : `${result.message} 系統規則已生效；Lead Sheet aggregate 暫未即時同步（${sync.message}），Live Dashboard 仍會使用新規則。`,
  });
}

export async function createTreatmentMappingRuleAction(formData: FormData) {
  const input = mappingInput(formData);
  const path = returnPath(formData);
  const access = await requireMappingAccess(path, input.brandId);
  const actor = access.email || access.identifier || "system-admin";
  const result = await createTreatmentMappingRule(input, actor);
  return finishMutation(path, result, actor);
}

export async function updateTreatmentMappingRuleAction(formData: FormData) {
  const input = mappingInput(formData);
  const path = returnPath(formData);
  const access = await requireMappingAccess(path, input.brandId);
  const actor = access.email || access.identifier || "system-admin";
  const result = await updateTreatmentMappingRule(input, actor);
  return finishMutation(path, result, actor);
}

export async function resyncTreatmentMappingAction(formData: FormData) {
  const brandId = readString(formData, "brandId");
  const path = returnPath(formData);
  const access = await requireMappingAccess(path, brandId);
  const actor = access.email || access.identifier || "system-admin";
  const sync = await syncLeadClassification(actor);
  revalidateTreatmentMapping();
  redirectBack(path, {
    ok: sync.ok,
    message: sync.ok
      ? "Lead Sheet 已按 Growth OS 最新療程分類規則重新同步。"
      : `重新同步失敗：${sync.message}`,
  });
}
