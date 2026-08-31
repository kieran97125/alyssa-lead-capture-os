"use client";

import { useRef } from "react";
import {
  CreativeBriefEditor,
  type CreativeBriefEditorHandle,
} from "@/components/creative/CreativeBriefEditor";

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

export function CreativeProductionFixture() {
  const editorRef = useRef<CreativeBriefEditorHandle | null>(null);
  return (
    <main className="min-h-screen bg-[#fbf7f5] p-8 text-[#321428]">
      <section className="mx-auto max-w-[1500px]">
        <header>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#9a5d76]">
            Creative production fixture
          </p>
          <h1 className="mt-1 text-3xl font-black">設計工作</h1>
        </header>

        <section className="mt-6 overflow-hidden rounded-2xl border border-[#e8dcd5] bg-white" data-testid="creative-job-list-fixture">
          <div className="grid grid-cols-[2fr_repeat(10,1fr)] gap-2 border-b border-[#eadfd9] bg-[#fbf9f7] px-4 py-3 text-[10px] font-black">
            {[
              "Job",
              "品牌",
              "Designer",
              "Source",
              "用途",
              "媒體格式",
              "優先",
              "Start",
              "Due",
              "出街／日曆",
              "狀態",
            ].map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="grid grid-cols-[2fr_repeat(10,1fr)] gap-2 px-4 py-4 text-[11px] font-semibold">
            <strong>GOS KOL 脫毛廣告片</strong>
            <span>GOS</span>
            <span>Amber</span>
            <span>KOL 拍攝</span>
            <span>Meta AD</span>
            <span>Video</span>
            <span>優先</span>
            <span>1/9</span>
            <span>4/9</span>
            <span>6/9</span>
            <span>製作中</span>
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
