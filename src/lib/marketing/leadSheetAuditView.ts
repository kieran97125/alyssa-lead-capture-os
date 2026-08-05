import "server-only";

import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import { decryptLeadAuditPayload } from "@/lib/marketing/leadSheetAudit";
import {
  leadAuditFieldLabels,
  maskLeadAuditValue,
  type LeadAuditCanonicalRecord,
  type LeadAuditFieldKey,
  type LeadAuditSeverity,
} from "@/lib/marketing/leadSheetAuditContract";
import type { InternalAccessContext } from "@/lib/security/internalAccess";

export type LeadAuditRunView = {
  id: string;
  sourceId: string;
  sourceName: string;
  status: "baseline" | "completed" | "quarantined" | "failed";
  snapshotDate: string;
  rowCount: number;
  addedCount: number;
  modifiedCount: number;
  deletedCount: number;
  warningCount: number;
  criticalCount: number;
  actorIdentifier: string | null;
  errorSummary: string | null;
  completedAt: string | null;
};

export type LeadAuditFieldChangeView = {
  field: LeadAuditFieldKey;
  label: string;
  before: string;
  after: string;
};

export type LeadAuditChangeView = {
  id: string;
  runId: string;
  brandId: string | null;
  subjectLabel: string;
  changeType: string;
  severity: LeadAuditSeverity;
  riskCode: string;
  summary: string;
  changedFields: LeadAuditFieldChangeView[];
  reviewStatus: string;
  reviewNote: string | null;
  reviewedByEmail: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export type LeadAuditView = {
  schemaReady: boolean;
  encryptionReady: boolean;
  scopeRestricted: boolean;
  runs: LeadAuditRunView[];
  changes: LeadAuditChangeView[];
  openCritical: number;
  openWarning: number;
  error: string | null;
};

type StoredVersion = {
  content_hash: string;
  key_version: string;
  payload_ciphertext: string;
  payload_iv: string;
  payload_auth_tag: string;
};

type StoredChange = {
  id: string;
  run_id: string;
  brand_id: string | null;
  record_key: string | null;
  subject_label: string;
  change_type: string;
  severity: LeadAuditSeverity;
  risk_code: string;
  summary: string;
  changed_fields: string[] | null;
  review_status: string;
  review_note: string | null;
  reviewed_by_email: string | null;
  reviewed_at: string | null;
  created_at: string;
  before_version: StoredVersion | StoredVersion[] | null;
  after_version: StoredVersion | StoredVersion[] | null;
};

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function relationOne<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function applyBrandScope<T>(
  query: T,
  access: InternalAccessContext
): T {
  if (access.accessLevel === "master" || access.source !== "supabase_auth") {
    return query;
  }
  const brandIds = access.brandIds ?? [];
  if (brandIds.length === 0) {
    return (query as { eq: (column: string, value: string) => T }).eq(
      "brand_id",
      "00000000-0000-0000-0000-000000000000"
    );
  }
  return (query as { in: (column: string, values: string[]) => T }).in(
    "brand_id",
    brandIds
  );
}

function fixtureView(): LeadAuditView {
  const now = new Date();
  const previous = new Date(now.getTime() - 86_400_000);
  return {
    schemaReady: true,
    encryptionReady: true,
    scopeRestricted: false,
    runs: [
      {
        id: "audit-run-current",
        sourceId: "audit-source",
        sourceName: "CS Lead Sheet",
        status: "completed",
        snapshotDate: now.toISOString().slice(0, 10),
        rowCount: 128,
        addedCount: 6,
        modifiedCount: 3,
        deletedCount: 1,
        warningCount: 1,
        criticalCount: 1,
        actorIdentifier: "scheduled_sync",
        errorSummary: null,
        completedAt: now.toISOString(),
      },
      {
        id: "audit-run-previous",
        sourceId: "audit-source",
        sourceName: "CS Lead Sheet",
        status: "baseline",
        snapshotDate: previous.toISOString().slice(0, 10),
        rowCount: 120,
        addedCount: 0,
        modifiedCount: 0,
        deletedCount: 0,
        warningCount: 0,
        criticalCount: 0,
        actorIdentifier: "scheduled_sync",
        errorSummary: null,
        completedAt: previous.toISOString(),
      },
    ],
    changes: [
      {
        id: "audit-change-critical",
        runId: "audit-run-current",
        brandId: null,
        subjectLabel: "Lead · ****1234",
        changeType: "deleted",
        severity: "critical",
        riskCode: "record_deleted",
        summary: "上一版本存在嘅 Lead 紀錄已消失。",
        changedFields: [],
        reviewStatus: "open",
        reviewNote: null,
        reviewedByEmail: null,
        reviewedAt: null,
        createdAt: now.toISOString(),
      },
      {
        id: "audit-change-warning",
        runId: "audit-run-current",
        brandId: null,
        subjectLabel: "Lead · ****7788",
        changeType: "modified",
        severity: "warning",
        riskCode: "historical_field_changed:appointmentDate",
        summary: "預約日期有變動，請確認係正常操作。",
        changedFields: [
          {
            field: "appointmentDate",
            label: "預約日期",
            before: "2026-08-10",
            after: "2026-08-12",
          },
        ],
        reviewStatus: "open",
        reviewNote: null,
        reviewedByEmail: null,
        reviewedAt: null,
        createdAt: now.toISOString(),
      },
    ],
    openCritical: 1,
    openWarning: 1,
    error: null,
  };
}

function decryptVersion(input: {
  sourceId: string;
  recordKey: string | null;
  version: StoredVersion | StoredVersion[] | null;
}) {
  const version = relationOne(input.version);
  if (!version || !input.recordKey) return null;
  return decryptLeadAuditPayload({
    dataSourceId: input.sourceId,
    recordKey: input.recordKey,
    contentHash: version.content_hash,
    keyVersion: version.key_version,
    ciphertext: version.payload_ciphertext,
    iv: version.payload_iv,
    authTag: version.payload_auth_tag,
  });
}

function fieldChanges(input: {
  fields: string[] | null;
  before: LeadAuditCanonicalRecord | null;
  after: LeadAuditCanonicalRecord | null;
}) {
  return (input.fields ?? []).flatMap((value) => {
    if (!(value in leadAuditFieldLabels)) return [];
    const field = value as LeadAuditFieldKey;
    return [
      {
        field,
        label: leadAuditFieldLabels[field],
        before: maskLeadAuditValue(field, input.before?.[field] ?? ""),
        after: maskLeadAuditValue(field, input.after?.[field] ?? ""),
      },
    ];
  });
}

export async function getLeadAuditView(input: {
  access: InternalAccessContext;
  runId?: string | null;
  reviewStatus?: string | null;
  severity?: string | null;
}): Promise<LeadAuditView> {
  if (process.env.ALYSSA_E2E_FIXTURES === "1") {
    return fixtureView();
  }
  if (!hasSupabaseAdminEnv()) {
    return {
      schemaReady: false,
      encryptionReady: false,
      scopeRestricted: input.access.accessLevel !== "master",
      runs: [],
      changes: [],
      openCritical: 0,
      openWarning: 0,
      error: "Supabase 尚未連接。",
    };
  }

  const supabase = createSupabaseAdminClient();
  try {
    const { data: runRows, error: runError } = await supabase
      .from("lead_sheet_audit_runs")
      .select(
        "id,data_source_id,status,snapshot_date,row_count,added_count,modified_count,deleted_count,warning_count,critical_count,actor_identifier,error_summary,completed_at,source:marketing_data_sources!inner(display_name)"
      )
      .order("completed_at", { ascending: false })
      .limit(30);
    if (runError) throw runError;

    const runs: LeadAuditRunView[] = (runRows ?? []).map((row) => ({
      id: String(row.id),
      sourceId: String(row.data_source_id),
      sourceName:
        String(relationOne(row.source)?.display_name ?? "CS Lead Sheet"),
      status: row.status as LeadAuditRunView["status"],
      snapshotDate: String(row.snapshot_date),
      rowCount: numberValue(row.row_count),
      addedCount: numberValue(row.added_count),
      modifiedCount: numberValue(row.modified_count),
      deletedCount: numberValue(row.deleted_count),
      warningCount: numberValue(row.warning_count),
      criticalCount: numberValue(row.critical_count),
      actorIdentifier:
        typeof row.actor_identifier === "string" ? row.actor_identifier : null,
      errorSummary:
        typeof row.error_summary === "string" ? row.error_summary : null,
      completedAt:
        typeof row.completed_at === "string" ? row.completed_at : null,
    }));
    const sourceByRun = new Map(runs.map((run) => [run.id, run.sourceId]));

    let changeQuery = supabase
      .from("lead_sheet_audit_changes")
      .select(
        "id,run_id,brand_id,record_key,subject_label,change_type,severity,risk_code,summary,changed_fields,review_status,review_note,reviewed_by_email,reviewed_at,created_at,before_version:lead_sheet_audit_record_versions!lead_sheet_audit_changes_before_version_id_fkey(content_hash,key_version,payload_ciphertext,payload_iv,payload_auth_tag),after_version:lead_sheet_audit_record_versions!lead_sheet_audit_changes_after_version_id_fkey(content_hash,key_version,payload_ciphertext,payload_iv,payload_auth_tag)"
      )
      .order("created_at", { ascending: false })
      .limit(250);
    changeQuery = applyBrandScope(changeQuery, input.access);
    if (input.runId) changeQuery = changeQuery.eq("run_id", input.runId);
    if (input.reviewStatus && input.reviewStatus !== "all") {
      changeQuery = changeQuery.eq("review_status", input.reviewStatus);
    }
    if (
      input.severity === "info" ||
      input.severity === "warning" ||
      input.severity === "critical"
    ) {
      changeQuery = changeQuery.eq("severity", input.severity);
    }
    let criticalQuery = supabase
      .from("lead_sheet_audit_changes")
      .select("id", { count: "exact", head: true })
      .eq("review_status", "open")
      .eq("severity", "critical");
    let warningQuery = supabase
      .from("lead_sheet_audit_changes")
      .select("id", { count: "exact", head: true })
      .eq("review_status", "open")
      .eq("severity", "warning");
    criticalQuery = applyBrandScope(criticalQuery, input.access);
    warningQuery = applyBrandScope(warningQuery, input.access);
    const [changeResult, criticalResult, warningResult] = await Promise.all([
      changeQuery,
      criticalQuery,
      warningQuery,
    ]);
    const { data: changeRows, error: changeError } = changeResult;
    if (changeError) throw changeError;
    if (criticalResult.error) throw criticalResult.error;
    if (warningResult.error) throw warningResult.error;

    const changes: LeadAuditChangeView[] = (
      (changeRows ?? []) as unknown as StoredChange[]
    ).map((row) => {
      const sourceId = sourceByRun.get(row.run_id) ?? "";
      let before: LeadAuditCanonicalRecord | null = null;
      let after: LeadAuditCanonicalRecord | null = null;
      try {
        before = decryptVersion({
          sourceId,
          recordKey: row.record_key,
          version: row.before_version,
        });
        after = decryptVersion({
          sourceId,
          recordKey: row.record_key,
          version: row.after_version,
        });
      } catch (error) {
        console.warn("lead_sheet_audit_version_decrypt_failed", {
          changeId: row.id,
          message: error instanceof Error ? error.message : "unknown",
        });
      }
      return {
        id: row.id,
        runId: row.run_id,
        brandId: row.brand_id,
        subjectLabel: row.subject_label,
        changeType: row.change_type,
        severity: row.severity,
        riskCode: row.risk_code,
        summary: row.summary,
        changedFields: fieldChanges({
          fields: row.changed_fields,
          before,
          after,
        }),
        reviewStatus: row.review_status,
        reviewNote: row.review_note,
        reviewedByEmail: row.reviewed_by_email,
        reviewedAt: row.reviewed_at,
        createdAt: row.created_at,
      };
    });
    return {
      schemaReady: true,
      encryptionReady: Boolean(process.env.LEAD_AUDIT_ENCRYPTION_KEY?.trim()),
      scopeRestricted: input.access.accessLevel !== "master",
      runs,
      changes,
      openCritical: criticalResult.count ?? 0,
      openWarning: warningResult.count ?? 0,
      error: null,
    };
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";
    return {
      schemaReady: code !== "42P01" ? true : false,
      encryptionReady: Boolean(process.env.LEAD_AUDIT_ENCRYPTION_KEY?.trim()),
      scopeRestricted: input.access.accessLevel !== "master",
      runs: [],
      changes: [],
      openCritical: 0,
      openWarning: 0,
      error:
        code === "42P01"
          ? "Lead Data Audit migration 尚未套用。"
          : error instanceof Error
            ? error.message
            : "Lead Data Audit 暫時未能讀取。",
    };
  }
}

export async function getLeadAuditNavigationSummary(
  access: InternalAccessContext
) {
  if (process.env.ALYSSA_E2E_FIXTURES === "1") return 2;
  if (!hasSupabaseAdminEnv()) {
    return 0;
  }
  try {
    let query = createSupabaseAdminClient()
      .from("lead_sheet_audit_changes")
      .select("id", { count: "exact", head: true })
      .eq("review_status", "open")
      .in("severity", ["warning", "critical"]);
    query = applyBrandScope(query, access);
    const { count, error } = await query;
    if (error) return 0;
    return Math.min(count ?? 0, 99);
  } catch {
    return 0;
  }
}
