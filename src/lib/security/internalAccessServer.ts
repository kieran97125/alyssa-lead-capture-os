import { cookies, headers } from "next/headers";
import {
  authenticateInternalAccess,
  canAccessModule,
  canPerformAction,
  createSignedInternalSession,
  getInternalAuthCookieDomain,
  internalSessionCookieName,
  internalSessionMaxAgeSeconds,
  isInternalAuthDisabled,
  type InternalAction,
  type InternalAccessContext,
  type InternalModule,
  verifySignedInternalSession,
} from "@/lib/security/internalAccess";

function disabledAccessContext(): InternalAccessContext {
  return {
    username: "auth-disabled",
    role: "owner",
    source: "auth_disabled",
  };
}

export async function getCurrentInternalAccess(): Promise<InternalAccessContext> {
  if (isInternalAuthDisabled()) return disabledAccessContext();

  const cookieStore = await cookies();
  const session = await verifySignedInternalSession(
    cookieStore.get(internalSessionCookieName)?.value
  );

  if (session) return session;

  const headerStore = await headers();
  const basicAuth = authenticateInternalAccess(headerStore.get("authorization"));

  if (basicAuth.ok) return basicAuth.context;

  return {
    username: "",
    role: "lead_viewer",
    source: "local_dev_fallback",
  };
}

export async function setInternalSessionCookie(context: InternalAccessContext) {
  const session = await createSignedInternalSession(context);
  if (!session) return false;

  const cookieStore = await cookies();
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: internalSessionMaxAgeSeconds,
  } as const;
  const cookieDomain = getInternalAuthCookieDomain();

  cookieStore.set(internalSessionCookieName, session, cookieDomain
    ? { ...cookieOptions, domain: cookieDomain }
    : cookieOptions);

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
  const cookieDomain = getInternalAuthCookieDomain();

  cookieStore.set(internalSessionCookieName, "", cookieOptions);
  if (cookieDomain) {
    cookieStore.set(internalSessionCookieName, "", {
      ...cookieOptions,
      domain: cookieDomain,
    });
  }
}

export async function requireModuleAccess(module: InternalModule) {
  const access = await getCurrentInternalAccess();

  return {
    access,
    allowed: canAccessModule(access.role, module),
  };
}

export async function requireActionAccess(action: InternalAction) {
  const access = await getCurrentInternalAccess();

  return {
    access,
    allowed: canPerformAction(access.role, action),
  };
}
