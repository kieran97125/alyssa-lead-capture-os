import Link from "next/link";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/brands", label: "Brand Workspace" },
  { href: "/campaigns/new", label: "Launch" },
  { href: "/landing-pages", label: "Landing Pages" },
  { href: "/forms", label: "Forms" },
  { href: "/leads", label: "Leads" },
  { href: "/crm", label: "CRM" },
  { href: "/performance", label: "Performance" },
  { href: "/settings#brand-library", label: "Brand Library" },
  { href: "/settings", label: "Settings" },
];

export async function AppNav() {
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
        <nav className="flex min-w-0 flex-wrap gap-2 md:justify-end">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`alyssa-focus rounded-full border px-4 py-2 text-sm font-semibold shadow-sm transition hover:shadow-[0_10px_24px_rgba(90,35,72,0.08)] ${
                item.href === "/campaigns/new"
                  ? "border-[#e46f64] bg-[#e46f64] text-white hover:border-[#d95f55] hover:bg-[#d95f55]"
                  : "border-[#ead9cf] bg-white/78 text-[#5a2348] hover:border-[#c9828e] hover:bg-white"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
