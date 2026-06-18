import { cookies } from "next/headers";
import {
  createSignedInternalSession,
  getInternalAuthCookieDomain,
  internalSessionCookieName,
  internalSessionMaxAgeSeconds,
  type InternalAction,
  type InternalAccessContext,
  type InternalModule,
} from "@/lib/security/internalAccess";

function openAccessContext(): InternalAccessContext {
  return {
    username: "admin-open",
    role: "owner",
    source: "auth_disabled",
  };
}

export async function getCurrentInternalAccess(): Promise<InternalAccessContext> {
  return openAccessContext();
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

export async function requireModuleAccess(_module: InternalModule) {
  void _module;

  return {
    access: openAccessContext(),
    allowed: true,
  };
}

export async function requireActionAccess(_action: InternalAction) {
  void _action;

  return {
    access: openAccessContext(),
    allowed: true,
  };
}
