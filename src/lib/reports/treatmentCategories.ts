import { leadAccountById } from "@/lib/marketing/leadAccountScope";

export const REPORT_TREATMENT_HEADERS = ["Account", "Original Treatment", "Dashboard 技術分類"] as const;
export type ReportTreatmentTable = { headers: unknown[]; rows: unknown[][]; readAt: string };
export type ReportTreatmentClassifier = (account: string, treatment: string) => string;
export type ReportTreatmentCategoryReason = "headers" | "incomplete" | "conflict" | "empty";

/** Fixed reasons and counts only: operational logs must never contain Sheet cells. */
export class ReportTreatmentCategoryError extends Error {
  constructor(
    readonly reason: ReportTreatmentCategoryReason,
    readonly counts: Readonly<Record<string, number>>,
    message: string
  ) {
    super(message);
    this.name = "ReportTreatmentCategoryError";
  }
}

export function reportTreatmentFailureDiagnostic(error: unknown) {
  return error instanceof ReportTreatmentCategoryError
    ? { reason: error.reason, counts: error.counts }
    : { reason: "unclassified" as const, counts: {} };
}

const clean = (value: unknown) => String(value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const key = (account: string, treatment: string) => JSON.stringify([leadAccountById(account)?.id ?? account, clean(treatment).slice(0, 160)]);

/** Consume the native dashboard's evaluated Account-specific categories.
 * Matching/priority stays owned by the Sheet; no second regex taxonomy is invented.
 */
export function buildReportTreatmentClassifier(table: ReportTreatmentTable): ReportTreatmentClassifier {
  const headers = table.headers.map(clean);
  const indices = REPORT_TREATMENT_HEADERS.map(header => {
    if (headers.filter(value => value === header).length !== 1) throw new ReportTreatmentCategoryError("headers", { columns: headers.length }, "療程分類欄位缺少或重複。");
    return headers.indexOf(header);
  });
  const lookup = new Map<string, string>();
  for (const [index, row] of table.rows.entries()) {
    const [account, original, category] = indices.map(index => clean(row[index]));
    if (!account && !original && !category) continue;
    if (!account || !original || !category || [account, original, category].some(value => value.startsWith("#"))) throw new ReportTreatmentCategoryError("incomplete", { row: index + 2, rows: table.rows.length }, "療程分類資料未完整。");
    if (!leadAccountById(account)) continue;
    const id = key(account, original), previous = lookup.get(id);
    if (previous && previous !== category) throw new ReportTreatmentCategoryError("conflict", { row: index + 2, rows: table.rows.length }, "同一 Account 療程出現不同分類。");
    lookup.set(id, category);
  }
  if (!lookup.size) throw new ReportTreatmentCategoryError("empty", { rows: table.rows.length }, "未有可核實嘅療程分類。");
  return (account, treatment) => lookup.get(key(account, treatment)) ?? "未分類療程";
}
