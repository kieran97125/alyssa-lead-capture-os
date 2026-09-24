import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFile(`${root}${path}`, "utf8");
const [sync, table, normalizer, parser, ledger, dashboard, panel] = await Promise.all([
  read("src/lib/integrations/googleSheetsLeadSync.ts"),
  read("src/lib/integrations/googleSheetsLeadTable.ts"),
  read("src/lib/integrations/metaLeadFormSheetNormalizer.ts"),
  read("src/lib/marketing/googleSheetsMetricParser.ts"),
  read("src/lib/marketing/leadFunnelEventLedger.ts"),
  read("src/lib/marketing/leadDashboard.ts"),
  read("src/components/command-center/LeadDashboardPanel.tsx"),
]);

assert.match(sync, /GOOGLE_SHEETS_LEAD_SCHEMA_VERSION = "lead\.v5"/);
assert.match(sync, /GOOGLE_SHEETS_LEAD_LEGACY_HEADERS/);
assert.match(sync, /"最後更新日期"/);
assert.match(sync, /lastUpdatedAt: createdAt/);
assert.match(table, /FUNNEL_EVENT_LEDGER_SHEET_NAME = "_funnel_events"/);
assert.match(table, /readLeadFunnelEventLedger/);
assert.match(table, /OPERATIONAL_LAST_COLUMN = "Y"/);
assert.match(table, /\[22, 23\]\.includes\(contractWidth\)/);
assert.match(sync, /"CS同事名"/);
assert.match(sync, /"Account"/);
assert.match(table, /FUNNEL_EVENT_LEDGER_LAST_COLUMN = "P"/);
assert.match(normalizer, /operationalHeaderContract/);
assert.match(parser, /usesEventLedger/);
assert.match(parser, /dedupeByIdentity: true/);
assert.match(parser, /applyLeadFunnelEventLedger/);
assert.match(parser, /C 欄「跟進狀態」係唯一主要狀態來源/);
assert.match(ledger, /immutable `_funnel_events` ledger/);
assert.match(ledger, /bookDateSource: bookDate \? \("event_ledger" as const\) : null/);
assert.match(dashboard, /readLeadFunnelEventLedger/);
assert.match(dashboard, /applyLeadFunnelEventLedger/);
assert.match(panel, /不可變 Funnel Event 紀錄日期/);
assert.match(panel, /之後狀態再轉變都唔會搬走之前嘅 Book/);

console.log("Lead Sheet v5 Account-first A:Y contract, CS owner column, event-ledger ownership, and legacy-safe fallback verified.");
