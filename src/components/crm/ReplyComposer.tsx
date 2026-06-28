"use client";

import { useMemo, useState } from "react";
import type { CrmReplyTemplate } from "@/lib/crm/settingsConfig";

type AiDraft = {
  key: string;
  title: string;
  body: string;
};

type ReplyContext = {
  customerName: string;
  brandName: string;
  treatmentOffer: string;
  statusLabel: string;
  appointmentPreference: string;
  confirmedAppointment: string;
  latestContactNote: string;
  whatsappUrl: string | null;
};

export function ReplyComposer({
  quickReplies,
  aiDrafts,
  context,
}: {
  quickReplies: CrmReplyTemplate[];
  aiDrafts: AiDraft[];
  context: ReplyContext;
}) {
  const [message, setMessage] = useState("");
  const [selectedQuickReplyKey, setSelectedQuickReplyKey] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [generationCount, setGenerationCount] = useState(0);

  const recommendedReplies = useMemo(
    () => quickReplies.filter((reply) => reply.enabled !== false).slice(0, 8),
    [quickReplies]
  );

  const selectedQuickReply = quickReplies.find(
    (reply) => reply.key === selectedQuickReplyKey
  );

  function insertQuickReply(reply: CrmReplyTemplate) {
    setSelectedQuickReplyKey(reply.key);
    setMessage(reply.body);
  }

  function generateAiReply() {
    const nextCount = generationCount + 1;
    setGenerationCount(nextCount);
    setAiSuggestion(
      buildLocalAiSuggestion({
        context,
        selectedQuickReply,
        aiDrafts,
        seed: nextCount,
      })
    );
  }

  return (
    <section className="rounded-lg border border-[#e5e7eb] bg-white p-3.5 xl:col-span-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-bold text-[#111827]">
            Reply Composer / 回覆編輯器
          </h2>
          <p className="mt-1 text-[11px] font-semibold leading-5 text-[#64748b]">
            CS 可以直接揀 Quick Reply，或者用 AI Assist 產生較自然的回覆草稿，再人手檢查及修改。
          </p>
        </div>
        <span className="rounded-md bg-[#f8fafc] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[#64748b]">
          Manual review required
        </span>
      </div>

      <div className="mt-3 rounded-md border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-3 py-2">
        <p className="text-[11px] font-black text-[#334155]">Conversation context</p>
        <p className="mt-1 text-[11px] font-semibold leading-5 text-[#64748b]">
          完成 WhatsApp 連接後，對話紀錄會自動顯示。暫時請 CS 以手動 WhatsApp 內容、最新跟進紀錄及下方客人資料作判斷。
        </p>
        <div className="mt-2 grid gap-1 text-[11px] font-semibold text-[#475569] sm:grid-cols-2">
          <span>狀態：{context.statusLabel}</span>
          <span>療程：{context.treatmentOffer}</span>
          <span>客人偏好：{context.appointmentPreference}</span>
          <span>已確認預約：{context.confirmedAppointment}</span>
          <span className="sm:col-span-2">最新跟進：{context.latestContactNote || "-"}</span>
        </div>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,360px)_1fr]">
        <div className="grid gap-3">
          <div className="rounded-lg border border-[#eef2f6] bg-[#fbfdff] p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[12px] font-black text-[#111827]">Quick Replies</h3>
              <span className="rounded-md bg-white px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-[#64748b]">
                Preset
              </span>
            </div>
            <p className="mt-1 text-[11px] font-semibold leading-5 text-[#64748b]">
              標準預設回覆。點選後會放入右邊訊息框，CS 可再修改。
            </p>
            <div className="mt-2 grid gap-2">
              {recommendedReplies.map((reply) => (
                <button
                  key={reply.key}
                  type="button"
                  onClick={() => insertQuickReply(reply)}
                  className={`rounded-md border px-3 py-2 text-left transition ${
                    selectedQuickReplyKey === reply.key
                      ? "border-[#D85BA3] bg-[#FDF2F8]"
                      : "border-[#e5e7eb] bg-white hover:border-[#D85BA3]"
                  }`}
                >
                  <span className="block text-[11px] font-black text-[#111827]">
                    {reply.title}
                  </span>
                  <span className="mt-0.5 block max-h-8 overflow-hidden text-[10px] font-semibold leading-4 text-[#64748b]">
                    {reply.useCase}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-[#dbeafe] bg-[#eff6ff] p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[12px] font-black text-[#111827]">AI Assist</h3>
              <span className="rounded-md bg-white px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-[#1d4ed8]">
                Local draft
              </span>
            </div>
            <p className="mt-1 text-[11px] font-semibold leading-5 text-[#475569]">
              目前只會根據客人狀態、療程及預約資料產生草稿，智能回覆只會填入草稿，需同事確認。
            </p>
            <button
              type="button"
              onClick={generateAiReply}
              className="mt-2 h-8 rounded-md bg-[#1d4ed8] px-3 text-[11px] font-black text-white transition hover:bg-[#1e40af]"
            >
              Generate reply
            </button>
          </div>
        </div>

        <div className="grid gap-3">
          {aiSuggestion ? (
            <div className="rounded-lg border border-[#bfdbfe] bg-[#eff6ff] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[12px] font-black text-[#111827]">
                  AI generated suggestion
                </h3>
                <button
                  type="button"
                  onClick={() => setMessage(aiSuggestion)}
                  className="h-7 rounded-md bg-white px-2.5 text-[10px] font-black text-[#1d4ed8] transition hover:bg-[#dbeafe]"
                >
                  Use this reply
                </button>
              </div>
              <p className="mt-2 whitespace-pre-line text-[12px] font-semibold leading-5 text-[#334155]">
                {aiSuggestion}
              </p>
            </div>
          ) : null}

          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#64748b]">
              Message to review
            </span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="選擇 Quick Reply 或按 Generate reply 產生草稿，然後在這裡修改。"
              rows={8}
              className="mt-1.5 min-h-40 w-full resize-y rounded-md border border-[#e5e7eb] bg-[#f8fafc] px-3 py-2 text-[13px] font-semibold leading-6 text-[#111827] outline-none focus:border-[#D85BA3] focus:bg-white focus:ring-2 focus:ring-[#F9D7EA]"
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#fef3c7] bg-[#fffbeb] px-3 py-2">
            <p className="text-[11px] font-semibold leading-5 text-[#92400e]">
              完成 WhatsApp 連接後可直接發送；目前仍需人手開啟 WhatsApp，再由同事確認及發送。
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {context.whatsappUrl ? (
                <a
                  href={context.whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center justify-center rounded-md border border-[#bbf7d0] bg-white px-3 text-[11px] font-black text-[#15803d] transition hover:bg-[#dcfce7]"
                >
                  Open WhatsApp
                </a>
              ) : null}
              <button
                type="button"
                disabled
                className="h-8 rounded-md bg-[#e5e7eb] px-3 text-[11px] font-black text-[#94a3b8]"
              >
                Send via WhatsApp 尚未啟用
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function buildLocalAiSuggestion({
  context,
  selectedQuickReply,
  aiDrafts,
  seed,
}: {
  context: ReplyContext;
  selectedQuickReply?: CrmReplyTemplate;
  aiDrafts: AiDraft[];
  seed: number;
}) {
  const greetings = [
    `你好 ${context.customerName}，`,
    `Hello ${context.customerName}，`,
    `${context.customerName} 你好，`,
  ];
  const ctas = [
    "你方便嘅話，可以回覆我哋確認一下時間安排。",
    "如果時間合適，我哋可以再幫你跟進預約安排。",
    "你可以 WhatsApp 回覆我哋，CS 會再同你確認細節。",
  ];
  const greeting = greetings[seed % greetings.length];
  const cta = ctas[seed % ctas.length];
  const baseDraft = selectedQuickReply?.body || aiDrafts[seed % Math.max(aiDrafts.length, 1)]?.body;
  const preference =
    context.appointmentPreference && context.appointmentPreference !== "-"
      ? `我哋見到你偏好時間係 ${context.appointmentPreference}。`
      : "我哋可以按你方便嘅時間再協助安排。";
  const confirmed =
    context.confirmedAppointment && !context.confirmedAppointment.includes("未")
      ? `目前已確認預約時間：${context.confirmedAppointment}。`
      : "";
  const latest = context.latestContactNote
    ? `另外，之前跟進紀錄係：「${context.latestContactNote}」。`
    : "";

  if (baseDraft) {
    return `${greeting}\n\n${baseDraft}\n\n${preference}${confirmed ? `\n${confirmed}` : ""}${latest ? `\n${latest}` : ""}\n\n${cta}`;
  }

  return `${greeting}\n\n我哋收到你對 ${context.brandName} ${context.treatmentOffer} 嘅查詢。${preference}${confirmed ? `\n${confirmed}` : ""}${latest ? `\n${latest}` : ""}\n\n${cta}`;
}
