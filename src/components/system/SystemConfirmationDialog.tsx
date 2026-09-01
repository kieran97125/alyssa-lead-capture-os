"use client";

import type { ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { AlertTriangle, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TriggerVariant =
  | "default"
  | "outline"
  | "secondary"
  | "ghost"
  | "destructive"
  | "link";

type TriggerSize =
  | "default"
  | "xs"
  | "sm"
  | "lg"
  | "icon"
  | "icon-xs"
  | "icon-sm"
  | "icon-lg";

type SystemConfirmationDialogProps = {
  triggerLabel: string;
  triggerIcon?: ReactNode;
  triggerVariant?: TriggerVariant;
  triggerSize?: TriggerSize;
  triggerClassName?: string;
  triggerAriaLabel?: string;
  triggerTitle?: string;
  triggerTestId?: string;
  iconOnly?: boolean;
  title: string;
  description: ReactNode;
  confirmControl: ReactNode;
  cancelLabel?: string;
  defaultOpen?: boolean;
  popupTestId?: string;
};

export function SystemConfirmationDialog({
  triggerLabel,
  triggerIcon,
  triggerVariant = "outline",
  triggerSize = "lg",
  triggerClassName,
  triggerAriaLabel,
  triggerTitle,
  triggerTestId,
  iconOnly = false,
  title,
  description,
  confirmControl,
  cancelLabel = "取消",
  defaultOpen = false,
  popupTestId,
}: SystemConfirmationDialogProps) {
  return (
    <Dialog.Root defaultOpen={defaultOpen}>
      <Dialog.Trigger
        data-testid={triggerTestId}
        aria-label={triggerAriaLabel}
        title={triggerTitle}
        className={cn(
          buttonVariants({
            variant: triggerVariant,
            size: triggerSize,
          }),
          "rounded-[var(--radius-control)]",
          triggerClassName
        )}
      >
        {triggerIcon}
        {iconOnly ? (
          <span className="sr-only">{triggerLabel}</span>
        ) : (
          triggerLabel
        )}
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[90] bg-system-foreground/45 backdrop-blur-sm transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup
          data-testid={popupTestId}
          className="fixed left-1/2 top-1/2 z-[100] w-[min(31rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[var(--radius-panel)] border border-system-border bg-system-card text-system-card-foreground shadow-[var(--shadow-overlay)] outline-none transition data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0"
        >
          <div className="flex items-start gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
            <span className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-control)] bg-system-destructive/10 text-system-destructive">
              <AlertTriangle size={18} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-lg font-black tracking-[-0.025em]">
                {title}
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-sm font-semibold leading-6 text-system-muted-foreground">
                {description}
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="關閉確認視窗"
              title="關閉"
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "shrink-0 rounded-[var(--radius-control)]"
              )}
            >
              <X size={17} aria-hidden="true" />
            </Dialog.Close>
          </div>

          <div className="mt-5 flex flex-col-reverse gap-2 border-t border-system-border bg-system-muted/50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <Dialog.Close
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "rounded-[var(--radius-control)]"
              )}
            >
              {cancelLabel}
            </Dialog.Close>
            {confirmControl}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
