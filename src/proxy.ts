import { NextResponse, type NextRequest } from "next/server";
import {
  authenticateInternalAccess,
  canAccessModule,
  hasInternalSessionConfig,
  internalSessionCookieName,
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

function getConfiguredAdminOrigin() {
  const configured =
    cleanBaseUrl(process.env.NEXT_PUBLIC_ADMIN_BASE_URL) ??
    cleanBaseUrl(process.env.NEXT_PUBLIC_APP_URL);
  if (!configured) return null;

  try {
    return new URL(configured).origin;
  } catch {
    return null;
  }
}

function shouldUseAdminOrigin(request: NextRequest) {
  if (
    process.env.NODE_ENV !== "production" &&
    ["localhost", "127.0.0.1", "::1"].includes(request.nextUrl.hostname)
  ) {
    return null;
  }

  const adminOrigin = getConfiguredAdminOrigin();
  if (!adminOrigin) return null;
  if (request.nextUrl.origin === adminOrigin) return null;
  return adminOrigin;
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
}: {
  request: NextRequest;
  hasCookie: boolean;
  sessionVerified: boolean;
  role: string | null;
  routeModule: string | null;
  allowed: boolean | null;
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
  });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/login") {
    const adminOrigin = shouldUseAdminOrigin(request);
    if (adminOrigin) return redirectToAdminOrigin(request, adminOrigin);

    const access = await getRequestAccess(request);
    logInternalAccessDebug({
      request,
      hasCookie: Boolean(request.cookies.get(internalSessionCookieName)?.value),
      sessionVerified: Boolean(access?.source === "session"),
      role: access?.role ?? null,
      routeModule: null,
      allowed: null,
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

  const adminOrigin = shouldUseAdminOrigin(request);
  if (adminOrigin) return redirectToAdminOrigin(request, adminOrigin);

  const sessionCookie = request.cookies.get(internalSessionCookieName)?.value;
  const access = await getRequestAccess(request);
  const routeModule = getInternalRouteModule(pathname);
  const allowed = routeModule && access ? canAccessModule(access.role, routeModule) : null;
  logInternalAccessDebug({
    request,
    hasCookie: Boolean(sessionCookie),
    sessionVerified: Boolean(access?.source === "session"),
    role: access?.role ?? null,
    routeModule,
    allowed,
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
