import { cookies } from "next/headers";
import {
  adminSessionCookieName,
  adminSessionMaxAgeSeconds,
  createSignedAdminSession,
  legacyInternalSessionCookieName,
  verifySignedAdminSession,
  type AdminAccessLevel,
  type InternalAccessContext,
  type InternalAction,
  type InternalModule,
} from "@/lib/security/internalAccess";

function openAccessContext(): InternalAccessContext {
  return {
    source: "development_not_configured",
    accessLevel: "master",
  };
}

export async function getCurrentInternalAccess(): Promise<InternalAccessContext> {
  const cookieStore = await cookies();
  const result = await verifySignedAdminSession(
    cookieStore.get(adminSessionCookieName)?.value
  );

  return result.ok && result.source
    ? { source: result.source, accessLevel: result.accessLevel ?? "admin" }
    : openAccessContext();
}

export async function setAdminSessionCookie(accessLevel: AdminAccessLevel) {
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
}

export async function requireModuleAccess(module: InternalModule) {
  const access = await getCurrentInternalAccess();
  const masterOnly = module === "data_sources" || module === "system_audit";
  return {
    access,
    allowed: !masterOnly || access.accessLevel === "master",
  };
}

export async function requireActionAccess(action: InternalAction) {
  const access = await getCurrentInternalAccess();
  const masterOnlyActions = new Set<InternalAction>([
    "edit_monthly_plan",
    "edit_data_sources",
    "edit_workspace_members",
    "edit_brand_settings",
    "view_system_audit",
  ]);
  return {
    access,
    allowed:
      !masterOnlyActions.has(action) || access.accessLevel === "master",
  };
}
