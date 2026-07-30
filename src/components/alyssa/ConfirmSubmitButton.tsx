"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function ConfirmSubmitButton({
  children,
  confirmMessage,
  pendingLabel,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "children"> & {
  children: ReactNode;
  confirmMessage: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      {...props}
      type="submit"
      className={`inline-flex items-center justify-center gap-2 ${props.className ?? ""}`}
      disabled={pending || props.disabled}
      aria-disabled={pending || props.disabled}
      onClick={(event) => {
        props.onClick?.(event);
        if (
          !event.defaultPrevented &&
          !window.confirm(confirmMessage)
        ) {
          event.preventDefault();
        }
      }}
    >
      {pending ? (
        <>
          <LoaderCircle
            size={13}
            className="animate-spin motion-reduce:animate-none"
          />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
