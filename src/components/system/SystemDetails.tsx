import type { ReactNode } from "react";
import { ChevronRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";

/** Native disclosure: keyboard accessible without hydration or another data read. */
export function SystemDetails({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details
      data-slot="system-details"
      className={cn("group rounded-[var(--radius-control)] border border-system-border bg-system-card text-system-foreground", className)}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-[var(--radius-control)] px-4 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-system-ring [&::-webkit-details-marker]:hidden">
        <Info size={16} aria-hidden="true" className="shrink-0 text-system-muted-foreground" />
        <span className="min-w-0 flex-1">{title}</span>
        <ChevronRight size={16} aria-hidden="true" className="shrink-0 group-open:rotate-90" />
      </summary>
      <div className="border-t border-system-border px-4 py-3 text-sm leading-6">
        {children}
      </div>
    </details>
  );
}

export function SystemDataStatus({
  warnings,
  collapsibleWarnings = [],
  className,
}: {
  warnings: string[];
  /** Only caller-identified repetitive diagnostics may be collapsed. */
  collapsibleWarnings?: string[];
  className?: string;
}) {
  const uniqueWarnings = [...new Set(warnings.filter(Boolean))];
  if (uniqueWarnings.length === 0) return null;
  const collapsible = new Set(collapsibleWarnings);
  const diagnostics = uniqueWarnings.filter((warning) => collapsible.has(warning));
  const prominent = uniqueWarnings.filter((warning) => !collapsible.has(warning));
  return (
    <div className={className}>
      {prominent.map((warning) => <p key={warning} className="command-status-message">{warning}</p>)}
      {diagnostics.length > 0 ? <SystemDetails title={`資料狀態 · ${diagnostics.length} 項待核對`}>
      <ul className="list-disc space-y-1 pl-5">
        {diagnostics.map((warning) => <li key={warning}>{warning}</li>)}
      </ul>
      </SystemDetails> : null}
    </div>
  );
}
