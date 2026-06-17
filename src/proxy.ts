import { NextResponse, type NextRequest } from "next/server";
import {
  authenticateInternalAccess,
  canAccessModule,
  noPermissionMessage,
} from "@/lib/security/internalAccess";
import {
  getInternalRouteModule,
  isInternalRoute,
} from "@/lib/security/routeBoundary";

function unauthorized() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="LaunchHub internal pages", charset="UTF-8"',
    },
  });
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

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isInternalRoute(pathname)) {
    return NextResponse.next();
  }

  const access = authenticateInternalAccess(request.headers.get("authorization"));

  if (!access.ok) {
    if (access.reason === "not_configured") {
      return unauthorized();
    }

    return unauthorized();
  }

  const routeModule = getInternalRouteModule(pathname);
  if (routeModule && !canAccessModule(access.context.role, routeModule)) {
    return forbidden(noPermissionMessage);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)",
  ],
};
