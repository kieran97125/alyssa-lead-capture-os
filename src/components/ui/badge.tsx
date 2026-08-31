import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-system-ring focus-visible:ring-[3px] focus-visible:ring-system-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-system-destructive aria-invalid:ring-system-destructive/20 dark:aria-invalid:ring-system-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default:
          "bg-system-primary text-system-primary-foreground [a]:hover:bg-system-primary/80",
        secondary:
          "bg-system-secondary text-system-secondary-foreground [a]:hover:bg-system-secondary/80",
        destructive:
          "bg-system-destructive/10 text-system-destructive focus-visible:ring-system-destructive/20 dark:bg-system-destructive/20 dark:focus-visible:ring-system-destructive/40 [a]:hover:bg-system-destructive/20",
        outline:
          "border-system-border text-system-foreground [a]:hover:bg-system-muted [a]:hover:text-system-muted-foreground",
        ghost:
          "hover:bg-system-muted hover:text-system-muted-foreground dark:hover:bg-system-muted/50",
        link: "text-system-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  });
}

export { Badge, badgeVariants };
