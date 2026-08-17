import { expect, test } from "@playwright/test";
import {
  getPublicBookingHoursNotice,
  getPublicBookingTimeOptions,
} from "../src/lib/booking/publicBookingTimes";

const ALYSSA_IB_HOURS = {
  note: "星期一至五 早上11:00 – 晚上09:00\r\n星期六日及公眾假期 早上10:00 – 晚上08:00",
};

test("Alyssa and IB expose the same broad 10:00 to 20:30 preference window every day", () => {
  for (const appointmentDate of ["2026-08-12", "2026-08-15", "2026-10-01"]) {
    const times = getPublicBookingTimeOptions({
      openingHours: ALYSSA_IB_HOURS,
      appointmentDate,
      brandSlug: "ineffable",
    });

    expect(times).toHaveLength(22);
    expect(times[0]).toBe("10:00");
    expect(times.at(-1)).toBe("20:30");
    expect(times).toContain("10:30");
    expect(times).toContain("20:00");
  }
});

test("Alyssa and IB broad booking window does not depend on opening-hours data", () => {
  const times = getPublicBookingTimeOptions({
    openingHours: null,
    appointmentDate: "2026-08-12",
    brandSlug: "alyssa",
  });

  expect(times[0]).toBe("10:00");
  expect(times.at(-1)).toBe("20:30");
});

test("Alyssa and IB booking notice keeps the official opening hours visible", () => {
  const notice = getPublicBookingHoursNotice("ineffable-beauty");

  expect(notice).toContain("星期一至五 11:00–21:00");
  expect(notice).toContain("星期六日及公眾假期 10:00–20:00");
  expect(notice).toContain("實際時間由客服確認");
});

const GOS_HOURS = {
  note: "星期一至五 12:00–21:00\r\n星期六、日及公眾假期 11:00-19:00",
};

test("GOS weekday booking times follow the live branch opening hours", () => {
  const times = getPublicBookingTimeOptions({
    openingHours: GOS_HOURS,
    appointmentDate: "2026-08-17",
    brandSlug: "gos-beauty",
  });

  expect(times[0]).toBe("12:00");
  expect(times.at(-1)).toBe("20:30");
  expect(times).not.toContain("11:00");
  expect(times).toContain("20:00");
});

test("GOS weekend booking times stop before the 19:00 closing time", () => {
  const times = getPublicBookingTimeOptions({
    openingHours: GOS_HOURS,
    appointmentDate: "2026-08-22",
    brandSlug: "gos-beauty",
  });

  expect(times[0]).toBe("11:00");
  expect(times.at(-1)).toBe("18:30");
  expect(times).not.toContain("19:00");
  expect(times).not.toContain("19:30");
});

test("GOS weekday public holidays use the same hours as weekends", () => {
  const times = getPublicBookingTimeOptions({
    openingHours: GOS_HOURS,
    appointmentDate: "2027-01-01",
    brandSlug: "gos-beauty",
  });

  expect(times[0]).toBe("11:00");
  expect(times.at(-1)).toBe("18:30");
  expect(times).not.toContain("19:00");
});

test("GOS fallback keeps the official weekday hours if opening-hours data is unavailable", () => {
  const times = getPublicBookingTimeOptions({
    openingHours: null,
    appointmentDate: "2026-08-17",
    brandSlug: "gos-beauty",
  });

  expect(times[0]).toBe("12:00");
  expect(times.at(-1)).toBe("20:30");
});

test("GOS booking notice reflects the official schedule", () => {
  const notice = getPublicBookingHoursNotice("gos-beauty");

  expect(notice).toContain("星期一至五 12:00–21:00");
  expect(notice).toContain("星期六、日及公眾假期 11:00–19:00");
});
