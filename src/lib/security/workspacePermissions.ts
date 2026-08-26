export const workspaceModuleKeys = [
  "dashboard",
  "kpis",
  "calendar",
  "launchhub",
  "leads",
  "crm",
  "performance",
  "data_sources",
  "settings",
  "system_audit",
  "lead_audit",
] as const;

export type WorkspaceModuleKey = (typeof workspaceModuleKeys)[number];

export type WorkspaceRole =
  | "owner"
  | "admin"
  | "manager"
  | "marketer"
  | "cs"
  | "designer"
  | "viewer";

const roleDefaultModules: Record<WorkspaceRole, WorkspaceModuleKey[]> = {
  owner: [...workspaceModuleKeys],
  admin: [
    "dashboard",
    "kpis",
    "calendar",
    "launchhub",
    "leads",
    "crm",
    "performance",
    "settings",
    "system_audit",
  ],
  manager: [
    "dashboard",
    "kpis",
    "calendar",
    "launchhub",
    "leads",
    "crm",
    "performance",
  ],
  marketer: [
    "dashboard",
    "kpis",
    "calendar",
    "launchhub",
    "leads",
    "performance",
  ],
  cs: ["dashboard", "calendar", "leads", "crm"],
  designer: ["dashboard", "calendar", "launchhub"],
  viewer: ["dashboard", "kpis", "calendar", "performance"],
};

export function normalizeWorkspaceRole(value: unknown): WorkspaceRole {
  const role = String(value || "viewer") as WorkspaceRole;
  return role in roleDefaultModules ? role : "viewer";
}

export function getWorkspaceRoleDefaultModules(
  role: WorkspaceRole
): WorkspaceModuleKey[] {
  return [...roleDefaultModules[role]];
}

export function canManageMonthlyKpis(access: {
  source: string;
  accessLevel: "admin" | "master";
  workspaceRole?: string;
}) {
  if (access.accessLevel === "master") return true;
  if (access.source !== "supabase_auth") {
    return false;
  }
  const role = normalizeWorkspaceRole(access.workspaceRole);
  return role === "owner" || role === "admin" || role === "manager";
}

export function hasWorkspaceModulePermission(
  access: {
    isMaster: boolean;
    workspaceRole: WorkspaceRole;
    modulePermissions: Record<string, boolean>;
  },
  module: WorkspaceModuleKey
) {
  if (access.isMaster) return true;
  if (
    module === "kpis" &&
    (access.workspaceRole === "owner" ||
      access.workspaceRole === "admin" ||
      access.workspaceRole === "manager")
  ) {
    return true;
  }
  const explicitKeys = Object.keys(access.modulePermissions);
  if (explicitKeys.length > 0) {
    return access.modulePermissions[module] === true;
  }
  return roleDefaultModules[access.workspaceRole].includes(module);
}

export function hasWorkspaceBrandPermission(
  access: {
    isMaster: boolean;
    brandIds: string[];
  },
  brandId: string
) {
  return access.isMaster || access.brandIds.includes(brandId);
}

export function getWorkspaceModuleForPath(
  pathname: string
): WorkspaceModuleKey | null {
  if (pathname === "/" || pathname.startsWith("/dashboard")) return "dashboard";
  if (pathname.startsWith("/kpis")) return "kpis";
  if (pathname.startsWith("/calendar")) return "calendar";
  if (pathname.startsWith("/tasks")) return "calendar";
  if (pathname.startsWith("/data-sources")) return "data_sources";
  if (pathname.startsWith("/leads")) return "leads";
  if (pathname.startsWith("/lead-audit")) return "lead_audit";
  if (pathname.startsWith("/crm")) return "crm";
  if (pathname.startsWith("/performance")) return "performance";
  if (pathname.startsWith("/reports")) return "performance";
  if (pathname.startsWith("/api/internal/reports")) return "performance";
  if (pathname.startsWith("/settings/planning")) return "kpis";
  if (
    pathname.startsWith("/brands") ||
    pathname.startsWith("/campaigns") ||
    pathname.startsWith("/create-campaign") ||
    pathname.startsWith("/forms") ||
    pathname.startsWith("/landing-pages") ||
    pathname.startsWith("/embed-preview")
  ) {
    return "launchhub";
  }
  if (pathname.startsWith("/system-audit")) return "system_audit";
  if (pathname.startsWith("/settings")) return "settings";
  return null;
}
