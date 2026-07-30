"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  canAccessInternalBrand,
  requireModuleAccess,
  verifyCurrentInternalAccess,
} from "@/lib/security/internalAccessServer";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";
import {
  getAuthConfirmUrl,
  getSupabasePublicAuthConfig,
  isWorkspaceAuthSmtpVerified,
} from "@/lib/supabase/authConfig";
import {
  syncAllMarketingGoogleSheets,
  syncMarketingDataSource,
} from "@/lib/integrations/googleSheetsMarketingSync";
import { MASTER_ACCOUNT_EMAIL } from "@/lib/marketing/commandCenter";
import {
  getWorkspaceRoleDefaultModules,
  normalizeWorkspaceRole,
} from "@/lib/security/workspacePermissions";
import { workspaceModuleKeys } from "@/lib/security/workspaceAuth";

type ActionResult = {
  ok: boolean;
  message: string;
};

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
    "/settings/planning",
    "/settings/team",
  ];
  return allowed.some((prefix) => value === prefix || value.startsWith(`${prefix}?`))
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

export async function createDataSourceAction(formData: FormData) {
  const returnPath = "/data-sources";
  const access = await ensureCommandCenterAction(returnPath, {
    masterOnly: true,
  });
  if (!access.ok) redirectWithResult(returnPath, access);

  const providerKey = readString(formData, "providerKey");
  const displayName = readString(formData, "displayName");
  const brandId = readString(formData, "brandId") || null;
  if (!displayName || !providerKey) {
    redirectWithResult(returnPath, {
      ok: false,
      message: "請填寫資料來源名稱及類型。",
    });
  }

  const dataset = readString(formData, "dataset");
  if (
    providerKey === "google_sheets" &&
    !["daily_spend", "lead_funnel"].includes(dataset)
  ) {
    redirectWithResult(returnPath, {
      ok: false,
      message: "請選擇 Google Sheet Dataset Profile。",
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
  if (
    providerKey === "google_sheets" &&
    dataset === "daily_spend" &&
    !brandId
  ) {
    redirectWithResult(returnPath, {
      ok: false,
      message: "每日廣告費來源必須指定品牌。",
    });
  }

  const configuredHeaderRow = readNumber(formData, "headerRow");
  const configuration = {
    dataset: dataset || null,
    spreadsheetId: readString(formData, "sheetId") || null,
    tabName: readString(formData, "tabName") || null,
    headerRow:
      configuredHeaderRow ||
      (dataset === "lead_funnel" ? 1 : dataset === "daily_spend" ? 3 : null),
    maxRows: readNumber(formData, "maxRows") || 5000,
    dateColumn: readString(formData, "dateColumn") || "A",
    spendColumn: readString(formData, "spendColumn") || "N",
    lastColumn: readString(formData, "lastColumn") || "V",
    accountLabel: readString(formData, "accountLabel") || null,
  };
  const providesMetrics =
    providerKey === "google_sheets" && dataset === "daily_spend"
      ? ["spend"]
      : providerKey === "google_sheets" && dataset === "lead_funnel"
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
      message: "數據重新整理失敗，請稍後再試或通知 Master 檢查資料來源。",
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
      message: "未有可同步嘅 Google Sheets 資料來源。",
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
        ? `數據已重新整理：${results.length}/${results.length} 個來源成功，共更新 ${metricRows} 個每日指標及 ${analysisRows} 個療程成效組合。`
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
  const allowedRoles = new Set([
    "admin",
    "manager",
    "marketer",
    "cs",
    "designer",
    "viewer",
  ]);
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
  const { data: existing, error: existingError } = await supabase
    .from("workspace_members")
    .select("id,auth_user_id,is_master,status,workspace_role")
    .ilike("email", email)
    .maybeSingle();
  if (existingError) {
    redirectWithResult(returnPath, {
      ok: false,
      message: "未能核對現有成員，請稍後再試。",
    });
  }

  let memberId = existing?.id ? String(existing.id) : "";
  const now = new Date().toISOString();
  if (memberId) {
    const { error } = await supabase
      .from("workspace_members")
      .update({
        full_name: fullName || null,
        workspace_role: existing?.is_master ? "owner" : role,
        status: existing?.is_master ? existing.status : "invited",
        invited_by_member_id: access.memberId,
        invited_by_email: access.actorIdentifier,
        updated_at: now,
      })
      .eq("id", memberId);
    if (error) {
      redirectWithResult(returnPath, {
        ok: false,
        message: "未能更新成員權限。",
      });
    }
  } else {
    const { data, error } = await supabase
      .from("workspace_members")
      .insert({
        email,
        full_name: fullName || null,
        workspace_role: role,
        status: "invited",
        is_master: false,
        invited_by_member_id: access.memberId,
        invited_by_email: access.actorIdentifier,
      })
      .select("id")
      .single();
    if (error || !data?.id) {
      console.warn("workspace_member_create_failed", {
        code: error?.code,
      });
      redirectWithResult(returnPath, {
        ok: false,
        message: "未能新增成員；請確認電郵未被使用。",
      });
    }
    memberId = String(data.id);
  }

  const brandIds = [
    ...new Set(formData.getAll("brandIds").map(String).filter(Boolean)),
  ];
  await supabase
    .from("workspace_member_brand_access")
    .delete()
    .eq("member_id", memberId);
  if (brandIds.length > 0) {
    const { error } = await supabase.from("workspace_member_brand_access").insert(
      brandIds.map((brandId) => ({
        member_id: memberId,
        brand_id: brandId,
        status: "active",
      }))
    );
    if (error) {
      redirectWithResult(returnPath, {
        ok: false,
        message: "成員已建立，但品牌權限未能儲存。",
      });
    }
  }
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
  await supabase
    .from("workspace_member_module_permissions")
    .delete()
    .eq("member_id", memberId);
  if (moduleKeys.length > 0) {
    const { error } = await supabase.from("workspace_member_module_permissions").insert(
      moduleKeys.map((moduleKey) => ({
        member_id: memberId,
        module_key: moduleKey,
        can_access: true,
      }))
    );
    if (error) {
      redirectWithResult(returnPath, {
        ok: false,
        message: "成員已建立，但模組權限未能儲存。",
      });
    }
  }

  const invite = await sendWorkspaceAccessEmail({
    email,
    fullName,
    existingAuthUserId:
      typeof existing?.auth_user_id === "string" ? existing.auth_user_id : null,
  });
  if (!invite.ok) {
    await supabase
      .from("workspace_members")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", memberId);
    redirectWithResult(returnPath, {
      ok: false,
      message:
        "權限已儲存，但邀請電郵未能寄出。請確認 Supabase Auth 已設定 Production SMTP，再按「重發邀請」。",
    });
  }

  await supabase
    .from("workspace_members")
    .update({
      auth_user_id: invite.authUserId,
      invite_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", memberId);

  await writeAudit({
    actorIdentifier: access.actorIdentifier,
    action: "workspace_member.invited",
    entityType: "workspace_member",
    entityId: memberId,
    after: { email, role, brandIds, moduleKeys },
  });
  revalidateCommandCenter("/settings/team");
  redirectWithResult(returnPath, {
    ok: true,
    message: `邀請已寄到 ${email}；對方按一次性連結後會按你設定嘅角色進入。`,
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
      message: "搵唔到可重發嘅成員邀請。",
    });
  }

  const result = await sendWorkspaceAccessEmail({
    email: String(member.email),
    fullName: String(member.full_name || ""),
    existingAuthUserId:
      typeof member.auth_user_id === "string" ? member.auth_user_id : null,
  });
  if (!result.ok) {
    redirectWithResult(returnPath, {
      ok: false,
      message: "未能重發邀請；請確認 Production SMTP 及稍後再試。",
    });
  }

  await supabase
    .from("workspace_members")
    .update({
      auth_user_id: result.authUserId,
      invite_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", memberId);
  await writeAudit({
    actorIdentifier: access.actorIdentifier,
    action: "workspace_member.invite_resent",
    entityType: "workspace_member",
    entityId: memberId,
  });
  revalidateCommandCenter("/settings/team");
  redirectWithResult(returnPath, {
    ok: true,
    message: `已重發安全登入連結到 ${member.email}。`,
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

  const now = new Date().toISOString();
  await Promise.all([
    supabase
      .from("workspace_members")
      .update({ status: "removed", updated_at: now })
      .eq("id", memberId),
    supabase
      .from("workspace_member_brand_access")
      .update({ status: "removed", updated_at: now })
      .eq("member_id", memberId),
  ]);
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
  | { ok: false; authUserId: null }
> {
  const config = getSupabasePublicAuthConfig();
  if (!config.ready || !isWorkspaceAuthSmtpVerified()) {
    return { ok: false, authUserId: null };
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
      return { ok: false, authUserId: null };
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
    return { ok: false, authUserId: null };
  }
  return { ok: true, authUserId };
}
