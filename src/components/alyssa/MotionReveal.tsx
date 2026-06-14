"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

export function MotionReveal({
  children,
  delay = 0,
  className = "",
  once = true,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  once?: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className={`min-w-0 overflow-visible ${className}`}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 24, scale: 0.98 }}
      whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
      viewport={{ once, amount: 0.16, margin: "-40px" }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

export function MotionAnchor({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.a
      href={href}
      className={className}
      whileHover={prefersReducedMotion ? undefined : { y: -4, scale: 1.015 }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.a>
  );
}
