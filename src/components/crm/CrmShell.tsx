import type { ReactNode } from "react";
import { IntentPrefetchLink } from "@/components/alyssa/IntentPrefetchLink";
import "./crm-shell.css";

type CrmSidebarKey =
  | "dashboard"
  | "inbox"
  | "whatsapp"
  | "bookings"
  | "operations"
  | "reports"
  | "settings";

const sidebarItems: Array<{
  key: CrmSidebarKey;
  icon: string;
  label: string;
  href: string;
}> = [
  { key: "dashboard", icon: "D", label: "首頁", href: "/crm?tab=dashboard" },
  { key: "inbox", icon: "C", label: "客戶對話", href: "/crm?tab=leads" },
  { key: "bookings", icon: "B", label: "預約", href: "/crm?tab=bookings" },
  { key: "operations", icon: "O", label: "營運", href: "/crm/operations" },
  { key: "reports", icon: "R", label: "報表", href: "/crm?tab=reports" },
  { key: "settings", icon: "S", label: "設定", href: "/crm/settings" },
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
            {sidebarItems.map((item) => (
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
            ))}
          </nav>
          <div className="border-t border-[var(--command-border)] px-2.5 py-2">
            <IntentPrefetchLink href="/crm/settings/whatsapp" className="block rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-[var(--command-muted)] transition hover:bg-[var(--command-blush)] hover:text-[var(--command-navy)]">
              WhatsApp 連接設定
            </IntentPrefetchLink>
            <IntentPrefetchLink href="/dashboard" className="block rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-[var(--command-muted)] transition hover:bg-[var(--command-blush)] hover:text-[var(--command-navy)]">返回營運中心</IntentPrefetchLink>
          </div>
        </aside>

        <aside className="flex w-[52px] shrink-0 flex-col items-center border-r border-[var(--command-border)] bg-white py-3 text-[var(--command-navy)] lg:hidden">
          <IntentPrefetchLink href="/crm?tab=dashboard" className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--command-primary-soft)] text-[11px] font-black text-[var(--command-primary)]" title="CRM Dashboard">C</IntentPrefetchLink>
          <div className="mt-4 grid gap-2">
            {[
              { label: "首", href: "/crm?tab=dashboard", key: "dashboard", title: "首頁" },
              { label: "聊", href: "/crm?tab=leads", key: "inbox", title: "客戶對話" },
              { label: "約", href: "/crm?tab=bookings", key: "bookings", title: "預約" },
              { label: "營", href: "/crm/operations", key: "operations", title: "營運" },
              { label: "報", href: "/crm?tab=reports", key: "reports", title: "報表" },
              { label: "設", href: "/crm/settings", key: "settings", title: "設定" },
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
