"use client";

import { useState } from "react";

export function WhatsAppSendBox({
  leadId,
  brandId,
  disabled,
}: {
  leadId: string;
  brandId: string;
  disabled: boolean;
}) {
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function sendMessage() {
    const message = body.trim();
    if (!message || disabled || sending) return;
    setSending(true);
    setStatus(null);

    try {
      const response = await fetch("/api/crm/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: leadId,
          brand_id: brandId,
          body: message,
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        error?: string;
      } | null;

      if (!response.ok || !result?.ok) {
        setStatus(result?.message || result?.error || "send_failed");
        return;
      }

      setBody("");
      setStatus("message_sent");
    } catch {
      setStatus("send_request_failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-2">
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        disabled={disabled}
        placeholder={
          disabled
            ? "請先連接 WhatsApp。"
            : "輸入訊息；傳送前請再次核對內容。"
        }
        className="min-h-20 rounded-md border border-[#d1d5db] px-3 py-2 text-sm"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={sendMessage}
          disabled={disabled || sending || !body.trim()}
          className="h-9 rounded-md bg-[#111827] px-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:bg-[#d1d5db]"
        >
          {sending ? "傳送中…" : "透過 WhatsApp 傳送"}
        </button>
        {status && (
          <span className="text-xs font-bold text-[#64748b]">{status}</span>
        )}
      </div>
    </div>
  );
}
