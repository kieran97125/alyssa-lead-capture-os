import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicAuthConfig } from "@/lib/supabase/authConfig";

export async function createSupabaseServerAuthClient() {
  const config = getSupabasePublicAuthConfig();
  if (!config.ready) {
    throw new Error("Supabase email authentication is not configured.");
  }

  const cookieStore = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always write cookies. The request Proxy
          // refreshes the same session and persists any rotated tokens.
        }
      },
    },
  });
}
