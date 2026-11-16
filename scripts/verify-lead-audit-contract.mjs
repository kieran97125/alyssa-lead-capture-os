import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import ts from "typescript";

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

// Exercise the production reader against a provider that caps every response.
// The old .limit(50_000) reader returned only the first 1,000 baseline records.
const nodeRequire = createRequire(import.meta.url);
let snapshotEntries = [];
let snapshotExpectedRows = 1_290;
let providerPageCap = 1_000;
let pageErrorAt = null;
const pageReads = [];
const fakeSupabase = {
  from(table) {
    const query = {
      select() { return query; },
      eq() { return query; },
      in() { return query; },
      order() { return query; },
      limit() { return query; },
      async maybeSingle() {
        assert.equal(table, "lead_sheet_audit_runs");
        return { data: { id: "baseline", row_count: snapshotExpectedRows }, error: null };
      },
      async range(from, to) {
        assert.equal(table, "lead_sheet_audit_snapshot_entries");
        pageReads.push([from, to]);
        if (from === pageErrorAt) return { data: null, error: new Error("page unavailable") };
        return { data: snapshotEntries.slice(from, Math.min(to + 1, from + providerPageCap)), error: null };
      },
      then(resolve) {
        return Promise.resolve({ data: snapshotEntries.slice(0, providerPageCap), error: null }).then(resolve);
      },
    };
    return query;
  },
};
const auditModule = { exports: {} };
runInNewContext(
  ts.transpileModule(auditService, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText + "\nexports.testReaders = { getPreviousAcceptedSnapshot, encryptRecord };",
  {
    exports: auditModule.exports,
    module: auditModule,
    Buffer,
    process: { env: { LEAD_AUDIT_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64") } },
    require(id) {
      if (id === "server-only" || id === "@/lib/marketing/leadSheetAuditContract") return {};
      if (id === "@/lib/supabase/admin") return { createSupabaseAdminClient: () => fakeSupabase };
      return nodeRequire(id);
    },
  }
);
const { getPreviousAcceptedSnapshot, encryptRecord } = auditModule.exports.testReaders;
snapshotEntries = Array.from({ length: snapshotExpectedRows }, (_, index) => {
  const record = {
    recordKey: `synthetic-${index}`,
    contentHash: `hash-${index}`,
    subjectLabel: "Synthetic audit fixture",
    canonical: { brand: "Fixture", followUpStatus: index === 1_289 ? "已到店" : "待跟進" },
  };
  const encrypted = encryptRecord({ dataSourceId: "source", record });
  return {
    record_key: record.recordKey,
    row_number: index + 2,
    record_version: {
      content_hash: record.contentHash,
      key_version: encrypted.keyVersion,
      subject_label: encrypted.subjectLabel,
      payload_ciphertext: encrypted.ciphertext,
      payload_iv: encrypted.iv,
      payload_auth_tag: encrypted.authTag,
    },
  };
});
let restored = await getPreviousAcceptedSnapshot("source");
assert.equal(restored.records.length, 1_290, "baseline records after the provider's first page must survive");
assert.equal(restored.records[1_289].canonical.followUpStatus, "已到店");
assert.deepEqual(pageReads, [[0, 999], [1_000, 1_289]]);
providerPageCap = 500;
pageReads.length = 0;
restored = await getPreviousAcceptedSnapshot("source");
assert.equal(restored.records.length, 1_290, "a lower provider cap must not silently truncate the baseline");
assert.deepEqual(pageReads.map(([from]) => from), [0, 500, 1_000]);
snapshotExpectedRows = 1_291;
await assert.rejects(getPreviousAcceptedSnapshot("source"), /snapshot 不完整/);
snapshotExpectedRows = 1_290;
pageErrorAt = 500;
await assert.rejects(getPreviousAcceptedSnapshot("source"), /page unavailable/);

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
