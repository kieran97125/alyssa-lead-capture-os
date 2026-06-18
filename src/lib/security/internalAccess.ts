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
  source:
    | "session"
    | "multi_basic_auth"
    | "legacy_basic_auth"
    | "local_dev_fallback"
    | "auth_disabled";
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
      reason:
        | "not_configured"
        | "missing_header"
        | "invalid_header"
        | "invalid_credentials";
    };

type SessionPayload = {
  username: string;
  role: InternalRole;
  issuedAt: number;
  expiresAt: number;
};

export const internalSessionCookieName = "launchhub_internal_session";
export const internalSessionMaxAgeSeconds = 60 * 60 * 12;
export const noPermissionMessage = "你沒有權限查看這個內部頁面。";
export const blockedActionMessage = "你沒有權限執行這個操作。";
export const accessNotConfiguredMessage = "Internal access is not configured.";
export const loginErrorMessage = "登入資料不正確，請重新輸入。";

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

export function isInternalAuthDisabled() {
  return process.env.INTERNAL_AUTH_DISABLED === "true";
}

export function getInternalAuthCookieDomain() {
  const value = process.env.INTERNAL_AUTH_COOKIE_DOMAIN?.trim();
  if (!value) return undefined;
  if (value.includes("://") || value.includes("/") || value.includes(":")) {
    return undefined;
  }
  return value;
}

function parseMultiAccessUsers(value: string | undefined): ConfiguredUser[] {
  if (!value?.trim()) return [];

  return value
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
        source: "multi_basic_auth",
      };
    })
    .filter((user): user is ConfiguredUser => Boolean(user));
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

export function hasInternalSessionConfig() {
  return Boolean(process.env.INTERNAL_AUTH_SESSION_SECRET?.trim());
}

function getSessionSecret() {
  const configuredSecret = process.env.INTERNAL_AUTH_SESSION_SECRET?.trim();
  if (configuredSecret) return configuredSecret;
  if (!isProductionRuntime()) return "launchhub-local-dev-session-secret";
  return null;
}

function decodeBasicAuthHeader(
  header: string | null
): { username: string; password: string } | null {
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

export function authenticateUsernamePassword(
  username: string,
  password: string
): AccessResult {
  const users = getConfiguredInternalUsers();

  if (users.length === 0) {
    if (isProductionRuntime()) return { ok: false, reason: "not_configured" };

    if (username === "local-dev" && password === "local-dev") {
      return {
        ok: true,
        context: {
          username: "local-dev",
          role: "owner",
          source: "local_dev_fallback",
        },
      };
    }

    return { ok: false, reason: "invalid_credentials" };
  }

  const user = users.find(
    (item) => item.username === username && item.password === password
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

  return authenticateUsernamePassword(credentials.username, credentials.password);
}

function base64UrlEncode(input: Uint8Array | string) {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`;
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function signValue(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value)
  );

  return base64UrlEncode(new Uint8Array(signature));
}

async function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;

  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return result === 0;
}

export async function createSignedInternalSession(
  context: InternalAccessContext
) {
  const secret = getSessionSecret();
  if (!secret) return null;

  const issuedAt = Date.now();
  const payload: SessionPayload = {
    username: context.username,
    role: context.role,
    issuedAt,
    expiresAt: issuedAt + internalSessionMaxAgeSeconds * 1000,
  };
  const payloadValue = base64UrlEncode(JSON.stringify(payload));
  const signature = await signValue(payloadValue, secret);

  return `${payloadValue}.${signature}`;
}

export async function verifySignedInternalSession(
  cookieValue: string | undefined | null
): Promise<InternalAccessContext | null> {
  const secret = getSessionSecret();
  if (!secret || !cookieValue) return null;

  const [payloadValue, signature] = cookieValue.split(".");
  if (!payloadValue || !signature) return null;

  const expectedSignature = await signValue(payloadValue, secret);
  if (!(await constantTimeEqual(signature, expectedSignature))) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(payloadValue)) as SessionPayload;
    if (!payload.username || !isSupportedRole(payload.role)) return null;
    if (!payload.expiresAt || payload.expiresAt <= Date.now()) return null;

    return {
      username: payload.username,
      role: payload.role,
      source: "session",
    };
  } catch {
    return null;
  }
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
