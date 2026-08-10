export function getSupabasePublicAuthConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    "";

  return {
    ready: Boolean(url && key),
    url,
    key,
  };
}

export function isWorkspaceEmailAuthRequired() {
  return process.env.LAUNCHHUB_EMAIL_AUTH_ENABLED?.trim().toLowerCase() === "true";
}

export function isBreakGlassPasswordEnabled() {
  return (
    !isWorkspaceEmailAuthRequired() ||
    process.env.LAUNCHHUB_BREAK_GLASS_PASSWORD_ENABLED?.trim().toLowerCase() ===
      "true"
  );
}

export const PRODUCTION_ADMIN_ORIGIN = "https://app.beautytrialhk.com";
export const PRODUCTION_AUTH_LINK_HOST = "app.beautytrialhk.com";

export function resolveCanonicalAdminOrigin(
  configured: string | undefined,
  runtime: string | undefined
) {
  const normalized = configured?.trim().replace(/\/+$/, "") || "";

  if (runtime === "production") {
    if (normalized && normalized !== PRODUCTION_ADMIN_ORIGIN) {
      console.warn("production_admin_origin_mismatch", {
        configuredOrigin: normalized,
        canonicalOrigin: PRODUCTION_ADMIN_ORIGIN,
      });
    }
    return PRODUCTION_ADMIN_ORIGIN;
  }

  return normalized || "http://localhost:3000";
}

export function getCanonicalAdminOrigin() {
  return resolveCanonicalAdminOrigin(
    process.env.NEXT_PUBLIC_ADMIN_BASE_URL,
    process.env.NODE_ENV
  );
}

export function safeInternalNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }
  if (
    value.startsWith("/login") ||
    value.startsWith("/logout") ||
    value.startsWith("/auth/")
  ) {
    return "/dashboard";
  }
  return value;
}

export function getAuthConfirmUrl(next = "/dashboard") {
  const url = new URL("/auth/confirm", getCanonicalAdminOrigin());
  url.searchParams.set("next", safeInternalNextPath(next));
  return url.toString();
}

/**
 * Recipient-facing invite and magic-link URLs must open on the Growth OS
 * system domain. Supabase remains the verifier behind /auth/confirm, but its
 * project hostname must never be the first URL shown to a recipient.
 */
export function assertSystemDomainAuthLink(value: string) {
  const url = new URL(value);
  const expected = new URL(getCanonicalAdminOrigin());
  if (
    url.origin !== expected.origin ||
    url.hostname.endsWith(".supabase.co") ||
    url.pathname !== "/auth/confirm"
  ) {
    throw new Error("Auth email link must use the canonical Growth OS domain.");
  }
  return url.toString();
}
