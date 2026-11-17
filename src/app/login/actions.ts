"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { requestReservedLoginLink } from "@/lib/security/loginLink";
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

export async function requestLoginLinkAction(formData: FormData) {
  const next = safeInternalNextPath(String(formData.get("next") ?? ""));
  const email = z.email().max(254).safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!email.success) redirect(`/login?next=${encodeURIComponent(next)}&error=invalid_email`);
  try {
    const incoming = await headers();
    const ip = (incoming.get("x-vercel-forwarded-for") || incoming.get("x-forwarded-for") || "unknown").split(",")[0].trim().slice(0,80);
    await requestReservedLoginLink(email.data, ip, next);
  } catch { redirect(`/login?next=${encodeURIComponent(next)}&error=email_send_failed`); }
  redirect(`/login?next=${encodeURIComponent(next)}&sent=1`);
}
