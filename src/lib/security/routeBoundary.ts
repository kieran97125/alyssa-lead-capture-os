import type { InternalModule } from "@/lib/security/internalAccess";

export const publicExactRoutes = ["/login", "/logout", "/thank-you"] as const;

export const publicRoutePrefixes = [
  "/auth/",
  "/lp/",
  "/embed/",
  "/legal/",
  "/api/auth/",
  "/api/public/",
  "/api/integrations/google-sheets/callback",
] as const;

export const internalRoutePrefixes = [
  "/dashboard",
  "/kpis",
  "/calendar",
  "/data-sources",
  "/leads",
  "/lead-audit",
  "/crm",
  "/performance",
  "/brands",
  "/campaigns",
  "/create-campaign",
  "/forms",
  "/landing-pages",
  "/settings",
  "/system-audit",
  "/embed-preview",
] as const;

export function isPublicRoute(pathname: string) {
  return (
    publicExactRoutes.includes(pathname as (typeof publicExactRoutes)[number]) ||
    publicRoutePrefixes.some((prefix) => pathname.startsWith(prefix))
  );
}

export function isInternalRoute(pathname: string) {
  if (isPublicRoute(pathname)) return false;
  if (pathname === "/") return true;
  return internalRoutePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

const masterOnlyRoutePrefixes = [
  "/data-sources",
  "/settings/team",
  "/system-audit",
] as const;

export function requiresMasterAccess(pathname: string) {
  return masterOnlyRoutePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function requiresMasterOrExplicitLeadAuditAccess(pathname: string) {
  return pathname === "/lead-audit" || pathname.startsWith("/lead-audit/");
}

export function getInternalRouteModule(pathname: string): InternalModule | null {
  if (!isInternalRoute(pathname)) return null;
  if (pathname === "/" || pathname.startsWith("/dashboard")) return "dashboard";
  if (pathname.startsWith("/kpis")) return "kpis";
  if (pathname.startsWith("/calendar")) return "calendar";
  if (pathname.startsWith("/data-sources")) return "data_sources";
  if (pathname.startsWith("/leads")) return "leads";
  if (pathname.startsWith("/lead-audit")) return "lead_audit";
  if (pathname.startsWith("/crm")) return "crm";
  if (pathname.startsWith("/performance")) return "performance";
  if (pathname.startsWith("/settings/planning")) return "kpis";
  if (pathname.startsWith("/brands")) return "brands";
  if (pathname.startsWith("/campaigns")) return "campaigns";
  if (pathname.startsWith("/forms") || pathname.startsWith("/embed-preview")) {
    return "forms";
  }
  if (pathname.startsWith("/landing-pages")) return "landing_pages";
  if (pathname.startsWith("/settings/brands")) return "brands";
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/system-audit")) return "system_audit";
  return null;
}
