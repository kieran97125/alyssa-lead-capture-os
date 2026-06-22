import { NextResponse, type NextRequest } from "next/server";
import {
  PUBLIC_ATTRIBUTION_COOKIE_MAX_AGE_SECONDS,
  PUBLIC_ATTRIBUTION_COOKIE_NAME,
  encodePublicAttributionCookie,
  publicAttributionTrackingKeys,
} from "@/lib/attribution/publicAttributionCookie";
import { isInternalRoute } from "@/lib/security/routeBoundary";
import {
  adminSessionCookieName,
  isAdminPasswordGateEnabled,
  verifySignedAdminSession,
} from "@/lib/security/internalAccess";

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

function getRequestHost(request: NextRequest) {
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    request.nextUrl.host;
  return host.split(",")[0]?.trim().toLowerCase() || request.nextUrl.host;
}

function getRequestHostname(request: NextRequest) {
  return getRequestHost(request).replace(/:\d+$/, "");
}

function getRequestOrigin(request: NextRequest) {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0];
  const proto = forwardedProto?.trim() || request.nextUrl.protocol.replace(":", "");
  return `${proto}://${getRequestHost(request)}`;
}

function getConfiguredAdminOrigin(request: NextRequest) {
  const configuredAdminOrigin = originFromBaseUrl(
    process.env.NEXT_PUBLIC_ADMIN_BASE_URL
  );
  if (configuredAdminOrigin) return configuredAdminOrigin;

  if (getRequestHostname(request) === "go.beautytrialhk.com") {
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
  if (getRequestOrigin(request) === adminOrigin) return null;

  const publicOrigin = getConfiguredPublicOrigin();
  const isKnownPublicHost =
    getRequestHostname(request) === "go.beautytrialhk.com" ||
    (publicOrigin !== null && getRequestOrigin(request) === publicOrigin);

  return isKnownPublicHost ? adminOrigin : null;
}

function redirectToAdminOrigin(request: NextRequest, adminOrigin: string) {
  const targetUrl = new URL(
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
    adminOrigin
  );

  return NextResponse.redirect(targetUrl);
}

const publicLandingPageSlugAliases: Record<string, string> = {
  "alyssa-388-13e933": "ineffable-388-13e933",
  "alyssa-388-488b24": "ineffable-388-488b24",
};

function redirectLegacyPublicLandingPageSlug(request: NextRequest) {
  const match = request.nextUrl.pathname.match(/^\/lp\/([^/]+)\/?$/);
  const slug = match?.[1];
  if (!slug) return null;

  const canonicalSlug = publicLandingPageSlugAliases[slug];
  if (!canonicalSlug || canonicalSlug === slug) return null;

  const targetUrl = request.nextUrl.clone();
  targetUrl.pathname = `/lp/${canonicalSlug}`;

  return NextResponse.redirect(targetUrl);
}

function getPublicLpAttributionCookieValue(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/lp/")) return null;

  const searchParams = new URLSearchParams(request.nextUrl.search);
  const tracking = Object.fromEntries(
    publicAttributionTrackingKeys
      .map((key) => [key, searchParams.get(key)] as const)
      .filter(([, value]) => Boolean(value))
  );

  if (Object.keys(tracking).length === 0) return null;

  const fullUrl = `${request.nextUrl.origin}${request.nextUrl.pathname}${request.nextUrl.search}`;
  const payload = {
    captured_at: new Date().toISOString(),
    source_capture_method: "proxy_public_lp_first_touch" as const,
    current_page_url: fullUrl,
    landing_page_url: fullUrl,
    page_path: request.nextUrl.pathname,
    ...tracking,
  };

  return payload ? encodePublicAttributionCookie(payload) : null;
}

function attachPublicAttributionCookie(
  response: NextResponse,
  cookieValue: string | null
) {
  if (!cookieValue) return response;
  const secure = process.env.NODE_ENV === "production";

  response.headers.append(
    "Set-Cookie",
    [
      `${PUBLIC_ATTRIBUTION_COOKIE_NAME}=${cookieValue}`,
      "Path=/",
      `Max-Age=${PUBLIC_ATTRIBUTION_COOKIE_MAX_AGE_SECONDS}`,
      "SameSite=Lax",
      secure ? "Secure" : "",
    ]
      .filter(Boolean)
      .join("; ")
  );

  return response;
}

function isAdminBackendPath(pathname: string) {
  return pathname === "/login" || pathname === "/logout" || isInternalRoute(pathname);
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

export async function proxy(request: NextRequest) {
  const publicAttributionCookieValue = getPublicLpAttributionCookieValue(request);
  const publicLpRedirect = redirectLegacyPublicLandingPageSlug(request);
  if (publicLpRedirect) {
    return attachPublicAttributionCookie(
      publicLpRedirect,
      publicAttributionCookieValue
    );
  }

  if (isAdminBackendPath(request.nextUrl.pathname)) {
    const adminOrigin = shouldUseAdminOrigin(request);
    if (adminOrigin) {
      return redirectToAdminOrigin(request, adminOrigin);
    }
  }

  if (
    isAdminPasswordGateEnabled() &&
    isInternalRoute(request.nextUrl.pathname)
  ) {
    const session = await verifySignedAdminSession(
      request.cookies.get(adminSessionCookieName)?.value
    );

    if (!session.ok) {
      return redirectToLogin(request);
    }
  }

  return attachPublicAttributionCookie(
    NextResponse.next(),
    publicAttributionCookieValue
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)",
  ],
};
