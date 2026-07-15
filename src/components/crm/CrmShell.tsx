import Link from "next/link";
import type { ReactNode } from "react";
import "./crm-shell.css";

type CrmSidebarKey =
  | "dashboard"
  | "inbox"
  | "whatsapp"
  | "bookings"
  | "team"
  | "reports"
  | "settings"
  | "more";

const sidebarItems: Array<{
  key: CrmSidebarKey;
  icon: string;
  label: string;
  href: string;
  enabled: boolean;
}> = [
  { key: "dashboard", icon: "D", label: "Dashboard / 首頁", href: "/crm?tab=dashboard", enabled: true },
  { key: "inbox", icon: "I", label: "Inbox / 工作台", href: "/crm?tab=leads", enabled: true },
  { key: "whatsapp", icon: "W", label: "WhatsApp / 對話", href: "/crm/whatsapp", enabled: true },
  { key: "bookings", icon: "B", label: "Bookings / 預約", href: "/crm?tab=bookings", enabled: true },
  { key: "team", icon: "T", label: "Team / 團隊", href: "/crm", enabled: false },
  { key: "reports", icon: "R", label: "Reports / 報表", href: "/crm?tab=reports", enabled: true },
  { key: "settings", icon: "S", label: "Settings / 設定", href: "/crm/settings", enabled: true },
  { key: "more", icon: "+", label: "More / 更多", href: "/crm", enabled: false },
];

export function CrmShell({
  children,
  active = "inbox",
}: {
  children: ReactNode;
  active?: CrmSidebarKey;
}) {
  return (
    <main className="crm-shell min-h-screen bg-[#f6f7fb] text-[#1f2933]">
      <div className="flex min-h-screen">
        <aside className="hidden w-[218px] shrink-0 border-r border-[#e5e7eb] bg-white text-[#111827] lg:flex lg:flex-col">
          <div className="border-b border-[#eef2f6] px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8b5cf6]">
              LeadOps
            </p>
            <h1 className="mt-1 text-[15px] font-black">CRM</h1>
          </div>
          <nav className="flex-1 space-y-0.5 px-2.5 py-3">
            {sidebarItems.map((item) =>
              item.enabled ? (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`flex h-8 items-center gap-2 rounded-lg px-2.5 text-[12px] font-bold transition ${
                    item.key === active
                      ? "bg-[#eef2ff] text-[#4338ca]"
                      : "text-[#475569] hover:bg-[#f8fafc] hover:text-[#111827]"
                  }`}
                >
                  <SidebarIcon active={item.key === active}>{item.icon}</SidebarIcon>
                  <span className="truncate">{item.label}</span>
                </Link>
              ) : (
                <span
                  key={item.key}
                  className="flex h-8 cursor-not-allowed items-center gap-2 rounded-lg px-2.5 text-[12px] font-bold text-[#94a3b8]"
                >
                  <SidebarIcon>{item.icon}</SidebarIcon>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <span className="text-[9px] uppercase tracking-[0.12em] text-[#cbd5e1]">
                    Soon
                  </span>
                </span>
              )
            )}
          </nav>
          <div className="border-t border-[#eef2f6] px-2.5 py-2">
            <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-[#475569]">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="truncate">Online status / 上線狀態</span>
            </div>
            <p className="px-2.5 pb-1 text-[10px] font-semibold leading-4 text-[#94a3b8]">
              WhatsApp Cloud API workspace ready after connection setup.
            </p>
            <Link
              href="/dashboard"
              className="mt-1 block rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-[#64748b] transition hover:bg-[#f8fafc] hover:text-[#111827]"
            >
              Back to LaunchHub
            </Link>
          </div>
        </aside>

        <aside className="flex w-[60px] shrink-0 flex-col items-center border-r border-[#e5e7eb] bg-white py-3 text-[#111827] lg:hidden">
          <Link
            href="/crm?tab=dashboard"
            className="grid h-9 w-9 place-items-center rounded-lg bg-[#eef2ff] text-[12px] font-black text-[#4338ca]"
            title="CRM Dashboard"
          >
            C
          </Link>
          <div className="mt-4 grid gap-2">
            {[
              { label: "首", href: "/crm?tab=dashboard", key: "dashboard", title: "Dashboard / 首頁" },
              { label: "工", href: "/crm?tab=leads", key: "inbox", title: "Inbox / 工作台" },
              { label: "W", href: "/crm/whatsapp", key: "whatsapp", title: "WhatsApp / 對話" },
              { label: "約", href: "/crm?tab=bookings", key: "bookings", title: "Bookings / 預約" },
              { label: "報", href: "/crm?tab=reports", key: "reports", title: "Reports / 報表" },
              { label: "設", href: "/crm/settings", key: "settings", title: "Settings / 設定" },
            ].map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={`grid h-8 w-8 place-items-center rounded-lg text-[10px] font-black ${
                  item.key === active
                    ? "bg-[#eef2ff] text-[#4338ca]"
                    : "text-[#94a3b8] hover:bg-[#f8fafc]"
                }`}
                title={item.title}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </aside>

        <section className="min-w-0 flex-1">{children}</section>
      </div>
    </main>
  );
}

function SidebarIcon({
  children,
  active = false,
}: {
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <span
      className={`grid h-5 w-5 shrink-0 place-items-center rounded-md text-[10px] font-black ${
        active ? "bg-white text-[#4338ca]" : "bg-[#f1f5f9] text-[#64748b]"
      }`}
    >
      {children}
    </span>
  );
}
