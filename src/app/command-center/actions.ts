"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  canAccessInternalBrand,
  requireModuleAccess,
  verifyCurrentInternalAccess,
} from "@/lib/security/internalAccessServer";
import { getConfigurationData } from "@/lib/data/configuration";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";
import {
  getAuthConfirmUrl,
  getSupabasePublicAuthConfig,
} from "@/lib/supabase/authConfig";
import {
  syncAllMarketingGoogleSheets,
  syncMarketingDataSource,
} from "@/lib/integrations/googleSheetsMarketingSync";
import { MASTER_ACCOUNT_EMAIL } from "@/lib/marketing/commandCenter";
import { canEditDailySpendAccess } from "@/lib/marketing/dailyOverview";
import {
  SPEND_TYPE_LABELS,
  isEditableSpendType,
} from "@/lib/marketing/spendTypes";
import {
  getWorkspaceRoleDefaultModules,
  normalizeWorkspaceRole,
} from "@/lib/security/workspacePermissions";
import { workspaceModuleKeys } from "@/lib/security/workspaceAuth";

type ActionResult = {
  ok: boolean;
  message: string;
};

const creatableDataSourceProviders = new Set([
  "launchhub",
  "crm",
  "google_sheets",
  "meta_ads",
  "google_ads",
  "manual_csv",
  "n8n",
]);

function readString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function readNumber(formData: FormData, key: string) {
  const value = readString(formData, key);
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : Number.NaN;
}

function safeReturnPath(value: string, fallback: string) {
  const allowed = [
    "/dashboard",
    "/kpis",
    "/calendar",
    "/data-sources",
    "/performance",
    "/settings/planning",
    "/settings/team",
  ];
  return allowed.some(
    (prefix) =>
      value === prefix ||
      value.startsWith(`${prefix}/`) ||
      value.startsWith(`${prefix}?`)
  )
    ? value
    : fallback;
}

function redirectWithResult(path: string, result: ActionResult): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(
    `${path}${separator}command_status=${result.ok ? "success" : "error"}&message=${encodeURIComponent(
      result.message
    )}`
  );
}

async function ensureCommandCenterAction(
  path: string,
  options: { masterOnly?: boolean } = {}
) {
  const session = await verifyCurrentInternalAccess();
  if (!session.ok) {
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }
  const routeModule =
    path.startsWith("/calendar")
      ? "calendar"
      : path.startsWith("/data-sources")
        ? "data_sources"
        : path.startsWith("/kpis")
          ? "kpis"
          : path.startsWith("/performance")
            ? "performance"
          : path.startsWith("/settings")
            ? "settings"
            : "dashboard";
  const moduleAccess = await requireModuleAccess(routeModule);
  if (!moduleAccess.allowed) {
    return {
      ok: false as const,
      reason: "permission_denied" as const,
      message: "你未獲授權執行呢個模組嘅操作。",
    };
  }
  if (options.masterOnly && session.access.accessLevel !== "master") {
    return {
      ok: false as const,
      reason: "master_required" as const,
      message: "呢項設定只限 Master Account。",
    };
  }
  if (!hasSupabaseAdminEnv()) {
    return {
      ok: false as const,
      reason: "supabase_unavailable" as const,
      message: "Supabase 尚未連接，未能儲存 Command Center 設定。",
    };
  }
  return {
    ok: true as const,
    reason: null,
    accessLevel: session.access.accessLevel,
    memberId: session.access.memberId ?? null,
    actorIdentifier:
      session.access.email ||
      (session.access.accessLevel === "master"
        ? MASTER_ACCOUNT_EMAIL
        : "shared_admin"),
    access: session.access,
  };
}

function revalidateCommandCenter(...paths: string[]) {
  new Set(paths).forEach((path) => revalidatePath(path));
}

async function writeAudit(input: {
  actorIdentifier?: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  brandId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}) {
  try {
    const supabase = createSupabaseAdminClient();
    await supabase.from("marketing_command_center_audit").insert({
      actor_email: input.actorIdentifier || MASTER_ACCOUNT_EMAIL,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      brand_id: input.brandId ?? null,
      before_json: input.before ?? null,
      after_json: input.after ?? null,
    });
  } catch (error) {
    console.warn("marketing_command_center_audit_write_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
  }
}

export async function upsertMonthlyPlanAction(formData: FormData) {
  const returnPath = safeReturnPath(
    readString(formData, "returnPath"),
    "/settings/planning"
  );
  const access = await ensureCommandCenterAction(returnPath, {
    masterOnly: true,
  });
  if (!access.ok) redirectWithResult(returnPath, access);

  const brandId = readString(formData, "brandId");
  const monthStart = readString(formData, "monthStart");
  const values = {
    budget: readNumber(formData, "budget"),
    lead_target: readNumber(formData, "leadTarget"),
    booking_target: readNumber(formData, "bookingTarget"),
    show_target: readNumber(formData, "showTarget"),
    content_target: readNumber(formData, "contentTarget"),
  };
  const hasInvalidValue = Object.values(values).some(
    (value) => Number.isNaN(value) || value < 0
  );
  if (!brandId || !/^\d{4}-\d{2}-01$/.test(monthStart) || hasInvalidValue) {
    redirectWithResult(returnPath, {
      ok: false,
      message: "請檢查品牌、月份及所有目標數字。",
    });
  }

  const payload = {
    brand_id: brandId,
    month_start: monthStart,
    currency: readString(formData, "currency") || "HKD",
    ...values,
    notes: readString(formData, "notes") || null,
    updated_at: new Date().toISOString(),
  };
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("marketing_monthly_plans")
    .upsert(payload, { onConflict: "brand_id,month_start" })
    .select("id")
    .single();

  if (error) {
    console.warn("marketing_monthly_plan_save_failed", {
      code: error.code,
      message: error.message,
    });
    redirectWithResult(returnPath, {
      ok: false,
      message: "月度 Budget／KPI 儲存失敗，請先確認 migration 已套用。",
    });
  }

  await writeAudit({
    action: "monthly_plan.upserted",
    entityType: "marketing_monthly_plan",
    entityId: data?.id,
    brandId,
    after: payload,
  });
  revalidateCommandCenter("/settings/planning", "/dashboard", "/kpis");
  redirectWithResult(returnPath, {
    ok: true,
    message: "月度 Budget 及 KPI 目標已更新。",
  });
}

export async function saveDailySpendAction(formData: FormData) {
  const returnPath = safeReturnPath(
    readString(formData, "returnPath"),
    "/performance/daily"
  );
  const access = await ensureCommandCenterAction(returnPath);
  if (!access.ok) redirectWithResult(returnPath, access);

  if (
    !canEditDailySpendAccess({
      accessLevel: access.access.accessLevel,
      workspaceRole: access.access.workspaceRole,
    })
  ) {
    redirectWithResult(returnPath, {
      ok: false,
      message: "只有 Master、Admin、Manager 或 Marketer 可以修改廣告費。",
    });
  }

  const spendDate = readString(formData, "spendDate");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(spendDate)) {
    redirectWithResult(returnPath, {
      ok: false,
      message: "請選擇有效嘅廣告費日期。",
    });
  }
  const spendType = readString(formData, "spendType");
  if (!isEditableSpendType(spendType)) {
    redirectWithResult(returnPath, {
      ok: false,
      message: "請選擇有效嘅廣告費類型。",
    });
  }

  const config = await getConfigurationData();
  if (config.brands.length === 0) {
    redirectWithResult(returnPath, {
      ok: false,
      message: "你目前未獲授權管理任何品牌。",
    });
  }

  const entries = config.brands.map((brand) => {
    const rawAmount = readString(formData, `amount:${brand.id}`);
    const amount = rawAmount === "" ? null : Number(rawAmount);
    const note = readString(formData, `note:${brand.id}`) || null;
    return {
      brandId: brand.id,
      amount,
      note,
    };
  });
  const invalidEntry = entries.find(
    (entry) =>
      (entry.amount !== null &&
        (!Number.isFinite(entry.amount) ||
          entry.amount < 0 ||
          entry.amount > 99_999_999.99)) ||
      (entry.note?.length ?? 0) > 500 ||
      !canAccessInternalBrand(access.access, entry.brandId)
  );
  if (invalidEntry) {
    redirectWithResult(returnPath, {
      ok: false,
      message: "請檢查廣告費數字、備註長度及品牌權限。",
    });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("save_marketing_daily_spend", {
    p_spend_date: spendDate,
    p_spend_type: spendType,
    p_entries: entries,
    p_actor_email: access.actorIdentifier,
  });
  if (error) {
    console.warn("marketing_daily_spend_save_failed", {
      code: error.code,
      message: error.message,
    });
    const errorMessage = error.message.includes("future_spend_date_not_allowed")
      ? "未來日期未能填寫廣告費。"
      : error.message.includes("invalid_spend_type")
        ? "請選擇有效嘅廣告費類型。"
        : error.message.includes("invalid_spend_entry")
          ? "其中一項廣告費或備註格式不正確。"
          : "廣告費儲存失敗，請確認 Daily Spend migration 已完成。";
    redirectWithResult(returnPath, { ok: false, message: errorMessage });
  }

  const result =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  const savedCount = Number(result.savedCount ?? 0);
  const deletedCount = Number(result.deletedCount ?? 0);
  revalidateCommandCenter(
    "/performance/daily",
    "/performance/compare",
    "/dashboard",
    "/kpis",
    "/data-sources"
  );
  redirectWithResult(returnPath, {
    ok: true,
    message: `${spendDate} ${SPEND_TYPE_LABELS[spendType]} 已更新：儲存 ${savedCount} 個品牌${deletedCount > 0 ? `，清除 ${deletedCount} 個舊值` : ""}。`,
  });
}

export async function createDataSourceAction(formData: FormData) {
  const returnPath = "/data-sources";
  const access = await ensureCommandCenterAction(returnPath, {
    masterOnly: true,
  });
  if (!access.ok) redirectWithResult(returnPath, access);

  const providerKey = readString(formData, "providerKey");
  const displayName = readString(formData, "displayName");
  const brandId = readString(formData, "brandId") || null;
  if (
    !displayName ||
    !providerKey ||
    !creatableDataSourceProviders.has(providerKey)
  ) {
    redirectWithResult(returnPath, {
      ok: false,
      message: "請填寫資料來源名稱及類型。",
    });
  }

  const dataset = readString(formData, "dataset");
  if (
    providerKey === "google_sheets" &&
    dataset !== "lead_funnel"
  ) {
    redirectWithResult(returnPath, {
      ok: false,
      message: "Google Sheet 只可用作 CS Lead Funnel；廣告費請喺每日 Overview 填寫。",
    });
  }
  if (
    providerKey === "google_sheets" &&
    (!readString(formData, "sheetId") || !readString(formData, "tabName"))
  ) {
    redirectWithResult(returnPath, {
      ok: false,
      message: "Google Sheets 來源必須填寫 Sheet ID 及工作表名稱。",
    });
  }
  const configuredHeaderRow = readNumber(formData, "headerRow");
  const configuration = {
    dataset: dataset || null,
    spreadsheetId: readString(formData, "sheetId") || null,
    tabName: readString(formData, "tabName") || null,
    headerRow:
      configuredHeaderRow ||
      (dataset === "lead_funnel" ? 1 : null),
    maxRows: readNumber(formData, "maxRows") || 5000,
    lastColumn: readString(formData, "lastColumn") || "V",
    accountLabel: readString(formData, "accountLabel") || null,
  };
  const providesMetrics =
    providerKey === "google_sheets" && dataset === "lead_funnel"
      ? [
          "leads",
          "bookings",
          "shows",
          "no_shows",
          "pending_shows",
          "treatment_performance",
        ]
      : formData
          .getAll("providesMetrics")
          .map(String)
          .filter(Boolean);
  const payload = {
    brand_id: brandId,
    provider_key: providerKey,
    display_name: displayName,
    status: "draft",
    sync_mode: "manual",
    configuration,
    provides_metrics: providesMetrics,
  };
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("marketing_data_sources")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    console.warn("marketing_data_source_create_failed", {
      code: error.code,
      message: error.message,
    });
    redirectWithResult(returnPath, {
      ok: false,
      message: "資料來源未能建立，請檢查設定或 migration 狀態。",
    });
  }

  await writeAudit({
    action: "data_source.created",
    entityType: "marketing_data_source",
    entityId: data?.id,
    brandId,
    after: {
      providerKey,
      displayName,
      providesMetrics,
      configuration,
    },
  });
  revalidateCommandCenter(
    "/data-sources",
    "/dashboard",
    "/kpis",
    "/performance"
  );
  redirectWithResult(returnPath, {
    ok: true,
    message: "資料來源設定已建立；完成連接驗證前會保持 Draft。",
  });
}

export async function syncDataSourceAction(formData: FormData) {
  const returnPath = "/data-sources";
  const access = await ensureCommandCenterAction(returnPath, {
    masterOnly: true,
  });
  if (!access.ok) redirectWithResult(returnPath, access);

  const dataSourceId = readString(formData, "dataSourceId");
  if (!dataSourceId) {
    redirectWithResult(returnPath, {
      ok: false,
      message: "找不到要同步嘅資料來源。",
    });
  }

  const result = await syncMarketingDataSource(dataSourceId);
  revalidateCommandCenter(
    "/data-sources",
    "/dashboard",
    "/kpis",
    "/performance"
  );
  redirectWithResult(returnPath, {
    ok: result.ok,
    message: result.ok
      ? `${result.sourceName}：${result.message}`
      : `${result.sourceName}：${result.message}`,
  });
}

export async function refreshDashboardDataAction(formData: FormData) {
  const returnPath = safeReturnPath(
    readString(formData, "returnPath"),
    "/dashboard"
  );
  const access = await ensureCommandCenterAction(returnPath, {
    masterOnly: true,
  });
  if (!access.ok) redirectWithResult(returnPath, access);

  let results;
  try {
    results = await syncAllMarketingGoogleSheets({
      actorIdentifier:
        access.accessLevel === "master"
          ? MASTER_ACCOUNT_EMAIL
          : "shared_admin",
    });
  } catch (error) {
    console.warn("marketing_dashboard_manual_refresh_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    revalidateCommandCenter(
      returnPath,
      "/dashboard",
      "/kpis",
      "/performance",
      "/data-sources"
    );
    redirectWithResult(returnPath, {
      ok: false,
      message: "CS Lead Sheet 同步失敗，請稍後再試或通知 Master 檢查資料來源。",
    });
  }

  if (results.length === 0) {
    revalidateCommandCenter(
      returnPath,
      "/dashboard",
      "/kpis",
      "/performance",
      "/data-sources"
    );
    redirectWithResult(returnPath, {
      ok: false,
      message: "未有可同步嘅 CS Lead Sheet 資料來源。",
    });
  }

  const failed = results.filter((result) => !result.ok);
  const metricRows = results.reduce(
    (total, result) => total + result.metricRows,
    0
  );
  const analysisRows = results.reduce(
    (total, result) => total + result.analysisRows,
    0
  );
  revalidateCommandCenter(
    returnPath,
    "/dashboard",
    "/kpis",
    "/performance",
    "/data-sources"
  );
  redirectWithResult(returnPath, {
    ok: failed.length === 0,
    message:
      failed.length === 0
        ? `CS Lead 已同步：${results.length}/${results.length} 個來源成功，共更新 ${metricRows} 個每日指標及 ${analysisRows} 個療程成效組合。`
        : `已更新 ${results.length - failed.length}/${results.length} 個來源；${failed
            .map((result) => result.sourceName)
            .join("、")} 需要再檢查。`,
  });
}

export async function createCalendarItemAction(formData: FormData) {
  const returnPath = "/calendar";
  const access = await ensureCommandCenterAction(returnPath);
  if (!access.ok) redirectWithResult(returnPath, access);

  const brandId = readString(formData, "brandId");
  const title = readString(formData, "title");
  const scheduledDate = readString(formData, "scheduledDate");
  if (!brandId || !title || !/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
    redirectWithResult(returnPath, {
      ok: false,
      message: "請填寫品牌、事項名稱及有效日期。",
    });
  }
  if (!canAccessInternalBrand(access.access, brandId)) {
    redirectWithResult(returnPath, {
      ok: false,
      message: "你未獲授權為呢個品牌新增日曆事項。",
    });
  }

  const payload = {
    brand_id: brandId,
    title,
    item_type: readString(formData, "itemType") || "post",
    channel: readString(formData, "channel") || null,
    status: readString(formData, "status") || "planned",
    scheduled_date: scheduledDate,
    scheduled_time: readString(formData, "scheduledTime") || null,
    assignee_email: readString(formData, "assigneeEmail") || null,
    notes: readString(formData, "notes") || null,
  };
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("marketing_calendar_items")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    console.warn("marketing_calendar_item_create_failed", {
      code: error.code,
      message: error.message,
    });
    redirectWithResult(returnPath, {
      ok: false,
      message: "日曆事項未能建立。",
    });
  }

  await writeAudit({
    actorIdentifier:
      access.accessLevel === "master" ? MASTER_ACCOUNT_EMAIL : "shared_admin",
    action: "calendar_item.created",
    entityType: "marketing_calendar_item",
    entityId: data?.id,
    brandId,
    after: payload,
  });
  revalidateCommandCenter("/calendar", "/dashboard", "/kpis");
  redirectWithResult(returnPath, {
    ok: true,
    message: "營銷事項已加入日曆。",
  });
}

export async function moveCalendarItemAction(
  itemId: string,
  scheduledDate: string
): Promise<ActionResult> {
  const access = await ensureCommandCenterAction("/calendar");
  if (!access.ok) return access;
  if (!itemId || !/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
    return { ok: false, message: "無效日曆事項或日期。" };
  }

  const supabase = createSupabaseAdminClient();
  const { data: existing, error: lookupError } = await supabase
    .from("marketing_calendar_items")
    .select("id,brand_id")
    .eq("id", itemId)
    .maybeSingle();
  if (
    lookupError ||
    !existing ||
    !canAccessInternalBrand(access.access, String(existing.brand_id || ""))
  ) {
    return { ok: false, message: "你未獲授權移動呢個日曆事項。" };
  }
  const { data, error } = await supabase
    .from("marketing_calendar_items")
    .update({
      scheduled_date: scheduledDate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .select("id,brand_id")
    .single();
  if (error) {
    console.warn("marketing_calendar_item_move_failed", {
      code: error.code,
      message: error.message,
    });
    return { ok: false, message: "未能移動日曆事項。" };
  }

  await writeAudit({
    actorIdentifier:
      access.accessLevel === "master" ? MASTER_ACCOUNT_EMAIL : "shared_admin",
    action: "calendar_item.moved",
    entityType: "marketing_calendar_item",
    entityId: data?.id,
    brandId: data?.brand_id,
    after: { scheduledDate },
  });
  revalidateCommandCenter("/calendar", "/dashboard", "/kpis");
  return { ok: true, message: "日曆日期已更新。" };
}

export async function deleteCalendarItemAction(
  itemId: string
): Promise<ActionResult> {
  const access = await ensureCommandCenterAction("/calendar");
  if (!access.ok) return access;
  if (!itemId || itemId.length > 100) {
    return { ok: false, message: "無效日曆事項。" };
  }

  const supabase = createSupabaseAdminClient();
  const { data: existing, error: lookupError } = await supabase
    .from("marketing_calendar_items")
    .select(
      "id,brand_id,title,item_type,channel,status,scheduled_date,scheduled_time,assignee_email,notes,sort_order"
    )
    .eq("id", itemId)
    .maybeSingle();
  if (
    lookupError ||
    !existing ||
    !canAccessInternalBrand(access.access, String(existing.brand_id || ""))
  ) {
    return { ok: false, message: "你未獲授權刪除呢個日曆事項。" };
  }
  const { error } = await supabase
    .from("marketing_calendar_items")
    .delete()
    .eq("id", itemId);
  if (error) {
    console.warn("marketing_calendar_item_delete_failed", {
      code: error.code,
      message: error.message,
      itemId,
    });
    return {
      ok: false,
      message:
        error.code === "PGRST116"
          ? "找不到要刪除嘅日曆事項。"
          : "未能刪除日曆事項。",
    };
  }

  await writeAudit({
    actorIdentifier:
      access.accessLevel === "master" ? MASTER_ACCOUNT_EMAIL : "shared_admin",
    action: "calendar_item.deleted",
    entityType: "marketing_calendar_item",
    entityId: existing.id,
    brandId: existing.brand_id,
    before: {
      title: existing.title,
      itemType: existing.item_type,
      channel: existing.channel,
      status: existing.status,
      scheduledDate: existing.scheduled_date,
      scheduledTime: existing.scheduled_time,
      assigneeEmail: existing.assignee_email,
      notes: existing.notes,
      sortOrder: existing.sort_order,
    },
  });
  revalidateCommandCenter("/calendar", "/dashboard", "/kpis");
  return { ok: true, message: "日曆事項已刪除。" };
}

export async function createWorkspaceMemberAction(formData: FormData) {
  const returnPath = "/settings/team";
  const access = await ensureCommandCenterAction(returnPath, {
    masterOnly: true,
  });
  if (!access.ok) redirectWithResult(returnPath, access);

  const email = readString(formData, "email").toLowerCase();
  const fullName = readString(formData, "fullName");
  const role = readString(formData, "role") || "viewer";
  const allowedRoles = new Set(workspaceAssignableRoles);
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !allowedRoles.has(role)
  ) {
    redirectWithResult(returnPath, {
      ok: false,
      message: "請輸入有效電郵地址及選擇正確角色。",
    });
  }

  const supabase = createSupabaseAdminClient();
  const { brandIds, moduleKeys } = readWorkspaceMemberPermissions(
    formData,
    role
  );
  const { data: memberIdValue, error: createError } = await supabase.rpc(
    "create_workspace_member_invitation",
    {
      p_email: email,
      p_full_name: fullName,
      p_workspace_role: role,
      p_brand_ids: brandIds,
      p_module_keys: moduleKeys,
      p_invited_by_member_id: access.memberId,
      p_invited_by_email: access.actorIdentifier,
    }
  );
  const memberId =
    typeof memberIdValue === "string" ? memberIdValue : "";
  if (createError || !memberId) {
    console.warn("workspace_member_create_failed", {
      code: createError?.code,
    });
    redirectWithResult(returnPath, {
      ok: false,
      message:
        createError?.message === "workspace_member_already_exists"
          ? "呢個電郵已經喺帳戶列表；請直接更改權限或重發登入連結。"
          : "未能建立成員權限，請稍後再試。",
    });
  }

  const attemptedAt = new Date().toISOString();
  await supabase
    .from("workspace_members")
    .update({
      invite_attempted_at: attemptedAt,
      invite_last_error_code: null,
      updated_at: attemptedAt,
    })
    .eq("id", memberId);
  const invite = await sendWorkspaceAccessEmail({
    email,
    fullName,
    existingAuthUserId: null,
  });
  if (!invite.ok) {
    await supabase
      .from("workspace_members")
      .update({
        ...(invite.authUserId
          ? { auth_user_id: invite.authUserId }
          : {}),
        invite_delivery_status: "failed",
        invite_last_error_code: invite.code,
        updated_at: new Date().toISOString(),
      })
      .eq("id", memberId);
    await writeAudit({
      actorIdentifier: access.actorIdentifier,
      action: "workspace_member.invite_failed",
      entityType: "workspace_member",
      entityId: memberId,
      after: { email, role, brandIds, moduleKeys, code: invite.code },
    });
    revalidateCommandCenter("/settings/team");
    redirectWithResult(returnPath, {
      ok: false,
      message:
        "帳戶及權限已儲存，但郵件服務未接受今次寄送。請完成 Production SMTP 設定後喺帳戶列表按「重發連結」。",
    });
  }

  const sentAt = new Date().toISOString();
  await supabase
    .from("workspace_members")
    .update({
      auth_user_id: invite.authUserId,
      invite_sent_at: sentAt,
      invite_delivery_status: "submitted",
      invite_last_error_code: null,
      updated_at: sentAt,
    })
    .eq("id", memberId);

  await writeAudit({
    actorIdentifier: access.actorIdentifier,
    action: "workspace_member.invite_submitted",
    entityType: "workspace_member",
    entityId: memberId,
    after: {
      email,
      role,
      brandIds,
      moduleKeys,
      deliveryStatus: "submitted",
    },
  });
  revalidateCommandCenter("/settings/team");
  redirectWithResult(returnPath, {
    ok: true,
    message: `郵件服務已接受寄送到 ${email}。對方首次按安全連結後，帳戶會轉為「已啟用」。`,
  });
}

export async function updateWorkspaceMemberAccessAction(formData: FormData) {
  const returnPath = "/settings/team";
  const access = await ensureCommandCenterAction(returnPath, {
    masterOnly: true,
  });
  if (!access.ok) redirectWithResult(returnPath, access);

  const memberId = readString(formData, "memberId");
  const fullName = readString(formData, "fullName");
  const role = readString(formData, "role") || "viewer";
  if (!memberId || !workspaceAssignableRoles.includes(role)) {
    redirectWithResult(returnPath, {
      ok: false,
      message: "請選擇有效帳戶及角色。",
    });
  }

  const { brandIds, moduleKeys } = readWorkspaceMemberPermissions(
    formData,
    role
  );
  const supabase = createSupabaseAdminClient();
  const { data: member, error: memberError } = await supabase
    .from("workspace_members")
    .select("id,email,full_name,workspace_role,status,is_master")
    .eq("id", memberId)
    .maybeSingle();
  if (memberError || !member || member.is_master) {
    redirectWithResult(returnPath, {
      ok: false,
      message: "Master Account 不可更改，或帳戶已不存在。",
    });
  }

  const { error } = await supabase.rpc("update_workspace_member_access", {
    p_member_id: memberId,
    p_full_name: fullName,
    p_workspace_role: role,
    p_brand_ids: brandIds,
    p_module_keys: moduleKeys,
  });
  if (error) {
    console.warn("workspace_member_access_update_failed", {
      code: error.code,
    });
    redirectWithResult(returnPath, {
      ok: false,
      message: "未能儲存權限更改，請稍後再試。",
    });
  }

  await writeAudit({
    actorIdentifier: access.actorIdentifier,
    action: "workspace_member.permissions_updated",
    entityType: "workspace_member",
    entityId: memberId,
    before: {
      fullName: member.full_name,
      role: member.workspace_role,
      status: member.status,
    },
    after: { fullName, role, brandIds, moduleKeys },
  });
  revalidateCommandCenter("/settings/team");
  redirectWithResult(returnPath, {
    ok: true,
    message: `${member.email} 嘅角色、品牌及功能權限已更新。`,
  });
}

export async function resendWorkspaceInviteAction(formData: FormData) {
  const returnPath = "/settings/team";
  const access = await ensureCommandCenterAction(returnPath, {
    masterOnly: true,
  });
  if (!access.ok) redirectWithResult(returnPath, access);

  const memberId = readString(formData, "memberId");
  const supabase = createSupabaseAdminClient();
  const { data: member } = await supabase
    .from("workspace_members")
    .select("id,email,full_name,auth_user_id,status")
    .eq("id", memberId)
    .in("status", ["invited", "active"])
    .maybeSingle();
  if (!member) {
    redirectWithResult(returnPath, {
      ok: false,
      message: "搵唔到可寄送登入連結嘅帳戶。",
    });
  }

  const attemptedAt = new Date().toISOString();
  await supabase
    .from("workspace_members")
    .update({
      invite_attempted_at: attemptedAt,
      invite_last_error_code: null,
      updated_at: attemptedAt,
    })
    .eq("id", memberId);
  const result = await sendWorkspaceAccessEmail({
    email: String(member.email),
    fullName: String(member.full_name || ""),
    existingAuthUserId:
      typeof member.auth_user_id === "string" ? member.auth_user_id : null,
  });
  if (!result.ok) {
    await supabase
      .from("workspace_members")
      .update({
        ...(result.authUserId
          ? { auth_user_id: result.authUserId }
          : {}),
        invite_delivery_status: "failed",
        invite_last_error_code: result.code,
        updated_at: new Date().toISOString(),
      })
      .eq("id", memberId);
    await writeAudit({
      actorIdentifier: access.actorIdentifier,
      action: "workspace_member.invite_failed",
      entityType: "workspace_member",
      entityId: memberId,
      after: { code: result.code },
    });
    revalidateCommandCenter("/settings/team");
    redirectWithResult(returnPath, {
      ok: false,
      message:
        "郵件服務未接受今次寄送。帳戶權限冇改動；請完成 Production SMTP 設定後再試。",
    });
  }

  const sentAt = new Date().toISOString();
  await supabase
    .from("workspace_members")
    .update({
      auth_user_id: result.authUserId,
      invite_sent_at: sentAt,
      invite_delivery_status: "submitted",
      invite_last_error_code: null,
      updated_at: sentAt,
    })
    .eq("id", memberId);
  await writeAudit({
    actorIdentifier: access.actorIdentifier,
    action: "workspace_member.invite_submitted",
    entityType: "workspace_member",
    entityId: memberId,
    after: { deliveryStatus: "submitted" },
  });
  revalidateCommandCenter("/settings/team");
  redirectWithResult(returnPath, {
    ok: true,
    message: `郵件服務已接受寄送安全登入連結到 ${member.email}。`,
  });
}

export async function setWorkspaceMemberStatusAction(formData: FormData) {
  const returnPath = "/settings/team";
  const access = await ensureCommandCenterAction(returnPath, {
    masterOnly: true,
  });
  if (!access.ok) redirectWithResult(returnPath, access);

  const memberId = readString(formData, "memberId");
  const requestedStatus = readString(formData, "status");
  if (!memberId || !["active", "suspended"].includes(requestedStatus)) {
    redirectWithResult(returnPath, {
      ok: false,
      message: "帳戶狀態操作無效。",
    });
  }

  const supabase = createSupabaseAdminClient();
  const { data: member } = await supabase
    .from("workspace_members")
    .select("id,email,is_master,status")
    .eq("id", memberId)
    .maybeSingle();
  if (!member || member.is_master || member.status === "removed") {
    redirectWithResult(returnPath, {
      ok: false,
      message: "Master Account 不可暫停，或帳戶已不存在。",
    });
  }

  const { data: nextStatusValue, error } = await supabase.rpc(
    "set_workspace_member_status",
    {
      p_member_id: memberId,
      p_requested_status: requestedStatus,
    }
  );
  const nextStatus =
    typeof nextStatusValue === "string" ? nextStatusValue : "";
  if (error || !nextStatus) {
    redirectWithResult(returnPath, {
      ok: false,
      message: "未能更改帳戶狀態，請稍後再試。",
    });
  }

  await writeAudit({
    actorIdentifier: access.actorIdentifier,
    action:
      nextStatus === "suspended"
        ? "workspace_member.suspended"
        : "workspace_member.reactivated",
    entityType: "workspace_member",
    entityId: memberId,
    before: { status: member.status },
    after: { status: nextStatus },
  });
  revalidateCommandCenter("/settings/team");
  redirectWithResult(returnPath, {
    ok: true,
    message:
      nextStatus === "suspended"
        ? `${member.email} 已暫停；現有登入 Session 會被伺服器拒絕。`
        : `${member.email} 已重新啟用。`,
  });
}

export async function revokeWorkspaceMemberAction(formData: FormData) {
  const returnPath = "/settings/team";
  const access = await ensureCommandCenterAction(returnPath, {
    masterOnly: true,
  });
  if (!access.ok) redirectWithResult(returnPath, access);

  const memberId = readString(formData, "memberId");
  const supabase = createSupabaseAdminClient();
  const { data: member } = await supabase
    .from("workspace_members")
    .select("id,email,is_master,status")
    .eq("id", memberId)
    .maybeSingle();
  if (!member || member.is_master) {
    redirectWithResult(returnPath, {
      ok: false,
      message: "Owner／Master Account 唔可以喺呢度撤回。",
    });
  }

  const { error } = await supabase.rpc("set_workspace_member_status", {
    p_member_id: memberId,
    p_requested_status: "removed",
  });
  if (error) {
    redirectWithResult(returnPath, {
      ok: false,
      message: "未能移除帳戶，請稍後再試。",
    });
  }
  await writeAudit({
    actorIdentifier: access.actorIdentifier,
    action: "workspace_member.revoked",
    entityType: "workspace_member",
    entityId: memberId,
    before: { email: member.email, status: member.status },
    after: { status: "removed" },
  });
  revalidateCommandCenter("/settings/team");
  redirectWithResult(returnPath, {
    ok: true,
    message: `${member.email} 嘅工作區權限已撤回。`,
  });
}

async function sendWorkspaceAccessEmail({
  email,
  fullName,
  existingAuthUserId,
}: {
  email: string;
  fullName: string;
  existingAuthUserId: string | null;
}): Promise<
  | { ok: true; authUserId: string }
  | { ok: false; authUserId: string | null; code: string }
> {
  const config = getSupabasePublicAuthConfig();
  if (!config.ready) {
    return {
      ok: false,
      authUserId: existingAuthUserId,
      code: "auth_not_configured",
    };
  }

  const admin = createSupabaseAdminClient();
  let authUserId = existingAuthUserId;

  if (!authUserId) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: getAuthConfirmUrl(),
      data: {
        full_name: fullName || undefined,
        workspace: "alyssa-growth-os",
      },
    });
    if (!error && data.user?.id) {
      return { ok: true, authUserId: data.user.id };
    }

    const users = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    authUserId =
      users.data.users.find(
        (user) => user.email?.trim().toLowerCase() === email
      )?.id ?? null;
    if (!authUserId) {
      console.warn("workspace_invite_send_failed", {
        code: error?.code,
        status: error?.status,
      });
      return {
        ok: false,
        authUserId: null,
        code: safeAuthEmailErrorCode(error),
      };
    }
  }

  const auth = createClient(config.url, config.key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      flowType: "implicit",
    },
  });
  const { error } = await auth.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: getAuthConfirmUrl(),
    },
  });
  if (error) {
    console.warn("workspace_magic_link_resend_failed", {
      code: error.code,
      status: error.status,
    });
    return {
      ok: false,
      authUserId,
      code: safeAuthEmailErrorCode(error),
    };
  }
  return { ok: true, authUserId };
}

const workspaceAssignableRoles: readonly string[] = [
  "admin",
  "manager",
  "marketer",
  "cs",
  "designer",
  "viewer",
] as const;

function readWorkspaceMemberPermissions(formData: FormData, role: string) {
  const brandIds = [
    ...new Set(formData.getAll("brandIds").map(String).filter(Boolean)),
  ];
  const selectedModuleKeys = formData
    .getAll("moduleKeys")
    .map(String)
    .filter((value) =>
      workspaceModuleKeys.includes(value as (typeof workspaceModuleKeys)[number])
    );
  const moduleKeys =
    selectedModuleKeys.length > 0
      ? [...new Set(selectedModuleKeys)]
      : getWorkspaceRoleDefaultModules(normalizeWorkspaceRole(role));

  return { brandIds, moduleKeys };
}

function safeAuthEmailErrorCode(error: {
  code?: string;
  status?: number;
  message?: string;
} | null) {
  if (error?.status === 429) return "rate_limited";
  const combined = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
  if (combined.includes("smtp") || combined.includes("email")) {
    return "mail_provider_not_ready";
  }
  if (combined.includes("user") && combined.includes("exist")) {
    return "auth_user_conflict";
  }
  return "mail_provider_rejected";
}
