import Link from "next/link";
import type { ReactNode } from "react";

type CrmSidebarKey =
  | "home"
  | "inbox"
  | "bookings"
  | "team"
  | "dashboard"
  | "reports"
  | "settings"
  | "more";

const sidebarItems: Array<{
  key: CrmSidebarKey;
  label: string;
  href: string;
  enabled: boolean;
}> = [
  { key: "home", label: "Home / 首頁", href: "/crm", enabled: true },
  { key: "inbox", label: "Inbox / 工作台", href: "/crm", enabled: true },
  { key: "bookings", label: "Bookings / 預約", href: "/crm?tab=bookings", enabled: true },
  { key: "team", label: "Team / 團隊", href: "/crm", enabled: false },
  { key: "dashboard", label: "Dashboard / 營運總覽", href: "/crm", enabled: false },
  { key: "reports", label: "Reports / 報表", href: "/crm?tab=reports", enabled: true },
  { key: "settings", label: "Settings / 設定", href: "/crm/settings", enabled: true },
  { key: "more", label: "More / 更多", href: "/crm", enabled: false },
];

export function CrmShell({
  children,
  active = "inbox",
}: {
  children: ReactNode;
  active?: CrmSidebarKey;
}) {
  return (
    <main className="min-h-screen bg-[#f5f6f8] text-[#1f2933]">
      <div className="flex min-h-screen">
        <aside className="hidden w-[216px] shrink-0 border-r border-[#dfe4ea] bg-[#111827] text-white lg:flex lg:flex-col">
          <div className="border-b border-white/10 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9ca3af]">
              LeadOps
            </p>
            <h1 className="mt-1 text-base font-bold">CRM</h1>
          </div>
          <nav className="flex-1 space-y-1 px-2.5 py-3">
            {sidebarItems.map((item) =>
              item.enabled ? (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`flex h-9 items-center rounded-lg px-3 text-[13px] font-semibold transition ${
                    item.key === active
                      ? "bg-white text-[#111827]"
                      : "text-[#d1d5db] hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  key={item.key}
                  className="flex h-9 cursor-not-allowed items-center justify-between rounded-lg px-3 text-[13px] font-semibold text-[#6b7280]"
                >
                  {item.label}
                  <span className="text-[9px] uppercase tracking-[0.12em] text-[#4b5563]">
                    Soon
                  </span>
                </span>
              )
            )}
          </nav>
          <div className="border-t border-white/10 p-2.5">
            <div className="mb-2 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="text-[11px] font-bold text-emerald-100">
                  Online status / 上線狀態
                </span>
              </div>
              <p className="mt-1 text-[10px] font-semibold leading-4 text-[#9ca3af]">
                Manual WhatsApp only. No API sending.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="block rounded-lg px-3 py-2 text-[12px] font-semibold text-[#d1d5db] transition hover:bg-white/10 hover:text-white"
            >
              Back to LaunchHub
            </Link>
          </div>
        </aside>

        <aside className="flex w-[64px] shrink-0 flex-col items-center border-r border-[#dfe4ea] bg-[#111827] py-3 text-white lg:hidden">
          <Link
            href="/crm"
            className="grid h-9 w-9 place-items-center rounded-lg bg-white text-[12px] font-black text-[#111827]"
            title="CRM Inbox"
          >
            C
          </Link>
          <div className="mt-4 grid gap-2">
            {[
              { label: "首", href: "/crm", key: "home", title: "首頁" },
              { label: "工", href: "/crm", key: "inbox", title: "工作台" },
              { label: "約", href: "/crm?tab=bookings", key: "bookings", title: "預約" },
              { label: "報", href: "/crm?tab=reports", key: "reports", title: "報表" },
              { label: "設", href: "/crm/settings", key: "settings", title: "設定" },
            ].map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={`grid h-8 w-8 place-items-center rounded-lg text-[10px] font-bold ${
                  item.key === active ? "bg-white text-[#111827]" : "bg-white/8 text-[#9ca3af]"
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
