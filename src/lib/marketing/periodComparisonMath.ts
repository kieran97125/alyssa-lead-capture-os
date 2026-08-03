export type ComparisonMetricKey =
  | "spend"
  | "leads"
  | "bookings"
  | "shows"
  | "cpl"
  | "costPerBooking"
  | "costPerShow"
  | "leadToBookRate"
  | "bookToShowRate"
  | "leadToShowRate";

export type ComparisonBaseMetrics = {
  spend: number;
  leads: number;
  bookings: number;
  shows: number;
};

export type ComparisonKpis = ComparisonBaseMetrics & {
  cpl: number | null;
  costPerBooking: number | null;
  costPerShow: number | null;
  leadToBookRate: number | null;
  bookToShowRate: number | null;
  leadToShowRate: number | null;
};

export type ComparisonPeriod = {
  monthStart: string;
  startDate: string;
  endDate: string;
  startDay: number;
  endDay: number;
  expectedDays: number;
};

export type CanonicalComparisonMetricRow = ComparisonBaseMetrics & {
  brandId: string;
  metricDate: string;
};

export type ComparisonTrendPoint = ComparisonKpis & {
  day: number;
  date: string;
};

export type PeriodComparisonTrendSeries = {
  monthStart: string;
  label: string;
  color: string;
  points: ComparisonTrendPoint[];
};

const monthPattern = /^(\d{4})-(\d{2})(?:-01)?$/;

function finiteNonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function safeRatio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}

export function calculateComparisonKpis(
  input: ComparisonBaseMetrics
): ComparisonKpis {
  const spend = finiteNonNegative(input.spend);
  const leads = finiteNonNegative(input.leads);
  const bookings = finiteNonNegative(input.bookings);
  const shows = finiteNonNegative(input.shows);

  return {
    spend,
    leads,
    bookings,
    shows,
    cpl: safeRatio(spend, leads),
    costPerBooking: safeRatio(spend, bookings),
    costPerShow: safeRatio(spend, shows),
    leadToBookRate: safeRatio(bookings, leads),
    bookToShowRate: safeRatio(shows, bookings),
    leadToShowRate: safeRatio(shows, leads),
  };
}

export function relativeComparisonChange(
  current: number | null,
  previous: number | null
) {
  if (current === null || previous === null) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / Math.abs(previous);
}

export function normalizeComparisonMonth(value: unknown) {
  const match = String(value ?? "").trim().match(monthPattern);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 2020 || year > 2100 || month < 1 || month > 12) return null;
  return `${match[1]}-${match[2]}-01`;
}

export function comparisonMonthDays(monthStart: string) {
  const normalized = normalizeComparisonMonth(monthStart);
  if (!normalized) return 0;
  const [year, month] = normalized.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function shiftComparisonMonth(monthStart: string, offset: number) {
  const normalized = normalizeComparisonMonth(monthStart);
  if (!normalized || !Number.isInteger(offset)) return null;
  const [year, month] = normalized.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + offset, 1));
  return shifted.toISOString().slice(0, 10);
}

function clampDay(value: number, max: number, fallback: number) {
  if (!Number.isInteger(value)) return fallback;
  return Math.max(1, Math.min(max, value));
}

export function createComparisonPeriods(input: {
  anchorMonth: string;
  monthCount: number;
  startDay: number;
  endDay: number;
}): ComparisonPeriod[] {
  const anchorMonth = normalizeComparisonMonth(input.anchorMonth);
  if (!anchorMonth) return [];
  const monthCount = Math.max(2, Math.min(12, Math.trunc(input.monthCount)));

  return Array.from({ length: monthCount }, (_, index) => {
    const monthStart = shiftComparisonMonth(anchorMonth, -index) as string;
    const daysInMonth = comparisonMonthDays(monthStart);
    const startDay = clampDay(input.startDay, daysInMonth, 1);
    const requestedEnd = clampDay(input.endDay, daysInMonth, daysInMonth);
    const endDay = Math.max(startDay, requestedEnd);
    const monthPrefix = monthStart.slice(0, 8);
    return {
      monthStart,
      startDate: `${monthPrefix}${String(startDay).padStart(2, "0")}`,
      endDate: `${monthPrefix}${String(endDay).padStart(2, "0")}`,
      startDay,
      endDay,
      expectedDays: endDay - startDay + 1,
    };
  });
}

export function aggregateComparisonRows(
  rows: CanonicalComparisonMetricRow[],
  brandIds?: Set<string>
) {
  const totals = rows.reduce<ComparisonBaseMetrics>(
    (sum, row) => {
      if (brandIds && !brandIds.has(row.brandId)) return sum;
      sum.spend += finiteNonNegative(row.spend);
      sum.leads += finiteNonNegative(row.leads);
      sum.bookings += finiteNonNegative(row.bookings);
      sum.shows += finiteNonNegative(row.shows);
      return sum;
    },
    { spend: 0, leads: 0, bookings: 0, shows: 0 }
  );
  return calculateComparisonKpis(totals);
}

export function buildCumulativeComparisonTrend(input: {
  period: ComparisonPeriod;
  rows: CanonicalComparisonMetricRow[];
  brandIds?: Set<string>;
}): ComparisonTrendPoint[] {
  const byDate = new Map<string, ComparisonBaseMetrics>();
  for (const row of input.rows) {
    if (input.brandIds && !input.brandIds.has(row.brandId)) continue;
    const existing = byDate.get(row.metricDate) ?? {
      spend: 0,
      leads: 0,
      bookings: 0,
      shows: 0,
    };
    existing.spend += finiteNonNegative(row.spend);
    existing.leads += finiteNonNegative(row.leads);
    existing.bookings += finiteNonNegative(row.bookings);
    existing.shows += finiteNonNegative(row.shows);
    byDate.set(row.metricDate, existing);
  }

  const cumulative: ComparisonBaseMetrics = {
    spend: 0,
    leads: 0,
    bookings: 0,
    shows: 0,
  };
  const points: ComparisonTrendPoint[] = [];
  const prefix = input.period.monthStart.slice(0, 8);
  for (let day = input.period.startDay; day <= input.period.endDay; day += 1) {
    const date = `${prefix}${String(day).padStart(2, "0")}`;
    const metric = byDate.get(date);
    if (metric) {
      cumulative.spend += metric.spend;
      cumulative.leads += metric.leads;
      cumulative.bookings += metric.bookings;
      cumulative.shows += metric.shows;
    }
    points.push({
      day,
      date,
      ...calculateComparisonKpis(cumulative),
    });
  }
  return points;
}
