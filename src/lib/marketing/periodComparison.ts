import "server-only";

import { getConfigurationData, type BrandSetting } from "@/lib/data/configuration";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";
import { getHkMonthContext } from "@/lib/marketing/pacing";
import {
  completeSpendCoverageDates,
  isSpendType,
  type SpendType,
} from "@/lib/marketing/spendTypes";
import {
  aggregateComparisonRows,
  buildCumulativeComparisonTrend,
  comparisonMonthDays,
  createComparisonPeriods,
  normalizeComparisonMonth,
  relativeComparisonChange,
  shiftComparisonMonth,
  type CanonicalComparisonMetricRow,
  type ComparisonKpis,
  type ComparisonMetricKey,
  type ComparisonPeriod,
  type PeriodComparisonTrendSeries,
} from "@/lib/marketing/periodComparisonMath";

export type { PeriodComparisonTrendSeries } from "@/lib/marketing/periodComparisonMath";

export type ComparisonDataQuality = "complete" | "partial" | "missing";

export type PeriodComparisonQuery = {
  month?: string | string[];
  months?: string | string[];
  start_day?: string | string[];
  end_day?: string | string[];
  brand?: string | string[];
};

export type PeriodComparisonFilters = {
  anchorMonth: string;
  monthCount: 2 | 3 | 6;
  startDay: number;
  endDay: number;
  brandId: string | null;
};

export type PeriodSourceHealth = {
  quality: ComparisonDataQuality;
  spendCoverageDays: number;
  expectedSpendDays: number;
  spendSourceStatus: string | null;
  funnelSourceStatus: string | null;
  latestSyncAt: string | null;
  warnings: string[];
};

export type PeriodComparisonRow = {
  period: ComparisonPeriod;
  label: string;
  metrics: ComparisonKpis;
  changes: Partial<Record<ComparisonMetricKey, number | null>>;
  quality: PeriodSourceHealth;
};

export type BrandPeriodComparisonRow = PeriodComparisonRow & {
  brandId: string;
  brandName: string;
  brandSlug: string;
  brandColor: string;
};

export type PeriodComparisonSnapshot = {
  filters: PeriodComparisonFilters;
  brands: Array<{
    id: string;
    name: string;
    slug: string;
    color: string;
    secondaryColor: string;
  }>;
  selectedBrandLabel: string;
  monthOptions: Array<{ value: string; label: string }>;
  periods: ComparisonPeriod[];
  totals: PeriodComparisonRow[];
  brandRows: BrandPeriodComparisonRow[];
  trendSeries: PeriodComparisonTrendSeries[];
  schemaReady: boolean;
  sourceUpdatedAt: string | null;
  warnings: string[];
};

type SourceRow = {
  id: string;
  brandId: string | null;
  status: string;
  dataset: string;
  lastSuccessAt: string | null;
};

type RawMetricRow = {
  brandId: string;
  metricDate: string;
  sourceKey: string;
  dataSourceId: string | null;
  leads: number;
  bookings: number;
  shows: number;
};

type SpendEntryRow = {
  brandId: string;
  spendDate: string;
  spendType: SpendType;
  amount: number;
  updatedAt: string | null;
};

type PeriodCanonicalData = {
  rows: CanonicalComparisonMetricRow[];
  healthByBrand: Map<string, PeriodSourceHealth>;
};

const comparisonMetricKeys: ComparisonMetricKey[] = [
  "spend",
  "leads",
  "bookings",
  "shows",
  "cpl",
  "costPerBooking",
  "costPerShow",
  "leadToBookRate",
  "bookToShowRate",
  "leadToShowRate",
];

const monthCountOptions = new Set([2, 3, 6]);
const trendColors = [
  "#5A2348",
  "#C9828E",
  "#3F91B4",
  "#D3913E",
  "#5F806E",
  "#826AA4",
];
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

function monthLabel(monthStart: string) {
  return new Intl.DateTimeFormat("zh-HK", {
    year: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${monthStart}T00:00:00.000Z`));
}

function periodLabel(period: ComparisonPeriod) {
  return `${monthLabel(period.monthStart)} · ${period.startDay}–${period.endDay} 日`;
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

function chooseSpendSource(sources: SourceRow[], brandId: string) {
  return (
    sources
      .filter(
        (source) =>
          source.dataset === "daily_spend_ledger" &&
          source.brandId === brandId
      )
      .sort(
        (left, right) =>
          sourcePriority(right, brandId) - sourcePriority(left, brandId)
      )[0] ?? null
  );
}

function uniqueLatest(values: Array<string | null | undefined>) {
  return (
    values
      .filter((value): value is string => Boolean(value))
      .sort((left, right) => right.localeCompare(left))[0] ?? null
  );
}

function healthForBrand(input: {
  brand: BrandSetting;
  period: ComparisonPeriod;
  spendSource: SourceRow | null;
  funnelSource: SourceRow | null;
  spendDates: Set<string>;
  latestSpendAt: string | null;
}) {
  const warnings: string[] = [];
  const spendCoverageDays = input.spendDates.size;
  const spendConnected = input.spendSource?.status === "connected";
  const funnelConnected = input.funnelSource?.status === "connected";
  const coverageHealthy =
    spendCoverageDays >= input.period.expectedDays &&
    input.period.expectedDays > 0;

  if (!input.spendSource) {
    warnings.push(`${input.brand.name} 未有該月廣告費來源`);
  } else if (!spendConnected) {
    warnings.push(
      `${input.brand.name} 廣告費來源狀態：${input.spendSource.status}`
    );
  }
  if (input.spendSource && !coverageHealthy) {
    warnings.push(
      `${input.brand.name} 廣告費只覆蓋 ${spendCoverageDays}/${input.period.expectedDays} 日`
    );
  }
  if (!input.funnelSource) {
    warnings.push(`${input.brand.name} 未有 Lead Funnel 來源`);
  } else if (!funnelConnected) {
    warnings.push(
      `${input.brand.name} Lead Funnel 狀態：${input.funnelSource.status}`
    );
  }

  const spendHealthy = spendConnected && coverageHealthy;
  const quality: ComparisonDataQuality =
    spendHealthy && funnelConnected
      ? "complete"
      : input.spendSource || input.funnelSource
        ? "partial"
        : "missing";

  return {
    quality,
    spendCoverageDays,
    expectedSpendDays: input.period.expectedDays,
    spendSourceStatus: input.spendSource?.status ?? null,
    funnelSourceStatus: input.funnelSource?.status ?? null,
    latestSyncAt: uniqueLatest([
      input.spendSource?.lastSuccessAt,
      input.latestSpendAt,
      input.funnelSource?.lastSuccessAt,
    ]),
    warnings,
  } satisfies PeriodSourceHealth;
}

function canonicalizePeriod(input: {
  period: ComparisonPeriod;
  brands: BrandSetting[];
  sources: SourceRow[];
  metrics: RawMetricRow[];
  spendEntries: SpendEntryRow[];
}): PeriodCanonicalData {
  const rows: CanonicalComparisonMetricRow[] = [];
  const healthByBrand = new Map<string, PeriodSourceHealth>();

  for (const brand of input.brands) {
    const funnelSource = chooseFunnelSource(input.sources, brand.id);
    const spendSource = chooseSpendSource(input.sources, brand.id);
    const brandSpendEntries = input.spendEntries.filter(
      (entry) => entry.brandId === brand.id
    );
    const spendDates = completeSpendCoverageDates(brandSpendEntries);

    for (const entry of brandSpendEntries) {
      rows.push({
        brandId: brand.id,
        metricDate: entry.spendDate,
        spend: entry.amount,
        leads: 0,
        bookings: 0,
        shows: 0,
      });
    }

    for (const metric of input.metrics) {
      if (metric.brandId !== brand.id) continue;
      if (
        funnelSource &&
        metric.dataSourceId === funnelSource.id &&
        metric.sourceKey.endsWith(":lead_funnel")
      ) {
        rows.push({
          brandId: brand.id,
          metricDate: metric.metricDate,
          spend: 0,
          leads: metric.leads,
          bookings: metric.bookings,
          shows: metric.shows,
        });
      }
    }

    healthByBrand.set(
      brand.id,
      healthForBrand({
        brand,
        period: input.period,
        spendSource,
        funnelSource,
        spendDates,
        latestSpendAt: uniqueLatest(
          brandSpendEntries.map((entry) => entry.updatedAt)
        ),
      })
    );
  }

  return { rows, healthByBrand };
}

function mergeHealth(
  healthRows: PeriodSourceHealth[],
  expectedDays: number
): PeriodSourceHealth {
  const qualities = healthRows.map((health) => health.quality);
  const quality: ComparisonDataQuality =
    healthRows.length > 0 && qualities.every((value) => value === "complete")
      ? "complete"
      : healthRows.length > 0 && qualities.every((value) => value === "missing")
        ? "missing"
        : "partial";
  return {
    quality,
    spendCoverageDays: healthRows.reduce(
      (total, health) => total + health.spendCoverageDays,
      0
    ),
    expectedSpendDays: expectedDays * healthRows.length,
    spendSourceStatus: quality === "complete" ? "connected" : null,
    funnelSourceStatus: healthRows.every(
      (health) => health.funnelSourceStatus === "connected"
    )
      ? "connected"
      : null,
    latestSyncAt: uniqueLatest(healthRows.map((health) => health.latestSyncAt)),
    warnings: Array.from(
      new Set(healthRows.flatMap((health) => health.warnings))
    ),
  };
}

function metricChanges(
  current: ComparisonKpis,
  previous: ComparisonKpis | null
) {
  if (!previous) return {};
  return Object.fromEntries(
    comparisonMetricKeys.map((key) => [
      key,
      relativeComparisonChange(current[key], previous[key]),
    ])
  ) as Partial<Record<ComparisonMetricKey, number | null>>;
}

function comparisonFilters(
  query: PeriodComparisonQuery | undefined,
  brands: BrandSetting[]
): PeriodComparisonFilters {
  const month = getHkMonthContext();
  const defaultAnchor =
    month.elapsedDays > 0
      ? month.monthStart
      : (shiftComparisonMonth(month.monthStart, -1) as string);
  const requestedAnchor = normalizeComparisonMonth(firstParam(query?.month));
  const anchorMonth =
    requestedAnchor && requestedAnchor <= month.monthStart
      ? requestedAnchor
      : defaultAnchor;
  const requestedCount = Number(firstParam(query?.months));
  const monthCount = (monthCountOptions.has(requestedCount)
    ? requestedCount
    : 3) as 2 | 3 | 6;
  const defaultEnd =
    anchorMonth === month.monthStart
      ? Math.max(1, month.elapsedDays)
      : comparisonMonthDays(anchorMonth);
  const requestedEnd = Number(firstParam(query?.end_day));
  const endDay = Number.isInteger(requestedEnd)
    ? Math.max(1, Math.min(31, requestedEnd))
    : defaultEnd;
  const requestedStart = Number(firstParam(query?.start_day));
  const startDay = Number.isInteger(requestedStart)
    ? Math.max(1, Math.min(endDay, requestedStart))
    : 1;
  const brandParam = firstParam(query?.brand);
  const selectedBrand = brands.find(
    (brand) => brand.id === brandParam || brand.slug === brandParam
  );

  return {
    anchorMonth,
    monthCount,
    startDay,
    endDay,
    brandId: selectedBrand?.id ?? null,
  };
}

function monthOptions(currentMonth: string) {
  return Array.from({ length: 12 }, (_, index) => {
    const value = shiftComparisonMonth(currentMonth, -index) as string;
    return { value, label: monthLabel(value) };
  });
}

function sourceRows(rows: Array<Record<string, unknown>>) {
  return rows.map((row): SourceRow => {
    const configuration = recordValue(row.configuration);
    return {
      id: String(row.id ?? ""),
      brandId: textValue(row.brand_id),
      status: String(row.status ?? "draft"),
      dataset: String(configuration.dataset ?? ""),
      lastSuccessAt: textValue(row.last_success_at),
    };
  });
}

function metricRows(rows: Array<Record<string, unknown>>) {
  return rows.map((row): RawMetricRow => ({
    brandId: String(row.brand_id ?? ""),
    metricDate: String(row.metric_date ?? ""),
    sourceKey: String(row.source_key ?? ""),
    dataSourceId: textValue(row.data_source_id),
    leads: numberValue(row.leads),
    bookings: numberValue(row.bookings),
    shows: numberValue(row.shows),
  }));
}

async function fetchPeriodMetrics(input: {
  period: ComparisonPeriod;
  brandIds: string[];
}) {
  const supabase = createSupabaseAdminClient();
  const rows: Array<Record<string, unknown>> = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("marketing_daily_metrics")
      .select(
        "brand_id,metric_date,source_key,data_source_id,leads,bookings,shows"
      )
      .in("brand_id", input.brandIds)
      .gte("metric_date", input.period.startDate)
      .lte("metric_date", input.period.endDate)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = (data ?? []) as Array<Record<string, unknown>>;
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return metricRows(rows);
}

async function fetchPeriodSpendEntries(input: {
  period: ComparisonPeriod;
  brandIds: string[];
}) {
  const supabase = createSupabaseAdminClient();
  const rows: Array<Record<string, unknown>> = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("marketing_daily_spend_entries")
      .select("brand_id,spend_date,spend_type,amount,updated_at")
      .in("brand_id", input.brandIds)
      .gte("spend_date", input.period.startDate)
      .lte("spend_date", input.period.endDate)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = (data ?? []) as Array<Record<string, unknown>>;
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows.map(
    (row): SpendEntryRow => ({
      brandId: String(row.brand_id ?? ""),
      spendDate: String(row.spend_date ?? ""),
      spendType: isSpendType(String(row.spend_type ?? ""))
        ? (String(row.spend_type) as SpendType)
        : "legacy_unclassified",
      amount: numberValue(row.amount),
      updatedAt: textValue(row.updated_at),
    })
  );
}

function fixtureCanonicalData(
  period: ComparisonPeriod,
  brands: BrandSetting[],
  monthIndex: number
): PeriodCanonicalData {
  const rows: CanonicalComparisonMetricRow[] = [];
  const healthByBrand = new Map<string, PeriodSourceHealth>();
  for (const [brandIndex, brand] of brands.entries()) {
    for (let day = period.startDay; day <= period.endDay; day += 1) {
      const activity = Math.max(0, 4 - monthIndex + brandIndex);
      rows.push({
        brandId: brand.id,
        metricDate: `${period.monthStart.slice(0, 8)}${String(day).padStart(2, "0")}`,
        spend: 180 + brandIndex * 55 + monthIndex * 18 + day * 4,
        leads: activity + (day % 2),
        bookings: Math.max(0, Math.floor(activity * 0.42)),
        shows: Math.max(0, Math.floor(activity * 0.22)),
      });
    }
    healthByBrand.set(brand.id, {
      quality: "complete",
      spendCoverageDays: period.expectedDays,
      expectedSpendDays: period.expectedDays,
      spendSourceStatus: "connected",
      funnelSourceStatus: "connected",
      latestSyncAt: `${period.endDate}T01:00:00.000Z`,
      warnings: [],
    });
  }
  return { rows, healthByBrand };
}

function buildSnapshot(input: {
  filters: PeriodComparisonFilters;
  brands: BrandSetting[];
  periods: ComparisonPeriod[];
  canonicalData: PeriodCanonicalData[];
  schemaReady: boolean;
  warnings: string[];
}): PeriodComparisonSnapshot {
  const selectedBrands = input.filters.brandId
    ? input.brands.filter((brand) => brand.id === input.filters.brandId)
    : input.brands;
  const selectedBrandIds = new Set(selectedBrands.map((brand) => brand.id));
  const totalMetrics = input.canonicalData.map((data) =>
    aggregateComparisonRows(data.rows, selectedBrandIds)
  );
  const totals = input.periods.map((period, index): PeriodComparisonRow => {
    const healthRows = selectedBrands.map(
      (brand) =>
        input.canonicalData[index].healthByBrand.get(brand.id) ?? {
          quality: "missing" as const,
          spendCoverageDays: 0,
          expectedSpendDays: period.expectedDays,
          spendSourceStatus: null,
          funnelSourceStatus: null,
          latestSyncAt: null,
          warnings: [`${brand.name} 未有同期數據`],
        }
    );
    return {
      period,
      label: periodLabel(period),
      metrics: totalMetrics[index],
      changes: metricChanges(totalMetrics[index], totalMetrics[index + 1] ?? null),
      quality: mergeHealth(healthRows, period.expectedDays),
    };
  });

  const brandRows = selectedBrands.flatMap((brand) => {
    const metrics = input.canonicalData.map((data) =>
      aggregateComparisonRows(data.rows, new Set([brand.id]))
    );
    return input.periods.map((period, index): BrandPeriodComparisonRow => ({
      brandId: brand.id,
      brandName: brand.name,
      brandSlug: brand.slug,
      brandColor: brand.primaryColor || "#5A2348",
      period,
      label: periodLabel(period),
      metrics: metrics[index],
      changes: metricChanges(metrics[index], metrics[index + 1] ?? null),
      quality:
        input.canonicalData[index].healthByBrand.get(brand.id) ?? {
          quality: "missing",
          spendCoverageDays: 0,
          expectedSpendDays: period.expectedDays,
          spendSourceStatus: null,
          funnelSourceStatus: null,
          latestSyncAt: null,
          warnings: [`${brand.name} 未有同期數據`],
        },
    }));
  });

  const trendSeries = input.periods.map(
    (period, index): PeriodComparisonTrendSeries => ({
      monthStart: period.monthStart,
      label: monthLabel(period.monthStart),
      color: trendColors[index % trendColors.length],
      points: buildCumulativeComparisonTrend({
        period,
        rows: input.canonicalData[index].rows,
        brandIds: selectedBrandIds,
      }),
    })
  );
  const dataWarnings = Array.from(
    new Set([
      ...input.warnings,
      ...totals.flatMap((row) => row.quality.warnings),
    ])
  );

  return {
    filters: input.filters,
    brands: input.brands.map((brand) => ({
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      color: brand.primaryColor || "#5A2348",
      secondaryColor: brand.secondaryColor || "#F8E8E2",
    })),
    selectedBrandLabel:
      selectedBrands.length === 1 ? selectedBrands[0].name : "全部品牌",
    monthOptions: monthOptions(getHkMonthContext().monthStart),
    periods: input.periods,
    totals,
    brandRows,
    trendSeries,
    schemaReady: input.schemaReady,
    sourceUpdatedAt: uniqueLatest(
      totals.map((row) => row.quality.latestSyncAt)
    ),
    warnings: dataWarnings,
  };
}

export async function getPeriodComparisonSnapshot(
  query?: PeriodComparisonQuery
): Promise<PeriodComparisonSnapshot> {
  const config = await getConfigurationData();
  const brands = config.brands;
  const filters = comparisonFilters(query, brands);
  const periods = createComparisonPeriods({
    anchorMonth: filters.anchorMonth,
    monthCount: filters.monthCount,
    startDay: filters.startDay,
    endDay: filters.endDay,
  });
  const selectedBrands = filters.brandId
    ? brands.filter((brand) => brand.id === filters.brandId)
    : brands;

  if (!hasSupabaseAdminEnv()) {
    return buildSnapshot({
      filters,
      brands,
      periods,
      canonicalData: periods.map((period, index) =>
        fixtureCanonicalData(period, brands, index)
      ),
      schemaReady: false,
      warnings: ["正式數據庫未連接；目前顯示驗收用同期數據。"],
    });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const [sourcesResult, periodResults] = await Promise.all([
      supabase
        .from("marketing_data_sources")
        .select("id,brand_id,status,configuration,last_success_at"),
      Promise.all(
        periods.map((period) =>
          Promise.all([
            fetchPeriodMetrics({
              period,
              brandIds: selectedBrands.map((brand) => brand.id),
            }),
            fetchPeriodSpendEntries({
              period,
              brandIds: selectedBrands.map((brand) => brand.id),
            }),
          ])
        )
      ),
    ]);
    if (sourcesResult.error) throw sourcesResult.error;
    const sources = sourceRows(
      (sourcesResult.data ?? []) as Array<Record<string, unknown>>
    );
    const canonicalData = periods.map((period, index) =>
      canonicalizePeriod({
        period,
        brands: selectedBrands,
        sources,
        metrics: periodResults[index]?.[0] ?? [],
        spendEntries: periodResults[index]?.[1] ?? [],
      })
    );

    return buildSnapshot({
      filters,
      brands,
      periods,
      canonicalData,
      schemaReady: true,
      warnings: [],
    });
  } catch (error) {
    console.warn("period_comparison_snapshot_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return buildSnapshot({
      filters,
      brands,
      periods,
      canonicalData: periods.map(() => ({
        rows: [],
        healthByBrand: new Map(),
      })),
      schemaReady: false,
      warnings: ["同期對比資料暫時未能完整讀取，請檢查資料來源同步狀態。"],
    });
  }
}
