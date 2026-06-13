import { NextResponse, type NextRequest } from "next/server";
import { isInternalRoute } from "@/lib/security/routeBoundary";

function unauthorized() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Alyssa internal pages", charset="UTF-8"',
    },
  });
}

function hasValidBasicAuth(request: NextRequest) {
  const expectedUser = process.env.INTERNAL_BASIC_AUTH_USER;
  const expectedPassword = process.env.INTERNAL_BASIC_AUTH_PASSWORD;

  if (!expectedUser || !expectedPassword) return true;

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Basic ")) return false;

  try {
    const decoded = atob(header.slice("Basic ".length));
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex < 0) return false;

    const user = decoded.slice(0, separatorIndex);
    const password = decoded.slice(separatorIndex + 1);
    return user === expectedUser && password === expectedPassword;
  } catch {
    return false;
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isInternalRoute(pathname)) {
    return NextResponse.next();
  }

  if (!hasValidBasicAuth(request)) {
    return unauthorized();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)",
  ],
};
