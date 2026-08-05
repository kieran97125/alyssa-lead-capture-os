import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  LEAD_SHEET_AUDIT_POLICY_VERSION,
  buildLeadAuditDiff,
  prepareLeadAuditRecords,
  type LeadAuditCanonicalRecord,
  type LeadAuditComparableRecord,
} from "@/lib/marketing/leadSheetAuditContract";

const MAX_AUDIT_ROWS = 50_000;
const ACTIVE_KEY_VERSION =
  process.env.LEAD_AUDIT_ACTIVE_KEY_VERSION?.trim() || "v1";
let cachedDecryptionKeys: Map<string, Buffer> | null = null;
const derivedKeyCache = new Map<string, Buffer>();

type BrandReference = {
  id: string;
  name: string;
  slug: string;
};

type EncryptedRecordVersion = {
  recordKey: string;
  contentHash: string;
  keyVersion: string;
  subjectLabel: string;
  ciphertext: string;
  iv: string;
  authTag: string;
};

type StoredRecordVersion = {
  content_hash: string;
  key_version: string;
  subject_label: string;
  payload_ciphertext: string;
  payload_iv: string;
  payload_auth_tag: string;
};

type StoredSnapshotEntry = {
  record_key: string;
  row_number: number;
  record_version: StoredRecordVersion | StoredRecordVersion[] | null;
};

export type LeadAuditCaptureResult = {
  runId: string;
  status: "baseline" | "completed" | "quarantined";
  openAlerts: number;
  warningCount: number;
  criticalCount: number;
  addedCount: number;
  modifiedCount: number;
  deletedCount: number;
  quarantined: boolean;
  quarantineReason: string | null;
};

function compact(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseKey(value: string, label: string) {
  const cleaned = value.trim();
  const bytes = /^[0-9a-f]{64}$/i.test(cleaned)
    ? Buffer.from(cleaned, "hex")
    : Buffer.from(cleaned, "base64");
  if (bytes.length !== 32) {
    throw new Error(`${label} 必須係 32-byte Base64 或 64 位 Hex key。`);
  }
  return bytes;
}

function decryptionKeyMap() {
  if (cachedDecryptionKeys) return cachedDecryptionKeys;
  const keys = new Map<string, Buffer>();
  const activeKey = compact(process.env.LEAD_AUDIT_ENCRYPTION_KEY);
  if (!activeKey) {
    throw new Error(
      "LEAD_AUDIT_ENCRYPTION_KEY 尚未設定；為免保存未加密 Lead 資料，Audit Snapshot 已安全停止。"
    );
  }
  keys.set(ACTIVE_KEY_VERSION, parseKey(activeKey, "LEAD_AUDIT_ENCRYPTION_KEY"));

  const legacyJson = compact(process.env.LEAD_AUDIT_DECRYPTION_KEYS_JSON);
  if (!legacyJson) {
    cachedDecryptionKeys = keys;
    return keys;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(legacyJson);
  } catch {
    throw new Error("LEAD_AUDIT_DECRYPTION_KEYS_JSON 格式無效。");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("LEAD_AUDIT_DECRYPTION_KEYS_JSON 必須係 key-version map。");
  }
  for (const [version, value] of Object.entries(parsed)) {
    if (!/^[A-Za-z0-9._-]{1,40}$/.test(version) || typeof value !== "string") {
      throw new Error("Lead Audit 舊 key version 格式無效。");
    }
    keys.set(version, parseKey(value, `Lead Audit key ${version}`));
  }
  cachedDecryptionKeys = keys;
  return keys;
}

function deriveKey(master: Buffer, purpose: "encryption" | "hmac") {
  const cacheKey = `${master.toString("hex")}:${purpose}`;
  const cached = derivedKeyCache.get(cacheKey);
  if (cached) return cached;
  const derived = Buffer.from(
    hkdfSync(
      "sha256",
      master,
      Buffer.from("alyssa-growth-os-lead-audit", "utf8"),
      Buffer.from(purpose, "utf8"),
      32
    )
  );
  derivedKeyCache.set(cacheKey, derived);
  return derived;
}

function hmac(value: string) {
  const master = decryptionKeyMap().get(ACTIVE_KEY_VERSION);
  if (!master) throw new Error("Lead Audit active encryption key unavailable.");
  return createHmac("sha256", deriveKey(master, "hmac"))
    .update(value)
    .digest("hex");
}

function encryptionAad(input: {
  dataSourceId: string;
  recordKey: string;
  contentHash: string;
  keyVersion: string;
}) {
  return Buffer.from(
    [
      input.dataSourceId,
      input.recordKey,
      input.contentHash,
      input.keyVersion,
    ].join(":"),
    "utf8"
  );
}

function encryptRecord(input: {
  dataSourceId: string;
  record: LeadAuditComparableRecord;
}): EncryptedRecordVersion {
  const master = decryptionKeyMap().get(ACTIVE_KEY_VERSION);
  if (!master) throw new Error("Lead Audit active encryption key unavailable.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(master, "encryption"), iv);
  cipher.setAAD(
    encryptionAad({
      dataSourceId: input.dataSourceId,
      recordKey: input.record.recordKey,
      contentHash: input.record.contentHash,
      keyVersion: ACTIVE_KEY_VERSION,
    })
  );
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(input.record.canonical), "utf8"),
    cipher.final(),
  ]);
  return {
    recordKey: input.record.recordKey,
    contentHash: input.record.contentHash,
    keyVersion: ACTIVE_KEY_VERSION,
    subjectLabel: input.record.subjectLabel,
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptLeadAuditPayload(input: {
  dataSourceId: string;
  recordKey: string;
  contentHash: string;
  keyVersion: string;
  ciphertext: string;
  iv: string;
  authTag: string;
}) {
  const master = decryptionKeyMap().get(input.keyVersion);
  if (!master) {
    throw new Error(`Lead Audit key version ${input.keyVersion} 未提供。`);
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    deriveKey(master, "encryption"),
    Buffer.from(input.iv, "base64")
  );
  decipher.setAAD(encryptionAad(input));
  decipher.setAuthTag(Buffer.from(input.authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(input.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
  return JSON.parse(plaintext) as LeadAuditCanonicalRecord;
}

function normalizeBrandKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/[／/]+/g, "/")
    .replace(/[\s_-]+/g, " ")
    .trim();
}

function brandResolver(input: {
  brands: BrandReference[];
  aliases: Record<string, string>;
}) {
  const lookup = new Map<string, BrandReference>();
  for (const brand of input.brands) {
    const name = normalizeBrandKey(brand.name);
    const slug = normalizeBrandKey(brand.slug);
    lookup.set(name, brand);
    lookup.set(slug, brand);
    lookup.set(name.replace(/\s+beauty$/, ""), brand);
  }
  for (const [alias, target] of Object.entries(input.aliases)) {
    const targetKey = normalizeBrandKey(target);
    const brand =
      lookup.get(targetKey) ||
      input.brands.find((item) => normalizeBrandKey(item.id) === targetKey);
    if (brand) lookup.set(normalizeBrandKey(alias), brand);
  }
  return (value: string) => lookup.get(normalizeBrandKey(value))?.id ?? null;
}

async function getPreviousAcceptedSnapshot(dataSourceId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: run, error: runError } = await supabase
    .from("lead_sheet_audit_runs")
    .select("id")
    .eq("data_source_id", dataSourceId)
    .in("status", ["baseline", "completed"])
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (runError) throw runError;
  if (!run) return { runId: null, records: [] as LeadAuditComparableRecord[] };

  const { data: entries, error: entriesError } = await supabase
    .from("lead_sheet_audit_snapshot_entries")
    .select(
      "record_key,row_number,record_version:lead_sheet_audit_record_versions!inner(content_hash,key_version,subject_label,payload_ciphertext,payload_iv,payload_auth_tag)"
    )
    .eq("run_id", run.id)
    .order("row_number", { ascending: true })
    .limit(MAX_AUDIT_ROWS);
  if (entriesError) throw entriesError;

  const records = ((entries ?? []) as unknown as StoredSnapshotEntry[]).map(
    (entry) => {
      const version = Array.isArray(entry.record_version)
        ? entry.record_version[0]
        : entry.record_version;
      if (!version) throw new Error("Lead Audit snapshot version 缺失。");
      const canonical = decryptLeadAuditPayload({
        dataSourceId,
        recordKey: entry.record_key,
        contentHash: version.content_hash,
        keyVersion: version.key_version,
        ciphertext: version.payload_ciphertext,
        iv: version.payload_iv,
        authTag: version.payload_auth_tag,
      });
      return {
        recordKey: entry.record_key,
        rowNumber: entry.row_number,
        subjectLabel: version.subject_label,
        brandId: null,
        canonical,
        contentHash: version.content_hash,
      } satisfies LeadAuditComparableRecord;
    }
  );
  return { runId: String(run.id), records };
}

function canonicalJson(record: LeadAuditCanonicalRecord) {
  return JSON.stringify(record);
}

export async function captureLeadSheetAuditSnapshot(input: {
  dataSourceId: string;
  actorIdentifier?: string;
  headers: unknown[];
  rows: unknown[][];
  headerRow: number;
  brands: BrandReference[];
  brandAliases?: Record<string, string>;
  startedAt: string;
}): Promise<LeadAuditCaptureResult> {
  if (input.rows.length > MAX_AUDIT_ROWS) {
    throw new Error(`Lead Audit 最多支援 ${MAX_AUDIT_ROWS} 筆紀錄。`);
  }
  // Validate the key before reading or constructing any sensitive snapshot.
  decryptionKeyMap();

  const resolveBrandId = brandResolver({
    brands: input.brands,
    aliases: input.brandAliases ?? {},
  });
  const prepared = prepareLeadAuditRecords({
    headers: input.headers,
    rows: input.rows,
    hashIdentity: hmac,
    resolveBrandId,
    firstDataRowNumber: input.headerRow + 1,
  });
  const current: LeadAuditComparableRecord[] = prepared.records.map((record) => ({
    ...record,
    contentHash: hmac(canonicalJson(record.canonical)),
  }));
  const previous = await getPreviousAcceptedSnapshot(input.dataSourceId);
  // Re-resolve brands because encrypted versions deliberately do not duplicate
  // client identity metadata outside their protected payload.
  previous.records.forEach((record) => {
    record.brandId = resolveBrandId(record.canonical.brand);
  });
  const diff = previous.runId
    ? buildLeadAuditDiff({ previous: previous.records, current })
    : {
        changes: [],
        addedCount: 0,
        modifiedCount: 0,
        deletedCount: 0,
        warningCount: 0,
        criticalCount: 0,
        quarantined: false,
        quarantineReason: null,
      };
  const previousByKey = new Map(
    previous.records.map((record) => [record.recordKey, record])
  );
  const versions = current
    .filter(
      (record) =>
        previousByKey.get(record.recordKey)?.contentHash !== record.contentHash
    )
    .map((record) => encryptRecord({ dataSourceId: input.dataSourceId, record }));
  const completedAt = new Date().toISOString();
  const status = previous.runId
    ? diff.quarantined
      ? "quarantined"
      : "completed"
    : "baseline";
  const sheetChecksum = hmac(
    [...current]
      .sort((left, right) => left.recordKey.localeCompare(right.recordKey))
      .map((record) => `${record.recordKey}:${record.contentHash}`)
      .join("|")
  );
  const headersChecksum = hmac(JSON.stringify(input.headers.map(String)));
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("commit_lead_sheet_audit_snapshot", {
    p_data_source_id: input.dataSourceId,
    p_previous_run_id: previous.runId,
    p_status: status,
    p_policy_version: LEAD_SHEET_AUDIT_POLICY_VERSION,
    p_row_count: current.length,
    p_sheet_checksum: sheetChecksum,
    p_headers_checksum: headersChecksum,
    p_actor_identifier: input.actorIdentifier || "google_sheets_sync",
    p_summary: {
      addedCount: diff.addedCount,
      modifiedCount: diff.modifiedCount,
      deletedCount: diff.deletedCount,
      quarantineReason: diff.quarantineReason,
    },
    p_versions: versions,
    p_entries: current.map((record) => ({
      recordKey: record.recordKey,
      contentHash: record.contentHash,
      rowNumber: record.rowNumber,
    })),
    p_changes: diff.changes,
    p_started_at: input.startedAt,
    p_completed_at: completedAt,
  });
  if (error) throw error;
  const result =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  return {
    runId: String(result.runId ?? ""),
    status,
    openAlerts: Number(result.openAlerts ?? 0),
    warningCount: Number(result.warningCount ?? diff.warningCount),
    criticalCount: Number(result.criticalCount ?? diff.criticalCount),
    addedCount: diff.addedCount,
    modifiedCount: diff.modifiedCount,
    deletedCount: diff.deletedCount,
    quarantined: diff.quarantined,
    quarantineReason: diff.quarantineReason,
  };
}

function hkDate(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export async function recordLeadSheetAuditFailure(input: {
  dataSourceId: string;
  actorIdentifier?: string;
  startedAt: string;
  error: unknown;
}) {
  const message =
    input.error instanceof Error && input.error.message.trim()
      ? input.error.message.trim().slice(0, 500)
      : "Lead Sheet audit snapshot failed.";
  const now = new Date().toISOString();
  const supabase = createSupabaseAdminClient();
  const { data: failedRun, error } = await supabase
    .from("lead_sheet_audit_runs")
    .insert({
      data_source_id: input.dataSourceId,
      previous_run_id: null,
      status: "failed",
      policy_version: LEAD_SHEET_AUDIT_POLICY_VERSION,
      snapshot_date: hkDate(),
      row_count: 0,
      actor_identifier: input.actorIdentifier || "google_sheets_sync",
      summary_json: {},
      error_summary: message,
      started_at: input.startedAt,
      completed_at: now,
    })
    .select("id")
    .single();
  if (error) {
    console.warn("lead_sheet_audit_failure_record_failed", {
      code: error.code,
      message: error.message,
    });
    return;
  }
  const { error: changeError } = await supabase.from("lead_sheet_audit_changes").insert({
    run_id: failedRun.id,
    brand_id: null,
    record_key: null,
    subject_label: "Lead Sheet 同步",
    change_type: "bulk_change",
    severity: "critical",
    risk_code: "sync_failed",
    summary: message,
    changed_fields: [],
    review_status: "open",
  });
  if (changeError) {
    console.warn("lead_sheet_audit_failure_alert_write_failed", {
      code: changeError.code,
      message: changeError.message,
    });
  }
}
