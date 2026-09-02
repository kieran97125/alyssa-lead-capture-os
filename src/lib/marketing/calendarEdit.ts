import type { CalendarItem } from "@/lib/marketing/commandCenter";

export const editableCalendarItemTypes = [
  "post",
  "ad",
  "landing_page",
  "email",
  "meeting",
  "task",
] as const;

export type EditableCalendarItemType =
  (typeof editableCalendarItemTypes)[number];

export const editableCalendarStatuses = [
  "idea",
  "scheduled",
  "published",
] as const;

export type EditableCalendarStatus =
  (typeof editableCalendarStatuses)[number];

export type CalendarTreatmentOption = {
  id: string;
  brandId: string;
  name: string;
};

export type CalendarItemUpdateInput = {
  itemId: string;
  expectedUpdatedAt: string | null;
  brandId: string;
  treatmentId: string | null;
  title: string;
  itemType: EditableCalendarItemType;
  channel: string | null;
  status: EditableCalendarStatus;
  scheduledDate: string;
  scheduledTime: string | null;
  assigneeEmail: string | null;
  notes: string | null;
  showOnPerformanceTimeline: boolean;
};

export type CalendarItemUpdateResult = {
  ok: boolean;
  message: string;
  item?: CalendarItem;
  linkedTaskCount?: number;
  linkedCreativeJobCount?: number;
};
