export type InternalRole = "owner" | "editor" | "lead_viewer";

export type InternalModule =
  | "dashboard"
  | "leads"
  | "performance"
  | "campaigns"
  | "forms"
  | "landing_pages"
  | "settings"
  | "brands"
  | "system_audit";

export type InternalAction =
  | "save_landing_page"
  | "publish_landing_page"
  | "create_campaign"
  | "edit_form"
  | "create_form"
  | "edit_settings"
  | "edit_brand_settings"
  | "view_system_audit";

export type InternalAccessContext = {
  username: string;
  role: InternalRole;
  source: "multi_basic_auth" | "legacy_basic_auth" | "local_dev_fallback";
};

type ConfiguredUser = {
  username: string;
  password: string;
  role: InternalRole;
  source: "multi_basic_auth" | "legacy_basic_auth";
};

type AccessResult =
  | { ok: true; context: InternalAccessContext }
  | {
      ok: false;
      reason: "not_configured" | "missing_header" | "invalid_header" | "invalid_credentials";
    };

export const noPermissionMessage = "你沒有權限查看這個內部頁面。";
export const blockedActionMessage = "你沒有權限執行這個操作。";
export const accessNotConfiguredMessage = "Internal access is not configured.";

const supportedRoles: InternalRole[] = ["owner", "editor", "lead_viewer"];

const moduleAccess: Record<InternalRole, InternalModule[]> = {
  owner: [
    "dashboard",
    "leads",
    "performance",
    "campaigns",
    "forms",
    "landing_pages",
    "settings",
    "brands",
    "system_audit",
  ],
  editor: [
    "dashboard",
    "leads",
    "performance",
    "campaigns",
    "forms",
    "landing_pages",
  ],
  lead_viewer: ["dashboard", "leads"],
};

const actionAccess: Record<InternalRole, InternalAction[]> = {
  owner: [
    "save_landing_page",
    "publish_landing_page",
    "create_campaign",
    "edit_form",
    "create_form",
    "edit_settings",
    "edit_brand_settings",
    "view_system_audit",
  ],
  editor: ["save_landing_page", "create_campaign", "edit_form", "create_form"],
  lead_viewer: [],
};

function isSupportedRole(value: string): value is InternalRole {
  return supportedRoles.includes(value as InternalRole);
}

function isProductionRuntime() {
  return process.env.NODE_ENV === "production";
}

function parseMultiAccessUsers(value: string | undefined): ConfiguredUser[] {
  if (!value?.trim()) return [];

  const parsedUsers = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry): ConfiguredUser | null => {
      const firstSeparator = entry.indexOf(":");
      const lastSeparator = entry.lastIndexOf(":");
      if (firstSeparator <= 0 || lastSeparator <= firstSeparator) return null;

      const username = entry.slice(0, firstSeparator).trim();
      const password = entry.slice(firstSeparator + 1, lastSeparator);
      const roleValue = entry.slice(lastSeparator + 1).trim();

      if (!username || !password || !isSupportedRole(roleValue)) return null;

      return {
        username,
        password,
        role: roleValue,
        source: "multi_basic_auth" as const,
      };
    })
    .filter((user): user is ConfiguredUser => Boolean(user));

  return parsedUsers;
}

export function getConfiguredInternalUsers(): ConfiguredUser[] {
  const multiUsers = parseMultiAccessUsers(process.env.INTERNAL_ACCESS_USERS);
  if (multiUsers.length > 0) return multiUsers;

  const legacyUser = process.env.INTERNAL_BASIC_AUTH_USER?.trim();
  const legacyPassword = process.env.INTERNAL_BASIC_AUTH_PASSWORD;

  if (legacyUser && legacyPassword) {
    return [
      {
        username: legacyUser,
        password: legacyPassword,
        role: "owner",
        source: "legacy_basic_auth",
      },
    ];
  }

  return [];
}

export function hasInternalAccessConfig() {
  return getConfiguredInternalUsers().length > 0;
}

function decodeBasicAuthHeader(header: string | null): { username: string; password: string } | null {
  if (!header?.startsWith("Basic ")) return null;

  try {
    const decoded = atob(header.slice("Basic ".length));
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex < 0) return null;

    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    };
  } catch {
    return null;
  }
}

export function authenticateInternalAccess(header: string | null): AccessResult {
  const users = getConfiguredInternalUsers();

  if (users.length === 0) {
    if (isProductionRuntime()) return { ok: false, reason: "not_configured" };

    return {
      ok: true,
      context: {
        username: "local-dev",
        role: "owner",
        source: "local_dev_fallback",
      },
    };
  }

  if (!header) return { ok: false, reason: "missing_header" };

  const credentials = decodeBasicAuthHeader(header);
  if (!credentials) return { ok: false, reason: "invalid_header" };

  const user = users.find(
    (item) =>
      item.username === credentials.username && item.password === credentials.password
  );

  if (!user) return { ok: false, reason: "invalid_credentials" };

  return {
    ok: true,
    context: {
      username: user.username,
      role: user.role,
      source: user.source,
    },
  };
}

export function canAccessModule(role: InternalRole, module: InternalModule) {
  return moduleAccess[role].includes(module);
}

export function canPerformAction(role: InternalRole, action: InternalAction) {
  return actionAccess[role].includes(action);
}

export function canViewLeadContactFields(role: InternalRole) {
  return role === "owner" || role === "editor" || role === "lead_viewer";
}

export function getVisibleModulesForRole(role: InternalRole) {
  return moduleAccess[role];
}

export function getRoleLabel(role: InternalRole) {
  if (role === "owner") return "Owner";
  if (role === "editor") return "Editor";
  return "Lead Viewer";
}
