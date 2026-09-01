"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  requireModuleAccess,
  verifyCurrentInternalAccess,
} from "@/lib/security/internalAccessServer";
import { getConfigurationData } from "@/lib/data/configuration";
import {
  canContributeCreativeAssets,
  canEditCreativeJobMetadata,
  canManageCreativeTaxonomy,
  canUpdateCreativeJobStatus,
  isCreativeDesignerRole,
  isCreativeOperationsRole,
} from "@/lib/creative/access";
import {
  creativeCalendarItemType,
  getCreativeJobAccessRecord,
  getHongKongToday,
  queueCreativeNotification,
  writeCreativeAudit,
} from "@/lib/creative/store";
import {
  creativeAssetPurposes,
  creativeJobStatuses,
  creativePriorities,
  creativeTaxonomyCategories,
  creativeWorkloads,
} from "@/lib/creative/types";

function readString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function readBoolean(formData: FormData, key: string) {
  return ["1", "true", "on", "yes"].includes(
    readString(formData, key).toLowerCase()
  );
}

function safeCreativePath(value: string, fallback = "/creative-jobs") {
  return value === "/creative-jobs" ||
    value.startsWith("/creative-jobs?") ||
    /^\/creative-jobs\/[0-9a-f-]+(?:\?.*)?$/i.test(value) ||
    value === "/settings/creative" ||
    value.startsWith("/settings/creative?")
    ? value
    : fallback;
}

function redirectWithMessage(
  path: string,
  ok: boolean,
  message: string
): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(
    `${path}${separator}creative_status=${ok ? "success" : "error"}&creative_message=${encodeURIComponent(
      message
    )}`
  );
}

async function requireCreativeAction() {
  const session = await verifyCurrentInternalAccess();
  if (!session.ok) redirect("/login?next=/creative-jobs");
  const moduleAccess = await requireModuleAccess("creative_jobs");
  if (!moduleAccess.allowed) {
    redirectWithMessage(
      "/dashboard",
      false,
      "你未獲授權使用設計工作功能。"
    );
  }
  return session.access;
}

function revalidateCreative(jobId?: string) {
  revalidatePath("/creative-jobs");
  revalidatePath("/settings/creative");
  revalidatePath("/calendar");
  if (jobId) revalidatePath(`/creative-jobs/${jobId}`);
}

export async function createCreativeDraftAction(formData: FormData) {
  const access = await requireCreativeAction();
  if (!isCreativeOperationsRole(access)) {
    redirectWithMessage(
      "/creative-jobs",
      false,
      "只有 Marketer、Manager、Admin 或系統擁有人可以新增設計工作。"
    );
  }

  const config = await getConfigurationData();
  const requestedBrandId = readString(formData, "brandId");
  const brand = config.brands.find((item) => item.id === requestedBrandId) ??
    config.brands[0];
  if (!brand) {
    redirectWithMessage(
      "/creative-jobs",
      false,
      "你目前未獲授權管理任何品牌。"
    );
  }

  const supabase = createSupabaseAdminClient();
  const today = getHongKongToday();
  const { data, error } = await supabase
    .from("creative_jobs")
    .insert({
      brand_id: brand.id,
      title: "未命名設計工作",
      status: "draft",
      priority: "normal",
      workload: "M",
      start_date: today,
      requester_member_id: access.memberId ?? null,
      requester_email:
        access.email ||
        (access.accessLevel === "master" ? "master" : "shared_admin"),
      brief_document: {
        type: "doc",
        content: [
          { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Campaign 目的" }] },
          { type: "paragraph", content: [{ type: "text", text: "寫低今次內容／廣告要解決嘅問題，同埋成功標準。" }] },
          { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Deliverables／輸出要求" }] },
          { type: "taskList", content: [{ type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "列明數量、尺寸、片長、平台、字幕、VO 同版本要求" }] }] }] },
          { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "畫面及 Reference" }] },
          { type: "paragraph", content: [{ type: "text", text: "可直接 Ctrl + V 貼 Screenshot，或者由右邊素材庫插入圖片及 Google Drive 連結。" }] },
          { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "必須遵守／不可出現" }] },
          { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "價錢、CTA、Logo、合規字眼及品牌要求" }] }] }] },
        ],
      },
      brief_plain_text: "Campaign 目的\nDeliverables／輸出要求\n畫面及 Reference\n必須遵守／不可出現",
    })
    .select("id")
    .single();
  if (error || !data?.id) {
    console.warn("creative_job_draft_create_failed", {
      code: error?.code,
      message: error?.message,
    });
    redirectWithMessage(
      "/creative-jobs",
      false,
      "未能建立設計工作，請確認 Creative Studio Database 已完成設定。"
    );
  }

  await writeCreativeAudit({
    jobId: data.id,
    access,
    action: "creative_job.created",
    after: { brandId: brand.id, startDate: today, status: "draft" },
  });
  redirect(`/creative-jobs/${data.id}`);
}

export async function updateCreativeJobAction(formData: FormData) {
  const access = await requireCreativeAction();
  const jobId = readString(formData, "jobId");
  const returnPath = safeCreativePath(
    readString(formData, "returnPath"),
    `/creative-jobs/${jobId}`
  );
  const record = await getCreativeJobAccessRecord(jobId);
  if (!record.job) {
    redirectWithMessage(returnPath, false, "搵唔到設計工作或你未有權限。" );
  }
  const current = record.job;
  if (
    !canEditCreativeJobMetadata(access, {
      brandId: String(current.brand_id),
      assigneeMemberId:
        typeof current.assignee_member_id === "string"
          ? current.assignee_member_id
          : null,
    })
  ) {
    redirectWithMessage(returnPath, false, "你只可以查看呢張設計工作。" );
  }

  const title = readString(formData, "title");
  const brandId = readString(formData, "brandId");
  const treatmentId = readString(formData, "treatmentId");
  const status = readString(formData, "status") || "draft";
  const priority = readString(formData, "priority") || "normal";
  const workload = readString(formData, "workload") || "M";
  const startDate = readString(formData, "startDate");
  const dueDate = readString(formData, "dueDate");
  const syncCalendar = readBoolean(formData, "syncCalendar");
  const publishDate = readString(formData, "publishDate");
  const materialStatus =
    readString(formData, "materialStatus") === "waiting"
      ? "waiting"
      : "ready";
  const quantity = Number(readString(formData, "quantity") || 1);
  const sourceTaxonomyId = readString(formData, "sourceTaxonomyId");
  const usageTaxonomyId = readString(formData, "usageTaxonomyId");
  const mediaFormatTaxonomyId = readString(
    formData,
    "mediaFormatTaxonomyId"
  );
  const assigneeProfileId = readString(formData, "assigneeProfileId");

  if (
    !title ||
    title.length > 240 ||
    !brandId ||
    !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
    (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) ||
    !creativeJobStatuses.includes(status as never) ||
    !creativePriorities.includes(priority as never) ||
    !creativeWorkloads.includes(workload as never) ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 999
  ) {
    redirectWithMessage(returnPath, false, "請檢查 Job 名稱、日期、狀態、優先級同數量。" );
  }
  if (dueDate && dueDate < startDate) {
    redirectWithMessage(returnPath, false, "Due Day 唔可以早過 Start Day。" );
  }
  if (syncCalendar && !publishDate) {
    redirectWithMessage(returnPath, false, "同步日曆時必須填寫 Publish Day。" );
  }
  if (publishDate && dueDate && publishDate < dueDate) {
    redirectWithMessage(returnPath, false, "Publish Day 唔可以早過 Due Day。" );
  }

  const config = await getConfigurationData();
  const brand = config.brands.find((item) => item.id === brandId);
  if (!brand) {
    redirectWithMessage(returnPath, false, "所選品牌唔喺你嘅權限範圍。" );
  }
  const treatment = treatmentId
    ? config.treatments.find(
        (item) => item.id === treatmentId && item.brandId === brandId
      )
    : null;
  if (treatmentId && !treatment) {
    redirectWithMessage(returnPath, false, "所選療程唔屬於呢個品牌。" );
  }

  const supabase = createSupabaseAdminClient();
  const taxonomyIds = [
    sourceTaxonomyId,
    usageTaxonomyId,
    mediaFormatTaxonomyId,
  ].filter(Boolean);
  const taxonomyResult = taxonomyIds.length
    ? await supabase
        .from("creative_taxonomy_items")
        .select("id,category,name,is_active")
        .in("id", taxonomyIds)
    : { data: [], error: null };
  if (taxonomyResult.error) {
    redirectWithMessage(returnPath, false, "未能讀取設計分類。" );
  }
  const taxonomyMap = new Map(
    (taxonomyResult.data ?? []).map((item) => [String(item.id), item])
  );
  const expectedCategories = [
    [sourceTaxonomyId, "source"],
    [usageTaxonomyId, "usage"],
    [mediaFormatTaxonomyId, "media_format"],
  ] as const;
  if (
    expectedCategories.some(
      ([id, category]) =>
        id &&
        (!taxonomyMap.has(id) ||
          taxonomyMap.get(id)?.category !== category ||
          taxonomyMap.get(id)?.is_active !== true)
    )
  ) {
    redirectWithMessage(returnPath, false, "Source、用途或媒體格式選項無效。" );
  }

  if (assigneeProfileId) {
    if (title === "未命名設計工作") {
      redirectWithMessage(returnPath, false, "派 Job 前請先填寫清晰 Job 名稱。" );
    }
    if (!dueDate) {
      redirectWithMessage(returnPath, false, "派 Job 畀 Designer 前必須設定 Due Day。" );
    }
    if (!sourceTaxonomyId || !usageTaxonomyId || !mediaFormatTaxonomyId) {
      redirectWithMessage(
        returnPath,
        false,
        "派 Job 前必須分別選擇 Source、用途同媒體格式。"
      );
    }
  }

  let assigneeMemberId = "";
  let assigneeEmail = "";
  let assigneeProfileName = "";
  if (assigneeProfileId) {
    const { data: profile } = await supabase
      .from("creative_designer_profiles")
      .select("id,display_name,linked_member_id,is_active")
      .eq("id", assigneeProfileId)
      .maybeSingle();
    if (!profile || profile.is_active !== true) {
      redirectWithMessage(returnPath, false, "所選 Designer 已停用或不存在。" );
    }
    assigneeProfileName = String(profile.display_name);
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

  const usageName = usageTaxonomyId
    ? String(taxonomyMap.get(usageTaxonomyId)?.name || "")
    : "";
  const showOnPerformanceTimeline = /feed|story|ad|reel|短片/i.test(
    usageName
  );
  const nextStatus =
    materialStatus === "waiting" && !["draft", "cancelled"].includes(status)
      ? "waiting_assets"
      : status === "draft" && assigneeProfileId
        ? "assigned"
        : status;
  const payload = {
    title,
    brandId,
    treatmentId: treatment?.id ?? "",
    treatmentLabel: treatment?.name ?? "",
    status: nextStatus,
    priority,
    workload,
    startDate,
    startTime: readString(formData, "startTime"),
    dueDate,
    dueTime: readString(formData, "dueTime"),
    syncCalendar,
    publishDate: syncCalendar ? publishDate : "",
    publishTime: syncCalendar ? readString(formData, "publishTime") : "",
    sourceTaxonomyId,
    usageTaxonomyId,
    mediaFormatTaxonomyId,
    assigneeProfileId,
    assigneeMemberId,
    assigneeEmail,
    materialStatus,
    quantity,
    specifications: readString(formData, "specifications"),
    sourceUrl: readString(formData, "sourceUrl"),
    referenceUrl: readString(formData, "referenceUrl"),
    calendarItemType: creativeCalendarItemType(usageName),
    calendarChannel: usageName,
    showOnPerformanceTimeline,
  };

  const { error } = await supabase.rpc("save_creative_job_with_calendar", {
    p_job_id: jobId,
    p_payload: payload,
  });
  if (error) {
    console.warn("creative_job_update_failed", {
      code: error.code,
      message: error.message,
    });
    const message = error.message.includes("creative_calendar_already_published")
      ? "呢個日曆事項已經 Published，唔可以由設計工作改寫歷史出街日期。"
      : "未能儲存設計工作，請重新載入後再試。";
    redirectWithMessage(returnPath, false, message);
  }

  await writeCreativeAudit({
    jobId,
    access,
    action: "creative_job.updated",
    before: {
      title: current.title,
      status: current.status,
      priority: current.priority,
      assigneeProfileId: current.assignee_profile_id,
      startDate: current.start_date,
      dueDate: current.due_date,
      publishDate: current.publish_date,
    },
    after: payload,
  });

  const previousAssignee =
    typeof current.assignee_member_id === "string"
      ? current.assignee_member_id
      : "";
  if (assigneeMemberId && assigneeMemberId !== previousAssignee) {
    await queueCreativeNotification({
      recipientMemberId: assigneeMemberId,
      recipientEmail: assigneeEmail,
      brandId,
      jobId,
      type: "creative_assigned",
      title: priority === "urgent" ? "緊急設計工作已派畀你" : "新設計工作已派畀你",
      body: `${title}${assigneeProfileName ? ` · ${assigneeProfileName}` : ""}`,
      dedupeKey: `creative_assigned:${jobId}:${assigneeMemberId}:${Date.now()}`,
    });
  } else if (
    assigneeMemberId &&
    priority !== String(current.priority) &&
    priority !== "normal"
  ) {
    await queueCreativeNotification({
      recipientMemberId: assigneeMemberId,
      recipientEmail: assigneeEmail,
      brandId,
      jobId,
      type: "creative_priority_changed",
      title: priority === "urgent" ? "設計工作已改為緊急" : "設計工作已改為優先",
      body: title,
      dedupeKey: `creative_priority:${jobId}:${priority}:${Date.now()}`,
    });
  }

  revalidateCreative(jobId);
  redirectWithMessage(
    returnPath,
    true,
    assigneeProfileId && !assigneeMemberId
      ? "設計工作已儲存；Designer 尚未連結個人帳戶，所以暫時唔會收到桌面通知。"
      : "設計工作已儲存。"
  );
}

export async function updateCreativeJobStatusAction(formData: FormData) {
  const access = await requireCreativeAction();
  const jobId = readString(formData, "jobId");
  const status = readString(formData, "status");
  const returnPath = safeCreativePath(
    readString(formData, "returnPath"),
    `/creative-jobs/${jobId}`
  );
  const record = await getCreativeJobAccessRecord(jobId);
  if (!record.job || !creativeJobStatuses.includes(status as never)) {
    redirectWithMessage(returnPath, false, "工作狀態操作無效。" );
  }
  const current = record.job;
  const subject = {
    brandId: String(current.brand_id),
    assigneeMemberId:
      typeof current.assignee_member_id === "string"
        ? current.assignee_member_id
        : null,
  };
  if (!canUpdateCreativeJobStatus(access, subject)) {
    redirectWithMessage(returnPath, false, "你未獲授權更新呢張工作嘅狀態。" );
  }
  const designerAllowed = new Set([
    "in_progress",
    "review",
    "delivered",
    "blocked",
    "waiting_assets",
  ]);
  if (isCreativeDesignerRole(access) && !designerAllowed.has(status)) {
    redirectWithMessage(
      returnPath,
      false,
      "Designer 可以更新製作、待 Review、Final、等素材或 Blocked 狀態；批核及完成由 Marketer 處理。"
    );
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("creative_jobs")
    .update({
      status,
      completed_at: status === "completed" ? new Date().toISOString() : null,
      revision_count:
        status === "revision" && current.status !== "revision"
          ? Number(current.revision_count || 0) + 1
          : Number(current.revision_count || 0),
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
  if (error) {
    redirectWithMessage(returnPath, false, "未能更新工作狀態。" );
  }

  const { data: latestVersion } = await supabase
    .from("creative_job_brief_versions")
    .select("version_no")
    .eq("job_id", jobId)
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  await supabase.from("creative_job_brief_versions").insert({
    job_id: jobId,
    version_no: Number(latestVersion?.version_no || 0) + 1,
    document: current.brief_document,
    plain_text: String(current.brief_plain_text || ""),
    reason: "status_change",
    created_by_member_id: access.memberId ?? null,
    created_by_email: access.email ?? null,
  });

  await writeCreativeAudit({
    jobId,
    access,
    action: "creative_job.status_changed",
    before: { status: current.status },
    after: { status },
  });

  const notifyRequester = ["review", "delivered", "blocked"].includes(status);
  const notifyDesigner = ["revision", "approved", "completed"].includes(status);
  if (notifyRequester && current.requester_member_id !== access.memberId) {
    await queueCreativeNotification({
      recipientMemberId:
        typeof current.requester_member_id === "string"
          ? current.requester_member_id
          : null,
      recipientEmail:
        typeof current.requester_email === "string"
          ? current.requester_email
          : null,
      brandId: String(current.brand_id),
      jobId,
      type: `creative_${status}`,
      title:
        status === "review"
          ? "設計稿已提交 Review"
          : status === "delivered"
            ? "Final 素材已交付"
            : "設計工作遇到阻礙",
      body: String(current.title),
      dedupeKey: `creative_status:${jobId}:${status}:${Date.now()}`,
    });
  }
  if (notifyDesigner && current.assignee_member_id !== access.memberId) {
    await queueCreativeNotification({
      recipientMemberId:
        typeof current.assignee_member_id === "string"
          ? current.assignee_member_id
          : null,
      recipientEmail: null,
      brandId: String(current.brand_id),
      jobId,
      type: `creative_${status}`,
      title:
        status === "revision"
          ? "設計工作需要修改"
          : status === "approved"
            ? "設計稿已批准"
            : "設計工作已完成",
      body: String(current.title),
      dedupeKey: `creative_status:${jobId}:${status}:${Date.now()}`,
    });
  }

  revalidateCreative(jobId);
  redirectWithMessage(returnPath, true, "工作狀態已更新。" );
}

export async function addCreativeLinkAssetAction(formData: FormData) {
  const access = await requireCreativeAction();
  const jobId = readString(formData, "jobId");
  const returnPath = safeCreativePath(
    readString(formData, "returnPath"),
    `/creative-jobs/${jobId}`
  );
  const label = readString(formData, "label");
  const url = readString(formData, "url");
  const purpose = readString(formData, "purpose") || "source";
  const record = await getCreativeJobAccessRecord(jobId);
  if (
    !record.job ||
    !canContributeCreativeAssets(access, {
      brandId: String(record.job.brand_id),
      assigneeMemberId:
        typeof record.job.assignee_member_id === "string"
          ? record.job.assignee_member_id
          : null,
    })
  ) {
    redirectWithMessage(returnPath, false, "你未獲授權加入素材。" );
  }
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    redirectWithMessage(returnPath, false, "請輸入完整有效嘅素材連結。" );
  }
  if (
    !["https:", "http:"].includes(parsedUrl.protocol) ||
    !label ||
    label.length > 240 ||
    !creativeAssetPurposes.includes(purpose as never)
  ) {
    redirectWithMessage(returnPath, false, "素材名稱、用途或連結無效。" );
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("creative_job_assets")
    .insert({
      job_id: jobId,
      asset_kind: "link",
      purpose,
      label,
      external_url: parsedUrl.toString(),
      created_by_member_id: access.memberId ?? null,
      created_by_email: access.email ?? null,
    })
    .select("id")
    .single();
  if (error) {
    redirectWithMessage(returnPath, false, "未能加入素材連結。" );
  }
  await writeCreativeAudit({
    jobId,
    access,
    action: "creative_asset.linked",
    after: { assetId: data?.id, label, purpose, url: parsedUrl.toString() },
  });
  revalidateCreative(jobId);
  redirectWithMessage(returnPath, true, "素材連結已加入 Job 素材庫。" );
}

export async function removeCreativeAssetAction(formData: FormData) {
  const access = await requireCreativeAction();
  const jobId = readString(formData, "jobId");
  const assetId = readString(formData, "assetId");
  const returnPath = safeCreativePath(
    readString(formData, "returnPath"),
    `/creative-jobs/${jobId}`
  );
  const record = await getCreativeJobAccessRecord(jobId);
  if (
    !record.job ||
    !canContributeCreativeAssets(access, {
      brandId: String(record.job.brand_id),
      assigneeMemberId:
        typeof record.job.assignee_member_id === "string"
          ? record.job.assignee_member_id
          : null,
    })
  ) {
    redirectWithMessage(returnPath, false, "你未獲授權移除素材。" );
  }
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("creative_job_assets")
    .update({ removed_at: new Date().toISOString() })
    .eq("id", assetId)
    .eq("job_id", jobId);
  if (error) redirectWithMessage(returnPath, false, "未能移除素材。" );
  await writeCreativeAudit({
    jobId,
    access,
    action: "creative_asset.unlinked",
    after: { assetId },
  });
  revalidateCreative(jobId);
  redirectWithMessage(
    returnPath,
    true,
    "素材已從呢張 Job 解除連結；Google Drive 或原始檔案冇被刪除。"
  );
}

export async function addCreativeCommentAction(formData: FormData) {
  const access = await requireCreativeAction();
  const jobId = readString(formData, "jobId");
  const body = readString(formData, "body");
  const returnPath = safeCreativePath(
    readString(formData, "returnPath"),
    `/creative-jobs/${jobId}`
  );
  const record = await getCreativeJobAccessRecord(jobId);
  if (!record.job || !body || body.length > 4000) {
    redirectWithMessage(returnPath, false, "留言內容無效或你未有權限。" );
  }
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("creative_job_comments").insert({
    job_id: jobId,
    author_member_id: access.memberId ?? null,
    author_email: access.email ?? null,
    body,
  });
  if (error) redirectWithMessage(returnPath, false, "未能加入留言。" );

  const requesterId =
    typeof record.job.requester_member_id === "string"
      ? record.job.requester_member_id
      : null;
  const assigneeId =
    typeof record.job.assignee_member_id === "string"
      ? record.job.assignee_member_id
      : null;
  const recipient = access.memberId === assigneeId ? requesterId : assigneeId;
  if (recipient && recipient !== access.memberId) {
    await queueCreativeNotification({
      recipientMemberId: recipient,
      recipientEmail: null,
      brandId: String(record.job.brand_id),
      jobId,
      type: "creative_comment",
      title: "設計工作有新留言",
      body: `${String(record.job.title)} · ${body.slice(0, 120)}`,
      dedupeKey: `creative_comment:${jobId}:${Date.now()}`,
    });
  }
  await writeCreativeAudit({
    jobId,
    access,
    action: "creative_comment.created",
    after: { excerpt: body.slice(0, 160) },
  });
  revalidateCreative(jobId);
  redirectWithMessage(returnPath, true, "留言已加入。" );
}

export async function markCreativeNotificationReadAction(formData: FormData) {
  const access = await requireCreativeAction();
  const notificationId = readString(formData, "notificationId");
  const returnPath = safeCreativePath(
    readString(formData, "returnPath"),
    "/creative-jobs"
  );
  if (!access.memberId) redirectWithMessage(returnPath, false, "通知帳戶無效。" );
  const supabase = createSupabaseAdminClient();
  await supabase
    .from("marketing_notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("recipient_member_id", access.memberId)
    .not("creative_job_id", "is", null);
  revalidateCreative();
  redirect(returnPath);
}

export async function deleteCreativeJobAction(formData: FormData) {
  const access = await requireCreativeAction();
  const jobId = readString(formData, "jobId");
  const record = await getCreativeJobAccessRecord(jobId);
  if (
    !record.job ||
    !canEditCreativeJobMetadata(access, {
      brandId: String(record.job.brand_id),
      assigneeMemberId:
        typeof record.job.assignee_member_id === "string"
          ? record.job.assignee_member_id
          : null,
    })
  ) {
    redirectWithMessage("/creative-jobs", false, "你未獲授權刪除呢張工作。" );
  }
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("creative_jobs")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", jobId);
  if (error) redirectWithMessage("/creative-jobs", false, "未能刪除設計工作。" );
  await writeCreativeAudit({
    jobId,
    access,
    action: "creative_job.deleted",
    before: { title: record.job.title, status: record.job.status },
  });
  revalidateCreative(jobId);
  redirectWithMessage(
    "/creative-jobs",
    true,
    "設計工作已從 Job List 刪除；系統 Audit 記錄仍然保留。"
  );
}

async function requireCreativeSettings() {
  const access = await requireCreativeAction();
  if (!canManageCreativeTaxonomy(access)) {
    redirectWithMessage(
      "/creative-jobs",
      false,
      "分類、Designer 名單同連結帳戶只限系統擁有人管理。"
    );
  }
  return access;
}

export async function createCreativeTaxonomyAction(formData: FormData) {
  const access = await requireCreativeSettings();
  const category = readString(formData, "category");
  const name = readString(formData, "name");
  if (
    !creativeTaxonomyCategories.includes(category as never) ||
    !name ||
    name.length > 120
  ) {
    redirectWithMessage("/settings/creative", false, "分類名稱或類型無效。" );
  }
  const supabase = createSupabaseAdminClient();
  const { data: maxRow } = await supabase
    .from("creative_taxonomy_items")
    .select("sort_order")
    .eq("category", category)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("creative_taxonomy_items").insert({
    category,
    name,
    sort_order: Number(maxRow?.sort_order || 0) + 10,
    created_by_member_id: access.memberId ?? null,
    updated_by_member_id: access.memberId ?? null,
  });
  if (error) {
    redirectWithMessage(
      "/settings/creative",
      false,
      error.code === "23505" ? "呢個分類已經存在。" : "未能新增分類。"
    );
  }
  await writeCreativeAudit({
    access,
    action: "creative_taxonomy.created",
    after: { category, name },
  });
  revalidateCreative();
  redirectWithMessage("/settings/creative", true, "分類已新增。" );
}

export async function updateCreativeTaxonomyAction(formData: FormData) {
  const access = await requireCreativeSettings();
  const taxonomyId = readString(formData, "taxonomyId");
  const name = readString(formData, "name");
  const isActive = readBoolean(formData, "isActive");
  const sortOrder = Number(readString(formData, "sortOrder") || 0);
  if (!taxonomyId || !name || name.length > 120 || !Number.isInteger(sortOrder)) {
    redirectWithMessage("/settings/creative", false, "分類設定無效。" );
  }
  const supabase = createSupabaseAdminClient();
  const { data: before } = await supabase
    .from("creative_taxonomy_items")
    .select("category,name,is_active,sort_order")
    .eq("id", taxonomyId)
    .maybeSingle();
  const { error } = await supabase
    .from("creative_taxonomy_items")
    .update({
      name,
      is_active: isActive,
      sort_order: Math.max(0, sortOrder),
      updated_by_member_id: access.memberId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taxonomyId);
  if (error) {
    redirectWithMessage(
      "/settings/creative",
      false,
      error.code === "23505" ? "同類別已有相同名稱。" : "未能更新分類。"
    );
  }
  await writeCreativeAudit({
    access,
    action: "creative_taxonomy.updated",
    before: before ?? null,
    after: { taxonomyId, name, isActive, sortOrder },
  });
  revalidateCreative();
  redirectWithMessage("/settings/creative", true, "分類已更新。" );
}

export async function deleteCreativeTaxonomyAction(formData: FormData) {
  const access = await requireCreativeSettings();
  const taxonomyId = readString(formData, "taxonomyId");
  const supabase = createSupabaseAdminClient();
  const { count } = await supabase
    .from("creative_jobs")
    .select("id", { count: "exact", head: true })
    .or(
      `source_taxonomy_id.eq.${taxonomyId},usage_taxonomy_id.eq.${taxonomyId},media_format_taxonomy_id.eq.${taxonomyId}`
    );
  if ((count ?? 0) > 0) {
    redirectWithMessage(
      "/settings/creative",
      false,
      "呢個分類已被工作使用，只可以停用，唔可以永久刪除。"
    );
  }
  const { data: before, error } = await supabase
    .from("creative_taxonomy_items")
    .delete()
    .eq("id", taxonomyId)
    .select("category,name")
    .maybeSingle();
  if (error) redirectWithMessage("/settings/creative", false, "未能刪除分類。" );
  await writeCreativeAudit({
    access,
    action: "creative_taxonomy.deleted",
    before: before ?? null,
  });
  revalidateCreative();
  redirectWithMessage("/settings/creative", true, "未使用分類已永久刪除。" );
}

export async function saveCreativeDesignerProfileAction(formData: FormData) {
  const access = await requireCreativeSettings();
  const profileId = readString(formData, "profileId");
  const displayName = readString(formData, "displayName");
  const linkedMemberId = readString(formData, "linkedMemberId");
  const isActive = readBoolean(formData, "isActive");
  const sortOrder = Number(readString(formData, "sortOrder") || 0);
  if (!displayName || displayName.length > 120 || !Number.isInteger(sortOrder)) {
    redirectWithMessage("/settings/creative", false, "Designer 名稱或排序無效。" );
  }
  const supabase = createSupabaseAdminClient();
  if (linkedMemberId) {
    const { data: member } = await supabase
      .from("workspace_members")
      .select("id,status")
      .eq("id", linkedMemberId)
      .neq("status", "removed")
      .maybeSingle();
    if (!member) {
      redirectWithMessage("/settings/creative", false, "所選團隊帳戶無效。" );
    }
  }
  const payload = {
    display_name: displayName,
    linked_member_id: linkedMemberId || null,
    is_active: isActive,
    sort_order: Math.max(0, sortOrder),
    updated_by_member_id: access.memberId ?? null,
    updated_at: new Date().toISOString(),
  };
  const result = profileId
    ? await supabase
        .from("creative_designer_profiles")
        .update(payload)
        .eq("id", profileId)
    : await supabase.from("creative_designer_profiles").insert({
        ...payload,
        created_by_member_id: access.memberId ?? null,
      });
  if (result.error) {
    redirectWithMessage(
      "/settings/creative",
      false,
      result.error.code === "23505"
        ? "Designer 名稱或團隊帳戶已被另一個 Designer 使用。"
        : "未能儲存 Designer。"
    );
  }
  await writeCreativeAudit({
    access,
    action: profileId
      ? "creative_designer.updated"
      : "creative_designer.created",
    after: { profileId, displayName, linkedMemberId, isActive, sortOrder },
  });
  revalidateCreative();
  redirectWithMessage(
    "/settings/creative",
    true,
    linkedMemberId
      ? "Designer 已連結個人帳戶；對方開啟桌面通知後會收到派 Job 提醒。"
      : "Designer 已儲存，但未連結帳戶。"
  );
}
