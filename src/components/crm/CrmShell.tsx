import type { ReactNode } from "react";
import { IntentPrefetchLink } from "@/components/alyssa/IntentPrefetchLink";
import "./crm-shell.css";

type CrmSidebarKey =
  | "dashboard"
  | "inbox"
  | "whatsapp"
  | "broadcasts"
  | "bookings"
  | "operations"
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
  { key: "inbox", icon: "C", label: "Conversations / 對話", href: "/crm?tab=leads", enabled: true },
  { key: "broadcasts", icon: "W", label: "WhatsApp Broadcast / 批量發送", href: "/crm/whatsapp-broadcasts", enabled: true },
  { key: "bookings", icon: "B", label: "Bookings / 預約", href: "/crm?tab=bookings", enabled: true },
  { key: "operations", icon: "O", label: "Operations / 營運", href: "/crm/operations", enabled: true },
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
    <main className="crm-shell min-h-screen bg-[var(--command-page)] text-[var(--command-navy)]">
      <div className="flex min-h-screen">
        <aside className="hidden w-[218px] shrink-0 border-r border-[var(--command-border)] bg-white text-[var(--command-navy)] lg:flex lg:flex-col">
          <div className="border-b border-[var(--command-border)] px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--command-accent-strong)]">Alyssa LeadOps</p>
            <h1 className="mt-1 text-[15px] font-black">CRM</h1>
          </div>
          <nav className="flex-1 space-y-0.5 px-2.5 py-3">
            {sidebarItems.map((item) =>
              item.enabled ? (
                <IntentPrefetchLink
                  key={item.key}
                  href={item.href}
                  className={`flex h-8 items-center gap-2 rounded-lg px-2.5 text-[12px] font-bold transition ${
                    item.key === active
                      ? "bg-[var(--command-primary-soft)] text-[var(--command-primary)]"
                      : "text-[var(--command-muted)] hover:bg-[var(--command-blush)] hover:text-[var(--command-navy)]"
                  }`}
                >
                  <SidebarIcon active={item.key === active}>{item.icon}</SidebarIcon>
                  <span className="truncate">{item.label}</span>
                </IntentPrefetchLink>
              ) : (
                <span key={item.key} className="flex h-8 cursor-not-allowed items-center gap-2 rounded-lg px-2.5 text-[12px] font-bold text-[var(--command-disabled)]">
                  <SidebarIcon>{item.icon}</SidebarIcon>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <span className="text-[9px] uppercase tracking-[0.12em] text-[var(--command-disabled)]">Soon</span>
                </span>
              )
            )}
          </nav>
          <div className="border-t border-[var(--command-border)] px-2.5 py-2">
            <IntentPrefetchLink href="/crm/settings/whatsapp" className="block rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-[var(--command-muted)] transition hover:bg-[var(--command-blush)] hover:text-[var(--command-navy)]">
              WhatsApp 連接設定
            </IntentPrefetchLink>
            <IntentPrefetchLink href="/dashboard" className="block rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-[var(--command-muted)] transition hover:bg-[var(--command-blush)] hover:text-[var(--command-navy)]">返回 Command Center</IntentPrefetchLink>
          </div>
        </aside>

        <aside className="flex w-[52px] shrink-0 flex-col items-center border-r border-[var(--command-border)] bg-white py-3 text-[var(--command-navy)] lg:hidden">
          <IntentPrefetchLink href="/crm?tab=dashboard" className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--command-primary-soft)] text-[11px] font-black text-[var(--command-primary)]" title="CRM Dashboard">C</IntentPrefetchLink>
          <div className="mt-4 grid gap-2">
            {[
              { label: "首", href: "/crm?tab=dashboard", key: "dashboard", title: "Dashboard / 首頁" },
              { label: "聊", href: "/crm?tab=leads", key: "inbox", title: "Conversations / 對話" },
              { label: "發", href: "/crm/whatsapp-broadcasts", key: "broadcasts", title: "WhatsApp Broadcast / 批量發送" },
              { label: "約", href: "/crm?tab=bookings", key: "bookings", title: "Bookings / 預約" },
              { label: "營", href: "/crm/operations", key: "operations", title: "Operations / 營運" },
              { label: "報", href: "/crm?tab=reports", key: "reports", title: "Reports / 報表" },
              { label: "設", href: "/crm/settings", key: "settings", title: "Settings / 設定" },
            ].map((item) => (
              <IntentPrefetchLink
                key={item.key}
                href={item.href}
                className={`grid h-8 w-8 place-items-center rounded-lg text-[10px] font-black ${
                  item.key === active
                    ? "bg-[var(--command-primary-soft)] text-[var(--command-primary)]"
                    : "text-[var(--command-disabled)] hover:bg-[var(--command-blush)]"
                }`}
                title={item.title}
              >
                {item.label}
              </IntentPrefetchLink>
            ))}
          </div>
        </aside>

        <section className="min-w-0 flex-1">{children}</section>
      </div>
    </main>
  );
}

function SidebarIcon({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return (
    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md text-[10px] font-black ${active ? "bg-white text-[var(--command-primary)]" : "bg-[var(--command-blush)] text-[var(--command-muted)]"}`}>
      {children}
    </span>
  );
}
