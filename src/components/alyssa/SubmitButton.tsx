"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type SubmitButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "type" | "children"
> & {
  children: ReactNode;
  pendingLabel: string;
};

export function SubmitButton({
  children,
  className,
  disabled,
  pendingLabel,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const unavailable = disabled || pending;

  return (
    <button
      {...props}
      type="submit"
      className={`inline-flex items-center justify-center gap-2 ${className ?? ""}`}
      disabled={unavailable}
      aria-disabled={unavailable}
      aria-busy={pending}
      aria-live="polite"
      data-pending={pending ? "true" : undefined}
    >
      {pending ? (
        <>
          <LoaderCircle
            size={15}
            className="animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
