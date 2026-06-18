"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  publishLandingPageFromEditorWithSlug,
  saveLandingPageDraftWithSlug,
} from "@/lib/data/landingPageStore";
import type {
  LandingPageContent,
  LandingPageContentSection,
  LandingPageContentSectionColumns,
  LandingPageContentSectionImageMode,
  LandingPageContentSectionLayout,
  LandingPageContentSectionType,
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
  "cards",
  "steps",
  "faq",
  "image_grid",
];

const sectionTypes: LandingPageContentSectionType[] = [
  "text",
  "image_text",
  "cards",
  "steps",
  "faq",
  "image_grid",
];

const sectionImageModes: LandingPageContentSectionImageMode[] = [
  "none",
  "optional",
  "required",
];

function fallbackTypeFromLayout(
  layout: LandingPageContentSectionLayout
): LandingPageContentSectionType {
  if (layout === "two_cards") return "cards";
  if (layout === "three_cards") return "steps";
  if (layout === "cards" || layout === "steps") return layout;
  return layout;
}

function fallbackColumnsFromLayout(
  layout: LandingPageContentSectionLayout
): LandingPageContentSectionColumns {
  if (layout === "two_cards") return 2;
  if (layout === "three_cards" || layout === "image_grid") return 3;
  return 1;
}

function readColumns(
  formData: FormData,
  index: number,
  fallback: LandingPageContentSectionColumns
): LandingPageContentSectionColumns {
  const parsed = Number(readIndexed(formData, "contentSectionColumns", index));
  return parsed === 1 || parsed === 2 || parsed === 3 || parsed === 4
    ? parsed
    : fallback;
}

function maxItemsForType(type: LandingPageContentSectionType) {
  if (type === "image_grid") return 12;
  if (type === "cards" || type === "steps" || type === "faq") return 8;
  return 1;
}

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
      const typeValue = readIndexed(formData, "contentSectionTypes", index);
      const type = sectionTypes.includes(typeValue as LandingPageContentSectionType)
        ? (typeValue as LandingPageContentSectionType)
        : fallbackTypeFromLayout(layout);
      const imageModeValue = readIndexed(
        formData,
        "contentSectionItemImageModes",
        index
      );
      const itemImageMode = sectionImageModes.includes(
        imageModeValue as LandingPageContentSectionImageMode
      )
        ? (imageModeValue as LandingPageContentSectionImageMode)
        : type === "text" || type === "faq"
          ? "none"
          : type === "steps" || type === "image_grid"
            ? "required"
            : "optional";
      const itemIds = formData
        .getAll(`contentSection${index}ItemIds`)
        .map((value) => String(value).trim());
      const titles = formData.getAll(`contentSection${index}ItemTitles`);
      const bodies = formData.getAll(`contentSection${index}ItemBodies`);
      const imageUrls = formData.getAll(`contentSection${index}ItemImageUrls`);
      const captions = formData.getAll(`contentSection${index}ItemCaptions`);
      const ctaTexts = formData.getAll(`contentSection${index}ItemCtaTexts`);
      const ctaUrls = formData.getAll(`contentSection${index}ItemCtaUrls`);
      const itemLength =
        itemIds.length > 0
          ? itemIds.length
          : Math.max(
              titles.length,
              bodies.length,
              imageUrls.length,
              captions.length,
              ctaTexts.length,
              ctaUrls.length
            );
      const items = Array.from({
        length: Math.min(itemLength, maxItemsForType(type)),
      }).map((__, itemIndex) => ({
        id: itemIds[itemIndex] || `item-${Date.now()}-${itemIndex + 1}`,
        title: String(titles[itemIndex] ?? "").trim(),
        body: String(bodies[itemIndex] ?? "").trim(),
        imageUrl: String(imageUrls[itemIndex] ?? "").trim(),
        caption: String(captions[itemIndex] ?? "").trim(),
        ctaText: String(ctaTexts[itemIndex] ?? "").trim(),
        ctaUrl: String(ctaUrls[itemIndex] ?? "").trim(),
      }));

      return {
        id:
          readIndexed(formData, "contentSectionIds", index) ||
          `section-${Date.now()}-${index + 1}`,
        name:
          readIndexed(formData, "contentSectionNames", index) ||
          readIndexed(formData, "contentSectionLabels", index),
        type,
        layout,
        label: readIndexed(formData, "contentSectionLabels", index),
        title: readIndexed(formData, "contentSectionTitles", index),
        subtitle: readIndexed(formData, "contentSectionSubtitles", index),
        columns: readColumns(formData, index, fallbackColumnsFromLayout(layout)),
        itemImageMode,
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
    name: section.name,
    type: section.type,
    layout: section.layout,
    label: section.label,
    title: section.title,
    subtitle: section.subtitle,
    columns: section.columns,
    itemImageMode: section.itemImageMode,
    order: section.order,
    items: section.items,
  }));
}

function parseEditorForm(formData: FormData): {
  title: string;
  slug: string;
  formId: string;
  content: LandingPageContent;
  imageAssets: LandingPageImageAssets;
  error: string | null;
} {
  const title = readString(formData, "title");
  const slug = readString(formData, "slug");
  const formId = readString(formData, "connectedFormId");
  const heroTitle = readString(formData, "heroTitle");
  const ctaText = readString(formData, "ctaText");

  if (!title) {
    return {
      title,
      slug,
      formId,
      content: {} as LandingPageContent,
      imageAssets: {} as LandingPageImageAssets,
      error: "請輸入頁面標題。",
    };
  }

  if (!heroTitle) {
    return {
      title,
      slug,
      formId,
      content: {} as LandingPageContent,
      imageAssets: {} as LandingPageImageAssets,
      error: "請輸入 Hero 標題。",
    };
  }

  if (!ctaText) {
    return {
      title,
      slug,
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

  return { title, slug, formId, content, imageAssets, error: null };
}

export async function saveLandingPageDraftAction(formData: FormData) {
  const pageId = String(formData.get("pageId") ?? "");
  const parsed = parseEditorForm(formData);

  if (parsed.error) resultRedirect(pageId, parsed.error);

  const result = await saveLandingPageDraftWithSlug(pageId, parsed.content, parsed.imageAssets, {
    title: parsed.title,
    slug: parsed.slug || undefined,
    formId: parsed.formId || undefined,
  });

  revalidatePath("/landing-pages");
  revalidatePath(`/landing-pages/${pageId}`);
  revalidatePath(`/lp/${pageId}`);
  if (result.ok && result.page?.slug && result.page.slug !== pageId) {
    revalidatePath(`/landing-pages/${result.page.slug}`);
    revalidatePath(`/lp/${result.page.slug}`);
  }

  resultRedirect(result.page?.slug ?? pageId, result.message);
}

export async function publishLandingPageAction(formData: FormData) {
  const pageId = String(formData.get("pageId") ?? "");
  const parsed = parseEditorForm(formData);

  if (parsed.error) resultRedirect(pageId, parsed.error);

  const result = await publishLandingPageFromEditorWithSlug(
    pageId,
    parsed.content,
    parsed.imageAssets,
    {
      title: parsed.title,
      slug: parsed.slug || undefined,
      formId: parsed.formId || undefined,
    }
  );

  revalidatePath("/landing-pages");
  revalidatePath(`/landing-pages/${pageId}`);

  if (result.ok) {
    revalidatePath(`/lp/${pageId}`);
    if (result.page?.slug && result.page.slug !== pageId) {
      revalidatePath(`/landing-pages/${result.page.slug}`);
      revalidatePath(`/lp/${result.page.slug}`);
    }
  }

  resultRedirect(result.page?.slug ?? pageId, result.message);
}
