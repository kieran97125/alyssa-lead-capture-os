"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ComponentType } from "react";
import {
  BarChart3,
  CalendarRange,
  CalendarDays,
  ChevronRight,
  CircleGauge,
  DatabaseZap,
  FileDown,
  FilePlus2,
  Home,
  Inbox,
  ListTodo,
  LockKeyhole,
  LogOut,
  MailCheck,
  Menu,
  MessageCircleMore,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  Table2,
  X,
  Orbit,
} from "lucide-react";
import { IntentPrefetchLink } from "@/components/alyssa/IntentPrefetchLink";
import type { InternalAccessContext } from "@/lib/security/internalAccess";
import {
  hasWorkspaceModulePermission,
  normalizeWorkspaceRole,
  type WorkspaceModuleKey,
} from "@/lib/security/workspacePermissions";
import styles from "./AppNavClient.module.css";

type Icon = ComponentType<{ size?: number; strokeWidth?: number }>;

type NavigationItem = {
  href: string;
  label: string;
  icon: Icon;
  match?: string[];
  badge?: string;
  module: WorkspaceModuleKey;
  masterOnly?: boolean;
  exact?: boolean;
  personalOnly?: boolean;
};

type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

const sidebarPreferenceKey = "alyssa-growth-os:sidebar-collapsed";
const sidebarPreferenceEvent = "alyssa-sidebar-preference";
let sidebarPreferenceFallback = false;

function readSidebarPreference() {
  try { return window.localStorage.getItem(sidebarPreferenceKey) === "1"; }
  catch { return sidebarPreferenceFallback; }
}

function subscribeSidebarPreference(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(sidebarPreferenceEvent, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(sidebarPreferenceEvent, listener);
  };
}

const navigationGroups: NavigationGroup[] = [
  {
    label: "總覽",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: Home, module: "dashboard" },
      { href: "/workbench", label: "我的工作星圖", icon: Orbit, module: "dashboard", personalOnly: true },
      { href: "/kpis", label: "品牌 KPI", icon: CircleGauge, module: "kpis" },
    ],
  },
  {
    label: "工作協作",
    items: [
      { href: "/calendar", label: "營銷日曆", icon: CalendarDays, module: "calendar" },
      { href: "/tasks", label: "工作事項", icon: ListTodo, module: "calendar" },
      { href: "/creative-jobs", label: "設計工作", icon: Palette, module: "creative_jobs" },
    ],
  },
  {
    label: "客戶營運",
    items: [
      { href: "/leads", label: "Leads", icon: Inbox, module: "leads" },
      { href: "/crm", label: "CRM", icon: MessageCircleMore, module: "crm" },
    ],
  },
  {
    label: "成效報表",
    items: [
      {
        href: "/performance",
        label: "療程成效",
        icon: BarChart3,
        module: "performance",
        exact: true,
      },
      {
        href: "/performance/daily",
        label: "每日總覽",
        icon: Table2,
        module: "performance",
      },
      {
        href: "/performance/compare",
        label: "同期對比",
        icon: CalendarRange,
        module: "performance",
      },
      {
        href: "/reports",
        label: "報告生成",
        icon: FileDown,
        module: "performance",
      },
    ],
  },
  {
    label: "建立與設定",
    items: [
      {
        href: "/campaigns",
        label: "表格及廣告頁",
        icon: FilePlus2,
        module: "launchhub",
        match: [
          "/campaigns",
          "/create-campaign",
          "/forms",
          "/landing-pages",
          "/brands",
        ],
      },
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
  if (item.exact) return pathname === item.href;
  const matches = item.match ?? [item.href];
  return matches.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

function NavItem({
  item,
  pathname,
  onNavigate,
  collapsed,
}: {
  item: NavigationItem;
  pathname: string;
  onNavigate: () => void;
  collapsed: boolean;
}) {
  const active = isActive(pathname, item);
  const IconComponent = item.icon;

  return (
    <IntentPrefetchLink
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={`command-nav-item ${active ? "is-active" : ""}`}
    >
      <IconComponent size={18} strokeWidth={active ? 2.4 : 1.9} />
      <span className="command-nav-label">{item.label}</span>
      {item.badge ? <span className="command-nav-badge">{item.badge}</span> : null}
      {active ? (
        <ChevronRight className="command-nav-chevron ml-auto" size={15} />
      ) : null}
    </IntentPrefetchLink>
  );
}

function SidebarContent({
  pathname,
  onNavigate,
  access,
  workNotificationCount,
  creativeNotificationCount,
  collapsed,
  workbenchEnabled,
}: {
  pathname: string;
  onNavigate: () => void;
  access: InternalAccessContext;
  workNotificationCount: number;
  creativeNotificationCount: number;
  collapsed: boolean;
  workbenchEnabled: boolean;
}) {
  const isMaster = access.accessLevel === "master";
  const isEmailMember = access.source === "supabase_auth";
  const accountName = isEmailMember
    ? access.fullName || access.workspaceRole || "團隊成員"
    : isMaster
      ? "客戶管理員"
      : "客戶管理員";
  const accountDetail = isEmailMember
    ? access.email || "已驗證公司電郵"
    : "客戶工作區登入";
  const avatarLabel = isEmailMember
    ? accountName.slice(0, 1).toUpperCase()
    : isMaster
      ? "M"
      : "A";
  const visibleNavigationGroups = navigationGroups
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => {
          if (item.personalOnly && !workbenchEnabled) return false;
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
        })
        .map((item) => {
          if (item.href === "/tasks" && workNotificationCount > 0) {
            return { ...item, badge: String(workNotificationCount) };
          }
          if (item.href === "/creative-jobs" && creativeNotificationCount > 0) {
            return { ...item, badge: String(creativeNotificationCount) };
          }
          return item;
        }),
    }))
    .filter((group) => group.items.length > 0);
  const accountCard = (
    <>
      <span className="command-account-avatar">{avatarLabel}</span>
      <span className="command-account-copy min-w-0 flex-1">
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
          aria-label={collapsed ? "Marketing OS 營運中心" : undefined}
          title={collapsed ? "Marketing OS 營運中心" : undefined}
        >
          <span className="command-brand-mark" aria-hidden="true">
            MO
          </span>
          <span className="command-brand-copy min-w-0">
            <span className="command-brand-eyebrow">Marketing OS</span>
            <span className="command-brand-title">{access.workspaceName || "客戶工作區"}</span>
          </span>
        </IntentPrefetchLink>
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
                  collapsed={collapsed}
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
              title={collapsed ? accountName : undefined}
            >
              {accountCard}
            </IntentPrefetchLink>
          ) : (
            <div
              className="command-account-card"
              aria-label={accountName}
              title={collapsed ? accountName : undefined}
            >
              {accountCard}
            </div>
          )}
          <a
            href="/logout"
            className="command-logout-button"
            aria-label="登出 Marketing OS"
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
  workNotificationCount = 0,
  creativeNotificationCount = 0,
  workbenchEnabled = false,
}: {
  access: InternalAccessContext;
  workNotificationCount?: number;
  creativeNotificationCount?: number;
  workbenchEnabled?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const collapsed = useSyncExternalStore(subscribeSidebarPreference, readSidebarPreference, () => false);

  useEffect(() => {
    document.documentElement.dataset.commandSidebar = collapsed
      ? "collapsed"
      : "expanded";
  }, [collapsed]);

  function toggleDesktopSidebar() {
    const next = !collapsed;
    sidebarPreferenceFallback = next;
    try { window.localStorage.setItem(sidebarPreferenceKey, next ? "1" : "0"); } catch { /* Keep the preference for this browser session. */ }
    window.dispatchEvent(new Event(sidebarPreferenceEvent));
  }

  return (
    <>
      <header className="command-mobile-bar">
        <IntentPrefetchLink href="/dashboard" className="command-mobile-brand">
          <span>GO</span>
          <strong>營運中心</strong>
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

      <aside
        className={`command-sidebar ${open ? "is-open" : ""}`}
        data-collapsed={collapsed ? "true" : "false"}
      >
        <button
          type="button"
          onClick={toggleDesktopSidebar}
          className={styles.collapseButton}
          aria-label={collapsed ? "展開主選單" : "縮小主選單"}
          aria-pressed={collapsed}
          title={collapsed ? "展開主選單" : "縮小主選單"}
        >
          {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
        <SidebarContent
          pathname={pathname}
          onNavigate={() => setOpen(false)}
          access={access}
          workNotificationCount={workNotificationCount}
          creativeNotificationCount={creativeNotificationCount}
          collapsed={collapsed}
          workbenchEnabled={workbenchEnabled}
        />
      </aside>
    </>
  );
}
