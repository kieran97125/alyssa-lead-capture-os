"use client";

import { useState } from "react";

export function ReplyTemplateCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleCopy() {
    setFailed(false);

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
      setFailed(true);
      window.setTimeout(() => setFailed(false), 2200);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex h-7 items-center justify-center rounded-md border border-[#dbeafe] bg-white px-2.5 text-[10px] font-black text-[#1d4ed8] transition hover:bg-[#eff6ff]"
    >
      {copied ? "已複製" : failed ? "複製失敗" : "複製文字"}
    </button>
  );
}
