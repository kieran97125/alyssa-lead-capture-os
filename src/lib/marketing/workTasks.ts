import "server-only";

import { getConfiguredBrands } from "@/lib/data/configuration";
import {
  canAccessInternalBrand,
  getCurrentInternalAccess,
} from "@/lib/security/internalAccessServer";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";
import { getHkMonthContext } from "@/lib/marketing/pacing";

export type WorkTaskStatus = "todo" | "in_progress" | "done";
export type WorkTaskPriority = "low" | "normal" | "high";

export type WorkTaskMember = {
  id: string;
  email: string;
  name: string;
  isMaster: boolean;
  brandIds: string[];
};

export type WorkTaskBrand = {
  id: string;
  name: string;
  color: string;
  secondaryColor: string;
};

export type WorkTaskCalendarLink = {
  id: string;
  calendarItemId: string;
  title: string;
  status: "idea" | "scheduled" | "published";
  scheduledDate: string;
  scheduledTime: string | null;
};

export type WorkTaskComment = {
  id: string;
  authorEmail: string | null;
  body: string;
  createdAt: string;
};

export type WorkTaskRow = {
  id: string;
  brandId: string;
  brandName: string;
  brandColor: string;
  title: string;
  description: string | null;
  status: WorkTaskStatus;
  priority: WorkTaskPriority;
  assigneeMemberId: string | null;
  assigneeEmail: string | null;
  assigneeName: string | null;
  createdByEmail: string | null;
  startDate: string;
  startTime: string | null;
  dueDate: string | null;
  dueTime: string | null;
  treatmentId: string | null;
  treatmentLabel: string | null;
  performanceMarker: boolean;
  completedAt: string | null;
  updatedAt: string;
  calendarLinks: WorkTaskCalendarLink[];
  comments: WorkTaskComment[];
};

export type WorkNotification = {
  id: string;
  brandId: string | null;
  taskId: string | null;
  calendarItemId: string | null;
  type: string;
  title: string;
  body: string | null;
  isRead: boolean;
  createdAt: string;
};

export type WorkTaskSnapshot = {
  weekStart: string;
  weekEnd: string;
  today: string;
  brands: WorkTaskBrand[];
  members: WorkTaskMember[];
  tasks: WorkTaskRow[];
  notifications: WorkNotification[];
  unreadNotificationCount: number;
  currentMemberId: string | null;
  currentEmail: string | null;
  canManage: boolean;
  live: boolean;
};

function dateAtUtc(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function shiftDate(value: string, days: number) {
  const date = dateAtUtc(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function mondayOf(value: string) {
  const date = dateAtUtc(value);
  const weekday = date.getUTCDay();
  const delta = weekday === 0 ? -6 : 1 - weekday;
  return shiftDate(value, delta);
}

function textValue(value: unknown, maxLength = 4000) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function statusValue(value: unknown): WorkTaskStatus {
  if (value === "in_progress" || value === "done") return value;
  return "todo";
}

function priorityValue(value: unknown): WorkTaskPriority {
  if (value === "low" || value === "high") return value;
  return "normal";
}

function fixtureSnapshot(input: {
  brands: WorkTaskBrand[];
  weekStart: string;
  today: string;
  currentMemberId: string | null;
  currentEmail: string | null;
}): WorkTaskSnapshot {
  const brand = input.brands[0];
  const member: WorkTaskMember = {
    id: input.currentMemberId || "90000000-0000-4000-8000-000000000001",
    email: input.currentEmail || "owner@example.test",
    name: "Marketing Owner",
    isMaster: true,
    brandIds: input.brands.map((item) => item.id),
  };
  const tasks: WorkTaskRow[] = brand
    ? [
        {
          id: "91000000-0000-4000-8000-000000000001",
          brandId: brand.id,
          brandName: brand.name,
          brandColor: brand.color,
          title: "本週 Campaign 素材 Final QA",
          description: "完成發布前 QA，並同營銷日曆項目保持同步。",
          status: "in_progress",
          priority: "high",
          assigneeMemberId: member.id,
          assigneeEmail: member.email,
          assigneeName: member.name,
          createdByEmail: member.email,
          startDate: shiftDate(input.weekStart, 1),
          startTime: "09:30",
          dueDate: shiftDate(input.weekStart, 3),
          dueTime: null,
          treatmentId: null,
          treatmentLabel: null,
          performanceMarker: true,
          completedAt: null,
          updatedAt: new Date().toISOString(),
          calendarLinks: [],
          comments: [],
        },
      ]
    : [];
  return {
    weekStart: input.weekStart,
    weekEnd: shiftDate(input.weekStart, 6),
    today: input.today,
    brands: input.brands,
    members: [member],
    tasks,
    notifications: [],
    unreadNotificationCount: 0,
    currentMemberId: input.currentMemberId,
    currentEmail: input.currentEmail,
    canManage: true,
    live: false,
  };
}

export async function getWorkTaskSnapshot(input?: {
  week?: string | null;
  scope?: "mine" | "all";
  brandId?: string | null;
}): Promise<WorkTaskSnapshot> {
  const access = await getCurrentInternalAccess();
  const allBrands = await getConfiguredBrands();
  const permitted = allBrands.filter((brand) =>
    canAccessInternalBrand(access, brand.id)
  );
  const brands: WorkTaskBrand[] = permitted.map((brand) => ({
    id: brand.id,
    name: brand.name,
    color: brand.primaryColor || "#5A2348",
    secondaryColor: brand.secondaryColor || "#F8E8E2",
  }));
  const current = getHkMonthContext();
  const requestedWeek = input?.week?.trim() || "";
  const weekStart = /^\d{4}-\d{2}-\d{2}$/.test(requestedWeek)
    ? mondayOf(requestedWeek)
    : mondayOf(current.today);
  const weekEnd = shiftDate(weekStart, 6);
  const currentMemberId = access.memberId || null;
  const currentEmail = access.email || null;
  const canManage =
    access.accessLevel === "master" ||
    ["owner", "admin", "manager", "marketer", "cs", "designer"].includes(
      access.workspaceRole || ""
    );

  if (!hasSupabaseAdminEnv()) {
    return fixtureSnapshot({
      brands,
      weekStart,
      today: current.today,
      currentMemberId,
      currentEmail,
    });
  }

  const supabase = createSupabaseAdminClient();
  const brandIds = brands.map((brand) => brand.id);
  if (brandIds.length === 0) {
    return {
      weekStart,
      weekEnd,
      today: current.today,
      brands,
      members: [],
      tasks: [],
      notifications: [],
      unreadNotificationCount: 0,
      currentMemberId,
      currentEmail,
      canManage,
      live: true,
    };
  }

  const [membersResult, accessResult, tasksResult, calendarResult] =
    await Promise.all([
      supabase
        .from("workspace_members")
        .select("id,email,full_name,is_master,status")
        .in("status", ["active", "invited"]),
      supabase
        .from("workspace_member_brand_access")
        .select("member_id,brand_id,status")
        .eq("status", "active")
        .in("brand_id", brandIds),
      supabase
        .from("marketing_work_tasks")
        .select(
          "id,brand_id,treatment_id,treatment_label,title,description,status,priority,assignee_member_id,assignee_email,created_by_email,start_date,start_time,due_date,due_time,performance_marker,completed_at,updated_at"
        )
        .in("brand_id", brandIds)
        .gte("start_date", weekStart)
        .lte("start_date", weekEnd)
        .order("start_date", { ascending: true })
        .order("start_time", { ascending: true, nullsFirst: true })
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("marketing_calendar_items")
        .select("id,brand_id,title,status,scheduled_date,scheduled_time")
        .in("brand_id", brandIds)
        .gte("scheduled_date", shiftDate(weekStart, -30))
        .lte("scheduled_date", shiftDate(weekEnd, 90))
        .order("scheduled_date", { ascending: true }),
    ]);

  for (const result of [membersResult, accessResult, tasksResult, calendarResult]) {
    if (result.error) throw result.error;
  }

  const memberBrandIds = new Map<string, string[]>();
  for (const row of accessResult.data ?? []) {
    const memberId = String(row.member_id ?? "");
    const brandId = String(row.brand_id ?? "");
    if (!memberId || !brandId) continue;
    memberBrandIds.set(memberId, [
      ...(memberBrandIds.get(memberId) ?? []),
      brandId,
    ]);
  }
  const members: WorkTaskMember[] = (membersResult.data ?? []).map((row) => {
    const id = String(row.id ?? "");
    const isMaster = Boolean(row.is_master);
    return {
      id,
      email: String(row.email ?? ""),
      name: textValue(row.full_name, 120) || String(row.email ?? ""),
      isMaster,
      brandIds: isMaster ? [...brandIds] : memberBrandIds.get(id) ?? [],
    };
  });
  const memberById = new Map(members.map((member) => [member.id, member]));

  const rawTasks = (tasksResult.data ?? []) as Array<Record<string, unknown>>;
  const taskIds = rawTasks.map((row) => String(row.id ?? "")).filter(Boolean);
  const [linksResult, commentsResult] = taskIds.length
    ? await Promise.all([
        supabase
          .from("marketing_task_calendar_links")
          .select("id,task_id,calendar_item_id")
          .in("task_id", taskIds),
        supabase
          .from("marketing_task_comments")
          .select("id,task_id,author_email,body,created_at")
          .in("task_id", taskIds)
          .order("created_at", { ascending: true }),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];
  if (linksResult.error) throw linksResult.error;
  if (commentsResult.error) throw commentsResult.error;

  const calendarById = new Map(
    (calendarResult.data ?? []).map((row) => [String(row.id ?? ""), row])
  );
  const linksByTask = new Map<string, WorkTaskCalendarLink[]>();
  for (const row of linksResult.data ?? []) {
    const taskId = String(row.task_id ?? "");
    const calendarItem = calendarById.get(String(row.calendar_item_id ?? ""));
    if (!taskId || !calendarItem) continue;
    const status = String(calendarItem.status ?? "idea");
    linksByTask.set(taskId, [
      ...(linksByTask.get(taskId) ?? []),
      {
        id: String(row.id ?? ""),
        calendarItemId: String(calendarItem.id ?? ""),
        title: String(calendarItem.title ?? "未命名日曆事項"),
        status:
          status === "published"
            ? "published"
            : status === "scheduled"
              ? "scheduled"
              : "idea",
        scheduledDate: String(calendarItem.scheduled_date ?? ""),
        scheduledTime: textValue(calendarItem.scheduled_time, 16),
      },
    ]);
  }
  const commentsByTask = new Map<string, WorkTaskComment[]>();
  for (const row of commentsResult.data ?? []) {
    const taskId = String(row.task_id ?? "");
    if (!taskId) continue;
    commentsByTask.set(taskId, [
      ...(commentsByTask.get(taskId) ?? []),
      {
        id: String(row.id ?? ""),
        authorEmail: textValue(row.author_email, 180),
        body: String(row.body ?? ""),
        createdAt: String(row.created_at ?? ""),
      },
    ]);
  }
  const brandById = new Map(brands.map((brand) => [brand.id, brand]));
  let tasks: WorkTaskRow[] = rawTasks.flatMap((row) => {
    const brandId = String(row.brand_id ?? "");
    const brand = brandById.get(brandId);
    if (!brand) return [];
    const assigneeMemberId = textValue(row.assignee_member_id, 80);
    const assignee = assigneeMemberId
      ? memberById.get(assigneeMemberId) ?? null
      : null;
    return [
      {
        id: String(row.id ?? ""),
        brandId,
        brandName: brand.name,
        brandColor: brand.color,
        title: String(row.title ?? "未命名工作"),
        description: textValue(row.description),
        status: statusValue(row.status),
        priority: priorityValue(row.priority),
        assigneeMemberId,
        assigneeEmail: textValue(row.assignee_email, 180),
        assigneeName: assignee?.name ?? null,
        createdByEmail: textValue(row.created_by_email, 180),
        startDate: textValue(row.start_date, 10) || weekStart,
        startTime: textValue(row.start_time, 16),
        dueDate: textValue(row.due_date, 10),
        dueTime: textValue(row.due_time, 16),
        treatmentId: textValue(row.treatment_id, 80),
        treatmentLabel: textValue(row.treatment_label, 180),
        performanceMarker: Boolean(row.performance_marker),
        completedAt: textValue(row.completed_at, 40),
        updatedAt: String(row.updated_at ?? ""),
        calendarLinks: linksByTask.get(String(row.id ?? "")) ?? [],
        comments: commentsByTask.get(String(row.id ?? "")) ?? [],
      },
    ];
  });

  const requestedBrandId = input?.brandId?.trim() || "";
  if (requestedBrandId && brandById.has(requestedBrandId)) {
    tasks = tasks.filter((task) => task.brandId === requestedBrandId);
  }
  if (input?.scope === "mine" && currentMemberId) {
    tasks = tasks.filter((task) => task.assigneeMemberId === currentMemberId);
  }
  tasks = tasks.filter(
    (task) => task.startDate >= weekStart && task.startDate <= weekEnd
  );

  let notifications: WorkNotification[] = [];
  let unreadNotificationCount = 0;
  if (currentMemberId) {
    const { data, error, count } = await supabase
      .from("marketing_notifications")
      .select(
        "id,brand_id,task_id,calendar_item_id,notification_type,title,body,is_read,created_at",
        { count: "exact" }
      )
      .eq("recipient_member_id", currentMemberId)
      .in("brand_id", brandIds)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    notifications = (data ?? []).map((row) => ({
      id: String(row.id ?? ""),
      brandId: textValue(row.brand_id, 80),
      taskId: textValue(row.task_id, 80),
      calendarItemId: textValue(row.calendar_item_id, 80),
      type: String(row.notification_type ?? "update"),
      title: String(row.title ?? "工作更新"),
      body: textValue(row.body, 500),
      isRead: Boolean(row.is_read),
      createdAt: String(row.created_at ?? ""),
    }));
    void count;
    const unreadResult = await supabase
      .from("marketing_notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_member_id", currentMemberId)
      .eq("is_read", false)
      .in("brand_id", brandIds);
    if (!unreadResult.error) unreadNotificationCount = unreadResult.count ?? 0;
  }

  return {
    weekStart,
    weekEnd,
    today: current.today,
    brands,
    members,
    tasks,
    notifications,
    unreadNotificationCount,
    currentMemberId,
    currentEmail,
    canManage,
    live: true,
  };
}

export async function getUnreadWorkNotificationCount() {
  if (!hasSupabaseAdminEnv()) return 0;
  const access = await getCurrentInternalAccess();
  if (!access.memberId) return 0;
  const brands = (await getConfiguredBrands()).filter((brand) =>
    canAccessInternalBrand(access, brand.id)
  );
  if (brands.length === 0) return 0;
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from("marketing_notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_member_id", access.memberId)
    .eq("is_read", false)
    .in(
      "brand_id",
      brands.map((brand) => brand.id)
    );
  if (error) return 0;
  return count ?? 0;
}
