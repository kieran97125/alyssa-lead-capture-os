"use client";

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { Dialog } from "@base-ui/react/dialog";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  LoaderCircle,
  Pencil,
  Sparkles,
  X,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CalendarItem } from "@/lib/marketing/commandCenter";
import {
  editableCalendarItemTypes,
  editableCalendarStatuses,
  type CalendarItemUpdateInput,
  type CalendarItemUpdateResult,
  type CalendarTreatmentOption,
} from "@/lib/marketing/calendarEdit";

type CalendarBrand = {
  id: string;
  name: string;
  color: string;
};

type Draft = {
  brandId: string;
  treatmentId: string;
  title: string;
  itemType: CalendarItemUpdateInput["itemType"];
  channel: string;
  status: CalendarItemUpdateInput["status"];
  scheduledDate: string;
  scheduledTime: string;
  assigneeEmail: string;
  notes: string;
  showOnPerformanceTimeline: boolean;
};

type CalendarItemEditDialogProps = {
  item: CalendarItem;
  brands: CalendarBrand[];
  treatments: CalendarTreatmentOption[];
  saveAction: (
    input: CalendarItemUpdateInput
  ) => Promise<CalendarItemUpdateResult>;
  onSaved: (item: CalendarItem, message: string) => void;
  disabled?: boolean;
  fixtureMode?: boolean;
  defaultOpen?: boolean;
};

const fieldClass =
  "min-h-11 w-full rounded-[var(--radius-control)] border border-system-input bg-system-card px-3 text-sm font-bold text-system-card-foreground outline-none transition focus:border-system-ring focus:ring-4 focus:ring-system-ring/15 disabled:cursor-not-allowed disabled:opacity-60";
const labelClass =
  "grid gap-1.5 text-[11px] font-black text-system-muted-foreground";

const itemTypeLabels: Record<CalendarItemUpdateInput["itemType"], string> = {
  post: "Post",
  ad: "廣告",
  landing_page: "Landing Page",
  email: "Email",
  meeting: "會議",
  task: "任務",
};

const statusLabels: Record<CalendarItemUpdateInput["status"], string> = {
  idea: "Idea",
  scheduled: "Scheduled",
  published: "Published",
};

function draftFromItem(item: CalendarItem): Draft {
  const itemType = editableCalendarItemTypes.includes(
    item.itemType as CalendarItemUpdateInput["itemType"]
  )
    ? (item.itemType as CalendarItemUpdateInput["itemType"])
    : "post";
  const status = editableCalendarStatuses.includes(
    item.status as CalendarItemUpdateInput["status"]
  )
    ? (item.status as CalendarItemUpdateInput["status"])
    : "idea";
  return {
    brandId: item.brandId,
    treatmentId: item.treatmentId || "",
    title: item.title,
    itemType,
    channel: item.channel || "",
    status,
    scheduledDate: item.scheduledDate,
    scheduledTime: item.scheduledTime?.slice(0, 5) || "",
    assigneeEmail: item.assigneeEmail || "",
    notes: item.notes || "",
    showOnPerformanceTimeline: item.showOnPerformanceTimeline !== false,
  };
}

export function CalendarItemEditDialog({
  item,
  brands,
  treatments,
  saveAction,
  onSaved,
  disabled = false,
  fixtureMode = false,
  defaultOpen = false,
}: CalendarItemEditDialogProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [draft, setDraft] = useState<Draft>(() => draftFromItem(item));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const eligibleTreatments = useMemo(() => {
    const activeOptions = treatments.filter(
      (treatment) => treatment.brandId === draft.brandId
    );
    const currentTreatmentMissing =
      item.treatmentId &&
      item.brandId === draft.brandId &&
      !activeOptions.some((treatment) => treatment.id === item.treatmentId);
    return currentTreatmentMissing
      ? [
          {
            id: item.treatmentId as string,
            brandId: item.brandId,
            name: `${item.treatmentLabel || "現有療程"}（目前已停用）`,
          },
          ...activeOptions,
        ]
      : activeOptions;
  }, [
    draft.brandId,
    item.brandId,
    item.treatmentId,
    item.treatmentLabel,
    treatments,
  ]);

  useEffect(() => {
    if (open) {
      setDraft(draftFromItem(item));
      setError(null);
    }
  }, [item, open]);

  function updateDraft<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function handleBrandChange(brandId: string) {
    setDraft((current) => ({
      ...current,
      brandId,
      treatmentId:
        treatments.some(
          (treatment) =>
            treatment.id === current.treatmentId && treatment.brandId === brandId
        ) ||
        (brandId === item.brandId && current.treatmentId === item.treatmentId)
          ? current.treatmentId
          : "",
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const title = draft.title.trim();
    if (!title || !draft.brandId || !draft.scheduledDate) {
      setError("請填寫事項名稱、品牌同日期。");
      return;
    }

    const treatment = eligibleTreatments.find(
      (option) =>
        option.id === draft.treatmentId && option.brandId === draft.brandId
    );
    const currentInactiveTreatmentSelected =
      treatment?.id === item.treatmentId &&
      Boolean(item.treatmentLabel) &&
      !treatments.some((option) => option.id === item.treatmentId);
    const selectedTreatmentLabel = currentInactiveTreatmentSelected
      ? item.treatmentLabel
      : treatment?.name || null;
    const input: CalendarItemUpdateInput = {
      itemId: item.id,
      expectedUpdatedAt: item.updatedAt || null,
      brandId: draft.brandId,
      treatmentId: treatment?.id || null,
      title,
      itemType: draft.itemType,
      channel: draft.channel.trim() || null,
      status: draft.status,
      scheduledDate: draft.scheduledDate,
      scheduledTime: draft.scheduledTime || null,
      assigneeEmail: draft.assigneeEmail.trim() || null,
      notes: draft.notes.trim() || null,
      showOnPerformanceTimeline: draft.showOnPerformanceTimeline,
    };

    if (fixtureMode) {
      onSaved(
        {
          ...item,
          ...input,
          treatmentLabel: selectedTreatmentLabel,
          sortOrder: item.sortOrder,
          updatedAt: new Date().toISOString(),
        },
        "日曆事項已更新。"
      );
      setOpen(false);
      return;
    }

    startTransition(async () => {
      const result = await saveAction(input);
      if (!result.ok || !result.item) {
        setError(result.message);
        return;
      }
      onSaved(result.item, result.message);
      setOpen(false);
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        type="button"
        className="calendar-task-edit"
        aria-label={`編輯事項：${item.title}`}
        title="編輯事項"
        disabled={disabled}
        data-testid={`calendar-edit-trigger-${item.id}`}
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <Pencil size={11} aria-hidden="true" />
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[90] bg-system-foreground/45 backdrop-blur-sm transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup
          data-testid="calendar-edit-dialog"
          className="fixed left-1/2 top-1/2 z-[100] flex max-h-[min(92vh,900px)] w-[min(880px,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[var(--radius-panel)] border border-system-border bg-system-card text-system-card-foreground shadow-[var(--shadow-overlay)] outline-none transition data-[ending-style]:scale-[0.985] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.985] data-[starting-style]:opacity-0"
        >
          <header className="flex items-start gap-3 border-b border-system-border bg-system-secondary/55 px-5 py-5 sm:px-6">
            <span className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-control)] bg-system-primary text-system-primary-foreground shadow-[var(--shadow-control)]">
              <CalendarClock size={18} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-system-muted-foreground">
                Edit calendar item
              </p>
              <Dialog.Title className="mt-1 text-xl font-black tracking-[-0.025em] sm:text-2xl">
                編輯日曆事項
              </Dialog.Title>
              <Dialog.Description className="mt-1.5 max-w-2xl text-xs font-semibold leading-5 text-system-muted-foreground">
                修改後會即時更新日曆；如已連結一般工作或設計 Job，相關排期同標題會保持一致。
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="關閉編輯視窗"
              title="關閉"
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "shrink-0 rounded-[var(--radius-control)]"
              )}
            >
              <X size={17} aria-hidden="true" />
            </Dialog.Close>
          </header>

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              {error ? (
                <div
                  role="alert"
                  className="mb-4 flex items-start gap-2 rounded-[var(--radius-control)] border border-system-destructive/30 bg-system-destructive/5 px-3 py-2.5 text-xs font-bold text-system-destructive"
                >
                  <AlertTriangle className="mt-0.5 shrink-0" size={15} />
                  <span>{error}</span>
                </div>
              ) : null}

              <section>
                <div className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-[var(--radius-control)] bg-system-accent text-system-accent-foreground">
                    <Pencil size={14} aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-sm font-black">內容及負責資料</h2>
                    <p className="text-[10px] font-semibold text-system-muted-foreground">
                      所有欄位都會保存到 Database 同 Audit Log。
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <label className={`${labelClass} md:col-span-2 xl:col-span-2`}>
                    事項名稱
                    <input
                      className={fieldClass}
                      value={draft.title}
                      onChange={(event) => updateDraft("title", event.target.value)}
                      maxLength={180}
                      required
                      autoFocus
                    />
                  </label>
                  <label className={labelClass}>
                    品牌
                    <select
                      className={fieldClass}
                      value={draft.brandId}
                      onChange={(event) => handleBrandChange(event.target.value)}
                      required
                    >
                      {brands.map((brand) => (
                        <option key={brand.id} value={brand.id}>
                          {brand.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={labelClass}>
                    影響療程（可選）
                    <select
                      className={fieldClass}
                      value={draft.treatmentId}
                      onChange={(event) =>
                        updateDraft("treatmentId", event.target.value)
                      }
                    >
                      <option value="">品牌整體／所有療程</option>
                      {eligibleTreatments.map((treatment) => (
                        <option key={treatment.id} value={treatment.id}>
                          {treatment.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={labelClass}>
                    類型
                    <select
                      className={fieldClass}
                      value={draft.itemType}
                      onChange={(event) =>
                        updateDraft(
                          "itemType",
                          event.target.value as Draft["itemType"]
                        )
                      }
                    >
                      {editableCalendarItemTypes.map((type) => (
                        <option key={type} value={type}>
                          {itemTypeLabels[type]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={labelClass}>
                    渠道
                    <input
                      className={fieldClass}
                      value={draft.channel}
                      onChange={(event) => updateDraft("channel", event.target.value)}
                      placeholder="IG / Meta / Google"
                      maxLength={120}
                    />
                  </label>
                  <label className={labelClass}>
                    負責人電郵（可選）
                    <input
                      type="email"
                      className={fieldClass}
                      value={draft.assigneeEmail}
                      onChange={(event) =>
                        updateDraft("assigneeEmail", event.target.value)
                      }
                      placeholder="name@alyssa.hk"
                      maxLength={320}
                    />
                  </label>
                </div>
              </section>

              <section className="mt-6 border-t border-system-border pt-5">
                <div className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-[var(--radius-control)] bg-system-accent text-system-accent-foreground">
                    <CalendarClock size={14} aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-sm font-black">出街時間及狀態</h2>
                    <p className="text-[10px] font-semibold text-system-muted-foreground">
                      拖放仍可快速改日期；呢個視窗用嚟完整修改時間、狀態同內容。
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <label className={labelClass}>
                    Due／出街日期
                    <input
                      type="date"
                      className={fieldClass}
                      value={draft.scheduledDate}
                      onChange={(event) =>
                        updateDraft("scheduledDate", event.target.value)
                      }
                      required
                    />
                  </label>
                  <label className={labelClass}>
                    時間（可留空）
                    <input
                      type="time"
                      className={fieldClass}
                      value={draft.scheduledTime}
                      onChange={(event) =>
                        updateDraft("scheduledTime", event.target.value)
                      }
                    />
                  </label>
                  <label className={labelClass}>
                    狀態
                    <select
                      className={fieldClass}
                      value={draft.status}
                      onChange={(event) =>
                        updateDraft(
                          "status",
                          event.target.value as Draft["status"]
                        )
                      }
                    >
                      {editableCalendarStatuses.map((status) => (
                        <option key={status} value={status}>
                          {statusLabels[status]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {draft.status === "scheduled" && !draft.scheduledTime ? (
                  <p className="mt-2 rounded-[var(--radius-control)] bg-system-muted px-3 py-2 text-[10px] font-semibold leading-4 text-system-muted-foreground">
                    Scheduled 如冇填時間，系統會喺出街當日 12:00 HKT 自動轉 Published。
                  </p>
                ) : null}
                {draft.status === "published" ? (
                  <p className="mt-2 flex items-start gap-2 rounded-[var(--radius-control)] bg-system-accent px-3 py-2 text-[10px] font-semibold leading-4 text-system-accent-foreground">
                    <Check className="mt-0.5 shrink-0" size={13} aria-hidden="true" />
                    儲存後會更新成效時間線及所有已連結嘅排期資料。
                  </p>
                ) : null}
              </section>

              <section className="mt-6 border-t border-system-border pt-5">
                <label className={`${labelClass}`}>
                  備註
                  <textarea
                    className={`${fieldClass} min-h-28 resize-y py-3 leading-5`}
                    value={draft.notes}
                    onChange={(event) => updateDraft("notes", event.target.value)}
                    maxLength={4000}
                    placeholder="素材、審批、上線要求或其他備註"
                  />
                </label>

                <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-[var(--radius-control)] border border-system-border bg-system-secondary/50 px-4 py-3">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 accent-[var(--system-primary)]"
                    checked={draft.showOnPerformanceTimeline}
                    onChange={(event) =>
                      updateDraft(
                        "showOnPerformanceTimeline",
                        event.target.checked
                      )
                    }
                  />
                  <span>
                    <strong className="flex items-center gap-1.5 text-xs font-black">
                      <Sparkles size={13} aria-hidden="true" /> 顯示喺成效時間線
                    </strong>
                    <small className="mt-1 block text-[10px] font-semibold leading-4 text-system-muted-foreground">
                      Published 後會成為 Dashboard／成效走勢圖嘅事件標記，方便對照 Lead、Book 同 Show 變化。
                    </small>
                  </span>
                </label>
              </section>
            </div>

            <footer className="flex flex-col-reverse gap-2 border-t border-system-border bg-system-muted/45 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="max-w-xl text-[10px] font-semibold leading-4 text-system-muted-foreground">
                如連結設計 Job，新日期不可早過 Designer Due Day；系統唔會偷偷改早交稿期限。
              </p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Dialog.Close
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "rounded-[var(--radius-control)]"
                  )}
                >
                  取消
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={isPending}
                  data-testid="calendar-edit-save"
                  className={cn(
                    buttonVariants({ variant: "default", size: "lg" }),
                    "rounded-[var(--radius-control)]"
                  )}
                >
                  {isPending ? (
                    <LoaderCircle className="animate-spin" size={15} />
                  ) : (
                    <Check size={15} />
                  )}
                  {isPending ? "儲存中…" : "儲存修改"}
                </button>
              </div>
            </footer>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
