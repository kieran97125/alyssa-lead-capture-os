import type { LeadDashboardFilters } from "@/lib/marketing/leadDashboardMath";
import { getHkMonthContext } from "@/lib/marketing/pacing";

function firstString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());
}

export function normalizeLeadDashboardFilters(
  input: {
    startDate?: unknown;
    endDate?: unknown;
    brandId?: unknown;
    treatment?: unknown;
  },
  now = new Date()
): LeadDashboardFilters {
  const month = getHkMonthContext(now);
  const defaultEndDate =
    month.elapsedDays > 0 ? month.throughDate : month.monthStart;
  let startDate = firstString(input.startDate);
  let endDate = firstString(input.endDate);
  if (!isIsoDate(startDate)) startDate = month.monthStart;
  if (!isIsoDate(endDate)) endDate = defaultEndDate;
  if (startDate > endDate) [startDate, endDate] = [endDate, startDate];
  return {
    startDate,
    endDate,
    brandId: firstString(input.brandId),
    treatment: firstString(input.treatment),
  };
}

export function buildLeadDashboardReturnPath(filters: LeadDashboardFilters) {
  const params = new URLSearchParams({
    startDate: filters.startDate,
    endDate: filters.endDate,
  });
  if (filters.brandId) params.set("brandId", filters.brandId);
  if (filters.treatment) params.set("treatment", filters.treatment);
  return `/dashboard?${params.toString()}`;
}
