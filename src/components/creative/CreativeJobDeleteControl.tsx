"use client";

import { Trash2 } from "lucide-react";
import { deleteCreativeJobAction } from "@/app/creative-jobs/actions";
import { SubmitButton } from "@/components/alyssa/SubmitButton";
import { SystemConfirmationDialog } from "@/components/system/SystemConfirmationDialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CreativeJobDeleteControlProps = {
  jobId: string;
  title: string;
  returnPath?: string;
  placement?: "list" | "header";
  fixtureMode?: boolean;
};

export function CreativeJobDeleteControl({
  jobId,
  title,
  returnPath = "/creative-jobs",
  placement = "header",
  fixtureMode = false,
}: CreativeJobDeleteControlProps) {
  const listPlacement = placement === "list";

  return (
    <SystemConfirmationDialog
      triggerLabel="刪除 Job"
      triggerIcon={<Trash2 size={listPlacement ? 12 : 15} aria-hidden="true" />}
      triggerVariant="destructive"
      triggerSize={listPlacement ? "icon-sm" : "lg"}
      triggerClassName={listPlacement ? "shadow-sm" : undefined}
      triggerAriaLabel={listPlacement ? `刪除 ${title}` : undefined}
      triggerTitle={listPlacement ? `刪除 ${title}` : undefined}
      triggerTestId={
        listPlacement
          ? "creative-job-list-delete-button"
          : "creative-job-delete-button"
      }
      iconOnly={listPlacement}
      title={`刪除「${title}」？`}
      description="呢張 Job 會即時由 Job List 移除，未來提醒會停止；系統 Audit 仍會保留操作記錄，方便追溯。"
      popupTestId="creative-job-delete-confirmation"
      confirmControl={
        <form
          action={fixtureMode ? undefined : deleteCreativeJobAction}
          onSubmit={
            fixtureMode ? (event) => event.preventDefault() : undefined
          }
        >
          <input type="hidden" name="jobId" value={jobId} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <SubmitButton
            className={cn(
              buttonVariants({ variant: "destructive", size: "lg" }),
              "min-w-32 rounded-[var(--radius-control)]"
            )}
            pendingLabel="刪除中…"
          >
            <Trash2 size={15} aria-hidden="true" />
            確認刪除
          </SubmitButton>
        </form>
      }
    />
  );
}
