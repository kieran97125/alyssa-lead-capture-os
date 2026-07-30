import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicAuthConfig } from "@/lib/supabase/authConfig";

export type VerifiedSupabaseIdentity = {
  userId: string;
  email: string;
};

export function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token"));
}

export async function refreshSupabaseAuth(request: NextRequest) {
  const config = getSupabasePublicAuthConfig();
  let response = NextResponse.next({ request });
  if (!config.ready) {
    return {
      response,
      identity: null,
      configured: false,
    };
  }

  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  const userId =
    typeof data?.claims?.sub === "string" ? data.claims.sub.trim() : "";
  const email =
    typeof data?.claims?.email === "string"
      ? data.claims.email.trim().toLowerCase()
      : "";

  return {
    response,
    identity:
      !error && userId && email
        ? ({
            userId,
            email,
          } satisfies VerifiedSupabaseIdentity)
        : null,
    configured: true,
  };
}
