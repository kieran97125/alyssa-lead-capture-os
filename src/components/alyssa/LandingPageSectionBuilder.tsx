"use client";

import { useMemo, useState } from "react";
import type {
  LandingPageContentSection,
  LandingPageContentSectionItem,
  LandingPageContentSectionLayout,
} from "@/lib/data/landingPages";

const layoutOptions: Array<{
  value: LandingPageContentSectionLayout;
  label: string;
  defaultName: string;
}> = [
  { value: "text", label: "1 欄文字", defaultName: "文字內容" },
  { value: "image_text", label: "圖片 + 文字", defaultName: "療程介紹" },
  { value: "two_cards", label: "2 張卡片", defaultName: "重點賣點" },
  { value: "three_cards", label: "3 張卡片", defaultName: "療程流程" },
  { value: "faq", label: "FAQ 問答", defaultName: "常見問題" },
  { value: "image_grid", label: "圖片格仔", defaultName: "圖片展示" },
];

function emptyItem(): LandingPageContentSectionItem {
  return {
    title: "",
    body: "",
    imageUrl: "",
    ctaText: "",
    ctaUrl: "",
  };
}

function defaultItemCount(layout: LandingPageContentSectionLayout) {
  if (layout === "two_cards") return 2;
  if (layout === "three_cards") return 3;
  if (layout === "faq") return 3;
  if (layout === "image_grid") return 3;
  return 1;
}

function maxItemCount(layout: LandingPageContentSectionLayout) {
  if (layout === "two_cards") return 2;
  if (layout === "three_cards") return 3;
  if (layout === "faq" || layout === "image_grid") return 6;
  return 1;
}

function sectionLabel(layout: LandingPageContentSectionLayout) {
  return layoutOptions.find((option) => option.value === layout)?.label ?? layout;
}

function makeSection(
  layout: LandingPageContentSectionLayout,
  index: number
): LandingPageContentSection {
  const option = layoutOptions.find((item) => item.value === layout);

  return {
    id: `section-${Date.now()}-${index + 1}`,
    type: "content",
    layout,
    label: option?.defaultName ?? `自訂區塊 ${index + 1}`,
    title: option?.defaultName ?? `自訂區塊 ${index + 1}`,
    subtitle: "",
    items: Array.from({ length: defaultItemCount(layout) }).map(emptyItem),
  };
}

export function LandingPageSectionBuilder({
  initialSections,
}: {
  initialSections: LandingPageContentSection[];
}) {
  const [sections, setSections] = useState<LandingPageContentSection[]>(
    initialSections.slice(0, 8)
  );
  const [isAdding, setIsAdding] = useState(false);

  const canAdd = sections.length < 8;
  const orderRows = useMemo(
    () => [
      "Hero",
      "快速登記 CTA",
      "優惠摘要",
      ...sections.map((section) => section.label || section.title || "自訂區塊"),
      "預約表格",
      "Legal Footer",
    ],
    [sections]
  );

  function updateSection(
    index: number,
    updater: (section: LandingPageContentSection) => LandingPageContentSection
  ) {
    setSections((current) =>
      current.map((section, sectionIndex) =>
        sectionIndex === index ? updater(section) : section
      )
    );
  }

  function updateItem(
    sectionIndex: number,
    itemIndex: number,
    updater: (item: LandingPageContentSectionItem) => LandingPageContentSectionItem
  ) {
    updateSection(sectionIndex, (section) => ({
      ...section,
      items: section.items.map((item, index) =>
        index === itemIndex ? updater(item) : item
      ),
    }));
  }

  function addSection(layout: LandingPageContentSectionLayout) {
    if (!canAdd) return;
    setSections((current) => [...current, makeSection(layout, current.length)]);
    setIsAdding(false);
  }

  function deleteSection(index: number) {
    setSections((current) => current.filter((_, sectionIndex) => sectionIndex !== index));
  }

  function moveSection(index: number, direction: -1 | 1) {
    setSections((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  }

  function addItem(sectionIndex: number) {
    updateSection(sectionIndex, (section) => {
      if (section.items.length >= maxItemCount(section.layout)) return section;

      return {
        ...section,
        items: [...section.items, emptyItem()],
      };
    });
  }

  function deleteItem(sectionIndex: number, itemIndex: number) {
    updateSection(sectionIndex, (section) => ({
      ...section,
      items: section.items.filter((_, index) => index !== itemIndex),
    }));
  }

  return (
    <div className="grid gap-4">
      {sections.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[#d9b66f] bg-white/70 p-5 text-sm font-semibold leading-6 text-[#6d4a5c]">
          目前未有自訂內容區塊。固定頁面已有 Hero、快速登記、優惠摘要、表格及法律頁腳。
        </div>
      )}

      {sections.map((section, sectionIndex) => (
        <section
          key={section.id}
          className="rounded-2xl border border-[#ead9cf] bg-[#fff6f0] p-4"
        >
          <input type="hidden" name="contentSectionEnabled" value="true" />
          <input type="hidden" name="contentSectionIds" value={section.id} />
          <input
            type="hidden"
            name="contentSectionLayouts"
            value={section.layout}
          />
          <input
            type="hidden"
            name="contentSectionOrders"
            value={`${sectionIndex + 1}`}
          />

          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
                {sectionLabel(section.layout)}
              </p>
              <input
                name="contentSectionLabels"
                value={section.label}
                onChange={(event) =>
                  updateSection(sectionIndex, (current) => ({
                    ...current,
                    label: event.target.value,
                  }))
                }
                className="mt-2 w-full min-w-0 rounded-2xl border border-[#ead9cf] bg-white px-4 py-3 text-sm font-bold text-[#321428] outline-none transition focus:border-[#e46f64] md:w-[320px]"
                aria-label="區塊名稱"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => moveSection(sectionIndex, -1)}
                disabled={sectionIndex === 0}
                className="rounded-full border border-[#d9b66f] bg-white px-4 py-2 text-xs font-bold text-[#5a2348] disabled:opacity-40"
              >
                上移
              </button>
              <button
                type="button"
                onClick={() => moveSection(sectionIndex, 1)}
                disabled={sectionIndex === sections.length - 1}
                className="rounded-full border border-[#d9b66f] bg-white px-4 py-2 text-xs font-bold text-[#5a2348] disabled:opacity-40"
              >
                下移
              </button>
              <button
                type="button"
                onClick={() => deleteSection(sectionIndex)}
                className="rounded-full bg-white px-4 py-2 text-xs font-bold text-[#9a2f5b]"
              >
                刪除
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {section.layout !== "faq" && (
              <>
                <Field
                  label="公開標題"
                  name="contentSectionTitles"
                  value={section.title}
                  onChange={(value) =>
                    updateSection(sectionIndex, (current) => ({
                      ...current,
                      title: value,
                    }))
                  }
                />
                <Area
                  label="公開副標題 / 內容"
                  name="contentSectionSubtitles"
                  value={section.subtitle}
                  onChange={(value) =>
                    updateSection(sectionIndex, (current) => ({
                      ...current,
                      subtitle: value,
                    }))
                  }
                  wide
                />
              </>
            )}
            {section.layout === "faq" && (
              <>
                <input type="hidden" name="contentSectionTitles" value={section.title} />
                <input
                  type="hidden"
                  name="contentSectionSubtitles"
                  value={section.subtitle}
                />
              </>
            )}
          </div>

          <div className="mt-5 grid gap-3">
            {section.items.map((item, itemIndex) => (
              <SectionItemEditor
                key={`${section.id}-${itemIndex}`}
                item={item}
                itemIndex={itemIndex}
                sectionIndex={sectionIndex}
                layout={section.layout}
                onChange={(updater) =>
                  updateItem(sectionIndex, itemIndex, updater)
                }
                onDelete={() => deleteItem(sectionIndex, itemIndex)}
              />
            ))}
          </div>

          {section.items.length < maxItemCount(section.layout) && (
            <button
              type="button"
              onClick={() => addItem(sectionIndex)}
              className="mt-4 rounded-full border border-[#d9b66f] bg-white px-4 py-2 text-xs font-bold text-[#5a2348]"
            >
              新增項目
            </button>
          )}
        </section>
      ))}

      {isAdding && canAdd && (
        <div className="rounded-2xl border border-[#ead9cf] bg-white p-4">
          <p className="text-sm font-bold text-[#321428]">選擇新區塊版面</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {layoutOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => addSection(option.value)}
                className="rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-4 py-3 text-left text-sm font-bold text-[#5a2348] transition hover:-translate-y-0.5 hover:bg-white"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {!isAdding && canAdd && (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="w-fit rounded-full bg-[#5a2348] px-5 py-3 text-sm font-bold text-white"
        >
          新增區塊
        </button>
      )}

      <section className="rounded-2xl border border-[#ead9cf] bg-white p-4">
        <h3 className="font-bold text-[#321428]">區塊排序</h3>
        <div className="mt-3 grid gap-2">
          {orderRows.map((label, index) => (
            <div
              key={`${label}-${index}`}
              className="flex items-center justify-between rounded-xl bg-[#fff6f0] px-4 py-3 text-sm font-semibold text-[#5a2348]"
            >
              <span>{label}</span>
              <span className="text-xs text-[#9a5d76]">
                {index < 3 || index >= orderRows.length - 2 ? "固定" : "自訂"}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SectionItemEditor({
  item,
  itemIndex,
  sectionIndex,
  layout,
  onChange,
  onDelete,
}: {
  item: LandingPageContentSectionItem;
  itemIndex: number;
  sectionIndex: number;
  layout: LandingPageContentSectionLayout;
  onChange: (
    updater: (item: LandingPageContentSectionItem) => LandingPageContentSectionItem
  ) => void;
  onDelete: () => void;
}) {
  const supportsImage =
    layout === "image_text" ||
    layout === "two_cards" ||
    layout === "three_cards" ||
    layout === "image_grid";
  const isFaq = layout === "faq";
  const showBody = layout !== "image_grid";

  return (
    <div className="rounded-2xl border border-[#ead9cf] bg-white/80 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
          {isFaq ? `FAQ ${itemIndex + 1}` : `Item ${itemIndex + 1}`}
        </p>
        <button
          type="button"
          onClick={onDelete}
          className="text-xs font-bold text-[#9a2f5b]"
        >
          刪除項目
        </button>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Field
          label={isFaq ? "問題" : "項目標題"}
          name={`contentSection${sectionIndex}ItemTitles`}
          value={item.title}
          onChange={(value) =>
            onChange((current) => ({ ...current, title: value }))
          }
        />
        {supportsImage && (
          <Field
            label="圖片 URL"
            name={`contentSection${sectionIndex}ItemImageUrls`}
            value={item.imageUrl}
            onChange={(value) =>
              onChange((current) => ({ ...current, imageUrl: value }))
            }
          />
        )}
        {!supportsImage && (
          <input
            type="hidden"
            name={`contentSection${sectionIndex}ItemImageUrls`}
            value={item.imageUrl}
          />
        )}
        {showBody && (
          <Area
            label={isFaq ? "答案" : "項目內容"}
            name={`contentSection${sectionIndex}ItemBodies`}
            value={item.body}
            onChange={(value) =>
              onChange((current) => ({ ...current, body: value }))
            }
            wide
          />
        )}
        {!showBody && (
          <input
            type="hidden"
            name={`contentSection${sectionIndex}ItemBodies`}
            value={item.body}
          />
        )}
        <input
          type="hidden"
          name={`contentSection${sectionIndex}ItemCtaTexts`}
          value={item.ctaText}
        />
        <input
          type="hidden"
          name={`contentSection${sectionIndex}ItemCtaUrls`}
          value={item.ctaUrl}
        />
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {label}
      </span>
      <input
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full min-w-0 rounded-2xl border border-[#ead9cf] bg-white px-4 py-3 text-sm font-semibold text-[#5a2348] outline-none transition focus:border-[#e46f64]"
      />
    </label>
  );
}

function Area({
  label,
  name,
  value,
  onChange,
  wide = false,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  wide?: boolean;
}) {
  return (
    <label className={`block min-w-0 ${wide ? "md:col-span-2" : ""}`}>
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {label}
      </span>
      <textarea
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className="mt-2 w-full min-w-0 resize-none rounded-2xl border border-[#ead9cf] bg-white px-4 py-3 text-sm font-semibold leading-6 text-[#5a2348] outline-none transition focus:border-[#e46f64]"
      />
    </label>
  );
}
