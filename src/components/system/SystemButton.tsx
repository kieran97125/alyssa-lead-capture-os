"use client";

import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SystemButtonDensity = "compact" | "default" | "comfortable";

type SystemButtonProps = ComponentProps<typeof Button> & {
  density?: SystemButtonDensity;
};

const densityClasses: Record<SystemButtonDensity, string> = {
  compact: "h-8 gap-1.5 rounded-[var(--radius-control)] px-3 text-xs",
  default: "h-10 gap-2 rounded-[var(--radius-control)] px-4 text-sm",
  comfortable: "h-11 gap-2 rounded-[var(--radius-control)] px-5 text-sm",
};

export function SystemButton({
  density = "default",
  className,
  ...props
}: SystemButtonProps) {
  const resolvedDensity: SystemButtonDensity =
    density === "compact" || density === "comfortable" ? density : "default";

  return (
    <Button
      data-slot="system-button"
      className={cn(densityClasses[resolvedDensity], className)}
      {...props}
    />
  );
}
