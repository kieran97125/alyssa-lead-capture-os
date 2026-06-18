import type { InternalModule } from "@/lib/security/internalAccess";

export const publicExactRoutes = ["/login", "/logout", "/thank-you"] as const;

export const publicRoutePrefixes = [
  "/lp/",
  "/embed/",
  "/legal/",
  "/api/public/",
] as const;

export const internalRoutePrefixes = [
  "/dashboard",
  "/leads",
  "/performance",
  "/campaigns",
  "/create-campaign",
  "/forms",
  "/landing-pages",
  "/settings",
  "/system-audit",
  "/embed-preview",
  "/debug",
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

export function getInternalRouteModule(pathname: string): InternalModule | null {
  if (!isInternalRoute(pathname)) return null;
  if (pathname === "/" || pathname.startsWith("/dashboard")) return "dashboard";
  if (pathname.startsWith("/leads")) return "leads";
  if (pathname.startsWith("/performance")) return "performance";
  if (pathname.startsWith("/campaigns")) return "campaigns";
  if (pathname.startsWith("/forms") || pathname.startsWith("/embed-preview")) {
    return "forms";
  }
  if (pathname.startsWith("/landing-pages")) return "landing_pages";
  if (pathname.startsWith("/settings/brands")) return "brands";
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/system-audit")) return "system_audit";
  if (pathname.startsWith("/debug")) return "system_audit";
  return null;
}
