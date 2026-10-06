import { leadAccountById } from "@/lib/marketing/leadAccountScope";
import type { LeadSheetLeadGroup } from "@/lib/marketing/googleSheetsMetricParser";
import { LeadSheetSyncError, type LeadSheetSyncReason } from "@/lib/marketing/leadSheetSyncDiagnostics";

// The Sheet advertises this contract only while its registry-only producer is
// installed. Never infer arrival outcomes from the source follow-up status.
export const ARRIVAL_METRIC_HEADERS = [
  "Identity · arrival-registry-v1", "Account", "Brand", "Treatment",
  "Lead Date · Created At", "Book Date · 最後更新日期",
  "Show Date · 確認到店日期", "No Show Date · 預約日期",
  "Missing Book Date", "Missing Show Date", "Missing No Show Date",
  "First Source Row",
] as const;

const outcomes = Symbol("validatedArrivalOutcomes");
type Outcome = Readonly<{ showDate: string | null; noShowDate: string | null }>;
export type LeadArrivalOutcomeAuthority = Readonly<{
  rowCount: number;
  [outcomes]: ReadonlyMap<string, Outcome>;
}>;

export function arrivalOutcomeAuthorityError(reason: LeadSheetSyncReason = "contract_unclassified", counts: Readonly<Record<string, number>> = {}): LeadSheetSyncError {
  return new LeadSheetSyncError(reason, counts);
}

function blank(value: unknown): boolean {
  return value === undefined || value === null ||
    (typeof value === "string" && value.trim() === "");
}

function date(value: unknown): string | null {
  if (blank(value)) return null;
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 36526 || value > 73415) {
      throw arrivalOutcomeAuthorityError("arrival_date");
    }
    return new Date(Date.UTC(1899, 11, 30) + value * 86_400_000).toISOString().slice(0, 10);
  }
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw arrivalOutcomeAuthorityError("arrival_date");
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ||
      value < "2000-01-01" || value > "2100-12-31") {
    throw arrivalOutcomeAuthorityError("arrival_date");
  }
  return value;
}

export function parseLeadArrivalOutcomeAuthority(values: unknown): LeadArrivalOutcomeAuthority {
  if (!Array.isArray(values) || !Array.isArray(values[0]) ||
      JSON.stringify(values[0]) !== JSON.stringify(ARRIVAL_METRIC_HEADERS)) {
    throw arrivalOutcomeAuthorityError("arrival_headers");
  }
  const map = new Map<string, Outcome>();
  for (const row of values.slice(1)) {
    if (!Array.isArray(row)) throw arrivalOutcomeAuthorityError("arrival_row");
    if (row.every(blank)) continue;
    if (row.length !== 12) throw arrivalOutcomeAuthorityError("arrival_row");
    if (row.some((cell) =>
      !blank(cell) && (typeof cell !== "string" && typeof cell !== "number" ||
        typeof cell === "number" && !Number.isFinite(cell) ||
        typeof cell === "string" && /^#(?:REF!|N\/A|VALUE!|ERROR!|DIV\/0!|NAME\?|NUM!|SPILL!|CALC!)/.test(cell.trim()))
    )) throw arrivalOutcomeAuthorityError("arrival_cells");
    const [identity, accountLabel] = row;
    const account = leadAccountById(accountLabel);
    const firstSourceRow = row[11];
    if (!account || accountLabel !== account.label || typeof identity !== "string" ||
        !identity.startsWith(`${accountLabel}|`) ||
        typeof firstSourceRow !== "number" || !Number.isSafeInteger(firstSourceRow) || firstSourceRow < 1 ||
        !row.slice(8, 11).every((flag) => flag === 0 || flag === 1)) {
      throw arrivalOutcomeAuthorityError("arrival_identity");
    }
    const suffix = identity.slice(account.label.length + 1);
    const phone = /^p:(\d{8})$/.exec(suffix);
    const sourceRow = /^r:([1-9]\d*)$/.exec(suffix);
    if (!phone && (!sourceRow || Number(sourceRow[1]) !== firstSourceRow)) {
      throw arrivalOutcomeAuthorityError("arrival_identity");
    }
    const key = `${account.id}|${phone ? `phone:${phone[1]}` : `row:${firstSourceRow}`}`;
    if (map.has(key)) throw arrivalOutcomeAuthorityError("arrival_duplicate");
    // Validate all dates, but leave Lead / Book calculation with the source parser.
    row.slice(4, 8).forEach(date);
    map.set(key, Object.freeze({ showDate: date(row[6]), noShowDate: date(row[7]) }));
  }
  return Object.freeze({ rowCount: map.size, [outcomes]: map });
}

export function applyLeadArrivalOutcomeAuthority(
  groups: LeadSheetLeadGroup[], authority: LeadArrivalOutcomeAuthority
): LeadSheetLeadGroup[] {
  const map = authority?.[outcomes];
  if (!(map instanceof Map) || map.size !== groups.length ||
      new Set(groups.map((group) => group.key)).size !== groups.length ||
      groups.some((group) => !map.has(group.key))) {
    throw arrivalOutcomeAuthorityError("arrival_coverage", {
      sourceGroups: groups.length, projectionGroups: map instanceof Map ? map.size : 0,
      missingGroups: map instanceof Map ? groups.filter((group) => !map.has(group.key)).length : groups.length,
    });
  }
  return groups.map((group) => ({ ...group, ...map.get(group.key)! }));
}
