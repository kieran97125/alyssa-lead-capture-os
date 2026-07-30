"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicAuthConfig } from "@/lib/supabase/authConfig";

export function createSupabaseBrowserAuthClient() {
  const config = getSupabasePublicAuthConfig();
  if (!config.ready) {
    throw new Error("Supabase email authentication is not configured.");
  }
  return createBrowserClient(config.url, config.key);
}
