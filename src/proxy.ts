import { NextResponse, type NextRequest } from "next/server";
import {
  authenticateInternalAccess,
  canAccessModule,
  hasInternalSessionConfig,
  internalSessionCookieName,
  isInternalAuthDisabled,
  noPermissionMessage,
  verifySignedInternalSession,
} from "@/lib/security/internalAccess";
import {
  getInternalRouteModule,
  isInternalRoute,
} from "@/lib/security/routeBoundary";

function cleanBaseUrl(value: string | undefined) {
  const cleaned = value?.trim().replace(/\/+$/, "");
  return cleaned || null;
}

function originFromBaseUrl(value: string | undefined) {
  const configured = cleanBaseUrl(value);
  if (!configured) return null;

  try {
    return new URL(configured).origin;
  } catch {
    return null;
  }
}

function getConfiguredAdminOrigin(request: NextRequest) {
  const configuredAdminOrigin = originFromBaseUrl(
    process.env.NEXT_PUBLIC_ADMIN_BASE_URL
  );
  if (configuredAdminOrigin) return configuredAdminOrigin;

  if (request.nextUrl.hostname === "go.beautytrialhk.com") {
    return "https://app.beautytrialhk.com";
  }

  const appOrigin = originFromBaseUrl(process.env.NEXT_PUBLIC_APP_URL);
  if (appOrigin && new URL(appOrigin).hostname !== "go.beautytrialhk.com") {
    return appOrigin;
  }

  return null;
}

function getConfiguredPublicOrigin() {
  return originFromBaseUrl(process.env.NEXT_PUBLIC_PUBLIC_BASE_URL);
}

function shouldUseAdminOrigin(request: NextRequest) {
  const adminOrigin = getConfiguredAdminOrigin(request);
  if (!adminOrigin) return null;
  if (request.nextUrl.origin === adminOrigin) return null;

  const publicOrigin = getConfiguredPublicOrigin();
  const isKnownPublicHost =
    request.nextUrl.hostname === "go.beautytrialhk.com" ||
    (publicOrigin !== null && request.nextUrl.origin === publicOrigin);

  return isKnownPublicHost ? adminOrigin : null;
}

function redirectToAdminOrigin(request: NextRequest, adminOrigin: string) {
  const targetUrl = new URL(
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
    adminOrigin
  );

  return NextResponse.redirect(targetUrl);
}

function forbidden(message: string) {
  return new NextResponse(
    `<!doctype html><html lang="zh-HK"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>沒有權限</title></head><body style="margin:0;background:#fff9f3;color:#321428;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"><main style="min-height:100vh;display:grid;place-items:center;padding:24px;"><section style="max-width:520px;border:1px solid #ead9cf;border-radius:28px;background:white;padding:28px;box-shadow:0 24px 70px rgba(90,35,72,.12);"><p style="margin:0 0 8px;color:#9a5d76;font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;">LaunchHub Internal</p><h1 style="margin:0;font-size:26px;">${message}</h1><p style="margin:14px 0 0;color:#6d4a5c;line-height:1.7;font-weight:600;">如需要使用此頁面，請聯絡 Owner 調整帳戶權限。</p></section></main></body></html>`,
    {
      status: 403,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    }
  );
}

function redirectToLogin(request: NextRequest) {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`
  );

  return NextResponse.redirect(loginUrl);
}

async function getRequestAccess(request: NextRequest) {
  if (isInternalAuthDisabled()) {
    return {
      username: "auth-disabled",
      role: "owner" as const,
      source: "auth_disabled" as const,
    };
  }

  if (process.env.NODE_ENV === "production" && !hasInternalSessionConfig()) {
    return null;
  }

  const session = await verifySignedInternalSession(
    request.cookies.get(internalSessionCookieName)?.value
  );
  if (session) return session;

  const basicAuth = authenticateInternalAccess(request.headers.get("authorization"));
  return basicAuth.ok ? basicAuth.context : null;
}

function logInternalAccessDebug({
  request,
  hasCookie,
  sessionVerified,
  role,
  routeModule,
  allowed,
  decision,
}: {
  request: NextRequest;
  hasCookie: boolean;
  sessionVerified: boolean;
  role: string | null;
  routeModule: string | null;
  allowed: boolean | null;
  decision: "allow" | "login_redirect" | "no_permission" | "admin_redirect";
}) {
  if (process.env.NODE_ENV !== "development") return;

  console.info("[internal-access]", {
    pathname: request.nextUrl.pathname,
    host: request.headers.get("host"),
    hasSessionCookie: hasCookie,
    sessionVerified,
    role,
    routeModule,
    moduleAllowed: allowed,
    decision,
  });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/login") {
    const adminOrigin = shouldUseAdminOrigin(request);
    if (adminOrigin) {
      logInternalAccessDebug({
        request,
        hasCookie: Boolean(request.cookies.get(internalSessionCookieName)?.value),
        sessionVerified: false,
        role: null,
        routeModule: null,
        allowed: null,
        decision: "admin_redirect",
      });
      return redirectToAdminOrigin(request, adminOrigin);
    }

    if (isInternalAuthDisabled()) {
      return NextResponse.next();
    }

    const access = await getRequestAccess(request);
    logInternalAccessDebug({
      request,
      hasCookie: Boolean(request.cookies.get(internalSessionCookieName)?.value),
      sessionVerified: Boolean(access?.source === "session"),
      role: access?.role ?? null,
      routeModule: null,
      allowed: null,
      decision: "allow",
    });
    if (!access) return NextResponse.next();

    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  if (!isInternalRoute(pathname)) {
    return NextResponse.next();
  }

  if (isInternalAuthDisabled()) {
    logInternalAccessDebug({
      request,
      hasCookie: Boolean(request.cookies.get(internalSessionCookieName)?.value),
      sessionVerified: false,
      role: "owner",
      routeModule: getInternalRouteModule(pathname),
      allowed: true,
      decision: "allow",
    });
    return NextResponse.next();
  }

  const adminOrigin = shouldUseAdminOrigin(request);
  if (adminOrigin) {
    logInternalAccessDebug({
      request,
      hasCookie: Boolean(request.cookies.get(internalSessionCookieName)?.value),
      sessionVerified: false,
      role: null,
      routeModule: getInternalRouteModule(pathname),
      allowed: null,
      decision: "admin_redirect",
    });
    return redirectToAdminOrigin(request, adminOrigin);
  }

  const sessionCookie = request.cookies.get(internalSessionCookieName)?.value;
  const access = await getRequestAccess(request);
  const routeModule = getInternalRouteModule(pathname);
  const allowed = routeModule && access ? canAccessModule(access.role, routeModule) : null;
  const decision = !access
    ? "login_redirect"
    : routeModule && !allowed
      ? "no_permission"
      : "allow";
  logInternalAccessDebug({
    request,
    hasCookie: Boolean(sessionCookie),
    sessionVerified: Boolean(access?.source === "session"),
    role: access?.role ?? null,
    routeModule,
    allowed,
    decision,
  });

  if (!access) {
    return redirectToLogin(request);
  }

  if (routeModule && !allowed) {
    return forbidden(noPermissionMessage);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)",
  ],
};
