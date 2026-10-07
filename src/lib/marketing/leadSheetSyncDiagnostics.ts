// Operational diagnostics contain only fixed reason codes and numeric counts.
// Never attach Sheet cells, customer identities, URLs or provider responses.
export type LeadSheetSyncReason =
  | "contract_unclassified" | "managed_read_timeout" | "provider_transient"
  | "managed_configuration" | "managed_response" | "source_headers"
  | "source_normalization" | "projection_missing"
  | "arrival_headers" | "arrival_row" | "arrival_cells" | "arrival_identity"
  | "arrival_duplicate" | "arrival_date" | "arrival_coverage"
  | "bridge_headers" | "bridge_row" | "bridge_master_mismatch"
  | "bridge_source_duplicate" | "bridge_coverage" | "bridge_registration_pending"
  | "registry_headers" | "registry_cells" | "registry_row" | "registry_date"
  | "registry_pointer" | "registry_dimensions";

export class LeadSheetSyncError extends Error {
  constructor(
    readonly reason: LeadSheetSyncReason,
    readonly counts: Readonly<Record<string, number>> = {},
    message = "到店報表資料未完整或格式未能核對，暫時未能確認 Show／No Show；請稍後重試。"
  ) {
    super(reason === "bridge_registration_pending"
      ? "有預約記錄仍待登記穩定 Lead ID；系統會再讀取核對，現有數字會保留。"
      : message);
    this.name = "LeadSheetSyncError";
  }
}

const retryableReasons = new Set<LeadSheetSyncReason>([
  "managed_read_timeout", "provider_transient", "managed_response",
  "arrival_cells", "arrival_coverage", "bridge_master_mismatch",
  "bridge_coverage", "registry_cells", "registry_pointer", "bridge_registration_pending",
]);
export type LeadSheetReadAttempt = {
  attempt: number;
  elapsedMs: number;
  reason: LeadSheetSyncReason | "ok" | "unclassified";
  counts: Readonly<Record<string, number>>;
};

export function leadSheetFailureDiagnostic(error: unknown) {
  return error instanceof LeadSheetSyncError
    ? { reason: error.reason, counts: error.counts }
    : { reason: "unclassified" as const, counts: {} };
}

// Retry the complete read AND validation before any audit or fact write.
// A second incoherent read still fails closed and retains the last-good snapshot.
export async function readValidatedLeadSnapshot<T>(input: {
  managed: boolean;
  read: () => Promise<T>;
  attempts: LeadSheetReadAttempt[];
}): Promise<T> {
  const maxAttempts = input.managed ? 2 : 1;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const started = Date.now();
    try {
      const result = await input.read();
      input.attempts.push({ attempt, elapsedMs: Date.now() - started, reason: "ok", counts: {} });
      return result;
    } catch (error) {
      const diagnostic = leadSheetFailureDiagnostic(error);
      input.attempts.push({ attempt, elapsedMs: Date.now() - started, ...diagnostic });
      if (attempt === maxAttempts || !(error instanceof LeadSheetSyncError) || !retryableReasons.has(error.reason)) throw error;
      console.warn("lead_sheet_snapshot_read_retry", { attempt, elapsedMs: Date.now() - started, ...diagnostic });
      await new Promise<void>((resolve) => setTimeout(resolve, 1_000));
    }
  }
  throw new Error("Unreachable Lead Sheet read state.");
}
