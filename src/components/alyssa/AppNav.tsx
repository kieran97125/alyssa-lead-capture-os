import Link from "next/link";
import { canAccessModule, type InternalModule } from "@/lib/security/internalAccess";
import { getCurrentInternalAccess } from "@/lib/security/internalAccessServer";

const navItems = [
  { href: "/dashboard", label: "Dashboard", module: "dashboard" },
  { href: "/leads", label: "Leads", module: "leads" },
  { href: "/performance", label: "成效", module: "performance" },
  { href: "/campaigns/new", label: "建立 Campaign", module: "campaigns" },
  { href: "/forms", label: "表格", module: "forms" },
  { href: "/landing-pages", label: "Landing Pages", module: "landing_pages" },
  { href: "/settings", label: "設定", module: "settings" },
  { href: "/system-audit", label: "系統稽核", module: "system_audit" },
] satisfies Array<{ href: string; label: string; module: InternalModule }>;

export async function AppNav() {
  const access = await getCurrentInternalAccess();
  const visibleItems = navItems.filter((item) =>
    canAccessModule(access.role, item.module)
  );

  return (
    <header className="sticky top-0 z-40 border-b border-[#ead9cf]/80 bg-[#fff9f3]/88 shadow-[0_10px_35px_rgba(90,35,72,0.06)] backdrop-blur supports-[backdrop-filter]:bg-[#fff9f3]/76">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#5a2348] text-sm font-bold text-white shadow-[0_12px_30px_rgba(90,35,72,0.2)]">
            L
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold uppercase tracking-[0.18em] text-[#9a5d76]">
              LaunchHub
            </span>
            <span className="block text-xl font-bold text-[#321428]">
              Campaign Launch OS
            </span>
          </span>
        </Link>
        <nav className="flex min-w-0 flex-wrap gap-2">
          {visibleItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="alyssa-focus rounded-full border border-[#ead9cf] bg-white/78 px-4 py-2 text-sm font-semibold text-[#5a2348] shadow-sm transition hover:border-[#c9828e] hover:bg-white hover:shadow-[0_10px_24px_rgba(90,35,72,0.08)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
