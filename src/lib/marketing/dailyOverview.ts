import "server-only";

import { getConfigurationData, type BrandSetting } from "@/lib/data/configuration";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";
import {
  addDailyBaseMetrics,
  deriveDailyMetrics,
  emptyDailyBaseMetrics,
  targetAttainment,
  targetPaceAtDay,
  type DailyBaseMetrics,
  type DailyDerivedMetrics,
  type DailyTargetPace,
} from "@/lib/marketing/dailyOverviewMath";
import { getHkMonthContext } from "@/lib/marketing/pacing";
import {
  ALL_SPEND_TYPES,
  SPEND_TYPE_OPTIONS,
  emptySpendTypeAmounts,
  isSpendType,
  normalizeEditableSpendType,
  type EditableSpendType,
  type SpendType,
  type SpendTypeOption,
} from "@/lib/marketing/spendTypes";
import { getCurrentInternalAccess } from "@/lib/security/internalAccessServer";

export type DailySpendEntry = {
  id: string;
  brandId: string;
  spendDate: string;
  spendType: SpendType;
  amount: number;
  entryMethod: "manual" | "legacy_import" | "provider_rollup";
  note: string | null;
  revision: number;
  updatedBy: string | null;
  updatedAt: string;
};

export type DailyOverviewCell = {
  date: string;
  day: number;
  weekday: string;
  daily: DailyDerivedMetrics;
  cumulative: DailyDerivedMetrics;
  spendByType: {
    daily: Record<SpendType, number>;
    cumulative: Record<SpendType, number>;
  };
  targetPace: DailyTargetPace;
  leadTargetAttainment: number | null;
  bookingTargetAttainment: number | null;
  showTargetAttainment: number | null;
};

export type DailyOverviewBrandRow = {
  id: string;
  name: string;
  slug: string;
  color: string;
  secondaryColor: string;
  leadTarget: number;
  bookingTarget: number;
  showTarget: number;
  cells: DailyOverviewCell[];
  total: DailyDerivedMetrics;
  spendCoverageDays: number;
  expectedSpendDays: number;
  funnelSourceStatus: string | null;
  latestFunnelSyncAt: string | null;
  warnings: string[];
};

export type DailyOverviewSnapshot = {
  monthStart: string;
  monthEnd: string;
  monthLabel: string;
  throughDate: string;
  selectedEntryDate: string;
  selectedSpendType: EditableSpendType;
  maxEntryDate: string;
  dates: string[];
  monthOptions: Array<{ value: string; label: string }>;
  brands: DailyOverviewBrandRow[];
  allBrands: DailyOverviewBrandRow;
  selectedEntries: Record<string, DailySpendEntry | null>;
  spendTypeOptions: SpendTypeOption[];
  hasLegacySpend: boolean;
  canEditSpend: boolean;
  schemaReady: boolean;
  latestSpendUpdateAt: string | null;
  warnings: string[];
};

export type DailyOverviewQuery = {
  month?: string | string[];
  entry_date?: string | string[];
  spend_type?: string | string[];
};

type SourceRow = {
  id: string;
  brandId: string | null;
  status: string;
  dataset: string;
  lastSuccessAt: string | null;
};

type FunnelMetricRow = {
  brandId: string;
  metricDate: string;
  dataSourceId: string | null;
  sourceKey: string;
  leads: number;
  bookings: number;
  shows: number;
};

type MonthlyPlanRow = {
  brandId: string;
  leadTarget: number;
  bookingTarget: number;
  showTarget: number;
};

const weekdayFormatter = new Intl.DateTimeFormat("zh-HK", {
  weekday: "short",
  timeZone: "UTC",
});

const monthFormatter = new Intl.DateTimeFormat("zh-HK", {
  year: "numeric",
  month: "long",
  timeZone: "UTC",
});

const PAGE_SIZE = 800;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function recordValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function dateAtUtc(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function shiftMonth(monthStart: string, amount: number) {
  const date = dateAtUtc(monthStart);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 8) + "01";
}

function monthEnd(monthStart: string) {
  const date = dateAtUtc(monthStart);
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(0);
  return date.toISOString().slice(0, 10);
}

function previousDate(value: string) {
  const date = dateAtUtc(value);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function isMonthStart(value: string) {
  return /^\d{4}-\d{2}-01$/.test(value);
}

function normalizeMonth(value: string, currentMonth: string) {
  const normalized = /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : value;
  if (!isMonthStart(normalized) || normalized > currentMonth) return currentMonth;
  return normalized;
}

function listDates(startDate: string, endDate: string) {
  const dates: string[] = [];
  const cursor = dateAtUtc(startDate);
  const end = dateAtUtc(endDate);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function sourcePriority(source: SourceRow, brandId: string) {
  const statusScore =
    source.status === "connected"
      ? 4
      : source.status === "syncing"
        ? 3
        : source.status === "warning"
          ? 2
          : source.status === "draft"
            ? 1
            : 0;
  const scopeScore = source.brandId === brandId ? 2 : source.brandId ? 0 : 1;
  const successScore = source.lastSuccessAt
    ? new Date(source.lastSuccessAt).getTime() / 1_000_000_000_000
    : 0;
  return statusScore * 100 + scopeScore * 10 + successScore;
}

function chooseFunnelSource(sources: SourceRow[], brandId: string) {
  return (
    sources
      .filter(
        (source) =>
          source.dataset === "lead_funnel" &&
          (source.brandId === null || source.brandId === brandId)
      )
      .sort(
        (left, right) =>
          sourcePriority(right, brandId) - sourcePriority(left, brandId)
      )[0] ?? null
  );
}

function canEditSpendForRole(input: {
  accessLevel: string;
  workspaceRole?: string;
}) {
  return (
    input.accessLevel === "master" ||
    ["admin", "manager", "marketer"].includes(input.workspaceRole || "")
  );
}

function latest(values: Array<string | null | undefined>) {
  return (
    values
      .filter((value): value is string => Boolean(value))
      .sort((left, right) => right.localeCompare(left))[0] ?? null
  );
}

function planForBrand(plans: MonthlyPlanRow[], brandId: string) {
  return (
    plans.find((plan) => plan.brandId === brandId) ?? {
      brandId,
      leadTarget: 0,
      bookingTarget: 0,
      showTarget: 0,
    }
  );
}

function buildBrandRow(input: {
  brand: BrandSetting;
  dates: string[];
  daysInMonth: number;
  plans: MonthlyPlanRow[];
  sources: SourceRow[];
  funnelMetrics: FunnelMetricRow[];
  spendEntries: DailySpendEntry[];
}): DailyOverviewBrandRow {
  const plan = planForBrand(input.plans, input.brand.id);
  const funnelSource = chooseFunnelSource(input.sources, input.brand.id);
  const dailyByDate = new Map<string, DailyBaseMetrics>();
  const spendByTypeByDate = new Map<string, Record<SpendType, number>>();
  for (const date of input.dates) {
    dailyByDate.set(date, emptyDailyBaseMetrics());
    spendByTypeByDate.set(date, emptySpendTypeAmounts());
  }

  const spendEntries = input.spendEntries.filter(
    (entry) => entry.brandId === input.brand.id
  );
  for (const entry of spendEntries) {
    const current = dailyByDate.get(entry.spendDate);
    if (!current) continue;
    dailyByDate.set(entry.spendDate, {
      ...current,
      spend: current.spend + entry.amount,
    });
    const typed = spendByTypeByDate.get(entry.spendDate);
    if (typed) typed[entry.spendType] += entry.amount;
  }

  if (funnelSource) {
    for (const metric of input.funnelMetrics) {
      if (
        metric.brandId !== input.brand.id ||
        metric.dataSourceId !== funnelSource.id ||
        !metric.sourceKey.endsWith(":lead_funnel")
      ) {
        continue;
      }
      const current = dailyByDate.get(metric.metricDate);
      if (!current) continue;
      dailyByDate.set(metric.metricDate, {
        ...current,
        leads: current.leads + metric.leads,
        bookings: current.bookings + metric.bookings,
        shows: current.shows + metric.shows,
      });
    }
  }

  let cumulative = emptyDailyBaseMetrics();
  const cumulativeSpendByType = emptySpendTypeAmounts();
  const cells = input.dates.map((date): DailyOverviewCell => {
    const daily = dailyByDate.get(date) ?? emptyDailyBaseMetrics();
    const dailySpendByType =
      spendByTypeByDate.get(date) ?? emptySpendTypeAmounts();
    for (const spendType of ALL_SPEND_TYPES) {
      cumulativeSpendByType[spendType] += dailySpendByType[spendType];
    }
    cumulative = addDailyBaseMetrics(cumulative, daily);
    const day = Number(date.slice(-2));
    const pace = targetPaceAtDay({
      leadTarget: plan.leadTarget,
      bookingTarget: plan.bookingTarget,
      showTarget: plan.showTarget,
      day,
      daysInMonth: input.daysInMonth,
    });
    return {
      date,
      day,
      weekday: weekdayFormatter.format(dateAtUtc(date)),
      daily: deriveDailyMetrics(daily),
      cumulative: deriveDailyMetrics(cumulative),
      spendByType: {
        daily: { ...dailySpendByType },
        cumulative: { ...cumulativeSpendByType },
      },
      targetPace: pace,
      leadTargetAttainment: targetAttainment(cumulative.leads, pace.leads),
      bookingTargetAttainment: targetAttainment(
        cumulative.bookings,
        pace.bookings
      ),
      showTargetAttainment: targetAttainment(cumulative.shows, pace.shows),
    };
  });

  const expectedSpendDays = input.dates.length;
  const spendCoverageDays = new Set(spendEntries.map((entry) => entry.spendDate))
    .size;
  const warnings: string[] = [];
  if (spendCoverageDays < expectedSpendDays) {
    warnings.push(
      `${input.brand.name} 廣告費已填 ${spendCoverageDays}/${expectedSpendDays} 日`
    );
  }
  if (!funnelSource) {
    warnings.push(`${input.brand.name} 未有 CS Lead Funnel 來源`);
  } else if (funnelSource.status !== "connected") {
    warnings.push(
      `${input.brand.name} CS Lead Funnel 狀態：${funnelSource.status}`
    );
  }

  return {
    id: input.brand.id,
    name: input.brand.name,
    slug: input.brand.slug,
    color: input.brand.primaryColor || "#5A2348",
    secondaryColor: input.brand.secondaryColor || "#F8E8E2",
    leadTarget: plan.leadTarget,
    bookingTarget: plan.bookingTarget,
    showTarget: plan.showTarget,
    cells,
    total: deriveDailyMetrics(cumulative),
    spendCoverageDays,
    expectedSpendDays,
    funnelSourceStatus: funnelSource?.status ?? null,
    latestFunnelSyncAt: funnelSource?.lastSuccessAt ?? null,
    warnings,
  };
}

function buildAllBrandsRow(
  brands: DailyOverviewBrandRow[],
  dates: string[],
  daysInMonth: number
): DailyOverviewBrandRow {
  const leadTarget = brands.reduce((sum, brand) => sum + brand.leadTarget, 0);
  const bookingTarget = brands.reduce(
    (sum, brand) => sum + brand.bookingTarget,
    0
  );
  const showTarget = brands.reduce((sum, brand) => sum + brand.showTarget, 0);
  let cumulative = emptyDailyBaseMetrics();
  const cumulativeSpendByType = emptySpendTypeAmounts();
  const cells = dates.map((date, index): DailyOverviewCell => {
    const daily = brands.reduce(
      (total, brand) =>
        addDailyBaseMetrics(total, brand.cells[index]?.daily ?? emptyDailyBaseMetrics()),
      emptyDailyBaseMetrics()
    );
    const dailySpendByType = brands.reduce(
      (total, brand) => {
        for (const spendType of ALL_SPEND_TYPES) {
          total[spendType] +=
            brand.cells[index]?.spendByType.daily[spendType] ?? 0;
        }
        return total;
      },
      emptySpendTypeAmounts()
    );
    for (const spendType of ALL_SPEND_TYPES) {
      cumulativeSpendByType[spendType] += dailySpendByType[spendType];
    }
    cumulative = addDailyBaseMetrics(cumulative, daily);
    const day = Number(date.slice(-2));
    const pace = targetPaceAtDay({
      leadTarget,
      bookingTarget,
      showTarget,
      day,
      daysInMonth,
    });
    return {
      date,
      day,
      weekday: weekdayFormatter.format(dateAtUtc(date)),
      daily: deriveDailyMetrics(daily),
      cumulative: deriveDailyMetrics(cumulative),
      spendByType: {
        daily: { ...dailySpendByType },
        cumulative: { ...cumulativeSpendByType },
      },
      targetPace: pace,
      leadTargetAttainment: targetAttainment(cumulative.leads, pace.leads),
      bookingTargetAttainment: targetAttainment(
        cumulative.bookings,
        pace.bookings
      ),
      showTargetAttainment: targetAttainment(cumulative.shows, pace.shows),
    };
  });
  return {
    id: "all-brands",
    name: "全部品牌",
    slug: "all-brands",
    color: "#253A57",
    secondaryColor: "#EAF0E8",
    leadTarget,
    bookingTarget,
    showTarget,
    cells,
    total: deriveDailyMetrics(cumulative),
    spendCoverageDays: brands.reduce(
      (sum, brand) => sum + brand.spendCoverageDays,
      0
    ),
    expectedSpendDays: dates.length * brands.length,
    funnelSourceStatus: brands.every(
      (brand) => brand.funnelSourceStatus === "connected"
    )
      ? "connected"
      : null,
    latestFunnelSyncAt: latest(brands.map((brand) => brand.latestFunnelSyncAt)),
    warnings: Array.from(new Set(brands.flatMap((brand) => brand.warnings))),
  };
}

function fixtureRecords(input: {
  brands: BrandSetting[];
  dates: string[];
  monthStart: string;
}) {
  const sources = input.brands.map(
    (brand, index): SourceRow => ({
      id: `70000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      brandId: brand.id,
      status: "connected",
      dataset: "lead_funnel",
      lastSuccessAt: `${input.dates.at(-1) ?? input.monthStart}T01:00:00.000Z`,
    })
  );
  const funnelMetrics: FunnelMetricRow[] = [];
  const spendEntries: DailySpendEntry[] = [];
  input.brands.forEach((brand, brandIndex) => {
    input.dates.forEach((date, dateIndex) => {
      const activity = Math.max(1, 5 - brandIndex + (dateIndex % 3));
      funnelMetrics.push({
        brandId: brand.id,
        metricDate: date,
        dataSourceId: sources[brandIndex].id,
        sourceKey: `fixture:${brand.slug}:lead_funnel`,
        leads: activity,
        bookings: Math.floor(activity * 0.45),
        shows: Math.floor(activity * 0.25),
      });
      SPEND_TYPE_OPTIONS.forEach((option, typeIndex) => {
        spendEntries.push({
          id: `80000000-0000-4000-${String(8000 + brandIndex).padStart(4, "0")}-${String((dateIndex + 1) * 10 + typeIndex).padStart(12, "0")}`,
          brandId: brand.id,
          spendDate: date,
          spendType: option.value,
          amount: 110 + brandIndex * 25 + dateIndex * 4 + typeIndex * 18,
          entryMethod: "manual",
          note: null,
          revision: 1,
          updatedBy: "fixture@example.test",
          updatedAt: `${date}T01:00:00.000Z`,
        });
      });
      if (dateIndex === 0) {
        spendEntries.push({
          id: `80000000-0000-4000-${String(9000 + brandIndex).padStart(4, "0")}-000000000001`,
          brandId: brand.id,
          spendDate: date,
          spendType: "legacy_unclassified",
          amount: 50 + brandIndex * 10,
          entryMethod: "legacy_import",
          note: "驗收用舊資料",
          revision: 1,
          updatedBy: "system:migration",
          updatedAt: `${date}T00:30:00.000Z`,
        });
      }
    });
  });
  const plans = input.brands.map(
    (brand, index): MonthlyPlanRow => ({
      brandId: brand.id,
      leadTarget: 120 - index * 15,
      bookingTarget: 50 - index * 6,
      showTarget: 28 - index * 4,
    })
  );
  return { sources, funnelMetrics, spendEntries, plans };
}

async function fetchMetricRows(input: {
  brandIds: string[];
  startDate: string;
  endDate: string;
}) {
  const supabase = createSupabaseAdminClient();
  const rows: Array<Record<string, unknown>> = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("marketing_daily_metrics")
      .select("brand_id,metric_date,data_source_id,source_key,leads,bookings,shows")
      .in("brand_id", input.brandIds)
      .gte("metric_date", input.startDate)
      .lte("metric_date", input.endDate)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = (data ?? []) as Array<Record<string, unknown>>;
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows.map(
    (row): FunnelMetricRow => ({
      brandId: String(row.brand_id ?? ""),
      metricDate: String(row.metric_date ?? ""),
      dataSourceId: textValue(row.data_source_id),
      sourceKey: String(row.source_key ?? ""),
      leads: numberValue(row.leads),
      bookings: numberValue(row.bookings),
      shows: numberValue(row.shows),
    })
  );
}

async function fetchSpendEntries(input: {
  brandIds: string[];
  startDate: string;
  endDate: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("marketing_daily_spend_entries")
    .select(
      "id,brand_id,spend_date,spend_type,amount,entry_method,note,revision,updated_by_email,updated_at"
    )
    .in("brand_id", input.brandIds)
    .gte("spend_date", input.startDate)
    .lte("spend_date", input.endDate)
    .order("spend_date", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map(
    (row): DailySpendEntry => ({
      id: String(row.id ?? ""),
      brandId: String(row.brand_id ?? ""),
      spendDate: String(row.spend_date ?? ""),
      spendType: isSpendType(String(row.spend_type ?? ""))
        ? (String(row.spend_type) as SpendType)
        : "legacy_unclassified",
      amount: numberValue(row.amount),
      entryMethod: String(row.entry_method ?? "manual") as DailySpendEntry["entryMethod"],
      note: textValue(row.note),
      revision: numberValue(row.revision),
      updatedBy: textValue(row.updated_by_email),
      updatedAt: String(row.updated_at ?? ""),
    })
  );
}

export async function getDailyOverviewSnapshot(
  query?: DailyOverviewQuery
): Promise<DailyOverviewSnapshot> {
  const current = getHkMonthContext();
  const monthStart = normalizeMonth(firstParam(query?.month), current.monthStart);
  const endOfMonth = monthEnd(monthStart);
  const completedDate = previousDate(current.today);
  const throughDate =
    monthStart === current.monthStart
      ? completedDate < monthStart
        ? monthStart
        : completedDate
      : endOfMonth;
  const dates = listDates(monthStart, throughDate);
  const requestedEntryDate = firstParam(query?.entry_date);
  const selectedSpendType = normalizeEditableSpendType(
    firstParam(query?.spend_type)
  );
  const selectedEntryDate =
    /^\d{4}-\d{2}-\d{2}$/.test(requestedEntryDate) &&
    requestedEntryDate >= monthStart &&
    requestedEntryDate <= current.today
      ? requestedEntryDate
      : throughDate;
  const [config, access] = await Promise.all([
    getConfigurationData(),
    getCurrentInternalAccess(),
  ]);
  const brands = config.brands;
  const brandIds = brands.map((brand) => brand.id);
  const monthOptions = Array.from({ length: 18 }, (_, index) => {
    const value = shiftMonth(current.monthStart, -index);
    return { value, label: monthFormatter.format(dateAtUtc(value)) };
  });
  const canEditSpend = canEditSpendForRole({
    accessLevel: access.accessLevel,
    workspaceRole: access.workspaceRole,
  });

  let schemaReady = hasSupabaseAdminEnv();
  let warnings: string[] = [];
  let sources: SourceRow[] = [];
  let funnelMetrics: FunnelMetricRow[] = [];
  let spendEntries: DailySpendEntry[] = [];
  let plans: MonthlyPlanRow[] = [];

  if (!hasSupabaseAdminEnv()) {
    const fixtures = fixtureRecords({ brands, dates, monthStart });
    sources = fixtures.sources;
    funnelMetrics = fixtures.funnelMetrics;
    spendEntries = fixtures.spendEntries;
    plans = fixtures.plans;
    schemaReady = false;
    warnings = ["正式數據庫未連接；目前顯示驗收用每日 Overview 數據。"];
  } else if (brandIds.length > 0) {
    try {
      const supabase = createSupabaseAdminClient();
      const [sourcesResult, plansResult, metricsResult, spendsResult] =
        await Promise.all([
          supabase
            .from("marketing_data_sources")
            .select("id,brand_id,status,configuration,last_success_at"),
          supabase
            .from("marketing_monthly_plans")
            .select("brand_id,lead_target,booking_target,show_target")
            .eq("month_start", monthStart)
            .in("brand_id", brandIds),
          fetchMetricRows({
            brandIds,
            startDate: monthStart,
            endDate: throughDate,
          }),
          fetchSpendEntries({
            brandIds,
            startDate: monthStart,
            endDate: current.today > throughDate ? current.today : throughDate,
          }),
        ]);
      if (sourcesResult.error) throw sourcesResult.error;
      if (plansResult.error) throw plansResult.error;
      sources = ((sourcesResult.data ?? []) as Array<Record<string, unknown>>).map(
        (row): SourceRow => {
          const configuration = recordValue(row.configuration);
          return {
            id: String(row.id ?? ""),
            brandId: textValue(row.brand_id),
            status: String(row.status ?? "draft"),
            dataset: String(configuration.dataset ?? ""),
            lastSuccessAt: textValue(row.last_success_at),
          };
        }
      );
      plans = ((plansResult.data ?? []) as Array<Record<string, unknown>>).map(
        (row): MonthlyPlanRow => ({
          brandId: String(row.brand_id ?? ""),
          leadTarget: numberValue(row.lead_target),
          bookingTarget: numberValue(row.booking_target),
          showTarget: numberValue(row.show_target),
        })
      );
      funnelMetrics = metricsResult;
      spendEntries = spendsResult;
    } catch (error) {
      console.warn("daily_overview_snapshot_failed", {
        message: error instanceof Error ? error.message : "unknown",
      });
      schemaReady = false;
      warnings = ["每日 Overview 暫時未能完整讀取，請檢查正式 migration 狀態。"];
    }
  }

  const daysInMonth = Number(endOfMonth.slice(-2));
  const brandRows = brands.map((brand) =>
    buildBrandRow({
      brand,
      dates,
      daysInMonth,
      plans,
      sources,
      funnelMetrics,
      spendEntries,
    })
  );
  const allBrands = buildAllBrandsRow(brandRows, dates, daysInMonth);
  const selectedEntries = Object.fromEntries(
    brands.map((brand) => [
      brand.id,
      spendEntries.find(
        (entry) =>
          entry.brandId === brand.id &&
          entry.spendDate === selectedEntryDate &&
          entry.spendType === selectedSpendType
      ) ?? null,
    ])
  );
  const rowWarnings = Array.from(
    new Set(brandRows.flatMap((brand) => brand.warnings))
  );

  return {
    monthStart,
    monthEnd: endOfMonth,
    monthLabel: monthFormatter.format(dateAtUtc(monthStart)),
    throughDate,
    selectedEntryDate,
    selectedSpendType,
    maxEntryDate: current.today < endOfMonth ? current.today : endOfMonth,
    dates,
    monthOptions,
    brands: brandRows,
    allBrands,
    selectedEntries,
    spendTypeOptions: SPEND_TYPE_OPTIONS,
    hasLegacySpend: spendEntries.some(
      (entry) => entry.spendType === "legacy_unclassified"
    ),
    canEditSpend,
    schemaReady,
    latestSpendUpdateAt: latest(spendEntries.map((entry) => entry.updatedAt)),
    warnings: [...warnings, ...rowWarnings],
  };
}

export function canEditDailySpendAccess(input: {
  accessLevel: string;
  workspaceRole?: string;
}) {
  return canEditSpendForRole(input);
}
