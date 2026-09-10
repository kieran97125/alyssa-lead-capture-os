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
assert.match(parser, /usesStageDateContract/);
assert.match(parser, /currentStatus/);
assert.match(parser, /currentEventDate/);
assert.match(parser, /leadGroupBookDate/);
assert.match(parser, /leadGroupShowDate/);
assert.match(parser, /leadGroupNoShowDate/);
assert.match(parser, /C 欄「跟進狀態」係唯一主要狀態來源/);
assert.match(dashboard, /leadGroupShowDate\(group\) === date/);
assert.match(dashboard, /leadGroupNoShowDate\(group\) === date/);
assert.match(panel, /最後更新日期＋目前跟進狀態/);
assert.match(panel, /已預約＝Book 未 Show/);

console.log("Lead Sheet v3 dual contract and current-stage event-date ownership verified.");
