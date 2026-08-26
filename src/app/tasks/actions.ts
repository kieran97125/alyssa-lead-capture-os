"use server";

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
import type { WorkTaskPriority, WorkTaskStatus } from "@/lib/marketing/workTasks";

function readString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function readBool(formData: FormData, key: string) {
  return ["1", "true", "on", "yes"].includes(readString(formData, key).toLowerCase());
}

function safeReturnPath(value: string) {
  return value.startsWith("/tasks") || value.startsWith("/calendar")
    ? value
    : "/tasks";
}

function redirectResult(path: string, ok: boolean, message: string): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(
    `${path}${separator}command_status=${ok ? "success" : "error"}&message=${encodeURIComponent(message)}`
  );
}

async function requireTaskOperator(returnPath: string) {
  const verified = await verifyCurrentInternalAccess();
  if (!verified.ok) redirect(`/login?next=${encodeURIComponent(returnPath)}`);
  const moduleAccess = await requireModuleAccess("calendar");
  if (!moduleAccess.allowed) {
    redirectResult(returnPath, false, "你未獲授權使用工作事項。" );
  }
  if (!hasSupabaseAdminEnv()) {
    redirectResult(returnPath, false, "資料服務尚未連接，暫時未能更新工作事項。" );
  }
  return verified.access;
}

async function getAssignableMember(input: {
  memberId: string;
  brandId: string;
}) {
  if (!input.memberId) return null;
  const supabase = createSupabaseAdminClient();
  const memberResult = await supabase
    .from("workspace_members")
    .select("id,email,full_name,is_master,status")
    .eq("id", input.memberId)
    .maybeSingle();
  if (memberResult.error || !memberResult.data || memberResult.data.status === "removed") {
    return null;
  }
  if (memberResult.data.is_master) return memberResult.data;
  const accessResult = await supabase
    .from("workspace_member_brand_access")
    .select("id")
    .eq("member_id", input.memberId)
    .eq("brand_id", input.brandId)
    .eq("status", "active")
    .maybeSingle();
  if (accessResult.error || !accessResult.data) return null;
  return memberResult.data;
}

async function getAccessibleTask(taskId: string, access: Awaited<ReturnType<typeof verifyCurrentInternalAccess>> extends infer _T ? any : never) {
  void access;
  const supabase = createSupabaseAdminClient();
  const result = await supabase
    .from("marketing_work_tasks")
    .select("id,brand_id,title,status,assignee_member_id,assignee_email")
    .eq("id", taskId)
    .maybeSingle();
  return result;
}

function actorEmail(access: { email?: string; accessLevel: string }) {
  return access.email || (access.accessLevel === "master" ? "master" : "shared_admin");
}

async function insertNotification(input: {
  recipientMemberId: string | null;
  recipientEmail?: string | null;
  brandId: string;
  taskId?: string | null;
  calendarItemId?: string | null;
  type: string;
  title: string;
  body?: string | null;
  dedupeKey?: string | null;
}) {
  if (!input.recipientMemberId) return;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("marketing_notifications").insert({
    recipient_member_id: input.recipientMemberId,
    recipient_email: input.recipientEmail || null,
    brand_id: input.brandId,
    task_id: input.taskId || null,
    calendar_item_id: input.calendarItemId || null,
    notification_type: input.type,
    title: input.title,
    body: input.body || null,
    dedupe_key: input.dedupeKey || null,
  });
  if (error && error.code !== "23505") {
    console.warn("marketing_notification_insert_failed", {
      type: input.type,
      code: error.code,
    });
  }
}

function revalidateOps() {
  revalidatePath("/tasks");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/performance");
}

export async function createWorkTaskAction(formData: FormData) {
  const returnPath = safeReturnPath(readString(formData, "returnPath"));
  const access = await requireTaskOperator(returnPath);
  const brandId = readString(formData, "brandId");
  const title = readString(formData, "title");
  const description = readString(formData, "description") || null;
  const status = readString(formData, "status") as WorkTaskStatus;
  const priority = readString(formData, "priority") as WorkTaskPriority;
  const assigneeMemberId = readString(formData, "assigneeMemberId") || null;
  const dueDate = readString(formData, "dueDate") || null;
  const dueTime = readString(formData, "dueTime") || null;
  const treatmentId = readString(formData, "treatmentId") || null;
  const treatmentLabel = readString(formData, "treatmentLabel") || null;
  const performanceMarker = readBool(formData, "performanceMarker");
  const linkedCalendarItemId = readString(formData, "calendarItemId") || null;

  if (!brandId || !canAccessInternalBrand(access, brandId)) {
    redirectResult(returnPath, false, "你未獲授權建立呢個品牌嘅工作。" );
  }
  if (!title || title.length > 180 || (description?.length ?? 0) > 4000) {
    redirectResult(returnPath, false, "請檢查工作標題及內容。" );
  }
  if (!(["todo", "in_progress", "done"] as string[]).includes(status)) {
    redirectResult(returnPath, false, "請選擇有效工作狀態。" );
  }
  if (!(["low", "normal", "high"] as string[]).includes(priority)) {
    redirectResult(returnPath, false, "請選擇有效 Priority。" );
  }
  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    redirectResult(returnPath, false, "請檢查截止日期。" );
  }
  if (dueTime && !/^\d{2}:\d{2}/.test(dueTime)) {
    redirectResult(returnPath, false, "請檢查截止時間。" );
  }

  const assignee = assigneeMemberId
    ? await getAssignableMember({ memberId: assigneeMemberId, brandId })
    : null;
  if (assigneeMemberId && !assignee) {
    redirectResult(returnPath, false, "該同事未獲派呢個品牌權限，無法指派工作。" );
  }

  const supabase = createSupabaseAdminClient();
  if (linkedCalendarItemId) {
    const calendarResult = await supabase
      .from("marketing_calendar_items")
      .select("id,brand_id")
      .eq("id", linkedCalendarItemId)
      .eq("brand_id", brandId)
      .maybeSingle();
    if (calendarResult.error || !calendarResult.data) {
      redirectResult(returnPath, false, "相關營銷日曆事項不存在或品牌不一致。" );
    }
  }

  const { data: task, error } = await supabase
    .from("marketing_work_tasks")
    .insert({
      brand_id: brandId,
      treatment_id: treatmentId,
      treatment_label: treatmentLabel,
      title,
      description,
      status,
      priority,
      assignee_member_id: assigneeMemberId,
      assignee_email: assignee?.email || null,
      created_by_member_id: access.memberId || null,
      created_by_email: actorEmail(access),
      due_date: dueDate,
      due_time: dueTime,
      performance_marker: performanceMarker,
      completed_at: status === "done" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !task) {
    console.warn("marketing_work_task_create_failed", { code: error?.code });
    redirectResult(returnPath, false, "工作事項建立失敗，請稍後再試。" );
  }

  if (linkedCalendarItemId) {
    await supabase.from("marketing_task_calendar_links").insert({
      task_id: task.id,
      calendar_item_id: linkedCalendarItemId,
    });
  }
  await insertNotification({
    recipientMemberId: assigneeMemberId,
    recipientEmail: assignee?.email || null,
    brandId,
    taskId: task.id,
    type: "task_assigned",
    title: "你有新工作事項",
    body: title,
    dedupeKey: `task_assigned:${task.id}:${assigneeMemberId || "none"}`,
  });

  revalidateOps();
  redirectResult(returnPath, true, `已建立工作：${title}`);
}

export async function updateWorkTaskStatusAction(formData: FormData) {
  const returnPath = safeReturnPath(readString(formData, "returnPath"));
  const access = await requireTaskOperator(returnPath);
  const taskId = readString(formData, "taskId");
  const status = readString(formData, "status") as WorkTaskStatus;
  if (!taskId || !(["todo", "in_progress", "done"] as string[]).includes(status)) {
    redirectResult(returnPath, false, "工作更新資料不完整。" );
  }
  const taskResult = await getAccessibleTask(taskId, access);
  if (taskResult.error || !taskResult.data || !canAccessInternalBrand(access, taskResult.data.brand_id)) {
    redirectResult(returnPath, false, "你未獲授權更新呢項工作。" );
  }
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("marketing_work_tasks")
    .update({
      status,
      completed_at: status === "done" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);
  if (error) redirectResult(returnPath, false, "工作狀態更新失敗。" );

  if (taskResult.data.assignee_member_id && taskResult.data.assignee_member_id !== access.memberId) {
    await insertNotification({
      recipientMemberId: taskResult.data.assignee_member_id,
      recipientEmail: taskResult.data.assignee_email,
      brandId: taskResult.data.brand_id,
      taskId,
      type: "task_status_changed",
      title: "工作狀態已更新",
      body: `${taskResult.data.title} → ${status === "done" ? "完成" : status === "in_progress" ? "進行中" : "待辦"}`,
    });
  }
  revalidateOps();
  redirectResult(returnPath, true, "工作狀態已更新。" );
}

export async function assignWorkTaskAction(formData: FormData) {
  const returnPath = safeReturnPath(readString(formData, "returnPath"));
  const access = await requireTaskOperator(returnPath);
  const taskId = readString(formData, "taskId");
  const assigneeMemberId = readString(formData, "assigneeMemberId") || null;
  const taskResult = await getAccessibleTask(taskId, access);
  if (taskResult.error || !taskResult.data || !canAccessInternalBrand(access, taskResult.data.brand_id)) {
    redirectResult(returnPath, false, "你未獲授權重新指派呢項工作。" );
  }
  const assignee = assigneeMemberId
    ? await getAssignableMember({ memberId: assigneeMemberId, brandId: taskResult.data.brand_id })
    : null;
  if (assigneeMemberId && !assignee) {
    redirectResult(returnPath, false, "該同事未有呢個品牌權限。" );
  }
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("marketing_work_tasks")
    .update({
      assignee_member_id: assigneeMemberId,
      assignee_email: assignee?.email || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);
  if (error) redirectResult(returnPath, false, "重新指派失敗。" );
  await insertNotification({
    recipientMemberId: assigneeMemberId,
    recipientEmail: assignee?.email || null,
    brandId: taskResult.data.brand_id,
    taskId,
    type: "task_assigned",
    title: "你獲派一項工作",
    body: taskResult.data.title,
  });
  revalidateOps();
  redirectResult(returnPath, true, "負責人已更新。" );
}

export async function addWorkTaskCommentAction(formData: FormData) {
  const returnPath = safeReturnPath(readString(formData, "returnPath"));
  const access = await requireTaskOperator(returnPath);
  const taskId = readString(formData, "taskId");
  const body = readString(formData, "body");
  if (!body || body.length > 2000) {
    redirectResult(returnPath, false, "留言內容不可留空，最多 2,000 字。" );
  }
  const taskResult = await getAccessibleTask(taskId, access);
  if (taskResult.error || !taskResult.data || !canAccessInternalBrand(access, taskResult.data.brand_id)) {
    redirectResult(returnPath, false, "你未獲授權留言。" );
  }
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("marketing_task_comments").insert({
    task_id: taskId,
    author_member_id: access.memberId || null,
    author_email: actorEmail(access),
    body,
  });
  if (error) redirectResult(returnPath, false, "留言失敗。" );
  if (taskResult.data.assignee_member_id && taskResult.data.assignee_member_id !== access.memberId) {
    await insertNotification({
      recipientMemberId: taskResult.data.assignee_member_id,
      recipientEmail: taskResult.data.assignee_email,
      brandId: taskResult.data.brand_id,
      taskId,
      type: "task_comment",
      title: "工作有新留言",
      body: `${taskResult.data.title}：${body.slice(0, 120)}`,
    });
  }
  revalidatePath("/tasks");
  redirectResult(returnPath, true, "留言已加入。" );
}

export async function addWorkTaskToCalendarAction(formData: FormData) {
  const returnPath = safeReturnPath(readString(formData, "returnPath"));
  const access = await requireTaskOperator(returnPath);
  const taskId = readString(formData, "taskId");
  const taskResult = await createSupabaseAdminClient()
    .from("marketing_work_tasks")
    .select("id,brand_id,treatment_id,treatment_label,title,description,status,assignee_email,due_date,due_time")
    .eq("id", taskId)
    .maybeSingle();
  if (taskResult.error || !taskResult.data || !canAccessInternalBrand(access, taskResult.data.brand_id)) {
    redirectResult(returnPath, false, "你未獲授權將呢項工作加入日曆。" );
  }
  if (!taskResult.data.due_date) {
    redirectResult(returnPath, false, "請先為工作設定 Due Date，先可以同步至日曆。" );
  }
  const supabase = createSupabaseAdminClient();
  const existing = await supabase
    .from("marketing_task_calendar_links")
    .select("id")
    .eq("task_id", taskId)
    .limit(1);
  if (!existing.error && (existing.data?.length ?? 0) > 0) {
    redirectResult(returnPath, true, "呢項工作已經連結營銷日曆。" );
  }
  const { data: calendarItem, error } = await supabase
    .from("marketing_calendar_items")
    .insert({
      brand_id: taskResult.data.brand_id,
      treatment_id: taskResult.data.treatment_id,
      treatment_label: taskResult.data.treatment_label,
      title: taskResult.data.title,
      item_type: "task",
      channel: null,
      status: "scheduled",
      scheduled_date: taskResult.data.due_date,
      scheduled_time: taskResult.data.due_time,
      assignee_email: taskResult.data.assignee_email,
      notes: taskResult.data.description,
      show_on_performance_timeline: false,
    })
    .select("id")
    .single();
  if (error || !calendarItem) {
    redirectResult(returnPath, false, "未能建立相關日曆事項。" );
  }
  await supabase.from("marketing_task_calendar_links").insert({
    task_id: taskId,
    calendar_item_id: calendarItem.id,
  });
  revalidateOps();
  redirectResult(returnPath, true, "工作已加入營銷日曆。" );
}

export async function markWorkNotificationReadAction(formData: FormData) {
  const returnPath = safeReturnPath(readString(formData, "returnPath"));
  const access = await requireTaskOperator(returnPath);
  const notificationId = readString(formData, "notificationId");
  if (!notificationId || !access.memberId) {
    redirectResult(returnPath, true, "通知已處理。" );
  }
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("marketing_notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("recipient_member_id", access.memberId);
  if (error) redirectResult(returnPath, false, "未能更新通知。" );
  revalidatePath("/tasks");
  revalidatePath("/");
  redirectResult(returnPath, true, "通知已標記為已讀。" );
}
