"use server";

import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import {
  isAdminPasswordGateEnabled,
} from "@/lib/security/internalAccess";
import {
  setAdminSessionCookie,
  verifyAdminPasswordOnServer,
} from "@/lib/security/internalAccessServer";
import {
  getAuthConfirmUrl,
  getSupabasePublicAuthConfig,
  isBreakGlassPasswordEnabled,
  safeInternalNextPath,
} from "@/lib/supabase/authConfig";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";

export async function loginAction(formData: FormData) {
  const next = safeInternalNextPath(String(formData.get("next") ?? ""));
  const password = String(formData.get("password") ?? "");

  if (!isBreakGlassPasswordEnabled()) {
    redirect(`/login?next=${encodeURIComponent(next)}&error=email_required`);
  }

  if (!isAdminPasswordGateEnabled()) {
    redirect(next);
  }

  const accessLevel = await verifyAdminPasswordOnServer(password);
  if (!accessLevel) {
    redirect(`/login?next=${encodeURIComponent(next)}&error=invalid_password`);
  }

  const sessionSet = await setAdminSessionCookie(accessLevel);
  if (!sessionSet) {
    redirect(`/login?next=${encodeURIComponent(next)}&error=not_configured`);
  }

  redirect(next);
}

export async function requestEmailLoginAction(formData: FormData) {
  const next = safeInternalNextPath(String(formData.get("next") ?? ""));
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const genericSentPath = `/login?next=${encodeURIComponent(
    next
  )}&email_status=sent`;

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !hasSupabaseAdminEnv()
  ) {
    redirect(genericSentPath);
  }

  const admin = createSupabaseAdminClient();
  const { data: member } = await admin
    .from("workspace_members")
    .select("id,status,auth_user_id")
    .ilike("email", email)
    .in("status", ["invited", "active"])
    .maybeSingle();

  // Always return the same public response so the login form cannot be used
  // to enumerate invited company accounts.
  if (!member?.auth_user_id) {
    redirect(genericSentPath);
  }

  const config = getSupabasePublicAuthConfig();
  if (!config.ready) {
    redirect(
      `/login?next=${encodeURIComponent(next)}&error=email_not_configured`
    );
  }

  const auth = createClient(config.url, config.key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      flowType: "implicit",
    },
  });
  const { error } = await auth.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: getAuthConfirmUrl(next),
    },
  });

  if (error) {
    console.warn("workspace_magic_link_send_failed", {
      code: error.code,
      status: error.status,
    });
    redirect(`/login?next=${encodeURIComponent(next)}&error=email_send_failed`);
  }

  redirect(genericSentPath);
}
