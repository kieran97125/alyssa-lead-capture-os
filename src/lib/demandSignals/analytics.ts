import type {
  DemandSignalAggregate,
  DemandSignalRecord,
  DemandSignalType,
} from "@/lib/demandSignals/types";

function distinctLeadCount(signals: DemandSignalRecord[]) {
  return new Set(signals.map((signal) => signal.outcome.distinctLeadKey).filter(Boolean)).size;
}

function aggregate(signals: DemandSignalRecord[], keyOf: (signal: DemandSignalRecord) => string) {
  const groups = new Map<string, DemandSignalRecord[]>();
  signals.forEach((signal) => {
    const key = keyOf(signal);
    groups.set(key, [...(groups.get(key) ?? []), signal]);
  });

  return Array.from(groups.entries()).map(([key, items]): DemandSignalAggregate => {
    const byLead = new Map<string, DemandSignalRecord[]>();
    items.forEach((item) => {
      const leadKey = item.outcome.distinctLeadKey;
      byLead.set(leadKey, [...(byLead.get(leadKey) ?? []), item]);
    });
    const leadOutcomes = Array.from(byLead.values()).map((leadSignals) => ({
      booked: leadSignals.some((item) => item.outcome.booked),
      showed: leadSignals.some((item) => item.outcome.showed),
      paid: leadSignals.some((item) => item.outcome.paid),
      revenue: Math.max(0, ...leadSignals.map((item) => item.outcome.revenue || 0)),
    }));
    const distinctLeads = leadOutcomes.length;
    const booked = leadOutcomes.filter((item) => item.booked).length;
    const showed = leadOutcomes.filter((item) => item.showed).length;
    const paid = leadOutcomes.filter((item) => item.paid).length;
    return {
      key,
      label: items[0]?.normalizedTag.replaceAll("_", " ") || key,
      signalType: items[0]?.signalType || ("need" as DemandSignalType),
      occurrences: items.length,
      distinctLeads,
      booked,
      showed,
      paid,
      revenue: leadOutcomes.reduce((sum, item) => sum + item.revenue, 0),
      bookRate: distinctLeads ? (booked / distinctLeads) * 100 : 0,
      showRate: distinctLeads ? (showed / distinctLeads) * 100 : 0,
      paidRate: distinctLeads ? (paid / distinctLeads) * 100 : 0,
    };
  });
}

export function aggregateTopDemandSignals(signals: DemandSignalRecord[]) {
  return aggregate(signals, (signal) => `${signal.signalType}:${signal.normalizedTag}`).sort(
    (a, b) => b.distinctLeads - a.distinctLeads || b.occurrences - a.occurrences
  );
}

export function aggregateDemandSignalOutcomes(signals: DemandSignalRecord[]) {
  return aggregate(signals, (signal) => signal.signalType).sort(
    (a, b) => b.distinctLeads - a.distinctLeads
  );
}

export function calculateDemandSignalTrend({
  current,
  previous,
}: {
  current: DemandSignalRecord[];
  previous: DemandSignalRecord[];
}) {
  const currentLeads = distinctLeadCount(current);
  const previousLeads = distinctLeadCount(previous);
  if (previousLeads === 0) return null;
  return Math.round(((currentLeads - previousLeads) / previousLeads) * 100);
}

export function buildDemandSignalHeadline(
  current: DemandSignalRecord[],
  previous: DemandSignalRecord[] = []
) {
  const byLead = new Map<string, DemandSignalRecord[]>();
  current.forEach((signal) => {
    const key = signal.outcome.distinctLeadKey;
    byLead.set(key, [...(byLead.get(key) ?? []), signal]);
  });
  const outcomes = Array.from(byLead.values()).map((signals) => ({
    booked: signals.some((signal) => signal.outcome.booked),
    showed: signals.some((signal) => signal.outcome.showed),
    paid: signals.some((signal) => signal.outcome.paid),
    revenue: Math.max(0, ...signals.map((signal) => signal.outcome.revenue || 0)),
  }));
  return {
    signals: current.length,
    distinctLeads: outcomes.length,
    booked: outcomes.filter((item) => item.booked).length,
    showed: outcomes.filter((item) => item.showed).length,
    paid: outcomes.filter((item) => item.paid).length,
    revenue: outcomes.reduce((sum, item) => sum + item.revenue, 0),
    trendPercent: calculateDemandSignalTrend({ current, previous }),
  };
}
