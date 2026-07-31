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

export function getCanonicalAdminOrigin() {
  const configured = process.env.NEXT_PUBLIC_ADMIN_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production") return "https://app.beautytrialhk.com";
  return "http://localhost:3000";
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
