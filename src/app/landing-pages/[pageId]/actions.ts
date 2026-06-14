"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  publishLandingPage,
  saveLandingPageDraft,
} from "@/lib/data/landingPageStore";
import type {
  LandingPageContent,
  LandingPageImageAssets,
} from "@/lib/data/landingPages";

function resultRedirect(pageId: string, message: string): never {
  redirect(`/landing-pages/${pageId}?builder_status=${encodeURIComponent(message)}`);
}

function readString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function readOptionalUrl(formData: FormData, key: string) {
  const value = readString(formData, key);
  if (!value) return "";

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? value : "";
  } catch {
    return "";
  }
}

function readStringList(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((value) => String(value).trim())
    .filter(Boolean);
}

function readPairedList(
  formData: FormData,
  titleKey: string,
  bodyKey: string,
  titleName = "title",
  bodyName = "body"
) {
  const titles = readStringList(formData, titleKey);
  const bodies = readStringList(formData, bodyKey);
  const length = Math.max(titles.length, bodies.length);

  return Array.from({ length })
    .map((_, index) => ({
      [titleName]: titles[index] ?? "",
      [bodyName]: bodies[index] ?? "",
    }))
    .filter((item) => item[titleName] || item[bodyName]);
}

function parseEditorForm(formData: FormData): {
  title: string;
  content: LandingPageContent;
  imageAssets: LandingPageImageAssets;
  error: string | null;
} {
  const title = readString(formData, "title");
  const heroTitle = readString(formData, "heroTitle");
  const ctaText = readString(formData, "ctaText");

  if (!title) {
    return {
      title,
      content: {} as LandingPageContent,
      imageAssets: {} as LandingPageImageAssets,
      error: "Page title is required.",
    };
  }

  if (!heroTitle) {
    return {
      title,
      content: {} as LandingPageContent,
      imageAssets: {} as LandingPageImageAssets,
      error: "Hero title is required.",
    };
  }

  if (!ctaText) {
    return {
      title,
      content: {} as LandingPageContent,
      imageAssets: {} as LandingPageImageAssets,
      error: "CTA text is required.",
    };
  }

  const content: LandingPageContent = {
    templateName: readString(formData, "templateName") || "Premium offer landing page",
    testingStatus:
      readString(formData, "testingStatus") === "foundation"
        ? "foundation"
        : "ready_for_testing",
    heroTitle,
    heroSubtitle: readString(formData, "heroSubtitle"),
    offerBadge: readString(formData, "offerBadge"),
    offerHeadline: readString(formData, "offerHeadline"),
    offerBody: readString(formData, "offerBody"),
    ctaText,
    secondaryCtaText: readString(formData, "secondaryCtaText"),
    painPoints: readStringList(formData, "painPoints"),
    benefits: readStringList(formData, "benefits"),
    trustItems: readStringList(formData, "trustItems"),
    sections: readPairedList(formData, "sectionTitles", "sectionBodies") as Array<{
      title: string;
      body: string;
    }>,
    processSteps: readPairedList(
      formData,
      "processStepTitles",
      "processStepBodies"
    ) as Array<{ title: string; body: string }>,
    faqs: readPairedList(
      formData,
      "faqQuestions",
      "faqAnswers",
      "question",
      "answer"
    ) as Array<{ question: string; answer: string }>,
  };

  const imageAssets: LandingPageImageAssets = {
    heroImageUrl: readOptionalUrl(formData, "heroImageUrl"),
    mobileHeroImageUrl: readOptionalUrl(formData, "mobileHeroImageUrl"),
    offerImageUrl: readOptionalUrl(formData, "offerImageUrl"),
    treatmentImageUrl: readOptionalUrl(formData, "treatmentImageUrl"),
    processImage1Url: readOptionalUrl(formData, "processImage1Url"),
    processImage2Url: readOptionalUrl(formData, "processImage2Url"),
    processImage3Url: readOptionalUrl(formData, "processImage3Url"),
    trustImageUrl: readOptionalUrl(formData, "trustImageUrl"),
  };

  return { title, content, imageAssets, error: null };
}

export async function saveLandingPageDraftAction(formData: FormData) {
  const pageId = String(formData.get("pageId") ?? "");
  const parsed = parseEditorForm(formData);

  if (parsed.error) resultRedirect(pageId, parsed.error);

  const result = await saveLandingPageDraft(pageId, parsed.content, parsed.imageAssets, {
    title: parsed.title,
  });

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
