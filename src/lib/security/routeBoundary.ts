export const publicExactRoutes = ["/"] as const;

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
  return internalRoutePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function hasInternalBasicAuthConfig() {
  return Boolean(
    process.env.INTERNAL_BASIC_AUTH_USER &&
      process.env.INTERNAL_BASIC_AUTH_PASSWORD
  );
}
