import Link from "next/link";

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

export function AppNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#ead9cf]/80 bg-[#fff9f3]/88 shadow-[0_10px_35px_rgba(90,35,72,0.06)] backdrop-blur supports-[backdrop-filter]:bg-[#fff9f3]/76">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#5a2348] text-sm font-bold text-white shadow-[0_12px_30px_rgba(90,35,72,0.2)]">
            A
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold uppercase tracking-[0.18em] text-[#9a5d76]">
              Alyssa
            </span>
            <span className="block text-xl font-bold text-[#321428]">
              Alyssa Lead Capture OS
            </span>
          </span>
        </Link>
        <nav className="flex min-w-0 flex-wrap gap-2">
          {navItems.map((item) => (
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
