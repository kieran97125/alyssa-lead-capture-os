"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  publishLandingPage,
  saveLandingPageDraft,
} from "@/lib/data/landingPageStore";
import type {
  LandingPageContent,
  LandingPageContentSection,
  LandingPageContentSectionLayout,
  LandingPageImageAssets,
} from "@/lib/data/landingPages";

function resultRedirect(pageId: string, message: string): never {
  redirect(`/landing-pages/${pageId}?builder_status=${encodeURIComponent(message)}`);
}

function readString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function readOptionalUrl(formData: FormData, key: string) {
  const value =
    formData
      .getAll(key)
      .map((item) => String(item ?? "").trim())
      .filter(Boolean)
      .at(-1) ?? "";
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
  const titles = formData
    .getAll(titleKey)
    .map((value) => String(value).trim());
  const bodies = formData
    .getAll(bodyKey)
    .map((value) => String(value).trim());
  const length = Math.max(titles.length, bodies.length);

  return Array.from({ length })
    .map((_, index) => ({
      [titleName]: titles[index] ?? "",
      [bodyName]: bodies[index] ?? "",
    }))
    .filter((item) => item[titleName] || item[bodyName]);
}

function readFixedPairedList(
  formData: FormData,
  titleKey: string,
  bodyKey: string,
  length: number
) {
  const titles = formData
    .getAll(titleKey)
    .map((value) => String(value).trim());
  const bodies = formData
    .getAll(bodyKey)
    .map((value) => String(value).trim());

  return Array.from({ length }).map((_, index) => ({
    title: titles[index] ?? "",
    body: bodies[index] ?? "",
  }));
}

const sectionLayouts: LandingPageContentSectionLayout[] = [
  "text",
  "image_text",
  "two_cards",
  "three_cards",
  "faq",
  "image_grid",
];

function readIndexed(formData: FormData, key: string, index: number) {
  return String(formData.getAll(key)[index] ?? "").trim();
}

function readContentSections(formData: FormData): LandingPageContentSection[] {
  const ids = formData.getAll("contentSectionIds");
  const enabledValues = formData.getAll("contentSectionEnabled");
  const sections = ids
    .map((_, index) => {
      const isEnabled =
        String(formData.get(`contentSectionEnabled${index}`) ?? "") === "true" ||
        String(enabledValues[index] ?? "") === "true";
      if (!isEnabled) return null;

      const layoutValue = readIndexed(formData, "contentSectionLayouts", index);
      const layout = sectionLayouts.includes(
        layoutValue as LandingPageContentSectionLayout
      )
        ? (layoutValue as LandingPageContentSectionLayout)
        : "text";
      const items = Array.from({ length: 6 })
        .map((__, itemIndex) => ({
          title: readIndexed(
            formData,
            `contentSection${index}ItemTitles`,
            itemIndex
          ),
          body: readIndexed(
            formData,
            `contentSection${index}ItemBodies`,
            itemIndex
          ),
          imageUrl: readIndexed(
            formData,
            `contentSection${index}ItemImageUrls`,
            itemIndex
          ),
          ctaText: readIndexed(
            formData,
            `contentSection${index}ItemCtaTexts`,
            itemIndex
          ),
          ctaUrl: readIndexed(
            formData,
            `contentSection${index}ItemCtaUrls`,
            itemIndex
          ),
        }))
        .filter(
          (item) =>
            item.title ||
            item.body ||
            item.imageUrl ||
            item.ctaText ||
            item.ctaUrl
        );

      return {
        id:
          readIndexed(formData, "contentSectionIds", index) ||
          `section-${Date.now()}-${index + 1}`,
        type: "content" as const,
        layout,
        label: readIndexed(formData, "contentSectionLabels", index),
        title: readIndexed(formData, "contentSectionTitles", index),
        subtitle: readIndexed(formData, "contentSectionSubtitles", index),
        order: Number(readIndexed(formData, "contentSectionOrders", index)) || index + 1,
        items,
      };
    })
    .filter((section): section is LandingPageContentSection & { order: number } =>
      Boolean(section)
    )
    .sort((a, b) => a.order - b.order)
    .slice(0, 8);

  return sections.map((section) => ({
    id: section.id,
    type: section.type,
    layout: section.layout,
    label: section.label,
    title: section.title,
    subtitle: section.subtitle,
    items: section.items,
  }));
}

function parseEditorForm(formData: FormData): {
  title: string;
  formId: string;
  content: LandingPageContent;
  imageAssets: LandingPageImageAssets;
  error: string | null;
} {
  const title = readString(formData, "title");
  const formId = readString(formData, "connectedFormId");
  const heroTitle = readString(formData, "heroTitle");
  const ctaText = readString(formData, "ctaText");

  if (!title) {
    return {
      title,
      formId,
      content: {} as LandingPageContent,
      imageAssets: {} as LandingPageImageAssets,
      error: "請輸入頁面標題。",
    };
  }

  if (!heroTitle) {
    return {
      title,
      formId,
      content: {} as LandingPageContent,
      imageAssets: {} as LandingPageImageAssets,
      error: "請輸入 Hero 標題。",
    };
  }

  if (!ctaText) {
    return {
      title,
      formId,
      content: {} as LandingPageContent,
      imageAssets: {} as LandingPageImageAssets,
      error: "請輸入 CTA 按鈕文字。",
    };
  }

  const content: LandingPageContent = {
    templateName: readString(formData, "templateName") || "offer-landing-page",
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
    processSteps: readFixedPairedList(
      formData,
      "processStepTitles",
      "processStepBodies",
      6
    ) as Array<{ title: string; body: string }>,
    contentSections: readContentSections(formData),
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
    processImage4Url: readOptionalUrl(formData, "processImage4Url"),
    processImage5Url: readOptionalUrl(formData, "processImage5Url"),
    processImage6Url: readOptionalUrl(formData, "processImage6Url"),
    trustImageUrl: readOptionalUrl(formData, "trustImageUrl"),
  };

  return { title, formId, content, imageAssets, error: null };
}

export async function saveLandingPageDraftAction(formData: FormData) {
  const pageId = String(formData.get("pageId") ?? "");
  const parsed = parseEditorForm(formData);

  if (parsed.error) resultRedirect(pageId, parsed.error);

  const result = await saveLandingPageDraft(pageId, parsed.content, parsed.imageAssets, {
    title: parsed.title,
    formId: parsed.formId || undefined,
  });

  revalidatePath("/landing-pages");
  revalidatePath(`/landing-pages/${pageId}`);
  revalidatePath(`/lp/${pageId}`);

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
