import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const paths = [
  "src/lib/marketing/leadSheetAudit.ts",
  "src/lib/marketing/leadSheetAuditContract.ts",
  "src/lib/marketing/leadSheetAuditView.ts",
  "src/lib/integrations/googleSheetsMarketingSync.ts",
  "src/lib/integrations/googleSheetsLeadTable.ts",
  "src/lib/security/internalAccessServer.ts",
  "src/lib/security/workspacePermissions.ts",
  "src/lib/security/routeBoundary.ts",
  "src/app/lead-audit/page.tsx",
  "src/app/lead-audit/actions.ts",
  "src/app/settings/team/page.tsx",
  "src/components/alyssa/AppNavClient.tsx",
  "supabase/migrations/20260805130202_lead_sheet_audit_snapshot_monitoring.sql",
  "vercel.json",
  ".env.example",
];
const files = Object.fromEntries(
  await Promise.all(
    paths.map(async (path) => [path, await readFile(`${root}${path}`, "utf8")])
  )
);

const migration =
  files["supabase/migrations/20260805130202_lead_sheet_audit_snapshot_monitoring.sql"];
for (const table of [
  "lead_sheet_audit_runs",
  "lead_sheet_audit_record_versions",
  "lead_sheet_audit_snapshot_entries",
  "lead_sheet_audit_changes",
]) {
  assert.match(migration, new RegExp(`create table public\\.${table}`));
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
  assert.match(migration, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`));
}
assert.match(migration, /payload_ciphertext text not null/);
assert.doesNotMatch(migration, /payload_json\s+jsonb/i);
assert.match(migration, /commit_lead_sheet_audit_snapshot/);
assert.match(migration, /stale_lead_audit_baseline/);
assert.match(migration, /review_lead_sheet_audit_change/);
assert.match(migration, /create_workspace_member_invitation_with_audit_access/);
assert.match(migration, /update_workspace_member_access_with_audit_access/);

const auditService = files["src/lib/marketing/leadSheetAudit.ts"];
assert.match(auditService, /aes-256-gcm/);
assert.match(auditService, /LEAD_AUDIT_ENCRYPTION_KEY/);
assert.match(auditService, /LEAD_AUDIT_DECRYPTION_KEYS_JSON/);
assert.match(auditService, /status: "failed"/);
assert.match(auditService, /risk_code: "sync_failed"/);

const sync = files["src/lib/integrations/googleSheetsMarketingSync.ts"];
assert.ok(
  sync.indexOf("captureLeadSheetAuditSnapshot") <
    sync.indexOf("reconcileMetrics(source, dataset, metrics)"),
  "audit snapshot must commit before derived reporting metrics"
);
assert.match(sync, /LeadAuditQuarantineError/);
assert.match(sync, /status:\s*sourceStatus/);

const permissions = files["src/lib/security/workspacePermissions.ts"];
assert.match(permissions, /"lead_audit"/);
assert.match(
  files["src/lib/security/internalAccessServer.ts"],
  /masterOrExplicitAudit/
);
assert.match(
  files["src/lib/security/routeBoundary.ts"],
  /requiresMasterOrExplicitLeadAuditAccess/
);
assert.match(files["src/app/settings/team/page.tsx"], /Lead 變更監察/);
assert.match(files["src/components/alyssa/AppNavClient.tsx"], /leadAuditAlertCount/);
assert.match(files["src/app/lead-audit/page.tsx"], /本次更新有咩改動/);
assert.match(files["src/app/lead-audit/actions.ts"], /review_lead_sheet_audit_change/);
const auditView = files["src/lib/marketing/leadSheetAuditView.ts"];
assert.match(auditView, /ALYSSA_E2E_FIXTURES === "1"/);
assert.doesNotMatch(
  auditView,
  /brand_id\.is\.null/,
  "non-Master brand scope must not expose unclassified Lead changes"
);

const cron = JSON.parse(files["vercel.json"]);
assert.deepEqual(cron.crons, [
  {
    path: "/api/cron/marketing-data-sources",
    schedule: "30 16 * * *",
  },
]);
assert.match(files[".env.example"], /LEAD_AUDIT_ENCRYPTION_KEY=/);

console.log(
  "Lead Sheet encrypted version, anomaly, review, explicit-access, and daily cron contracts verified."
);
