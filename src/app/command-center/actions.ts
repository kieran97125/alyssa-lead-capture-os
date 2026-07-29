"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  adminSessionCookieName,
  verifySignedAdminSession,
} from "@/lib/security/internalAccess";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";
import {
  syncAllMarketingGoogleSheets,
  syncMarketingDataSource,
} from "@/lib/integrations/googleSheetsMarketingSync";
import { MASTER_ACCOUNT_EMAIL } from "@/lib/marketing/commandCenter";

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
  const cookieStore = await cookies();
  const session = await verifySignedAdminSession(
    cookieStore.get(adminSessionCookieName)?.value
  );
  if (!session.ok) {
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }
  if (options.masterOnly && session.accessLevel !== "master") {
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
    accessLevel: session.accessLevel,
  };
}

function revalidateCommandCenter() {
  [
    "/dashboard",
    "/kpis",
    "/calendar",
    "/data-sources",
    "/settings",
    "/settings/planning",
    "/settings/team",
  ].forEach((path) => revalidatePath(path));
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
  revalidateCommandCenter();
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
    createdAtColumn: readString(formData, "createdAtColumn") || "A",
    followStatusColumn: readString(formData, "followStatusColumn") || "B",
    brandColumn: readString(formData, "brandColumn") || "C",
    bookingDateColumn: readString(formData, "bookingDateColumn") || "J",
    confirmationDateColumn:
      readString(formData, "confirmationDateColumn") || "L",
    accountLabel: readString(formData, "accountLabel") || null,
  };
  const providesMetrics =
    providerKey === "google_sheets" && dataset === "daily_spend"
      ? ["spend"]
      : providerKey === "google_sheets" && dataset === "lead_funnel"
        ? ["leads", "bookings", "shows"]
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
  revalidateCommandCenter();
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
  revalidateCommandCenter();
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
  // Refreshing operational data is intentionally available to both the shared
  // Admin login and the Master login. Source mapping remains Master-only.
  const access = await ensureCommandCenterAction(returnPath);
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
    revalidateCommandCenter();
    redirectWithResult(returnPath, {
      ok: false,
      message: "數據重新整理失敗，請稍後再試或通知 Master 檢查資料來源。",
    });
  }

  if (results.length === 0) {
    revalidateCommandCenter();
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
  revalidateCommandCenter();
  redirectWithResult(returnPath, {
    ok: failed.length === 0,
    message:
      failed.length === 0
        ? `數據已重新整理：${results.length}/${results.length} 個來源成功，共更新 ${metricRows} 個每日指標。`
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
  revalidateCommandCenter();
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
  revalidateCommandCenter();
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
  const { data, error } = await supabase
    .from("marketing_calendar_items")
    .delete()
    .eq("id", itemId)
    .select(
      "id,brand_id,title,item_type,channel,status,scheduled_date,scheduled_time,assignee_email,notes,sort_order"
    )
    .single();
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
    entityId: data.id,
    brandId: data.brand_id,
    before: {
      title: data.title,
      itemType: data.item_type,
      channel: data.channel,
      status: data.status,
      scheduledDate: data.scheduled_date,
      scheduledTime: data.scheduled_time,
      assigneeEmail: data.assignee_email,
      notes: data.notes,
      sortOrder: data.sort_order,
    },
  });
  revalidateCommandCenter();
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
  if (!email.includes("@")) {
    redirectWithResult(returnPath, {
      ok: false,
      message: "請輸入有效電郵地址。",
    });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .insert({
      email,
      full_name: fullName || null,
      workspace_role: role,
      status: "invited",
      is_master: false,
    })
    .select("id")
    .single();
  if (error) {
    console.warn("workspace_member_create_failed", {
      code: error.code,
      message: error.message,
    });
    redirectWithResult(returnPath, {
      ok: false,
      message: "未能新增成員；請確認電郵未被使用。",
    });
  }

  const brandIds = formData.getAll("brandIds").map(String).filter(Boolean);
  if (brandIds.length > 0) {
    await supabase.from("workspace_member_brand_access").insert(
      brandIds.map((brandId) => ({
        member_id: data.id,
        brand_id: brandId,
        status: "active",
      }))
    );
  }
  const moduleKeys = formData
    .getAll("moduleKeys")
    .map(String)
    .filter(Boolean);
  if (moduleKeys.length > 0) {
    await supabase.from("workspace_member_module_permissions").insert(
      moduleKeys.map((moduleKey) => ({
        member_id: data.id,
        module_key: moduleKey,
        can_access: true,
      }))
    );
  }

  await writeAudit({
    action: "workspace_member.invited",
    entityType: "workspace_member",
    entityId: data.id,
    after: { email, role, brandIds, moduleKeys },
  });
  revalidateCommandCenter();
  redirectWithResult(returnPath, {
    ok: true,
    message:
      "成員權限設定已建立；電郵登入切換完成前，系統不會自動寄出邀請。",
  });
}
