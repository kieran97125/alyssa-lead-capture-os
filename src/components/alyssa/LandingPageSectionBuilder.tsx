"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type {
  LandingPageContentSection,
  LandingPageContentSectionColumns,
  LandingPageContentSectionImageMode,
  LandingPageContentSectionItem,
  LandingPageContentSectionType,
} from "@/lib/data/landingPages";

const sectionTypes: Array<{
  value: LandingPageContentSectionType;
  label: string;
  defaultName: string;
  defaultColumns: LandingPageContentSectionColumns;
  defaultImageMode: LandingPageContentSectionImageMode;
}> = [
  {
    value: "text",
    label: "文字內容",
    defaultName: "內容介紹",
    defaultColumns: 1,
    defaultImageMode: "none",
  },
  {
    value: "image_text",
    label: "圖片 + 文字",
    defaultName: "圖文介紹",
    defaultColumns: 1,
    defaultImageMode: "optional",
  },
  {
    value: "cards",
    label: "卡片內容",
    defaultName: "重點卡片",
    defaultColumns: 3,
    defaultImageMode: "optional",
  },
  {
    value: "steps",
    label: "療程流程 / Step",
    defaultName: "療程流程",
    defaultColumns: 3,
    defaultImageMode: "required",
  },
  {
    value: "faq",
    label: "FAQ 問答",
    defaultName: "常見問題",
    defaultColumns: 1,
    defaultImageMode: "none",
  },
  {
    value: "image_grid",
    label: "圖片格",
    defaultName: "圖片展示",
    defaultColumns: 3,
    defaultImageMode: "required",
  },
];

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function emptyItem(index = 0): LandingPageContentSectionItem {
  return {
    id: makeId(`item-${index + 1}`),
    title: "",
    body: "",
    imageUrl: "",
    caption: "",
    ctaText: "",
    ctaUrl: "",
  };
}

function sectionOption(type: LandingPageContentSectionType) {
  return sectionTypes.find((option) => option.value === type) ?? sectionTypes[0];
}

function maxItemsForType(type: LandingPageContentSectionType) {
  if (type === "image_grid") return 12;
  if (type === "cards" || type === "steps" || type === "faq") return 8;
  return 1;
}

function supportsImage(type: LandingPageContentSectionType) {
  return type === "image_text" || type === "cards" || type === "steps" || type === "image_grid";
}

function supportsColumns(type: LandingPageContentSectionType) {
  return type === "cards" || type === "steps" || type === "image_grid";
}

function normalizeInitialSection(
  section: LandingPageContentSection,
  index: number
): LandingPageContentSection {
  const option = sectionOption(section.type);
  return {
    ...section,
    id: section.id || makeId("section"),
    name: section.name || section.label || section.title || option.defaultName,
    label: section.label || section.name || option.defaultName,
    columns: section.columns || option.defaultColumns,
    itemImageMode: section.itemImageMode || option.defaultImageMode,
    order: section.order ?? index + 1,
    items: (section.items.length > 0 ? section.items : [emptyItem()]).map(
      (item, itemIndex) => ({
        id: item.id || makeId(`item-${itemIndex + 1}`),
        title: item.title || "",
        body: item.body || "",
        imageUrl: item.imageUrl || "",
        caption: item.caption || "",
        ctaText: item.ctaText || "",
        ctaUrl: item.ctaUrl || "",
      })
    ),
  };
}

function makeSection(type: LandingPageContentSectionType, index: number): LandingPageContentSection {
  const option = sectionOption(type);
  return {
    id: makeId("section"),
    name: option.defaultName,
    type,
    layout: type,
    label: option.defaultName,
    title: option.defaultName,
    subtitle: "",
    columns: option.defaultColumns,
    itemImageMode: option.defaultImageMode,
    order: index + 1,
    items: [emptyItem()],
  };
}

function imageGuidance(type: LandingPageContentSectionType, columns: LandingPageContentSectionColumns) {
  if (type === "image_text") {
    return ["建議比例：16:9 或 4:3", "建議尺寸：1600 × 900px / 1200 × 900px", "用途：大圖介紹、療程環境或重點說明"];
  }
  if (type === "image_grid") {
    return ["建議比例：1:1", "建議尺寸：1080 × 1080px", "用途：圖片展示或前後對比格"];
  }
  if (type === "steps") {
    return ["建議比例：4:3", "建議尺寸：1200 × 900px", "用途：療程步驟、流程或重點圖解"];
  }
  if (type === "cards" && columns === 2) {
    return ["建議比例：4:3", "建議尺寸：1200 × 900px", "用途：雙欄圖文卡片"];
  }
  return ["建議比例：4:3", "建議尺寸：1200 × 900px", "用途：卡片圖片、流程或賣點說明"];
}

export function LandingPageSectionBuilder({
  initialSections,
}: {
  initialSections: LandingPageContentSection[];
}) {
  const [sections, setSections] = useState<LandingPageContentSection[]>(
    initialSections.slice(0, 8).map(normalizeInitialSection)
  );
  const [isAdding, setIsAdding] = useState(false);
  const canAdd = sections.length < 8;

  const orderRows = useMemo(
    () => [
      { label: "Hero", locked: true },
      { label: "快速登記 CTA", locked: true },
      { label: "優惠摘要", locked: true },
      ...sections.map((section) => ({
        label: section.name || section.label || section.title || "自訂內容",
        locked: false,
      })),
      { label: "預約表格", locked: true },
      { label: "Legal Footer", locked: true },
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

  function addSection(type: LandingPageContentSectionType) {
    if (!canAdd) return;
    setSections((current) => [...current, makeSection(type, current.length)]);
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
      if (section.items.length >= maxItemsForType(section.type)) return section;
      return { ...section, items: [...section.items, emptyItem(section.items.length)] };
    });
  }

  function deleteItem(sectionIndex: number, itemIndex: number) {
    updateSection(sectionIndex, (section) => ({
      ...section,
      items: section.items.filter((_, index) => index !== itemIndex),
    }));
  }

  function moveItem(sectionIndex: number, itemIndex: number, direction: -1 | 1) {
    updateSection(sectionIndex, (section) => {
      const target = itemIndex + direction;
      if (target < 0 || target >= section.items.length) return section;
      const next = [...section.items];
      const [item] = next.splice(itemIndex, 1);
      next.splice(target, 0, item);
      return { ...section, items: next };
    });
  }

  return (
    <div className="grid gap-5">
      {sections.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[#d9b66f] bg-white/75 p-5 text-sm font-semibold leading-6 text-[#6d4a5c]">
          暫時未有自訂內容區塊。可新增文字、圖文、卡片、療程流程、FAQ 或圖片格。
        </div>
      )}

      {sections.map((section, sectionIndex) => (
        <section
          key={section.id}
          className="rounded-[28px] border border-[#ead9cf] bg-[#fff6f0] p-4 md:p-5"
        >
          <input type="hidden" name="contentSectionEnabled" value="true" />
          <input type="hidden" name="contentSectionIds" value={section.id} />
          <input type="hidden" name="contentSectionLayouts" value={section.type} />
          <input type="hidden" name="contentSectionOrders" value={`${sectionIndex + 1}`} />

          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
                自訂內容 {sectionIndex + 1}
              </p>
              <Field
                label="Section 名稱"
                name="contentSectionNames"
                value={section.name}
                onChange={(value) =>
                  updateSection(sectionIndex, (current) => ({
                    ...current,
                    name: value,
                    label: value,
                  }))
                }
              />
              <input type="hidden" name="contentSectionLabels" value={section.name} />
            </div>
            <div className="flex flex-wrap gap-2">
              <SmallButton onClick={() => moveSection(sectionIndex, -1)} disabled={sectionIndex === 0}>
                上移
              </SmallButton>
              <SmallButton onClick={() => moveSection(sectionIndex, 1)} disabled={sectionIndex === sections.length - 1}>
                下移
              </SmallButton>
              <SmallButton tone="danger" onClick={() => deleteSection(sectionIndex)}>
                刪除
              </SmallButton>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Select
              label="內容類型"
              name="contentSectionTypes"
              value={section.type}
              options={sectionTypes.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              onChange={(value) => {
                const nextType = value as LandingPageContentSectionType;
                const option = sectionOption(nextType);
                updateSection(sectionIndex, (current) => ({
                  ...current,
                  type: nextType,
                  layout: nextType,
                  columns: supportsColumns(nextType) ? current.columns || option.defaultColumns : option.defaultColumns,
                  itemImageMode: supportsImage(nextType) ? option.defaultImageMode : "none",
                  items: current.items.slice(0, maxItemsForType(nextType)),
                }));
              }}
            />
            {supportsColumns(section.type) ? (
              <Select
                label="每行顯示"
                name="contentSectionColumns"
                value={`${section.columns}`}
                options={[1, 2, 3, 4].map((column) => ({
                  value: `${column}`,
                  label: `${column} 欄`,
                }))}
                onChange={(value) =>
                  updateSection(sectionIndex, (current) => ({
                    ...current,
                    columns: Number(value) as LandingPageContentSectionColumns,
                  }))
                }
              />
            ) : (
              <input type="hidden" name="contentSectionColumns" value={`${section.columns}`} />
            )}
            {supportsImage(section.type) ? (
              <Select
                label="圖片設定"
                name="contentSectionItemImageModes"
                value={section.itemImageMode}
                options={[
                  { value: "optional", label: "可有圖片" },
                  { value: "required", label: "必須有圖片才公開顯示" },
                ]}
                onChange={(value) =>
                  updateSection(sectionIndex, (current) => ({
                    ...current,
                    itemImageMode: value as LandingPageContentSectionImageMode,
                  }))
                }
              />
            ) : (
              <input type="hidden" name="contentSectionItemImageModes" value="none" />
            )}
            <Field
              label="公開標題"
              name="contentSectionTitles"
              value={section.title}
              onChange={(value) =>
                updateSection(sectionIndex, (current) => ({ ...current, title: value }))
              }
            />
            <Area
              label="公開副標題"
              name="contentSectionSubtitles"
              value={section.subtitle}
              onChange={(value) =>
                updateSection(sectionIndex, (current) => ({ ...current, subtitle: value }))
              }
              wide
            />
          </div>

          <div className="mt-5 grid gap-3">
            {section.items.map((item, itemIndex) => (
              <SectionItemEditor
                key={item.id}
                item={item}
                itemIndex={itemIndex}
                section={section}
                sectionIndex={sectionIndex}
                onChange={(updater) => updateItem(sectionIndex, itemIndex, updater)}
                onDelete={() => deleteItem(sectionIndex, itemIndex)}
                onMoveUp={() => moveItem(sectionIndex, itemIndex, -1)}
                onMoveDown={() => moveItem(sectionIndex, itemIndex, 1)}
              />
            ))}
          </div>

          {section.items.length < maxItemsForType(section.type) && (
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
        <div className="rounded-[28px] border border-[#ead9cf] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
            Step 1
          </p>
          <h3 className="mt-1 font-bold text-[#321428]">選擇內容類型</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sectionTypes.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => addSection(option.value)}
                className="rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-4 py-4 text-left text-sm font-bold text-[#5a2348] transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs font-semibold leading-5 text-[#6d4a5c]">
            Step 2：新增後可在 section 內設定欄數、圖片要求及項目內容。
          </p>
        </div>
      )}

      {!isAdding && canAdd && (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="w-fit rounded-full bg-[#5a2348] px-5 py-3 text-sm font-bold text-white"
        >
          新增內容區塊
        </button>
      )}

      <section className="rounded-[28px] border border-[#ead9cf] bg-white p-5">
        <h3 className="font-bold text-[#321428]">頁面順序</h3>
        <div className="mt-3 grid gap-2">
          {orderRows.map((row, index) => (
            <div
              key={`${row.label}-${index}`}
              className="flex items-center justify-between rounded-xl bg-[#fff6f0] px-4 py-3 text-sm font-semibold text-[#5a2348]"
            >
              <span className="min-w-0 break-words">{row.label}</span>
              <span className="shrink-0 text-xs text-[#9a5d76]">
                {row.locked ? "固定" : "可移動"}
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
  section,
  sectionIndex,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  item: LandingPageContentSectionItem;
  itemIndex: number;
  section: LandingPageContentSection;
  sectionIndex: number;
  onChange: (updater: (item: LandingPageContentSectionItem) => LandingPageContentSectionItem) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const isFaq = section.type === "faq";
  const imageEnabled = supportsImage(section.type);

  return (
    <div className="rounded-2xl border border-[#ead9cf] bg-white/85 p-4">
      <input type="hidden" name={`contentSection${sectionIndex}ItemIds`} value={item.id} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
          {isFaq ? `FAQ ${itemIndex + 1}` : section.type === "steps" ? `STEP ${itemIndex + 1}` : `Item ${itemIndex + 1}`}
        </p>
        <div className="flex flex-wrap gap-2">
          <SmallButton onClick={onMoveUp} disabled={itemIndex === 0}>上移</SmallButton>
          <SmallButton onClick={onMoveDown} disabled={itemIndex === section.items.length - 1}>下移</SmallButton>
          <SmallButton tone="danger" onClick={onDelete}>刪除</SmallButton>
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Field
          label={isFaq ? "問題" : "標題"}
          name={`contentSection${sectionIndex}ItemTitles`}
          value={item.title}
          onChange={(value) => onChange((current) => ({ ...current, title: value }))}
        />
        {imageEnabled ? (
          <Field
            label="圖片 URL"
            name={`contentSection${sectionIndex}ItemImageUrls`}
            value={item.imageUrl}
            guidance={imageGuidance(section.type, section.columns)}
            onChange={(value) => onChange((current) => ({ ...current, imageUrl: value }))}
          />
        ) : (
          <input type="hidden" name={`contentSection${sectionIndex}ItemImageUrls`} value={item.imageUrl} />
        )}
        <Area
          label={isFaq ? "答案" : "內容"}
          name={`contentSection${sectionIndex}ItemBodies`}
          value={item.body}
          onChange={(value) => onChange((current) => ({ ...current, body: value }))}
          wide
        />
        {imageEnabled ? (
          <Field
            label="圖片說明"
            name={`contentSection${sectionIndex}ItemCaptions`}
            value={item.caption}
            onChange={(value) => onChange((current) => ({ ...current, caption: value }))}
          />
        ) : (
          <input type="hidden" name={`contentSection${sectionIndex}ItemCaptions`} value={item.caption} />
        )}
        <input type="hidden" name={`contentSection${sectionIndex}ItemCtaTexts`} value={item.ctaText} />
        <input type="hidden" name={`contentSection${sectionIndex}ItemCtaUrls`} value={item.ctaUrl} />
      </div>
    </div>
  );
}

function SmallButton({
  children,
  disabled = false,
  tone = "default",
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  tone?: "default" | "danger";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full border px-3 py-2 text-xs font-bold transition disabled:opacity-40 ${
        tone === "danger"
          ? "border-[#f0c8d5] bg-white text-[#9a2f5b]"
          : "border-[#d9b66f] bg-white text-[#5a2348]"
      }`}
    >
      {children}
    </button>
  );
}

function Select({
  label,
  name,
  value,
  options,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {label}
      </span>
      <select
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full min-w-0 rounded-2xl border border-[#ead9cf] bg-white px-4 py-3 text-sm font-semibold text-[#5a2348] outline-none transition focus:border-[#e46f64]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  guidance,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  guidance?: string[];
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
      {guidance && guidance.length > 0 && (
        <div className="mt-2 rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-3 py-2 text-xs font-semibold leading-5 text-[#6d4a5c]">
          {guidance.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      )}
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
