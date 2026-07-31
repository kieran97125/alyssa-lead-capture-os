"use server";

import { redirect } from "next/navigation";
import {
  isAdminPasswordGateEnabled,
} from "@/lib/security/internalAccess";
import {
  setAdminSessionCookie,
  verifyAdminPasswordOnServer,
} from "@/lib/security/internalAccessServer";
import {
  isBreakGlassPasswordEnabled,
  safeInternalNextPath,
} from "@/lib/supabase/authConfig";

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
