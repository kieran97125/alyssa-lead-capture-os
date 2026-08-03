export type DailyBaseMetrics = {
  spend: number;
  leads: number;
  bookings: number;
  shows: number;
};

export type DailyDerivedMetrics = DailyBaseMetrics & {
  bookingRate: number | null;
  showRate: number | null;
  leadToShowRate: number | null;
  cpl: number | null;
  costPerBooking: number | null;
  costPerShow: number | null;
};

export type DailyTargetPace = {
  leads: number;
  bookings: number;
  shows: number;
};

export function emptyDailyBaseMetrics(): DailyBaseMetrics {
  return { spend: 0, leads: 0, bookings: 0, shows: 0 };
}

export function addDailyBaseMetrics(
  left: DailyBaseMetrics,
  right: DailyBaseMetrics
): DailyBaseMetrics {
  return {
    spend: left.spend + right.spend,
    leads: left.leads + right.leads,
    bookings: left.bookings + right.bookings,
    shows: left.shows + right.shows,
  };
}

function safeRatio(numerator: number, denominator: number) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  return denominator > 0 ? numerator / denominator : null;
}

export function deriveDailyMetrics(
  base: DailyBaseMetrics
): DailyDerivedMetrics {
  return {
    ...base,
    bookingRate: safeRatio(base.bookings, base.leads),
    showRate: safeRatio(base.shows, base.bookings),
    leadToShowRate: safeRatio(base.shows, base.leads),
    cpl: safeRatio(base.spend, base.leads),
    costPerBooking: safeRatio(base.spend, base.bookings),
    costPerShow: safeRatio(base.spend, base.shows),
  };
}

export function targetPaceAtDay(input: {
  leadTarget: number;
  bookingTarget: number;
  showTarget: number;
  day: number;
  daysInMonth: number;
}): DailyTargetPace {
  const ratio =
    input.daysInMonth > 0
      ? Math.max(0, Math.min(1, input.day / input.daysInMonth))
      : 0;
  return {
    leads: input.leadTarget * ratio,
    bookings: input.bookingTarget * ratio,
    shows: input.showTarget * ratio,
  };
}

export function targetAttainment(actual: number, expected: number) {
  return safeRatio(actual, expected);
}
