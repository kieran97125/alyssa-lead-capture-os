"use client";

import { useMemo, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import {
  deleteCalendarItemAction,
  moveCalendarItemAction,
} from "@/app/command-center/actions";
import type { CalendarItem } from "@/lib/marketing/commandCenter";

type CalendarBrand = {
  id: string;
  name: string;
  color: string;
};

const weekdays = ["一", "二", "三", "四", "五", "六", "日"];

function calendarDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
    2,
    "0"
  )}`;
}

function itemTypeLabel(type: CalendarItem["itemType"]) {
  const labels: Record<CalendarItem["itemType"], string> = {
    post: "Post",
    ad: "廣告",
    landing_page: "LP",
    email: "Email",
    meeting: "會議",
    task: "任務",
  };
  return labels[type];
}

function CalendarTaskCard({
  item,
  brand,
  overlay = false,
  deleting = false,
  onDelete,
}: {
  item: CalendarItem;
  brand: CalendarBrand | undefined;
  overlay?: boolean;
  deleting?: boolean;
  onDelete?: (item: CalendarItem) => void;
}) {
  const draggable = useDraggable({
    id: item.id,
    disabled: overlay,
    data: { scheduledDate: item.scheduledDate },
  });
  const style = overlay
    ? undefined
    : {
        transform: CSS.Translate.toString(draggable.transform),
        opacity: draggable.isDragging ? 0.35 : 1,
        borderLeftColor: brand?.color || "#5a2348",
      };

  return (
    <article
      ref={overlay ? undefined : draggable.setNodeRef}
      style={style}
      className={`calendar-task ${overlay ? "is-overlay" : ""}`}
      {...(overlay ? {} : draggable.attributes)}
      {...(overlay ? {} : draggable.listeners)}
    >
      <div>
        <span>
          {itemTypeLabel(item.itemType)}
          {item.channel ? <small>{item.channel}</small> : null}
        </span>
        {!overlay && onDelete ? (
          <button
            type="button"
            className="calendar-task-delete"
            aria-label={`刪除事項：${item.title}`}
            title="刪除事項"
            disabled={deleting}
            onPointerDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onDelete(item);
            }}
          >
            <Trash2 size={11} />
          </button>
        ) : null}
      </div>
      <strong>{item.title}</strong>
      <footer>
        <span
          className="calendar-task-brand-dot"
          style={{ background: brand?.color || "#5a2348" }}
        />
        <span>{brand?.name || "未設定品牌"}</span>
        <GripVertical size={12} />
      </footer>
    </article>
  );
}

function CalendarDay({
  date,
  day,
  items,
  brands,
  today,
  deletingId,
  onDelete,
}: {
  date: string;
  day: number;
  items: CalendarItem[];
  brands: CalendarBrand[];
  today: string;
  deletingId: string | null;
  onDelete: (item: CalendarItem) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: date });

  return (
    <section
      ref={setNodeRef}
      data-date={date}
      className={`calendar-day ${
        date === today ? "is-today" : ""
      } ${isOver ? "is-over" : ""}`}
    >
      <header>
        <span>{day}</span>
        {date === today ? <small>今日</small> : null}
      </header>
      <div className="calendar-day-items">
        {items.map((item) => (
          <CalendarTaskCard
            key={item.id}
            item={item}
            brand={brands.find((brand) => brand.id === item.brandId)}
            deleting={deletingId === item.id}
            onDelete={onDelete}
          />
        ))}
      </div>
    </section>
  );
}

export function MarketingCalendarBoard({
  initialItems,
  brands,
  year,
  month,
  daysInMonth,
  today,
}: {
  initialItems: CalendarItem[];
  brands: CalendarBrand[];
  year: number;
  month: number;
  daysInMonth: number;
  today: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  );
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const leadingBlankCount = firstWeekday === 0 ? 6 : firstWeekday - 1;
  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items) {
      map.set(item.scheduledDate, [
        ...(map.get(item.scheduledDate) ?? []),
        item,
      ]);
    }
    return map;
  }, [items]);
  const activeItem = items.find((item) => item.id === activeId);
  const cells = [
    ...Array.from({ length: leadingBlankCount }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
    setNotice(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const itemId = String(event.active.id);
    const newDate = event.over ? String(event.over.id) : "";
    const currentItem = items.find((item) => item.id === itemId);
    if (!currentItem || !newDate || currentItem.scheduledDate === newDate) return;

    const previousDate = currentItem.scheduledDate;
    setItems((current) =>
      current.map((item) =>
        item.id === itemId ? { ...item, scheduledDate: newDate } : item
      )
    );
    startTransition(async () => {
      const result = await moveCalendarItemAction(itemId, newDate);
      setNotice(result.message);
      if (!result.ok) {
        setItems((current) =>
          current.map((item) =>
            item.id === itemId
              ? { ...item, scheduledDate: previousDate }
              : item
          )
        );
      }
    });
  }

  function handleDelete(item: CalendarItem) {
    if (!window.confirm(`刪除「${item.title}」？此操作無法復原。`)) {
      return;
    }

    setDeletingId(item.id);
    setNotice(null);
    setItems((current) =>
      current.filter((currentItem) => currentItem.id !== item.id)
    );
    startTransition(async () => {
      const result = await deleteCalendarItemAction(item.id);
      setNotice(result.message);
      setDeletingId(null);
      if (!result.ok) {
        setItems((current) =>
          [...current, item].sort(
            (left, right) =>
              left.scheduledDate.localeCompare(right.scheduledDate) ||
              left.sortOrder - right.sortOrder
          )
        );
      }
    });
  }

  return (
    <div className="marketing-calendar-shell">
      <div className="calendar-weekdays" aria-hidden="true">
        {weekdays.map((weekday) => (
          <span key={weekday}>星期{weekday}</span>
        ))}
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragCancel={() => setActiveId(null)}
        onDragEnd={handleDragEnd}
      >
        <div className="marketing-calendar-grid">
          {cells.map((day, index) =>
            day ? (
              <CalendarDay
                key={day}
                day={day}
                date={calendarDate(year, month, day)}
                items={itemsByDate.get(calendarDate(year, month, day)) ?? []}
                brands={brands}
                today={today}
                deletingId={deletingId}
                onDelete={handleDelete}
              />
            ) : (
              <div key={`blank-${index}`} className="calendar-day is-blank" />
            )
          )}
        </div>
        <DragOverlay>
          {activeItem ? (
            <CalendarTaskCard
              overlay
              item={activeItem}
              brand={brands.find((brand) => brand.id === activeItem.brandId)}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
      {notice ? (
        <p className={`calendar-save-notice ${isPending ? "is-pending" : ""}`}>
          {isPending ? "正在更新…" : notice}
        </p>
      ) : null}
    </div>
  );
}
