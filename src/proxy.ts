import { NextResponse, type NextRequest } from "next/server";
import {
  PUBLIC_ATTRIBUTION_COOKIE_MAX_AGE_SECONDS,
  PUBLIC_ATTRIBUTION_COOKIE_NAME,
  createPublicAttributionCookiePayload,
  encodePublicAttributionCookie,
} from "@/lib/attribution/publicAttributionCookie";
import {
  isInternalRoute,
  requiresMasterOrExplicitLeadAuditAccess,
  requiresMasterAccess,
} from "@/lib/security/routeBoundary";
import {
  adminSessionCookieName,
  isAdminPasswordGateEnabled,
  verifySignedAdminSession,
} from "@/lib/security/internalAccess";
import {
  isBreakGlassPasswordEnabled,
  isWorkspaceEmailAuthRequired,
} from "@/lib/supabase/authConfig";
import {
  hasSupabaseAuthCookie,
  refreshSupabaseAuth,
} from "@/lib/supabase/authProxy";
import {
  canAccessWorkspaceModule,
  getWorkspaceMemberAccess,
  getWorkspaceModuleForPath,
} from "@/lib/security/workspaceAuth";

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

  const payload = createPublicAttributionCookiePayload(request.nextUrl);

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
  return (
    pathname === "/login" ||
    pathname === "/logout" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/auth/") ||
    isInternalRoute(pathname)
  );
}

function redirectToLogin(request: NextRequest, error?: string) {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`
  );
  if (error) loginUrl.searchParams.set("error", error);

  // A 307 preserves the request method. That is correct for page navigation,
  // but it replays a protected Server Action POST against /login and can make
  // the user bounce back to the same page with no visible explanation.
  const status =
    request.method === "GET" || request.method === "HEAD" ? 307 : 303;
  return NextResponse.redirect(loginUrl, status);
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
    isInternalRoute(request.nextUrl.pathname)
  ) {
    const emailAuthRequired = isWorkspaceEmailAuthRequired();
    if (emailAuthRequired || hasSupabaseAuthCookie(request)) {
      const auth = await refreshSupabaseAuth(request);
      if (auth.identity) {
        const member = await getWorkspaceMemberAccess(auth.identity, {
          activate: true,
        });
        if (member) {
          const routeModule = getWorkspaceModuleForPath(
            request.nextUrl.pathname
          );
          if (
            requiresMasterAccess(request.nextUrl.pathname) &&
            member.accessLevel !== "master"
          ) {
            return redirectToLogin(request, "master_required");
          }
          if (routeModule && !canAccessWorkspaceModule(member, routeModule)) {
            return redirectToLogin(request, "permission_denied");
          }
          return auth.response;
        }
      }

      if (emailAuthRequired && !isBreakGlassPasswordEnabled()) {
        return redirectToLogin(request, "not_invited");
      }
    }

    if (!isAdminPasswordGateEnabled()) {
      return NextResponse.next();
    }

    const session = await verifySignedAdminSession(
      request.cookies.get(adminSessionCookieName)?.value
    );

    if (!session.ok) {
      return redirectToLogin(request);
    }
    if (
      requiresMasterAccess(request.nextUrl.pathname) &&
      session.accessLevel !== "master"
    ) {
      return redirectToLogin(request, "master_required");
    }
    if (
      requiresMasterOrExplicitLeadAuditAccess(request.nextUrl.pathname) &&
      session.accessLevel !== "master"
    ) {
      return redirectToLogin(request, "master_required");
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
