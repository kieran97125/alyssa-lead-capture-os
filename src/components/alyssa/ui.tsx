import Link from "next/link";
import type { ReactNode } from "react";

export function PageShell({ children }: { children: ReactNode }) {
  return <div className="alyssa-page-shell">{children}</div>;
}

export function PremiumCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`alyssa-premium-card min-w-0 p-5 ${className}`}>
      {children}
    </section>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div>
      {eyebrow && <p className="alyssa-kicker">{eyebrow}</p>}
      <h2 className="mt-2 text-2xl font-bold text-[#321428]">{title}</h2>
      {description && (
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
          {description}
        </p>
      )}
    </div>
  );
}

export function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="alyssa-premium-card min-w-0 p-4">
      <p className="alyssa-kicker">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[#321428]">{value}</p>
      {helper && <p className="mt-1 text-xs font-semibold text-[#7b5a6a]">{helper}</p>}
    </div>
  );
}

export function StatusBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded-full border border-[#ead9cf] bg-[#fff6f0] px-3 py-1 text-xs font-bold text-[#9a5d76]">
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  body,
}: {
  title: string;
  body?: string;
}) {
  return (
    <div className="rounded-[24px] border border-dashed border-[#d9b66f] bg-[#fff6f0] p-6 text-center">
      <h3 className="font-bold text-[#321428]">{title}</h3>
      {body && <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">{body}</p>}
    </div>
  );
}

export function CTAButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
}) {
  const classes =
    variant === "primary"
      ? "bg-[#e46f64] text-white shadow-[0_12px_30px_rgba(228,111,100,0.24)] hover:-translate-y-1 hover:bg-[#d95f55] hover:shadow-[0_18px_42px_rgba(228,111,100,0.34)] active:scale-[0.98]"
      : "border border-[#d9b66f] bg-white/78 text-[#5a2348] hover:-translate-y-1 hover:bg-white hover:shadow-[0_14px_32px_rgba(90,35,72,0.12)] active:scale-[0.98]";

  return (
    <Link
      href={href}
      className={`alyssa-focus inline-flex rounded-full px-5 py-3 text-sm font-bold transition duration-300 ${classes}`}
    >
      {children}
    </Link>
  );
}

export function SoftDivider() {
  return <div className="h-px w-full bg-[#ead9cf]" />;
}
