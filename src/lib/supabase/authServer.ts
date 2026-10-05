import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicAuthConfig } from "@/lib/supabase/authConfig";
import { createAuthRequestDeadline } from "@/lib/supabase/requestDeadline";

export async function createSupabaseServerAuthClient() {
  const config = getSupabasePublicAuthConfig();
  if (!config.ready) {
    throw new Error("Supabase email authentication is not configured.");
  }

  const cookieStore = await cookies();
  const authDeadline = createAuthRequestDeadline();
  const supabase = createServerClient(config.url, config.key, {
    global: { fetch: authDeadline.fetch },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        if (authDeadline.signal.aborted) return;
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
  return Object.assign(supabase, { authDeadline });
}
