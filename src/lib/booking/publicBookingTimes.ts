export type PublicBranchOpeningHours =
  | { note?: string | null }
  | string
  | null
  | undefined;

type OpeningRange = {
  startMinutes: number;
  endMinutes: number;
};

type BookingTimeOptionsInput = {
  openingHours?: PublicBranchOpeningHours;
  appointmentDate?: string;
  brandSlug?: string | null;
};

const HALF_HOUR_MINUTES = 30;

function normalizeBrandSlug(value: string | null | undefined) {
  const slug = (value || "").trim().toLowerCase();
  return slug === "ineffable-beauty" ? "ineffable" : slug;
}

function openingHoursNote(value: PublicBranchOpeningHours) {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";
  return typeof value.note === "string" ? value.note.trim() : "";
}

function parseDateInput(value: string | undefined) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function to24HourMinutes(
  daypart: string | undefined,
  hourValue: string,
  minuteValue: string
) {
  let hour = Number(hourValue);
  const minute = Number(minuteValue);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  const marker = (daypart || "").trim();
  if (marker === "下午" || marker === "晚上") {
    if (hour < 12) hour += 12;
  } else if (marker === "中午") {
    if (hour < 11) hour += 12;
  } else if ((marker === "早上" || marker === "上午") && hour === 12) {
    hour = 0;
  }

  return hour * 60 + minute;
}

function parseOpeningRange(line: string): OpeningRange | null {
  const match = line.match(
    /(早上|上午|中午|下午|晚上)?\s*(\d{1,2}):(\d{2})\s*[–—-]\s*(早上|上午|中午|下午|晚上)?\s*(\d{1,2}):(\d{2})/
  );
  if (!match) return null;

  const startMinutes = to24HourMinutes(match[1], match[2], match[3]);
  const endMinutes = to24HourMinutes(match[4], match[5], match[6]);
  if (startMinutes === null || endMinutes === null) return null;
  if (endMinutes <= startMinutes) return null;

  return { startMinutes, endMinutes };
}

function fallbackRange(
  brandSlug: string | null | undefined,
  isWeekend: boolean
): OpeningRange {
  const slug = normalizeBrandSlug(brandSlug);
  if (slug === "alyssa" || slug === "ineffable") {
    return isWeekend
      ? { startMinutes: 10 * 60, endMinutes: 20 * 60 }
      : { startMinutes: 11 * 60, endMinutes: 21 * 60 };
  }

  return { startMinutes: 11 * 60, endMinutes: 20 * 60 };
}

function resolveOpeningRange({
  openingHours,
  appointmentDate,
  brandSlug,
}: BookingTimeOptionsInput): OpeningRange {
  const date = parseDateInput(appointmentDate);
  const isWeekend = Boolean(date && (date.getDay() === 0 || date.getDay() === 6));
  const note = openingHoursNote(openingHours);
  const lines = note
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const preferredLine = isWeekend
    ? lines.find((line) => /星期六|星期日|六日|公眾假期/.test(line))
    : lines.find((line) => /星期一至五|星期一.*星期五|平日/.test(line));
  const parsedPreferred = preferredLine ? parseOpeningRange(preferredLine) : null;
  if (parsedPreferred) return parsedPreferred;

  const parsedFirst = lines.map(parseOpeningRange).find(Boolean);
  return parsedFirst || fallbackRange(brandSlug, isWeekend);
}

function formatTime(minutes: number) {
  const hour = String(Math.floor(minutes / 60)).padStart(2, "0");
  const minute = String(minutes % 60).padStart(2, "0");
  return `${hour}:${minute}`;
}

export function getPublicBookingTimeOptions(
  input: BookingTimeOptionsInput
): string[] {
  const range = resolveOpeningRange(input);
  const output: string[] = [];

  // Each selectable value is a preferred treatment start time. The final slot
  // therefore begins 30 minutes before the branch closing time; CS still owns
  // the final availability confirmation shown in the form copy.
  for (
    let minutes = range.startMinutes;
    minutes <= range.endMinutes - HALF_HOUR_MINUTES;
    minutes += HALF_HOUR_MINUTES
  ) {
    output.push(formatTime(minutes));
  }

  return output;
}
