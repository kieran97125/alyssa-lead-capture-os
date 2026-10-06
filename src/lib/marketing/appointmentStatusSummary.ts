import { brandIdsForScope } from "@/lib/marketing/brandScope";
import type { LeadSheetLeadGroup, SheetBrandReference } from "@/lib/marketing/googleSheetsMetricParser";
import type { LeadDashboardFilters } from "@/lib/marketing/leadDashboardMath";

export type AppointmentStatusSummary = {
  available: boolean;
  cancellations: number;
  reschedules: number;
  undated: number;
  rows: Array<{ key: string; account: string; brand: string; treatment: string; cancellations: number; reschedules: number }>;
};

export function unavailableAppointmentStatuses(): AppointmentStatusSummary {
  return { available: false, cancellations: 0, reschedules: 0, undated: 0, rows: [] };
}

/** Current arrival-register exceptions, unique per account/lead, by appointment day.
 * Successful rebooking restores active/pending and leaves this view. This is not
 * a historical count of schedule edits; source remarks never supply an outcome.
 */
export function buildAppointmentStatusSummary(input: {
  groups: LeadSheetLeadGroup[];
  brands: SheetBrandReference[];
  filters: LeadDashboardFilters;
  allowedBrandIds?: string[] | null;
  source?: string;
  campaign?: string;
}): AppointmentStatusSummary {
  if (input.groups.some(group => group.appointmentStatus === undefined)) return unavailableAppointmentStatuses();
  const allowed = input.allowedBrandIds == null ? null : new Set(input.allowedBrandIds);
  const scoped = new Set(brandIdsForScope(input.brands, input.filters.brandId));
  const result: AppointmentStatusSummary = { available: true, cancellations: 0, reschedules: 0, undated: 0, rows: [] };
  const buckets = new Map<string, AppointmentStatusSummary["rows"][number]>();
  const seen = new Set<string>();
  for (const group of input.groups) {
    const status = group.appointmentStatus;
    if (!status || seen.has(group.key) || allowed && !allowed.has(status.brandId) ||
        !scoped.has(status.brandId) || input.filters.accountId && group.accountId !== input.filters.accountId ||
        input.filters.treatment && status.treatmentLabel !== input.filters.treatment ||
        input.source && group.sourceLabel !== input.source || input.campaign && group.campaignLabel !== input.campaign) continue;
    seen.add(group.key);
    if (!status.appointmentDate) { result.undated++; continue; }
    if (status.appointmentDate < input.filters.startDate || status.appointmentDate > input.filters.endDate) continue;
    const field = status.status === "canceled" ? "cancellations" : "reschedules";
    result[field]++;
    const key = JSON.stringify([group.accountId, status.brandId, status.treatmentLabel]);
    const row = buckets.get(key) ?? { key, account: group.accountLabel, brand: status.brandLabel,
      treatment: status.treatmentLabel, cancellations: 0, reschedules: 0 };
    row[field]++;
    buckets.set(key, row);
  }
  result.rows = [...buckets.values()].sort((a, b) =>
    b.cancellations + b.reschedules - a.cancellations - a.reschedules || a.key.localeCompare(b.key));
  return result;
}
