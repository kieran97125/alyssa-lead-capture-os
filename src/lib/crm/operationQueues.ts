import type { CrmLeadCase } from "@/lib/crm/leadOps";

type QueueCase = Pick<CrmLeadCase, "status" | "nextFollowUpAt" | "confirmedBookingDate" | "confirmedBookingTime">;

const hongKongDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Hong_Kong",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function crmDayKey(value: Date | number) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = hongKongDay.formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function isCrmToday(value: string | null, now = Date.now()) {
  if (!value) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && crmDayKey(date) === crmDayKey(now);
}

export function isCrmTodayDateOnly(value: string | null, now = Date.now()) {
  return Boolean(value && value === crmDayKey(now));
}

export function parseCrmBookingDateTime(date: string | null, time: string | null) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const normalizedTime = time ? (time.length === 5 ? `${time}:00` : time) : "23:59:59";
  if (!/^\d{2}:\d{2}:\d{2}$/.test(normalizedTime)) return null;
  const parsed = new Date(`${date}T${normalizedTime}+08:00`);
  return Number.isFinite(parsed.getTime()) && crmDayKey(parsed) === date ? parsed : null;
}

export function isCrmTodayFollowUp(item: QueueCase, now = Date.now()) {
  return isCrmToday(item.nextFollowUpAt, now);
}

export function isCrmOverdueFollowUp(item: QueueCase, now = Date.now()) {
  if (!item.nextFollowUpAt) return false;
  const date = new Date(item.nextFollowUpAt);
  return Number.isFinite(date.getTime()) && date.getTime() < now && !isCrmTodayFollowUp(item, now);
}

export function isCrmTodayBooking(item: QueueCase, now = Date.now()) {
  return item.status === "booked" && isCrmTodayDateOnly(item.confirmedBookingDate, now);
}

export function isCrmPendingShowOutcome(item: QueueCase, now = Date.now()) {
  if (item.status !== "booked") return false;
  const date = parseCrmBookingDateTime(item.confirmedBookingDate, item.confirmedBookingTime);
  return Boolean(date && date.getTime() <= now);
}

export function matchesCrmQueue(item: QueueCase, queue: string, now = Date.now()) {
  if (!queue) return true;
  if (queue === "follow_up_today") return isCrmTodayFollowUp(item, now);
  if (queue === "follow_up_overdue") return isCrmOverdueFollowUp(item, now);
  if (queue === "today_bookings") return isCrmTodayBooking(item, now);
  if (queue === "pending_show_outcome") return isCrmPendingShowOutcome(item, now);
  if (queue === "contacting") return ["contacting", "contacted"].includes(item.status);
  if (queue === "new") return ["new", "pending_follow_up"].includes(item.status);
  return item.status === queue;
}

/** Completed appointment outcomes remain visible in the appointment workspace. */
export function filterCrmBookingQueue<T extends QueueCase>(cases: T[], queue = "", now = Date.now()) {
  return cases.filter((item) =>
    ["booked", "showed", "no_show", "cancelled"].includes(item.status) && matchesCrmQueue(item, queue, now)
  );
}
