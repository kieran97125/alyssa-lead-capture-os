import type { InternalAccessContext } from "@/lib/security/internalAccess";
import {
  hasWorkspaceBrandPermission,
  normalizeWorkspaceRole,
  type WorkspaceRole,
} from "@/lib/security/workspacePermissions";

export type CreativeAccessSubject = {
  brandId: string;
  assigneeMemberId?: string | null;
};

export function getCreativeWorkspaceRole(
  access: InternalAccessContext
): WorkspaceRole {
  return normalizeWorkspaceRole(access.workspaceRole);
}

export function isCreativeOperationsRole(access: InternalAccessContext) {
  if (access.accessLevel === "master") return true;
  if (access.source !== "supabase_auth") return true;
  return ["owner", "admin", "manager", "marketer"].includes(
    getCreativeWorkspaceRole(access)
  );
}

export function isCreativeDesignerRole(access: InternalAccessContext) {
  return (
    access.source === "supabase_auth" &&
    getCreativeWorkspaceRole(access) === "designer"
  );
}

export function canAccessCreativeBrand(
  access: InternalAccessContext,
  brandId: string
) {
  if (access.source !== "supabase_auth") return true;
  return hasWorkspaceBrandPermission(
    {
      isMaster: access.accessLevel === "master",
      brandIds: access.brandIds ?? [],
    },
    brandId
  );
}

export function canViewCreativeJob(
  access: InternalAccessContext,
  job: CreativeAccessSubject
) {
  if (!canAccessCreativeBrand(access, job.brandId)) return false;
  if (access.accessLevel === "master" || access.source !== "supabase_auth") {
    return true;
  }
  const role = getCreativeWorkspaceRole(access);
  if (["owner", "admin", "manager", "marketer"].includes(role)) return true;
  if (role === "designer") {
    return Boolean(
      access.memberId && job.assigneeMemberId === access.memberId
    );
  }
  return false;
}

export function canEditCreativeJobMetadata(
  access: InternalAccessContext,
  job: CreativeAccessSubject
) {
  return isCreativeOperationsRole(access) && canAccessCreativeBrand(access, job.brandId);
}

export function canEditCreativeBrief(
  access: InternalAccessContext,
  job: CreativeAccessSubject
) {
  return canEditCreativeJobMetadata(access, job);
}

export function canUpdateCreativeJobStatus(
  access: InternalAccessContext,
  job: CreativeAccessSubject
) {
  if (!canViewCreativeJob(access, job)) return false;
  return (
    isCreativeOperationsRole(access) ||
    (isCreativeDesignerRole(access) &&
      Boolean(access.memberId && access.memberId === job.assigneeMemberId))
  );
}

export function canContributeCreativeAssets(
  access: InternalAccessContext,
  job: CreativeAccessSubject
) {
  return canUpdateCreativeJobStatus(access, job);
}

export function canManageCreativeTaxonomy(access: InternalAccessContext) {
  return access.accessLevel === "master";
}
