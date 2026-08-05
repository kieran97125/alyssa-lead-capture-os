import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const paths = [
  "src/app/login/page.tsx",
  "src/app/dashboard/page.tsx",
  "src/app/lead-audit/page.tsx",
  "src/app/data-sources/page.tsx",
  "src/app/performance/page.tsx",
  "src/app/performance/compare/page.tsx",
  "src/app/performance/daily/page.tsx",
  "src/app/system-audit/page.tsx",
  "src/app/forms/page.tsx",
  "src/app/forms/new/page.tsx",
  "src/app/forms/[formId]/page.tsx",
  "src/app/brands/page.tsx",
  "src/app/landing-pages/page.tsx",
  "src/app/crm/page.tsx",
  "src/app/crm/operations/page.tsx",
  "src/app/crm/leads/[leadId]/page.tsx",
  "src/app/crm/whatsapp-broadcasts/page.tsx",
  "src/app/crm/settings/QuickRepliesSettingsTable.tsx",
  "src/app/landing-pages/[pageId]/page.tsx",
  "src/components/alyssa/AppNavClient.tsx",
  "src/components/command-center/PerformanceCostSummary.tsx",
  "src/components/crm/CrmShell.tsx",
  "src/components/crm/ReplyComposer.tsx",
  "src/components/crm/WhatsAppSendBox.tsx",
];
const files = Object.fromEntries(
  await Promise.all(
    paths.map(async (path) => [path, await readFile(`${root}${path}`, "utf8")])
  )
);
const combined = Object.values(files).join("\n");

for (const forbidden of [
  "Migration 尚未套用",
  "SQL migration 尚未套用",
  "Preview only",
  "Phase 2B",
  "Workspace Role",
  "Master Account",
  "Master 系統身份",
  "Enterprise workspace",
  "Command Center",
  "AI Assist",
  "AI generated suggestion",
  "Local draft",
  "Send via WhatsApp 尚未啟用",
  "Coming soon",
  "LEAD_AUDIT_ENCRYPTION_KEY 尚未設定",
  "每日 Overview",
  "Daily Ledger",
  "Spend ledger",
  "Revision ",
  "Future CRM",
  "Open Test Form",
  "Copy Test URL",
  "Copy Wix Embed",
  "Ready-to-paste Wix embed",
  "Archive / Delete",
  "Safe delete",
  "Confirm permanent delete",
  "Save enabled",
]) {
  assert.ok(!combined.includes(forbidden), `product UI must not expose: ${forbidden}`);
}

assert.doesNotMatch(files["src/components/crm/CrmShell.tsx"], /\bSoon\b|enabled:\s*false/);
assert.doesNotMatch(
  files["src/components/crm/CrmShell.tsx"],
  /WhatsApp 群發|whatsapp-broadcasts/
);
assert.match(
  files["src/app/crm/whatsapp-broadcasts/page.tsx"],
  /redirect\("\/crm\?tab=leads"\)/
);
assert.doesNotMatch(
  files["src/app/crm/operations/page.tsx"],
  /Automation Rules Simulation|createAutomationRuleAction|Simulation Rule/
);
assert.doesNotMatch(
  files["src/app/crm/leads/[leadId]/page.tsx"],
  /<Placeholder|runtime\.debug|feedback\.debug|<DebugLine/
);
assert.doesNotMatch(
  files["src/app/lead-audit/page.tsx"],
  /LEAD_AUDIT_|Version diff|Migration 尚未|SQL migration/
);
assert.doesNotMatch(
  files["src/app/landing-pages/[pageId]/page.tsx"],
  /editorDebugItems|loadedFrom=|versionId=/
);
assert.match(files["src/components/crm/ReplyComposer.tsx"], /情境草稿/);
assert.match(files["src/app/lead-audit/page.tsx"], /Lead 變更監察/);

console.log("Production UI wording and real-feature contracts verified.");
