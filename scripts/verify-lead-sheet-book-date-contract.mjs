import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFile(`${root}${path}`, "utf8");
const [sync, table, normalizer, parser, dashboard, panel] = await Promise.all([
  read("src/lib/integrations/googleSheetsLeadSync.ts"),
  read("src/lib/integrations/googleSheetsLeadTable.ts"),
  read("src/lib/integrations/metaLeadFormSheetNormalizer.ts"),
  read("src/lib/marketing/googleSheetsMetricParser.ts"),
  read("src/lib/marketing/leadDashboardMath.ts"),
  read("src/components/command-center/LeadDashboardPanel.tsx"),
]);

assert.match(sync, /GOOGLE_SHEETS_LEAD_SCHEMA_VERSION = "lead\.v3"/);
assert.match(sync, /GOOGLE_SHEETS_LEAD_LEGACY_HEADERS/);
assert.match(sync, /"最後更新日期"/);
assert.match(sync, /lastUpdatedAt: createdAt/);
assert.match(table, /OPERATIONAL_LAST_COLUMN = "W"/);
assert.match(table, /\[22, 23\]\.includes\(contractWidth\)/);
assert.match(table, /rawTailStartColumn = contractWidth === 23 \? "X" : "W"/);
assert.match(normalizer, /operationalHeaderContract/);
assert.match(normalizer, /input\.contract === "v3"/);
assert.match(parser, /bookDateSource/);
assert.match(parser, /isV3Lead = Boolean\(first\.row\.lastUpdatedDate\)/);
assert.match(parser, /leadGroupBookDate/);
assert.match(dashboard, /leadGroupBookDate\(group\) === date/);
assert.match(panel, /Book 按首次預約更新日/);
assert.match(panel, /舊 Lead 冇該日期時繼續按首次查詢日/);

console.log("Lead Sheet v3 dual contract and Book event-date ownership verified.");
