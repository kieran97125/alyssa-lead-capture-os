"use client";

import { useRef } from "react";
import {
  CreativeBriefEditor,
  type CreativeBriefEditorHandle,
} from "@/components/creative/CreativeBriefEditor";
import { CreativeJobCreateDialog } from "@/components/creative/CreativeJobCreateDialog";
import { CreativeJobDeleteControl } from "@/components/creative/CreativeJobDeleteControl";
import type { BrandSetting } from "@/lib/data/configuration";
import type {
  CreativeDesignerProfile,
  CreativeTaxonomyItem,
} from "@/lib/creative/types";

const sampleDocument = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Campaign 目的" }],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "為 Meta AD 製作三條不同 Angle 的 KOL 短片。",
        },
      ],
    },
    {
      type: "taskList",
      content: [
        {
          type: "taskItem",
          attrs: { checked: false },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "標清價錢與 CTA" }],
            },
          ],
        },
      ],
    },
  ],
};

const fixtureBrands: BrandSetting[] = [
  {
    id: "fixture-brand",
    name: "GOS",
    slug: "gos",
    primaryColor: "#d66a22",
    secondaryColor: "#fff4eb",
    whatsappNumber: null,
    defaultThankYouUrl: null,
  },
];

const fixtureDesigners: CreativeDesignerProfile[] = [
  {
    id: "fixture-designer",
    displayName: "Amber",
    linkedMemberId: null,
    linkedMemberName: null,
    linkedMemberEmail: null,
    isActive: true,
    sortOrder: 10,
  },
];

const fixtureTaxonomies: CreativeTaxonomyItem[] = [
  {
    id: "fixture-source",
    category: "source",
    name: "KOL 拍攝 Raw Footage",
    isActive: true,
    sortOrder: 10,
  },
  {
    id: "fixture-usage",
    category: "usage",
    name: "Meta AD",
    isActive: true,
    sortOrder: 10,
  },
  {
    id: "fixture-format",
    category: "media_format",
    name: "Video",
    isActive: true,
    sortOrder: 10,
  },
];

export function CreativeProductionFixture() {
  const editorRef = useRef<CreativeBriefEditorHandle | null>(null);
  return (
    <main className="min-h-screen bg-[#fbf7f5] p-4 text-[#321428] sm:p-8">
      <section className="mx-auto max-w-[1500px]">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#9a5d76]">
              Creative production fixture
            </p>
            <h1 className="mt-1 text-3xl font-black">設計工作</h1>
          </div>
          <div className="flex items-center gap-2">
            <CreativeJobDeleteControl
              jobId="fixture-job"
              title="GOS KOL 脫毛廣告片"
              placement="header"
              fixtureMode
            />
            <CreativeJobCreateDialog
              brands={fixtureBrands}
              designers={fixtureDesigners}
              taxonomies={fixtureTaxonomies}
              defaultBrandId="fixture-brand"
              today="2026-09-01"
              fixtureMode
            />
          </div>
        </header>

        <section
          className="mt-6 min-w-0 overflow-hidden rounded-2xl border border-[#e8dcd5] bg-white"
          data-testid="creative-job-list-fixture"
        >
          <div className="hidden grid-cols-[minmax(220px,1.35fr)_minmax(150px,0.82fr)_minmax(220px,1.1fr)_minmax(205px,1fr)_minmax(86px,0.4fr)] gap-3 border-b border-[#eadfd9] bg-[#fbf9f7] px-3 py-2 text-[8px] font-black xl:grid">
            <span>Job</span>
            <span>負責</span>
            <span>製作規格</span>
            <span>時間</span>
            <span>狀態</span>
          </div>
          <div className="relative">
            <div data-testid="creative-job-row" className="grid min-w-0 grid-cols-1 gap-x-3 gap-y-2 px-3 py-2.5 pr-11 text-[10px] font-semibold md:grid-cols-2 xl:grid-cols-[minmax(220px,1.35fr)_minmax(150px,0.82fr)_minmax(220px,1.1fr)_minmax(205px,1fr)_minmax(86px,0.4fr)] xl:items-center">
            <div className="min-w-0">
              <strong className="block truncate text-[12px] leading-4">
                GOS KOL 脫毛廣告片
              </strong>
              <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[8px] leading-3 text-[#927987]">
                <span>3 件 · M · 優先</span>
                <span>建立者：Kieran Kwok</span>
              </span>
            </div>
            <div className="grid gap-1">
              <span>
                <small className="mr-2 text-[#927987]">品牌</small>GOS
              </span>
              <span>
                <small className="mr-2 text-[#927987]">Designer</small>Amber
              </span>
            </div>
            <div className="grid min-w-0 gap-1">
              <span className="truncate">
                <small className="mr-2 text-[#927987]">Source</small>KOL 拍攝 Raw Footage
              </span>
              <span>
                <small className="mr-2 text-[#927987]">用途</small>Meta AD
              </span>
              <span>
                <small className="mr-2 text-[#927987]">媒體格式</small>Video
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <span className="rounded-lg bg-[#f8f4f2] px-2 py-1.5 text-[8px] leading-3">
                <small className="block text-[#927987]">Start</small>1/9
              </span>
              <span className="rounded-lg bg-[#f8f4f2] px-2 py-1.5 text-[8px] leading-3">
                <small className="block text-[#927987]">Due</small>4/9
              </span>
              <span className="rounded-lg bg-[#f8f4f2] px-2 py-1.5 text-[8px] leading-3">
                <small className="block text-[#927987]">Publish</small>6/9
              </span>
            </div>
              <span className="w-fit rounded-full bg-[#f5f1ef] px-2 py-1 text-[8px] font-black">
                製作中
              </span>
            </div>
            <div className="absolute right-2 top-2 xl:top-1/2 xl:-translate-y-1/2">
              <CreativeJobDeleteControl
                jobId="fixture-job"
                title="GOS KOL 脫毛廣告片"
                returnPath="/creative-jobs?brand=fixture-brand&view=review"
                placement="list"
                fixtureMode
              />
            </div>
          </div>
        </section>

        <section className="mt-6" data-testid="creative-rich-brief-fixture">
          <CreativeBriefEditor
            ref={editorRef}
            jobId="fixture"
            initialDocument={sampleDocument}
            editable
            persistenceEnabled={false}
          />
        </section>
      </section>
    </main>
  );
}
