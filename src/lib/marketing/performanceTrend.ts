import {
  annotationMatchesTreatment,
  type OperationalAnnotation,
} from "@/lib/marketing/operationalAnnotations";

export type PerformanceTrendMetricKey =
  | "spend"
  | "leads"
  | "bookings"
  | "shows"
  | "noShows"
  | "pendingShows"
  | "cpl"
  | "costPerBooking"
  | "costPerShow"
  | "leadToBookRate"
  | "bookToShowRate"
  | "leadToShowRate"
  | "noShowRate";

export type PerformanceTrendBaseMetrics = {
  spend: number;
  leads: number;
  bookings: number;
  shows: number;
  noShows: number;
  pendingShows: number;
};

export type PerformanceTrendPoint = PerformanceTrendBaseMetrics & {
  day: number;
  date: string;
  cpl: number | null;
  costPerBooking: number | null;
  costPerShow: number | null;
  leadToBookRate: number | null;
  bookToShowRate: number | null;
  leadToShowRate: number | null;
  noShowRate: number | null;
  annotations: OperationalAnnotation[];
};

export type PerformanceTrendSeries = {
  key: string;
  label: string;
  color: string;
  monthStart?: string;
  brandId?: string;
  treatmentLabel?: string;
  points: PerformanceTrendPoint[];
};

export type PerformanceTrendScope = {
  key: string;
  type: "overall" | "brand" | "treatment";
  label: string;
  description: string;
  availableMetrics: PerformanceTrendMetricKey[];
  series: PerformanceTrendSeries[];
};

export type PerformanceTrendMode = "daily" | "cumulative";

export type TreatmentTrendFact = {
  brandId: string;
  brandName: string;
  metricDate: string;
  metricKind: "lead" | "book" | "show" | "no_show" | "pending_show";
  treatmentLabel: string;
  metricCount: number;
};

const treatmentPalette = [
  "#5A2348",
  "#C9828E",
  "#3F91B4",
  "#D3913E",
  "#5F806E",
  "#826AA4",
];

export const brandTrendMetricKeys: PerformanceTrendMetricKey[] = [
  "spend",
  "leads",
  "bookings",
  "shows",
  "noShows",
  "pendingShows",
  "cpl",
  "costPerBooking",
  "costPerShow",
  "leadToBookRate",
  "bookToShowRate",
  "leadToShowRate",
  "noShowRate",
];

export const treatmentTrendMetricKeys: PerformanceTrendMetricKey[] = [
  "leads",
  "bookings",
  "shows",
  "noShows",
  "pendingShows",
  "leadToBookRate",
  "bookToShowRate",
  "leadToShowRate",
  "noShowRate",
];

function safeRatio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}

function finiteNonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function emptyPerformanceTrendBase(): PerformanceTrendBaseMetrics {
  return {
    spend: 0,
    leads: 0,
    bookings: 0,
    shows: 0,
    noShows: 0,
    pendingShows: 0,
  };
}

export function accumulatePerformanceTrendPoints(
  points: PerformanceTrendPoint[]
): PerformanceTrendPoint[] {
  const cumulative = emptyPerformanceTrendBase();
  return points.map((point) => {
    cumulative.spend += finiteNonNegative(point.spend);
    cumulative.leads += finiteNonNegative(point.leads);
    cumulative.bookings += finiteNonNegative(point.bookings);
    cumulative.shows += finiteNonNegative(point.shows);
    cumulative.noShows += finiteNonNegative(point.noShows);
    cumulative.pendingShows += finiteNonNegative(point.pendingShows);
    return calculatePerformanceTrendPoint(cumulative, {
      day: point.day,
      date: point.date,
      annotations: point.annotations,
    });
  });
}

export function performanceTrendPointsForMode(
  points: PerformanceTrendPoint[],
  mode: PerformanceTrendMode
) {
  return mode === "cumulative"
    ? accumulatePerformanceTrendPoints(points)
    : points;
}

export function calculatePerformanceTrendPoint(
  input: PerformanceTrendBaseMetrics,
  context: {
    day: number;
    date: string;
    annotations?: OperationalAnnotation[];
  }
): PerformanceTrendPoint {
  const spend = finiteNonNegative(input.spend);
  const leads = finiteNonNegative(input.leads);
  const bookings = finiteNonNegative(input.bookings);
  const shows = finiteNonNegative(input.shows);
  const noShows = finiteNonNegative(input.noShows);
  const pendingShows = finiteNonNegative(input.pendingShows);
  return {
    day: context.day,
    date: context.date,
    spend,
    leads,
    bookings,
    shows,
    noShows,
    pendingShows,
    cpl: safeRatio(spend, leads),
    costPerBooking: safeRatio(spend, bookings),
    costPerShow: safeRatio(spend, shows),
    leadToBookRate: safeRatio(bookings, leads),
    bookToShowRate: safeRatio(shows, bookings),
    leadToShowRate: safeRatio(shows, leads),
    noShowRate: safeRatio(noShows, bookings),
    annotations: context.annotations ?? [],
  };
}

function addFactToBase(
  base: PerformanceTrendBaseMetrics,
  fact: TreatmentTrendFact
) {
  const value = finiteNonNegative(fact.metricCount);
  if (fact.metricKind === "lead") base.leads += value;
  if (fact.metricKind === "book") base.bookings += value;
  if (fact.metricKind === "show") base.shows += value;
  if (fact.metricKind === "no_show") base.noShows += value;
  if (fact.metricKind === "pending_show") base.pendingShows += value;
}

function isoDates(startDate: string, endDate: string) {
  const dates: string[] = [];
  const current = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  while (current <= end && dates.length <= 366) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

export function buildDailyTreatmentTrend(input: {
  facts: TreatmentTrendFact[];
  annotations: OperationalAnnotation[];
  startDate: string;
  endDate: string;
  brandColors: Record<string, string>;
  maxSeries?: number;
}) {
  const groups = new Map<
    string,
    {
      brandId: string;
      brandName: string;
      treatmentLabel: string;
      facts: TreatmentTrendFact[];
      leads: number;
    }
  >();
  for (const fact of input.facts) {
    const key = JSON.stringify([fact.brandId, fact.treatmentLabel]);
    const group = groups.get(key) ?? {
      brandId: fact.brandId,
      brandName: fact.brandName,
      treatmentLabel: fact.treatmentLabel,
      facts: [],
      leads: 0,
    };
    group.facts.push(fact);
    if (fact.metricKind === "lead") group.leads += fact.metricCount;
    groups.set(key, group);
  }

  const ranked = Array.from(groups.entries()).sort(
    ([, left], [, right]) =>
      right.leads - left.leads ||
      left.treatmentLabel.localeCompare(right.treatmentLabel, "zh-HK")
  );
  const maxSeries = Math.max(1, Math.min(12, input.maxSeries ?? 6));
  const selected = ranked.slice(0, maxSeries);
  const dates = isoDates(input.startDate, input.endDate);
  const multipleBrands = new Set(selected.map(([, group]) => group.brandId)).size > 1;

  const series = selected.map(([key, group], index): PerformanceTrendSeries => {
    const factsByDate = new Map<string, TreatmentTrendFact[]>();
    for (const fact of group.facts) {
      factsByDate.set(fact.metricDate, [
        ...(factsByDate.get(fact.metricDate) ?? []),
        fact,
      ]);
    }
    return {
      key,
      label: multipleBrands
        ? `${group.brandName} · ${group.treatmentLabel}`
        : group.treatmentLabel,
      color:
        selected.length === 1
          ? input.brandColors[group.brandId] || treatmentPalette[0]
          : treatmentPalette[index % treatmentPalette.length],
      brandId: group.brandId,
      treatmentLabel: group.treatmentLabel,
      points: dates.map((date, dateIndex) => {
        const base = emptyPerformanceTrendBase();
        for (const fact of factsByDate.get(date) ?? []) addFactToBase(base, fact);
        const annotations = input.annotations.filter(
          (annotation) =>
            annotation.date === date &&
            annotationMatchesTreatment(
              annotation,
              group.brandId,
              group.treatmentLabel
            )
        );
        return calculatePerformanceTrendPoint(base, {
          day: dateIndex + 1,
          date,
          annotations,
        });
      }),
    };
  });

  return {
    series,
    totalSeriesCount: ranked.length,
    shownSeriesCount: selected.length,
  };
}

export function buildDailyTreatmentTrendPoints(input: {
  facts: TreatmentTrendFact[];
  annotations: OperationalAnnotation[];
  brandId: string;
  treatmentLabel: string;
  startDate: string;
  endDate: string;
}) {
  const dates = isoDates(input.startDate, input.endDate);
  const factsByDate = new Map<string, TreatmentTrendFact[]>();
  for (const fact of input.facts) {
    if (
      fact.brandId !== input.brandId ||
      fact.treatmentLabel !== input.treatmentLabel
    ) {
      continue;
    }
    factsByDate.set(fact.metricDate, [
      ...(factsByDate.get(fact.metricDate) ?? []),
      fact,
    ]);
  }
  return dates.map((date) => {
    const base = emptyPerformanceTrendBase();
    for (const fact of factsByDate.get(date) ?? []) addFactToBase(base, fact);
    return calculatePerformanceTrendPoint(base, {
      day: Number(date.slice(-2)),
      date,
      annotations: input.annotations.filter(
        (annotation) =>
          annotation.date === date &&
          annotationMatchesTreatment(
            annotation,
            input.brandId,
            input.treatmentLabel
          )
      ),
    });
  });
}

export function buildCumulativeTreatmentTrend(input: {
  facts: TreatmentTrendFact[];
  annotations: OperationalAnnotation[];
  brandId: string;
  treatmentLabel: string;
  startDate: string;
  endDate: string;
}) {
  return accumulatePerformanceTrendPoints(
    buildDailyTreatmentTrendPoints(input)
  );
}
