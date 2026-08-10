import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const paths = [
  "src/app/loading.tsx",
  "src/app/leads/page.tsx",
  "src/app/crm/page.tsx",
  "src/app/performance/compare/page.tsx",
  "src/app/performance/daily/page.tsx",
  "src/components/alyssa/IntentPrefetchLink.tsx",
  "src/components/alyssa/SubmitButton.tsx",
  "src/lib/data/configuration.ts",
  "src/lib/marketing/brandScope.ts",
  "src/lib/marketing/commandCenter.ts",
  "src/lib/marketing/leadDashboardMath.ts",
  "src/lib/marketing/periodComparison.ts",
  "src/lib/marketing/treatmentPerformance.ts",
];
const files = Object.fromEntries(
  await Promise.all(
    paths.map(async (path) => [path, await readFile(`${root}${path}`, "utf8")])
  )
);

const scope = files["src/lib/marketing/brandScope.ts"];
assert.match(scope, /ALYSSA_ALL_BRAND_SCOPE = "alyssa-all"/);
assert.match(scope, /ALYSSA_ALL_BRAND_LABEL = "Alyssa All"/);
assert.match(scope, /brands\.filter\(\(brand\) => !isGosBrand\(brand\)\)/);
assert.doesNotMatch(scope, /\[\s*"Alyssa"\s*,\s*"AM"\s*,/);

for (const path of [
  "src/app/leads/page.tsx",
  "src/app/crm/page.tsx",
  "src/lib/marketing/leadDashboardMath.ts",
  "src/lib/marketing/periodComparison.ts",
  "src/lib/marketing/treatmentPerformance.ts",
]) {
  assert.match(files[path], /brand(?:sForScope|MatchesScope|ScopeOptions|IdsForScope)/);
}

assert.match(
  files["src/lib/data/configuration.ts"],
  /export async function getConfiguredBrands/
);
assert.match(files["src/lib/marketing/commandCenter.ts"], /includeMembers/);
assert.match(files["src/app/loading.tsx"], /SystemPageLoading/);
assert.match(
  files["src/components/alyssa/IntentPrefetchLink.tsx"],
  /useLinkStatus/
);
assert.match(files["src/components/alyssa/SubmitButton.tsx"], /aria-busy/);

console.log(
  "Alyssa All, lightweight reporting data, and loading feedback contracts verified."
);
