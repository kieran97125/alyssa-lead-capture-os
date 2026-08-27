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

function readString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function readBool(formData: FormData, key: string) {
  return ["1", "true", "on", "yes"].includes(readString(formData, key).toLowerCase());
}

function safeReturnPath(value: string) {
  return value.startsWith("/calendar") ? value : "/calendar";
}

function redirectResult(path: string, ok: boolean, message: string): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}command_status=${ok ? "success" : "error"}&message=${encodeURIComponent(message)}`);
}

async function resolveAssignableMember(email: string, brandId: string) {
  if (!email) return null;
  const supabase = createSupabaseAdminClient();
  const member = await supabase
    .from("workspace_members")
    .select("id,email,full_name,is_master,status")
    .ilike("email", email)
    .maybeSingle();
  if (member.error || !member.data || member.data.status === "removed") return null;
  if (member.data.is_master) return member.data;
  const access = await supabase
    .from("workspace_member_brand_access")
    .select("id")
    .eq("member_id", member.data.id)
    .eq("brand_id", brandId)
    .eq("status", "active")
    .maybeSingle();
  return !access.error && access.data ? member.data : null;
}

export async function createConnectedCalendarItemAction(formData: FormData) {
  const returnPath = safeReturnPath(readString(formData, "returnPath"));
  const verified = await verifyCurrentInternalAccess();
  if (!verified.ok) redirect(`/login?next=${encodeURIComponent(returnPath)}`);
  const moduleAccess = await requireModuleAccess("calendar");
  if (!moduleAccess.allowed) redirectResult(returnPath, false, "你未獲授權修改營銷日曆。" );
  if (!hasSupabaseAdminEnv()) redirectResult(returnPath, false, "日曆資料服務尚未連接。" );

  const brandId = readString(formData, "brandId");
  const treatmentId = readString(formData, "treatmentId") || null;
  const title = readString(formData, "title");
  const itemType = readString(formData, "itemType") || "post";
  const channel = readString(formData, "channel") || null;
  const scheduledDate = readString(formData, "scheduledDate");
  const scheduledTime = readString(formData, "scheduledTime") || null;
  const status = readString(formData, "status") || "idea";
  const assigneeEmail = readString(formData, "assigneeEmail") || null;
  const notes = readString(formData, "notes") || null;
  const showOnTimeline = readBool(formData, "showOnPerformanceTimeline");
  const createTask = readBool(formData, "createTask");
  const taskPriority = readString(formData, "taskPriority") || "normal";

  if (!brandId || !canAccessInternalBrand(verified.access, brandId)) {
    redirectResult(returnPath, false, "你未獲授權修改呢個品牌嘅日曆。" );
  }
  if (!title || title.length > 180 || !/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
    redirectResult(returnPath, false, "請檢查事項名稱及日期。" );
  }
  if (!(["idea", "scheduled", "published"] as string[]).includes(status)) {
    redirectResult(returnPath, false, "日曆狀態只可以係 Idea、Scheduled 或 Published。" );
  }
  if (!(["post", "ad", "landing_page", "email", "meeting", "task"] as string[]).includes(itemType)) {
    redirectResult(returnPath, false, "請選擇有效事項類型。" );
  }
  if (scheduledTime && !/^\d{2}:\d{2}/.test(scheduledTime)) {
    redirectResult(returnPath, false, "請檢查排定時間。" );
  }
  if (!(["low", "normal", "high"] as string[]).includes(taskPriority)) {
    redirectResult(returnPath, false, "請選擇有效工作 Priority。" );
  }

  const supabase = createSupabaseAdminClient();
  let treatmentLabel: string | null = null;
  if (treatmentId) {
    const treatment = await supabase
      .from("treatments")
      .select("id,brand_id,name")
      .eq("id", treatmentId)
      .eq("brand_id", brandId)
      .maybeSingle();
    if (treatment.error || !treatment.data) {
      redirectResult(returnPath, false, "所選療程唔屬於呢個品牌。" );
    }
    treatmentLabel = String(treatment.data.name ?? "").trim() || null;
  }

  const { data: calendarItem, error } = await supabase
    .from("marketing_calendar_items")
    .insert({
      brand_id: brandId,
      treatment_id: treatmentId,
      treatment_label: treatmentLabel,
      title,
      item_type: itemType,
      channel,
      status,
      scheduled_date: scheduledDate,
      scheduled_time: scheduledTime,
      assignee_email: assigneeEmail,
      notes,
      published_at: status === "published" ? new Date().toISOString() : null,
      auto_published_at: null,
      show_on_performance_timeline: showOnTimeline,
    })
    .select("id")
    .single();
  if (error || !calendarItem) {
    console.warn("connected_calendar_item_create_failed", { code: error?.code });
    redirectResult(returnPath, false, "日曆事項建立失敗。" );
  }

  if (createTask) {
    const assignee = assigneeEmail
      ? await resolveAssignableMember(assigneeEmail, brandId)
      : null;
    const { data: task, error: taskError } = await supabase
      .from("marketing_work_tasks")
      .insert({
        brand_id: brandId,
        treatment_id: treatmentId,
        treatment_label: treatmentLabel,
        title,
        description: notes,
        status: status === "published" ? "done" : "todo",
        priority: taskPriority,
        assignee_member_id: assignee?.id || null,
        assignee_email: assignee?.email || assigneeEmail,
        created_by_member_id: verified.access.memberId || null,
        created_by_email:
          verified.access.email ||
          (verified.access.accessLevel === "master" ? "master" : "shared_admin"),
        due_date: scheduledDate,
        due_time: scheduledTime,
        performance_marker: false,
        completed_at: status === "published" ? new Date().toISOString() : null,
      })
      .select("id")
      .single();
    if (!taskError && task) {
      await supabase.from("marketing_task_calendar_links").insert({
        task_id: task.id,
        calendar_item_id: calendarItem.id,
      });
      if (assignee?.id) {
        await supabase.from("marketing_notifications").insert({
          recipient_member_id: assignee.id,
          recipient_email: assignee.email,
          brand_id: brandId,
          task_id: task.id,
          calendar_item_id: calendarItem.id,
          notification_type: "task_assigned",
          title: "你有新工作事項",
          body: title,
          dedupe_key: `calendar_task_assigned:${calendarItem.id}:${assignee.id}`,
        });
      }
    } else {
      console.warn("connected_calendar_task_create_failed", { code: taskError?.code });
    }
  }

  revalidatePath("/calendar");
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/performance");
  redirectResult(
    returnPath,
    true,
    status === "scheduled"
      ? `${title} 已排期；${scheduledTime ? `到 ${scheduledTime.slice(0, 5)} HKT` : "冇填時間會於當日 12:00 HKT"} 自動轉 Published。`
      : `${title} 已加入日曆。`
  );
}
