"use client";

import { RefreshCw } from "lucide-react";
import { useFormStatus } from "react-dom";

export function DashboardRefreshButton({
  disabled = false,
  idleLabel = "同步 CS Lead",
  pendingLabel = "同步 CS Lead 中…",
}: {
  disabled?: boolean;
  idleLabel?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;

  return (
    <button
      type="submit"
      className="command-primary-button command-refresh-button"
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={pending}
      data-pending={pending ? "true" : undefined}
    >
      <RefreshCw
        size={16}
        className={pending ? "command-refresh-icon is-spinning" : undefined}
      />
      <span aria-live="polite">
        {pending ? pendingLabel : idleLabel}
      </span>
    </button>
  );
}
