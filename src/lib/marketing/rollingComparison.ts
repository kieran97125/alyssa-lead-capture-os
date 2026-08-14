import "server-only";

import { getConfiguredBrands, type BrandSetting } from "@/lib/data/configuration";
import {
  brandScopeLabel,
  brandsForScope,
  normalizeBrandScope,
} from "@/lib/marketing/brandScope";
import { getHkMonthContext } from "@/lib/marketing/pacing";
import {
  isSpendType,
  type SpendType,
} from "@/lib/marketing/spendTypes";
import {
  reportMetrics,
  reportSpendTotal,
} from "@/lib/reports/metrics";
import type { ReportMetrics } from "@/lib/reports/types";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";

type MetricKind = "lead" | "book" | "show" | "no_show" | "pending_show";

type MetricFact = {
  brandId: string;
  metricDate: string;
  metricKind: MetricKind;
  metricCount: number;
};

type SpendFact = {
  brandId: string;
  spendDate: string;
  spendType: SpendType;
  amount: number;
};

export type RollingComparisonMetricKey =
  | "spend"
  | "leads"
  | "bookings"
  | "shows"
  | "cpl"
  | "costPerBooking"
  | "costPerShow"
  | "bookRate"
  | "showUpRate"
  | "leadToShowRate";

export type RollingComparisonPeriod = {
  startDate: string;
  endDate: string;
  label: string;
  days: number;
};

export type RollingSevenDaySnapshot = {
  brandScope: string;
  brandLabel: string;
  current: RollingComparisonPeriod & { metrics: ReportMetrics };
  previous: RollingComparisonPeriod & { metrics: ReportMetrics };
  changes: Partial<Record<RollingComparisonMetricKey, number | null>>;
  sourceUpdatedAt: string | null;
  schemaReady: boolean;
};

const PAGE_SIZE = 1000;
const rollingMetricKeys: RollingComparisonMetricKey[] = [
  "spend",
  "leads",
  "bookings",
  "shows",
  "cpl",
  "costPerBooking",
  "costPerShow",
  "bookRate",
  "showUpRate",
  "leadToShowRate",
];

function dateAtUtc(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export function shiftIsoDate(value: string, amount: number) {
  const date = dateAtUtc(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function shortDate(value: string) {
  const [, month, day] = value.split("-");
  return `${Number(day)}/${Number(month)}`;
}

function dateRangeLabel(startDate: string, endDate: string) {
  return `${shortDate(startDate)}–${shortDate(endDate)}`;
}

export function getRollingSevenDayPeriods(now = new Date()) {
  const month = getHkMonthContext(now);
  const currentEnd = month.throughDate;
  const currentStart = shiftIsoDate(currentEnd, -6);
  const previousEnd = shiftIsoDate(currentStart, -1);
  const previousStart = shiftIsoDate(previousEnd, -6);
  return {
    current: {
      startDate: currentStart,
      endDate: currentEnd,
      label: dateRangeLabel(currentStart, currentEnd),
      days: 7,
    },
    previous: {
      startDate: previousStart,
      endDate: previousEnd,
      label: dateRangeLabel(previousStart, previousEnd),
      days: 7,
    },
  } satisfies {
    current: RollingComparisonPeriod;
    previous: RollingComparisonPeriod;
  };
}

function finite(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function relativeChange(current: number | null, previous: number | null) {
  if (current === null || previous === null) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / Math.abs(previous);
}

function metricValue(metrics: ReportMetrics, key: RollingComparisonMetricKey) {
  return metrics[key];
}

function aggregatePeriod(
  period: RollingComparisonPeriod,
  metricFacts: MetricFact[],
  spendFacts: SpendFact[]
) {
  const counts = {
    leads: 0,
    bookings: 0,
    shows: 0,
    noShows: 0,
    pendingShows: 0,
  };
  for (const fact of metricFacts) {
    if (fact.metricDate < period.startDate || fact.metricDate > period.endDate) continue;
    if (fact.metricKind === "lead") counts.leads += fact.metricCount;
    if (fact.metricKind === "book") counts.bookings += fact.metricCount;
    if (fact.metricKind === "show") counts.shows += fact.metricCount;
    if (fact.metricKind === "no_show") counts.noShows += fact.metricCount;
    if (fact.metricKind === "pending_show") counts.pendingShows += fact.metricCount;
  }
  const spend = reportSpendTotal(
    spendFacts
      .filter(
        (fact) => fact.spendDate >= period.startDate && fact.spendDate <= period.endDate
      )
      .map((fact) => fact.amount),
    true
  );
  return reportMetrics(counts, spend);
}

function fixtureFacts(brands: BrandSetting[], startDate: string, endDate: string) {
  const metricFacts: MetricFact[] = [];
  const spendFacts: SpendFact[] = [];
  for (
    let date = startDate, index = 0;
    date <= endDate;
    date = shiftIsoDate(date, 1), index += 1
  ) {
    brands.forEach((brand, brandIndex) => {
      const leads = 5 + ((index + brandIndex) % 4);
      const bookings = Math.max(1, Math.round(leads * 0.2));
      const shows = Math.max(0, Math.round(bookings * 0.65));
      metricFacts.push(
        { brandId: brand.id, metricDate: date, metricKind: "lead", metricCount: leads },
        { brandId: brand.id, metricDate: date, metricKind: "book", metricCount: bookings },
        { brandId: brand.id, metricDate: date, metricKind: "show", metricCount: shows }
      );
      spendFacts.push({
        brandId: brand.id,
        spendDate: date,
        spendType: "legacy_unclassified",
        amount: 320 + brandIndex * 75 + index * 11,
      });
    });
  }
  return { metricFacts, spendFacts };
}

async function fetchMetricFacts(input: {
  sourceId: string;
  brandIds: string[];
  startDate: string;
  endDate: string;
}) {
  const supabase = createSupabaseAdminClient();
  const rows: MetricFact[] = [];
  for (let offset = 0; offset < 50_000; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("marketing_treatment_performance_daily")
      .select("brand_id,metric_date,metric_kind,metric_count")
      .eq("data_source_id", input.sourceId)
      .in("brand_id", input.brandIds)
      .gte("metric_date", input.startDate)
      .lte("metric_date", input.endDate)
      .order("metric_date", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as Array<Record<string, unknown>>;
    rows.push(
      ...page.flatMap((row): MetricFact[] => {
        const metricKind = String(row.metric_kind ?? "") as MetricKind;
        if (!["lead", "book", "show", "no_show", "pending_show"].includes(metricKind)) {
          return [];
        }
        return [
          {
            brandId: String(row.brand_id ?? ""),
            metricDate: String(row.metric_date ?? ""),
            metricKind,
            metricCount: finite(row.metric_count),
          },
        ];
      })
    );
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

async function fetchSpendFacts(input: {
  brandIds: string[];
  startDate: string;
  endDate: string;
}) {
  const supabase = createSupabaseAdminClient();
  const rows: SpendFact[] = [];
  for (let offset = 0; offset < 50_000; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("marketing_daily_spend_entries")
      .select("brand_id,spend_date,spend_type,amount")
      .in("brand_id", input.brandIds)
      .gte("spend_date", input.startDate)
      .lte("spend_date", input.endDate)
      .order("spend_date", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as Array<Record<string, unknown>>;
    rows.push(
      ...page.map((row) => ({
        brandId: String(row.brand_id ?? ""),
        spendDate: String(row.spend_date ?? ""),
        spendType: isSpendType(String(row.spend_type ?? ""))
          ? (String(row.spend_type) as SpendType)
          : "legacy_unclassified",
        amount: finite(row.amount),
      }))
    );
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

async function loadProductionFacts(
  brandIds: string[],
  startDate: string,
  endDate: string
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("marketing_data_sources")
    .select("id,last_success_at")
    .eq("provider_key", "google_sheets")
    .eq("configuration->>sourceProfile", "alyssa_workspace_lead_funnel")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const sourceId = data?.id ? String(data.id) : "";
  const [metricFacts, spendFacts] = await Promise.all([
    sourceId
      ? fetchMetricFacts({ sourceId, brandIds, startDate, endDate })
      : Promise.resolve([]),
    fetchSpendFacts({ brandIds, startDate, endDate }),
  ]);
  return {
    metricFacts,
    spendFacts,
    sourceUpdatedAt:
      typeof data?.last_success_at === "string" ? data.last_success_at : null,
  };
}

export async function getRollingSevenDaySnapshot(
  requestedScope = ""
): Promise<RollingSevenDaySnapshot> {
  const brands = await getConfiguredBrands();
  const normalizedScope = requestedScope
    ? normalizeBrandScope(requestedScope, brands) || requestedScope
    : "";
  const selectedBrands = brandsForScope(brands, normalizedScope);
  const safeBrands = selectedBrands.length > 0 ? selectedBrands : brands;
  const periods = getRollingSevenDayPeriods();
  const startDate = periods.previous.startDate;
  const endDate = periods.current.endDate;
  const facts = hasSupabaseAdminEnv()
    ? await loadProductionFacts(
        safeBrands.map((brand) => brand.id),
        startDate,
        endDate
      )
    : {
        ...fixtureFacts(safeBrands, startDate, endDate),
        sourceUpdatedAt: null,
      };
  const currentMetrics = aggregatePeriod(
    periods.current,
    facts.metricFacts,
    facts.spendFacts
  );
  const previousMetrics = aggregatePeriod(
    periods.previous,
    facts.metricFacts,
    facts.spendFacts
  );
  const changes = Object.fromEntries(
    rollingMetricKeys.map((key) => [
      key,
      relativeChange(
        metricValue(currentMetrics, key),
        metricValue(previousMetrics, key)
      ),
    ])
  ) as Partial<Record<RollingComparisonMetricKey, number | null>>;

  return {
    brandScope: normalizedScope,
    brandLabel: brandScopeLabel(brands, normalizedScope),
    current: { ...periods.current, metrics: currentMetrics },
    previous: { ...periods.previous, metrics: previousMetrics },
    changes,
    sourceUpdatedAt: facts.sourceUpdatedAt,
    schemaReady: hasSupabaseAdminEnv(),
  };
}
