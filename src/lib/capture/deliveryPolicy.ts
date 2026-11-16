export type PublicLeadDeliveryTarget = {
  sourceId: string; spreadsheetId: string; tabName: string; headerRow: number; sheetBrand: string; account: string;
};
export type PublicLeadDeliveryOutcome = {
  status: "delivered" | "retry" | "blocked" | "uncertain";
  code: string;
  target?: PublicLeadDeliveryTarget;
  updatedRange?: string | null;
  safeToRetry?: boolean;
};

export function canonicalDeliveryLeadId(value: unknown) {
  return String(value ?? "").trim().replace(/^lead_/, "").toLowerCase();
}
export function deliveryIdentityMatches(values: unknown[][], leadId: string) {
  const canonical = canonicalDeliveryLeadId(leadId);
  return values.flatMap((row, index) => canonicalDeliveryLeadId(row?.[0]) === canonical ? [index] : []);
}
export function classifyAppendResponse(status: number): PublicLeadDeliveryOutcome {
  if (status === 429) return { status: "retry", code: "sheet_append_rate_limited", safeToRetry: true };
  if (status >= 400 && status < 500) return { status: "blocked", code: "sheet_append_rejected", safeToRetry: true };
  return { status: "uncertain", code: "sheet_append_response_uncertain" };
}
