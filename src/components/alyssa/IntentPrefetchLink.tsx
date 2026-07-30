"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useRef,
  type ComponentProps,
  type FocusEvent,
  type MouseEvent,
} from "react";

type IntentPrefetchLinkProps = Omit<
  ComponentProps<typeof Link>,
  "href" | "prefetch"
> & {
  href: string;
};

/**
 * Dynamic admin routes read live Supabase data, so eager viewport prefetching
 * can fan out into dozens of background requests. Keep navigation instant by
 * prefetching only after the user shows intent through hover or keyboard focus.
 */
export function IntentPrefetchLink({
  href,
  onFocus,
  onMouseEnter,
  ...props
}: IntentPrefetchLinkProps) {
  const router = useRouter();
  const prefetched = useRef(false);

  function prefetchOnIntent() {
    if (prefetched.current) return;
    prefetched.current = true;
    router.prefetch(href);
  }

  return (
    <Link
      {...props}
      href={href}
      prefetch={false}
      onFocus={(event: FocusEvent<HTMLAnchorElement>) => {
        onFocus?.(event);
        if (!event.defaultPrevented) prefetchOnIntent();
      }}
      onMouseEnter={(event: MouseEvent<HTMLAnchorElement>) => {
        onMouseEnter?.(event);
        if (!event.defaultPrevented) prefetchOnIntent();
      }}
    />
  );
}
