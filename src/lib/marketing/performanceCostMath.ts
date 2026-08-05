import { calculateComparisonKpis } from "@/lib/marketing/periodComparisonMath";

export type DailySpendFact = {
  brandId: string;
  spendDate: string;
  amount: number;
};

export type PerformanceCostAvailability =
  | "available"
  | "partial"
  | "missing"
  | "unallocated";

export type PerformanceCostSummary = {
  spend: number | null;
  cpl: number | null;
  costPerBooking: number | null;
  costPerShow: number | null;
  availability: PerformanceCostAvailability;
  spendCoverageDays: number;
  trackedBrandCount: number;
  selectedBrandCount: number;
};

function unavailableCostSummary(input: {
  availability: "missing" | "unallocated";
  selectedBrandCount: number;
}): PerformanceCostSummary {
  return {
    spend: null,
    cpl: null,
    costPerBooking: null,
    costPerShow: null,
    availability: input.availability,
    spendCoverageDays: 0,
    trackedBrandCount: 0,
    selectedBrandCount: input.selectedBrandCount,
  };
}

export function calculatePerformanceCostSummary(input: {
  spendFacts: DailySpendFact[];
  selectedBrandIds: string[];
  leads: number;
  bookings: number;
  shows: number;
  attributable: boolean;
}): PerformanceCostSummary {
  const selectedBrandIds = Array.from(new Set(input.selectedBrandIds));
  if (!input.attributable) {
    return unavailableCostSummary({
      availability: "unallocated",
      selectedBrandCount: selectedBrandIds.length,
    });
  }
  if (selectedBrandIds.length === 0) {
    return unavailableCostSummary({
      availability: "missing",
      selectedBrandCount: 0,
    });
  }

  const selectedBrands = new Set(selectedBrandIds);
  const applicableFacts = input.spendFacts.filter((fact) =>
    selectedBrands.has(fact.brandId)
  );
  if (applicableFacts.length === 0) {
    return unavailableCostSummary({
      availability: "missing",
      selectedBrandCount: selectedBrandIds.length,
    });
  }

  const trackedBrands = new Set(applicableFacts.map((fact) => fact.brandId));
  const spendCoverageDays = new Set(
    applicableFacts.map((fact) => fact.spendDate)
  ).size;
  const metrics = calculateComparisonKpis({
    spend: applicableFacts.reduce(
      (sum, fact) =>
        sum + (Number.isFinite(fact.amount) ? Math.max(0, fact.amount) : 0),
      0
    ),
    leads: input.leads,
    bookings: input.bookings,
    shows: input.shows,
  });

  return {
    spend: metrics.spend,
    cpl: metrics.cpl,
    costPerBooking: metrics.costPerBooking,
    costPerShow: metrics.costPerShow,
    availability:
      trackedBrands.size === selectedBrandIds.length ? "available" : "partial",
    spendCoverageDays,
    trackedBrandCount: trackedBrands.size,
    selectedBrandCount: selectedBrandIds.length,
  };
}
