"use server";

import { revalidatePath } from "next/cache";
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
  editableCalendarItemTypes,
  editableCalendarStatuses,
  type CalendarItemUpdateInput,
  type CalendarItemUpdateResult,
} from "@/lib/marketing/calendarEdit";
import type { CalendarItem } from "@/lib/marketing/commandCenter";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^\d{2}:\d{2}$/;

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function nullableText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseCalendarItem(value: unknown): CalendarItem | null {
  const row = recordValue(value);
  const id = nullableText(row.id);
  const brandId = nullableText(row.brandId);
  const title = nullableText(row.title);
  const scheduledDate = nullableText(row.scheduledDate);
  if (!id || !brandId || !title || !scheduledDate) return null;

  return {
    id,
    brandId,
    treatmentId: nullableText(row.treatmentId),
    treatmentLabel: nullableText(row.treatmentLabel),
    title,
    itemType: String(row.itemType || "post") as CalendarItem["itemType"],
    channel: nullableText(row.channel),
    status: String(row.status || "idea") as CalendarItem["status"],
    scheduledDate,
    scheduledTime: nullableText(row.scheduledTime),
    assigneeEmail: nullableText(row.assigneeEmail),
    notes: nullableText(row.notes),
    sortOrder: Number(row.sortOrder || 0),
    showOnPerformanceTimeline: row.showOnPerformanceTimeline !== false,
    updatedAt: nullableText(row.updatedAt),
  };
}

function errorMessage(message: string) {
  if (message.includes("calendar_item_not_found")) {
    return "搵唔到呢個日曆事項，可能已經被刪除。";
  }
  if (message.includes("stale_calendar_item")) {
    return "呢個事項啱啱被另一位同事更新。請重新整理日曆，再套用你嘅修改。";
  }
  if (message.includes("calendar_treatment_brand_mismatch")) {
    return "所選療程唔屬於呢個品牌。";
  }
  if (message.includes("calendar_before_linked_task_start")) {
    return "新日期早過連結工作嘅 Start Day；請先調整工作開始日。";
  }
  if (message.includes("calendar_before_creative_due")) {
    return "出街日期早過連結設計 Job 嘅 Due Day；請先去設計工作調整交稿日期。";
  }
  if (message.includes("invalid_calendar_item_payload")) {
    return "請檢查事項名稱、日期、時間及其他欄位。";
  }
  if (message.includes("PGRST202")) {
    return "日曆編輯資料層尚未完成設定，請通知系統管理員。";
  }
  return "日曆事項未能更新，請稍後再試。";
}

export async function updateCalendarItemAction(
  input: CalendarItemUpdateInput
): Promise<CalendarItemUpdateResult> {
  const verified = await verifyCurrentInternalAccess();
  if (!verified.ok) {
    return { ok: false, message: "登入已失效，請重新登入。" };
  }
  const moduleAccess = await requireModuleAccess("calendar");
  if (!moduleAccess.allowed) {
    return { ok: false, message: "你未獲授權修改營銷日曆。" };
  }
  if (!hasSupabaseAdminEnv()) {
    return { ok: false, message: "日曆資料服務尚未連接。" };
  }

  const title = String(input.title || "").trim();
  const channel = nullableText(input.channel);
  const assigneeEmail = nullableText(input.assigneeEmail)?.toLowerCase() || null;
  const notes = nullableText(input.notes);
  const expectedUpdatedAt = nullableText(input.expectedUpdatedAt);

  if (
    !uuidPattern.test(String(input.itemId || "")) ||
    !uuidPattern.test(String(input.brandId || "")) ||
    (input.treatmentId && !uuidPattern.test(input.treatmentId)) ||
    title.length < 1 ||
    title.length > 180 ||
    (channel?.length || 0) > 120 ||
    (assigneeEmail?.length || 0) > 320 ||
    (assigneeEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(assigneeEmail)) ||
    (notes?.length || 0) > 4000 ||
    !datePattern.test(String(input.scheduledDate || "")) ||
    (input.scheduledTime && !timePattern.test(input.scheduledTime)) ||
    !editableCalendarItemTypes.includes(input.itemType) ||
    !editableCalendarStatuses.includes(input.status) ||
    (expectedUpdatedAt !== null && Number.isNaN(Date.parse(expectedUpdatedAt)))
  ) {
    return { ok: false, message: "請檢查事項名稱、日期、時間及其他欄位。" };
  }

  if (!canAccessInternalBrand(verified.access, input.brandId)) {
    return { ok: false, message: "你未獲授權修改所選品牌嘅日曆。" };
  }

  const supabase = createSupabaseAdminClient();
  if (input.treatmentId) {
    const treatment = await supabase
      .from("treatments")
      .select("id")
      .eq("id", input.treatmentId)
      .eq("brand_id", input.brandId)
      .maybeSingle();
    if (treatment.error || !treatment.data) {
      return { ok: false, message: "所選療程唔屬於呢個品牌。" };
    }
  }

  const { data, error } = await supabase.rpc(
    "update_marketing_calendar_item_with_links",
    {
      p_item_id: input.itemId,
      p_expected_updated_at: expectedUpdatedAt,
      p_payload: {
        brandId: input.brandId,
        treatmentId: input.treatmentId || "",
        title,
        itemType: input.itemType,
        channel: channel || "",
        status: input.status,
        scheduledDate: input.scheduledDate,
        scheduledTime: input.scheduledTime || "",
        assigneeEmail: assigneeEmail || "",
        notes: notes || "",
        showOnPerformanceTimeline: input.showOnPerformanceTimeline,
      },
      p_actor_member_id: verified.access.memberId || null,
      p_actor_email:
        verified.access.email ||
        (verified.access.accessLevel === "master" ? "master" : "shared_admin"),
    }
  );

  if (error) {
    console.warn("marketing_calendar_item_update_failed", {
      code: error.code,
      message: error.message,
    });
    return { ok: false, message: errorMessage(`${error.code || ""} ${error.message}`) };
  }

  const result = recordValue(data);
  const item = parseCalendarItem(result.item);
  if (!item) {
    return { ok: false, message: "日曆事項已儲存，但未能即時更新畫面；請重新整理。" };
  }

  revalidatePath("/calendar");
  revalidatePath("/tasks");
  revalidatePath("/creative-jobs");
  revalidatePath("/dashboard");
  revalidatePath("/performance");
  revalidatePath("/performance/compare");

  const linkedTaskCount = Number(result.linkedTaskCount || 0);
  const linkedCreativeJobCount = Number(result.linkedCreativeJobCount || 0);
  const linkedParts = [
    linkedTaskCount > 0 ? `${linkedTaskCount} 項工作` : "",
    linkedCreativeJobCount > 0 ? `${linkedCreativeJobCount} 張設計 Job` : "",
  ].filter(Boolean);

  return {
    ok: true,
    message:
      linkedParts.length > 0
        ? `日曆事項已更新，並同步 ${linkedParts.join("及")}。`
        : "日曆事項已更新。",
    item,
    linkedTaskCount,
    linkedCreativeJobCount,
  };
}
