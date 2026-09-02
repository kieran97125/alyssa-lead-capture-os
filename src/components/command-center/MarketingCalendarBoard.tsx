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
import { updateCalendarItemAction } from "@/app/calendar/updateAction";
import { CalendarItemEditDialog } from "@/components/command-center/CalendarItemEditDialog";
import type { CalendarTreatmentOption } from "@/lib/marketing/calendarEdit";
import type { CalendarItem } from "@/lib/marketing/commandCenter";

type CalendarBrand = {
  id: string;
  name: string;
  color: string;
};

type CalendarTreatment = CalendarTreatmentOption;

const weekdays = ["一", "二", "三", "四", "五", "六", "日"];
const MAX_VISIBLE_ITEMS_PER_DAY = 3;

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

function statusLabel(status: CalendarItem["status"]) {
  const labels: Record<CalendarItem["status"], string> = {
    idea: "Idea",
    planned: "Planned",
    in_progress: "In progress",
    review: "Review",
    scheduled: "Scheduled",
    published: "Published",
    blocked: "Blocked",
    cancelled: "Cancelled",
  };
  return labels[status];
}

function CalendarTaskCard({
  item,
  brand,
  brands = [],
  treatments = [],
  overlay = false,
  deleting = false,
  fixtureMode = false,
  onDelete,
  onUpdated,
}: {
  item: CalendarItem;
  brand: CalendarBrand | undefined;
  brands?: CalendarBrand[];
  treatments?: CalendarTreatment[];
  overlay?: boolean;
  deleting?: boolean;
  fixtureMode?: boolean;
  onDelete?: (item: CalendarItem) => void;
  onUpdated?: (item: CalendarItem, message: string) => void;
}) {
  const draggable = useDraggable({
    id: item.id,
    disabled: overlay,
    data: { scheduledDate: item.scheduledDate },
  });
  const brandColor = brand?.color || "#5a2348";
  const style = overlay
    ? undefined
    : {
        transform: CSS.Translate.toString(draggable.transform),
        opacity: draggable.isDragging ? 0.35 : 1,
      };

  return (
    <article
      ref={overlay ? undefined : draggable.setNodeRef}
      style={style}
      className={`calendar-task calendar-task-compact ${overlay ? "is-overlay" : ""}`}
      data-calendar-task-title={item.title}
      {...(overlay ? {} : draggable.attributes)}
      {...(overlay ? {} : draggable.listeners)}
    >
      <div className="calendar-task-summary">
        <span
          className="calendar-task-brand-dot"
          style={{ background: brandColor }}
          aria-hidden="true"
        />
        <strong title={item.title}>{item.title}</strong>
        <small>
          {itemTypeLabel(item.itemType)}
          {item.channel ? ` · ${item.channel}` : ""}
        </small>
        {!overlay && onUpdated ? (
          <CalendarItemEditDialog
            item={item}
            brands={brands}
            treatments={treatments}
            saveAction={updateCalendarItemAction}
            onSaved={onUpdated}
            disabled={deleting}
            fixtureMode={fixtureMode}
          />
        ) : null}
        <GripVertical className="calendar-task-grip" size={11} aria-hidden="true" />
      </div>

      {!overlay ? (
        <div className="calendar-task-preview" role="group" aria-label={`${item.title} 詳細資料`}>
          <div className="calendar-task-preview-head">
            <div>
              <span className="calendar-task-preview-kicker">
                <i style={{ background: brandColor }} />
                {brand?.name || "未設定品牌"}
              </span>
              <strong>{item.title}</strong>
            </div>
            {onDelete ? (
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
                <Trash2 size={12} />
              </button>
            ) : null}
          </div>

          <div className="calendar-task-preview-meta">
            <span>{itemTypeLabel(item.itemType)}</span>
            {item.channel ? <span>{item.channel}</span> : null}
            <span>{statusLabel(item.status)}</span>
            {item.scheduledTime ? <span>{item.scheduledTime.slice(0, 5)}</span> : null}
          </div>

          {item.treatmentLabel ? (
            <p className="calendar-task-preview-line">
              <b>療程</b>
              <span>{item.treatmentLabel}</span>
            </p>
          ) : null}
          {item.assigneeEmail ? (
            <p className="calendar-task-preview-line">
              <b>負責人</b>
              <span>{item.assigneeEmail}</span>
            </p>
          ) : null}
          {item.notes ? <p className="calendar-task-preview-notes">{item.notes}</p> : null}
          <p className="calendar-task-preview-hint">鉛筆可完整編輯；拖放可快速改日期</p>
        </div>
      ) : null}
    </article>
  );
}

function CalendarDay({
  date,
  day,
  items,
  brands,
  treatments,
  today,
  deletingId,
  fixtureMode,
  onDelete,
  onUpdated,
}: {
  date: string;
  day: number;
  items: CalendarItem[];
  brands: CalendarBrand[];
  treatments: CalendarTreatment[];
  today: string;
  deletingId: string | null;
  fixtureMode: boolean;
  onDelete: (item: CalendarItem) => void;
  onUpdated: (item: CalendarItem, message: string) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: date });
  const visibleItems = items.slice(0, MAX_VISIBLE_ITEMS_PER_DAY);
  const overflowItems = items.slice(MAX_VISIBLE_ITEMS_PER_DAY);

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
        {visibleItems.map((item) => (
          <CalendarTaskCard
            key={item.id}
            item={item}
            brand={brands.find((brand) => brand.id === item.brandId)}
            brands={brands}
            treatments={treatments}
            deleting={deletingId === item.id}
            fixtureMode={fixtureMode}
            onDelete={onDelete}
            onUpdated={onUpdated}
          />
        ))}
        {overflowItems.length ? (
          <div className="calendar-more-wrap">
            <button
              type="button"
              className="calendar-more-button"
              aria-label={`${date} 還有 ${overflowItems.length} 項`}
            >
              +{overflowItems.length} more
            </button>
            <div className="calendar-more-preview" role="group" aria-label={`${date} 其餘事項`}>
              <div className="calendar-more-preview-head">
                <strong>{day} 日其餘事項</strong>
                <small>共 {overflowItems.length} 項</small>
              </div>
              <div className="calendar-more-preview-list">
                {overflowItems.map((item) => (
                  <CalendarTaskCard
                    key={item.id}
                    item={item}
                    brand={brands.find((brand) => brand.id === item.brandId)}
                    brands={brands}
                    treatments={treatments}
                    deleting={deletingId === item.id}
                    fixtureMode={fixtureMode}
                    onDelete={onDelete}
                    onUpdated={onUpdated}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function MarketingCalendarBoard({
  initialItems,
  brands,
  treatments,
  year,
  month,
  daysInMonth,
  today,
  fixtureMode = false,
}: {
  initialItems: CalendarItem[];
  brands: CalendarBrand[];
  treatments: CalendarTreatment[];
  year: number;
  month: number;
  daysInMonth: number;
  today: string;
  fixtureMode?: boolean;
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
      } else if (result.updatedAt) {
        setItems((current) =>
          current.map((item) =>
            item.id === itemId ? { ...item, updatedAt: result.updatedAt } : item
          )
        );
      }
    });
  }

  function handleUpdated(item: CalendarItem, message: string) {
    const visibleMonth = `${year}-${String(month).padStart(2, "0")}`;
    setItems((current) =>
      current
        .map((currentItem) => (currentItem.id === item.id ? item : currentItem))
        .sort(
          (left, right) =>
            left.scheduledDate.localeCompare(right.scheduledDate) ||
            left.sortOrder - right.sortOrder
        )
    );
    setNotice(
      item.scheduledDate.startsWith(visibleMonth)
        ? message
        : `${message} 事項已移到 ${item.scheduledDate.slice(0, 7)}。`
    );
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
      <style>{`
        .calendar-day {
          position: relative;
          overflow: visible;
        }
        .calendar-day-items {
          gap: 0.22rem !important;
        }
        .calendar-task.calendar-task-compact {
          position: relative;
          z-index: 1;
          min-width: 0;
          border: 1px solid #e7e9ef;
          border-radius: 0.42rem;
          background: #fff;
          padding: 0 !important;
          box-shadow: 0 2px 7px rgba(35, 44, 70, 0.035);
          cursor: grab;
          touch-action: none;
        }
        .calendar-task.calendar-task-compact:hover,
        .calendar-task.calendar-task-compact:focus-within {
          z-index: 40;
          border-color: #d8dce6;
          box-shadow: 0 5px 14px rgba(35, 44, 70, 0.08);
        }
        .calendar-task.calendar-task-compact:active {
          cursor: grabbing;
        }
        .calendar-task-summary {
          display: grid !important;
          min-width: 0;
          height: 1.56rem;
          grid-template-columns: auto minmax(0, 1fr) auto auto auto;
          gap: 0.28rem !important;
          align-items: center !important;
          padding: 0.26rem 0.32rem;
        }
        .calendar-task-summary .calendar-task-brand-dot {
          width: 0.42rem;
          height: 0.42rem;
          flex: 0 0 auto;
          border-radius: 999px;
        }
        .calendar-task-summary > strong {
          min-width: 0;
          margin: 0 !important;
          overflow: hidden;
          color: #30384d;
          font-size: 0.5rem !important;
          font-weight: 780 !important;
          line-height: 1.1 !important;
          text-overflow: ellipsis;
          white-space: nowrap;
          display: block !important;
          -webkit-line-clamp: unset !important;
        }
        .calendar-task-summary > small {
          max-width: 4.8rem;
          overflow: hidden;
          color: #98a0b0 !important;
          font-size: 0.41rem !important;
          font-weight: 700 !important;
          line-height: 1 !important;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .calendar-task-edit {
          display: inline-grid;
          width: 1.3rem;
          height: 1.3rem;
          flex: 0 0 auto;
          place-items: center;
          border: 1px solid transparent;
          border-radius: 0.34rem;
          background: transparent;
          color: var(--system-muted-foreground);
          cursor: pointer;
          transition: border-color 120ms ease, background 120ms ease, color 120ms ease;
          touch-action: manipulation;
        }
        .calendar-task-edit:hover,
        .calendar-task-edit:focus-visible {
          border-color: var(--system-border);
          background: var(--system-accent);
          color: var(--system-primary);
          outline: none;
        }
        .calendar-task-edit:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }
        .calendar-task-grip {
          color: #b4bac7;
        }
        .calendar-task-preview {
          position: absolute;
          z-index: 60;
          top: calc(100% - 1px);
          left: -0.15rem;
          width: min(18.5rem, calc(100vw - 2rem));
          padding: 0.78rem;
          border: 1px solid #dfe3eb;
          border-radius: 0.78rem;
          background: rgba(255, 255, 255, 0.985);
          box-shadow: 0 16px 42px rgba(35, 44, 70, 0.16);
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          transform: translateY(4px);
          transition: opacity 120ms ease, transform 120ms ease, visibility 120ms ease;
        }
        .calendar-task.calendar-task-compact:hover > .calendar-task-preview,
        .calendar-task.calendar-task-compact:focus-within > .calendar-task-preview {
          opacity: 1;
          visibility: visible;
          pointer-events: auto;
          transform: translateY(0);
        }
        .calendar-task.is-overlay .calendar-task-preview {
          display: none;
        }
        .calendar-day:nth-child(7n) .calendar-task-preview,
        .calendar-day:nth-child(7n - 1) .calendar-task-preview {
          right: -0.15rem;
          left: auto;
        }
        .calendar-task-preview-head {
          display: flex !important;
          align-items: flex-start !important;
          justify-content: space-between !important;
          gap: 0.6rem !important;
        }
        .calendar-task-preview-head > div {
          min-width: 0;
        }
        .calendar-task-preview-kicker {
          display: inline-flex !important;
          align-items: center;
          gap: 0.3rem;
          color: #7d8494 !important;
          font-size: 0.56rem !important;
          font-weight: 760 !important;
        }
        .calendar-task-preview-kicker i {
          width: 0.46rem;
          height: 0.46rem;
          border-radius: 999px;
        }
        .calendar-task-preview-head strong {
          display: block !important;
          margin-top: 0.2rem !important;
          color: #242c40;
          font-size: 0.75rem !important;
          font-weight: 850 !important;
          line-height: 1.35 !important;
          white-space: normal !important;
          overflow: visible !important;
          -webkit-line-clamp: unset !important;
        }
        .calendar-task-preview .calendar-task-delete {
          display: inline-grid;
          width: 1.65rem;
          height: 1.65rem;
          flex: 0 0 auto;
          place-items: center;
        }
        .calendar-task-preview-meta {
          display: flex !important;
          flex-wrap: wrap;
          justify-content: flex-start !important;
          gap: 0.28rem !important;
          margin-top: 0.58rem;
        }
        .calendar-task-preview-meta span {
          border-radius: 999px;
          background: #f5f6f8;
          padding: 0.22rem 0.4rem;
          color: #737b8d !important;
          font-size: 0.5rem !important;
          font-weight: 760 !important;
        }
        .calendar-task-preview-line {
          display: grid;
          grid-template-columns: 3.1rem minmax(0, 1fr);
          gap: 0.45rem;
          margin: 0.52rem 0 0;
          color: #646d80;
          font-size: 0.57rem;
          line-height: 1.45;
        }
        .calendar-task-preview-line b {
          color: #9198a7;
          font-weight: 760;
        }
        .calendar-task-preview-line span {
          min-width: 0;
          overflow-wrap: anywhere;
        }
        .calendar-task-preview-notes {
          display: -webkit-box;
          margin: 0.58rem 0 0;
          overflow: hidden;
          color: #646d80;
          font-size: 0.56rem;
          line-height: 1.45;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 3;
        }
        .calendar-task-preview-hint {
          margin: 0.62rem 0 0;
          border-top: 1px solid #eef0f4;
          padding-top: 0.5rem;
          color: #a0a6b2;
          font-size: 0.5rem;
          font-weight: 690;
        }
        .calendar-more-wrap {
          position: relative;
          z-index: 2;
        }
        .calendar-more-wrap:hover,
        .calendar-more-wrap:focus-within {
          z-index: 50;
        }
        .calendar-more-button {
          display: flex;
          width: 100%;
          height: 1.38rem;
          align-items: center;
          border: 1px dashed #dfe2e8;
          border-radius: 0.4rem;
          background: #fafbfc;
          padding: 0 0.42rem;
          color: #8b92a1;
          font-size: 0.48rem;
          font-weight: 800;
          text-align: left;
        }
        .calendar-more-button:hover,
        .calendar-more-button:focus-visible {
          border-color: #cdd2dc;
          background: #f5f6f8;
          color: #626b7d;
          outline: none;
        }
        .calendar-more-preview {
          position: absolute;
          z-index: 70;
          top: calc(100% - 1px);
          left: -0.15rem;
          width: min(19rem, calc(100vw - 2rem));
          max-height: 18rem;
          overflow-y: auto;
          border: 1px solid #dfe3eb;
          border-radius: 0.8rem;
          background: rgba(255, 255, 255, 0.99);
          padding: 0.72rem;
          box-shadow: 0 18px 46px rgba(35, 44, 70, 0.17);
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          transform: translateY(4px);
          transition: opacity 120ms ease, transform 120ms ease, visibility 120ms ease;
        }
        .calendar-more-wrap:hover > .calendar-more-preview,
        .calendar-more-wrap:focus-within > .calendar-more-preview {
          opacity: 1;
          visibility: visible;
          pointer-events: auto;
          transform: translateY(0);
        }
        .calendar-day:nth-child(7n) .calendar-more-preview,
        .calendar-day:nth-child(7n - 1) .calendar-more-preview {
          right: -0.15rem;
          left: auto;
        }
        .calendar-more-preview-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }
        .calendar-more-preview-head strong {
          color: #384154;
          font-size: 0.65rem;
          font-weight: 820;
        }
        .calendar-more-preview-head small {
          color: #9ba2af;
          font-size: 0.5rem;
          font-weight: 700;
        }
        .calendar-more-preview-list {
          display: grid;
          gap: 0.28rem;
        }
        .calendar-task.is-overlay {
          width: 11rem;
          padding: 0 !important;
          border-left: 1px solid #dfe3eb !important;
          box-shadow: 0 16px 38px rgba(34, 42, 68, 0.18);
        }
        @media (max-width: 760px) {
          .calendar-task-summary {
            grid-template-columns: auto minmax(0, 1fr) auto auto;
          }
          .calendar-task-summary > small {
            display: none;
          }
          .calendar-task-preview,
          .calendar-more-preview {
            position: fixed;
            top: auto;
            right: 0.65rem !important;
            bottom: 0.65rem;
            left: 0.65rem !important;
            width: auto;
            max-height: min(70vh, 28rem);
          }
        }
      `}</style>
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
                treatments={treatments}
                today={today}
                deletingId={deletingId}
                fixtureMode={fixtureMode}
                onDelete={handleDelete}
                onUpdated={handleUpdated}
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
