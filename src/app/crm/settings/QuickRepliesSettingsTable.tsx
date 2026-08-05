"use client";

import { Fragment, useState } from "react";
import { SubmitButton } from "@/components/alyssa/SubmitButton";
import type { CrmReplyTemplate } from "@/lib/crm/settingsConfig";
import { updateQuickReplyAction } from "./actions";

export function QuickRepliesSettingsTable({
  templates,
}: {
  templates: CrmReplyTemplate[];
}) {
  const [editingKey, setEditingKey] = useState<string | null>(null);

  return (
    <div className="overflow-hidden rounded-lg border border-[#e5e7eb] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eef2f6] bg-[#fbfdff] px-3 py-2">
        <div>
          <p className="text-[12px] font-black text-[#111827]">快速回覆</p>
          <p className="mt-0.5 text-[11px] font-semibold text-[#64748b]">
            CS 可插入預設內容，核對及修改後再發送。
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse text-left">
          <thead className="bg-[#f8fafc] text-[10px] font-black uppercase tracking-[0.08em] text-[#64748b]">
            <tr>
              <th className="w-[150px] px-3 py-2">識別碼</th>
              <th className="w-[180px] px-3 py-2">標題</th>
              <th className="px-3 py-2">用途</th>
              <th className="w-[170px] px-3 py-2">建議狀態</th>
              <th className="w-[90px] px-3 py-2">狀態</th>
              <th className="w-[150px] px-3 py-2">更新時間</th>
              <th className="w-[92px] px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eef2f6] text-[12px]">
            {templates.map((template) => {
              const expanded = editingKey === template.key;

              return (
                <Fragment key={template.key}>
                  <tr className="align-top hover:bg-[#fbfdff]">
                    <td className="px-3 py-2">
                      <span className="font-mono text-[11px] font-bold text-[#475569]">
                        {template.key}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-black text-[#111827]">{template.title}</span>
                      <span className="mt-0.5 block text-[11px] font-semibold text-[#64748b]">
                        {template.group}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <p className="max-h-10 max-w-[360px] overflow-hidden font-semibold leading-5 text-[#475569]">
                        {template.useCase}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-semibold text-[#475569]">
                        {template.recommendedStatuses?.length
                          ? template.recommendedStatuses.join(" / ")
                          : "-"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex rounded-md border border-emerald-100 bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700">
                        {template.enabled === false ? "已停用" : "使用中"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-semibold text-[#64748b]">
                        {formatUpdatedAt(template.updatedAt)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setEditingKey(expanded ? null : template.key)}
                        className="h-7 rounded-md border border-[#dbe2ea] bg-white px-2.5 text-[11px] font-black text-[#334155] transition hover:border-[#D85BA3] hover:text-[#B93D83]"
                      >
                        {expanded ? "收起" : "編輯"}
                      </button>
                    </td>
                  </tr>
                  {expanded ? (
                    <tr className="bg-[#fbfdff]">
                      <td colSpan={7} className="px-3 py-3">
                        <QuickReplyInlineEditor
                          template={template}
                          onCancel={() => setEditingKey(null)}
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QuickReplyInlineEditor({
  template,
  onCancel,
}: {
  template: CrmReplyTemplate;
  onCancel: () => void;
}) {
  const action = updateQuickReplyAction.bind(null, template.key);

  return (
    <form action={action} className="rounded-lg border border-[#dbeafe] bg-white p-3">
      <div className="grid gap-3 lg:grid-cols-[260px_1fr]">
        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-[0.08em] text-[#64748b]">
            標題
          </span>
          <input
            name="label"
            required
            maxLength={80}
            defaultValue={template.title}
            className="mt-1.5 h-9 w-full rounded-md border border-[#dbe2ea] bg-white px-2.5 text-[12px] font-semibold text-[#111827] outline-none focus:border-[#D85BA3] focus:ring-2 focus:ring-[#F9D7EA]"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-[0.08em] text-[#64748b]">
            回覆內容
          </span>
          <textarea
            name="body"
            required
            maxLength={1200}
            rows={4}
            defaultValue={template.body}
            className="mt-1.5 min-h-24 w-full resize-y rounded-md border border-[#dbe2ea] bg-white px-2.5 py-2 text-[12px] font-semibold leading-5 text-[#111827] outline-none focus:border-[#D85BA3] focus:ring-2 focus:ring-[#F9D7EA]"
          />
        </label>
      </div>
      <div className="mt-3 grid gap-2 rounded-md bg-[#f8fafc] px-2.5 py-2 text-[11px] font-semibold leading-5 text-[#64748b] lg:grid-cols-2">
        <p>用途：{template.useCase}</p>
        <p>
          建議狀態：{" "}
          {template.recommendedStatuses?.length
            ? template.recommendedStatuses.join(" / ")
            : "-"}
        </p>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-[#64748b]">
          只會更新標題同回覆內容；識別碼、分類、次序、啟用狀態及建議狀態維持不變。
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-8 rounded-md border border-[#dbe2ea] bg-white px-3 text-[11px] font-black text-[#475569] transition hover:border-[#94a3b8]"
          >
            取消
          </button>
          <SubmitButton
            className="h-8 rounded-md bg-[#5a2348] px-3 text-[11px] font-black text-white shadow-sm transition hover:bg-[#471b39]"
            pendingLabel="儲存中…"
          >
            儲存快速回覆
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}

function formatUpdatedAt(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("zh-HK", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
