import Link from "next/link";
import { InternalProtectionBanner } from "@/components/alyssa/InternalProtectionBanner";
import {
  getCurrentAccessContext,
  getRoleLabel,
  getVisibleModulesForRole,
} from "@/lib/security/teamAccess";

const navItems = [
  { href: "/dashboard", label: "總覽" },
  { href: "/leads", label: "Leads" },
  { href: "/performance", label: "成效分析" },
  { href: "/forms", label: "表格管理" },
  { href: "/landing-pages", label: "Landing Pages" },
  { href: "/settings", label: "設定" },
  { href: "/embed-preview", label: "嵌入預覽" },
  { href: "/system-audit", label: "系統稽核" },
];

export function AppNav({
  showInternalWarning = false,
}: {
  showInternalWarning?: boolean;
}) {
  const accessContext = showInternalWarning ? getCurrentAccessContext() : null;
  const visibleModules = accessContext
    ? getVisibleModulesForRole(accessContext.role)
    : [];

  return (
    <>
      {showInternalWarning && <InternalProtectionBanner />}
      <header className="sticky top-0 z-40 border-b border-[#ead9cf] bg-[#fff9f3]/92 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#5a2348] text-sm font-bold text-white shadow-sm">
              A
            </span>
            <span>
              <span className="block text-sm font-semibold uppercase tracking-[0.18em] text-[#9a5d76]">
                Alyssa
              </span>
              <span className="block text-xl font-bold text-[#321428]">
                Alyssa Lead Capture OS
              </span>
            </span>
          </Link>
          <nav className="flex flex-wrap gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full border border-[#ead9cf] bg-white/78 px-4 py-2 text-sm font-semibold text-[#5a2348] shadow-sm transition hover:border-[#c9828e] hover:bg-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        {accessContext && (
          <div className="border-t border-[#ead9cf]/70 bg-white/54">
            <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-2 text-xs font-semibold text-[#7b5a6a] md:flex-row md:items-center md:justify-between">
              <span>
                Access mode: temporary internal access · Role:{" "}
                {getRoleLabel(accessContext.role)} · Brand access:{" "}
                {accessContext.brandAccess.scope === "all" ? "All brands" : "Limited brands"}
              </span>
              <span className="truncate">
                Visible modules: {visibleModules.map((module) => module.label).join(", ")}
              </span>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
