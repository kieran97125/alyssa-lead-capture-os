import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFile(`${root}${path}`, "utf8");
const [migration, store, panel, actions, parser, sync] = await Promise.all([
  read("supabase/migrations/20260812033227_system_owned_treatment_mapping_and_text_reports.sql"),
  read("src/lib/marketing/treatmentMappingStore.ts"),
  read("src/components/alyssa/TreatmentMappingPanel.tsx"),
  read("src/app/settings/treatments/mappingActions.ts"),
  read("src/lib/marketing/googleSheetsMetricParser.ts"),
  read("src/lib/integrations/googleSheetsMarketingSync.ts"),
]);

assert.match(migration, /create table public\.treatment_mapping_rules/);
assert.match(migration, /enable row level security/);
assert.match(migration, /revoke all on table public\.treatment_mapping_rules from anon, authenticated/);
assert.match(migration, /treatment_mapping_rules_brand_code_uidx/);
assert.match(migration, /rebuild_treatment_mapping_cache/);
assert.match(migration, /treatmentMappingSource/);
assert.match(migration, /growth_os_system/);
assert.match(migration, /treatment_mapping\.created/);
assert.match(migration, /treatment_mapping\.updated/);
assert.match(migration, /alyssa-restylane/);
assert.match(migration, /alyssa-988-yanyan-face-pilates/);
assert.match(migration, /柔清舒敏鉗清/);
assert.match(migration, /array\['388','針清','鉗清','柔清','暗瘡'\]/);

assert.match(store, /expectedRevision/);
assert.match(store, /\.eq\("revision", expectedRevision\)/);
assert.match(store, /normalizeTreatmentMappingItemCode/);
assert.match(store, /parseTreatmentMappingKeywords/);
assert.match(store, /treatment_mapping_rules/);

assert.match(panel, /System source of truth/);
assert.match(panel, /Google Sheet.*歷史參考/s);
assert.match(panel, /標準輸出（原 I 欄）/);
assert.match(panel, /Dashboard 分類/);
assert.match(panel, /重新套用分類/);

assert.match(actions, /requireModuleAccess\("settings"\)/);
assert.match(actions, /canAccessInternalBrand/);
assert.match(actions, /syncMarketingDataSource/);
assert.match(actions, /Live Dashboard 仍會使用新規則/);

assert.match(parser, /matchingTreatmentAlias/);
assert.match(parser, /\[treatment, offer, campaign\]/);
assert.match(sync, /treatmentAliases\(configuration\.treatmentAliases\)/);
assert.match(sync, /reconcileTreatmentPerformanceMetrics/);

console.log("System-owned treatment mapping and Lead classification contracts verified.");
