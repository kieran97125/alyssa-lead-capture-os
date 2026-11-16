"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  archiveLandingPage,
  deleteLandingPageSafely,
  restoreLandingPage,
} from "@/lib/data/landingPageStore";
import { requireModuleAccess } from "@/lib/security/internalAccessServer";

function readString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function safeReturnTo(value: string, fallback: string) {
  if (/^\/(?:landing-pages|campaigns|forms)(?:[/?]|$)/.test(value) && !value.includes("\\")) {
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
  const access = await requireModuleAccess("landing_pages");
  if (!access.allowed) redirect("/login?next=/landing-pages&error=permission_denied");
  const pageId = readString(formData, "pageId");
  const confirmed = readString(formData, "confirmArchive") === "yes";
  const returnTo = safeReturnTo(
    readString(formData, "returnTo"),
    "/landing-pages?archive=active"
  );

  if (!confirmed) {
    redirectWithMessage(returnTo, "尚未封存；請先勾選封存確認。");
  }

  const result = await archiveLandingPage(pageId, Number(readString(formData, "expectedRevision")), readString(formData, "requestId"));
  revalidatePath("/landing-pages");
  revalidatePath("/campaigns");
  revalidatePath("/forms");
  if (result.ok && result.previousPublishedSlug) revalidatePath("/lp/" + result.previousPublishedSlug);
  revalidatePath(`/landing-pages/${pageId}`);
  redirectWithMessage(returnTo, result.message);
}

export async function deleteLandingPageAction(formData: FormData) {
  const access = await requireModuleAccess("landing_pages");
  if (!access.allowed) redirect("/login?next=/landing-pages&error=permission_denied");
  const pageId = readString(formData, "pageId");
  const confirmed = readString(formData, "confirmDelete") === "yes";
  const returnTo = safeReturnTo(
    readString(formData, "returnTo"),
    "/landing-pages?archive=active"
  );

  if (!confirmed) {
    redirectWithMessage(
      returnTo,
      "尚未刪除；請先勾選永久刪除確認。"
    );
  }

  const result = await deleteLandingPageSafely(pageId, Number(readString(formData, "expectedRevision")), readString(formData, "requestId"));
  revalidatePath("/landing-pages");
  revalidatePath("/campaigns");
  revalidatePath("/forms");
  if (result.ok && result.previousPublishedSlug) revalidatePath("/lp/" + result.previousPublishedSlug);
  redirectWithMessage(returnTo, result.message);
}

export async function restoreLandingPageAction(formData: FormData) {
  const access = await requireModuleAccess("landing_pages");
  if (!access.allowed) redirect("/login?next=/landing-pages&error=permission_denied");
  const pageId = readString(formData, "pageId");
  const returnTo = safeReturnTo(readString(formData, "returnTo"), "/campaigns");
  const result = await restoreLandingPage(pageId, Number(readString(formData, "expectedRevision")), readString(formData, "requestId"));
  revalidatePath("/landing-pages");
  revalidatePath("/campaigns");
  revalidatePath("/forms");
  revalidatePath("/landing-pages/" + pageId);
  redirectWithMessage(returnTo, result.message);
}
