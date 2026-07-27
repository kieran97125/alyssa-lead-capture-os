import { expect, test } from "@playwright/test";
import {
  aggregateTopDemandSignals,
  buildDemandSignalHeadline,
  calculateDemandSignalTrend,
} from "../src/lib/demandSignals/analytics";
import type { DemandSignalRecord } from "../src/lib/demandSignals/types";

function signal(
  id: string,
  leadKey: string,
  overrides: Partial<DemandSignalRecord> = {}
): DemandSignalRecord {
  return {
    id,
    brandId: "brand-1",
    signalType: "results",
    exactQuote: "幾多次先見效？",
    normalizedTag: "results_timeline",
    summary: null,
    sourceType: "whatsapp",
    status: "reviewed",
    confidence: 0.8,
    occurredAt: "2026-07-20T00:00:00.000Z",
    leadId: leadKey,
    contactId: `contact-${leadKey}`,
    formId: "form-1",
    treatmentId: "treatment-1",
    treatmentName: "Treatment",
    formName: "Form",
    sourceLabel: "WhatsApp",
    reviewedAt: "2026-07-20T00:00:00.000Z",
    outcome: {
      distinctLeadKey: leadKey,
      booked: false,
      showed: false,
      paid: false,
      revenue: 0,
    },
    ...overrides,
  };
}

test("deduplicates one lead captured from multiple sources", () => {
  const signals = [
    signal("signal-1", "lead-1", {
      outcome: {
        distinctLeadKey: "lead-1",
        booked: true,
        showed: false,
        paid: false,
        revenue: 0,
      },
    }),
    signal("signal-2", "lead-1", {
      sourceType: "lead_form",
      outcome: {
        distinctLeadKey: "lead-1",
        booked: true,
        showed: true,
        paid: true,
        revenue: 388,
      },
    }),
  ];

  const [aggregate] = aggregateTopDemandSignals(signals);
  const headline = buildDemandSignalHeadline(signals);

  expect(aggregate.occurrences).toBe(2);
  expect(aggregate.distinctLeads).toBe(1);
  expect(aggregate.booked).toBe(1);
  expect(aggregate.showed).toBe(1);
  expect(aggregate.paid).toBe(1);
  expect(aggregate.revenue).toBe(388);
  expect(headline.distinctLeads).toBe(1);
  expect(headline.revenue).toBe(388);
});

test("returns no trend when the prior period has no baseline", () => {
  expect(
    calculateDemandSignalTrend({ current: [signal("signal-1", "lead-1")], previous: [] })
  ).toBeNull();
});

test("calculates trend from distinct leads instead of signal occurrences", () => {
  const current = [
    signal("signal-1", "lead-1"),
    signal("signal-2", "lead-1"),
    signal("signal-3", "lead-2"),
  ];
  const previous = [signal("signal-4", "lead-3")];

  expect(calculateDemandSignalTrend({ current, previous })).toBe(100);
});
