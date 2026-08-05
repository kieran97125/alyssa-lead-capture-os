import "server-only";

import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";
import { getHkMonthContext } from "@/lib/marketing/pacing";
import { getOperationalAnnotations } from "@/lib/marketing/operationalAnnotationStore";
import type { OperationalAnnotation } from "@/lib/marketing/operationalAnnotations";
import {
  buildDailyTreatmentTrend,
  type PerformanceTrendSeries,
  type TreatmentTrendFact,
} from "@/lib/marketing/performanceTrend";
import {
  calculatePerformanceCostSummary,
  type DailySpendFact,
  type PerformanceCostSummary,
} from "@/lib/marketing/performanceCostMath";
import { fetchDailySpendFacts } from "@/lib/marketing/performanceCosts";
import { getCurrentInternalAccess } from "@/lib/security/internalAccessServer";

export type TreatmentPerformanceSort =
  | "leads"
  | "book_rate"
  | "shows"
  | "show_up_rate"
  | "no_show_rate";

export type TreatmentPerformanceFilters = {
  startDate: string;
  endDate: string;
  brandId: string;
  treatment: string;
  source: string;
  campaign: string;
  sort: TreatmentPerformanceSort;
};

export type TreatmentPerformanceTotals = {
  leads: number;
  bookings: number;
  shows: number;
  noShows: number;
  pendingShows: number;
  bookRate: number | null;
  leadToShowRate: number | null;
  showUpRate: number | null;
  noShowRate: number | null;
};

export type TreatmentPerformanceRow = TreatmentPerformanceTotals & {
  key: string;
  brandId: string;
  brandName: string;
  treatment: string;
  source?: string;
  campaign?: string;
};

export type TreatmentPerformanceOption = {
  value: string;
  label: string;
};

export type TreatmentPerformanceInsight = {
  label: string;
  value: string;
  detail: string;
  tone: "positive" | "attention" | "neutral";
};

export type TreatmentPerformanceSnapshot = {
  filters: TreatmentPerformanceFilters;
  totals: TreatmentPerformanceTotals;
  costs: PerformanceCostSummary;
  treatmentRows: TreatmentPerformanceRow[];
  sourceRows: TreatmentPerformanceRow[];
  brandOptions: TreatmentPerformanceOption[];
  treatmentOptions: TreatmentPerformanceOption[];
  sourceOptions: TreatmentPerformanceOption[];
  campaignOptions: TreatmentPerformanceOption[];
  brandColors: Record<string, string>;
  insights: TreatmentPerformanceInsight[];
  trendSeries: PerformanceTrendSeries[];
  trendSeriesCount: number;
  trendSeriesShown: number;
  sourceStatus: string;
  sourceName: string;
  lastSuccessAt: string | null;
  schemaReady: boolean;
  warnings: string[];
};

type TreatmentMetricFact = {
  brand_id: string;
  brand_label: string;
  metric_date: string;
  metric_kind: "lead" | "book" | "show" | "no_show" | "pending_show";
  treatment_label: string;
  source_label: string;
  campaign_label: string;
  branch_label: string;
  metric_count: number | string;
};

type TreatmentDataSource = {
  id: string;
  display_name: string;
  status: string;
  last_success_at: string | null;
  configuration: Record<string, unknown> | null;
};

type BrandColorRow = {
  id: string;
  name: string;
  primary_color: string | null;
};

const treatmentSorts = new Set<TreatmentPerformanceSort>([
  "leads",
  "book_rate",
  "shows",
  "show_up_rate",
  "no_show_rate",
]);

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function addIsoDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function cleanFilter(value: unknown, maxLength = 180) {
  return typeof value === "string"
    ? value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

export function normalizeTreatmentPerformanceFilters(input: {
  startDate?: unknown;
  endDate?: unknown;
  brandId?: unknown;
  treatment?: unknown;
  source?: unknown;
  campaign?: unknown;
  sort?: unknown;
}): TreatmentPerformanceFilters {
  const month = getHkMonthContext();
  let startDate = cleanFilter(input.startDate);
  let endDate = cleanFilter(input.endDate);
  if (!isIsoDate(startDate)) startDate = month.monthStart;
  if (!isIsoDate(endDate)) endDate = month.monthEnd;
  if (startDate > endDate) {
    [startDate, endDate] = [endDate, startDate];
  }
  if (addIsoDays(startDate, 366) < endDate) {
    startDate = addIsoDays(endDate, -366);
  }

  const requestedSort = cleanFilter(input.sort) as TreatmentPerformanceSort;
  return {
    startDate,
    endDate,
    brandId: cleanFilter(input.brandId, 80),
    treatment: cleanFilter(input.treatment),
    source: cleanFilter(input.source),
    campaign: cleanFilter(input.campaign),
    sort: treatmentSorts.has(requestedSort) ? requestedSort : "leads",
  };
}

function numeric(value: number | string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}

function withRates(
  metrics: Omit<
    TreatmentPerformanceTotals,
    "bookRate" | "leadToShowRate" | "showUpRate" | "noShowRate"
  >
): TreatmentPerformanceTotals {
  return {
    ...metrics,
    bookRate: ratio(metrics.bookings, metrics.leads),
    leadToShowRate: ratio(metrics.shows, metrics.leads),
    showUpRate: ratio(metrics.shows, metrics.bookings),
    noShowRate: ratio(metrics.noShows, metrics.bookings),
  };
}

function emptyCounts() {
  return {
    leads: 0,
    bookings: 0,
    shows: 0,
    noShows: 0,
    pendingShows: 0,
  };
}

function addFact(
  counts: ReturnType<typeof emptyCounts>,
  fact: TreatmentMetricFact
) {
  const value = Math.max(0, numeric(fact.metric_count));
  if (fact.metric_kind === "lead") counts.leads += value;
  if (fact.metric_kind === "book") counts.bookings += value;
  if (fact.metric_kind === "show") counts.shows += value;
  if (fact.metric_kind === "no_show") counts.noShows += value;
  if (fact.metric_kind === "pending_show") counts.pendingShows += value;
}

function buildRows(
  facts: TreatmentMetricFact[],
  group: "treatment" | "source"
): TreatmentPerformanceRow[] {
  const groups = new Map<
    string,
    {
      brandId: string;
      brandName: string;
      treatment: string;
      source?: string;
      campaign?: string;
      counts: ReturnType<typeof emptyCounts>;
    }
  >();

  for (const fact of facts) {
    const key =
      group === "treatment"
        ? JSON.stringify([fact.brand_id, fact.treatment_label])
        : JSON.stringify([
            fact.brand_id,
            fact.treatment_label,
            fact.source_label,
            fact.campaign_label,
          ]);
    const current =
      groups.get(key) ??
      {
        brandId: fact.brand_id,
        brandName: fact.brand_label,
        treatment: fact.treatment_label,
        source: group === "source" ? fact.source_label : undefined,
        campaign: group === "source" ? fact.campaign_label : undefined,
        counts: emptyCounts(),
      };
    addFact(current.counts, fact);
    groups.set(key, current);
  }

  return Array.from(groups, ([key, row]) => ({
    key,
    brandId: row.brandId,
    brandName: row.brandName,
    treatment: row.treatment,
    source: row.source,
    campaign: row.campaign,
    ...withRates(row.counts),
  }));
}

function nullableSortValue(value: number | null) {
  return value ?? -1;
}

function sortTreatmentRows(
  rows: TreatmentPerformanceRow[],
  sort: TreatmentPerformanceSort
) {
  return [...rows].sort((left, right) => {
    const difference =
      sort === "book_rate"
        ? nullableSortValue(right.bookRate) - nullableSortValue(left.bookRate)
        : sort === "shows"
          ? right.shows - left.shows
          : sort === "show_up_rate"
            ? nullableSortValue(right.showUpRate) -
              nullableSortValue(left.showUpRate)
            : sort === "no_show_rate"
              ? nullableSortValue(right.noShowRate) -
                nullableSortValue(left.noShowRate)
              : right.leads - left.leads;
    return (
      difference ||
      right.leads - left.leads ||
      left.treatment.localeCompare(right.treatment, "zh-HK")
    );
  });
}

function uniqueOptions(
  values: Array<{ value: string; label?: string }>
): TreatmentPerformanceOption[] {
  const map = new Map<string, string>();
  for (const item of values) {
    if (item.value && !map.has(item.value)) {
      map.set(item.value, item.label || item.value);
    }
  }
  return Array.from(map, ([value, label]) => ({ value, label })).sort(
    (left, right) => left.label.localeCompare(right.label, "zh-HK")
  );
}

function percentLabel(value: number | null) {
  return value === null
    ? "—"
    : new Intl.NumberFormat("zh-HK", {
        style: "percent",
        maximumFractionDigits: 1,
      }).format(value);
}

function buildInsights(
  totals: TreatmentPerformanceTotals,
  treatmentRows: TreatmentPerformanceRow[],
  facts: TreatmentMetricFact[]
): TreatmentPerformanceInsight[] {
  const reliableRows = treatmentRows.filter((row) => row.leads >= 5);
  const bestBooking = [...reliableRows].sort(
    (left, right) =>
      nullableSortValue(right.bookRate) - nullableSortValue(left.bookRate) ||
      right.bookings - left.bookings
  )[0];
  const weakestBooking = [...reliableRows]
    .filter((row) => row.leads >= 10)
    .sort(
      (left, right) =>
        nullableSortValue(left.bookRate) - nullableSortValue(right.bookRate) ||
        right.leads - left.leads
    )[0];
  const untrackedLeads = facts
    .filter(
      (fact) =>
        fact.metric_kind === "lead" &&
        (fact.source_label.includes("未標記") ||
          fact.source_label.includes("無追蹤"))
    )
    .reduce((sum, fact) => sum + numeric(fact.metric_count), 0);

  return [
    bestBooking
      ? {
          label: "預約轉化較強",
          value: bestBooking.treatment,
          detail: `${bestBooking.bookings} 個 Book · ${percentLabel(
            bestBooking.bookRate
          )} 預約率（至少 5 Leads）`,
          tone: "positive",
        }
      : {
          label: "預約轉化",
          value: "等待更多樣本",
          detail: "每個療程累積至少 5 個 Leads 後先比較，避免細樣本誤導。",
          tone: "neutral",
        },
    weakestBooking
      ? {
          label: "值得優先檢查",
          value: weakestBooking.treatment,
          detail: `${weakestBooking.leads} 個 Leads · ${percentLabel(
            weakestBooking.bookRate
          )} 預約率，可先檢查素材承諾與 CS 接法。`,
          tone: "attention",
        }
      : {
          label: "優化訊號",
          value: "未有明顯弱項",
          detail: "需有至少 10 個 Leads 先標示低預約率療程。",
          tone: "neutral",
        },
    {
      label: "待到店機會",
      value: totals.pendingShows.toLocaleString("zh-HK"),
      detail: "預約日期落喺目前篩選期間、而狀態仍為已預約。",
      tone: totals.pendingShows > 0 ? "positive" : "neutral",
    },
    {
      label: "直接／未追蹤",
      value: percentLabel(ratio(untrackedLeads, totals.leads)),
      detail: "只反映來源欄標示，唔會將所有 Direct 自動判定為追蹤遺失。",
      tone:
        totals.leads > 0 && untrackedLeads / totals.leads >= 0.2
          ? "attention"
          : "neutral",
    },
  ];
}

function fixtureFacts(filters: TreatmentPerformanceFilters): TreatmentMetricFact[] {
  const date = filters.startDate;
  const make = (
    brandId: string,
    brand: string,
    treatment: string,
    source: string,
    campaign: string,
    kind: TreatmentMetricFact["metric_kind"],
    count: number
  ): TreatmentMetricFact => ({
    brand_id: brandId,
    brand_label: brand,
    metric_date: date,
    metric_kind: kind,
    treatment_label: treatment,
    source_label: source,
    campaign_label: campaign,
    branch_label: "測試分店",
    metric_count: count,
  });
  return [
    make(
      "alyssa-brand",
      "Alyssa",
      "$988 Facelift",
      "Facebook Lead Form",
      "Facelift-yanyan-lead-form",
      "lead",
      42
    ),
    make(
      "alyssa-brand",
      "Alyssa",
      "$988 Facelift",
      "Facebook Lead Form",
      "Facelift-yanyan-lead-form",
      "book",
      9
    ),
    make(
      "alyssa-brand",
      "Alyssa",
      "$988 Facelift",
      "Facebook Lead Form",
      "Facelift-yanyan-lead-form",
      "show",
      5
    ),
    make(
      "ib-brand",
      "Ineffable Beauty",
      "$388 柔清舒敏護理",
      "WhatsApp 廣告",
      "CTWA / 手動新增",
      "lead",
      28
    ),
    make(
      "ib-brand",
      "Ineffable Beauty",
      "$388 柔清舒敏護理",
      "WhatsApp 廣告",
      "CTWA / 手動新增",
      "book",
      7
    ),
    make(
      "ib-brand",
      "Ineffable Beauty",
      "$388 柔清舒敏護理",
      "WhatsApp 廣告",
      "CTWA / 手動新增",
      "show",
      4
    ),
    make(
      "ib-brand",
      "Ineffable Beauty",
      "$388 柔清舒敏護理",
      "WhatsApp 廣告",
      "CTWA / 手動新增",
      "no_show",
      2
    ),
    make(
      "ib-brand",
      "Ineffable Beauty",
      "$388 柔清舒敏護理",
      "WhatsApp 廣告",
      "CTWA / 手動新增",
      "pending_show",
      1
    ),
  ];
}

async function fetchFacts(input: {
  dataSourceId: string;
  startDate: string;
  endDate: string;
  allowedBrandIds: string[] | null;
}) {
  const supabase = createSupabaseAdminClient();
  const pageSize = 1000;
  const rows: TreatmentMetricFact[] = [];
  for (let offset = 0; offset < 50_000; offset += pageSize) {
    let query = supabase
      .from("marketing_treatment_performance_daily")
      .select(
        "brand_id,brand_label,metric_date,metric_kind,treatment_label,source_label,campaign_label,branch_label,metric_count"
      )
      .eq("data_source_id", input.dataSourceId)
      .gte("metric_date", input.startDate)
      .lte("metric_date", input.endDate)
      .order("metric_date", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (input.allowedBrandIds !== null) {
      query = query.in("brand_id", input.allowedBrandIds);
    }
    const { data, error } = await query;
    if (error) throw error;
    const page = (data ?? []) as TreatmentMetricFact[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

function buildSnapshot(input: {
  filters: TreatmentPerformanceFilters;
  facts: TreatmentMetricFact[];
  brands: BrandColorRow[];
  source: TreatmentDataSource | null;
  schemaReady: boolean;
  analysisReady?: boolean;
  warnings?: string[];
  annotations?: OperationalAnnotation[];
  spendFacts?: DailySpendFact[];
}): TreatmentPerformanceSnapshot {
  const brandOptions = uniqueOptions(
    input.brands.map((brand) => ({
      value: brand.id,
      label: brand.name,
    }))
  );
  const treatmentOptions = uniqueOptions(
    input.facts.map((fact) => ({ value: fact.treatment_label }))
  );
  const sourceOptions = uniqueOptions(
    input.facts.map((fact) => ({ value: fact.source_label }))
  );
  const campaignOptions = uniqueOptions(
    input.facts.map((fact) => ({ value: fact.campaign_label }))
  );
  const filteredFacts = input.facts.filter((fact) => {
    if (input.filters.brandId && fact.brand_id !== input.filters.brandId) {
      return false;
    }
    if (
      input.filters.treatment &&
      fact.treatment_label !== input.filters.treatment
    ) {
      return false;
    }
    if (input.filters.source && fact.source_label !== input.filters.source) {
      return false;
    }
    if (
      input.filters.campaign &&
      fact.campaign_label !== input.filters.campaign
    ) {
      return false;
    }
    return true;
  });
  const totalCounts = emptyCounts();
  filteredFacts.forEach((fact) => addFact(totalCounts, fact));
  const totals = withRates(totalCounts);
  const selectedBrandIds = input.filters.brandId
    ? input.brands
        .filter((brand) => brand.id === input.filters.brandId)
        .map((brand) => brand.id)
    : input.brands.map((brand) => brand.id);
  const costs = calculatePerformanceCostSummary({
    spendFacts: input.spendFacts ?? [],
    selectedBrandIds,
    leads: totals.leads,
    bookings: totals.bookings,
    shows: totals.shows,
    attributable: !(
      input.filters.treatment ||
      input.filters.source ||
      input.filters.campaign
    ),
  });
  const treatmentRows = sortTreatmentRows(
    buildRows(filteredFacts, "treatment"),
    input.filters.sort
  );
  const sourceRows = buildRows(filteredFacts, "source").sort(
    (left, right) =>
      right.leads - left.leads ||
      right.bookings - left.bookings ||
      right.shows - left.shows
  );
  const trend = buildDailyTreatmentTrend({
    facts: filteredFacts.map(
      (fact): TreatmentTrendFact => ({
        brandId: fact.brand_id,
        brandName: fact.brand_label,
        metricDate: fact.metric_date,
        metricKind: fact.metric_kind,
        treatmentLabel: fact.treatment_label,
        metricCount: numeric(fact.metric_count),
      })
    ),
    annotations: input.annotations ?? [],
    startDate: input.filters.startDate,
    endDate: input.filters.endDate,
    brandColors: Object.fromEntries(
      input.brands.map((brand) => [
        brand.id,
        brand.primary_color || "#5a2348",
      ])
    ),
    maxSeries: input.filters.treatment ? 1 : 6,
  });

  return {
    filters: input.filters,
    totals,
    costs,
    treatmentRows,
    sourceRows,
    brandOptions,
    treatmentOptions,
    sourceOptions,
    campaignOptions,
    brandColors: Object.fromEntries(
      input.brands.map((brand) => [
        brand.id,
        brand.primary_color || "#5a2348",
      ])
    ),
    insights: buildInsights(totals, treatmentRows, filteredFacts),
    trendSeries: trend.series,
    trendSeriesCount: trend.totalSeriesCount,
    trendSeriesShown: trend.shownSeriesCount,
    sourceStatus:
      input.source?.status === "connected" && input.analysisReady === false
        ? "warning"
        : input.source?.status || "draft",
    sourceName: input.source?.display_name || "Lead Sheet",
    lastSuccessAt: input.source?.last_success_at || null,
    schemaReady: input.schemaReady,
    warnings: input.warnings ?? [],
  };
}

export async function getTreatmentPerformanceSnapshot(
  requestedFilters: Parameters<typeof normalizeTreatmentPerformanceFilters>[0]
): Promise<TreatmentPerformanceSnapshot> {
  const filters = normalizeTreatmentPerformanceFilters(requestedFilters);
  const access = await getCurrentInternalAccess();
  const allowedBrandIds =
    access.source === "supabase_auth" && access.accessLevel !== "master"
      ? access.brandIds ?? []
      : null;

  if (!hasSupabaseAdminEnv()) {
    const facts =
      process.env.ALYSSA_E2E_FIXTURES === "1" ? fixtureFacts(filters) : [];
    const fixtureBrands: BrandColorRow[] = [
      { id: "alyssa-brand", name: "Alyssa", primary_color: "#5a2348" },
      {
        id: "ib-brand",
        name: "Ineffable Beauty",
        primary_color: "#69C7E8",
      },
    ];
    const annotations = await getOperationalAnnotations({
      startDate: filters.startDate,
      endDate: filters.endDate,
      brands: fixtureBrands.map((brand) => ({
        id: brand.id,
        name: brand.name,
        color: brand.primary_color || "#5a2348",
      })),
    });
    const spendFacts: DailySpendFact[] = [
      {
        brandId: "alyssa-brand",
        spendDate: filters.startDate,
        amount: 1_200,
      },
      { brandId: "ib-brand", spendDate: filters.startDate, amount: 600 },
    ];
    return buildSnapshot({
      filters,
      facts,
      brands: fixtureBrands,
      source: {
        id: "lead-funnel-fixture",
        display_name: "Alyssa Workspace Lead Funnel",
        status: facts.length > 0 ? "connected" : "draft",
        last_success_at: facts.length > 0 ? new Date().toISOString() : null,
        configuration: { sourceProfile: "alyssa_workspace_lead_funnel" },
      },
      schemaReady: facts.length > 0,
      analysisReady: facts.length > 0,
      annotations,
      spendFacts,
      warnings:
        facts.length > 0
          ? []
          : ["療程成效資料層尚未連接；目前未有可顯示數據。"],
    });
  }

  if (allowedBrandIds !== null && allowedBrandIds.length === 0) {
    return buildSnapshot({
      filters,
      facts: [],
      brands: [],
      source: null,
      schemaReady: true,
      analysisReady: true,
      warnings: ["你目前未獲分配任何品牌嘅療程成效權限。"],
    });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const [sourceResult, brandsResult] = await Promise.all([
      supabase
        .from("marketing_data_sources")
        .select("id,display_name,status,last_success_at,configuration")
        .eq("provider_key", "google_sheets")
        .eq("configuration->>sourceProfile", "alyssa_workspace_lead_funnel")
        .maybeSingle(),
      (() => {
        let query = supabase
          .from("brands")
          .select("id,name,primary_color")
          .order("name", { ascending: true });
        if (allowedBrandIds !== null) {
          query = query.in("id", allowedBrandIds);
        }
        return query;
      })(),
    ]);
    if (sourceResult.error) throw sourceResult.error;
    if (brandsResult.error) throw brandsResult.error;
    const source =
      (sourceResult.data as TreatmentDataSource | null) ?? null;
    const brandRows = (brandsResult.data ?? []) as BrandColorRow[];
    const [facts, analysisPresenceResult, annotations, spendFacts] = source
      ? await Promise.all([
          fetchFacts({
            dataSourceId: source.id,
            startDate: filters.startDate,
            endDate: filters.endDate,
            allowedBrandIds,
          }),
          supabase
            .from("marketing_treatment_performance_daily")
            .select("id")
            .eq("data_source_id", source.id)
            .limit(1)
            .maybeSingle(),
          getOperationalAnnotations({
            startDate: filters.startDate,
            endDate: filters.endDate,
            brands: brandRows.map((brand) => ({
              id: brand.id,
              name: brand.name,
              color: brand.primary_color || "#5a2348",
            })),
          }),
          fetchDailySpendFacts({
            startDate: filters.startDate,
            endDate: filters.endDate,
            allowedBrandIds,
          }),
        ])
      : [
          [],
          { data: null, error: null },
          [] as OperationalAnnotation[],
          await fetchDailySpendFacts({
            startDate: filters.startDate,
            endDate: filters.endDate,
            allowedBrandIds,
          }),
        ];
    if (analysisPresenceResult.error) throw analysisPresenceResult.error;
    const analysisReady = Boolean(analysisPresenceResult.data);

    return buildSnapshot({
      filters,
      facts,
      brands: brandRows,
      source,
      schemaReady: true,
      analysisReady,
      annotations,
      spendFacts,
      warnings:
        !source
          ? ["未找到指定 Lead Sheet 資料來源；療程成效未有可顯示數據。"]
          : !analysisReady
            ? ["療程成效資料層已就緒；請同步一次 Lead Sheet 產生首批成效彙總。"]
            : source.status === "connected"
              ? []
              : ["Lead Sheet 尚未完成成功同步，現有療程成效可能未更新。"],
    });
  } catch (error) {
    console.warn("treatment_performance_snapshot_failed", {
      code:
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : "unknown",
      message: error instanceof Error ? error.message : "unknown",
    });
    return buildSnapshot({
      filters,
      facts: [],
      brands: [],
      source: null,
      schemaReady: false,
      analysisReady: false,
      warnings: ["療程成效資料層尚未完成上線，請先套用 migration 並同步 Lead Sheet。"],
    });
  }
}
