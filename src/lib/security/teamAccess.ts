export type TeamRole =
  | "owner"
  | "admin"
  | "manager"
  | "marketer"
  | "cs"
  | "designer"
  | "viewer";

export type AccessModule =
  | "dashboard"
  | "leads"
  | "performance"
  | "forms"
  | "landing_pages"
  | "settings"
  | "system_audit"
  | "future_crm";

export type BrandAccessScope = "all" | "limited";

export type UserBrandAccess = {
  scope: BrandAccessScope;
  brandIds: string[];
};

export type CurrentAccessContext = {
  source: "temporary_internal_access" | "supabase_auth";
  role: TeamRole;
  brandAccess: UserBrandAccess;
};

export const accessModules: Array<{ key: AccessModule; label: string }> = [
  { key: "dashboard", label: "總覽" },
  { key: "leads", label: "Leads" },
  { key: "performance", label: "成效分析" },
  { key: "forms", label: "表格管理" },
  { key: "landing_pages", label: "Landing Pages" },
  { key: "settings", label: "設定" },
  { key: "system_audit", label: "系統稽核" },
  { key: "future_crm", label: "Future CRM" },
];

export const roleLabels: Record<TeamRole, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  marketer: "Marketer",
  cs: "CS",
  designer: "Designer",
  viewer: "Viewer",
};

export const roleAccess: Record<TeamRole, AccessModule[]> = {
  owner: [
    "dashboard",
    "leads",
    "performance",
    "forms",
    "landing_pages",
    "settings",
    "system_audit",
    "future_crm",
  ],
  admin: [
    "dashboard",
    "leads",
    "performance",
    "forms",
    "landing_pages",
    "settings",
    "system_audit",
    "future_crm",
  ],
  manager: [
    "dashboard",
    "leads",
    "performance",
    "forms",
    "landing_pages",
    "future_crm",
  ],
  marketer: ["dashboard", "leads", "performance", "forms", "landing_pages"],
  cs: ["dashboard", "leads", "future_crm"],
  designer: ["forms", "landing_pages"],
  viewer: ["dashboard", "performance"],
};

export const roleDescriptions: Record<TeamRole, string> = {
  owner: "最高權限，負責品牌、成員、設定、稽核同日後 CRM 權限。",
  admin: "日常系統管理，可管理 campaign、表格、設定同稽核。",
  manager: "營運管理層，可查看 leads、成效、campaign 同日後 CRM 跟進。",
  marketer: "市場投放角色，集中管理來源成效、表格同 landing pages。",
  cs: "客服跟進角色，日後主要進入 WhatsApp CRM 同 lead follow-up。",
  designer: "設計 / landing page 內容角色，集中處理表格同 campaign page 素材。",
  viewer: "只讀觀察角色，主要查看總覽同成效。",
};

export const teamRoles = Object.keys(roleAccess) as TeamRole[];

export const temporaryInternalAccessContext: CurrentAccessContext = {
  source: "temporary_internal_access",
  role: "owner",
  brandAccess: {
    scope: "all",
    brandIds: [],
  },
};

export function canAccessModule(role: TeamRole, module: AccessModule) {
  return roleAccess[role].includes(module);
}

export function canAccessBrand(userAccess: UserBrandAccess, brandId: string | null | undefined) {
  if (userAccess.scope === "all") return true;
  if (!brandId) return false;
  return userAccess.brandIds.includes(brandId);
}

export function getRoleLabel(role: TeamRole) {
  return roleLabels[role];
}

export function getModuleLabel(module: AccessModule) {
  return accessModules.find((item) => item.key === module)?.label ?? module;
}

export function getVisibleModulesForRole(role: TeamRole) {
  return roleAccess[role].map((module) => ({
    key: module,
    label: getModuleLabel(module),
  }));
}

export function getCurrentAccessContext() {
  return temporaryInternalAccessContext;
}

export function getAccessibleBrandIds(userAccess: UserBrandAccess, allBrandIds: string[]) {
  if (userAccess.scope === "all") return allBrandIds;
  return allBrandIds.filter((brandId) => canAccessBrand(userAccess, brandId));
}

export function shouldIncludeBrandScopedRecord(
  userAccess: UserBrandAccess,
  brandId: string | null | undefined
) {
  return canAccessBrand(userAccess, brandId);
}
