"use client";

import { useRef } from "react";
import { CreativeJobHeaderActions } from "@/components/creative/CreativeJobHeaderActions";
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

        <div className="mt-4 flex justify-end">
          <CreativeJobHeaderActions
            canCreate
            canManageSettings={false}
            today="2026-09-01"
            defaultBrandId="fixture-brand"
            brands={[
              {
                id: "fixture-brand",
                name: "GOS",
                slug: "gos",
                primaryColor: "#f27a23",
                secondaryColor: "#fff7ed",
                whatsappNumber: null,
                defaultThankYouUrl: null,
              },
            ]}
            designers={[
              {
                id: "fixture-designer",
                displayName: "Amber",
                linkedMemberId: null,
                linkedMemberName: null,
                linkedMemberEmail: null,
                isActive: true,
                sortOrder: 10,
              },
            ]}
            taxonomies={[
              {
                id: "fixture-source",
                category: "source",
                name: "KOL 拍攝",
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
            ]}
          />
        </div>

        <section
          className="mt-6 overflow-hidden rounded-2xl border border-[#e8dcd5] bg-white"
          data-testid="creative-job-list-fixture"
        >
          <div className="hidden grid-cols-[1.5fr_.78fr_.85fr_1fr_72px_96px] gap-3 border-b border-[#eadfd9] bg-[#fbf9f7] px-4 py-3 text-[10px] font-black xl:grid">
            <span>Job／Source</span>
            <span>品牌／Designer</span>
            <span>用途／媒體格式</span>
            <span>Start／Due／Publish</span>
            <span>優先</span>
            <span>狀態</span>
          </div>
          <div className="grid min-w-0 gap-3 px-4 py-4 text-[11px] font-semibold xl:grid-cols-[1.5fr_.78fr_.85fr_1fr_72px_96px] xl:items-center">
            <span className="min-w-0">
              <strong className="block truncate">GOS KOL 脫毛廣告片</strong>
              <small className="mt-1 block">1 件 · M workload</small>
              <span className="mt-2 block truncate">Source · KOL 拍攝</span>
            </span>
            <span>
              <strong className="block">GOS</strong>
              <span className="block">Amber</span>
            </span>
            <span>
              <strong className="block">Meta AD</strong>
              <span className="block">Video</span>
            </span>
            <span>
              <strong className="block">Start 1/9 → Due 4/9</strong>
              <span className="block">Publish 6/9</span>
            </span>
            <span>優先</span>
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
