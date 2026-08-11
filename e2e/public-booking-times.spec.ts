import { expect, test } from "@playwright/test";
import { getPublicBookingTimeOptions } from "../src/lib/booking/publicBookingTimes";

const ALYSSA_IB_HOURS = {
  note: "星期一至五 早上11:00 – 晚上09:00\r\n星期六日及公眾假期 早上10:00 – 晚上08:00",
};

test("Alyssa and IB weekday forms expose every half-hour start time", () => {
  const times = getPublicBookingTimeOptions({
    openingHours: ALYSSA_IB_HOURS,
    appointmentDate: "2026-08-12",
    brandSlug: "alyssa",
  });

  expect(times).toHaveLength(20);
  expect(times[0]).toBe("11:00");
  expect(times.at(-1)).toBe("20:30");
  expect(times).toContain("11:30");
  expect(times).toContain("16:30");
  expect(times).toContain("19:30");
});

test("Alyssa and IB weekend forms follow the earlier weekend hours", () => {
  const times = getPublicBookingTimeOptions({
    openingHours: ALYSSA_IB_HOURS,
    appointmentDate: "2026-08-15",
    brandSlug: "ineffable",
  });

  expect(times).toHaveLength(20);
  expect(times[0]).toBe("10:00");
  expect(times.at(-1)).toBe("19:30");
  expect(times).toContain("10:30");
  expect(times).not.toContain("20:00");
});

test("standard-form schedule keeps a safe brand fallback when branch hours are missing", () => {
  const weekday = getPublicBookingTimeOptions({
    openingHours: null,
    appointmentDate: "2026-08-12",
    brandSlug: "ineffable-beauty",
  });
  const weekend = getPublicBookingTimeOptions({
    openingHours: null,
    appointmentDate: "2026-08-15",
    brandSlug: "ineffable-beauty",
  });

  expect(weekday[0]).toBe("11:00");
  expect(weekday.at(-1)).toBe("20:30");
  expect(weekend[0]).toBe("10:00");
  expect(weekend.at(-1)).toBe("19:30");
});
