"use client";
import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import { SystemButton } from "@/components/system/SystemButton";
import type { ComponentProps } from "react";
export function SystemSubmitButton({ children, pendingLabel = "處理中…", disabled, ...props }: ComponentProps<typeof SystemButton> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return <SystemButton {...props} type="submit" disabled={disabled || pending} aria-busy={pending}>
    {pending && <LoaderCircle size={15} aria-hidden="true" className="animate-spin motion-reduce:animate-none"/>}{pending ? pendingLabel : children}
  </SystemButton>;
}
