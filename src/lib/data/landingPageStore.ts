import { prepareManagedFormPayload, type ManagedFormInput } from "@/lib/data/formManagement";
import {
  alyssaLandingPages,
  defaultLandingPageContent,
  getLandingPageById as getLocalLandingPageById,
  getLandingPageBySlug as getLocalLandingPageBySlug,
  normalizeLandingPageContentSections,
  type LandingPageConfig,
  type LandingPageContent,
  type LandingPageContentSection,
  type LandingPageContentSectionItem,
  type LandingPageContentSectionColumns,
  type LandingPageContentSectionImageMode,
  type LandingPageContentSectionLayout,
  type LandingPageContentSectionType,
  type LandingPageImageAssets,
  type LandingPageMode,
  type LandingPageStatus,
} from "@/lib/data/landingPages";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";
import {
  canAccessInternalBrand,
  getCurrentInternalAccess,
  requireModuleAccess,
} from "@/lib/security/internalAccessServer";

async function canUseLandingPageBrand(brandId: string | null | undefined) {
  const access = await getCurrentInternalAccess();
  if (access.source === "unauthenticated") return false;
  if (access.source !== "supabase_auth") return true;
  return Boolean(brandId && canAccessInternalBrand(access, brandId));
}

type LandingPageRow = {
  id: string;
  slug: string;
  title: string;
  brand_id: string | null;
  treatment_id: string | null;
  package_id: string | null;
  branch_id: string | null;
  form_id: string | null;
  template_key: string;
  mode: LandingPageMode;
  status: LandingPageStatus;
  content_json: Record<string, unknown> | null;
  image_assets_json: Record<string, unknown> | null;
  published_version_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  revision: number;
};

type LandingPageVersionRow = {
  id: string;
  page_id: string;
  version_number: number;
  status: "draft" | "published" | "archived";
  content_json: Record<string, unknown> | null;
  image_assets_json: Record<string, unknown> | null;
  created_at: string;
  metadata_json?: Record<string, unknown> | null;
  page_revision?: number | null;
};

export type LandingPageEditorData = {
  page: LandingPageConfig;
  source: "supabase" | "local_config";
  loadedFrom: LandingPageLoadSource;
  canPersist: boolean;
  statusMessage: string;
  latestDraftVersionNumber: number | null;
  publishedVersionNumber: number | null;
  pageRecordId: string | null;
  versionId: string | null;
  versionCreatedAt: string | null;
  revision: number;
  publishedSlug: string | null;
};

export type LandingPageMutationResult = {
  ok: boolean;
  source: "supabase" | "local_config";
  message: string;
  page?: LandingPageConfig;
  versionNumber?: number;
  pageRecordId?: string;
  versionId?: string;
  revision?: number;
  previousPublishedSlug?: string | null;
};

export type LandingPageDraftMeta = {
  title?: string;
  slug?: string;
  formId?: string;
  expectedRevision?: number;
  requestId?: string;
};

export type CreateLandingPageDraftInput = {
  title: string;
  brandId: string;
  treatmentId: string;
  packageId: string;
  branchId: string;
  formId: string;
  heroTitle: string;
  heroSubtitle: string;
  offerBadge: string;
  ctaText: string;
  requestId?: string;
};

export class LandingPageReadError extends Error {
  constructor() { super("暫時未能讀取廣告頁，請重新載入。"); this.name = "LandingPageReadError"; }
}

function isLandingPageFixtureMode() {
  return process.env.ALYSSA_E2E_FIXTURES === "1";
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type LandingPageLoadSource = "draft" | "published" | "row" | "seed";

const publicLandingPageSlugAliases = {
  "alyssa-388-13e933": "ineffable-388-13e933",
  "alyssa-388-488b24": "ineffable-388-488b24",
} as const;

export function getCanonicalLandingPageSlug(slug: string) {
  return (
    publicLandingPageSlugAliases[
      slug as keyof typeof publicLandingPageSlugAliases
    ] ?? slug
  );
}

function getLandingPageLookupSlugs(slug: string) {
  const canonicalSlug = getCanonicalLandingPageSlug(slug);
  const legacySlugs = Object.entries(publicLandingPageSlugAliases)
    .filter(([, target]) => target === canonicalSlug)
    .map(([source]) => source);

  return Array.from(new Set([canonicalSlug, slug, ...legacySlugs]));
}

function pickLandingPageRowBySlug(rows: LandingPageRow[], slug: string) {
  const lookupSlugs = getLandingPageLookupSlugs(slug);
  return (
    lookupSlugs
      .map((candidate) => rows.find((row) => row.slug === candidate))
      .find(Boolean) ?? null
  );
}

function normalizeIneffableAliasText(value: string, slug: string) {
  if (!isIneffableLandingPageSlug(slug)) {
    return value;
  }

  return value.replace(/\bAlyssa\b/g, "Ineffable Beauty");
}

export function isIneffableLandingPageSlug(slug: string) {
  const canonicalSlug = getCanonicalLandingPageSlug(slug);
  return (
    canonicalSlug.startsWith("ineffable-") ||
    canonicalSlug.startsWith("ineffable-beauty-")
  );
}

function normalizeIneffableAliasStringArray(values: string[], slug: string) {
  return values.map((value) => normalizeIneffableAliasText(value, slug));
}

function normalizeIneffableAliasPairs<T extends Record<string, string>>(
  values: T[],
  slug: string
) {
  return values.map((item) =>
    Object.fromEntries(
      Object.entries(item).map(([key, value]) => [
        key,
        normalizeIneffableAliasText(value, slug),
      ])
    ) as T
  );
}

function normalizeIneffableAliasContentSections(
  sections: LandingPageContentSection[],
  slug: string
) {
  return sections.map((section) => ({
    ...section,
    name: normalizeIneffableAliasText(section.name, slug),
    label: normalizeIneffableAliasText(section.label, slug),
    title: normalizeIneffableAliasText(section.title, slug),
    subtitle: normalizeIneffableAliasText(section.subtitle, slug),
    items: section.items.map((item) => ({
      ...item,
      title: normalizeIneffableAliasText(item.title, slug),
      body: normalizeIneffableAliasText(item.body, slug),
      caption: normalizeIneffableAliasText(item.caption, slug),
      ctaText: normalizeIneffableAliasText(item.ctaText, slug),
    })),
  }));
}

const knownDefaultTextReplacements = new Map<string, string>([
  ["Premium offer landing page", "高質感優惠 Landing Page"],
  ["HKD 388 First-Visit Trial", "HK$388 首次體驗優惠"],
  ["HK$388 First-Visit Trial", "HK$388 首次體驗優惠"],
  ["First-visit medical beauty trial", "首次醫學美容體驗"],
  [
    "A premium Alyssa campaign page for testing the HK$388 first-visit trial offer while keeping the same lead attribution and booking flow.",
    defaultLandingPageContent.heroSubtitle,
  ],
  ["First-visit trial offer from HK$388", "首次體驗優惠 HK$388"],
  [
    "A focused campaign offer for clients who want a consultation, treatment recommendation, and WhatsApp booking follow-up without replacing the main Wix website.",
    defaultLandingPageContent.offerBody,
  ],
  ["Book the trial offer", defaultLandingPageContent.ctaText],
  ["View treatment details", defaultLandingPageContent.secondaryCtaText],
  [
    "Customers want a clear trust-first offer before committing.",
    defaultLandingPageContent.painPoints[0],
  ],
  [
    "Marketing needs a faster way to test offer angles outside the main Wix site.",
    defaultLandingPageContent.painPoints[1],
  ],
  [
    "Operations need every campaign lead to keep source and booking context.",
    defaultLandingPageContent.painPoints[2],
  ],
  ["HK$388 first-visit trial offer.", "HK$388 首次體驗優惠。"],
  [
    "UTM and click ID attribution are captured with the lead.",
    "登記會同時記錄 UTM 及 click ID，方便分析廣告成效。",
  ],
  [
    "Booking request can later be followed up from the future WhatsApp CRM.",
    "團隊可按登記資料以 WhatsApp 跟進預約。",
  ],
  [
    "Designed for Alyssa medical beauty campaign testing.",
    "適合醫學美容 Campaign 測試。",
  ],
  [
    "Uses the shared lead base for future paid / show / lost outcome write-back.",
    "保留來源資料，方便日後回寫成交及到店結果。",
  ],
  [
    "Wix remains the main website; this page is a campaign testing layer.",
    "Wix 仍然是主網站；此頁用作 Campaign 測試。",
  ],
  ["Built for fast campaign testing", "適合快速測試 Campaign"],
  [
    "Still connected to form-only mode",
    "同一張表格可用於 Wix 或 Landing Page",
  ],
  ["CRM-ready attribution", "保留來源資料，方便之後接駁 CRM"],
]);

function asString(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function localizeKnownDefaultText(value: string) {
  return knownDefaultTextReplacements.get(value) ?? value;
}

function localizedString(value: unknown, fallback: string) {
  return localizeKnownDefaultText(asString(value, fallback));
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);

  return slug || "campaign";
}

export function buildLandingPageSlugBase(title: string, brandSlug: string) {
  const selectedBrandSlug = slugify(brandSlug)
    .replace(/^alyssa-ineffable-beauty$/, "ineffable-beauty")
    .replace(/^alyssa-ineffable$/, "ineffable");
  const brandPrefix = selectedBrandSlug || "campaign";
  const alternateBrandPrefix =
    brandPrefix === "ineffable-beauty" ? "ineffable" : "";
  let pageSlug = slugify(title);

  [brandPrefix, alternateBrandPrefix]
    .filter(Boolean)
    .forEach((prefix) => {
      if (pageSlug === prefix) pageSlug = "";
      if (pageSlug.startsWith(`${prefix}-`)) {
        pageSlug = pageSlug.slice(prefix.length + 1);
      }
    });

  if (brandPrefix.startsWith("ineffable")) {
    pageSlug = pageSlug
      .replace(/^alyssa-ineffable-beauty-/, "")
      .replace(/^alyssa-ineffable-/, "")
      .replace(/^alyssa-/, "");
  }

  const descriptor = pageSlug || "campaign";
  const base = `${brandPrefix}-${descriptor}`;

  return base
    .replace(/^alyssa-ineffable-beauty-/, "ineffable-beauty-")
    .replace(/^alyssa-ineffable-/, "ineffable-");
}

function normalizeEditableLandingPageSlug(value: string | undefined, fallback: string) {
  return getCanonicalLandingPageSlug((value || fallback).trim().toLowerCase());
}

function asStringArray(value: unknown, fallback: string[]) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map(localizeKnownDefaultText)
    : fallback.map(localizeKnownDefaultText);
}

function asObjectArray<T extends Record<string, string>>(
  value: unknown,
  fallback: T[],
  keys: Array<keyof T>
) {
  if (!Array.isArray(value)) return fallback;

  const items = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const mapped = Object.fromEntries(
        keys.map((key) => [key, localizedString(record[key as string], "")])
      ) as T;

      return keys.every((key) => mapped[key]) ? mapped : null;
    })
    .filter((item): item is T => Boolean(item));

  return items;
}

function asFixedObjectArray<T extends Record<string, string>>(
  value: unknown,
  fallback: T[],
  keys: Array<keyof T>,
  length: number
) {
  if (!Array.isArray(value)) return fallback;

  return Array.from({ length }).map((_, index) => {
    const item = value[index];
    const record =
      item && typeof item === "object" ? (item as Record<string, unknown>) : {};

    return Object.fromEntries(
      keys.map((key) => [key, localizedString(record[key as string], "")])
    ) as T;
  });
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

function asSectionColumns(
  value: unknown,
  fallback: LandingPageContentSectionColumns
): LandingPageContentSectionColumns {
  const parsed = Number(value);
  return parsed === 1 || parsed === 2 || parsed === 3 || parsed === 4
    ? parsed
    : fallback;
}

function columnsForLayout(
  layout: LandingPageContentSectionLayout
): LandingPageContentSectionColumns {
  if (layout === "two_cards") return 2;
  if (layout === "three_cards" || layout === "image_grid") return 3;
  return 1;
}

function asContentSectionItems(value: unknown): LandingPageContentSectionItem[] {
  if (!Array.isArray(value)) return [];

  return value.slice(0, 12).map((item, index) => {
    const record =
      item && typeof item === "object" ? (item as Record<string, unknown>) : {};

    return {
      id: asString(record.id, `item-${index + 1}`),
      title: localizedString(record.title, ""),
      body: localizedString(record.body, ""),
      imageUrl: asString(record.imageUrl, ""),
      caption: localizedString(record.caption, ""),
      ctaText: localizedString(record.ctaText, ""),
      ctaUrl: asString(record.ctaUrl, ""),
    };
  });
}

function asContentSections(
  value: unknown,
  fallback: LandingPageContentSection[]
): LandingPageContentSection[] {
  if (!Array.isArray(value)) return fallback;

  return value.slice(0, 8).map((item, index) => {
    const record =
      item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const layout = sectionLayouts.includes(
      record.layout as LandingPageContentSectionLayout
    )
      ? (record.layout as LandingPageContentSectionLayout)
      : "text";
    const type = sectionTypes.includes(record.type as LandingPageContentSectionType)
      ? (record.type as LandingPageContentSectionType)
      : layout === "two_cards"
        ? "cards"
        : layout === "three_cards"
          ? "steps"
          : layout === "cards" || layout === "steps"
            ? layout
            : layout;
    const itemImageMode = sectionImageModes.includes(
      record.itemImageMode as LandingPageContentSectionImageMode
    )
      ? (record.itemImageMode as LandingPageContentSectionImageMode)
      : type === "text" || type === "faq"
        ? "none"
        : type === "steps" || type === "image_grid"
          ? "required"
          : "optional";

    return {
      id: asString(record.id, `section-${index + 1}`),
      name: localizedString(record.name, localizedString(record.label, "")),
      type,
      layout,
      label: localizedString(record.label, ""),
      title: localizedString(record.title, ""),
      subtitle: localizedString(record.subtitle, ""),
      columns: asSectionColumns(record.columns, columnsForLayout(layout)),
      itemImageMode,
      order: Number(record.order) || index + 1,
      items: asContentSectionItems(record.items),
    };
  }).map((section) => normalizeLandingPageContentSections([section])[0] ?? section);
}

export function getLandingPageContent(page: LandingPageConfig): LandingPageContent {
  return {
    templateName: page.templateName,
    testingStatus: page.testingStatus,
    heroTitle: page.heroTitle,
    heroSubtitle: page.heroSubtitle,
    offerBadge: page.offerBadge,
    offerHeadline: page.offerHeadline,
    offerBody: page.offerBody,
    ctaText: page.ctaText,
    secondaryCtaText: page.secondaryCtaText,
    painPoints: page.painPoints,
    benefits: page.benefits,
    trustItems: page.trustItems,
    sections: page.sections,
    processSteps: page.processSteps,
    contentSections: page.contentSections,
    faqs: page.faqs,
  };
}

export function getLandingPageImageAssets(
  page: LandingPageConfig
): LandingPageImageAssets {
  return {
    heroImageUrl: page.heroImageUrl,
    mobileHeroImageUrl: page.mobileHeroImageUrl,
    offerImageUrl: page.offerImageUrl,
    treatmentImageUrl: page.treatmentImageUrl,
    processImage1Url: page.processImage1Url,
    processImage2Url: page.processImage2Url,
    processImage3Url: page.processImage3Url,
    processImage4Url: page.processImage4Url,
    processImage5Url: page.processImage5Url,
    processImage6Url: page.processImage6Url,
    trustImageUrl: page.trustImageUrl,
  };
}

function mergeContent(
  fallback: LandingPageConfig,
  content: Record<string, unknown> | null
) {
  return {
    templateName: localizedString(content?.templateName, fallback.templateName),
    testingStatus:
      content?.testingStatus === "foundation" ||
      content?.testingStatus === "ready_for_testing"
        ? content.testingStatus
        : fallback.testingStatus,
    heroTitle: localizedString(content?.heroTitle, fallback.heroTitle),
    heroSubtitle: localizedString(content?.heroSubtitle, fallback.heroSubtitle),
    offerBadge: localizedString(content?.offerBadge, fallback.offerBadge),
    offerHeadline: localizedString(content?.offerHeadline, fallback.offerHeadline),
    offerBody: localizedString(content?.offerBody, fallback.offerBody),
    ctaText: localizedString(content?.ctaText, fallback.ctaText),
    secondaryCtaText: localizedString(
      content?.secondaryCtaText,
      fallback.secondaryCtaText
    ),
    painPoints: asStringArray(content?.painPoints, fallback.painPoints),
    benefits: asStringArray(content?.benefits, fallback.benefits),
    trustItems: asStringArray(content?.trustItems, fallback.trustItems),
    sections: asObjectArray(content?.sections, fallback.sections, [
      "title",
      "body",
    ]),
    processSteps: asFixedObjectArray(
      content?.processSteps,
      fallback.processSteps,
      ["title", "body"],
      6
    ),
    contentSections: asContentSections(
      content?.contentSections,
      fallback.contentSections
    ),
    faqs: asObjectArray(content?.faqs, fallback.faqs, ["question", "answer"]),
  };
}

function mergeImageAssets(
  fallback: LandingPageConfig,
  imageAssets: Record<string, unknown> | null
) {
  return {
    heroImageUrl: asString(imageAssets?.heroImageUrl, fallback.heroImageUrl),
    mobileHeroImageUrl: asString(
      imageAssets?.mobileHeroImageUrl,
      fallback.mobileHeroImageUrl
    ),
    offerImageUrl: asString(imageAssets?.offerImageUrl, fallback.offerImageUrl),
    treatmentImageUrl: asString(
      imageAssets?.treatmentImageUrl,
      fallback.treatmentImageUrl
    ),
    processImage1Url: asString(
      imageAssets?.processImage1Url,
      fallback.processImage1Url
    ),
    processImage2Url: asString(
      imageAssets?.processImage2Url,
      fallback.processImage2Url
    ),
    processImage3Url: asString(
      imageAssets?.processImage3Url,
      fallback.processImage3Url
    ),
    processImage4Url: asString(
      imageAssets?.processImage4Url,
      fallback.processImage4Url
    ),
    processImage5Url: asString(
      imageAssets?.processImage5Url,
      fallback.processImage5Url
    ),
    processImage6Url: asString(
      imageAssets?.processImage6Url,
      fallback.processImage6Url
    ),
    trustImageUrl: asString(imageAssets?.trustImageUrl, fallback.trustImageUrl),
  };
}

function publicContentFallback(fallback: LandingPageConfig): LandingPageConfig {
  return {
    ...fallback,
    templateName: "",
    heroTitle: "",
    heroSubtitle: "",
    offerBadge: "",
    offerHeadline: "",
    offerBody: "",
    ctaText: "",
    secondaryCtaText: "",
    painPoints: [],
    benefits: [],
    trustItems: [],
    sections: [],
    processSteps: [],
    contentSections: [],
    faqs: [],
  };
}

function blankImageFallback(fallback: LandingPageConfig): LandingPageConfig {
  return {
    ...fallback,
    heroImageUrl: "",
    mobileHeroImageUrl: "",
    offerImageUrl: "",
    treatmentImageUrl: "",
    processImage1Url: "",
    processImage2Url: "",
    processImage3Url: "",
    processImage4Url: "",
    processImage5Url: "",
    processImage6Url: "",
    trustImageUrl: "",
  };
}

function hasOwnContentSections(content: Record<string, unknown> | null | undefined) {
  return Boolean(
    content &&
      Object.prototype.hasOwnProperty.call(content, "contentSections") &&
      Array.isArray(content.contentSections)
  );
}

function rowToConfig(
  row: LandingPageRow,
  version?: LandingPageVersionRow | null
): LandingPageConfig {
  const originalRow = row;
  const snapshot = version?.metadata_json;
  if (snapshot && typeof snapshot === "object" && typeof snapshot.slug === "string") {
    const textOrNull = (key: string, fallback: string | null) =>
      typeof snapshot[key] === "string" ? snapshot[key] as string : snapshot[key] === null ? null : fallback;
    row = {
      ...row,
      slug: textOrNull("slug", row.slug) || row.slug,
      title: textOrNull("title", row.title) || row.title,
      brand_id: textOrNull("brand_id", row.brand_id),
      treatment_id: textOrNull("treatment_id", row.treatment_id),
      package_id: textOrNull("package_id", row.package_id),
      branch_id: textOrNull("branch_id", row.branch_id),
      form_id: textOrNull("form_id", row.form_id),
      template_key: textOrNull("template_key", row.template_key) || row.template_key,
      mode: snapshot.mode === "form_only" ? "form_only" : snapshot.mode === "landing_page" ? "landing_page" : row.mode,
    };
  }
  const canonicalSlug = getCanonicalLandingPageSlug(row.slug);
  const fallback =
    getLocalLandingPageBySlug(canonicalSlug) ??
    getLocalLandingPageById(canonicalSlug) ??
    getLocalLandingPageBySlug(row.slug) ??
    getLocalLandingPageById(row.slug) ??
    alyssaLandingPages[0];

  const contentSource = version?.content_json ?? row.content_json;
  const imageSource = version?.image_assets_json ?? row.image_assets_json;
  const contentFallback = publicContentFallback(fallback);
  const content = mergeContent(
    contentFallback,
    contentSource
  );
  const images = mergeImageAssets(
    blankImageFallback(fallback),
    imageSource
  );

  return {
    ...fallback,
    ...content,
    ...images,
    id: originalRow.id,
    slug: canonicalSlug,
    revision: Number(originalRow.revision || 1),
    publishedSlug: originalRow.published_version_id ? getCanonicalLandingPageSlug(originalRow.slug) : null,
    title: normalizeIneffableAliasText(
      localizeKnownDefaultText(row.title),
      canonicalSlug
    ),
    heroTitle: normalizeIneffableAliasText(content.heroTitle, canonicalSlug),
    heroSubtitle: normalizeIneffableAliasText(content.heroSubtitle, canonicalSlug),
    offerBadge: normalizeIneffableAliasText(content.offerBadge, canonicalSlug),
    offerHeadline: normalizeIneffableAliasText(content.offerHeadline, canonicalSlug),
    offerBody: normalizeIneffableAliasText(content.offerBody, canonicalSlug),
    ctaText: normalizeIneffableAliasText(content.ctaText, canonicalSlug),
    secondaryCtaText: normalizeIneffableAliasText(
      content.secondaryCtaText,
      canonicalSlug
    ),
    brandId: row.brand_id || "",
    treatmentId: row.treatment_id || "",
    packageId: row.package_id || "",
    branchId: row.branch_id || "",
    formId: row.form_id || "",
    formToken: "",
    mode: row.mode,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    latestVersionNumber: version?.version_number ?? null,
    builderSource: "supabase",
    painPoints: normalizeIneffableAliasStringArray(content.painPoints, canonicalSlug),
    benefits: normalizeIneffableAliasStringArray(content.benefits, canonicalSlug),
    trustItems: normalizeIneffableAliasStringArray(content.trustItems, canonicalSlug),
    sections: normalizeIneffableAliasPairs(content.sections, canonicalSlug),
    processSteps: normalizeIneffableAliasPairs(
      content.processSteps,
      canonicalSlug
    ),
    contentSections: normalizeIneffableAliasContentSections(
      content.contentSections,
      canonicalSlug
    ),
    faqs: normalizeIneffableAliasPairs(content.faqs, canonicalSlug),
    contentSectionsExplicit: hasOwnContentSections(contentSource),
  };
}

async function findLandingPageRow(pageId: string) {
  if (!hasSupabaseAdminEnv() || isLandingPageFixtureMode()) return null;

  const supabase = createSupabaseAdminClient();
  if (uuidPattern.test(pageId)) {
    const { data, error } = await supabase
      .from("landing_pages")
      .select("*")
      .eq("id", pageId)
      .maybeSingle<LandingPageRow>();

    if (error) {
      console.warn("landing_pages lookup failed", {
        code: error.code,
        message: error.message,
      });
      throw new LandingPageReadError();
    }

    return data;
  }

  const lookupSlugs = getLandingPageLookupSlugs(pageId);
  const { data, error } = await supabase
    .from("landing_pages")
    .select("*")
    .in("slug", lookupSlugs);

  if (error) {
    console.warn("landing_pages lookup failed", {
      code: error.code,
      message: error.message,
    });
    throw new LandingPageReadError();
  }

  return pickLandingPageRowBySlug((data ?? []) as LandingPageRow[], pageId);
}

async function getVersionById(versionId: string | null) {
  if (!versionId || !hasSupabaseAdminEnv()) return null;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("landing_page_versions")
    .select("*")
    .eq("id", versionId)
    .maybeSingle<LandingPageVersionRow>();

  if (error) {
    console.warn("landing_page_versions published lookup failed", {
      code: error.code,
      message: error.message,
    });
    throw new LandingPageReadError();
  }

  return data;
}

async function getLatestVersion(pageId: string, status?: "draft" | "published") {
  if (!hasSupabaseAdminEnv()) return null;

  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("landing_page_versions")
    .select("*")
    .eq("page_id", pageId)
    .order("version_number", { ascending: false })
    .limit(1);

  if (status) query = query.eq("status", status);

  const { data, error } = await query;

  if (error) {
    console.warn("landing_page_versions latest lookup failed", {
      code: error.code,
      message: error.message,
    });
    throw new LandingPageReadError();
  }

  return (data?.[0] as LandingPageVersionRow | undefined) ?? null;
}

async function getPublishedVersionForRow(row: LandingPageRow) {
  if (!row.published_version_id) return null;
  const version = await getVersionById(row.published_version_id);
  return version?.status === "published" && version.page_id === row.id ? version : null;
}

function collectContentText(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectContentText);
  if (!value || typeof value !== "object") return [];

  return Object.values(value as Record<string, unknown>).flatMap(collectContentText);
}

const internalPublicCopyFragments = [
  "A premium Alyssa campaign page",
  "Built for fast campaign testing",
  "Still connected to form-only mode",
  "CRM-ready attribution",
  "Wix remains the main website",
  "campaign testing layer",
  "future WhatsApp CRM",
  "shared lead base",
  "source snapshot",
  "DB-backed",
  "Supabase",
  "schema",
  "適合快速測試 Campaign",
  "同一張表格可用於 Wix 或 Landing Page",
  "保留來源資料，方便之後接駁 CRM",
];

function hasInternalPublicCopy(content: Record<string, unknown> | null) {
  const text = collectContentText(content).join("\n").toLowerCase();

  return internalPublicCopyFragments.some((fragment) =>
    text.includes(fragment.toLowerCase())
  );
}

function localLandingPage(id: string) {
  if (!isLandingPageFixtureMode()) return null;
  const canonical = getCanonicalLandingPageSlug(id);
  const page = getLocalLandingPageById(canonical) ?? getLocalLandingPageBySlug(canonical) ??
    getLocalLandingPageById(id) ?? getLocalLandingPageBySlug(id);
  return page ? { ...page, builderSource: "local_config" as const, contentSectionsExplicit: false } : null;
}

async function latestEditorVersion(row: LandingPageRow) {
  const latest = await getLatestVersion(row.id);
  return latest ?? await getPublishedVersionForRow(row);
}

export async function getLandingPageBySlug(slug: string) {
  if (isLandingPageFixtureMode()) return localLandingPage(slug);
  if (!hasSupabaseAdminEnv()) throw new LandingPageReadError();
  const row = await findLandingPageRow(slug);
  if (!row || !await canUseLandingPageBrand(row.brand_id)) return null;
  return rowToConfig(row, await latestEditorVersion(row));
}

export async function getLandingPageById(id: string) {
  return getLandingPageBySlug(id);
}

export async function getPublishedLandingPageBySlug(slug: string) {
  if (isLandingPageFixtureMode()) {
    const page = localLandingPage(slug);
    return page?.status === "published" ? page : null;
  }
  if (!hasSupabaseAdminEnv()) throw new LandingPageReadError();
  const { data, error } = await createSupabaseAdminClient().from("landing_pages")
    .select("*").in("slug", getLandingPageLookupSlugs(slug)).eq("status", "published");
  if (error) throw new LandingPageReadError();
  const row = pickLandingPageRowBySlug((data ?? []) as LandingPageRow[], slug);
  if (!row) return null;
  const version = await getPublishedVersionForRow(row);
  if (!version) return null;
  return rowToConfig(row, version);
}

export async function getLandingPageEditorState(pageId: string): Promise<LandingPageEditorData | null> {
  if (isLandingPageFixtureMode()) {
    const page = localLandingPage(pageId);
    if (!page || !await canUseLandingPageBrand(page.brandId)) return null;
    return { page, source: "local_config", loadedFrom: "seed", canPersist: false,
      statusMessage: "示例內容不會儲存至正式資料。", latestDraftVersionNumber: null,
      publishedVersionNumber: null, pageRecordId: null, versionId: null,
      versionCreatedAt: null, revision: 1, publishedSlug: page.status === "published" ? page.slug : null };
  }
  if (!hasSupabaseAdminEnv()) throw new LandingPageReadError();
  const row = await findLandingPageRow(pageId);
  if (!row || !await canUseLandingPageBrand(row.brand_id)) return null;
  const [latest, published] = await Promise.all([getLatestVersion(row.id), getPublishedVersionForRow(row)]);
  const version = latest ?? published;
  const loadedFrom: LandingPageLoadSource = version?.status === "draft" ? "draft" :
    version?.status === "published" ? "published" : "row";
  return { page: rowToConfig(row, version), source: "supabase", loadedFrom, canPersist: true,
    statusMessage: loadedFrom === "draft" ? "最新草稿已載入。" : "已載入目前內容。",
    latestDraftVersionNumber: latest?.status === "draft" ? latest.version_number : null,
    publishedVersionNumber: published?.version_number ?? null, pageRecordId: row.id,
    versionId: version?.id ?? null, versionCreatedAt: version?.created_at ?? null,
    revision: Number(row.revision || 1), publishedSlug: published ? getCanonicalLandingPageSlug(row.slug) : null };
}

/** Internal only: caller must also enforce the landing_pages module boundary. */
export async function getLandingPageDraftPreview(pageId: string, options: { versionId?: string; revision?: number } = {}): Promise<LandingPageEditorData | null> {
  const access = await requireModuleAccess("landing_pages");
  if (!access.allowed) return null;
  if (isLandingPageFixtureMode()) return getLandingPageEditorState(pageId);
  const row = await findLandingPageRow(pageId);
  if (!row || !await canUseLandingPageBrand(row.brand_id)) return null;
  const version = options.versionId ? await getVersionById(options.versionId) : await latestEditorVersion(row);
  if (!version || version.page_id !== row.id) return null;
  const savedRevision = Number(version.page_revision ?? row.revision ?? 1);
  if (options.revision !== undefined && options.revision !== savedRevision) return null;
  return { page: rowToConfig(row, version), source: "supabase", loadedFrom: version.status === "draft" ? "draft" : "published",
    canPersist: false, statusMessage: "這是已儲存版本的預覽，不會接收正式登記。",
    latestDraftVersionNumber: version.status === "draft" ? version.version_number : null,
    publishedVersionNumber: version.status === "published" ? version.version_number : null,
    pageRecordId: row.id, versionId: version.id, versionCreatedAt: version.created_at,
    revision: savedRevision, publishedSlug: row.published_version_id ? getCanonicalLandingPageSlug(row.slug) : null };
}

export const getLandingPageEditorData = getLandingPageEditorState;

export async function getLandingPageList() {
  try {
    const access = await getCurrentInternalAccess();
    const allowed = (brandId: string | null | undefined) => access.source !== "unauthenticated" &&
      (access.source !== "supabase_auth" || Boolean(brandId && canAccessInternalBrand(access, brandId)));
    if (isLandingPageFixtureMode()) return {
      pages: alyssaLandingPages.filter(page => allowed(page.brandId)).map(page => ({ ...page, builderSource: "local_config" as const })),
      source: "local_config" as const, canPersist: false, available: true, error: null,
    };
    if (!hasSupabaseAdminEnv()) return { pages: [], source: "supabase" as const, canPersist: false, available: false, error: "暫時未能讀取廣告頁，請重新載入。" };
    const { data, error, count } = await createSupabaseAdminClient().from("landing_pages")
      .select("*", { count: "exact" }).order("updated_at", { ascending: false });
    if (error || !Array.isArray(data) || count === null || count !== data.length) throw new LandingPageReadError();
    const scoped = (data as LandingPageRow[]).filter(row => allowed(row.brand_id));
    const pages = await Promise.all(scoped.map(async row => rowToConfig(row, await latestEditorVersion(row))));
    return { pages, source: "supabase" as const, canPersist: true, available: true, error: null };
  } catch {
    return { pages: [], source: "supabase" as const, canPersist: false, available: false, error: "暫時未能讀取廣告頁，請重新載入。" };
  }
}

type LandingPageOperation = "create" | "save" | "publish" | "archive" | "restore" | "delete";

function mutationFailure(message: string): LandingPageMutationResult {
  return { ok: false, source: "supabase", message };
}

function landingCommandMessage(error: { message?: string; code?: string } | null) {
  const code = error?.message || "";
  if (code.includes("revision_conflict")) return "內容已由其他人更新，請重新載入後再儲存。";
  if (code.includes("request_conflict")) return "今次操作資料已更改，請重新載入後再試。";
  if (code.includes("slug_conflict") || error?.code === "23505") return "這個網址已被其他廣告頁使用，請更改後再試。";
  if (code.includes("form_inactive")) return "請先啟用已連接的登記表格，再發布廣告頁。";
  if (code.includes("offer_inactive") || code.includes("offer_invalid")) return "請先檢查已連接表格的療程、優惠及分店。";
  if (code.includes("brand_mismatch")) return "登記表格與廣告頁必須屬於同一品牌。";
  if (code.includes("page_archived")) return "廣告頁已封存，請先恢復草稿。";
  if (code.includes("delete_has_dependencies")) return "這個廣告頁已有發布或登記紀錄，請使用封存。";
  return "暫時未能儲存，內容未有變更，請稍後再試。";
}

async function mutateLandingPage(operation: LandingPageOperation, pageId: string | null, payload: Record<string, unknown>, meta: LandingPageDraftMeta = {}): Promise<LandingPageMutationResult> {
  try {
    if (!hasSupabaseAdminEnv() || isLandingPageFixtureMode()) return mutationFailure("目前未能儲存正式資料，請重新載入。");
    let row: LandingPageRow | null = null;
    try { if (pageId) row = await findLandingPageRow(pageId); }
    catch { return mutationFailure("暫時未能讀取廣告頁，請稍後再試。"); }
    if (operation !== "create" && !row) return mutationFailure("找不到這個廣告頁。");
    const brandId = row?.brand_id ?? (typeof payload.brand_id === "string" ? payload.brand_id : null);
    if (!await canUseLandingPageBrand(brandId)) return mutationFailure("你未獲授權管理這個品牌的廣告頁。");
    if (operation !== "create" && (!Number.isSafeInteger(meta.expectedRevision) || Number(meta.expectedRevision) < 1)) {
      return mutationFailure("頁面版本已更新，請重新載入後再儲存。");
    }
    if (!meta.requestId || !uuidPattern.test(meta.requestId)) return mutationFailure("請重新載入頁面後再試。");
    const { data, error } = await createSupabaseAdminClient().rpc("mutate_landing_page_v1", {
      p_operation: operation, p_page_id: row?.id ?? null,
      p_expected_revision: operation === "create" ? null : meta.expectedRevision,
      p_request_id: meta.requestId, p_payload: payload,
    });
    if (error || !data?.page) return mutationFailure(landingCommandMessage(error));
    const nextRow = data.page as LandingPageRow;
    const version = data.version as LandingPageVersionRow | null;
    return { ok: true, source: "supabase",
      message: operation === "publish" ? "廣告頁已發布。" : operation === "archive" ? "廣告頁已封存。" :
        operation === "restore" ? "已恢復為草稿，發布後才會公開。" : operation === "delete" ? "未使用的廣告頁已刪除。" : "草稿已儲存。",
      page: rowToConfig(nextRow, version), pageRecordId: nextRow.id,
      versionId: version?.id, versionNumber: version?.version_number, revision: Number(nextRow.revision),
      previousPublishedSlug: row?.published_version_id ? getCanonicalLandingPageSlug(row.slug) : null };
  } catch { return mutationFailure("暫時未能儲存，請稍後再試。"); }
}

export async function archiveLandingPage(pageId: string, expectedRevision?: number, requestId?: string) {
  return mutateLandingPage("archive", pageId, {}, { expectedRevision, requestId });
}
export async function restoreLandingPage(pageId: string, expectedRevision?: number, requestId?: string) {
  return mutateLandingPage("restore", pageId, {}, { expectedRevision, requestId });
}
export async function deleteLandingPageSafely(pageId: string, expectedRevision?: number, requestId?: string) {
  return mutateLandingPage("delete", pageId, {}, { expectedRevision, requestId });
}

function initialPageDocument(input: { title: string; heroTitle: string; heroSubtitle: string; offerBadge: string; ctaText: string }) {
  const content: LandingPageContent = { templateName: "offer-landing-page", testingStatus: "ready_for_testing",
    heroTitle: input.heroTitle, heroSubtitle: input.heroSubtitle, offerBadge: input.offerBadge,
    offerHeadline: input.title, offerBody: input.heroSubtitle, ctaText: input.ctaText || "立即預約",
    secondaryCtaText: "", painPoints: [], benefits: [], trustItems: [], sections: [], processSteps: [], contentSections: [], faqs: [] };
  return { title: input.title, content_json: content, image_assets_json: {} };
}

export async function createLandingPageDraft(input: CreateLandingPageDraftInput) {
  const document = initialPageDocument(input);
  const result = await mutateLandingPage("create", null, {
    ...document, brand_id: input.brandId, form_id: input.formId,
  }, { requestId: input.requestId });
  return { ...result, pageId: result.pageRecordId ?? null, slug: result.page?.slug ?? null };
}

export async function saveLandingPageDraft(pageId: string, content: LandingPageContent, imageAssets: LandingPageImageAssets, meta: LandingPageDraftMeta = {}) {
  return saveLandingPageDraftWithSlug(pageId, content, imageAssets, meta);
}

export async function saveLandingPageDraftWithSlug(pageId: string, content: LandingPageContent, imageAssets: LandingPageImageAssets, meta: LandingPageDraftMeta = {}) {
  return mutateLandingPage("save", pageId, {
    ...(meta.title ? { title: meta.title } : {}), ...(meta.slug ? { slug: normalizeEditableLandingPageSlug(meta.slug, meta.slug) } : {}),
    ...(meta.formId ? { form_id: meta.formId } : {}), content_json: content, image_assets_json: imageAssets,
  }, meta);
}

export async function publishLandingPageFromEditor(pageId: string, content: LandingPageContent, imageAssets: LandingPageImageAssets, meta: LandingPageDraftMeta = {}) {
  return publishLandingPageFromEditorWithSlug(pageId, content, imageAssets, meta);
}

export async function publishLandingPageFromEditorWithSlug(pageId: string, content: LandingPageContent, imageAssets: LandingPageImageAssets, meta: LandingPageDraftMeta = {}) {
  if (hasInternalPublicCopy(content as unknown as Record<string, unknown>)) return mutationFailure("請先將內部說明改成客人會看到的內容。");
  return mutateLandingPage("publish", pageId, {
    ...(meta.title ? { title: meta.title } : {}), ...(meta.slug ? { slug: normalizeEditableLandingPageSlug(meta.slug, meta.slug) } : {}),
    ...(meta.formId ? { form_id: meta.formId } : {}), content_json: content, image_assets_json: imageAssets,
  }, meta);
}

export async function publishLandingPage(pageId: string, meta: LandingPageDraftMeta = {}) {
  return mutateLandingPage("publish", pageId, {}, meta);
}

export type CreateAcquisitionAssetsInput = {
  requestId: string;
  brandId: string;
  form?: ManagedFormInput;
  existingFormId?: string;
  page?: { title: string; heroTitle: string; heroSubtitle: string; offerBadge: string; ctaText: string };
};

/** Form, memberships and optional first LP version commit or roll back together. */
export async function createAcquisitionAssets(input: CreateAcquisitionAssetsInput) {
  const fail = (message: string) => ({ ok: false as const, message, formId: null, pageId: null, slug: null });
  try {
    if (!hasSupabaseAdminEnv() || isLandingPageFixtureMode()) return fail("暫時未能建立，請稍後再試。");
    if (!uuidPattern.test(input.requestId)) return fail("請重新開啟建立頁面後再試。");
    if (!await canUseLandingPageBrand(input.brandId)) return fail("你未獲授權管理這個品牌。");
    let formPayload: Record<string, unknown> | undefined;
    if (input.form) {
      const prepared = await prepareManagedFormPayload(input.form);
      if (!prepared.ok) return fail(prepared.message);
      formPayload = prepared.payload as unknown as Record<string, unknown>;
    } else if (!input.existingFormId || !uuidPattern.test(input.existingFormId)) return fail("請選擇登記表格。");
    if (input.form && input.form.brandId !== input.brandId) return fail("登記表格與品牌不相符。");
    const payload = { brand_id: input.brandId, ...(formPayload ? { form: formPayload } : { existing_form_id: input.existingFormId }),
      ...(input.page ? { page: initialPageDocument(input.page) } : {}) };
    const { data, error } = await createSupabaseAdminClient().rpc("create_acquisition_assets_v1", {
      p_request_id: input.requestId, p_payload: payload,
    });
    if (error || !data?.form?.id) return fail(landingCommandMessage(error));
    return { ok: true as const, message: data.page ? "廣告頁草稿已建立。" : "登記表格已建立。",
      formId: String(data.form.id), pageId: typeof data.page?.id === "string" ? data.page.id : null,
      slug: typeof data.page?.slug === "string" ? data.page.slug : null };
  } catch { return fail("暫時未能建立，請稍後再試。"); }
}
