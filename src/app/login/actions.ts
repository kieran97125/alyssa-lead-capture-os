"use server";

import { redirect } from "next/navigation";

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
  redirect(safeNextPath(String(formData.get("next") ?? "")));
}
