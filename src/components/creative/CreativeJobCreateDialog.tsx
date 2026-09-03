"use client";

import { useActionState, useMemo, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import {
  AlertTriangle,
  CalendarCheck2,
  Clock3,
  FileText,
  Link2,
  LoaderCircle,
  Plus,
  X,
} from "lucide-react";
import { createCreativeJobAction } from "@/app/creative-jobs/createAction";
import { initialCreativeJobCreateState } from "@/lib/creative/createState";
import type { BrandSetting } from "@/lib/data/configuration";
import type {
  CreativeDesignerProfile,
  CreativeTaxonomyItem,
} from "@/lib/creative/types";

type CreativeJobCreateDialogProps = {
  brands: BrandSetting[];
  designers: CreativeDesignerProfile[];
  taxonomies: CreativeTaxonomyItem[];
  defaultBrandId?: string;
  today: string;
  fixtureMode?: boolean;
};

const fieldClass =
  "min-h-11 w-full rounded-xl border border-[#dfcdc4] bg-white px-3 text-sm font-bold text-[#3d2232] outline-none transition focus:border-[#8e5a76] focus:ring-4 focus:ring-[#8e5a76]/10";

const labelClass = "grid gap-1.5 text-[11px] font-black text-[#5d3c4e]";

function taxonomyOptions(
  items: CreativeTaxonomyItem[],
  category: CreativeTaxonomyItem["category"]
) {
  return items
    .filter((item) => item.category === category && item.isActive)
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder ||
        left.name.localeCompare(right.name, "zh-HK")
    );
}

export function CreativeJobCreateDialog({
  brands,
  designers,
  taxonomies,
  defaultBrandId,
  today,
  fixtureMode = false,
}: CreativeJobCreateDialogProps) {
  const [state, formAction, pending] = useActionState(
    createCreativeJobAction,
    initialCreativeJobCreateState
  );
  const [syncCalendar, setSyncCalendar] = useState(false);
  const sources = useMemo(
    () => taxonomyOptions(taxonomies, "source"),
    [taxonomies]
  );
  const usages = useMemo(
    () => taxonomyOptions(taxonomies, "usage"),
    [taxonomies]
  );
  const mediaFormats = useMemo(
    () => taxonomyOptions(taxonomies, "media_format"),
    [taxonomies]
  );
  const activeDesigners = useMemo(
    () =>
      designers
        .filter((designer) => designer.isActive)
        .sort(
          (left, right) =>
            left.sortOrder - right.sortOrder ||
            left.displayName.localeCompare(right.displayName, "zh-HK")
        ),
    [designers]
  );

  return (
    <Dialog.Root>
      <Dialog.Trigger
        data-testid="creative-job-create-trigger"
        className="command-primary-button !min-h-8 !rounded-lg !px-3 !py-1.5 !text-[10px]"
      >
        <Plus size={14} /> 新增設計 Job
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[90] bg-[#321428]/40 backdrop-blur-[3px] transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup
          data-testid="creative-job-create-dialog"
          className="fixed left-1/2 top-1/2 z-[100] flex max-h-[min(90vh,920px)] w-[min(980px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[28px] border border-[#e4d4cd] bg-[#fffdfb] shadow-[0_34px_110px_rgba(50,20,40,0.28)] outline-none transition data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0"
        >
          <header className="flex items-start justify-between gap-4 border-b border-[#ead9cf] bg-[linear-gradient(135deg,#fff9fb,#fffaf7)] px-5 py-5 sm:px-7">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#9a5d76]">
                New creative job
              </p>
              <Dialog.Title className="mt-1 text-2xl font-black tracking-[-0.035em] text-[#321428]">
                新增設計工作
              </Dialog.Title>
              <Dialog.Description className="mt-1.5 max-w-2xl text-xs font-semibold leading-5 text-[#806174]">
                先完成派 Job 必需資料，再進入完整 Brief Workspace 加長文、Screenshot、素材同修改要求。
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#dfcdc4] bg-white text-[#6d4a5c] transition hover:border-[#c7a4b5] hover:bg-[#fff7fa]"
              aria-label="關閉新增設計工作"
              title="關閉"
            >
              <X size={17} />
            </Dialog.Close>
          </header>

          <form
            action={fixtureMode ? undefined : formAction}
            onSubmit={fixtureMode ? (event) => event.preventDefault() : undefined}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
              {state.status === "error" ? (
                <div
                  role="alert"
                  className="mb-4 flex gap-2 rounded-xl border border-[#efc5c9] bg-[#fff4f5] px-3 py-2.5 text-xs font-bold text-[#a43b50]"
                >
                  <AlertTriangle className="mt-0.5 shrink-0" size={15} />
                  <span>{state.message}</span>
                </div>
              ) : null}

              <section>
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#fff0f5] text-[#7c365f]">
                    <FileText size={15} />
                  </span>
                  <div>
                    <h2 className="text-sm font-black text-[#321428]">工作基本資料</h2>
                    <p className="text-[10px] font-semibold text-[#8c7280]">
                      Source、用途同媒體格式係三個獨立欄位，唔會再混成一個 Type。
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <label className={`${labelClass} md:col-span-2 xl:col-span-2`}>
                    Job 名稱
                    <input
                      name="title"
                      className={fieldClass}
                      placeholder="例：IB S-Lite Meta AD 影片 × 3"
                      maxLength={240}
                      autoFocus
                      required
                    />
                  </label>
                  <label className={labelClass}>
                    品牌
                    <select
                      name="brandId"
                      defaultValue={defaultBrandId || brands[0]?.id || ""}
                      className={fieldClass}
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
                    Designer
                    <select
                      name="assigneeProfileId"
                      defaultValue=""
                      className={fieldClass}
                    >
                      <option value="">暫不派</option>
                      {activeDesigners.map((designer) => (
                        <option key={designer.id} value={designer.id}>
                          {designer.displayName}
                          {designer.linkedMemberId ? "" : " · 未連結帳戶"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={labelClass}>
                    Source
                    <select
                      name="sourceTaxonomyId"
                      defaultValue=""
                      className={fieldClass}
                      required
                    >
                      <option value="" disabled>
                        選擇素材來源
                      </option>
                      {sources.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={labelClass}>
                    用途
                    <select
                      name="usageTaxonomyId"
                      defaultValue=""
                      className={fieldClass}
                      required
                    >
                      <option value="" disabled>
                        選擇使用位置
                      </option>
                      {usages.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={labelClass}>
                    媒體格式
                    <select
                      name="mediaFormatTaxonomyId"
                      defaultValue=""
                      className={fieldClass}
                      required
                    >
                      <option value="" disabled>
                        選擇交付格式
                      </option>
                      {mediaFormats.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={labelClass}>
                    優先級
                    <select
                      name="priority"
                      defaultValue="normal"
                      className={fieldClass}
                    >
                      <option value="normal">一般</option>
                      <option value="priority">優先</option>
                      <option value="urgent">緊急</option>
                    </select>
                  </label>
                  <label className={labelClass}>
                    Workload
                    <select
                      name="workload"
                      defaultValue="M"
                      className={fieldClass}
                    >
                      <option value="S">S</option>
                      <option value="M">M</option>
                      <option value="L">L</option>
                      <option value="XL">XL</option>
                    </select>
                  </label>
                  <label className={labelClass}>
                    數量
                    <input
                      name="quantity"
                      type="number"
                      min={1}
                      max={999}
                      defaultValue={1}
                      className={fieldClass}
                      required
                    />
                  </label>
                  <label className={labelClass}>
                    素材狀態
                    <select
                      name="materialStatus"
                      defaultValue="ready"
                      className={fieldClass}
                    >
                      <option value="ready">素材已齊</option>
                      <option value="waiting">等素材</option>
                    </select>
                  </label>
                </div>
              </section>

              <section className="mt-6 border-t border-[#eee2dc] pt-5">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#fff0f5] text-[#7c365f]">
                    <Clock3 size={15} />
                  </span>
                  <div>
                    <h2 className="text-sm font-black text-[#321428]">時間及出街安排</h2>
                    <p className="text-[10px] font-semibold text-[#8c7280]">
                      三個日期分工清楚，唔會再長期佔用 Job List 右邊位置。
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <label className={labelClass}>
                    Start Day
                    <input
                      name="startDate"
                      type="date"
                      defaultValue={today}
                      className={fieldClass}
                      required
                    />
                  </label>
                  <label className={labelClass}>
                    開始時間（可選）
                    <input name="startTime" type="time" className={fieldClass} />
                  </label>
                  <label className={labelClass}>
                    Due Day
                    <input
                      name="dueDate"
                      type="date"
                      min={today}
                      className={fieldClass}
                      required
                    />
                  </label>
                  <label className={labelClass}>
                    截止時間（可選）
                    <input name="dueTime" type="time" className={fieldClass} />
                  </label>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <DateRule icon={Clock3} title="Start Day">
                    預設香港今日，可改；決定 Job List 排序及開始提醒。
                  </DateRule>
                  <DateRule icon={AlertTriangle} title="Due Day">
                    Designer 交稿截止；控制 24 小時提醒同逾期。
                  </DateRule>
                  <DateRule icon={CalendarCheck2} title="Publish Day">
                    只有同步日曆先啟用；決定實際出街日期。
                  </DateRule>
                </div>

                <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-[#dfcdc4] bg-[#fffaf7] px-4 py-3">
                  <span>
                    <strong className="block text-xs font-black text-[#321428]">
                      同步到營銷日曆
                    </strong>
                    <small className="mt-0.5 block text-[10px] font-semibold text-[#806174]">
                      開啟後，Publish Day 會成為真正出街日期。
                    </small>
                  </span>
                  <input
                    name="syncCalendar"
                    type="checkbox"
                    checked={syncCalendar}
                    onChange={(event) => setSyncCalendar(event.target.checked)}
                    className="h-4 w-4 accent-[#5a2348]"
                  />
                </label>

                {syncCalendar ? (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className={labelClass}>
                      Publish Day
                      <input
                        name="publishDate"
                        type="date"
                        min={today}
                        className={fieldClass}
                        required
                      />
                    </label>
                    <label className={labelClass}>
                      Publish Time（可選）
                      <input
                        name="publishTime"
                        type="time"
                        className={fieldClass}
                      />
                    </label>
                  </div>
                ) : null}
              </section>

              <details className="mt-6 rounded-2xl border border-[#e6d8d1] bg-white">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-xs font-black text-[#5a2348]">
                  <Link2 size={14} /> 更多素材及輸出資料
                </summary>
                <div className="grid gap-3 border-t border-[#eee2dc] p-4 md:grid-cols-2">
                  <label className={`${labelClass} md:col-span-2`}>
                    輸出規格／備註
                    <textarea
                      name="specifications"
                      rows={3}
                      maxLength={4000}
                      className={`${fieldClass} resize-y py-3 leading-5`}
                      placeholder="例：4:5 Feed × 2、9:16 Story × 2；所有價錢放入 safe zone。"
                    />
                  </label>
                  <label className={labelClass}>
                    素材連結
                    <input
                      name="sourceUrl"
                      type="url"
                      className={fieldClass}
                      placeholder="Google Drive／素材來源網址"
                    />
                  </label>
                  <label className={labelClass}>
                    Reference 連結
                    <input
                      name="referenceUrl"
                      type="url"
                      className={fieldClass}
                      placeholder="參考影片／設計網址"
                    />
                  </label>
                </div>
              </details>
            </div>

            <footer className="flex flex-col-reverse gap-2 border-t border-[#ead9cf] bg-white/95 px-5 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <p className="text-[10px] font-semibold leading-4 text-[#806174]">
                建立後會直接進入完整 Brief Workspace；未連結帳戶嘅 Designer 暫時收唔到私人裝置通知。
              </p>
              <div className="flex shrink-0 gap-2">
                <Dialog.Close className="command-secondary-button" disabled={pending}>
                  取消
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={pending}
                  className="command-primary-button min-w-[152px]"
                >
                  {pending ? (
                    <LoaderCircle className="animate-spin" size={15} />
                  ) : (
                    <Plus size={15} />
                  )}
                  {pending ? "建立中…" : "建立並開啟 Brief"}
                </button>
              </div>
            </footer>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DateRule({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Clock3;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2 rounded-xl border border-[#eee2dc] bg-[#fffdfb] p-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#fff0f5] text-[#7c365f]">
        <Icon size={14} />
      </span>
      <div>
        <strong className="block text-[10px] font-black text-[#321428]">
          {title}
        </strong>
        <p className="mt-0.5 text-[9px] font-semibold leading-4 text-[#806174]">
          {children}
        </p>
      </div>
    </div>
  );
}
