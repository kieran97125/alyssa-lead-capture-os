from __future__ import annotations

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8")


def replace_exact(path: str, old: str, new: str, *, count: int = 1) -> None:
    content = read(path)
    actual = content.count(old)
    if actual < count:
        raise RuntimeError(f"{path}: expected at least {count} occurrence(s), found {actual}: {old[:120]!r}")
    content = content.replace(old, new, count)
    write(path, content)


def replace_all(path: str, old: str, new: str, *, minimum: int = 1) -> None:
    content = read(path)
    actual = content.count(old)
    if actual < minimum:
        raise RuntimeError(f"{path}: expected at least {minimum} occurrence(s), found {actual}: {old[:120]!r}")
    write(path, content.replace(old, new))


def replace_regex(path: str, pattern: str, replacement: str, *, count: int = 1, flags: int = 0) -> None:
    content = read(path)
    updated, actual = re.subn(pattern, replacement, content, count=count, flags=flags)
    if actual != count:
        raise RuntimeError(f"{path}: expected {count} regex replacement(s), got {actual}: {pattern[:120]!r}")
    write(path, updated)


# Shared trend math.
path = "src/lib/marketing/performanceTrend.ts"
replace_exact(
    path,
    "export type PerformanceTrendBaseMetrics = {\n  spend: number;\n  leads: number;",
    "export type PerformanceTrendBaseMetrics = {\n  spend: number;\n  spendRecorded?: boolean;\n  leads: number;",
)
replace_exact(
    path,
    "export type PerformanceTrendPoint = PerformanceTrendBaseMetrics & {\n  day: number;",
    "export type PerformanceTrendPoint = Omit<\n  PerformanceTrendBaseMetrics,\n  \"spendRecorded\"\n> & {\n  spendRecorded: boolean;\n  day: number;",
)
replace_exact(
    path,
    "export const brandTrendMetricKeys: PerformanceTrendMetricKey[] = [",
    "export const costTrendMetricKeys: PerformanceTrendMetricKey[] = [\n  \"cpl\",\n  \"costPerBooking\",\n  \"costPerShow\",\n];\n\nexport const brandTrendMetricKeys: PerformanceTrendMetricKey[] = [",
)
replace_exact(
    path,
    "  return {\n    spend: 0,\n    leads: 0,",
    "  return {\n    spend: 0,\n    spendRecorded: false,\n    leads: 0,",
)
replace_exact(
    path,
    "    cumulative.spend += finiteNonNegative(point.spend);\n    cumulative.leads += finiteNonNegative(point.leads);",
    "    cumulative.spend += finiteNonNegative(point.spend);\n    cumulative.spendRecorded =\n      Boolean(cumulative.spendRecorded) || point.spendRecorded;\n    cumulative.leads += finiteNonNegative(point.leads);",
)
replace_exact(
    path,
    "  const spend = finiteNonNegative(input.spend);\n  const leads = finiteNonNegative(input.leads);",
    "  const spend = finiteNonNegative(input.spend);\n  const spendRecorded = input.spendRecorded ?? true;\n  const leads = finiteNonNegative(input.leads);",
)
replace_exact(path, "    spend,\n    leads,", "    spend,\n    spendRecorded,\n    leads,")
replace_exact(
    path,
    "    cpl: safeRatio(spend, leads),\n    costPerBooking: safeRatio(spend, bookings),\n    costPerShow: safeRatio(spend, shows),",
    "    cpl: spendRecorded ? safeRatio(spend, leads) : null,\n    costPerBooking: spendRecorded ? safeRatio(spend, bookings) : null,\n    costPerShow: spendRecorded ? safeRatio(spend, shows) : null,",
)
replace_exact(
    path,
    "function isoDates(startDate: string, endDate: string) {",
    '''export type PerformanceTrendSpendFact = {
  brandId: string;
  spendDate: string;
  amount: number;
};

function spendFactKey(brandId: string, spendDate: string) {
  return `${brandId}:${spendDate}`;
}

export function attachDailySpendToPerformanceTrendSeries(input: {
  series: PerformanceTrendSeries[];
  spendFacts: PerformanceTrendSpendFact[];
  attributable?: boolean;
}) {
  if (input.attributable === false) return input.series;

  const spendByBrandDate = new Map<string, number>();
  for (const fact of input.spendFacts) {
    const key = spendFactKey(fact.brandId, fact.spendDate);
    spendByBrandDate.set(
      key,
      (spendByBrandDate.get(key) ?? 0) + finiteNonNegative(fact.amount)
    );
  }

  return input.series.map((item): PerformanceTrendSeries => ({
    ...item,
    points: item.points.map((point) => {
      const key = item.brandId
        ? spendFactKey(item.brandId, point.date)
        : "";
      const spendRecorded = Boolean(key && spendByBrandDate.has(key));
      return calculatePerformanceTrendPoint(
        {
          spend: spendRecorded ? spendByBrandDate.get(key) ?? 0 : 0,
          spendRecorded,
          leads: point.leads,
          bookings: point.bookings,
          shows: point.shows,
          noShows: point.noShows,
          pendingShows: point.pendingShows,
        },
        {
          day: point.day,
          date: point.date,
          annotations: point.annotations,
        }
      );
    }),
  }));
}

export function buildDailyBrandTrendFromTreatmentFacts(input: {
  facts: TreatmentTrendFact[];
  annotations: OperationalAnnotation[];
  startDate: string;
  endDate: string;
  brands: Array<{ id: string; name: string; color: string }>;
}) {
  const factsByBrandDate = new Map<string, TreatmentTrendFact[]>();
  for (const fact of input.facts) {
    const key = spendFactKey(fact.brandId, fact.metricDate);
    factsByBrandDate.set(key, [
      ...(factsByBrandDate.get(key) ?? []),
      fact,
    ]);
  }
  const dates = isoDates(input.startDate, input.endDate);
  return input.brands.map((brand): PerformanceTrendSeries => ({
    key: `brand-cost:${brand.id}`,
    label: brand.name,
    color: brand.color,
    brandId: brand.id,
    points: dates.map((date, dateIndex) => {
      const base = emptyPerformanceTrendBase();
      for (const fact of factsByBrandDate.get(spendFactKey(brand.id, date)) ?? []) {
        addFactToBase(base, fact);
      }
      return calculatePerformanceTrendPoint(base, {
        day: dateIndex + 1,
        date,
        annotations: input.annotations.filter(
          (annotation) =>
            annotation.date === date && annotation.brandId === brand.id
        ),
      });
    }),
  }));
}

function isoDates(startDate: string, endDate: string) {''',
)

# Dashboard trend enrichment.
path = "src/lib/marketing/leadDashboardMath.ts"
replace_exact(
    path,
    "  calculatePerformanceTrendPoint,\n  emptyPerformanceTrendBase,\n  type PerformanceTrendSeries,",
    "  attachDailySpendToPerformanceTrendSeries,\n  calculatePerformanceTrendPoint,\n  emptyPerformanceTrendBase,\n  type PerformanceTrendSeries,\n  type PerformanceTrendSpendFact,",
)
replace_exact(
    path,
    "  annotations: OperationalAnnotation[];\n}): PerformanceTrendSeries[] {",
    "  annotations: OperationalAnnotation[];\n  spendFacts?: PerformanceTrendSpendFact[];\n  costAttributable?: boolean;\n}): PerformanceTrendSeries[] {",
)
replace_exact(path, "  return seriesBrands.map((brand) => {", "  const series = seriesBrands.map((brand) => {")
replace_exact(
    path,
    "  });\n}\n\nfunction ratio(numerator: number, denominator: number) {",
    "  });\n\n  return attachDailySpendToPerformanceTrendSeries({\n    series,\n    spendFacts: input.spendFacts ?? [],\n    attributable: input.costAttributable !== false,\n  });\n}\n\nfunction ratio(numerator: number, denominator: number) {",
)

path = "src/lib/marketing/leadDashboard.ts"
replace_all(
    path,
    "      annotations,\n    }),",
    "      annotations,\n      spendFacts,\n      costAttributable: !filters.treatment,\n    }),",
    minimum=2,
)

# Treatment cost series.
path = "src/lib/marketing/treatmentPerformance.ts"
replace_exact(
    path,
    "  buildDailyTreatmentTrend,\n  type PerformanceTrendSeries,",
    "  attachDailySpendToPerformanceTrendSeries,\n  buildDailyBrandTrendFromTreatmentFacts,\n  buildDailyTreatmentTrend,\n  type PerformanceTrendSeries,",
)
replace_exact(
    path,
    "  trendSeries: PerformanceTrendSeries[];\n  trendSeriesCount: number;",
    "  trendSeries: PerformanceTrendSeries[];\n  costTrendSeries: PerformanceTrendSeries[];\n  trendSeriesCount: number;",
)
replace_exact(
    path,
    "  const trend = buildDailyTreatmentTrend({\n    facts: filteredFacts.map(\n      (fact): TreatmentTrendFact => ({\n        brandId: fact.brand_id,\n        brandName: fact.brand_label,\n        metricDate: fact.metric_date,\n        metricKind: fact.metric_kind,\n        treatmentLabel: fact.treatment_label,\n        metricCount: numeric(fact.metric_count),\n      })\n    ),",
    "  const trendFacts = filteredFacts.map(\n    (fact): TreatmentTrendFact => ({\n      brandId: fact.brand_id,\n      brandName: fact.brand_label,\n      metricDate: fact.metric_date,\n      metricKind: fact.metric_kind,\n      treatmentLabel: fact.treatment_label,\n      metricCount: numeric(fact.metric_count),\n    })\n  );\n  const trend = buildDailyTreatmentTrend({\n    facts: trendFacts,",
)
replace_exact(
    path,
    "    maxSeries: input.filters.treatment ? 1 : 6,\n  });\n\n  return {",
    "    maxSeries: input.filters.treatment ? 1 : 6,\n  });\n  const costAttributable = !(\n    input.filters.treatment ||\n    input.filters.source ||\n    input.filters.campaign\n  );\n  const costTrendSeries = attachDailySpendToPerformanceTrendSeries({\n    series: buildDailyBrandTrendFromTreatmentFacts({\n      facts: trendFacts,\n      annotations: input.annotations ?? [],\n      startDate: input.filters.startDate,\n      endDate: input.filters.endDate,\n      brands: brandsForScope(input.brands, input.filters.brandId).map(\n        (brand) => ({\n          id: brand.id,\n          name: brand.name,\n          color: brand.primary_color || \"#5a2348\",\n        })\n      ),\n    }),\n    spendFacts: input.spendFacts ?? [],\n    attributable: costAttributable,\n  });\n\n  return {",
)
replace_exact(path, "    trendSeries: trend.series,\n    trendSeriesCount:", "    trendSeries: trend.series,\n    costTrendSeries,\n    trendSeriesCount:")

# Shared chart controls and cost ownership states.
path = "src/components/command-center/TreatmentPerformanceTrendChart.tsx"
replace_exact(
    path,
    "  performanceTrendPointsForMode,\n  treatmentTrendMetricKeys,\n  type PerformanceTrendMetricKey,",
    "  costTrendMetricKeys,\n  performanceTrendPointsForMode,\n  type PerformanceTrendMetricKey,",
)
replace_exact(
    path,
    "} from \"@/lib/marketing/performanceTrend\";",
    "} from \"@/lib/marketing/performanceTrend\";\nimport type { PerformanceCostAvailability } from \"@/lib/marketing/performanceCostMath\";",
)
replace_exact(
    path,
    "  { key: \"pendingShows\", label: \"待到店\", compactLabel: \"待到店\" },\n  { key: \"leadToBookRate\",",
    "  { key: \"pendingShows\", label: \"待到店\", compactLabel: \"待到店\" },\n  { key: \"cpl\", label: \"每個 Lead 成本\", compactLabel: \"CPLead\" },\n  { key: \"costPerBooking\", label: \"每個 Book 成本\", compactLabel: \"CPBook\" },\n  { key: \"costPerShow\", label: \"每個 Show 成本\", compactLabel: \"CPShow\" },\n  { key: \"leadToBookRate\",",
)
replace_exact(path, "const rateMetrics = new Set<PerformanceTrendMetricKey>([", "const currencyMetrics = new Set<PerformanceTrendMetricKey>(\n  costTrendMetricKeys\n);\nconst rateMetrics = new Set<PerformanceTrendMetricKey>([")
replace_exact(
    path,
    "  if (rateMetrics.has(metric)) {",
    "  if (currencyMetrics.has(metric)) {\n    return new Intl.NumberFormat(\"zh-HK\", {\n      style: \"currency\",\n      currency: \"HKD\",\n      maximumFractionDigits: 0,\n    }).format(value);\n  }\n  if (rateMetrics.has(metric)) {",
)
replace_exact(
    path,
    "export function TreatmentPerformanceTrendChart({\n  series,\n  defaultMode = \"daily\",\n  preferenceKey = \"treatment-performance\",\n}: {\n  series: PerformanceTrendSeries[];\n  defaultMode?: PerformanceTrendMode;\n  preferenceKey?: string;\n}) {",
    "export function TreatmentPerformanceTrendChart({\n  series,\n  costSeries = series,\n  costAvailability,\n  defaultMode = \"daily\",\n  preferenceKey = \"treatment-performance\",\n}: {\n  series: PerformanceTrendSeries[];\n  costSeries?: PerformanceTrendSeries[];\n  costAvailability?: PerformanceCostAvailability;\n  defaultMode?: PerformanceTrendMode;\n  preferenceKey?: string;\n}) {",
)
replace_exact(
    path,
    "  const selectedMetric =\n    metricOptions.find((option) => option.key === metric) ?? metricOptions[0];\n  const available = new Set(treatmentTrendMetricKeys);\n  const chartData = useMemo(() => {\n    const displaySeries = series.map((item) => ({",
    "  const selectedMetric =\n    metricOptions.find((option) => option.key === metric) ?? metricOptions[0];\n  const isCostMetric = currencyMetrics.has(metric);\n  const activeSeries = isCostMetric ? costSeries : series;\n  const resolvedCostAvailability =\n    costAvailability ??\n    (costSeries.some((item) =>\n      item.points.some((point) => point.spendRecorded)\n    )\n      ? \"available\"\n      : \"missing\");\n  const costUnavailable =\n    isCostMetric &&\n    (resolvedCostAvailability === \"missing\" ||\n      resolvedCostAvailability === \"unallocated\");\n  const costCoverage = useMemo(() => {\n    const points = costSeries.flatMap((item) => item.points);\n    return {\n      recorded: points.filter((point) => point.spendRecorded).length,\n      expected: points.length,\n    };\n  }, [costSeries]);\n  const chartData = useMemo(() => {\n    const displaySeries = activeSeries.map((item) => ({",
)
replace_exact(path, "  }, [metric, mode, series]);", "  }, [activeSeries, metric, mode]);")
replace_exact(
    path,
    "        {metricOptions\n          .filter((option) => available.has(option.key))\n          .map((option) => (",
    "        {metricOptions.map((option) => (",
)
replace_exact(
    path,
    "          ))}\n      </div>\n      <div\n        className=\"period-chart-canvas\"",
    "          ))}\n      </div>\n      {isCostMetric ? (\n        <p className=\"treatment-trend-note\" data-testid=\"trend-cost-coverage\">\n          {resolvedCostAvailability === \"unallocated\"\n            ? \"現有廣告費只屬品牌層；療程、來源或 Campaign 篩選下不會推算成本。\"\n            : resolvedCostAvailability === \"missing\"\n              ? \"所選期間未有廣告費記錄，暫未能計算 CPLead／CPBook／CPShow。\"\n              : resolvedCostAvailability === \"partial\"\n                ? `只顯示已記錄嘅品牌成本；已覆蓋 ${costCoverage.recorded}/${costCoverage.expected} 個品牌日。`\n                : `按已記錄廣告費重新計算；已覆蓋 ${costCoverage.recorded}/${costCoverage.expected} 個品牌日，未記錄日顯示空白。`}\n        </p>\n      ) : null}\n      {costUnavailable ? (\n        <div\n          className=\"period-chart-canvas period-chart-loading\"\n          role=\"status\"\n          data-testid=\"trend-cost-unavailable\"\n        >\n          {resolvedCostAvailability === \"unallocated\"\n            ? \"成本未分配到目前篩選維度；清除療程、來源或 Campaign 篩選後查看品牌成本走勢。\"\n            : \"未有足夠廣告費記錄繪製成本走勢。\"}\n        </div>\n      ) : (\n      <div\n        className=\"period-chart-canvas\"",
)
replace_exact(path, "            {series.map((item, index) => (", "            {activeSeries.map((item, index) => (")
replace_exact(path, "      </div>\n    </div>\n  );\n}", "      </div>\n      )}\n    </div>\n  );\n}")

# Lazy boundaries and callers.
path = "src/components/command-center/LeadDashboardTrendChartLazy.tsx"
replace_exact(path, "import type { PerformanceTrendSeries } from \"@/lib/marketing/performanceTrend\";", "import type { PerformanceTrendSeries } from \"@/lib/marketing/performanceTrend\";\nimport type { PerformanceCostAvailability } from \"@/lib/marketing/performanceCostMath\";")
replace_exact(path, "export function LeadDashboardTrendChartLazy({\n  series,\n}: {\n  series: PerformanceTrendSeries[];\n}) {", "export function LeadDashboardTrendChartLazy({\n  series,\n  costAvailability,\n}: {\n  series: PerformanceTrendSeries[];\n  costAvailability: PerformanceCostAvailability;\n}) {")
replace_exact(path, "      series={series}\n      defaultMode=\"daily\"", "      series={series}\n      costAvailability={costAvailability}\n      defaultMode=\"daily\"")

path = "src/components/command-center/TreatmentPerformanceTrendChartLazy.tsx"
replace_exact(path, "import type { PerformanceTrendSeries } from \"@/lib/marketing/performanceTrend\";", "import type { PerformanceTrendSeries } from \"@/lib/marketing/performanceTrend\";\nimport type { PerformanceCostAvailability } from \"@/lib/marketing/performanceCostMath\";")
replace_exact(path, "export function TreatmentPerformanceTrendChartLazy({\n  series,\n}: {\n  series: PerformanceTrendSeries[];\n}) {", "export function TreatmentPerformanceTrendChartLazy({\n  series,\n  costSeries,\n  costAvailability,\n}: {\n  series: PerformanceTrendSeries[];\n  costSeries: PerformanceTrendSeries[];\n  costAvailability: PerformanceCostAvailability;\n}) {")
replace_exact(path, "      series={series}\n      defaultMode=\"daily\"", "      series={series}\n      costSeries={costSeries}\n      costAvailability={costAvailability}\n      defaultMode=\"daily\"")

path = "src/components/command-center/LeadDashboardPanel.tsx"
replace_exact(path, "        <LeadDashboardTrendChartLazy series={snapshot.trendSeries} />", "        <LeadDashboardTrendChartLazy\n          series={snapshot.trendSeries}\n          costAvailability={snapshot.costs.availability}\n        />")

path = "src/app/performance/page.tsx"
replace_exact(path, "            <TreatmentPerformanceTrendChartLazy series={snapshot.trendSeries} />", "            <TreatmentPerformanceTrendChartLazy\n              series={snapshot.trendSeries}\n              costSeries={snapshot.costTrendSeries}\n              costAvailability={snapshot.costs.availability}\n            />")

# Period comparison naming and missing-spend gaps.
path = "src/components/command-center/PeriodComparisonChart.tsx"
replace_exact(path, '{ key: "cpl", label: "每個 Lead 成本", compactLabel: "CPL" },', '{ key: "cpl", label: "每個 Lead 成本", compactLabel: "CPLead" },')
replace_exact(path, '{ key: "costPerBooking", label: "每個 Book 成本", compactLabel: "CPA · Book" },', '{ key: "costPerBooking", label: "每個 Book 成本", compactLabel: "CPBook" },')
replace_exact(path, '{ key: "costPerShow", label: "每個 Show 成本", compactLabel: "CPA · Show" },', '{ key: "costPerShow", label: "每個 Show 成本", compactLabel: "CPShow" },')

path = "src/lib/marketing/periodComparisonMath.ts"
replace_exact(path, "export type CanonicalComparisonMetricRow = ComparisonBaseMetrics & {\n  brandId: string;", "export type CanonicalComparisonMetricRow = ComparisonBaseMetrics & {\n  spendRecorded?: boolean;\n  brandId: string;")
replace_exact(path, "  const byDate = new Map<string, ComparisonBaseMetrics>();", "  const byDate = new Map<\n    string,\n    ComparisonBaseMetrics & { spendRecorded: boolean }\n  >();")
replace_exact(path, "      shows: 0,\n    };\n    existing.spend += finiteNonNegative(row.spend);", "      shows: 0,\n      spendRecorded: false,\n    };\n    existing.spend += finiteNonNegative(row.spend);\n    existing.spendRecorded ||= row.spendRecorded === true;")
replace_exact(path, "          spend: metric?.spend ?? 0,\n          leads:", "          spend: metric?.spend ?? 0,\n          spendRecorded: metric?.spendRecorded ?? false,\n          leads:")

path = "src/lib/marketing/periodComparison.ts"
replace_all(path, "        spend: entry.amount,\n        leads: 0,", "        spend: entry.amount,\n        spendRecorded: true,\n        leads: 0,", minimum=1)
replace_all(path, "          spend: 0,\n          leads: metric.leads,", "          spend: 0,\n          spendRecorded: false,\n          leads: metric.leads,", minimum=1)
replace_exact(path, "        spend: 180 + brandIndex * 55 + monthIndex * 18 + day * 4,\n        leads:", "        spend: 180 + brandIndex * 55 + monthIndex * 18 + day * 4,\n        spendRecorded: true,\n        leads:")

# Acceptance coverage.
path = "e2e/connected-marketing-ops.spec.ts"
replace_exact(path, "  accumulatePerformanceTrendPoints,\n  calculatePerformanceTrendPoint,", "  accumulatePerformanceTrendPoints,\n  attachDailySpendToPerformanceTrendSeries,\n  calculatePerformanceTrendPoint,")
replace_exact(path, "test(\"Weekly Tasks reuses Calendar module access\", () => {", '''test("cost trend attaches canonical daily spend and keeps missing days null", () => {
  const baseSeries = [
    {
      key: "brand-a",
      label: "Brand A",
      color: "#000000",
      brandId: "brand-a",
      points: [
        calculatePerformanceTrendPoint(
          { spend: 0, spendRecorded: false, leads: 2, bookings: 1, shows: 1, noShows: 0, pendingShows: 0 },
          { day: 1, date: "2026-08-01", annotations: [] }
        ),
        calculatePerformanceTrendPoint(
          { spend: 0, spendRecorded: false, leads: 1, bookings: 0, shows: 0, noShows: 0, pendingShows: 0 },
          { day: 2, date: "2026-08-02", annotations: [] }
        ),
      ],
    },
  ];
  const [series] = attachDailySpendToPerformanceTrendSeries({
    series: baseSeries,
    spendFacts: [{ brandId: "brand-a", spendDate: "2026-08-01", amount: 300 }],
  });
  expect(series.points[0]).toMatchObject({
    spendRecorded: true,
    cpl: 150,
    costPerBooking: 300,
    costPerShow: 300,
  });
  expect(series.points[1]).toMatchObject({
    spendRecorded: false,
    cpl: null,
    costPerBooking: null,
    costPerShow: null,
  });
});

test("Weekly Tasks reuses Calendar module access", () => {''')
replace_exact(path, "  await expect(\n    card.getByRole(\"img\", { name: /Lead單日走勢；橙色圓點代表已連結嘅成效事件/ })\n  ).toBeVisible();", "  await expect(\n    card.getByRole(\"img\", { name: /Lead單日走勢；橙色圓點代表已連結嘅成效事件/ })\n  ).toBeVisible();\n  await expect(card.getByRole(\"button\", { name: \"CPLead\" })).toBeVisible();\n  await expect(card.getByRole(\"button\", { name: \"CPBook\" })).toBeVisible();\n  await expect(card.getByRole(\"button\", { name: \"CPShow\" })).toBeVisible();\n  await card.getByRole(\"button\", { name: \"CPLead\" }).click();\n  await expect(\n    card.getByRole(\"img\", { name: /每個 Lead 成本單日走勢/ })\n  ).toBeVisible();\n  await card.getByRole(\"button\", { name: \"Lead\" }).click();")
replace_exact(path, "  await expect(toggle.getByTestId(\"trend-mode-daily\")).toHaveAttribute(\n    \"aria-pressed\",\n    \"true\"\n  );\n  await toggle.getByTestId(\"trend-mode-cumulative\").click();", "  await expect(toggle.getByTestId(\"trend-mode-daily\")).toHaveAttribute(\n    \"aria-pressed\",\n    \"true\"\n  );\n  await expect(card.getByRole(\"button\", { name: \"CPLead\" })).toBeVisible();\n  await card.getByRole(\"button\", { name: \"CPBook\" }).click();\n  await expect(\n    card.getByRole(\"img\", { name: /每個 Book 成本單日走勢/ })\n  ).toBeVisible();\n  await card.getByRole(\"button\", { name: \"Lead\" }).click();\n  await toggle.getByTestId(\"trend-mode-cumulative\").click();")
replace_exact(path, "  const trendCard = page.locator(\".period-trend-card\");\n  const toggle = trendCard.getByTestId(\"trend-mode-toggle\");", "  const trendCard = page.locator(\".period-trend-card\");\n  await expect(trendCard.getByRole(\"button\", { name: \"CPLead\" })).toBeVisible();\n  await expect(trendCard.getByRole(\"button\", { name: \"CPBook\" })).toBeVisible();\n  await expect(trendCard.getByRole(\"button\", { name: \"CPShow\" })).toBeVisible();\n  const toggle = trendCard.getByTestId(\"trend-mode-toggle\");")

write("e2e/performance-cost-trends.spec.ts", '''import { expect, test } from "@playwright/test";

test("Dashboard CPLead trend is visible and stable", async ({ page }) => {
  await page.goto("/dashboard");
  const card = page.locator(".lead-dashboard-trend-card");
  await card.getByRole("button", { name: "CPLead" }).click();
  await expect(card.getByRole("img", { name: /每個 Lead 成本單日走勢/ })).toBeVisible();
  await expect(card).toHaveScreenshot("dashboard-cplead-trend.png", { animations: "disabled" });
});

test("Treatment CPBook trend uses the brand-owned cost scope", async ({ page }) => {
  await page.goto("/performance");
  const card = page.locator(".treatment-trend-card");
  await card.getByRole("button", { name: "CPBook" }).click();
  await expect(card.getByRole("img", { name: /每個 Book 成本單日走勢/ })).toBeVisible();
  await expect(card.getByTestId("trend-cost-coverage")).toContainText("廣告費");
  await expect(card).toHaveScreenshot("treatment-cpbook-trend.png", { animations: "disabled" });
});

test("Treatment-filtered cost trend refuses to invent spend allocation", async ({ page }) => {
  await page.goto("/performance?treatment=%24988%20Facelift");
  const card = page.locator(".treatment-trend-card");
  await card.getByRole("button", { name: "CPShow" }).click();
  await expect(card.getByTestId("trend-cost-unavailable")).toContainText("成本未分配");
});
''')

write("src/components/command-center/TreatmentPerformanceTrendChart.stories.tsx", '''import type { Meta, StoryObj } from "@storybook/react";
import { TreatmentPerformanceTrendChart } from "./TreatmentPerformanceTrendChart";
import { calculatePerformanceTrendPoint } from "@/lib/marketing/performanceTrend";

const funnelSeries = [
  {
    key: "treatment-a",
    label: "柔清舒敏護理",
    color: "#5A2348",
    brandId: "brand-a",
    points: [
      calculatePerformanceTrendPoint(
        { spend: 0, spendRecorded: false, leads: 8, bookings: 2, shows: 1, noShows: 0, pendingShows: 1 },
        { day: 1, date: "2026-08-01", annotations: [] }
      ),
      calculatePerformanceTrendPoint(
        { spend: 0, spendRecorded: false, leads: 5, bookings: 1, shows: 1, noShows: 0, pendingShows: 0 },
        { day: 2, date: "2026-08-02", annotations: [] }
      ),
    ],
  },
];

const costSeries = [
  {
    key: "brand-a-cost",
    label: "Ineffable Beauty",
    color: "#5A2348",
    brandId: "brand-a",
    points: [
      calculatePerformanceTrendPoint(
        { spend: 800, spendRecorded: true, leads: 8, bookings: 2, shows: 1, noShows: 0, pendingShows: 1 },
        { day: 1, date: "2026-08-01", annotations: [] }
      ),
      calculatePerformanceTrendPoint(
        { spend: 500, spendRecorded: true, leads: 5, bookings: 1, shows: 1, noShows: 0, pendingShows: 0 },
        { day: 2, date: "2026-08-02", annotations: [] }
      ),
    ],
  },
];

const meta = {
  title: "Command Center/Treatment Performance Trend Chart",
  component: TreatmentPerformanceTrendChart,
  parameters: { layout: "fullscreen" },
  args: {
    series: funnelSeries,
    costSeries,
    costAvailability: "available",
  },
} satisfies Meta<typeof TreatmentPerformanceTrendChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FunnelAndCostMetrics: Story = {};

export const CostUnallocated: Story = {
  args: {
    costSeries: [],
    costAvailability: "unallocated",
  },
};
''')

path = "scripts/verify-reporting-trend-contract.mjs"
replace_exact(path, "assert.match(treatmentTrendChart, /preferenceKey/);", "assert.match(treatmentTrendChart, /preferenceKey/);\nassert.match(treatmentTrendChart, /CPLead/);\nassert.match(treatmentTrendChart, /CPBook/);\nassert.match(treatmentTrendChart, /CPShow/);\nassert.match(treatmentTrendChart, /costSeries/);\nassert.match(treatmentTrendChart, /trend-cost-unavailable/);")
replace_exact(path, "assert.match(trendMath, /buildDailyTreatmentTrendPoints/);", "assert.match(trendMath, /buildDailyTreatmentTrendPoints/);\nassert.match(trendMath, /spendRecorded/);\nassert.match(trendMath, /attachDailySpendToPerformanceTrendSeries/);\nassert.match(trendMath, /buildDailyBrandTrendFromTreatmentFacts/);")
replace_exact(path, "assert.match(files[\"src/lib/marketing/leadDashboard.ts\"], /costs:/);", "assert.match(files[\"src/lib/marketing/leadDashboard.ts\"], /costs:/);\nassert.match(files[\"src/lib/marketing/leadDashboard.ts\"], /costAttributable/);")
replace_exact(path, "assert.match(files[\"src/lib/marketing/treatmentPerformance.ts\"], /costs,/);", "assert.match(files[\"src/lib/marketing/treatmentPerformance.ts\"], /costs,/);\nassert.match(files[\"src/lib/marketing/treatmentPerformance.ts\"], /costTrendSeries/);\nassert.match(files[\"src/lib/marketing/treatmentPerformance.ts\"], /costAttributable/);")
replace_exact(path, "Reporting daily/cumulative mode, aggregate-first trend math, per-surface preference, cost metrics, connected events, calendar annotation, and Manager KPI contracts verified.", "Reporting daily/cumulative mode, aggregate-first CPLead/CPBook/CPShow trends, spend-presence gaps, per-surface preference, connected events, calendar annotation, and Manager KPI contracts verified.")

path = "docs/design-system/CHANGELOG.md"
content = read(path)
entry = '''
## 2026-09-02 — Cost-per-funnel trend controls

- Added compact `CPLead`, `CPBook` and `CPShow` controls to the shared performance trend chart.
- Cost mode reuses the existing chart interaction and typography contract; no parallel control system was introduced.
- Missing daily spend renders as an honest gap, while unallocated treatment/source/campaign views explain the boundary instead of displaying a fabricated zero.
- Added Storybook states plus deterministic Dashboard and Treatment Performance visual baselines.
- Rollback: revert the source PR; no database migration is required.
'''
if "Cost-per-funnel trend controls" not in content:
    write(path, content.rstrip() + "\n" + entry)

write("docs/product-learning/entries/2026-09-02-cost-per-funnel-trends.md", '''# Cost-per-funnel trends with explicit spend ownership

## Problem

Performance pages exposed Lead, Book, Show and conversion-rate trends, while CPLead, CPBook and CPShow were only visible as period totals or on selected comparison scopes. Operators could not see when acquisition cost changed during the month. A naive treatment-level implementation would divide brand spend by treatment counts and falsely imply that the spend had been attributed to that treatment.

## Decision

All primary performance trend surfaces expose `CPLead`, `CPBook` and `CPShow` controls. Daily cost points use canonical daily brand spend and the matching daily funnel denominator. Cumulative mode sums spend and funnel numerators first, then recalculates the ratio. Ratios are never added or averaged.

Dashboard lines retain brand ownership. Treatment Performance keeps its treatment lines for funnel metrics but switches to a separate brand-owned series for cost metrics. When a treatment, source or campaign filter is active, the UI keeps the controls discoverable but returns an explicit unallocated state instead of estimating spend. Period Comparison keeps brand/overall cost scopes and uses the same compact naming.

## Guardrails

- An absent spend row is not interpreted as HK$0; the daily cost point is `null` and the line has a visible gap.
- An explicit zero spend row remains a valid recorded value.
- Cumulative cost is recalculated from cumulative spend and cumulative counts.
- Brand-level spend is never copied or proportionally allocated to treatment, source or campaign dimensions without a real attribution key.
- Partial or missing spend coverage is explained beside the chart.
- Funnel counts, Lead/Book/Show ownership and existing report definitions remain unchanged.

## Classification

- **Core**: aggregate-first cost trends, recorded-vs-missing spend semantics, reusable cost metric controls and unavailable-state contract.
- **Configurable**: labels, default metric, currency formatting and which dimensions own spend.
- **Needs evidence**: future campaign/ad-level CP trends require a canonical spend-to-campaign key before activation.

## Client-specific boundary

Brand names, colors, treatment labels, campaign names, spend rows and production performance values remain Alyssa tenant data and must not be copied into Growth OS Core.

## Source evidence

- Source PR: pending
- Release commit: pending
- Production deployment: pending

## Verification

- Production build and TypeScript.
- Shared reporting trend contract.
- Dashboard and Treatment Performance functional acceptance.
- Treatment-filtered unallocated-cost acceptance.
- Storybook build, deterministic desktop screenshots and WCAG design gate.
- Full Playwright regression.

## Rollback

Revert the source PR. No schema change is required; existing stored metrics and spend rows remain untouched.
''')

print("Applied CPLead / CPBook / CPShow trend implementation.")
