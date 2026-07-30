import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { VerifiedSupabaseIdentity } from "@/lib/supabase/authProxy";
import type { InternalAccessContext } from "@/lib/security/internalAccess";
import {
  getWorkspaceModuleForPath,
  hasWorkspaceModulePermission,
  normalizeWorkspaceRole,
  workspaceModuleKeys,
  type WorkspaceModuleKey,
  type WorkspaceRole,
} from "@/lib/security/workspacePermissions";

export {
  getWorkspaceModuleForPath,
  workspaceModuleKeys,
  type WorkspaceModuleKey,
  type WorkspaceRole,
};

export type WorkspaceMemberAccess = InternalAccessContext & {
  source: "supabase_auth";
  memberId: string;
  email: string;
  workspaceRole: WorkspaceRole;
  brandIds: string[];
  modulePermissions: Record<string, boolean>;
  status: "invited" | "active" | "suspended" | "removed";
  isMaster: boolean;
};

export async function getWorkspaceMemberAccess(
  identity: VerifiedSupabaseIdentity,
  options: { activate?: boolean } = {}
): Promise<WorkspaceMemberAccess | null> {
  const supabase = createSupabaseAdminClient();
  const columns =
    "id,auth_user_id,email,full_name,workspace_role,status,is_master";

  let { data: member, error } = await supabase
    .from("workspace_members")
    .select(columns)
    .eq("auth_user_id", identity.userId)
    .maybeSingle();

  if (!member && !error) {
    const byEmail = await supabase
      .from("workspace_members")
      .select(columns)
      .ilike("email", identity.email)
      .maybeSingle();
    member = byEmail.data;
    error = byEmail.error;
  }

  if (error || !member) {
    if (error) {
      console.warn("workspace_member_identity_lookup_failed", {
        code: error.code,
        message: error.message,
      });
    }
    return null;
  }

  if (
    member.auth_user_id &&
    String(member.auth_user_id) !== identity.userId
  ) {
    return null;
  }
  if (String(member.email || "").trim().toLowerCase() !== identity.email) {
    return null;
  }

  const status = String(member.status || "invited") as WorkspaceMemberAccess["status"];
  if (status === "suspended" || status === "removed") return null;

  const memberId = String(member.id);
  const shouldActivate =
    options.activate === true &&
    (status === "invited" || !member.auth_user_id);

  if (shouldActivate) {
    const { error: activationError } = await supabase
      .from("workspace_members")
      .update({
        auth_user_id: identity.userId,
        status: "active",
        invite_accepted_at: new Date().toISOString(),
        last_sign_in_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", memberId);
    if (activationError) {
      console.warn("workspace_member_activation_failed", {
        code: activationError.code,
        message: activationError.message,
      });
      return null;
    }
  }

  const [brandResult, moduleResult] = await Promise.all([
    supabase
      .from("workspace_member_brand_access")
      .select("brand_id,status")
      .eq("member_id", memberId)
      .eq("status", "active"),
    supabase
      .from("workspace_member_module_permissions")
      .select("module_key,can_access")
      .eq("member_id", memberId),
  ]);

  if (brandResult.error || moduleResult.error) {
    console.warn("workspace_member_permissions_lookup_failed", {
      brandCode: brandResult.error?.code,
      moduleCode: moduleResult.error?.code,
    });
    return null;
  }

  const workspaceRole = normalizeWorkspaceRole(member.workspace_role);
  const isMaster = member.is_master === true || workspaceRole === "owner";
  const modulePermissions = Object.fromEntries(
    (moduleResult.data ?? []).map((row) => [
      String(row.module_key),
      row.can_access === true,
    ])
  );

  return {
    source: "supabase_auth",
    accessLevel: isMaster ? "master" : "admin",
    memberId,
    email: identity.email,
    fullName:
      typeof member.full_name === "string" ? member.full_name : null,
    workspaceRole,
    brandIds: (brandResult.data ?? []).map((row) => String(row.brand_id)),
    modulePermissions,
    status: shouldActivate ? "active" : status,
    isMaster,
  };
}

export function canAccessWorkspaceModule(
  access: WorkspaceMemberAccess,
  module: WorkspaceModuleKey
) {
  return hasWorkspaceModulePermission(access, module);
}
