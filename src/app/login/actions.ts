"use server";

import { redirect } from "next/navigation";
import {
  isAdminPasswordGateEnabled,
} from "@/lib/security/internalAccess";
import {
  setAdminSessionCookie,
  verifyAdminPasswordOnServer,
} from "@/lib/security/internalAccessServer";

function safeNextPath(value: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }
  if (value.startsWith("/login") || value.startsWith("/logout")) {
    return "/dashboard";
  }
  return value;
}

export async function loginAction(formData: FormData) {
  const next = safeNextPath(String(formData.get("next") ?? ""));
  const password = String(formData.get("password") ?? "");

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
