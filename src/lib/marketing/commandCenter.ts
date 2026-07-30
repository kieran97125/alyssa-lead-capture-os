import "server-only";

import { getConfigurationData, type BrandSetting } from "@/lib/data/configuration";
import { alyssaBrand } from "@/lib/data/alyssaConfig";
import {
  getLeadRows,
  isBooking,
  type LeadRow,
} from "@/lib/data/businessMetrics";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";
import {
  budgetPaceStatus,
  delta,
  expectedAtPace,
  forecastAtMonthEnd,
  getHkMonthContext,
  kpiPaceStatus,
  percentage,
  type HkMonthContext,
  type PaceStatus,
} from "@/lib/marketing/pacing";
import { MASTER_ACCOUNT_EMAIL } from "@/lib/marketing/constants";

export { MASTER_ACCOUNT_EMAIL };

export type MonthlyPlan = {
  id: string | null;
  brandId: string;
  monthStart: string;
  budget: number;
  currency: string;
  leadTarget: number;
  bookingTarget: number;
  showTarget: number;
  contentTarget: number;
  notes: string | null;
};

export type DataSourceStatus =
  | "draft"
  | "connected"
  | "syncing"
  | "warning"
  | "error"
  | "paused";

export type MarketingDataSource = {
  id: string;
  brandId: string | null;
  providerKey: string;
  displayName: string;
  status: DataSourceStatus;
  syncMode: string;
  configuration: Record<string, unknown>;
  providesMetrics: string[];
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  lastErrorSummary: string | null;
};

export type CalendarItem = {
  id: string;
  brandId: string;
  title: string;
  itemType: "post" | "ad" | "landing_page" | "email" | "meeting" | "task";
  channel: string | null;
  status:
    | "idea"
    | "planned"
    | "in_progress"
    | "review"
    | "scheduled"
    | "published"
    | "blocked"
    | "cancelled";
  scheduledDate: string;
  scheduledTime: string | null;
  assigneeEmail: string | null;
  notes: string | null;
  sortOrder: number;
};

export type WorkspaceMember = {
  id: string;
  authUserId: string | null;
  email: string;
  fullName: string | null;
  role: string;
  status: string;
  isMaster: boolean;
  inviteSentAt: string | null;
  inviteAcceptedAt: string | null;
  lastSignInAt: string | null;
  brandIds: string[];
  modulePermissions: Record<string, boolean>;
};

export type MetricProgress = {
  actual: number;
  target: number;
  expected: number;
  delta: number;
  progress: number;
  status: PaceStatus;
};

export type BrandCommandCenterRow = {
  id: string;
  name: string;
  slug: string;
  color: string;
  secondaryColor: string;
  monthlyPlan: MonthlyPlan;
  spend: number;
  expectedSpend: number;
  spendDelta: number;
  spendProgress: number;
  spendForecast: number;
  budgetStatus: PaceStatus;
  leads: MetricProgress;
  bookings: MetricProgress;
  shows: MetricProgress;
  content: MetricProgress;
  connectedSourceCount: number;
  sourceIssueCount: number;
};

export type CommandCenterSnapshot = {
  month: HkMonthContext;
  brands: BrandCommandCenterRow[];
  dataSources: MarketingDataSource[];
  calendarItems: CalendarItem[];
  members: WorkspaceMember[];
  schemaReady: boolean;
  dataWarnings: string[];
  total: {
    budget: number;
    spend: number;
    leads: number;
    bookings: number;
    shows: number;
    leadTarget: number;
    bookingTarget: number;
    showTarget: number;
  };
};

type DailyMetric = {
  brandId: string;
  metricDate: string;
  sourceKey: string;
  spend: number;
  leads: number;
  bookings: number;
  shows: number;
};

function numberValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function recordValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function defaultContentTarget(brand: BrandSetting) {
  const slug = brand.slug.toLowerCase();
  if (slug === "alyssa") return 9;
  if (slug === "ineffable" || slug === "ineffable-beauty") return 4;
  return 0;
}

function emptyPlan(brand: BrandSetting, monthStart: string): MonthlyPlan {
  return {
    id: null,
    brandId: brand.id,
    monthStart,
    budget: 0,
    currency: "HKD",
    leadTarget: 0,
    bookingTarget: 0,
    showTarget: 0,
    contentTarget: defaultContentTarget(brand),
    notes: null,
  };
}

function isBeforeHkToday(value: string, today: string) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  const [year, month, day] = today.split("-").map(Number);
  const todayStartUtc = Date.UTC(year, month - 1, day) - 8 * 60 * 60 * 1000;
  return timestamp < todayStartUtc;
}

function isShow(lead: LeadRow) {
  return (
    lead.booking?.booking_status === "show" ||
    lead.booking_status === "show" ||
    lead.lead_status === "show"
  );
}

function progressMetric(
  actual: number,
  target: number,
  paceRatio: number
): MetricProgress {
  const expected = expectedAtPace(target, paceRatio);
  return {
    actual,
    target,
    expected,
    delta: delta(actual, expected),
    progress: percentage(actual, target),
    status: kpiPaceStatus(actual, target, expected),
  };
}

async function getPlanningRecords(month: HkMonthContext) {
  if (!hasSupabaseAdminEnv()) {
    const fixtureCalendarItems: CalendarItem[] =
      process.env.ALYSSA_E2E_FIXTURES === "1"
        ? [
            {
              id: "10000000-0000-4000-8000-000000000001",
              brandId: alyssaBrand.id,
              title: "DEP Reels 上線",
              itemType: "post",
              channel: "IG",
              status: "planned",
              scheduledDate: month.today,
              scheduledTime: null,
              assigneeEmail: null,
              notes: null,
              sortOrder: 0,
            },
          ]
        : [];

    return {
      plans: [] as MonthlyPlan[],
      metrics: [] as DailyMetric[],
      dataSources: [] as MarketingDataSource[],
      calendarItems: fixtureCalendarItems,
      members: [] as WorkspaceMember[],
      schemaReady: false,
      warnings: ["Command Center 資料表尚未連接；目前顯示現有 LaunchHub 數據。"],
    };
  }

  const supabase = createSupabaseAdminClient();
  const [plansResult, metricsResult, sourcesResult, calendarResult, membersResult] =
    await Promise.all([
      supabase
        .from("marketing_monthly_plans")
        .select("*")
        .eq("month_start", month.monthStart),
      supabase
        .from("marketing_daily_metrics")
        .select(
          "brand_id,metric_date,source_key,spend,leads,bookings,shows"
        )
        .gte("metric_date", month.monthStart)
        .lte("metric_date", month.throughDate),
      supabase
        .from("marketing_data_sources")
        .select(
          "id,brand_id,provider_key,display_name,status,sync_mode,configuration,provides_metrics,last_sync_at,last_success_at,last_error_summary"
        )
        .order("display_name", { ascending: true }),
      supabase
        .from("marketing_calendar_items")
        .select(
          "id,brand_id,title,item_type,channel,status,scheduled_date,scheduled_time,assignee_email,notes,sort_order"
        )
        .gte("scheduled_date", month.monthStart)
        .lte("scheduled_date", month.monthEnd)
        .order("scheduled_date", { ascending: true })
        .order("sort_order", { ascending: true }),
      supabase
        .from("workspace_members")
        .select(
          "id,auth_user_id,email,full_name,workspace_role,status,is_master,invite_sent_at,invite_accepted_at,last_sign_in_at"
        )
        .neq("status", "removed")
        .order("is_master", { ascending: false })
        .order("email", { ascending: true }),
    ]);

  const coreResults = [
    plansResult,
    metricsResult,
    sourcesResult,
    calendarResult,
    membersResult,
  ];
  const firstError = coreResults.find((result) => result.error)?.error;
  if (firstError) {
    console.warn("marketing_command_center_schema_read_failed", {
      code: firstError.code,
      message: firstError.message,
    });
    return {
      plans: [] as MonthlyPlan[],
      metrics: [] as DailyMetric[],
      dataSources: [] as MarketingDataSource[],
      calendarItems: [] as CalendarItem[],
      members: [] as WorkspaceMember[],
      schemaReady: false,
      warnings: ["Command Center migration 尚未套用，設定功能暫時只供預覽。"],
    };
  }

  const memberRows = (membersResult.data ?? []) as Array<Record<string, unknown>>;
  const memberIds = memberRows.map((row) => String(row.id ?? "")).filter(Boolean);
  const [brandAccessResult, permissionsResult] =
    memberIds.length > 0
      ? await Promise.all([
          supabase
            .from("workspace_member_brand_access")
            .select("member_id,brand_id,status")
            .in("member_id", memberIds)
            .eq("status", "active"),
          supabase
            .from("workspace_member_module_permissions")
            .select("member_id,module_key,can_access")
            .in("member_id", memberIds),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
        ];

  const brandAccess = new Map<string, string[]>();
  for (const row of (brandAccessResult.data ?? []) as Array<
    Record<string, unknown>
  >) {
    const memberId = String(row.member_id ?? "");
    const brandId = String(row.brand_id ?? "");
    if (!memberId || !brandId) continue;
    brandAccess.set(memberId, [...(brandAccess.get(memberId) ?? []), brandId]);
  }

  const permissions = new Map<string, Record<string, boolean>>();
  for (const row of (permissionsResult.data ?? []) as Array<
    Record<string, unknown>
  >) {
    const memberId = String(row.member_id ?? "");
    const moduleKey = String(row.module_key ?? "");
    if (!memberId || !moduleKey) continue;
    permissions.set(memberId, {
      ...(permissions.get(memberId) ?? {}),
      [moduleKey]: row.can_access !== false,
    });
  }

  return {
    plans: ((plansResult.data ?? []) as Array<Record<string, unknown>>).map(
      (row) => ({
        id: String(row.id ?? ""),
        brandId: String(row.brand_id ?? ""),
        monthStart: String(row.month_start ?? month.monthStart),
        budget: numberValue(row.budget),
        currency: String(row.currency ?? "HKD"),
        leadTarget: numberValue(row.lead_target),
        bookingTarget: numberValue(row.booking_target),
        showTarget: numberValue(row.show_target),
        contentTarget: numberValue(row.content_target),
        notes: textValue(row.notes),
      })
    ),
    metrics: ((metricsResult.data ?? []) as Array<Record<string, unknown>>).map(
      (row) => ({
        brandId: String(row.brand_id ?? ""),
        metricDate: String(row.metric_date ?? ""),
        sourceKey: String(row.source_key ?? ""),
        spend: numberValue(row.spend),
        leads: numberValue(row.leads),
        bookings: numberValue(row.bookings),
        shows: numberValue(row.shows),
      })
    ),
    dataSources: ((sourcesResult.data ?? []) as Array<
      Record<string, unknown>
    >).map((row) => ({
      id: String(row.id ?? ""),
      brandId: textValue(row.brand_id),
      providerKey: String(row.provider_key ?? ""),
      displayName: String(row.display_name ?? "未命名資料來源"),
      status: String(row.status ?? "draft") as DataSourceStatus,
      syncMode: String(row.sync_mode ?? "manual"),
      configuration: recordValue(row.configuration),
      providesMetrics: stringArray(row.provides_metrics),
      lastSyncAt: textValue(row.last_sync_at),
      lastSuccessAt: textValue(row.last_success_at),
      lastErrorSummary: textValue(row.last_error_summary),
    })),
    calendarItems: ((calendarResult.data ?? []) as Array<
      Record<string, unknown>
    >).map((row) => ({
      id: String(row.id ?? ""),
      brandId: String(row.brand_id ?? ""),
      title: String(row.title ?? "未命名事項"),
      itemType: String(row.item_type ?? "task") as CalendarItem["itemType"],
      channel: textValue(row.channel),
      status: String(row.status ?? "planned") as CalendarItem["status"],
      scheduledDate: String(row.scheduled_date ?? month.monthStart),
      scheduledTime: textValue(row.scheduled_time),
      assigneeEmail: textValue(row.assignee_email),
      notes: textValue(row.notes),
      sortOrder: numberValue(row.sort_order),
    })),
    members: memberRows.map((row) => {
      const id = String(row.id ?? "");
      return {
        id,
        authUserId: textValue(row.auth_user_id),
        email: String(row.email ?? ""),
        fullName: textValue(row.full_name),
        role: String(row.workspace_role ?? "viewer"),
        status: String(row.status ?? "invited"),
        isMaster: row.is_master === true,
        inviteSentAt: textValue(row.invite_sent_at),
        inviteAcceptedAt: textValue(row.invite_accepted_at),
        lastSignInAt: textValue(row.last_sign_in_at),
        brandIds: brandAccess.get(id) ?? [],
        modulePermissions: permissions.get(id) ?? {},
      };
    }),
    schemaReady: true,
    warnings: [
      brandAccessResult.error || permissionsResult.error
        ? "成員細項權限暫時未能完整讀取。"
        : "",
    ].filter(Boolean),
  };
}

export async function getCommandCenterSnapshot(): Promise<CommandCenterSnapshot> {
  const month = getHkMonthContext();
  const [config, planning] = await Promise.all([
    getConfigurationData(),
    getPlanningRecords(month),
  ]);
  const visibleBrandIds = new Set(config.brands.map((brand) => brand.id));
  const scopedPlanning = {
    ...planning,
    plans: planning.plans.filter((item) => visibleBrandIds.has(item.brandId)),
    metrics: planning.metrics.filter((item) =>
      visibleBrandIds.has(item.brandId)
    ),
    dataSources: planning.dataSources.filter(
      (item) => item.brandId === null || visibleBrandIds.has(item.brandId)
    ),
    calendarItems: planning.calendarItems.filter((item) =>
      visibleBrandIds.has(item.brandId)
    ),
  };
  const hasImportedFunnelMetrics = scopedPlanning.metrics.some((metric) =>
    metric.sourceKey.endsWith(":lead_funnel")
  );
  const leadResult = hasImportedFunnelMetrics
    ? { leads: [] as LeadRow[], error: null as string | null }
    : await getLeadRows("month", 10000, { includeTestData: false });

  const leads = leadResult.leads.filter((lead) =>
    isBeforeHkToday(lead.created_at, month.today)
  );
  const planByBrand = new Map(
    scopedPlanning.plans.map((plan) => [plan.brandId, plan])
  );
  const spendByBrand = new Map<string, number>();
  const funnelByBrand = new Map<
    string,
    { leads: number; bookings: number; shows: number }
  >();
  for (const row of scopedPlanning.metrics) {
    spendByBrand.set(
      row.brandId,
      (spendByBrand.get(row.brandId) ?? 0) + row.spend
    );
    if (!row.sourceKey.endsWith(":lead_funnel")) continue;
    const funnel = funnelByBrand.get(row.brandId) ?? {
      leads: 0,
      bookings: 0,
      shows: 0,
    };
    funnel.leads += row.leads;
    funnel.bookings += row.bookings;
    funnel.shows += row.shows;
    funnelByBrand.set(row.brandId, funnel);
  }

  const rows = config.brands.map((brand) => {
    const brandLeads = leads.filter((lead) => lead.brand_id === brand.id);
    const plan =
      planByBrand.get(brand.id) ?? emptyPlan(brand, month.monthStart);
    const spend = spendByBrand.get(brand.id) ?? 0;
    const expectedSpend = expectedAtPace(plan.budget, month.paceRatio);
    const importedFunnel = funnelByBrand.get(brand.id);
    const leadActual = hasImportedFunnelMetrics
      ? importedFunnel?.leads ?? 0
      : brandLeads.length;
    const bookingActual = hasImportedFunnelMetrics
      ? importedFunnel?.bookings ?? 0
      : brandLeads.filter(isBooking).length;
    const showActual = hasImportedFunnelMetrics
      ? importedFunnel?.shows ?? 0
      : brandLeads.filter(isShow).length;
    const contentActual = scopedPlanning.calendarItems.filter(
      (item) =>
        item.brandId === brand.id &&
        item.itemType === "post" &&
        item.status === "published"
    ).length;
    const sources = scopedPlanning.dataSources.filter(
      (source) => source.brandId === brand.id || source.brandId === null
    );

    return {
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      color: brand.primaryColor || "#5a2348",
      secondaryColor: brand.secondaryColor || "#f8e8e2",
      monthlyPlan: plan,
      spend,
      expectedSpend,
      spendDelta: delta(spend, expectedSpend),
      spendProgress: percentage(spend, plan.budget),
      spendForecast: forecastAtMonthEnd(
        spend,
        month.elapsedDays,
        month.daysInMonth
      ),
      budgetStatus: budgetPaceStatus(
        spend,
        plan.budget,
        expectedSpend,
        month.elapsedDays
      ),
      leads: progressMetric(leadActual, plan.leadTarget, month.paceRatio),
      bookings: progressMetric(
        bookingActual,
        plan.bookingTarget,
        month.paceRatio
      ),
      shows: progressMetric(showActual, plan.showTarget, month.paceRatio),
      content: progressMetric(
        contentActual,
        plan.contentTarget,
        month.paceRatio
      ),
      connectedSourceCount: sources.filter(
        (source) => source.status === "connected"
      ).length,
      sourceIssueCount: sources.filter((source) =>
        ["warning", "error"].includes(source.status)
      ).length,
    } satisfies BrandCommandCenterRow;
  });

  return {
    month,
    brands: rows,
    dataSources: scopedPlanning.dataSources,
    calendarItems: scopedPlanning.calendarItems,
    members:
      planning.members.length > 0
        ? planning.members
        : [
            {
              id: "bootstrap-master",
              authUserId: null,
              email: MASTER_ACCOUNT_EMAIL,
              fullName: "Kieran Kwok",
              role: "owner",
              status: "active",
              isMaster: true,
              inviteSentAt: null,
              inviteAcceptedAt: null,
              lastSignInAt: null,
              brandIds: config.brands.map((brand) => brand.id),
              modulePermissions: {},
            },
          ],
    schemaReady: planning.schemaReady,
    dataWarnings: [
      ...planning.warnings,
      ...(!hasImportedFunnelMetrics
        ? ["Google Sheet Lead Funnel 尚未成功同步；暫用 LaunchHub 現有數據。"]
        : []),
      ...(leadResult.error ? ["Lead／Booking 數據暫時未能完整讀取。"] : []),
    ],
    total: rows.reduce(
      (total, row) => ({
        budget: total.budget + row.monthlyPlan.budget,
        spend: total.spend + row.spend,
        leads: total.leads + row.leads.actual,
        bookings: total.bookings + row.bookings.actual,
        shows: total.shows + row.shows.actual,
        leadTarget: total.leadTarget + row.leads.target,
        bookingTarget: total.bookingTarget + row.bookings.target,
        showTarget: total.showTarget + row.shows.target,
      }),
      {
        budget: 0,
        spend: 0,
        leads: 0,
        bookings: 0,
        shows: 0,
        leadTarget: 0,
        bookingTarget: 0,
        showTarget: 0,
      }
    ),
  };
}
