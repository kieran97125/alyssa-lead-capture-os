"use client";

import { Dialog } from "@base-ui/react/dialog";
import { History, RotateCcw, X } from "lucide-react";
import { ConfirmSubmitButton } from "@/components/alyssa/ConfirmSubmitButton";
import { SystemButton } from "@/components/system/SystemButton";
import { buttonVariants } from "@/components/ui/button";
import { restoreCreativeBriefVersionAction } from "@/app/creative-jobs/versionActions";
import { cn } from "@/lib/utils";
import type { CreativeBriefVersion } from "@/lib/creative/types";

function prettyDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

type CreativeBriefHistoryDialogProps = {
  jobId: string;
  returnPath: string;
  versions: CreativeBriefVersion[];
  canRestore: boolean;
  fixtureMode?: boolean;
};

export function CreativeBriefHistoryDialog({
  jobId,
  returnPath,
  versions,
  canRestore,
  fixtureMode = false,
}: CreativeBriefHistoryDialogProps) {
  return (
    <Dialog.Root>
      <Dialog.Trigger
        render={
          <SystemButton
            density="compact"
            variant="outline"
            data-testid="creative-brief-version-trigger"
          >
            <History size={14} aria-hidden="true" />
            版本
            <span className="rounded-full bg-system-muted px-1.5 py-0.5 text-[10px] font-black text-system-muted-foreground">
              {versions.length}
            </span>
          </SystemButton>
        }
      />
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[90] bg-system-foreground/35 backdrop-blur-[2px] transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup
          data-testid="creative-brief-version-dialog"
          className="fixed inset-y-0 right-0 z-[100] flex h-[100dvh] w-[min(410px,calc(100vw-0.75rem))] flex-col border-l border-system-border bg-system-card text-system-card-foreground shadow-[var(--shadow-overlay)] outline-none transition data-[ending-style]:translate-x-4 data-[ending-style]:opacity-0 data-[starting-style]:translate-x-4 data-[starting-style]:opacity-0"
        >
          <header className="flex items-start gap-3 border-b border-system-border px-5 py-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-control)] bg-system-secondary text-system-secondary-foreground">
              <History size={17} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-base font-black tracking-[-0.02em]">
                Brief 版本
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs font-semibold leading-5 text-system-muted-foreground">
                系統自動留底；恢復舊版本前，目前內容仍會先保留。
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="關閉版本紀錄"
              title="關閉"
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon-sm" }),
                "shrink-0 rounded-[var(--radius-control)]"
              )}
            >
              <X size={15} aria-hidden="true" />
            </Dialog.Close>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {versions.length ? (
              <div className="grid gap-2.5">
                {versions.map((version) => (
                  <article
                    key={version.id}
                    className="rounded-[var(--radius-card)] border border-system-border bg-system-background p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <strong className="block text-sm">
                          Version {version.versionNo}
                        </strong>
                        <small className="mt-0.5 block truncate text-[11px] font-semibold text-system-muted-foreground">
                          {prettyDateTime(version.createdAt)} · {version.createdByEmail || "系統"}
                        </small>
                      </div>
                      {canRestore ? (
                        <form
                          action={fixtureMode ? undefined : restoreCreativeBriefVersionAction}
                          onSubmit={fixtureMode ? (event) => event.preventDefault() : undefined}
                        >
                          <input type="hidden" name="jobId" value={jobId} />
                          <input type="hidden" name="versionId" value={version.id} />
                          <input type="hidden" name="returnPath" value={returnPath} />
                          <ConfirmSubmitButton
                            className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-control)] border border-system-border bg-system-card px-2.5 text-xs font-black text-system-primary"
                            pendingLabel="恢復中…"
                            confirmMessage={`確定恢復 Version ${version.versionNo}？目前版本仍會保留。`}
                          >
                            <RotateCcw size={13} aria-hidden="true" /> 恢復
                          </ConfirmSubmitButton>
                        </form>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-[var(--radius-card)] border border-dashed border-system-border bg-system-muted/40 p-6 text-center">
                <History className="mx-auto text-system-muted-foreground" size={22} />
                <p className="mt-2 text-xs font-semibold text-system-muted-foreground">
                  完成第一次自動儲存後會出現版本。
                </p>
              </div>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
