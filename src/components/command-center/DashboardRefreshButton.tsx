"use client";

import { RefreshCw } from "lucide-react";
import { useFormStatus } from "react-dom";

export function DashboardRefreshButton({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;

  return (
    <button
      type="submit"
      className="command-primary-button command-refresh-button"
      disabled={isDisabled}
      aria-disabled={isDisabled}
    >
      <RefreshCw
        size={16}
        className={pending ? "command-refresh-icon is-spinning" : undefined}
      />
      <span aria-live="polite">
        {pending ? "同步數據中…" : "重新整理數據"}
      </span>
    </button>
  );
}
