import Link from "next/link";

const navItems = [
  { href: "/dashboard", label: "總覽" },
  { href: "/leads", label: "Leads" },
  { href: "/performance", label: "成效分析" },
  { href: "/forms", label: "表格管理" },
  { href: "/landing-pages", label: "Landing Pages" },
  { href: "/embed-preview", label: "嵌入預覽" },
  { href: "/system-audit", label: "系統稽核" },
];

export function AppNav() {
  return (
    <header className="border-b border-[#ead9cf] bg-[#fff9f3]/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[#5a2348] text-sm font-bold text-white">
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
              className="rounded-full border border-[#ead9cf] bg-white/70 px-4 py-2 text-sm font-semibold text-[#5a2348] transition hover:border-[#c9828e]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
