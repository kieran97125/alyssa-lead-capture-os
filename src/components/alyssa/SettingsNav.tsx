import Link from "next/link";

const settingsItems = [
  { href: "/settings", label: "設定中心" },
  { href: "/settings/brands", label: "品牌資料" },
  { href: "/settings/treatments", label: "療程資料" },
  { href: "/settings/packages", label: "套餐價錢" },
  { href: "/settings/branches", label: "分店資料" },
  { href: "/settings/templates", label: "Landing Page 版型" },
  { href: "/settings/team", label: "團隊權限" },
];

export function SettingsNav() {
  return (
    <nav className="mt-5 flex min-w-0 flex-wrap gap-2">
      {settingsItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="min-w-0 rounded-full border border-[#ead9cf] bg-white/78 px-4 py-2 text-sm font-bold text-[#5a2348] shadow-sm transition hover:border-[#c9828e] hover:bg-white"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
