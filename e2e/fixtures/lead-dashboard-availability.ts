import type { LeadDashboardSnapshot } from "../../src/lib/marketing/leadDashboard";
import { buildLeadDashboardModel } from "../../src/lib/marketing/leadDashboardMath";
import { calculatePerformanceCostSummary } from "../../src/lib/marketing/performanceCostMath";

export function leadDashboardAvailabilityFixture(live: boolean): LeadDashboardSnapshot {
  const filters = { startDate: "2026-10-01", endDate: "2026-10-31", accountId: "gos-beauty", brandId: "", treatment: "" };
  const model = buildLeadDashboardModel({ groups: [], brands: [], filters });
  return {
    ...model, filters,
    costs: calculatePerformanceCostSummary({ spendFacts: [], selectedBrandIds: [], leads: 0, bookings: 0, shows: 0, attributable: true }),
    sourceName: "Synthetic Lead Sheet", sourceStatus: live ? "connected" : "error",
    lastSuccessAt: null, loadedAt: live ? "2026-10-05T04:00:00Z" : null,
    brandColors: {}, trendSeries: [], live,
    diagnostics: { sourceRows: 0, acceptedRows: 0, unknownBrandRows: 0, invalidCreatedDateRows: 0, invalidShowDateRows: 0, invalidAppointmentDateRows: 0, uncategorizedTreatmentRows: 0 },
    warnings: live ? [] : ["到店報表資料未完整或格式未能核對，暫時未能確認 Show／No Show；請稍後重試。"],
  };
}
