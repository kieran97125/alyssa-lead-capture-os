import "server-only";

import { getConfigurationData } from "@/lib/data/configuration";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentInternalAccess } from "@/lib/security/internalAccessServer";
import type { InternalAccessContext } from "@/lib/security/internalAccess";
import {
  canAccessCreativeBrand,
  canContributeCreativeAssets,
  canEditCreativeBrief,
  canEditCreativeJobMetadata,
  canManageCreativeTaxonomy,
  canUpdateCreativeJobStatus,
  canViewCreativeJob,
  getCreativeWorkspaceRole,
  isCreativeOperationsRole,
} from "@/lib/creative/access";
import {
  creativeJobStatuses,
  type CreativeAsset,
  type CreativeBriefVersion,
  type CreativeComment,
  type CreativeDesignerProfile,
  type CreativeJobRow,
  type CreativeListFilters,
  type CreativeNotification,
  type CreativeTaxonomyCategory,
  type CreativeTaxonomyItem,
} from "@/lib/creative/types";

const jobColumns = [
  "id",
  "brand_id",
  "treatment_id",
  "treatment_label",
  "title",
  "status",
  "priority",
  "workload",
  "start_date",
  "start_time",
  "due_date",
  "due_time",
  "publish_date",
  "publish_time",
  "sync_calendar",
  "calendar_item_id",
  "source_taxonomy_id",
  "usage_taxonomy_id",
  "media_format_taxonomy_id",
  "assignee_profile_id",
  "assignee_member_id",
  "requester_member_id",
  "requester_email",
  "material_status",
  "quantity",
  "specifications",
  "source_url",
  "reference_url",
  "brief_document",
  "brief_plain_text",
  "revision_count",
  "completed_at",
  "created_at",
  "updated_at",
].join(",");

type RawRow = Record<string, unknown>;

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asBoolean(value: unknown) {
  return value === true;
}

export function getHongKongToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function mapTaxonomy(row: RawRow, usageCount = 0): CreativeTaxonomyItem {
  return {
    id: asString(row.id),
    category: asString(row.category) as CreativeTaxonomyCategory,
    name: asString(row.name),
    isActive: asBoolean(row.is_active),
    sortOrder: asNumber(row.sort_order),
    usageCount,
  };
}

function mapDesigner(
  row: RawRow,
  members: Map<string, RawRow>
): CreativeDesignerProfile {
  const memberId = asNullableString(row.linked_member_id);
  const member = memberId ? members.get(memberId) : null;
  return {
    id: asString(row.id),
    displayName: asString(row.display_name),
    linkedMemberId: memberId,
    linkedMemberName: member ? asNullableString(member.full_name) : null,
    linkedMemberEmail: member ? asNullableString(member.email) : null,
    isActive: asBoolean(row.is_active),
    sortOrder: asNumber(row.sort_order),
  };
}

function mapJob(
  row: RawRow,
  lookups: {
    brands: Map<string, string>;
    taxonomies: Map<string, CreativeTaxonomyItem>;
    designers: Map<string, CreativeDesignerProfile>;
    members: Map<string, RawRow>;
  }
): CreativeJobRow {
  const sourceId = asNullableString(row.source_taxonomy_id);
  const usageId = asNullableString(row.usage_taxonomy_id);
  const mediaId = asNullableString(row.media_format_taxonomy_id);
  const designerId = asNullableString(row.assignee_profile_id);
  const assigneeMemberId = asNullableString(row.assignee_member_id);
  const assigneeMember = assigneeMemberId
    ? lookups.members.get(assigneeMemberId)
    : null;
  return {
    id: asString(row.id),
    brandId: asString(row.brand_id),
    brandName:
      lookups.brands.get(asString(row.brand_id)) || "未命名品牌",
    treatmentId: asNullableString(row.treatment_id),
    treatmentLabel: asNullableString(row.treatment_label),
    title: asString(row.title, "未命名設計工作"),
    status: asString(row.status, "draft") as CreativeJobRow["status"],
    priority: asString(row.priority, "normal") as CreativeJobRow["priority"],
    workload: asString(row.workload, "M") as CreativeJobRow["workload"],
    startDate: asString(row.start_date),
    startTime: asNullableString(row.start_time),
    dueDate: asNullableString(row.due_date),
    dueTime: asNullableString(row.due_time),
    publishDate: asNullableString(row.publish_date),
    publishTime: asNullableString(row.publish_time),
    syncCalendar: asBoolean(row.sync_calendar),
    calendarItemId: asNullableString(row.calendar_item_id),
    sourceTaxonomyId: sourceId,
    sourceName: sourceId ? lookups.taxonomies.get(sourceId)?.name ?? null : null,
    usageTaxonomyId: usageId,
    usageName: usageId ? lookups.taxonomies.get(usageId)?.name ?? null : null,
    mediaFormatTaxonomyId: mediaId,
    mediaFormatName: mediaId
      ? lookups.taxonomies.get(mediaId)?.name ?? null
      : null,
    assigneeProfileId: designerId,
    assigneeProfileName: designerId
      ? lookups.designers.get(designerId)?.displayName ?? null
      : null,
    assigneeMemberId,
    assigneeEmail: assigneeMember
      ? asNullableString(assigneeMember.email)
      : null,
    requesterMemberId: asNullableString(row.requester_member_id),
    requesterEmail: asNullableString(row.requester_email),
    materialStatus:
      asString(row.material_status, "ready") === "waiting"
        ? "waiting"
        : "ready",
    quantity: asNumber(row.quantity, 1),
    specifications: asNullableString(row.specifications),
    sourceUrl: asNullableString(row.source_url),
    referenceUrl: asNullableString(row.reference_url),
    briefDocument:
      row.brief_document && typeof row.brief_document === "object"
        ? (row.brief_document as Record<string, unknown>)
        : { type: "doc", content: [{ type: "paragraph" }] },
    briefPlainText: asString(row.brief_plain_text),
    revisionCount: asNumber(row.revision_count),
    completedAt: asNullableString(row.completed_at),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  };
}

async function loadCreativeLookups() {
  const supabase = createSupabaseAdminClient();
  const [config, taxonomyResult, designerResult, memberResult] =
    await Promise.all([
      getConfigurationData(),
      supabase
        .from("creative_taxonomy_items")
        .select("id,category,name,is_active,sort_order")
        .order("category")
        .order("sort_order")
        .order("name"),
      supabase
        .from("creative_designer_profiles")
        .select("id,display_name,linked_member_id,is_active,sort_order")
        .order("sort_order")
        .order("display_name"),
      supabase
        .from("workspace_members")
        .select("id,email,full_name,workspace_role,status,is_master")
        .neq("status", "removed")
        .order("full_name"),
    ]);

  const members = new Map<string, RawRow>(
    (memberResult.data ?? []).map((row) => [String(row.id), row as RawRow])
  );
  const taxonomies = (taxonomyResult.data ?? []).map((row) =>
    mapTaxonomy(row as RawRow)
  );
  const designers = (designerResult.data ?? []).map((row) =>
    mapDesigner(row as RawRow, members)
  );

  return {
    schemaReady:
      !taxonomyResult.error && !designerResult.error && !memberResult.error,
    config,
    members,
    taxonomies,
    taxonomyMap: new Map(taxonomies.map((item) => [item.id, item])),
    designers,
    designerMap: new Map(designers.map((item) => [item.id, item])),
    brandMap: new Map(config.brands.map((brand) => [brand.id, brand.name])),
  };
}

function sortJobs(rows: CreativeJobRow[]) {
  const priorityWeight = { urgent: 0, priority: 1, normal: 2 } as const;
  return [...rows].sort((left, right) => {
    const start = left.startDate.localeCompare(right.startDate);
    if (start !== 0) return start;
    const priority =
      priorityWeight[left.priority] - priorityWeight[right.priority];
    if (priority !== 0) return priority;
    return (left.dueDate || "9999-12-31").localeCompare(
      right.dueDate || "9999-12-31"
    );
  });
}

export async function getCreativeListSnapshot(
  filters: CreativeListFilters = {}
) {
  const access = await getCurrentInternalAccess();
  const lookup = await loadCreativeLookups();
  if (!lookup.schemaReady) {
    return {
      schemaReady: false,
      access,
      jobs: [] as CreativeJobRow[],
      brands: lookup.config.brands,
      taxonomies: lookup.taxonomies,
      designers: lookup.designers,
      currentMemberId: access.memberId ?? null,
      canCreate: isCreativeOperationsRole(access),
      canManageSettings: canManageCreativeTaxonomy(access),
      stats: { open: 0, waiting: 0, review: 0, overdue: 0 },
      today: getHongKongToday(),
    };
  }

  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("creative_jobs")
    .select(jobColumns)
    .is("deleted_at", null)
    .limit(1000);

  if (access.source === "supabase_auth" && access.accessLevel !== "master") {
    const brandIds = access.brandIds ?? [];
    if (brandIds.length === 0) {
      return {
        schemaReady: true,
        access,
        jobs: [] as CreativeJobRow[],
        brands: lookup.config.brands,
        taxonomies: lookup.taxonomies,
        designers: lookup.designers,
        currentMemberId: access.memberId ?? null,
        canCreate: isCreativeOperationsRole(access),
        canManageSettings: false,
        stats: { open: 0, waiting: 0, review: 0, overdue: 0 },
        today: getHongKongToday(),
      };
    }
    query = query.in("brand_id", brandIds);
    if (getCreativeWorkspaceRole(access) === "designer") {
      query = query.eq("assignee_member_id", access.memberId ?? "");
    } else if (filters.scope === "mine" && access.memberId) {
      query = query.or(
        `assignee_member_id.eq.${access.memberId},requester_member_id.eq.${access.memberId}`
      );
    }
  }

  if (filters.brandId) query = query.eq("brand_id", filters.brandId);
  if (filters.status && creativeJobStatuses.includes(filters.status as never)) {
    query = query.eq("status", filters.status);
  }
  if (filters.priority) query = query.eq("priority", filters.priority);
  if (filters.designerId) {
    query = query.eq("assignee_profile_id", filters.designerId);
  }

  const today = getHongKongToday();
  if (!filters.status && !filters.view) {
    query = query.not("status", "in", "(completed,cancelled)");
  }
  if (filters.view === "waiting") {
    query = query.eq("material_status", "waiting");
  } else if (filters.view === "review") {
    query = query.in("status", ["review", "revision"]);
  } else if (filters.view === "overdue") {
    query = query
      .lt("due_date", today)
      .not("status", "in", "(completed,cancelled)");
  } else if (filters.view === "publish") {
    query = query.eq("sync_calendar", true).gte("publish_date", today);
  } else if (filters.view === "completed") {
    query = query.eq("status", "completed");
  }

  const { data, error } = await query;
  if (error) {
    console.warn("creative_job_list_failed", {
      code: error.code,
      message: error.message,
    });
  }

  const jobs = sortJobs(
    (data ?? [])
      .map((row) =>
        mapJob(row as unknown as RawRow, {
          brands: lookup.brandMap,
          taxonomies: lookup.taxonomyMap,
          designers: lookup.designerMap,
          members: lookup.members,
        })
      )
      .filter((job) => canViewCreativeJob(access, job))
  );
  const openJobs = jobs.filter(
    (job) => !["completed", "cancelled"].includes(job.status)
  );
  return {
    schemaReady: !error,
    access,
    jobs,
    brands: lookup.config.brands,
    taxonomies: lookup.taxonomies,
    designers: lookup.designers,
    currentMemberId: access.memberId ?? null,
    canCreate: isCreativeOperationsRole(access),
    canManageSettings: canManageCreativeTaxonomy(access),
    stats: {
      open: openJobs.length,
      waiting: openJobs.filter((job) => job.materialStatus === "waiting").length,
      review: openJobs.filter((job) =>
        ["review", "revision"].includes(job.status)
      ).length,
      overdue: openJobs.filter(
        (job) => Boolean(job.dueDate && job.dueDate < today)
      ).length,
    },
    today,
  };
}

export async function getCreativeJobAccessRecord(jobId: string) {
  const access = await getCurrentInternalAccess();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("creative_jobs")
    .select(jobColumns)
    .eq("id", jobId)
    .is("deleted_at", null)
    .maybeSingle();
  const rawData = data as unknown as RawRow | null;
  if (error || !rawData) return { access, job: null };
  const subject = {
    brandId: String(rawData.brand_id),
    assigneeMemberId:
      typeof rawData.assignee_member_id === "string"
        ? rawData.assignee_member_id
        : null,
  };
  return {
    access,
    job: canViewCreativeJob(access, subject) ? rawData : null,
  };
}

export async function getCreativeJobDetail(jobId: string) {
  const { access, job: rawJob } = await getCreativeJobAccessRecord(jobId);
  if (!rawJob) return null;
  const lookup = await loadCreativeLookups();
  if (!lookup.schemaReady) return null;
  const supabase = createSupabaseAdminClient();
  const [assetResult, commentResult, versionResult, notificationResult] =
    await Promise.all([
      supabase
        .from("creative_job_assets")
        .select(
          "id,job_id,asset_kind,purpose,label,external_url,storage_path,mime_type,file_size,created_by_email,created_at"
        )
        .eq("job_id", jobId)
        .is("removed_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("creative_job_comments")
        .select("id,author_member_id,author_email,body,created_at")
        .eq("job_id", jobId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("creative_job_brief_versions")
        .select("id,version_no,reason,created_by_email,created_at")
        .eq("job_id", jobId)
        .order("version_no", { ascending: false })
        .limit(30),
      access.memberId
        ? supabase
            .from("marketing_notifications")
            .select("id,title,body,is_read,created_at,action_url")
            .eq("recipient_member_id", access.memberId)
            .eq("creative_job_id", jobId)
            .order("created_at", { ascending: false })
            .limit(30)
        : Promise.resolve({ data: [], error: null }),
    ]);

  const job = mapJob(rawJob, {
    brands: lookup.brandMap,
    taxonomies: lookup.taxonomyMap,
    designers: lookup.designerMap,
    members: lookup.members,
  });
  const assets: CreativeAsset[] = (assetResult.data ?? []).map((row) => ({
    id: String(row.id),
    jobId: String(row.job_id),
    assetKind: row.asset_kind === "upload" ? "upload" : "link",
    purpose: String(row.purpose) as CreativeAsset["purpose"],
    label: String(row.label),
    externalUrl:
      typeof row.external_url === "string" ? row.external_url : null,
    storagePath:
      typeof row.storage_path === "string" ? row.storage_path : null,
    mimeType: typeof row.mime_type === "string" ? row.mime_type : null,
    fileSize: row.file_size === null ? null : Number(row.file_size),
    createdByEmail:
      typeof row.created_by_email === "string"
        ? row.created_by_email
        : null,
    createdAt: String(row.created_at),
    url:
      row.asset_kind === "upload"
        ? `/api/creative-jobs/${jobId}/assets/${row.id}`
        : String(row.external_url || ""),
  }));
  const comments: CreativeComment[] = (commentResult.data ?? []).map((row) => {
    const authorId =
      typeof row.author_member_id === "string" ? row.author_member_id : null;
    const member = authorId ? lookup.members.get(authorId) : null;
    return {
      id: String(row.id),
      authorMemberId: authorId,
      authorName: member ? asNullableString(member.full_name) : null,
      authorEmail:
        typeof row.author_email === "string" ? row.author_email : null,
      body: String(row.body),
      createdAt: String(row.created_at),
    };
  });
  const versions: CreativeBriefVersion[] = (versionResult.data ?? []).map(
    (row) => ({
      id: String(row.id),
      versionNo: Number(row.version_no),
      reason: String(row.reason) as CreativeBriefVersion["reason"],
      createdByEmail:
        typeof row.created_by_email === "string"
          ? row.created_by_email
          : null,
      createdAt: String(row.created_at),
    })
  );
  const notifications: CreativeNotification[] = (
    notificationResult.data ?? []
  ).map((row) => ({
    id: String(row.id),
    title: String(row.title),
    body: typeof row.body === "string" ? row.body : null,
    isRead: row.is_read === true,
    createdAt: String(row.created_at),
    actionUrl: typeof row.action_url === "string" ? row.action_url : null,
  }));

  return {
    access,
    job,
    assets,
    comments,
    versions,
    notifications,
    brands: lookup.config.brands,
    treatments: lookup.config.treatments,
    taxonomies: lookup.taxonomies,
    designers: lookup.designers,
    canEditMetadata: canEditCreativeJobMetadata(access, job),
    canEditBrief: canEditCreativeBrief(access, job),
    canUpdateStatus: canUpdateCreativeJobStatus(access, job),
    canContributeAssets: canContributeCreativeAssets(access, job),
    canManageSettings: canManageCreativeTaxonomy(access),
  };
}

export async function getCreativeSettingsSnapshot() {
  const access = await getCurrentInternalAccess();
  if (!canManageCreativeTaxonomy(access)) return null;
  const lookup = await loadCreativeLookups();
  if (!lookup.schemaReady) {
    return {
      access,
      schemaReady: false,
      taxonomies: [] as CreativeTaxonomyItem[],
      designers: [] as CreativeDesignerProfile[],
      members: [] as Array<{
        id: string;
        fullName: string | null;
        email: string;
        role: string;
        status: string;
      }>,
    };
  }
  const supabase = createSupabaseAdminClient();
  const { data: jobs } = await supabase
    .from("creative_jobs")
    .select(
      "source_taxonomy_id,usage_taxonomy_id,media_format_taxonomy_id"
    )
    .is("deleted_at", null);
  const usageCounts = new Map<string, number>();
  for (const row of jobs ?? []) {
    for (const value of [
      row.source_taxonomy_id,
      row.usage_taxonomy_id,
      row.media_format_taxonomy_id,
    ]) {
      if (typeof value === "string") {
        usageCounts.set(value, (usageCounts.get(value) ?? 0) + 1);
      }
    }
  }
  return {
    access,
    schemaReady: true,
    taxonomies: lookup.taxonomies.map((item) => ({
      ...item,
      usageCount: usageCounts.get(item.id) ?? 0,
    })),
    designers: lookup.designers,
    members: [...lookup.members.values()].map((member) => ({
      id: asString(member.id),
      fullName: asNullableString(member.full_name),
      email: asString(member.email),
      role: asString(member.workspace_role),
      status: asString(member.status),
    })),
  };
}

export async function writeCreativeAudit(input: {
  jobId?: string | null;
  access: InternalAccessContext;
  action: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}) {
  const supabase = createSupabaseAdminClient();
  await supabase.from("creative_job_audit").insert({
    job_id: input.jobId ?? null,
    actor_member_id: input.access.memberId ?? null,
    actor_email:
      input.access.email ||
      (input.access.accessLevel === "master" ? "master" : "shared_admin"),
    action: input.action,
    before_json: input.before ?? null,
    after_json: input.after ?? null,
  });
}

export async function queueCreativeNotification(input: {
  recipientMemberId: string | null | undefined;
  recipientEmail?: string | null;
  brandId: string;
  jobId: string;
  type: string;
  title: string;
  body?: string | null;
  dedupeKey?: string | null;
}) {
  if (!input.recipientMemberId) return;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("marketing_notifications").insert({
    recipient_member_id: input.recipientMemberId,
    recipient_email: input.recipientEmail ?? null,
    brand_id: input.brandId,
    creative_job_id: input.jobId,
    notification_type: input.type,
    title: input.title,
    body: input.body ?? null,
    action_url: `/creative-jobs/${input.jobId}`,
    dedupe_key: input.dedupeKey ?? null,
  });
  if (error && error.code !== "23505") {
    console.warn("creative_notification_queue_failed", {
      code: error.code,
      message: error.message,
    });
  }
}

export async function getUnreadCreativeNotificationCount() {
  const access = await getCurrentInternalAccess();
  if (!access.memberId) return 0;
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from("marketing_notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_member_id", access.memberId)
    .eq("is_read", false)
    .not("creative_job_id", "is", null);
  return error ? 0 : count ?? 0;
}

export function creativeCalendarItemType(usageName: string | null) {
  const normalized = String(usageName || "").toLowerCase();
  if (normalized.includes("ad")) return "ad";
  if (normalized.includes("website")) return "landing_page";
  return "post";
}

export function canCreateCreativeJobs(access: InternalAccessContext) {
  return isCreativeOperationsRole(access);
}

export function canUseCreativeBrand(
  access: InternalAccessContext,
  brandId: string
) {
  return canAccessCreativeBrand(access, brandId);
}
