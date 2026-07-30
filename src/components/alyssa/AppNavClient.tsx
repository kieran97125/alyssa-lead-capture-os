"use client";

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
  LogOut,
  MailCheck,
  Menu,
  MessageCircleMore,
  Rocket,
  Settings2,
  X,
} from "lucide-react";
import { IntentPrefetchLink } from "@/components/alyssa/IntentPrefetchLink";
import type { InternalAccessContext } from "@/lib/security/internalAccess";
import {
  hasWorkspaceModulePermission,
  normalizeWorkspaceRole,
  type WorkspaceModuleKey,
} from "@/lib/security/workspacePermissions";

type Icon = ComponentType<{ size?: number; strokeWidth?: number }>;

type NavigationItem = {
  href: string;
  label: string;
  icon: Icon;
  match?: string[];
  badge?: string;
  module: WorkspaceModuleKey;
  masterOnly?: boolean;
};

type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

const navigationGroups: NavigationGroup[] = [
  {
    label: "Command",
    items: [
      { href: "/dashboard", label: "主頁總覽", icon: Home, module: "dashboard" },
      { href: "/kpis", label: "品牌 KPI", icon: CircleGauge, module: "kpis" },
      { href: "/calendar", label: "營銷日曆", icon: CalendarDays, module: "calendar" },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        href: "/campaigns/new",
        label: "LaunchHub",
        icon: Rocket,
        module: "launchhub",
        match: [
          "/campaigns",
          "/create-campaign",
          "/forms",
          "/landing-pages",
          "/brands",
        ],
      },
      { href: "/leads", label: "Leads", icon: Inbox, module: "leads" },
      { href: "/crm", label: "CRM", icon: MessageCircleMore, module: "crm" },
      { href: "/performance", label: "療程成效", icon: BarChart3, module: "performance" },
    ],
  },
  {
    label: "Control",
    items: [
      {
        href: "/data-sources",
        label: "資料來源",
        icon: DatabaseZap,
        module: "data_sources",
        masterOnly: true,
      },
      {
        href: "/settings",
        label: "系統設定",
        icon: Settings2,
        module: "settings",
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
    <IntentPrefetchLink
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`command-nav-item ${active ? "is-active" : ""}`}
    >
      <IconComponent size={18} strokeWidth={active ? 2.4 : 1.9} />
      <span>{item.label}</span>
      {item.badge ? <span className="command-nav-badge">{item.badge}</span> : null}
      {active ? <ChevronRight className="ml-auto" size={15} /> : null}
    </IntentPrefetchLink>
  );
}

function SidebarContent({
  pathname,
  onNavigate,
  access,
}: {
  pathname: string;
  onNavigate: () => void;
  access: InternalAccessContext;
}) {
  const isMaster = access.accessLevel === "master";
  const isEmailMember = access.source === "supabase_auth";
  const accountName = isEmailMember
    ? access.fullName || access.workspaceRole || "Workspace member"
    : isMaster
      ? "Master 系統身份"
      : "Admin 系統身份";
  const accountDetail = isEmailMember
    ? access.email || "已驗證公司電郵"
    : "密碼權限 · 非 Google 帳戶";
  const avatarLabel = isEmailMember
    ? accountName.slice(0, 1).toUpperCase()
    : isMaster
      ? "M"
      : "A";
  const visibleNavigationGroups = navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.masterOnly && !isMaster) return false;
        if (!isEmailMember) return true;
        return hasWorkspaceModulePermission(
          {
            isMaster,
            workspaceRole: normalizeWorkspaceRole(access.workspaceRole),
            modulePermissions: access.modulePermissions ?? {},
          },
          item.module
        );
      }),
    }))
    .filter((group) => group.items.length > 0);
  const accountCard = (
    <>
      <span className="command-account-avatar">
        {avatarLabel}
      </span>
      <span className="min-w-0 flex-1">
        <span className="command-account-name">{accountName}</span>
        <span className="command-account-email">{accountDetail}</span>
      </span>
      {isEmailMember ? <MailCheck size={15} /> : <LockKeyhole size={15} />}
    </>
  );

  return (
    <>
      <div className="command-brand">
        <IntentPrefetchLink
          href="/dashboard"
          onClick={onNavigate}
          className="command-brand-link"
        >
          <span className="command-brand-mark" aria-hidden="true">
            GO
          </span>
          <span className="min-w-0">
            <span className="command-brand-eyebrow">Alyssa Growth OS</span>
            <span className="command-brand-title">Command Center</span>
          </span>
        </IntentPrefetchLink>
        <div className="command-workspace-pill">
          <span className="command-workspace-dot" />
          Enterprise workspace
        </div>
      </div>

      <nav aria-label="主要功能" className="command-navigation">
        {visibleNavigationGroups.map((group) => (
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
        <div className="command-account-row">
          {isMaster ? (
            <IntentPrefetchLink
              href="/settings/team"
              onClick={onNavigate}
              className="command-account-card"
              aria-label={`管理 ${accountName} 權限`}
            >
              {accountCard}
            </IntentPrefetchLink>
          ) : (
            <div className="command-account-card" aria-label={accountName}>
              {accountCard}
            </div>
          )}
          <a
            href="/logout"
            className="command-logout-button"
            aria-label="登出 Alyssa Growth OS"
            title="登出"
          >
            <LogOut size={16} />
            <span>登出</span>
          </a>
        </div>
      </div>
    </>
  );
}

export function AppNavClient({
  access,
}: {
  access: InternalAccessContext;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="command-mobile-bar">
        <IntentPrefetchLink href="/dashboard" className="command-mobile-brand">
          <span>GO</span>
          <strong>Command Center</strong>
        </IntentPrefetchLink>
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
        <SidebarContent
          pathname={pathname}
          onNavigate={() => setOpen(false)}
          access={access}
        />
      </aside>
    </>
  );
}
