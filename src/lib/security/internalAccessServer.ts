import { cookies, headers } from "next/headers";
import {
  authenticateInternalAccess,
  canAccessModule,
  canPerformAction,
  createSignedInternalSession,
  internalSessionCookieName,
  internalSessionMaxAgeSeconds,
  type InternalAction,
  type InternalAccessContext,
  type InternalModule,
  verifySignedInternalSession,
} from "@/lib/security/internalAccess";

export async function getCurrentInternalAccess(): Promise<InternalAccessContext> {
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
  cookieStore.set(internalSessionCookieName, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: internalSessionMaxAgeSeconds,
  });

  return true;
}

export async function clearInternalSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(internalSessionCookieName, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
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
