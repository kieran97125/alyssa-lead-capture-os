"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  archiveLandingPage,
  deleteLandingPageSafely,
} from "@/lib/data/landingPageStore";

function readString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function safeReturnTo(value: string, fallback: string) {
  if (value.startsWith("/landing-pages") && !value.startsWith("//")) {
    return value;
  }
  return fallback;
}

function redirectWithMessage(path: string, message: string): never {
  const [pathname, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set("landing_status", message);
  redirect(`${pathname}?${params.toString()}`);
}

export async function archiveLandingPageAction(formData: FormData) {
  const pageId = readString(formData, "pageId");
  const confirmed = readString(formData, "confirmArchive") === "yes";
  const returnTo = safeReturnTo(
    readString(formData, "returnTo"),
    "/landing-pages?archive=active"
  );

  if (!confirmed) {
    redirectWithMessage(returnTo, "Archive not applied. Tick the confirmation checkbox first.");
  }

  const result = await archiveLandingPage(pageId);
  revalidatePath("/landing-pages");
  revalidatePath(`/landing-pages/${pageId}`);
  redirectWithMessage(returnTo, result.message);
}

export async function deleteLandingPageAction(formData: FormData) {
  const pageId = readString(formData, "pageId");
  const confirmed = readString(formData, "confirmDelete") === "yes";
  const returnTo = safeReturnTo(
    readString(formData, "returnTo"),
    "/landing-pages?archive=active"
  );

  if (!confirmed) {
    redirectWithMessage(
      returnTo,
      "Delete not applied. Tick the permanent delete confirmation first."
    );
  }

  const result = await deleteLandingPageSafely(pageId);
  revalidatePath("/landing-pages");
  redirectWithMessage(returnTo, result.message);
}
