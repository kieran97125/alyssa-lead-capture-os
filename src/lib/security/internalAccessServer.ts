import { cookies } from "next/headers";
import { cache } from "react";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";
import {
  adminSessionCookieName,
  adminSessionMaxAgeSeconds,
  createSignedAdminSession,
  isAdminPasswordGateEnabled,
  legacyInternalSessionCookieName,
  verifyAdminPassword,
  verifySignedAdminSession,
  type AdminAccessLevel,
  type InternalAccessContext,
  type InternalAction,
  type InternalModule,
} from "@/lib/security/internalAccess";
import {
  getSupabasePublicAuthConfig,
  isBreakGlassPasswordEnabled,
  isWorkspaceEmailAuthRequired,
} from "@/lib/supabase/authConfig";
import { createSupabaseServerAuthClient } from "@/lib/supabase/authServer";
import {
  canAccessWorkspaceModule,
  getWorkspaceMemberAccess,
  type WorkspaceMemberAccess,
  type WorkspaceModuleKey,
} from "@/lib/security/workspaceAuth";
import {
  canManageMonthlyKpis,
  hasWorkspaceBrandPermission,
} from "@/lib/security/workspacePermissions";

function openAccessContext(): InternalAccessContext {
  return {
    source: "development_not_configured",
    accessLevel: "master",
  };
}

export async function getCurrentInternalAccess(): Promise<InternalAccessContext> {
  const result = await verifyCurrentInternalAccess();
  if (result.ok) return result.access;

  if (!isAdminPasswordGateEnabled() && !isWorkspaceEmailAuthRequired()) {
    return openAccessContext();
  }

  return {
    source: "unauthenticated",
    accessLevel: "admin",
  };
}

async function verifyCurrentInternalAccessUncached(): Promise<
  | { ok: true; access: InternalAccessContext }
  | { ok: false; access: null }
> {
  const emailAccess = await getCurrentWorkspaceMemberAccess();
  if (emailAccess) {
    return { ok: true, access: emailAccess };
  }

  if (isWorkspaceEmailAuthRequired() && !isBreakGlassPasswordEnabled()) {
    return { ok: false, access: null };
  }

  const cookieStore = await cookies();
  const result = await verifySignedAdminSession(
    cookieStore.get(adminSessionCookieName)?.value
  );

  if (result.ok && result.source) {
    return {
      ok: true,
      access: {
        source: result.source,
        accessLevel: result.accessLevel ?? "admin",
      },
    };
  }

  if (!isAdminPasswordGateEnabled() && !isWorkspaceEmailAuthRequired()) {
    return { ok: true, access: openAccessContext() };
  }

  return { ok: false, access: null };
}

export const verifyCurrentInternalAccess = cache(
  verifyCurrentInternalAccessUncached
);

export function canAccessInternalBrand(
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

export async function getCurrentWorkspaceMemberAccess(): Promise<WorkspaceMemberAccess | null> {
  if (!getSupabasePublicAuthConfig().ready) return null;

  try {
    const supabase = await createSupabaseServerAuthClient();
    const { data, error } = await supabase.auth.getClaims();
    const userId =
      typeof data?.claims?.sub === "string" ? data.claims.sub.trim() : "";
    const email =
      typeof data?.claims?.email === "string"
        ? data.claims.email.trim().toLowerCase()
        : "";
    if (error || !userId || !email) return null;
    return getWorkspaceMemberAccess({ userId, email });
  } catch {
    return null;
  }
}

export async function verifyAdminPasswordOnServer(password: string) {
  const environmentAccess = verifyAdminPassword(password);
  if (environmentAccess) return environmentAccess;
  if (!password || !hasSupabaseAdminEnv()) return null;

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.rpc(
      "verify_internal_access_password",
      { candidate_password: password }
    );
    if (error) {
      console.warn("internal_access_password_verification_failed", {
        code: error.code,
        message: error.message,
      });
      return null;
    }
    return data === "master" || data === "admin" ? data : null;
  } catch (error) {
    console.warn("internal_access_password_verification_unavailable", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}

export async function setAdminSessionCookie(accessLevel: AdminAccessLevel) {
  if (!isBreakGlassPasswordEnabled()) return false;
  const session = await createSignedAdminSession(accessLevel);
  if (!session) return false;

  const cookieStore = await cookies();
  cookieStore.set(adminSessionCookieName, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: adminSessionMaxAgeSeconds,
  });

  return true;
}

export async function clearInternalSessionCookie() {
  const cookieStore = await cookies();
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  } as const;

  cookieStore.set(adminSessionCookieName, "", cookieOptions);
  cookieStore.set(legacyInternalSessionCookieName, "", cookieOptions);

  if (getSupabasePublicAuthConfig().ready) {
    try {
      const supabase = await createSupabaseServerAuthClient();
      await supabase.auth.signOut();
    } catch {
      // Clearing the legacy cookies still guarantees the old shared-password
      // session is gone; a malformed provider session is ignored here.
    }
  }
}

export async function requireModuleAccess(module: InternalModule) {
  const access = await getCurrentInternalAccess();
  const emailAccess =
    access.source === "supabase_auth"
      ? (access as WorkspaceMemberAccess)
      : null;
  const masterOnly = module === "data_sources" || module === "system_audit";
  const workspaceModule = internalModuleToWorkspaceModule(module);
  return {
    access,
    allowed:
      access.source !== "unauthenticated" &&
      (!masterOnly || access.accessLevel === "master") &&
      (!emailAccess ||
        !workspaceModule ||
        canAccessWorkspaceModule(emailAccess, workspaceModule)),
  };
}

function internalModuleToWorkspaceModule(
  module: InternalModule
): WorkspaceModuleKey | null {
  if (module === "campaigns" || module === "forms" || module === "landing_pages") {
    return "launchhub";
  }
  if (module === "brands") return "settings";
  return module as WorkspaceModuleKey;
}

export async function requireActionAccess(action: InternalAction) {
  const access = await getCurrentInternalAccess();
  const masterOnlyActions = new Set<InternalAction>([
    "edit_data_sources",
    "edit_workspace_members",
    "edit_brand_settings",
    "view_system_audit",
  ]);
  return {
    access,
    allowed:
      access.source !== "unauthenticated" &&
      (action !== "edit_monthly_plan" || canManageMonthlyKpis(access)) &&
      (!masterOnlyActions.has(action) || access.accessLevel === "master"),
  };
}
