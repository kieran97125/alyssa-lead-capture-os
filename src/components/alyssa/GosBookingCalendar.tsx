"use client";

import type { CSSProperties } from "react";
import { DayPicker } from "@daypicker/react";
import { zhTW } from "@daypicker/react/locale";
import "@daypicker/react/style.css";

function parseDateInputValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day, 12);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return undefined;
  }

  return parsed;
}

function toDateInputValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function GosBookingCalendar({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (value: string) => void;
}) {
  const selectedDay = parseDateInputValue(value);

  return (
    <DayPicker
      mode="single"
      selected={selectedDay}
      defaultMonth={selectedDay}
      onSelect={(day) => {
        if (day) onSelect(toDateInputValue(day));
      }}
      locale={zhTW}
      navLayout="around"
      showOutsideDays
      className="mx-auto text-sm"
      style={
        {
          "--rdp-accent-color": "var(--public-cta)",
          "--rdp-accent-background-color": "var(--public-accent-soft)",
          "--rdp-day-height": "36px",
          "--rdp-day-width": "36px",
          "--rdp-day_button-height": "34px",
          "--rdp-day_button-width": "34px",
          "--rdp-nav_button-height": "34px",
          "--rdp-nav_button-width": "34px",
        } as CSSProperties
      }
      formatters={{
        formatCaption: (month) =>
          `${month.getFullYear()}年${month.getMonth() + 1}月`,
        formatWeekdayName: (day) =>
          ["日", "一", "二", "三", "四", "五", "六"][day.getDay()],
      }}
      labels={{
        labelPrevious: () => "上一個月",
        labelNext: () => "下一個月",
      }}
    />
  );
}
