import { parseGoogleSheetDate } from "@/lib/marketing/googleSheetsMetricParser";

export const LEAD_SHEET_AUDIT_POLICY_VERSION = "lead-sheet-audit.v1";

export const leadAuditFieldKeys = [
  "createdAt",
  "followUpStatus",
  "brand",
  "branch",
  "customerName",
  "phone",
  "email",
  "treatmentOffer",
  "treatmentItem",
  "appointmentDate",
  "appointmentTime",
  "confirmedShowDate",
  "source",
  "campaignAd",
  "pageUrl",
  "lastFollowUpAt",
  "leadKey",
  "csRemark",
  "assignedTo",
  "followUpRemark",
  "status",
  "showUp",
] as const;

export type LeadAuditFieldKey = (typeof leadAuditFieldKeys)[number];
export type LeadAuditCanonicalRecord = Record<LeadAuditFieldKey, string>;

export type LeadAuditPreparedRecord = {
  recordKey: string;
  rowNumber: number;
  subjectLabel: string;
  brandId: string | null;
  canonical: LeadAuditCanonicalRecord;
};

export type LeadAuditComparableRecord = LeadAuditPreparedRecord & {
  contentHash: string;
};

export type LeadAuditSeverity = "info" | "warning" | "critical";

export type LeadAuditChange = {
  brandId: string | null;
  recordKey: string | null;
  subjectLabel: string;
  changeType: "added" | "modified" | "deleted" | "bulk_change";
  severity: LeadAuditSeverity;
  riskCode: string;
  summary: string;
  changedFields: LeadAuditFieldKey[];
  beforeContentHash: string | null;
  afterContentHash: string | null;
};

export type LeadAuditDiff = {
  changes: LeadAuditChange[];
  addedCount: number;
  modifiedCount: number;
  deletedCount: number;
  warningCount: number;
  criticalCount: number;
  quarantined: boolean;
  quarantineReason: string | null;
};

const HEADER_ALIASES: Record<LeadAuditFieldKey, string[]> = {
  createdAt: ["Created At", "created_at", "建立時間", "Date of Inquiry"],
  followUpStatus: ["跟進狀態", "Follow-up Status", "Follow Up Status"],
  brand: ["品牌", "Brand"],
  branch: ["分店", "Branch"],
  customerName: ["客人姓名", "Customer Name", "Name", "User"],
  phone: ["電話", "Tel No.", "Phone", "phone_number", "Tel"],
  email: ["Email", "電郵"],
  treatmentOffer: ["療程 / 優惠", "療程／優惠", "Treatment / Offer", "Promotion"],
  treatmentItem: ["療程項目", "Treatment Item", "Treatment", "Inquiry Item"],
  appointmentDate: ["預約日期", "Appointment Date", "Date of Appointment"],
  appointmentTime: ["預約時間", "Appointment Time"],
  confirmedShowDate: [
    "確認到店日期",
    "Confirmed Show Date",
    "Confirmation Date",
    "Attend",
  ],
  source: ["來源", "Source"],
  campaignAd: ["Campaign / 廣告", "Campaign／廣告", "Campaign / Ad"],
  pageUrl: ["Page URL", "頁面網址"],
  lastFollowUpAt: ["最後跟進時間", "Last Follow Up At"],
  leadKey: ["lead_key", "Lead Key", "leadKey", "cs_key"],
  csRemark: ["CS Remark", "Follow Up Remark", "Follow-up Remark"],
  assignedTo: [
    "具體派畀邊間分店+邊一位同事",
    "CS 負責人",
    "Assigned To",
  ],
  followUpRemark: [
    "Remark(後續跟進情況)",
    "Follow-up Action",
    "備註",
  ],
  status: ["Status", "狀態"],
  showUp: ["Show up", "Show Up", "Show-up", "到店"],
};

export const leadAuditFieldLabels: Record<LeadAuditFieldKey, string> = {
  createdAt: "建立時間",
  followUpStatus: "跟進狀態",
  brand: "品牌",
  branch: "分店",
  customerName: "客人姓名",
  phone: "電話",
  email: "Email",
  treatmentOffer: "療程／優惠",
  treatmentItem: "療程項目",
  appointmentDate: "預約日期",
  appointmentTime: "預約時間",
  confirmedShowDate: "確認到店日期",
  source: "來源",
  campaignAd: "Campaign／廣告",
  pageUrl: "Page URL",
  lastFollowUpAt: "最後跟進時間",
  leadKey: "Lead Key",
  csRemark: "CS Remark",
  assignedTo: "負責人",
  followUpRemark: "後續跟進",
  status: "Status",
  showUp: "Show up",
};

function compactString(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedComparable(value: unknown) {
  return compactString(value)
    .toLowerCase()
    .replace(/[／/]+/g, "/")
    .replace(/[\s_-]+/g, " ")
    .trim();
}

function normalizeHeader(value: unknown) {
  return normalizedComparable(value).replace(/\s*\/\s*/g, "/");
}

function normalizeSheetTimestamp(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 1) {
    const epoch = Date.UTC(1899, 11, 30);
    const timestamp = new Date(epoch + value * 86_400_000);
    if (!Number.isNaN(timestamp.getTime())) {
      return timestamp.toISOString().replace("T", " ").slice(0, 19);
    }
  }
  return compactString(value);
}

function normalizeSheetTime(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const totalSeconds = Math.round(
      ((value % 1) + (value < 0 ? 1 : 0)) * 86_400
    );
    const hours = Math.floor(totalSeconds / 3600) % 24;
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [hours, minutes, seconds]
      .map((part) => String(part).padStart(2, "0"))
      .join(":");
  }
  return compactString(value);
}

function normalizeField(field: LeadAuditFieldKey, value: unknown) {
  if (field === "appointmentDate" || field === "confirmedShowDate") {
    return parseGoogleSheetDate(value) || compactString(value);
  }
  if (field === "createdAt" || field === "lastFollowUpAt") {
    return normalizeSheetTimestamp(value);
  }
  if (field === "appointmentTime") return normalizeSheetTime(value);
  if (field === "phone") return compactString(value).replace(/[^0-9+]/g, "");
  if (field === "email") return compactString(value).toLowerCase();
  return compactString(value);
}

export function resolveLeadAuditColumns(headers: unknown[]) {
  const normalized = headers.map(normalizeHeader);
  return Object.fromEntries(
    leadAuditFieldKeys.map((field) => {
      const aliases = HEADER_ALIASES[field].map(normalizeHeader);
      return [field, normalized.findIndex((header) => aliases.includes(header))];
    })
  ) as Record<LeadAuditFieldKey, number>;
}

export function canonicalizeLeadAuditRow(input: {
  row: unknown[];
  columnMap: Record<LeadAuditFieldKey, number>;
}) {
  return Object.fromEntries(
    leadAuditFieldKeys.map((field) => {
      const index = input.columnMap[field];
      return [field, normalizeField(field, index >= 0 ? input.row[index] : "")];
    })
  ) as LeadAuditCanonicalRecord;
}

function identityMaterial(record: LeadAuditCanonicalRecord) {
  if (record.leadKey) {
    return JSON.stringify(["lead_key", normalizedComparable(record.leadKey)]);
  }
  return JSON.stringify([
    "fallback",
    normalizedComparable(record.brand),
    record.phone.replace(/\D/g, ""),
    record.createdAt,
    normalizedComparable(record.treatmentItem || record.treatmentOffer),
  ]);
}

function subjectLabel(record: LeadAuditCanonicalRecord, recordKey: string) {
  const digits = record.phone.replace(/\D/g, "");
  return digits.length >= 4
    ? `Lead · ****${digits.slice(-4)}`
    : `Lead · ${recordKey.slice(0, 8)}`;
}

function isEmptyLeadRow(record: LeadAuditCanonicalRecord) {
  return !(
    record.leadKey ||
    record.phone ||
    record.createdAt ||
    record.customerName ||
    record.followUpStatus
  );
}

export function prepareLeadAuditRecords(input: {
  headers: unknown[];
  rows: unknown[][];
  hashIdentity: (value: string) => string;
  resolveBrandId?: (brandValue: string) => string | null;
  firstDataRowNumber?: number;
}) {
  const columnMap = resolveLeadAuditColumns(input.headers);
  const occurrences = new Map<string, number>();
  const records: LeadAuditPreparedRecord[] = [];
  const firstDataRowNumber = Math.max(2, input.firstDataRowNumber ?? 2);

  input.rows.forEach((row, index) => {
    const canonical = canonicalizeLeadAuditRow({ row, columnMap });
    if (isEmptyLeadRow(canonical)) return;
    const baseKey = input.hashIdentity(identityMaterial(canonical));
    const occurrence = (occurrences.get(baseKey) ?? 0) + 1;
    occurrences.set(baseKey, occurrence);
    const recordKey = occurrence === 1 ? baseKey : `${baseKey}:${occurrence}`;
    records.push({
      recordKey,
      rowNumber: index + firstDataRowNumber,
      subjectLabel: subjectLabel(canonical, recordKey),
      brandId: input.resolveBrandId?.(canonical.brand) ?? null,
      canonical,
    });
  });

  return { records, columnMap };
}

function normalizedStatus(record: LeadAuditCanonicalRecord) {
  const joined = [record.followUpStatus, record.status, record.showUp]
    .map(normalizedComparable)
    .filter(Boolean)
    .join(" ");
  if (/no[ -]?show|未到店/.test(joined)) return "no_show" as const;
  if (/已到店|完成療程|(^| )show($| )/.test(joined)) return "show" as const;
  if (/已預約|confirmed|rescheduled|requested/.test(joined)) {
    return "booked" as const;
  }
  return "lead" as const;
}

function statusRank(status: ReturnType<typeof normalizedStatus>) {
  if (status === "lead") return 0;
  if (status === "booked") return 1;
  return 2;
}

function changedFields(
  before: LeadAuditCanonicalRecord,
  after: LeadAuditCanonicalRecord
) {
  return leadAuditFieldKeys.filter((field) => before[field] !== after[field]);
}

const CRITICAL_FIELDS = new Set<LeadAuditFieldKey>([
  "createdAt",
  "phone",
  "leadKey",
]);
const WARNING_FIELDS = new Set<LeadAuditFieldKey>([
  "brand",
  "branch",
  "customerName",
  "email",
  "treatmentOffer",
  "treatmentItem",
  "appointmentDate",
  "appointmentTime",
  "confirmedShowDate",
  "source",
  "campaignAd",
  "pageUrl",
]);

function classifyModification(input: {
  before: LeadAuditComparableRecord;
  after: LeadAuditComparableRecord;
  fields: LeadAuditFieldKey[];
}) {
  const beforeStatus = normalizedStatus(input.before.canonical);
  const afterStatus = normalizedStatus(input.after.canonical);
  const regressed = statusRank(afterStatus) < statusRank(beforeStatus);
  const showRewritten =
    beforeStatus === "show" && afterStatus !== "show";
  const confirmedShowCleared =
    Boolean(input.before.canonical.confirmedShowDate) &&
    !input.after.canonical.confirmedShowDate;
  const criticalField = input.fields.find((field) => CRITICAL_FIELDS.has(field));

  if (showRewritten || regressed) {
    return {
      severity: "critical" as const,
      riskCode: "status_regression",
      summary: "Lead 狀態出現回退，需要立即核對。",
    };
  }
  if (confirmedShowCleared) {
    return {
      severity: "critical" as const,
      riskCode: "confirmed_show_removed",
      summary: "已記錄嘅確認到店日期被清空。",
    };
  }
  if (criticalField) {
    return {
      severity: "critical" as const,
      riskCode: `protected_field_changed:${criticalField}`,
      summary: `${leadAuditFieldLabels[criticalField]}被改動，需要核對原始紀錄。`,
    };
  }
  const warningField = input.fields.find((field) => WARNING_FIELDS.has(field));
  if (warningField) {
    return {
      severity: "warning" as const,
      riskCode: `historical_field_changed:${warningField}`,
      summary: `${leadAuditFieldLabels[warningField]}有變動，請確認係正常操作。`,
    };
  }
  return {
    severity: "info" as const,
    riskCode: "operational_update",
    summary: "跟進資料已更新。",
  };
}

export function buildLeadAuditDiff(input: {
  previous: LeadAuditComparableRecord[];
  current: LeadAuditComparableRecord[];
}) : LeadAuditDiff {
  const previousByKey = new Map(
    input.previous.map((record) => [record.recordKey, record])
  );
  const currentByKey = new Map(
    input.current.map((record) => [record.recordKey, record])
  );
  const changes: LeadAuditChange[] = [];
  let addedCount = 0;
  let modifiedCount = 0;
  let deletedCount = 0;

  for (const current of input.current) {
    const previous = previousByKey.get(current.recordKey);
    if (!previous) {
      addedCount += 1;
      changes.push({
        brandId: current.brandId,
        recordKey: current.recordKey,
        subjectLabel: current.subjectLabel,
        changeType: "added",
        severity: "info",
        riskCode: "new_record",
        summary: "新增 Lead 紀錄。",
        changedFields: [],
        beforeContentHash: null,
        afterContentHash: current.contentHash,
      });
      continue;
    }
    if (previous.contentHash === current.contentHash) continue;

    modifiedCount += 1;
    const fields = changedFields(previous.canonical, current.canonical);
    const classification = classifyModification({
      before: previous,
      after: current,
      fields,
    });
    changes.push({
      brandId: current.brandId ?? previous.brandId,
      recordKey: current.recordKey,
      subjectLabel: current.subjectLabel,
      changeType: "modified",
      ...classification,
      changedFields: fields,
      beforeContentHash: previous.contentHash,
      afterContentHash: current.contentHash,
    });
  }

  for (const previous of input.previous) {
    if (currentByKey.has(previous.recordKey)) continue;
    deletedCount += 1;
    changes.push({
      brandId: previous.brandId,
      recordKey: previous.recordKey,
      subjectLabel: previous.subjectLabel,
      changeType: "deleted",
      severity: "critical",
      riskCode: "record_deleted",
      summary: "上一版本存在嘅 Lead 紀錄已消失。",
      changedFields: [],
      beforeContentHash: previous.contentHash,
      afterContentHash: null,
    });
  }

  const previousCount = input.previous.length;
  const shrinkRatio = previousCount > 0 ? deletedCount / previousCount : 0;
  const modificationRatio =
    previousCount > 0 ? modifiedCount / previousCount : 0;
  const quarantined =
    previousCount >= 20 && deletedCount >= 10 && shrinkRatio >= 0.2;
  let quarantineReason: string | null = null;

  if (quarantined) {
    quarantineReason = `Lead Sheet 比上一版本少 ${deletedCount} 筆（${Math.round(
      shrinkRatio * 100
    )}%），已隔離版本並停止覆寫報表。`;
    changes.unshift({
      brandId: null,
      recordKey: null,
      subjectLabel: "整份 Lead Sheet",
      changeType: "bulk_change",
      severity: "critical",
      riskCode: "source_truncation",
      summary: quarantineReason,
      changedFields: [],
      beforeContentHash: null,
      afterContentHash: null,
    });
  } else if (deletedCount >= 10 && shrinkRatio >= 0.05) {
    changes.unshift({
      brandId: null,
      recordKey: null,
      subjectLabel: "整份 Lead Sheet",
      changeType: "bulk_change",
      severity: "critical",
      riskCode: "bulk_delete",
      summary: `同一版本偵測到 ${deletedCount} 筆 Lead 被刪除。`,
      changedFields: [],
      beforeContentHash: null,
      afterContentHash: null,
    });
  }
  if (modifiedCount >= 25 && modificationRatio >= 0.2) {
    changes.unshift({
      brandId: null,
      recordKey: null,
      subjectLabel: "整份 Lead Sheet",
      changeType: "bulk_change",
      severity: "warning",
      riskCode: "bulk_modify",
      summary: `同一版本有 ${modifiedCount} 筆舊 Lead 被修改。`,
      changedFields: [],
      beforeContentHash: null,
      afterContentHash: null,
    });
  }

  return {
    changes,
    addedCount,
    modifiedCount,
    deletedCount,
    warningCount: changes.filter((change) => change.severity === "warning").length,
    criticalCount: changes.filter((change) => change.severity === "critical").length,
    quarantined,
    quarantineReason,
  };
}

export function maskLeadAuditValue(field: LeadAuditFieldKey, value: string) {
  if (!value) return "—";
  if (field === "phone") {
    const digits = value.replace(/\D/g, "");
    return digits.length >= 4 ? `****${digits.slice(-4)}` : "****";
  }
  if (field === "email") {
    const [local, domain] = value.split("@");
    if (!domain) return "***";
    return `${local.slice(0, 1)}***@${domain}`;
  }
  if (field === "pageUrl") {
    try {
      const url = new URL(value);
      return `${url.hostname}${url.pathname}`.slice(0, 120);
    } catch {
      return value.slice(0, 120);
    }
  }
  return value.slice(0, 160);
}
