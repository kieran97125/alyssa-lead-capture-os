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

const HK_OFFSET_MS = 8 * 60 * 60 * 1000;

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
