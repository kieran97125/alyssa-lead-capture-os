"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  requireModuleAccess,
  verifyCurrentInternalAccess,
} from "@/lib/security/internalAccessServer";
import { getConfigurationData } from "@/lib/data/configuration";
import { isCreativeOperationsRole } from "@/lib/creative/access";
import {
  creativeCalendarItemType,
  getHongKongToday,
  queueCreativeNotification,
  writeCreativeAudit,
} from "@/lib/creative/store";
import {
  creativePriorities,
  creativeWorkloads,
} from "@/lib/creative/types";

type CreativeJobCreateState = {
  status: "idle" | "error";
  message: string;
};

function fail(message: string): CreativeJobCreateState {
  return { status: "error", message };
}

function readString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function readBoolean(formData: FormData, key: string) {
  return ["1", "true", "on", "yes"].includes(
    readString(formData, key).toLowerCase()
  );
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isSafeOptionalUrl(value: string) {
  if (!value) return true;
  if (value.length > 2048) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

const defaultCreativeBrief = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Campaign 目的" }],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "寫低今次內容／廣告要解決嘅問題，同埋成功標準。",
        },
      ],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Deliverables／輸出要求" }],
    },
    {
      type: "taskList",
      content: [
        {
          type: "taskItem",
          attrs: { checked: false },
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "列明數量、尺寸、片長、平台、字幕、VO 同版本要求",
                },
              ],
            },
          ],
        },
      ],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "畫面及 Reference" }],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "可直接 Ctrl + V 貼 Screenshot，或者由右邊素材庫插入圖片及 Google Drive 連結。",
        },
      ],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "必須遵守／不可出現" }],
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "價錢、CTA、Logo、合規字眼及品牌要求",
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

export async function createCreativeJobAction(
  _previousState: CreativeJobCreateState,
  formData: FormData
): Promise<CreativeJobCreateState> {
  const session = await verifyCurrentInternalAccess();
  if (!session.ok) redirect("/login?next=/creative-jobs");

  const moduleAccess = await requireModuleAccess("creative_jobs");
  if (!moduleAccess.allowed || !isCreativeOperationsRole(session.access)) {
    return fail(
      "只有 Marketer、Manager、Admin 或系統擁有人可以新增設計工作。"
    );
  }

  const title = readString(formData, "title");
  const brandId = readString(formData, "brandId");
  const designerId = readString(formData, "assigneeProfileId");
  const sourceTaxonomyId = readString(formData, "sourceTaxonomyId");
  const usageTaxonomyId = readString(formData, "usageTaxonomyId");
  const mediaFormatTaxonomyId = readString(
    formData,
    "mediaFormatTaxonomyId"
  );
  const priority = readString(formData, "priority") || "normal";
  const workload = readString(formData, "workload") || "M";
  const startDate = readString(formData, "startDate") || getHongKongToday();
  const startTime = readString(formData, "startTime");
  const dueDate = readString(formData, "dueDate");
  const dueTime = readString(formData, "dueTime");
  const materialStatus =
    readString(formData, "materialStatus") === "waiting"
      ? "waiting"
      : "ready";
  const quantity = Number(readString(formData, "quantity") || 1);
  const specifications = readString(formData, "specifications");
  const sourceUrl = readString(formData, "sourceUrl");
  const referenceUrl = readString(formData, "referenceUrl");
  const syncCalendar = readBoolean(formData, "syncCalendar");
  const publishDate = readString(formData, "publishDate");
  const publishTime = readString(formData, "publishTime");

  if (!title || title.length > 240) {
    return fail("請輸入清晰 Job 名稱；最多 240 字。");
  }
  if (!brandId) return fail("請選擇品牌。");
  if (!sourceTaxonomyId || !usageTaxonomyId || !mediaFormatTaxonomyId) {
    return fail("請分別選擇 Source、用途同媒體格式。");
  }
  if (!isIsoDate(startDate) || !isIsoDate(dueDate)) {
    return fail("請設定有效 Start Day 同 Due Day。");
  }
  if (dueDate < startDate) {
    return fail("Due Day 唔可以早過 Start Day。");
  }
  if (!creativePriorities.includes(priority as never)) {
    return fail("所選優先級無效。");
  }
  if (!creativeWorkloads.includes(workload as never)) {
    return fail("所選 Workload 無效。");
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
    return fail("數量必須介乎 1 至 999。");
  }
  if (specifications.length > 4000) {
    return fail("輸出要求最多 4,000 字。");
  }
  if (!isSafeOptionalUrl(sourceUrl) || !isSafeOptionalUrl(referenceUrl)) {
    return fail("素材及 Reference 連結必須係有效 HTTP／HTTPS 網址。");
  }
  if (syncCalendar && !isIsoDate(publishDate)) {
    return fail("同步營銷日曆時必須設定 Publish Day。");
  }
  if (syncCalendar && publishDate < dueDate) {
    return fail("Publish Day 唔可以早過 Due Day。");
  }

  const config = await getConfigurationData();
  const brand = config.brands.find((item) => item.id === brandId);
  if (!brand) return fail("所選品牌唔喺你嘅權限範圍。");

  const supabase = createSupabaseAdminClient();
  const taxonomyIds = [
    sourceTaxonomyId,
    usageTaxonomyId,
    mediaFormatTaxonomyId,
  ];
  const taxonomyResult = await supabase
    .from("creative_taxonomy_items")
    .select("id,category,name,is_active")
    .in("id", taxonomyIds);
  if (taxonomyResult.error) return fail("未能讀取設計分類，請稍後再試。");

  const taxonomyMap = new Map(
    (taxonomyResult.data ?? []).map((item) => [String(item.id), item])
  );
  const categoryContract = [
    [sourceTaxonomyId, "source"],
    [usageTaxonomyId, "usage"],
    [mediaFormatTaxonomyId, "media_format"],
  ] as const;
  if (
    categoryContract.some(
      ([id, category]) =>
        !taxonomyMap.has(id) ||
        taxonomyMap.get(id)?.category !== category ||
        taxonomyMap.get(id)?.is_active !== true
    )
  ) {
    return fail("Source、用途或媒體格式選項已停用或無效。");
  }

  let assigneeMemberId = "";
  let assigneeEmail = "";
  let assigneeProfileName = "";
  if (designerId) {
    const { data: profile, error: profileError } = await supabase
      .from("creative_designer_profiles")
      .select("id,display_name,linked_member_id,is_active")
      .eq("id", designerId)
      .maybeSingle();
    if (profileError || !profile || profile.is_active !== true) {
      return fail("所選 Designer 已停用或不存在。");
    }
    assigneeProfileName = String(profile.display_name || "");
    assigneeMemberId =
      typeof profile.linked_member_id === "string"
        ? profile.linked_member_id
        : "";
    if (assigneeMemberId) {
      const { data: member } = await supabase
        .from("workspace_members")
        .select("email,status")
        .eq("id", assigneeMemberId)
        .maybeSingle();
      if (member?.status === "active" || member?.status === "invited") {
        assigneeEmail = String(member.email || "");
      } else {
        assigneeMemberId = "";
      }
    }
  }

  const usageName = String(taxonomyMap.get(usageTaxonomyId)?.name || "");
  const status =
    materialStatus === "waiting"
      ? "waiting_assets"
      : designerId
        ? "assigned"
        : "draft";
  const requesterEmail =
    session.access.email ||
    (session.access.accessLevel === "master" ? "master" : "shared_admin");

  const { data: created, error: createError } = await supabase
    .from("creative_jobs")
    .insert({
      brand_id: brand.id,
      title,
      status,
      priority,
      workload,
      start_date: startDate,
      start_time: startTime || null,
      due_date: dueDate,
      due_time: dueTime || null,
      publish_date: null,
      publish_time: null,
      sync_calendar: false,
      source_taxonomy_id: sourceTaxonomyId,
      usage_taxonomy_id: usageTaxonomyId,
      media_format_taxonomy_id: mediaFormatTaxonomyId,
      assignee_profile_id: designerId || null,
      assignee_member_id: assigneeMemberId || null,
      requester_member_id: session.access.memberId ?? null,
      requester_email: requesterEmail,
      material_status: materialStatus,
      quantity,
      specifications: specifications || null,
      source_url: sourceUrl || null,
      reference_url: referenceUrl || null,
      brief_document: defaultCreativeBrief,
      brief_plain_text:
        "Campaign 目的\nDeliverables／輸出要求\n畫面及 Reference\n必須遵守／不可出現",
    })
    .select("id")
    .single();

  if (createError || !created?.id) {
    console.warn("creative_job_create_failed", {
      code: createError?.code,
      message: createError?.message,
    });
    return fail("未能建立設計工作，請重新載入後再試。");
  }

  const jobId = String(created.id);
  if (syncCalendar) {
    const { error: calendarError } = await supabase.rpc(
      "save_creative_job_with_calendar",
      {
        p_job_id: jobId,
        p_payload: {
          title,
          brandId,
          treatmentId: "",
          treatmentLabel: "",
          status,
          priority,
          workload,
          startDate,
          startTime,
          dueDate,
          dueTime,
          syncCalendar: true,
          publishDate,
          publishTime,
          sourceTaxonomyId,
          usageTaxonomyId,
          mediaFormatTaxonomyId,
          assigneeProfileId: designerId,
          assigneeMemberId,
          assigneeEmail,
          materialStatus,
          quantity,
          specifications,
          sourceUrl,
          referenceUrl,
          calendarItemType: creativeCalendarItemType(usageName),
          calendarChannel: usageName,
          showOnPerformanceTimeline: /feed|story|ad|reel|短片/i.test(
            usageName
          ),
        },
      }
    );
    if (calendarError) {
      console.warn("creative_job_create_calendar_failed", {
        code: calendarError.code,
        message: calendarError.message,
      });
      await supabase.from("creative_jobs").delete().eq("id", jobId);
      return fail("未能同步 Publish Day 到營銷日曆，Job 尚未建立。");
    }
  }

  await writeCreativeAudit({
    jobId,
    access: session.access,
    action: "creative_job.created",
    after: {
      title,
      brandId,
      designerId: designerId || null,
      sourceTaxonomyId,
      usageTaxonomyId,
      mediaFormatTaxonomyId,
      priority,
      workload,
      startDate,
      dueDate,
      publishDate: syncCalendar ? publishDate : null,
      status,
    },
  });

  if (assigneeMemberId) {
    await queueCreativeNotification({
      recipientMemberId: assigneeMemberId,
      recipientEmail: assigneeEmail,
      brandId,
      jobId,
      type: "creative_assigned",
      title:
        priority === "urgent" ? "緊急設計工作已派畀你" : "新設計工作已派畀你",
      body: `${title}${assigneeProfileName ? ` · ${assigneeProfileName}` : ""}`,
      dedupeKey: `creative_assigned:${jobId}:${assigneeMemberId}:${Date.now()}`,
    });
  }

  revalidatePath("/creative-jobs");
  revalidatePath("/calendar");
  redirect(`/creative-jobs/${jobId}`);
}
