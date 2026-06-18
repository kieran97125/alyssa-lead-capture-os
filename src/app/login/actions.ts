"use server";

import { redirect } from "next/navigation";
import {
  authenticateUsernamePassword,
} from "@/lib/security/internalAccess";
import { setInternalSessionCookie } from "@/lib/security/internalAccessServer";

function readString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function safeNextPath(value: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  if (value.startsWith("/login") || value.startsWith("/logout")) return "/dashboard";
  return value;
}

function redirectToLoginError(nextPath: string): never {
  redirect(`/login?error=1&next=${encodeURIComponent(safeNextPath(nextPath))}`);
}

export async function loginAction(formData: FormData) {
  const username = readString(formData, "username");
  const password = String(formData.get("password") ?? "");
  const nextPath = safeNextPath(readString(formData, "next"));

  const auth = authenticateUsernamePassword(username, password);
  if (!auth.ok) redirectToLoginError(nextPath);

  const sessionCreated = await setInternalSessionCookie(auth.context);
  if (!sessionCreated) redirectToLoginError(nextPath);

  redirect(nextPath);
}
