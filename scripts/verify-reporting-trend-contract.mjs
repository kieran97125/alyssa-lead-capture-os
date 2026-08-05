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
      "src/components/command-center/LeadDashboardPanel.tsx",
      "src/components/command-center/PerformanceCostSummary.tsx",
      "src/components/command-center/TreatmentPerformanceTrendChart.tsx",
      "src/lib/marketing/periodComparison.ts",
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
  /buildCumulativeTreatmentTrend/
);
assert.match(
  files["src/lib/marketing/periodComparison.ts"],
  /getOperationalAnnotations/
);
assert.match(
  files["src/lib/marketing/treatmentPerformance.ts"],
  /buildDailyTreatmentTrend/
);
assert.match(
  files["src/components/command-center/PeriodComparisonChart.tsx"],
  /type === "treatment"/
);
assert.match(
  files["src/components/command-center/PeriodComparisonChart.tsx"],
  /日曆操作/
);
assert.match(
  files["src/components/command-center/TreatmentPerformanceTrendChart.tsx"],
  /日曆操作/
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
  "Reporting trend, cost metrics, calendar annotation, and Manager KPI contracts verified."
);
