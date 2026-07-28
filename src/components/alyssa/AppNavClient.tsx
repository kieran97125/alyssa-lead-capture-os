"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ComponentType } from "react";
import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  CircleGauge,
  DatabaseZap,
  Home,
  Inbox,
  LockKeyhole,
  Menu,
  MessageCircleMore,
  Rocket,
  Settings2,
  X,
} from "lucide-react";
import { MASTER_ACCOUNT_EMAIL } from "@/lib/marketing/constants";

type Icon = ComponentType<{ size?: number; strokeWidth?: number }>;

type NavigationItem = {
  href: string;
  label: string;
  icon: Icon;
  match?: string[];
  badge?: string;
};

type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

const navigationGroups: NavigationGroup[] = [
  {
    label: "Command",
    items: [
      { href: "/dashboard", label: "主頁總覽", icon: Home },
      { href: "/kpis", label: "品牌 KPI", icon: CircleGauge },
      { href: "/calendar", label: "營銷日曆", icon: CalendarDays },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        href: "/campaigns/new",
        label: "LaunchHub",
        icon: Rocket,
        match: [
          "/campaigns",
          "/create-campaign",
          "/forms",
          "/landing-pages",
          "/brands",
        ],
      },
      { href: "/leads", label: "Leads", icon: Inbox },
      { href: "/crm", label: "CRM", icon: MessageCircleMore },
      { href: "/performance", label: "成效分析", icon: BarChart3 },
    ],
  },
  {
    label: "Control",
    items: [
      { href: "/data-sources", label: "資料來源", icon: DatabaseZap },
      {
        href: "/settings",
        label: "系統設定",
        icon: Settings2,
        match: ["/settings", "/system-audit"],
      },
    ],
  },
];

function isActive(pathname: string, item: NavigationItem) {
  const matches = item.match ?? [item.href];
  return matches.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

function NavItem({
  item,
  pathname,
  onNavigate,
}: {
  item: NavigationItem;
  pathname: string;
  onNavigate: () => void;
}) {
  const active = isActive(pathname, item);
  const IconComponent = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`command-nav-item ${active ? "is-active" : ""}`}
    >
      <IconComponent size={18} strokeWidth={active ? 2.4 : 1.9} />
      <span>{item.label}</span>
      {item.badge ? <span className="command-nav-badge">{item.badge}</span> : null}
      {active ? <ChevronRight className="ml-auto" size={15} /> : null}
    </Link>
  );
}

function SidebarContent({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <>
      <div className="command-brand">
        <Link href="/dashboard" onClick={onNavigate} className="command-brand-link">
          <span className="command-brand-mark" aria-hidden="true">
            GO
          </span>
          <span className="min-w-0">
            <span className="command-brand-eyebrow">Alyssa Growth OS</span>
            <span className="command-brand-title">Command Center</span>
          </span>
        </Link>
        <div className="command-workspace-pill">
          <span className="command-workspace-dot" />
          Enterprise workspace
        </div>
      </div>

      <nav aria-label="主要功能" className="command-navigation">
        {navigationGroups.map((group) => (
          <section key={group.label} className="command-nav-group">
            <p>{group.label}</p>
            <div>
              {group.items.map((item) => (
                <NavItem
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </section>
        ))}
      </nav>

      <div className="command-sidebar-footer">
        <Link
          href="/settings/team"
          onClick={onNavigate}
          className="command-account-card"
        >
          <span className="command-account-avatar">KK</span>
          <span className="min-w-0 flex-1">
            <span className="command-account-name">Kieran Kwok</span>
            <span className="command-account-email">{MASTER_ACCOUNT_EMAIL}</span>
          </span>
          <LockKeyhole size={15} />
        </Link>
      </div>
    </>
  );
}

export function AppNavClient() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="command-mobile-bar">
        <Link href="/dashboard" className="command-mobile-brand">
          <span>GO</span>
          <strong>Command Center</strong>
        </Link>
        <button
          type="button"
          aria-label={open ? "關閉主選單" : "開啟主選單"}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="command-menu-button"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {open ? (
        <button
          className="command-sidebar-backdrop"
          aria-label="關閉主選單"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside className={`command-sidebar ${open ? "is-open" : ""}`}>
        <SidebarContent pathname={pathname} onNavigate={() => setOpen(false)} />
      </aside>
    </>
  );
}
