"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getLandingPageById,
  getLandingPageContent,
  getLandingPageImageAssets,
  publishLandingPage,
  saveLandingPageDraft,
} from "@/lib/data/landingPageStore";

function resultRedirect(pageId: string, message: string): never {
  redirect(`/landing-pages/${pageId}?builder_status=${encodeURIComponent(message)}`);
}

export async function saveLandingPageDraftAction(formData: FormData) {
  const pageId = String(formData.get("pageId") ?? "");
  const page = await getLandingPageById(pageId);

  if (!page) resultRedirect(pageId, "Landing page not found.");

  const result = await saveLandingPageDraft(
    pageId,
    getLandingPageContent(page),
    getLandingPageImageAssets(page)
  );

  revalidatePath("/landing-pages");
  revalidatePath(`/landing-pages/${pageId}`);

  resultRedirect(pageId, result.message);
}

export async function publishLandingPageAction(formData: FormData) {
  const pageId = String(formData.get("pageId") ?? "");
  const result = await publishLandingPage(pageId);

  revalidatePath("/landing-pages");
  revalidatePath(`/landing-pages/${pageId}`);

  if (result.ok) {
    revalidatePath(`/lp/${pageId}`);
  }

  resultRedirect(pageId, result.message);
}
