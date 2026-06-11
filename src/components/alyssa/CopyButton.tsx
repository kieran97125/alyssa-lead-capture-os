"use client";

import { useState } from "react";

type Props = {
  value: string;
  label?: string;
};

export function CopyButton({ value, label = "Copy" }: Props) {
  const [copied, setCopied] = useState(false);

  async function copyValue() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copyValue}
      className="rounded-full border border-[#d9b66f] bg-white px-3 py-1.5 text-xs font-bold text-[#5a2348] transition hover:border-[#c9828e]"
    >
      {copied ? "Copied" : label}
    </button>
  );
}
