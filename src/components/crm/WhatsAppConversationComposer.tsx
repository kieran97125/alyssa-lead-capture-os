"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type TemplateOption = {
  id: string;
  template_name: string;
  language_code: string;
  category: string | null;
};

export function WhatsAppConversationComposer({
  conversationId,
  brandId,
  leadId,
  serviceWindowState,
  templates,
}: {
  conversationId: string;
  brandId: string;
  leadId: string | null;
  serviceWindowState: "open" | "template_required" | "unknown";
  templates: TemplateOption[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"text" | "template">(
    serviceWindowState === "open" ? "text" : "template"
  );
  const [body, setBody] = useState("");
  const [templateId, setTemplateId] = useState(templates[0]?.id || "");
  const [variablesText, setVariablesText] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const freeFormAllowed = serviceWindowState === "open";
  const selectedTemplate = useMemo(
    () => templates.find((item) => item.id === templateId) || null,
    [templateId, templates]
  );

  async function handleSend() {
    if (sending) return;
    setFeedback(null);

    if (mode === "text" && (!freeFormAllowed || !body.trim())) {
      setFeedback(
        freeFormAllowed
          ? "請輸入訊息內容。"
          : "目前需要使用已核准的 Template。"
      );
      return;
    }
    if (mode === "template" && !templateId) {
      setFeedback("請先同步並選擇一個 Approved Template。");
      return;
    }

    setSending(true);
    try {
      const response = await fetch("/api/crm/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          conversation_id: conversationId,
          brand_id: brandId,
          lead_id: leadId,
          body: mode === "text" ? body.trim() : undefined,
          template_id: mode === "template" ? templateId : undefined,
          variables:
            mode === "template"
              ? variablesText
                  .split("\n")
                  .map((item) => item.trim())
                  .filter(Boolean)
              : undefined,
        }),
      });
      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string; error?: string }
        | null;
      if (!response.ok || !result?.ok) {
        setFeedback(readableError(result?.error || result?.message || "send_failed"));
        return;
      }
      setBody("");
      setVariablesText("");
      setFeedback("訊息已送出。");
      router.refresh();
    } catch {
      setFeedback("無法連接訊息服務，請稍後再試。");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="rounded-xl border border-[#dbe2ea] bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-black text-[#111827]">回覆 WhatsApp</h2>
          <p className="mt-1 text-xs font-semibold text-[#64748b]">
            {serviceWindowState === "open"
              ? "客服視窗開啟中，可以自由回覆。"
              : serviceWindowState === "template_required"
                ? "客服視窗已關閉，必須使用 Approved Template。"
                : "未有客人 inbound 訊息，首次聯絡必須使用 Approved Template。"}
          </p>
        </div>
        <div className="flex rounded-lg border border-[#dbe2ea] bg-[#f8fafc] p-1">
          <button
            type="button"
            disabled={!freeFormAllowed}
            onClick={() => setMode("text")}
            className={`rounded-md px-3 py-1.5 text-xs font-black ${
              mode === "text"
                ? "bg-white text-[#111827] shadow-sm"
                : "text-[#64748b]"
            } disabled:cursor-not-allowed disabled:opacity-40`}
          >
            自由訊息
          </button>
          <button
            type="button"
            onClick={() => setMode("template")}
            className={`rounded-md px-3 py-1.5 text-xs font-black ${
              mode === "template"
                ? "bg-white text-[#111827] shadow-sm"
                : "text-[#64748b]"
            }`}
          >
            Template
          </button>
        </div>
      </div>

      {mode === "text" ? (
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value.slice(0, 4000))}
          rows={4}
          placeholder="輸入 WhatsApp 訊息…"
          className="mt-4 w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm outline-none focus:border-[#6366f1]"
        />
      ) : (
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-xs font-black text-[#334155]">
            Approved Template
            <select
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value)}
              className="h-10 rounded-lg border border-[#d1d5db] bg-white px-3 text-sm"
            >
              {!templates.length ? (
                <option value="">未有 Approved Template</option>
              ) : null}
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.template_name} · {template.language_code}
                </option>
              ))}
            </select>
          </label>
          {selectedTemplate ? (
            <p className="text-xs font-semibold text-[#64748b]">
              {selectedTemplate.category || "Template"} · {selectedTemplate.language_code}
            </p>
          ) : null}
          <label className="grid gap-1 text-xs font-black text-[#334155]">
            變數（每行一個，按 Template 順序）
            <textarea
              value={variablesText}
              onChange={(event) => setVariablesText(event.target.value.slice(0, 5000))}
              rows={3}
              placeholder={"Kieran\nFaceLift\n銅鑼灣"}
              className="rounded-lg border border-[#d1d5db] px-3 py-2 text-sm outline-none focus:border-[#6366f1]"
            />
          </label>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className={`text-xs font-bold ${feedback ? "text-[#b45309]" : "text-[#94a3b8]"}`}>
          {feedback || "所有發送均由伺服器處理，Token 不會暴露於瀏覽器。"}
        </p>
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || (mode === "template" && !templates.length)}
          className="h-10 shrink-0 rounded-lg bg-[#111827] px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? "發送中…" : "確認發送"}
        </button>
      </div>
    </section>
  );
}

function readableError(code: string) {
  const labels: Record<string, string> = {
    template_required: "目前不可自由回覆，請使用 Approved Template。",
    approved_template_required: "Template 未核准或已失效。",
    whatsapp_connection_missing: "WhatsApp 尚未連接。",
    access_token_unavailable: "Access Token 未設定或無法解密。",
    valid_phone_required: "客人電話格式無效。",
    meta_send_failed: "Meta 拒絕發送，請檢查權限及訊息設定。",
    meta_template_send_failed: "Template 發送失敗，請檢查語言及變數。",
    conversation_not_found: "找不到對話。",
  };
  return labels[code] || `發送失敗：${code}`;
}
