export type PaceStatus =
  | "unconfigured"
  | "healthy"
  | "ahead"
  | "watch"
  | "behind"
  | "warning"
  | "critical"
  | "under";

export type HkMonthContext = {
  monthStart: string;
  monthEnd: string;
  today: string;
  throughDate: string;
  year: number;
  month: number;
  day: number;
  daysInMonth: number;
  elapsedDays: number;
  paceRatio: number;
  label: string;
  throughLabel: string;
};

export type CompletedHkReportRange = {
  startDate: string;
  endDate: string;
};

const HK_OFFSET_MS = 8 * 60 * 60 * 1000;
const MONTH_PATTERN = /^(\d{4})-(\d{2})(?:-\d{2})?$/;

function isoDate(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);
}

export function getHkMonthContext(now = new Date()): HkMonthContext {
  const hkNow = new Date(now.getTime() + HK_OFFSET_MS);
  const year = hkNow.getUTCFullYear();
  const monthIndex = hkNow.getUTCMonth();
  const day = hkNow.getUTCDate();
  const daysInMonth = new Date(
    Date.UTC(year, monthIndex + 1, 0)
  ).getUTCDate();
  const elapsedDays = Math.max(0, day - 1);
  const throughDate = isoDate(year, monthIndex, day - 1);
  const label = new Intl.DateTimeFormat("zh-HK", {
    year: "numeric",
    month: "long",
    timeZone: "Asia/Hong_Kong",
  }).format(now);
  const throughLabel =
    elapsedDays === 0
      ? "本月首日，暫未有完整日數"
      : `截至 ${new Intl.DateTimeFormat("zh-HK", {
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        }).format(new Date(`${throughDate}T00:00:00.000Z`))}`;

  return {
    monthStart: isoDate(year, monthIndex, 1),
    monthEnd: isoDate(year, monthIndex, daysInMonth),
    today: isoDate(year, monthIndex, day),
    throughDate,
    year,
    month: monthIndex + 1,
    day,
    daysInMonth,
    elapsedDays,
    paceRatio: daysInMonth > 0 ? elapsedDays / daysInMonth : 0,
    label,
    throughLabel,
  };
}

/**
 * Report defaults only include completed Hong Kong days. On the first day of
 * a month there are no completed days in the new month, so use the complete
 * previous month instead of returning an inverted range.
 */
export function getCompletedHkReportRange(
  now = new Date()
): CompletedHkReportRange {
  const month = getHkMonthContext(now);
  if (month.elapsedDays > 0) {
    return {
      startDate: month.monthStart,
      endDate: month.throughDate,
    };
  }

  return {
    startDate: `${month.throughDate.slice(0, 7)}-01`,
    endDate: month.throughDate,
  };
}

export function getHkMonthContextForMonth(
  requestedMonth: unknown,
  now = new Date()
): HkMonthContext {
  const current = getHkMonthContext(now);
  const match = String(requestedMonth ?? "").trim().match(MONTH_PATTERN);
  if (!match) return current;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 2020 || year > 2100 || month < 1 || month > 12) return current;

  const monthIndex = month - 1;
  const monthStart = isoDate(year, monthIndex, 1);
  if (monthStart === current.monthStart) return current;

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthEnd = isoDate(year, monthIndex, daysInMonth);
  const historical = monthStart < current.monthStart;
  const elapsedDays = historical ? daysInMonth : 0;
  const reference = new Date(`${monthStart}T00:00:00.000Z`);

  return {
    monthStart,
    monthEnd,
    today: current.today,
    throughDate: historical ? monthEnd : monthStart,
    year,
    month,
    day: historical ? daysInMonth : 1,
    daysInMonth,
    elapsedDays,
    paceRatio: historical ? 1 : 0,
    label: new Intl.DateTimeFormat("zh-HK", {
      year: "numeric",
      month: "long",
      timeZone: "UTC",
    }).format(reference),
    throughLabel: historical ? `完整 ${daysInMonth} 日` : "未來月份",
  };
}

export function expectedAtPace(target: number, paceRatio: number) {
  if (!Number.isFinite(target) || target <= 0) return 0;
  return target * Math.max(0, Math.min(1, paceRatio));
}

export function forecastAtMonthEnd(
  actual: number,
  elapsedDays: number,
  daysInMonth: number
) {
  if (elapsedDays <= 0 || actual <= 0) return 0;
  return (actual / elapsedDays) * daysInMonth;
}

export function budgetPaceStatus(
  actual: number,
  budget: number,
  expected: number,
  elapsedDays: number
): PaceStatus {
  if (budget <= 0) return "unconfigured";
  if (elapsedDays <= 0 || expected <= 0) return "healthy";
  if (actual > expected * 1.2) return "critical";
  if (actual > expected * 1.1) return "warning";
  if (elapsedDays >= 4 && actual < expected * 0.75) return "under";
  return "healthy";
}

export function kpiPaceStatus(
  actual: number,
  target: number,
  expected: number
): PaceStatus {
  if (target <= 0) return "unconfigured";
  if (expected <= 0 || actual >= expected) return "ahead";
  if (actual >= expected * 0.9) return "watch";
  return "behind";
}

export function percentage(actual: number, target: number) {
  if (target <= 0) return 0;
  return Math.max(0, actual / target);
}

export function delta(actual: number, expected: number) {
  return actual - expected;
}
