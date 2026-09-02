from __future__ import annotations

import json
import re
import textwrap
from pathlib import Path


def write(path: str, content: str) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(textwrap.dedent(content).lstrip(), encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one occurrence, found {count}: {old[:100]!r}")
    target.write_text(text.replace(old, new, 1), encoding="utf-8")


def regex_replace_once(path: str, pattern: str, replacement: str) -> None:
    target = Path(path)
    text = target.read_text(encoding="utf-8")
    next_text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"{path}: regex replacement count was {count}: {pattern[:100]!r}")
    target.write_text(next_text, encoding="utf-8")


def append_once(path: str, marker: str, content: str) -> None:
    target = Path(path)
    text = target.read_text(encoding="utf-8")
    if marker in text:
        return
    target.write_text(text.rstrip() + "\n\n" + textwrap.dedent(content).strip() + "\n", encoding="utf-8")


# Shared types for the client dialog and server action.
write(
    "src/lib/marketing/calendarEdit.ts",
    r'''
    import type { CalendarItem } from "@/lib/marketing/commandCenter";

    export const editableCalendarItemTypes = [
      "post",
      "ad",
      "landing_page",
      "email",
      "meeting",
      "task",
    ] as const;

    export type EditableCalendarItemType =
      (typeof editableCalendarItemTypes)[number];

    export const editableCalendarStatuses = [
      "idea",
      "scheduled",
      "published",
    ] as const;

    export type EditableCalendarStatus =
      (typeof editableCalendarStatuses)[number];

    export type CalendarTreatmentOption = {
      id: string;
      brandId: string;
      name: string;
    };

    export type CalendarItemUpdateInput = {
      itemId: string;
      expectedUpdatedAt: string | null;
      brandId: string;
      treatmentId: string | null;
      title: string;
      itemType: EditableCalendarItemType;
      channel: string | null;
      status: EditableCalendarStatus;
      scheduledDate: string;
      scheduledTime: string | null;
      assigneeEmail: string | null;
      notes: string | null;
      showOnPerformanceTimeline: boolean;
    };

    export type CalendarItemUpdateResult = {
      ok: boolean;
      message: string;
      item?: CalendarItem;
      linkedTaskCount?: number;
      linkedCreativeJobCount?: number;
    };
    ''',
)

# Server action: permission checks stay in the app; one RPC owns the atomic write.
write(
    "src/app/calendar/updateAction.ts",
    r'''
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
    ''',
)

# Atomic database transaction for Calendar + Task + Creative Job consistency.
write(
    "supabase/migrations/20260902024000_editable_marketing_calendar_items.sql",
    r'''
    -- Editable Marketing Calendar Items
    -- Atomically updates a Calendar item and all operational records that own
    -- the same publish schedule. App-server permission and brand checks remain
    -- mandatory before the service-role RPC is called.

    create or replace function public.update_marketing_calendar_item_with_links(
      p_item_id uuid,
      p_expected_updated_at timestamptz,
      p_payload jsonb,
      p_actor_member_id uuid,
      p_actor_email text
    )
    returns jsonb
    language plpgsql
    security definer
    set search_path = public, pg_temp
    as $$
    declare
      v_existing public.marketing_calendar_items%rowtype;
      v_updated public.marketing_calendar_items%rowtype;
      v_brand_id uuid;
      v_treatment_id uuid;
      v_treatment_label text;
      v_title text;
      v_item_type text;
      v_channel text;
      v_status text;
      v_scheduled_date date;
      v_scheduled_time time;
      v_assignee_email text;
      v_assignee_member_id uuid;
      v_notes text;
      v_show_on_timeline boolean;
      v_linked_task_count integer := 0;
      v_linked_creative_count integer := 0;
    begin
      if p_item_id is null or p_payload is null then
        raise exception using errcode = '22023', message = 'invalid_calendar_item_payload';
      end if;

      select * into v_existing
      from public.marketing_calendar_items
      where id = p_item_id
      for update;

      if not found then
        raise exception using errcode = 'P0002', message = 'calendar_item_not_found';
      end if;

      if p_expected_updated_at is not null
         and v_existing.updated_at is distinct from p_expected_updated_at then
        raise exception using errcode = '40001', message = 'stale_calendar_item';
      end if;

      begin
        v_brand_id := nullif(p_payload ->> 'brandId', '')::uuid;
        v_treatment_id := nullif(p_payload ->> 'treatmentId', '')::uuid;
        v_title := btrim(coalesce(p_payload ->> 'title', ''));
        v_item_type := coalesce(nullif(p_payload ->> 'itemType', ''), 'post');
        v_channel := nullif(btrim(coalesce(p_payload ->> 'channel', '')), '');
        v_status := coalesce(nullif(p_payload ->> 'status', ''), 'idea');
        v_scheduled_date := nullif(p_payload ->> 'scheduledDate', '')::date;
        v_scheduled_time := nullif(p_payload ->> 'scheduledTime', '')::time;
        v_assignee_email := nullif(lower(btrim(coalesce(p_payload ->> 'assigneeEmail', ''))), '');
        v_notes := nullif(btrim(coalesce(p_payload ->> 'notes', '')), '');
        v_show_on_timeline := coalesce(
          (p_payload ->> 'showOnPerformanceTimeline')::boolean,
          true
        );
      exception when others then
        raise exception using errcode = '22023', message = 'invalid_calendar_item_payload';
      end;

      if v_brand_id is null
         or v_scheduled_date is null
         or char_length(v_title) not between 1 and 180
         or v_item_type not in ('post', 'ad', 'landing_page', 'email', 'meeting', 'task')
         or v_status not in ('idea', 'scheduled', 'published')
         or coalesce(char_length(v_channel), 0) > 120
         or coalesce(char_length(v_assignee_email), 0) > 320
         or coalesce(char_length(v_notes), 0) > 4000 then
        raise exception using errcode = '22023', message = 'invalid_calendar_item_payload';
      end if;

      if not exists (select 1 from public.brands where id = v_brand_id) then
        raise exception using errcode = '23503', message = 'calendar_brand_not_found';
      end if;

      if v_treatment_id is not null then
        select treatment.name into v_treatment_label
        from public.treatments treatment
        where treatment.id = v_treatment_id
          and treatment.brand_id = v_brand_id;
        if not found then
          raise exception using errcode = '23514', message = 'calendar_treatment_brand_mismatch';
        end if;
      else
        v_treatment_label := null;
      end if;

      if exists (
        select 1
        from public.marketing_task_calendar_links link
        join public.marketing_work_tasks task on task.id = link.task_id
        where link.calendar_item_id = p_item_id
          and task.start_date > v_scheduled_date
      ) then
        raise exception using errcode = '23514', message = 'calendar_before_linked_task_start';
      end if;

      if exists (
        select 1
        from public.creative_jobs job
        where job.calendar_item_id = p_item_id
          and job.deleted_at is null
          and job.due_date is not null
          and job.due_date > v_scheduled_date
      ) then
        raise exception using errcode = '23514', message = 'calendar_before_creative_due';
      end if;

      select member.id into v_assignee_member_id
      from public.workspace_members member
      where v_assignee_email is not null
        and lower(member.email) = v_assignee_email
        and member.status = 'active'
        and (
          member.is_master
          or exists (
            select 1
            from public.workspace_member_brand_access access
            where access.member_id = member.id
              and access.brand_id = v_brand_id
              and access.status = 'active'
          )
        )
      order by member.is_master desc
      limit 1;

      update public.marketing_calendar_items
      set
        brand_id = v_brand_id,
        treatment_id = v_treatment_id,
        treatment_label = v_treatment_label,
        title = v_title,
        item_type = v_item_type,
        channel = v_channel,
        status = v_status,
        scheduled_date = v_scheduled_date,
        scheduled_time = v_scheduled_time,
        assignee_email = v_assignee_email,
        notes = v_notes,
        show_on_performance_timeline = v_show_on_timeline,
        published_at = case
          when v_status = 'published' and v_existing.status = 'published'
            then coalesce(v_existing.published_at, now())
          when v_status = 'published'
            then now()
          else null
        end,
        auto_published_at = case
          when v_status = 'published' and v_existing.status = 'published'
            then v_existing.auto_published_at
          else null
        end,
        updated_at = now()
      where id = p_item_id
      returning * into v_updated;

      insert into public.marketing_command_center_audit (
        actor_email,
        action,
        entity_type,
        entity_id,
        brand_id,
        before_json,
        after_json
      ) values (
        nullif(btrim(coalesce(p_actor_email, '')), ''),
        'calendar_item.updated',
        'marketing_calendar_item',
        p_item_id::text,
        v_brand_id,
        jsonb_build_object(
          'brandId', v_existing.brand_id,
          'treatmentId', v_existing.treatment_id,
          'treatmentLabel', v_existing.treatment_label,
          'title', v_existing.title,
          'itemType', v_existing.item_type,
          'channel', v_existing.channel,
          'status', v_existing.status,
          'scheduledDate', v_existing.scheduled_date,
          'scheduledTime', v_existing.scheduled_time,
          'assigneeEmail', v_existing.assignee_email,
          'notes', v_existing.notes,
          'showOnPerformanceTimeline', v_existing.show_on_performance_timeline,
          'updatedAt', v_existing.updated_at
        ),
        jsonb_build_object(
          'brandId', v_updated.brand_id,
          'treatmentId', v_updated.treatment_id,
          'treatmentLabel', v_updated.treatment_label,
          'title', v_updated.title,
          'itemType', v_updated.item_type,
          'channel', v_updated.channel,
          'status', v_updated.status,
          'scheduledDate', v_updated.scheduled_date,
          'scheduledTime', v_updated.scheduled_time,
          'assigneeEmail', v_updated.assignee_email,
          'notes', v_updated.notes,
          'showOnPerformanceTimeline', v_updated.show_on_performance_timeline,
          'updatedAt', v_updated.updated_at
        )
      );

      update public.marketing_work_tasks task
      set
        brand_id = v_brand_id,
        treatment_id = v_treatment_id,
        treatment_label = v_treatment_label,
        title = v_title,
        description = v_notes,
        assignee_member_id = v_assignee_member_id,
        assignee_email = v_assignee_email,
        due_date = v_scheduled_date,
        due_time = v_scheduled_time,
        updated_at = now()
      where task.id in (
        select link.task_id
        from public.marketing_task_calendar_links link
        where link.calendar_item_id = p_item_id
      );
      get diagnostics v_linked_task_count = row_count;

      insert into public.creative_job_audit (
        job_id,
        actor_member_id,
        actor_email,
        action,
        before_json,
        after_json
      )
      select
        job.id,
        p_actor_member_id,
        nullif(btrim(coalesce(p_actor_email, '')), ''),
        'calendar_item.updated',
        jsonb_build_object(
          'brandId', job.brand_id,
          'treatmentId', job.treatment_id,
          'treatmentLabel', job.treatment_label,
          'title', job.title,
          'publishDate', job.publish_date,
          'publishTime', job.publish_time
        ),
        jsonb_build_object(
          'brandId', v_brand_id,
          'treatmentId', v_treatment_id,
          'treatmentLabel', v_treatment_label,
          'title', v_title,
          'publishDate', v_scheduled_date,
          'publishTime', v_scheduled_time
        )
      from public.creative_jobs job
      where job.calendar_item_id = p_item_id
        and job.deleted_at is null;

      update public.creative_jobs job
      set
        brand_id = v_brand_id,
        treatment_id = v_treatment_id,
        treatment_label = v_treatment_label,
        title = v_title,
        publish_date = v_scheduled_date,
        publish_time = v_scheduled_time,
        sync_calendar = true,
        updated_at = now()
      where job.calendar_item_id = p_item_id
        and job.deleted_at is null;
      get diagnostics v_linked_creative_count = row_count;

      return jsonb_build_object(
        'item', jsonb_build_object(
          'id', v_updated.id,
          'brandId', v_updated.brand_id,
          'treatmentId', v_updated.treatment_id,
          'treatmentLabel', v_updated.treatment_label,
          'title', v_updated.title,
          'itemType', v_updated.item_type,
          'channel', v_updated.channel,
          'status', v_updated.status,
          'scheduledDate', v_updated.scheduled_date,
          'scheduledTime', v_updated.scheduled_time,
          'assigneeEmail', v_updated.assignee_email,
          'notes', v_updated.notes,
          'sortOrder', v_updated.sort_order,
          'showOnPerformanceTimeline', v_updated.show_on_performance_timeline,
          'updatedAt', v_updated.updated_at
        ),
        'linkedTaskCount', v_linked_task_count,
        'linkedCreativeJobCount', v_linked_creative_count
      );
    end;
    $$;

    revoke all on function public.update_marketing_calendar_item_with_links(
      uuid, timestamptz, jsonb, uuid, text
    ) from public, anon, authenticated;
    grant execute on function public.update_marketing_calendar_item_with_links(
      uuid, timestamptz, jsonb, uuid, text
    ) to service_role;

    comment on function public.update_marketing_calendar_item_with_links(
      uuid, timestamptz, jsonb, uuid, text
    ) is
      'Atomically edits a Marketing Calendar item, linked Weekly Task metadata, linked Creative Job publish ownership, operational events and audit history.';
    ''',
)

# Feature dialog is independent of the server action so Storybook can render it.
write(
    "src/components/command-center/CalendarItemEditDialog.tsx",
    r'''
    "use client";

    import {
      useEffect,
      useMemo,
      useState,
      useTransition,
      type FormEvent,
    } from "react";
    import { Dialog } from "@base-ui/react/dialog";
    import {
      AlertTriangle,
      CalendarClock,
      Check,
      LoaderCircle,
      Pencil,
      Sparkles,
      X,
    } from "lucide-react";
    import { buttonVariants } from "@/components/ui/button";
    import { cn } from "@/lib/utils";
    import type { CalendarItem } from "@/lib/marketing/commandCenter";
    import {
      editableCalendarItemTypes,
      editableCalendarStatuses,
      type CalendarItemUpdateInput,
      type CalendarItemUpdateResult,
      type CalendarTreatmentOption,
    } from "@/lib/marketing/calendarEdit";

    type CalendarBrand = {
      id: string;
      name: string;
      color: string;
    };

    type Draft = {
      brandId: string;
      treatmentId: string;
      title: string;
      itemType: CalendarItemUpdateInput["itemType"];
      channel: string;
      status: CalendarItemUpdateInput["status"];
      scheduledDate: string;
      scheduledTime: string;
      assigneeEmail: string;
      notes: string;
      showOnPerformanceTimeline: boolean;
    };

    type CalendarItemEditDialogProps = {
      item: CalendarItem;
      brands: CalendarBrand[];
      treatments: CalendarTreatmentOption[];
      saveAction: (
        input: CalendarItemUpdateInput
      ) => Promise<CalendarItemUpdateResult>;
      onSaved: (item: CalendarItem, message: string) => void;
      disabled?: boolean;
      fixtureMode?: boolean;
      defaultOpen?: boolean;
    };

    const fieldClass =
      "min-h-11 w-full rounded-[var(--radius-control)] border border-system-input bg-system-card px-3 text-sm font-bold text-system-card-foreground outline-none transition focus:border-system-ring focus:ring-4 focus:ring-system-ring/15 disabled:cursor-not-allowed disabled:opacity-60";
    const labelClass =
      "grid gap-1.5 text-[11px] font-black text-system-muted-foreground";

    const itemTypeLabels: Record<CalendarItemUpdateInput["itemType"], string> = {
      post: "Post",
      ad: "廣告",
      landing_page: "Landing Page",
      email: "Email",
      meeting: "會議",
      task: "任務",
    };

    const statusLabels: Record<CalendarItemUpdateInput["status"], string> = {
      idea: "Idea",
      scheduled: "Scheduled",
      published: "Published",
    };

    function draftFromItem(item: CalendarItem): Draft {
      const itemType = editableCalendarItemTypes.includes(
        item.itemType as CalendarItemUpdateInput["itemType"]
      )
        ? (item.itemType as CalendarItemUpdateInput["itemType"])
        : "post";
      const status = editableCalendarStatuses.includes(
        item.status as CalendarItemUpdateInput["status"]
      )
        ? (item.status as CalendarItemUpdateInput["status"])
        : "idea";
      return {
        brandId: item.brandId,
        treatmentId: item.treatmentId || "",
        title: item.title,
        itemType,
        channel: item.channel || "",
        status,
        scheduledDate: item.scheduledDate,
        scheduledTime: item.scheduledTime?.slice(0, 5) || "",
        assigneeEmail: item.assigneeEmail || "",
        notes: item.notes || "",
        showOnPerformanceTimeline: item.showOnPerformanceTimeline !== false,
      };
    }

    export function CalendarItemEditDialog({
      item,
      brands,
      treatments,
      saveAction,
      onSaved,
      disabled = false,
      fixtureMode = false,
      defaultOpen = false,
    }: CalendarItemEditDialogProps) {
      const [open, setOpen] = useState(defaultOpen);
      const [draft, setDraft] = useState<Draft>(() => draftFromItem(item));
      const [error, setError] = useState<string | null>(null);
      const [isPending, startTransition] = useTransition();
      const eligibleTreatments = useMemo(
        () => treatments.filter((treatment) => treatment.brandId === draft.brandId),
        [draft.brandId, treatments]
      );

      useEffect(() => {
        if (open) {
          setDraft(draftFromItem(item));
          setError(null);
        }
      }, [item, open]);

      function updateDraft<K extends keyof Draft>(key: K, value: Draft[K]) {
        setDraft((current) => ({ ...current, [key]: value }));
      }

      function handleBrandChange(brandId: string) {
        setDraft((current) => ({
          ...current,
          brandId,
          treatmentId: treatments.some(
            (treatment) =>
              treatment.id === current.treatmentId && treatment.brandId === brandId
          )
            ? current.treatmentId
            : "",
        }));
      }

      function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        const title = draft.title.trim();
        if (!title || !draft.brandId || !draft.scheduledDate) {
          setError("請填寫事項名稱、品牌同日期。");
          return;
        }

        const treatment = treatments.find(
          (option) =>
            option.id === draft.treatmentId && option.brandId === draft.brandId
        );
        const input: CalendarItemUpdateInput = {
          itemId: item.id,
          expectedUpdatedAt: item.updatedAt || null,
          brandId: draft.brandId,
          treatmentId: treatment?.id || null,
          title,
          itemType: draft.itemType,
          channel: draft.channel.trim() || null,
          status: draft.status,
          scheduledDate: draft.scheduledDate,
          scheduledTime: draft.scheduledTime || null,
          assigneeEmail: draft.assigneeEmail.trim() || null,
          notes: draft.notes.trim() || null,
          showOnPerformanceTimeline: draft.showOnPerformanceTimeline,
        };

        if (fixtureMode) {
          onSaved(
            {
              ...item,
              ...input,
              treatmentLabel: treatment?.name || null,
              sortOrder: item.sortOrder,
              updatedAt: new Date().toISOString(),
            },
            "日曆事項已更新。"
          );
          setOpen(false);
          return;
        }

        startTransition(async () => {
          const result = await saveAction(input);
          if (!result.ok || !result.item) {
            setError(result.message);
            return;
          }
          onSaved(result.item, result.message);
          setOpen(false);
        });
      }

      return (
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger
            type="button"
            className="calendar-task-edit"
            aria-label={`編輯事項：${item.title}`}
            title="編輯事項"
            disabled={disabled}
            data-testid={`calendar-edit-trigger-${item.id}`}
            onPointerDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <Pencil size={11} aria-hidden="true" />
          </Dialog.Trigger>

          <Dialog.Portal>
            <Dialog.Backdrop className="fixed inset-0 z-[90] bg-system-foreground/45 backdrop-blur-sm transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
            <Dialog.Popup
              data-testid="calendar-edit-dialog"
              className="fixed left-1/2 top-1/2 z-[100] flex max-h-[min(92vh,900px)] w-[min(880px,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[var(--radius-panel)] border border-system-border bg-system-card text-system-card-foreground shadow-[var(--shadow-overlay)] outline-none transition data-[ending-style]:scale-[0.985] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.985] data-[starting-style]:opacity-0"
            >
              <header className="flex items-start gap-3 border-b border-system-border bg-system-secondary/55 px-5 py-5 sm:px-6">
                <span className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-control)] bg-system-primary text-system-primary-foreground shadow-[var(--shadow-control)]">
                  <CalendarClock size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-system-muted-foreground">
                    Edit calendar item
                  </p>
                  <Dialog.Title className="mt-1 text-xl font-black tracking-[-0.025em] sm:text-2xl">
                    編輯日曆事項
                  </Dialog.Title>
                  <Dialog.Description className="mt-1.5 max-w-2xl text-xs font-semibold leading-5 text-system-muted-foreground">
                    修改後會即時更新日曆；如已連結一般工作或設計 Job，相關排期同標題會保持一致。
                  </Dialog.Description>
                </div>
                <Dialog.Close
                  aria-label="關閉編輯視窗"
                  title="關閉"
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "icon" }),
                    "shrink-0 rounded-[var(--radius-control)]"
                  )}
                >
                  <X size={17} aria-hidden="true" />
                </Dialog.Close>
              </header>

              <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                  {error ? (
                    <div
                      role="alert"
                      className="mb-4 flex items-start gap-2 rounded-[var(--radius-control)] border border-system-destructive/30 bg-system-destructive/5 px-3 py-2.5 text-xs font-bold text-system-destructive"
                    >
                      <AlertTriangle className="mt-0.5 shrink-0" size={15} />
                      <span>{error}</span>
                    </div>
                  ) : null}

                  <section>
                    <div className="flex items-center gap-2">
                      <span className="grid size-8 place-items-center rounded-[var(--radius-control)] bg-system-accent text-system-accent-foreground">
                        <Pencil size={14} aria-hidden="true" />
                      </span>
                      <div>
                        <h2 className="text-sm font-black">內容及負責資料</h2>
                        <p className="text-[10px] font-semibold text-system-muted-foreground">
                          所有欄位都會保存到 Database 同 Audit Log。
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <label className={`${labelClass} md:col-span-2 xl:col-span-2`}>
                        事項名稱
                        <input
                          className={fieldClass}
                          value={draft.title}
                          onChange={(event) => updateDraft("title", event.target.value)}
                          maxLength={180}
                          required
                          autoFocus
                        />
                      </label>
                      <label className={labelClass}>
                        品牌
                        <select
                          className={fieldClass}
                          value={draft.brandId}
                          onChange={(event) => handleBrandChange(event.target.value)}
                          required
                        >
                          {brands.map((brand) => (
                            <option key={brand.id} value={brand.id}>
                              {brand.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className={labelClass}>
                        影響療程（可選）
                        <select
                          className={fieldClass}
                          value={draft.treatmentId}
                          onChange={(event) =>
                            updateDraft("treatmentId", event.target.value)
                          }
                        >
                          <option value="">品牌整體／所有療程</option>
                          {eligibleTreatments.map((treatment) => (
                            <option key={treatment.id} value={treatment.id}>
                              {treatment.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className={labelClass}>
                        類型
                        <select
                          className={fieldClass}
                          value={draft.itemType}
                          onChange={(event) =>
                            updateDraft(
                              "itemType",
                              event.target.value as Draft["itemType"]
                            )
                          }
                        >
                          {editableCalendarItemTypes.map((type) => (
                            <option key={type} value={type}>
                              {itemTypeLabels[type]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className={labelClass}>
                        渠道
                        <input
                          className={fieldClass}
                          value={draft.channel}
                          onChange={(event) => updateDraft("channel", event.target.value)}
                          placeholder="IG / Meta / Google"
                          maxLength={120}
                        />
                      </label>
                      <label className={labelClass}>
                        負責人電郵（可選）
                        <input
                          type="email"
                          className={fieldClass}
                          value={draft.assigneeEmail}
                          onChange={(event) =>
                            updateDraft("assigneeEmail", event.target.value)
                          }
                          placeholder="name@alyssa.hk"
                          maxLength={320}
                        />
                      </label>
                    </div>
                  </section>

                  <section className="mt-6 border-t border-system-border pt-5">
                    <div className="flex items-center gap-2">
                      <span className="grid size-8 place-items-center rounded-[var(--radius-control)] bg-system-accent text-system-accent-foreground">
                        <CalendarClock size={14} aria-hidden="true" />
                      </span>
                      <div>
                        <h2 className="text-sm font-black">出街時間及狀態</h2>
                        <p className="text-[10px] font-semibold text-system-muted-foreground">
                          拖放仍可快速改日期；呢個視窗用嚟完整修改時間、狀態同內容。
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <label className={labelClass}>
                        Due／出街日期
                        <input
                          type="date"
                          className={fieldClass}
                          value={draft.scheduledDate}
                          onChange={(event) =>
                            updateDraft("scheduledDate", event.target.value)
                          }
                          required
                        />
                      </label>
                      <label className={labelClass}>
                        時間（可留空）
                        <input
                          type="time"
                          className={fieldClass}
                          value={draft.scheduledTime}
                          onChange={(event) =>
                            updateDraft("scheduledTime", event.target.value)
                          }
                        />
                      </label>
                      <label className={labelClass}>
                        狀態
                        <select
                          className={fieldClass}
                          value={draft.status}
                          onChange={(event) =>
                            updateDraft(
                              "status",
                              event.target.value as Draft["status"]
                            )
                          }
                        >
                          {editableCalendarStatuses.map((status) => (
                            <option key={status} value={status}>
                              {statusLabels[status]}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    {draft.status === "scheduled" && !draft.scheduledTime ? (
                      <p className="mt-2 rounded-[var(--radius-control)] bg-system-muted px-3 py-2 text-[10px] font-semibold leading-4 text-system-muted-foreground">
                        Scheduled 如冇填時間，系統會喺出街當日 12:00 HKT 自動轉 Published。
                      </p>
                    ) : null}
                    {draft.status === "published" ? (
                      <p className="mt-2 flex items-start gap-2 rounded-[var(--radius-control)] bg-system-accent px-3 py-2 text-[10px] font-semibold leading-4 text-system-accent-foreground">
                        <Check className="mt-0.5 shrink-0" size={13} aria-hidden="true" />
                        儲存後會更新成效時間線及所有已連結嘅排期資料。
                      </p>
                    ) : null}
                  </section>

                  <section className="mt-6 border-t border-system-border pt-5">
                    <label className={`${labelClass}`}>
                      備註
                      <textarea
                        className={`${fieldClass} min-h-28 resize-y py-3 leading-5`}
                        value={draft.notes}
                        onChange={(event) => updateDraft("notes", event.target.value)}
                        maxLength={4000}
                        placeholder="素材、審批、上線要求或其他備註"
                      />
                    </label>

                    <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-[var(--radius-control)] border border-system-border bg-system-secondary/50 px-4 py-3">
                      <input
                        type="checkbox"
                        className="mt-0.5 size-4 accent-[var(--system-primary)]"
                        checked={draft.showOnPerformanceTimeline}
                        onChange={(event) =>
                          updateDraft(
                            "showOnPerformanceTimeline",
                            event.target.checked
                          )
                        }
                      />
                      <span>
                        <strong className="flex items-center gap-1.5 text-xs font-black">
                          <Sparkles size={13} aria-hidden="true" /> 顯示喺成效時間線
                        </strong>
                        <small className="mt-1 block text-[10px] font-semibold leading-4 text-system-muted-foreground">
                          Published 後會成為 Dashboard／成效走勢圖嘅事件標記，方便對照 Lead、Book 同 Show 變化。
                        </small>
                      </span>
                    </label>
                  </section>
                </div>

                <footer className="flex flex-col-reverse gap-2 border-t border-system-border bg-system-muted/45 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <p className="max-w-xl text-[10px] font-semibold leading-4 text-system-muted-foreground">
                    如連結設計 Job，新日期不可早過 Designer Due Day；系統唔會偷偷改早交稿期限。
                  </p>
                  <div className="flex flex-col-reverse gap-2 sm:flex-row">
                    <Dialog.Close
                      className={cn(
                        buttonVariants({ variant: "outline", size: "lg" }),
                        "rounded-[var(--radius-control)]"
                      )}
                    >
                      取消
                    </Dialog.Close>
                    <button
                      type="submit"
                      disabled={isPending}
                      data-testid="calendar-edit-save"
                      className={cn(
                        buttonVariants({ variant: "default", size: "lg" }),
                        "rounded-[var(--radius-control)]"
                      )}
                    >
                      {isPending ? (
                        <LoaderCircle className="animate-spin" size={15} />
                      ) : (
                        <Check size={15} />
                      )}
                      {isPending ? "儲存中…" : "儲存修改"}
                    </button>
                  </div>
                </footer>
              </form>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      );
    }
    ''',
)

write(
    "src/components/command-center/CalendarItemEditDialog.stories.tsx",
    r'''
    import type { Meta, StoryObj } from "@storybook/nextjs-vite";
    import { CalendarItemEditDialog } from "@/components/command-center/CalendarItemEditDialog";
    import type { CalendarItemUpdateInput } from "@/lib/marketing/calendarEdit";
    import type { CalendarItem } from "@/lib/marketing/commandCenter";

    const item: CalendarItem = {
      id: "10000000-0000-4000-8000-000000000001",
      brandId: "20000000-0000-4000-8000-000000000001",
      treatmentId: null,
      treatmentLabel: null,
      title: "S-Lite Meta AD 上線",
      itemType: "ad",
      channel: "Meta",
      status: "scheduled",
      scheduledDate: "2026-09-08",
      scheduledTime: "12:00",
      assigneeEmail: "marketer@example.test",
      notes: "確認價錢、CTA 同 Safe Zone 後出街。",
      sortOrder: 0,
      showOnPerformanceTimeline: true,
      updatedAt: "2026-09-02T02:00:00.000Z",
    };

    const meta = {
      title: "Design System/Feature/Calendar Item Edit Dialog",
      component: CalendarItemEditDialog,
      parameters: { layout: "centered" },
      tags: ["autodocs"],
    } satisfies Meta<typeof CalendarItemEditDialog>;

    export default meta;
    type Story = StoryObj<typeof meta>;

    export const Open: Story = {
      args: {
        item,
        brands: [
          {
            id: item.brandId,
            name: "Alyssa",
            color: "#5a2348",
          },
        ],
        treatments: [],
        defaultOpen: true,
        fixtureMode: true,
        saveAction: async (input: CalendarItemUpdateInput) => ({
          ok: true,
          message: "日曆事項已更新。",
          item: { ...item, ...input },
        }),
        onSaved: () => undefined,
      },
    };
    ''',
)

# CalendarItem carries concurrency and timeline values on Calendar screens.
replace_once(
    "src/lib/marketing/commandCenter.ts",
    '''  notes: string | null;\n  sortOrder: number;\n};''',
    '''  notes: string | null;\n  sortOrder: number;\n  showOnPerformanceTimeline?: boolean;\n  updatedAt?: string | null;\n};''',
)

# Snapshot reads the fields needed by the edit dialog and optimistic concurrency.
replace_once(
    "src/lib/marketing/marketingCalendar.ts",
    '''    notes: textValue(row.notes),\n    sortOrder: numberValue(row.sort_order),''',
    '''    notes: textValue(row.notes),\n    sortOrder: numberValue(row.sort_order),\n    showOnPerformanceTimeline: row.show_on_performance_timeline !== false,\n    updatedAt: textValue(row.updated_at),''',
)
replace_once(
    "src/lib/marketing/marketingCalendar.ts",
    '''      notes: "素材及投放同日上線",\n      sortOrder: 0,''',
    '''      notes: "素材及投放同日上線",\n      sortOrder: 0,\n      showOnPerformanceTimeline: true,\n      updatedAt: `${month.today}T02:00:00.000Z`,''',
)
replace_once(
    "src/lib/marketing/marketingCalendar.ts",
    '''        "id,brand_id,treatment_id,treatment_label,title,item_type,channel,status,scheduled_date,scheduled_time,assignee_email,notes,sort_order"''',
    '''        "id,brand_id,treatment_id,treatment_label,title,item_type,channel,status,scheduled_date,scheduled_time,assignee_email,notes,sort_order,show_on_performance_timeline,updated_at"''',
)
replace_once(
    "src/lib/marketing/marketingCalendar.ts",
    '''        "id,brand_id,title,item_type,channel,status,scheduled_date,scheduled_time,assignee_email,notes,sort_order"''',
    '''        "id,brand_id,title,item_type,channel,status,scheduled_date,scheduled_time,assignee_email,notes,sort_order,updated_at"''',
)

# Calendar page supplies brand-aware treatment options and fixture behavior.
replace_once(
    "src/app/calendar/page.tsx",
    '''              brands={snapshot.brands.map((brand) => ({\n                id: brand.id,\n                name: brand.name,\n                color: brand.color,\n              }))}\n              year={snapshot.month.year}''',
    '''              brands={snapshot.brands.map((brand) => ({\n                id: brand.id,\n                name: brand.name,\n                color: brand.color,\n              }))}\n              treatments={snapshot.treatments.map((treatment) => ({\n                id: treatment.id,\n                brandId: treatment.brandId,\n                name: treatment.name,\n              }))}\n              fixtureMode={process.env.ALYSSA_E2E_FIXTURES === "1"}\n              year={snapshot.month.year}''',
)
replace_once(
    "src/app/calendar/page.tsx",
    '''              拖放更改日期；Scheduled 冇時間預設 12:00 HKT 發布''',
    '''              鉛筆可完整編輯；拖放快速改日期；Scheduled 冇時間預設 12:00 HKT 發布''',
)

# Board: add the edit control while preserving the compact drag-and-drop layout.
replace_once(
    "src/components/command-center/MarketingCalendarBoard.tsx",
    '''import { GripVertical, Trash2 } from "lucide-react";\nimport {\n  deleteCalendarItemAction,\n  moveCalendarItemAction,\n} from "@/app/command-center/actions";''',
    '''import { GripVertical, Trash2 } from "lucide-react";\nimport {\n  deleteCalendarItemAction,\n  moveCalendarItemAction,\n} from "@/app/command-center/actions";\nimport { updateCalendarItemAction } from "@/app/calendar/updateAction";\nimport { CalendarItemEditDialog } from "@/components/command-center/CalendarItemEditDialog";\nimport type { CalendarTreatmentOption } from "@/lib/marketing/calendarEdit";''',
)
replace_once(
    "src/components/command-center/MarketingCalendarBoard.tsx",
    '''type CalendarBrand = {\n  id: string;\n  name: string;\n  color: string;\n};''',
    '''type CalendarBrand = {\n  id: string;\n  name: string;\n  color: string;\n};\n\ntype CalendarTreatment = CalendarTreatmentOption;''',
)
replace_once(
    "src/components/command-center/MarketingCalendarBoard.tsx",
    '''function CalendarTaskCard({\n  item,\n  brand,\n  overlay = false,\n  deleting = false,\n  onDelete,\n}: {\n  item: CalendarItem;\n  brand: CalendarBrand | undefined;\n  overlay?: boolean;\n  deleting?: boolean;\n  onDelete?: (item: CalendarItem) => void;\n}) {''',
    '''function CalendarTaskCard({\n  item,\n  brand,\n  brands = [],\n  treatments = [],\n  overlay = false,\n  deleting = false,\n  fixtureMode = false,\n  onDelete,\n  onUpdated,\n}: {\n  item: CalendarItem;\n  brand: CalendarBrand | undefined;\n  brands?: CalendarBrand[];\n  treatments?: CalendarTreatment[];\n  overlay?: boolean;\n  deleting?: boolean;\n  fixtureMode?: boolean;\n  onDelete?: (item: CalendarItem) => void;\n  onUpdated?: (item: CalendarItem, message: string) => void;\n}) {''',
)
replace_once(
    "src/components/command-center/MarketingCalendarBoard.tsx",
    '''        <small>\n          {itemTypeLabel(item.itemType)}\n          {item.channel ? ` · ${item.channel}` : ""}\n        </small>\n        <GripVertical className="calendar-task-grip" size={11} aria-hidden="true" />''',
    '''        <small>\n          {itemTypeLabel(item.itemType)}\n          {item.channel ? ` · ${item.channel}` : ""}\n        </small>\n        {!overlay && onUpdated ? (\n          <CalendarItemEditDialog\n            item={item}\n            brands={brands}\n            treatments={treatments}\n            saveAction={updateCalendarItemAction}\n            onSaved={onUpdated}\n            disabled={deleting}\n            fixtureMode={fixtureMode}\n          />\n        ) : null}\n        <GripVertical className="calendar-task-grip" size={11} aria-hidden="true" />''',
)
replace_once(
    "src/components/command-center/MarketingCalendarBoard.tsx",
    '''          <p className="calendar-task-preview-hint">拖放可更改日期</p>''',
    '''          <p className="calendar-task-preview-hint">鉛筆可完整編輯；拖放可快速改日期</p>''',
)
replace_once(
    "src/components/command-center/MarketingCalendarBoard.tsx",
    '''function CalendarDay({\n  date,\n  day,\n  items,\n  brands,\n  today,\n  deletingId,\n  onDelete,\n}: {\n  date: string;\n  day: number;\n  items: CalendarItem[];\n  brands: CalendarBrand[];\n  today: string;\n  deletingId: string | null;\n  onDelete: (item: CalendarItem) => void;\n}) {''',
    '''function CalendarDay({\n  date,\n  day,\n  items,\n  brands,\n  treatments,\n  today,\n  deletingId,\n  fixtureMode,\n  onDelete,\n  onUpdated,\n}: {\n  date: string;\n  day: number;\n  items: CalendarItem[];\n  brands: CalendarBrand[];\n  treatments: CalendarTreatment[];\n  today: string;\n  deletingId: string | null;\n  fixtureMode: boolean;\n  onDelete: (item: CalendarItem) => void;\n  onUpdated: (item: CalendarItem, message: string) => void;\n}) {''',
)
replace_once(
    "src/components/command-center/MarketingCalendarBoard.tsx",
    '''            brand={brands.find((brand) => brand.id === item.brandId)}\n            deleting={deletingId === item.id}\n            onDelete={onDelete}''',
    '''            brand={brands.find((brand) => brand.id === item.brandId)}\n            brands={brands}\n            treatments={treatments}\n            deleting={deletingId === item.id}\n            fixtureMode={fixtureMode}\n            onDelete={onDelete}\n            onUpdated={onUpdated}''',
)
# The overflow list contains the same card call and needs the same props.
replace_once(
    "src/components/command-center/MarketingCalendarBoard.tsx",
    '''                    brand={brands.find((brand) => brand.id === item.brandId)}\n                    deleting={deletingId === item.id}\n                    onDelete={onDelete}''',
    '''                    brand={brands.find((brand) => brand.id === item.brandId)}\n                    brands={brands}\n                    treatments={treatments}\n                    deleting={deletingId === item.id}\n                    fixtureMode={fixtureMode}\n                    onDelete={onDelete}\n                    onUpdated={onUpdated}''',
)
replace_once(
    "src/components/command-center/MarketingCalendarBoard.tsx",
    '''  initialItems,\n  brands,\n  year,\n  month,\n  daysInMonth,\n  today,\n}: {\n  initialItems: CalendarItem[];\n  brands: CalendarBrand[];\n  year: number;\n  month: number;\n  daysInMonth: number;\n  today: string;\n}) {''',
    '''  initialItems,\n  brands,\n  treatments,\n  year,\n  month,\n  daysInMonth,\n  today,\n  fixtureMode = false,\n}: {\n  initialItems: CalendarItem[];\n  brands: CalendarBrand[];\n  treatments: CalendarTreatment[];\n  year: number;\n  month: number;\n  daysInMonth: number;\n  today: string;\n  fixtureMode?: boolean;\n}) {''',
)
replace_once(
    "src/components/command-center/MarketingCalendarBoard.tsx",
    '''  function handleDelete(item: CalendarItem) {''',
    '''  function handleUpdated(item: CalendarItem, message: string) {\n    const visibleMonth = `${year}-${String(month).padStart(2, "0")}`;\n    setItems((current) =>\n      current\n        .map((currentItem) => (currentItem.id === item.id ? item : currentItem))\n        .sort(\n          (left, right) =>\n            left.scheduledDate.localeCompare(right.scheduledDate) ||\n            left.sortOrder - right.sortOrder\n        )\n    );\n    setNotice(\n      item.scheduledDate.startsWith(visibleMonth)\n        ? message\n        : `${message} 事項已移到 ${item.scheduledDate.slice(0, 7)}。`\n    );\n  }\n\n  function handleDelete(item: CalendarItem) {''',
)
replace_once(
    "src/components/command-center/MarketingCalendarBoard.tsx",
    '''      if (!result.ok) {\n        setItems((current) =>\n          current.map((item) =>\n            item.id === itemId\n              ? { ...item, scheduledDate: previousDate }\n              : item\n          )\n        );\n      }\n    });''',
    '''      if (!result.ok) {\n        setItems((current) =>\n          current.map((item) =>\n            item.id === itemId\n              ? { ...item, scheduledDate: previousDate }\n              : item\n          )\n        );\n      } else if (result.updatedAt) {\n        setItems((current) =>\n          current.map((item) =>\n            item.id === itemId ? { ...item, updatedAt: result.updatedAt } : item\n          )\n        );\n      }\n    });''',
)
replace_once(
    "src/components/command-center/MarketingCalendarBoard.tsx",
    '''          grid-template-columns: auto minmax(0, 1fr) auto auto;''',
    '''          grid-template-columns: auto minmax(0, 1fr) auto auto auto;''',
)
replace_once(
    "src/components/command-center/MarketingCalendarBoard.tsx",
    '''        .calendar-task-grip {\n          color: #b4bac7;\n        }''',
    '''        .calendar-task-edit {\n          display: inline-grid;\n          width: 1.3rem;\n          height: 1.3rem;\n          flex: 0 0 auto;\n          place-items: center;\n          border: 1px solid transparent;\n          border-radius: 0.34rem;\n          background: transparent;\n          color: #8c7280;\n          cursor: pointer;\n          transition: border-color 120ms ease, background 120ms ease, color 120ms ease;\n          touch-action: manipulation;\n        }\n        .calendar-task-edit:hover,\n        .calendar-task-edit:focus-visible {\n          border-color: #dbc8d2;\n          background: #fff3f7;\n          color: #5a2348;\n          outline: none;\n        }\n        .calendar-task-edit:disabled {\n          cursor: not-allowed;\n          opacity: 0.45;\n        }\n        .calendar-task-grip {\n          color: #b4bac7;\n        }''',
)
replace_once(
    "src/components/command-center/MarketingCalendarBoard.tsx",
    '''            grid-template-columns: auto minmax(0, 1fr) auto;''',
    '''            grid-template-columns: auto minmax(0, 1fr) auto auto;''',
)
replace_once(
    "src/components/command-center/MarketingCalendarBoard.tsx",
    '''                brands={brands}\n                today={today}\n                deletingId={deletingId}\n                onDelete={handleDelete}''',
    '''                brands={brands}\n                treatments={treatments}\n                today={today}\n                deletingId={deletingId}\n                fixtureMode={fixtureMode}\n                onDelete={handleDelete}\n                onUpdated={handleUpdated}''',
)

# Dragging dates now uses the same atomic RPC and refreshes the concurrency token.
replace_once(
    "src/app/command-center/actions.ts",
    '''type ActionResult = {\n  ok: boolean;\n  message: string;\n};''',
    '''type ActionResult = {\n  ok: boolean;\n  message: string;\n  updatedAt?: string;\n};''',
)
replace_once(
    "src/app/command-center/actions.ts",
    '''      "id,brand_id,treatment_id,treatment_label,title,item_type,channel,status,scheduled_date,scheduled_time,assignee_email,notes,sort_order"''',
    '''      "id,brand_id,treatment_id,treatment_label,title,item_type,channel,status,scheduled_date,scheduled_time,assignee_email,notes,sort_order,show_on_performance_timeline,updated_at"''',
)
replace_once(
    "src/app/command-center/actions.ts",
    '''      "id,brand_id,title,item_type,channel,status,scheduled_date,scheduled_time,assignee_email,notes,sort_order"''',
    '''      "id,brand_id,title,item_type,channel,status,scheduled_date,scheduled_time,assignee_email,notes,sort_order,updated_at"''',
)
regex_replace_once(
    "src/app/command-center/actions.ts",
    r'''export async function moveCalendarItemAction\(\n  itemId: string,\n  scheduledDate: string\n\): Promise<ActionResult> \{.*?\n\}\n\nexport async function deleteCalendarItemAction''',
    r'''export async function moveCalendarItemAction(
  itemId: string,
  scheduledDate: string
): Promise<ActionResult> {
  const access = await ensureCommandCenterAction("/calendar");
  if (!access.ok) return access;
  if (!itemId || !/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
    return { ok: false, message: "無效日曆事項或日期。" };
  }

  const supabase = createSupabaseAdminClient();
  const { data: existing, error: lookupError } =
    await getCalendarItemForMutation(itemId);
  if (
    lookupError ||
    !existing ||
    !canAccessInternalBrand(access.access, String(existing.brand_id || ""))
  ) {
    return { ok: false, message: "你未獲授權移動呢個日曆事項。" };
  }

  const { data, error } = await supabase.rpc(
    "update_marketing_calendar_item_with_links",
    {
      p_item_id: itemId,
      p_expected_updated_at: existing.updated_at || null,
      p_payload: {
        brandId: existing.brand_id,
        treatmentId:
          "treatment_id" in existing ? existing.treatment_id || "" : "",
        title: existing.title,
        itemType: existing.item_type,
        channel: existing.channel || "",
        status: existing.status,
        scheduledDate,
        scheduledTime: existing.scheduled_time || "",
        assigneeEmail: existing.assignee_email || "",
        notes: existing.notes || "",
        showOnPerformanceTimeline:
          "show_on_performance_timeline" in existing
            ? existing.show_on_performance_timeline !== false
            : true,
      },
      p_actor_member_id: access.memberId,
      p_actor_email: access.actorIdentifier,
    }
  );

  if (error) {
    console.warn("marketing_calendar_item_move_failed", {
      code: error.code,
      message: error.message,
    });
    const message = error.message.includes("calendar_before_linked_task_start")
      ? "新日期早過連結工作嘅 Start Day。"
      : error.message.includes("calendar_before_creative_due")
        ? "新日期早過連結設計 Job 嘅 Due Day。"
        : error.message.includes("stale_calendar_item")
          ? "事項已被另一位同事更新，請重新整理再試。"
          : "未能移動日曆事項。";
    return { ok: false, message };
  }

  const result =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  const item =
    result.item && typeof result.item === "object" && !Array.isArray(result.item)
      ? (result.item as Record<string, unknown>)
      : {};
  revalidateCommandCenter(
    "/calendar",
    "/tasks",
    "/creative-jobs",
    "/dashboard",
    "/kpis",
    "/performance",
    "/performance/compare"
  );
  return {
    ok: true,
    message: "日曆日期已更新，連結工作排期已同步。",
    updatedAt:
      typeof item.updatedAt === "string" ? item.updatedAt : undefined,
  };
}

export async function deleteCalendarItemAction''',
)

# Contract and end-to-end acceptance.
write(
    "scripts/verify-calendar-edit-contract.mjs",
    r'''
    import assert from "node:assert/strict";
    import { readFileSync } from "node:fs";

    function read(path) {
      return readFileSync(path, "utf8");
    }

    const action = read("src/app/calendar/updateAction.ts");
    const dialog = read("src/components/command-center/CalendarItemEditDialog.tsx");
    const board = read("src/components/command-center/MarketingCalendarBoard.tsx");
    const page = read("src/app/calendar/page.tsx");
    const snapshot = read("src/lib/marketing/marketingCalendar.ts");
    const shared = read("src/lib/marketing/calendarEdit.ts");
    const commandActions = read("src/app/command-center/actions.ts");
    const migration = read(
      "supabase/migrations/20260902024000_editable_marketing_calendar_items.sql"
    );
    const test = read("e2e/marketing-calendar-edit.spec.ts");
    const packageJson = JSON.parse(read("package.json"));

    assert.match(action, /updateCalendarItemAction/);
    assert.match(action, /requireModuleAccess\("calendar"\)/);
    assert.match(action, /canAccessInternalBrand/);
    assert.match(action, /expectedUpdatedAt/);
    assert.match(action, /update_marketing_calendar_item_with_links/);
    assert.match(dialog, /編輯日曆事項/);
    assert.match(dialog, /showOnPerformanceTimeline/);
    assert.match(dialog, /saveAction/);
    assert.match(board, /CalendarItemEditDialog/);
    assert.match(board, /calendar-task-edit/);
    assert.match(page, /treatments=\{snapshot\.treatments/);
    assert.match(snapshot, /show_on_performance_timeline,updated_at/);
    assert.match(shared, /editableCalendarStatuses/);
    assert.match(commandActions, /result\.updatedAt/);

    assert.match(migration, /for update/);
    assert.match(migration, /stale_calendar_item/);
    assert.match(migration, /marketing_task_calendar_links/);
    assert.match(migration, /update public\.creative_jobs/);
    assert.match(migration, /creative_job_audit/);
    assert.match(migration, /marketing_command_center_audit/);
    assert.match(migration, /calendar_before_creative_due/);
    assert.match(test, /calendar item can be fully edited/);
    assert.match(test, /toHaveScreenshot/);
    assert.match(test, /AxeBuilder/);
    assert.ok(packageJson.scripts?.["verify:calendar-edit-contract"]);

    console.log(
      "Editable Calendar dialog, atomic linked-record sync, concurrency, audit and visual acceptance contracts verified."
    );
    ''',
)

write(
    "e2e/marketing-calendar-edit.spec.ts",
    r'''
    import AxeBuilder from "@axe-core/playwright";
    import { expect, test, type Page } from "@playwright/test";

    async function openCalendarEdit(page: Page) {
      await page.goto("/calendar", { waitUntil: "domcontentloaded" });
      const task = page
        .locator('[data-calendar-task-title="DEP Reels 上線"]')
        .first();
      await expect(task).toBeVisible();
      await task
        .getByRole("button", { name: "編輯事項：DEP Reels 上線" })
        .click();
      const dialog = page.getByTestId("calendar-edit-dialog");
      await expect(dialog).toBeVisible();
      return { task, dialog };
    }

    test("calendar item can be fully edited without leaving the calendar", async ({
      page,
    }) => {
      const { dialog } = await openCalendarEdit(page);

      await dialog.getByLabel("事項名稱").fill("DEP Reels 更新版");
      await dialog.getByLabel("類型").selectOption("ad");
      await dialog.getByLabel("渠道").fill("Meta");
      await dialog.getByLabel("狀態").selectOption("scheduled");
      await dialog.getByLabel("負責人電郵（可選）").fill(
        "marketer@example.test"
      );
      await dialog.getByLabel("備註").fill("已更新素材、CTA 同出街安排。");
      await dialog.getByLabel("顯示喺成效時間線").uncheck();
      await dialog.getByTestId("calendar-edit-save").click();

      await expect(dialog).toHaveCount(0);
      await expect(
        page.locator('[data-calendar-task-title="DEP Reels 更新版"]')
      ).toBeVisible();
      await expect(page.getByText("日曆事項已更新。")).toBeVisible();
    });

    test("calendar edit dialog desktop visual baseline", async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      const { dialog } = await openCalendarEdit(page);
      await expect(dialog).toHaveScreenshot("calendar-edit-dialog-desktop.png", {
        animations: "disabled",
      });
    });

    test("calendar edit dialog mobile visual baseline", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const { dialog } = await openCalendarEdit(page);
      await expect(dialog).toHaveScreenshot("calendar-edit-dialog-mobile.png", {
        animations: "disabled",
      });
    });

    test("calendar edit dialog has no automated WCAG A or AA violations", async ({
      page,
    }) => {
      const { dialog } = await openCalendarEdit(page);
      const result = await new AxeBuilder({ page })
        .include('[data-testid="calendar-edit-dialog"]')
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(result.violations).toEqual([]);
      await expect(dialog.getByRole("button", { name: "儲存修改" })).toBeVisible();
    });
    ''',
)

write(
    "docs/product-learning/entries/2026-09-02-editable-marketing-calendar-items.md",
    r'''
    # Calendar Entries Must Be Full Operational Records, Not Drag-Only Tokens

    ## Problem

    Marketing Calendar cards exposed date drag-and-drop and deletion but no discoverable way to edit the title, brand, treatment, type, channel, time, status, assignee, notes or performance-timeline ownership. Operators had to delete and recreate an item, losing continuity and risking mismatch with linked Weekly Tasks or Creative Jobs.

    ## Decision

    Add one compact pencil control to every Calendar card. It opens an app-owned dialog inside Growth OS and edits the complete Calendar record. The dialog uses brand-scoped treatments, optimistic concurrency and the existing module/brand permission model.

    One database RPC owns the write transaction. It updates:

    - the Marketing Calendar item;
    - linked Weekly Task metadata and Due schedule;
    - linked Creative Job title, brand, treatment and Publish schedule;
    - performance operational events through the existing trigger;
    - Command Center and Creative Job audit history.

    ## Safety rules

    - A stale browser cannot overwrite a newer colleague edit.
    - A Calendar date cannot move before a linked Task Start Day.
    - A Creative Job Publish Day cannot move before its Designer Due Day.
    - Editing a Published item updates the existing operational event rather than creating a duplicate.
    - Drag-and-drop uses the same linked-record transaction as the full dialog.
    - The feature does not alter Lead, Book, Show, Spend, CRM or attribution definitions.

    ## Product classification

    **Core** — editable Calendar records, linked-record consistency, concurrency protection and audit history apply to every Growth OS workspace.

    ## Client-specific boundary

    Brand names, treatment names, users, Calendar content and production rows remain Alyssa-only configuration/data and must never be copied into Growth OS Core.

    ## Verification

    - production build and TypeScript;
    - Calendar create/edit/delete/drag regression;
    - desktop and mobile visual baselines;
    - WCAG A/AA automated scan;
    - full Playwright regression;
    - transactional production database smoke test before release.

    ## Rollback

    Revert the source PR. The additive RPC may remain safely installed because no existing workflow calls it after source rollback; it can be dropped separately if required.
    ''',
)

append_once(
    "docs/design-system/CHANGELOG.md",
    "## 2026-09-02 — Editable Marketing Calendar items",
    r'''
    ## 2026-09-02 — Editable Marketing Calendar items

    - Added one compact, always-discoverable pencil control to Calendar cards.
    - Added a Base UI dialog for complete Calendar record editing without leaving the month view.
    - Preserved compact row density and drag-and-drop as the fast date-only action.
    - Added desktop/mobile visual baselines and focused accessibility acceptance.
    - Rollback: revert the editable-calendar source PR; the additive database RPC can remain dormant.
    ''',
)

# Package contract joins the normal production build gate.
package_path = Path("package.json")
package = json.loads(package_path.read_text(encoding="utf-8"))
scripts = package.setdefault("scripts", {})
scripts["verify:calendar-edit-contract"] = "node scripts/verify-calendar-edit-contract.mjs"
build = scripts.get("build", "")
marker = "npm run verify:creative-production-contract && next build"
replacement = (
    "npm run verify:creative-production-contract && "
    "npm run verify:calendar-edit-contract && next build"
)
if replacement not in build:
    if marker not in build:
        raise SystemExit("package.json build marker missing")
    scripts["build"] = build.replace(marker, replacement, 1)
package_path.write_text(
    json.dumps(package, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)

print("Editable Marketing Calendar implementation written.")
