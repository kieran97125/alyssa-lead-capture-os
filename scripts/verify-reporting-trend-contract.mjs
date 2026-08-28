import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const files = Object.fromEntries(
  await Promise.all(
    [
      "src/app/calendar/page.tsx",
      "src/app/command-center/actions.ts",
      "src/app/dashboard/page.tsx",
      "src/components/command-center/PeriodComparisonChart.tsx",
      "src/components/command-center/TrendModeToggle.tsx",
      "src/components/command-center/TreatmentPerformanceTrendChartLazy.tsx",
      "src/components/command-center/LeadDashboardTrendChartLazy.tsx",
      "src/components/command-center/LeadDashboardPanel.tsx",
      "src/components/command-center/PerformanceCostSummary.tsx",
      "src/components/command-center/TreatmentPerformanceTrendChart.tsx",
      "src/lib/marketing/operationalAnnotationStore.ts",
      "src/lib/marketing/periodComparison.ts",
      "src/lib/marketing/periodComparisonMath.ts",
      "src/lib/marketing/performanceTrend.ts",
      "src/lib/marketing/performanceCostMath.ts",
      "src/lib/marketing/performanceCosts.ts",
      "src/lib/marketing/leadDashboard.ts",
      "src/lib/marketing/treatmentPerformance.ts",
      "src/lib/security/internalAccessServer.ts",
      "src/lib/security/routeBoundary.ts",
      "src/lib/security/workspacePermissions.ts",
      "supabase/migrations/20260805094856_calendar_treatment_annotations.sql",
    ].map(async (path) => [path, await readFile(`${root}${path}`, "utf8")])
  )
);

assert.match(files["src/app/calendar/page.tsx"], /type="month"/);
assert.match(files["src/app/calendar/page.tsx"], /name="treatmentId"/);
assert.match(
  files["src/lib/marketing/periodComparison.ts"],
  /buildDailyTreatmentTrendPoints/
);
assert.match(
  files["src/lib/marketing/periodComparison.ts"],
  /getOperationalAnnotations/
);
assert.match(
  files["src/lib/marketing/periodComparison.ts"],
  /buildDailyComparisonTrend/
);
assert.doesNotMatch(
  files["src/lib/marketing/periodComparison.ts"],
  /points: buildCumulativeComparisonTrend/
);
assert.match(
  files["src/lib/marketing/treatmentPerformance.ts"],
  /buildDailyTreatmentTrend/
);
const periodComparisonChart =
  files["src/components/command-center/PeriodComparisonChart.tsx"];
assert.match(periodComparisonChart, /type === "treatment"/);
assert.match(periodComparisonChart, /成效事件/);
assert.match(periodComparisonChart, /annotations_\$\{seriesIndex\}/);
assert.match(periodComparisonChart, /annotationY_\$\{seriesIndex\}/);
assert.match(periodComparisonChart, /data-testid="period-series-annotation"/);
assert.match(periodComparisonChart, /seriesLabels=\{seriesLabels\}/);
assert.match(periodComparisonChart, /TrendModeToggle/);
assert.match(periodComparisonChart, /data-trend-mode=\{mode\}/);
assert.match(periodComparisonChart, /performanceTrendPointsForMode/);
assert.match(periodComparisonChart, /mode === "cumulative" \? "monotone" : "linear"/);
assert.doesNotMatch(
  periodComparisonChart,
  /series\.flatMap\(\(item\) => item\.points\[index\]\?\.annotations/
);
assert.doesNotMatch(periodComparisonChart, /dataKey="annotationY"/);
assert.doesNotMatch(periodComparisonChart, /row\.annotationY/);
const treatmentTrendChart =
  files["src/components/command-center/TreatmentPerformanceTrendChart.tsx"];
assert.match(treatmentTrendChart, /成效事件/);
assert.match(treatmentTrendChart, /TrendModeToggle/);
assert.match(treatmentTrendChart, /performanceTrendPointsForMode/);
assert.match(treatmentTrendChart, /preferenceKey/);
assert.match(
  files["src/components/command-center/TreatmentPerformanceTrendChartLazy.tsx"],
  /preferenceKey="treatment-performance"/
);
assert.match(
  files["src/components/command-center/LeadDashboardTrendChartLazy.tsx"],
  /preferenceKey="lead-dashboard"/
);
const modeToggle =
  files["src/components/command-center/TrendModeToggle.tsx"];
assert.match(modeToggle, /growth-os:performance-trend-mode:/);
assert.match(modeToggle, /aria-pressed=\{selected\}/);
assert.match(modeToggle, /data-testid={`trend-mode-\$\{option\}`}/);
const trendMath = files["src/lib/marketing/performanceTrend.ts"];
assert.match(trendMath, /export type PerformanceTrendMode = "daily" \| "cumulative"/);
assert.match(trendMath, /accumulatePerformanceTrendPoints/);
assert.match(trendMath, /performanceTrendPointsForMode/);
assert.match(trendMath, /buildDailyTreatmentTrendPoints/);
assert.match(
  files["src/lib/marketing/periodComparisonMath.ts"],
  /buildDailyComparisonTrend/
);
assert.match(
  files["src/lib/marketing/operationalAnnotationStore.ts"],
  /marketing_operational_events/
);
assert.match(
  files["src/lib/marketing/operationalAnnotationStore.ts"],
  /marketing_calendar_items/
);

const costMath = files["src/lib/marketing/performanceCostMath.ts"];
assert.match(costMath, /calculateComparisonKpis/);
assert.match(costMath, /availability: "unallocated"/);
assert.match(
  files["src/lib/marketing/performanceCosts.ts"],
  /marketing_daily_spend_entries/
);
assert.match(files["src/lib/marketing/leadDashboard.ts"], /costs:/);
assert.match(files["src/lib/marketing/treatmentPerformance.ts"], /costs,/);
assert.match(
  files["src/components/command-center/LeadDashboardPanel.tsx"],
  /PerformanceCostSummary costs=\{snapshot\.costs\}/
);
assert.match(
  files["src/components/command-center/PerformanceCostSummary.tsx"],
  /CPBook/
);
assert.match(
  files["src/components/command-center/PerformanceCostSummary.tsx"],
  /CPShow/
);

const permissions = files["src/lib/security/workspacePermissions.ts"];
assert.match(permissions, /role === "manager"/);
assert.match(permissions, /pathname\.startsWith\("\/settings\/planning"\).*"kpis"/s);
const masterOnlyRoutes = files["src/lib/security/routeBoundary.ts"].match(
  /const masterOnlyRoutePrefixes = \[([\s\S]*?)\] as const;/
)?.[1];
assert.ok(masterOnlyRoutes);
assert.doesNotMatch(masterOnlyRoutes, /\/settings\/planning/);
const masterOnlyActions = files["src/lib/security/internalAccessServer.ts"].match(
  /const masterOnlyActions = new Set<InternalAction>\(\[([\s\S]*?)\]\);/
)?.[1];
assert.ok(masterOnlyActions);
assert.doesNotMatch(masterOnlyActions, /edit_monthly_plan/);

const migration =
  files["supabase/migrations/20260805094856_calendar_treatment_annotations.sql"];
assert.match(migration, /treatment_id uuid/);
assert.match(migration, /references public\.treatments\(id\) on delete set null/);
assert.match(migration, /treatment_label text/);
assert.match(migration, /where treatment_id is not null/);
assert.doesNotMatch(migration, /\bgrant\b|\bpolicy\b/i);

console.log(
  "Reporting daily/cumulative mode, aggregate-first trend math, per-surface preference, cost metrics, connected events, calendar annotation, and Manager KPI contracts verified."
);
