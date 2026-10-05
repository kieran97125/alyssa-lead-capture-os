import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createAuthRequestDeadline } from "@/lib/supabase/requestDeadline";
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

export class WorkspaceAccessUnavailableError extends Error {
  readonly name = "WorkspaceAccessUnavailableError";
  constructor() { super("Workspace access verification is temporarily unavailable."); }
}

export async function getWorkspaceMemberAccess(
  identity: VerifiedSupabaseIdentity,
  options: { activate?: boolean } = {}
): Promise<WorkspaceMemberAccess | null> {
  const deadline = createAuthRequestDeadline();
  try {
    return await deadline.run(() => lookupWorkspaceMemberAccess(identity, options, deadline.signal));
  } catch {
    // Provider errors never mean "not invited" and must not enter an open or
    // shared-password fallback. Do not include identity/provider details.
    throw new WorkspaceAccessUnavailableError();
  }
}

async function lookupWorkspaceMemberAccess(
  identity: VerifiedSupabaseIdentity,
  options: { activate?: boolean },
  signal: AbortSignal,
): Promise<WorkspaceMemberAccess | null> {
  const supabase = createSupabaseAdminClient();
  const columns =
    "id,auth_user_id,email,full_name,workspace_role,status,is_master";

  let { data: member, error } = await supabase
    .from("workspace_members")
    .select(columns)
    .eq("auth_user_id", identity.userId)
    .abortSignal(signal)
    .retry(false)
    .maybeSingle();

  if (!member && !error) {
    const byEmail = await supabase
      .from("workspace_members")
      .select(columns)
      .ilike("email", identity.email)
      .abortSignal(signal)
      .retry(false)
      .maybeSingle();
    member = byEmail.data;
    error = byEmail.error;
  }

  if (error) throw new WorkspaceAccessUnavailableError();
  if (!member) return null;

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
  if (status !== "invited" && status !== "active") return null;

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
        invite_delivery_status: "accepted",
        invite_last_error_code: null,
        last_sign_in_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", memberId)
      .abortSignal(signal);
    if (activationError) {
      throw new WorkspaceAccessUnavailableError();
    }
  }

  const [brandResult, moduleResult] = await Promise.all([
    supabase
      .from("workspace_member_brand_access")
      .select("brand_id,status")
      .eq("member_id", memberId)
      .eq("status", "active")
      .abortSignal(signal)
      .retry(false),
    supabase
      .from("workspace_member_module_permissions")
      .select("module_key,can_access")
      .eq("member_id", memberId)
      .abortSignal(signal)
      .retry(false),
  ]);

  if (brandResult.error || moduleResult.error) {
    throw new WorkspaceAccessUnavailableError();
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
