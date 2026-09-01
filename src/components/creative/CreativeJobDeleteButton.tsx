"use client";

import { Trash2 } from "lucide-react";
import { deleteCreativeJobAction } from "@/app/creative-jobs/actions";
import { ConfirmSubmitButton } from "@/components/alyssa/ConfirmSubmitButton";

export function CreativeJobDeleteButton({
  jobId,
  title,
  compact = false,
  fullWidth = false,
  fixtureMode = false,
}: {
  jobId: string;
  title: string;
  compact?: boolean;
  fullWidth?: boolean;
  fixtureMode?: boolean;
}) {
  const accessibleLabel = compact ? `刪除 ${title}` : "刪除 Job";
  const buttonClass = compact
    ? "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[#e5c5c8] bg-white px-2.5 text-[10px] font-black text-[#a43b50] transition hover:border-[#cf969d] hover:bg-[#fff5f5] xl:w-8 xl:px-0"
    : `inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[#e5c5c8] bg-white px-3 text-xs font-black text-[#a43b50] transition hover:border-[#cf969d] hover:bg-[#fff5f5] ${fullWidth ? "w-full" : ""}`;

  return (
    <form
      action={fixtureMode ? undefined : deleteCreativeJobAction}
      onSubmit={fixtureMode ? (event) => event.preventDefault() : undefined}
      className={fullWidth ? "w-full" : ""}
    >
      <input type="hidden" name="jobId" value={jobId} />
      <ConfirmSubmitButton
        className={buttonClass}
        pendingLabel="刪除中…"
        confirmMessage={`確定刪除「${title}」？工作會從 Job List 移除；Audit 紀錄仍然保留。`}
        aria-label={accessibleLabel}
        title="刪除 Job"
      >
        <Trash2 size={13} />
        <span className={compact ? "xl:sr-only" : ""}>刪除 Job</span>
      </ConfirmSubmitButton>
    </form>
  );
}
