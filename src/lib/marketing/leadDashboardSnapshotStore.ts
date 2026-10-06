import "server-only";

import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  decryptLeadDashboardPayload,
  encryptLeadDashboardPayload,
  type EncryptedLeadDashboardPayload,
} from "@/lib/marketing/leadSheetAudit";
import { leadAccountById } from "@/lib/marketing/leadAccountScope";
import type {
  ParsedLeadSheetGroups,
  SheetBrandReference,
} from "@/lib/marketing/googleSheetsMetricParser";

export const LEAD_DASHBOARD_SNAPSHOT_VERSION = "lead-dashboard-arrival-registry-v1";
const MAX_SNAPSHOT_BYTES = 64 * 1024 * 1024;
const MAX_ROWS = 50_000;
const unavailable = () => new Error("未有可核對嘅已儲存 Lead 資料；請由 Master 按「跟 Lead Sheet 更新」。");
type SnapshotContext = {
  dataSourceId: string;
  configuration: Record<string, unknown>;
  brands: SheetBrandReference[];
};
export type PublishedLeadDashboardSnapshot = ParsedLeadSheetGroups & { loadedAt: string };

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  const object = record(value);
  return object ? Object.fromEntries(Object.keys(object).sort().map((key) => [key, stable(object[key])])) : value;
}
export function leadDashboardSnapshotFingerprint(input: SnapshotContext): string {
  return createHash("sha256").update(JSON.stringify(stable({
    configuration: input.configuration,
    brands: input.brands.map(({ id, name, slug }) => ({ id, name, slug })).sort((a, b) => a.id.localeCompare(b.id)),
  }))).digest("hex");
}
function aad(sourceId: string, runId: string): string {
  return JSON.stringify([LEAD_DASHBOARD_SNAPSHOT_VERSION, sourceId, runId]);
}
function isoDate(value: unknown): boolean {
  if (value === null) return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
function timestamp(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
}
function scalar(value: unknown): boolean {
  return value === undefined || value === null || typeof value === "string" || typeof value === "number" && Number.isFinite(value);
}

// The encrypted payload is still untrusted input after decryption: reject old
// formats, truncation and invalid relationships before rendering a real zero.
export function validateLeadDashboardSavedGroups(value: unknown, brands: SheetBrandReference[]): asserts value is ParsedLeadSheetGroups {
  const parsed = record(value);
  const diagnostics = record(parsed?.diagnostics);
  if (!Array.isArray(parsed?.groups) || parsed.groups.length > MAX_ROWS || !diagnostics) throw unavailable();
  for (const key of ["sourceRows", "acceptedRows", "unknownBrandRows", "invalidCreatedDateRows", "invalidShowDateRows", "invalidAppointmentDateRows", "uncategorizedTreatmentRows"]) {
    if (!Number.isSafeInteger(diagnostics[key]) || Number(diagnostics[key]) < 0) throw unavailable();
  }
  if (Number(diagnostics.sourceRows) > MAX_ROWS || Number(diagnostics.acceptedRows) > Number(diagnostics.sourceRows)) throw unavailable();
  const brandIds = new Set(brands.map((brand) => brand.id));
  const keys = new Set<string>();
  let rowCount = 0;
  for (const unknownGroup of parsed.groups) {
    const group = record(unknownGroup);
    if (!group) throw unavailable();
    for (const key of ["key", "accountId", "accountLabel", "brandId", "brandLabel", "treatmentLabel", "sourceLabel", "campaignLabel", "branchLabel"]) {
      if (typeof group[key] !== "string") throw unavailable();
    }
    const account = leadAccountById(group.accountId);
    if (!account || account.label !== group.accountLabel || !brandIds.has(String(group.brandId)) ||
        !group.key || keys.has(String(group.key)) || typeof group.usesStageDateContract !== "boolean" || group.usesEventLedger !== false ||
        ![null, "last_updated"].includes(group.bookDateSource as string | null) ||
        !["lead", "booked", "show", "no_show"].includes(String(group.currentStatus))) throw unavailable();
    keys.add(String(group.key));
    for (const key of ["firstTouchDate", "currentEventDate", "bookDate", "showDate", "noShowDate"]) {
      if (!isoDate(group[key])) throw unavailable();
    }
    if (!Array.isArray(group.rows) || group.rows.length === 0 || (rowCount += group.rows.length) > MAX_ROWS) throw unavailable();
    const rows = new Set<number>();
    for (const unknownRow of group.rows) {
      const row = record(unknownRow);
      if (!row || !Number.isSafeInteger(row.rowNumber) || Number(row.rowNumber) < 1 || rows.has(Number(row.rowNumber)) ||
          !scalar(row.createdAt) || !scalar(row.lastUpdatedAt) ||
          !["lead", "booked", "show", "no_show"].includes(String(row.status))) throw unavailable();
      rows.add(Number(row.rowNumber));
      for (const key of ["lastUpdatedDate", "createdDate", "appointmentDate", "confirmationDate"]) if (!isoDate(row[key])) throw unavailable();
      for (const key of ["appointmentTime", "branchLabel", "csRemark"]) if (typeof row[key] !== "string") throw unavailable();
    }
    if (!Number.isSafeInteger(group.currentRowNumber) || !rows.has(Number(group.currentRowNumber)) ||
        group.pendingRowNumber !== null && (!Number.isSafeInteger(group.pendingRowNumber) || !rows.has(Number(group.pendingRowNumber)))) throw unavailable();
  }
  if (rowCount !== diagnostics.acceptedRows) throw unavailable();
}

export async function readPublishedLeadDashboardSnapshot(input: SnapshotContext): Promise<PublishedLeadDashboardSnapshot> {
  const supabase = createSupabaseAdminClient();
  const { data: run, error } = await supabase.from("lead_sheet_audit_runs")
    .select("id,summary_json")
    .eq("data_source_id", input.dataSourceId)
    .in("status", ["baseline", "completed"])
    .not("summary_json->leadDashboardSnapshot", "is", null)
    .order("completed_at", { ascending: false }).order("id", { ascending: false })
    .limit(1).maybeSingle();
  if (error || !run) throw unavailable();
  try {
    const envelope = record(record(run.summary_json)?.leadDashboardSnapshot);
    if (envelope?.version !== LEAD_DASHBOARD_SNAPSHOT_VERSION || !timestamp(envelope.publishedAt) ||
        !["keyVersion", "ciphertext", "iv", "authTag"].every((key) => typeof envelope[key] === "string") ||
        String(envelope.ciphertext).length > Math.ceil(MAX_SNAPSHOT_BYTES * 4 / 3) + 4) throw unavailable();
    const plaintext = decryptLeadDashboardPayload(envelope as EncryptedLeadDashboardPayload, aad(input.dataSourceId, String(run.id)));
    const payload = record(JSON.parse(plaintext));
    if (payload?.version !== LEAD_DASHBOARD_SNAPSHOT_VERSION || payload.fingerprint !== leadDashboardSnapshotFingerprint(input) ||
        payload.publishedAt !== envelope.publishedAt || !timestamp(payload.capturedAt)) throw unavailable();
    validateLeadDashboardSavedGroups(payload.parsed, input.brands);
    return { ...payload.parsed, loadedAt: envelope.publishedAt };
  } catch {
    throw unavailable();
  }
}

// Called only after all derived facts succeed. Updating one accepted audit run
// publishes an entire encrypted payload atomically; a failed refresh never
// overwrites or deletes the previous good run. Legacy audit-only runs are ignored.
export async function publishLeadDashboardSnapshot(input: SnapshotContext & {
  runId: string;
  completedAt: string;
  capturedAt: string;
  parsed: ParsedLeadSheetGroups;
}): Promise<void> {
  validateLeadDashboardSavedGroups(input.parsed, input.brands);
  if (!timestamp(input.capturedAt) || !timestamp(input.completedAt)) throw unavailable();
  const supabase = createSupabaseAdminClient();
  const { data: source, error: sourceError } = await supabase.from("marketing_data_sources")
    .select("id,configuration,status,last_sync_at,last_success_at").eq("id", input.dataSourceId).single();
  if (sourceError || !source || !["connected", "warning"].includes(source.status) ||
      !timestamp(source.last_sync_at) || Date.parse(source.last_sync_at) !== Date.parse(input.completedAt) ||
      !timestamp(source.last_success_at) || Date.parse(source.last_success_at) !== Date.parse(input.completedAt) ||
      leadDashboardSnapshotFingerprint({ ...input, configuration: source.configuration }) !== leadDashboardSnapshotFingerprint(input)) throw unavailable();
  const { data: run, error } = await supabase.from("lead_sheet_audit_runs")
    .select("id,summary_json").eq("id", input.runId).eq("data_source_id", input.dataSourceId)
    .in("status", ["baseline", "completed"]).single();
  if (error || !run || !record(run.summary_json) || record(run.summary_json)?.leadDashboardSnapshot) throw unavailable();
  const publishedAt = new Date().toISOString();
  const plaintext = JSON.stringify({ version: LEAD_DASHBOARD_SNAPSHOT_VERSION,
    fingerprint: leadDashboardSnapshotFingerprint(input), capturedAt: input.capturedAt, publishedAt, parsed: input.parsed });
  if (Buffer.byteLength(plaintext, "utf8") > MAX_SNAPSHOT_BYTES) throw unavailable();
  const envelope = { version: LEAD_DASHBOARD_SNAPSHOT_VERSION, publishedAt,
    ...encryptLeadDashboardPayload(plaintext, aad(input.dataSourceId, input.runId)) };
  const { data: published, error: publishError } = await supabase.from("lead_sheet_audit_runs")
    .update({ summary_json: { ...run.summary_json, leadDashboardSnapshot: envelope } })
    .eq("id", input.runId).eq("data_source_id", input.dataSourceId)
    .in("status", ["baseline", "completed"])
    .is("summary_json->leadDashboardSnapshot", null).select("id").single();
  if (publishError || !published) throw unavailable();
}
