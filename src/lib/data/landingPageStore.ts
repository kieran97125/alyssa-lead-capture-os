import { randomBytes } from "crypto";
import { alyssaDefaultForm } from "@/lib/data/alyssaConfig";
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
};

type LandingPageVersionRow = {
  id: string;
  page_id: string;
  version_number: number;
  status: "draft" | "published" | "archived";
  content_json: Record<string, unknown> | null;
  image_assets_json: Record<string, unknown> | null;
  created_at: string;
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
};

export type LandingPageMutationResult = {
  ok: boolean;
  source: "supabase" | "local_config";
  message: string;
  page?: LandingPageConfig;
  versionNumber?: number;
};

export type LandingPageDraftMeta = {
  title?: string;
  slug?: string;
  formId?: string;
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
};

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

const supabaseToLocalIds = {
  brand: {
    "11111111-1111-4111-8111-111111111111": "alyssa-brand-seed",
  },
  treatment: {
    "22222222-2222-4222-8222-222222222221": "skin-renewal-consult",
    "22222222-2222-4222-8222-222222222222": "medical-beauty-trial",
  },
  package: {
    "33333333-3333-4333-8333-333333333331": "consultation-booking",
    "33333333-3333-4333-8333-333333333332": "trial-package-388",
  },
  branch: {
    "44444444-4444-4444-8444-444444444441": "central",
    "44444444-4444-4444-8444-444444444442": "causeway-bay",
    "44444444-4444-4444-8444-444444444443": "tsim-sha-tsui",
  },
  form: {
    "55555555-5555-4555-8555-555555555551": "alyssa-main-form",
  },
} as const;

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

function shortId() {
  return randomBytes(3).toString("hex");
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

async function createUniqueLandingPageSlug(title: string, brandSlug: string) {
  const base = buildLandingPageSlugBase(title, brandSlug);

  if (!hasSupabaseAdminEnv()) return `${base}-${shortId()}`;

  const supabase = createSupabaseAdminClient();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const slug = `${base}-${shortId()}`;
    const { data, error } = await supabase
      .from("landing_pages")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (!error && !data) return slug;
  }

  return `${base}-${Date.now().toString(36)}-${shortId()}`;
}

function normalizeEditableLandingPageSlug(value: string | undefined, fallback: string) {
  const slug = slugify(value || fallback);
  return getCanonicalLandingPageSlug(slug);
}

async function ensureLandingPageSlugAvailable(slug: string, currentPageId: string) {
  if (!hasSupabaseAdminEnv()) return null;

  const supabase = createSupabaseAdminClient();
  const lookupSlugs = getLandingPageLookupSlugs(slug);
  const { data, error } = await supabase
    .from("landing_pages")
    .select("id,slug")
    .in("slug", lookupSlugs);

  if (error) {
    return `Slug 未能檢查：${error.message}`;
  }

  const conflict = (data ?? []).find(
    (row) => row.id !== currentPageId && typeof row.slug === "string"
  );

  return conflict ? "Slug 已被其他 Landing Page 使用。" : null;
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

function mapKnownId(
  value: string | null,
  mapping: Record<string, string>,
  fallback: string
) {
  return value ? mapping[value] ?? value : fallback;
}

function hasOwnContentSections(content: Record<string, unknown> | null | undefined) {
  return Boolean(
    content &&
      Object.prototype.hasOwnProperty.call(content, "contentSections") &&
      Array.isArray(content.contentSections)
  );
}

function hasPersistedPageState(row: LandingPageRow) {
  return Boolean(row.content_json || row.image_assets_json);
}

function logLandingPageLoad({
  pageId,
  slug,
  loadedFrom,
  page,
}: {
  pageId: string;
  slug: string;
  loadedFrom: LandingPageLoadSource;
  page: LandingPageConfig;
}) {
  if (process.env.NODE_ENV !== "development") return;

  console.info("[landing-page-load]", {
    pageId,
    slug,
    loadedFrom,
    contentSections: page.contentSections.length,
    sectionIds: page.contentSections.map((section) => section.id),
  });
}

function rowToConfig(
  row: LandingPageRow,
  version?: LandingPageVersionRow | null
): LandingPageConfig {
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
    id: canonicalSlug,
    slug: canonicalSlug,
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
    brandId: mapKnownId(row.brand_id, supabaseToLocalIds.brand, ""),
    treatmentId: mapKnownId(
      row.treatment_id,
      supabaseToLocalIds.treatment,
      ""
    ),
    packageId: mapKnownId(
      row.package_id,
      supabaseToLocalIds.package,
      ""
    ),
    branchId: mapKnownId(row.branch_id, supabaseToLocalIds.branch, ""),
    formId: mapKnownId(row.form_id, supabaseToLocalIds.form, ""),
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
  if (!hasSupabaseAdminEnv()) return null;

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
      return null;
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
    return null;
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
    return null;
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
    return null;
  }

  return (data?.[0] as LandingPageVersionRow | undefined) ?? null;
}

async function getPublishedVersionForRow(row: LandingPageRow) {
  const pointedVersion = row.published_version_id
    ? await getVersionById(row.published_version_id)
    : null;

  if (pointedVersion?.status === "published") return pointedVersion;

  return getLatestVersion(row.id, "published");
}

function hasText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
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

async function validatePublishReadinessWithResolvedForm(
  row: LandingPageRow,
  version: LandingPageVersionRow
) {
  const missing: string[] = [];
  const content = version.content_json ?? {};

  if (!row.form_id) missing.push("未連接登記表格");
  if (!hasText(row.title)) missing.push("頁面標題未填");
  if (!hasText(content.heroTitle)) missing.push("Hero 標題未填");
  if (!hasText(content.ctaText)) missing.push("CTA 文字未填");
  if (hasInternalPublicCopy(content)) {
    missing.push("公開文案仍包含內部說明，請先改成客人會看到的內容");
  }

  if (!hasSupabaseAdminEnv()) return missing;

  const supabase = createSupabaseAdminClient();
  const formResult = row.form_id
    ? await supabase
        .from("forms")
        .select(
          "id,brand_id,form_name,public_form_token,default_treatment_id,default_package_id,default_branch_id"
        )
        .eq("id", row.form_id)
        .maybeSingle()
    : { data: null, error: null };

  if (formResult.error) {
    console.warn("landing_page_publish_form_check_failed", {
      code: formResult.error.code,
      message: formResult.error.message,
    });
  }

  const form = formResult.data as Record<string, unknown> | null;
  if (row.form_id && !form) missing.push("表格資料未找到");

  const resolvedBrandId =
    row.brand_id ?? (typeof form?.brand_id === "string" ? form.brand_id : null);
  const resolvedTreatmentId =
    row.treatment_id ??
    (typeof form?.default_treatment_id === "string"
      ? form.default_treatment_id
      : null);
  const resolvedPackageId =
    row.package_id ??
    (typeof form?.default_package_id === "string" ? form.default_package_id : null);
  const resolvedBranchId =
    row.branch_id ??
    (typeof form?.default_branch_id === "string" ? form.default_branch_id : null);

  if (!resolvedBrandId) missing.push("品牌未設定");
  if (!resolvedTreatmentId) missing.push("療程未設定");
  if (!resolvedPackageId) missing.push("套餐未設定");
  if (!resolvedBranchId) missing.push("分店未設定");

  const [brandResult, treatmentResult, packageResult, branchResult] =
    await Promise.all([
      resolvedBrandId
        ? supabase
            .from("brands")
            .select("id,name,slug")
            .eq("id", resolvedBrandId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      resolvedTreatmentId
        ? supabase
            .from("treatments")
            .select("id,brand_id")
            .eq("id", resolvedTreatmentId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      resolvedPackageId
        ? supabase
            .from("packages")
            .select("id,treatment_id")
            .eq("id", resolvedPackageId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      resolvedBranchId
        ? supabase
            .from("branches")
            .select("id,brand_id")
            .eq("id", resolvedBranchId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

  if (brandResult.error) {
    console.warn("landing_page_publish_brand_check_failed", {
      code: brandResult.error.code,
      message: brandResult.error.message,
    });
  }

  const brand = brandResult.data as Record<string, unknown> | null;
  const treatment = treatmentResult.data as Record<string, unknown> | null;
  const packageRow = packageResult.data as Record<string, unknown> | null;
  const branch = branchResult.data as Record<string, unknown> | null;

  if (resolvedBrandId && !brand) missing.push("品牌資料未找到");
  if (resolvedTreatmentId && !treatment) missing.push("療程資料未找到");
  if (resolvedPackageId && !packageRow) missing.push("套餐資料未找到");
  if (resolvedBranchId && !branch) missing.push("分店資料未找到");

  if (
    resolvedBrandId &&
    treatment?.brand_id &&
    treatment.brand_id !== resolvedBrandId
  ) {
    missing.push("療程品牌與頁面品牌不一致");
  }

  if (
    resolvedTreatmentId &&
    packageRow?.treatment_id &&
    packageRow.treatment_id !== resolvedTreatmentId
  ) {
    missing.push("套餐與療程不一致");
  }

  if (resolvedBrandId && branch?.brand_id && branch.brand_id !== resolvedBrandId) {
    missing.push("分店品牌與頁面品牌不一致");
  }

  if (resolvedBrandId && form?.brand_id && form.brand_id !== resolvedBrandId) {
    missing.push("表格品牌與頁面品牌不一致");
  }

  const brandName = String(brand?.name ?? "");
  const brandSlug = String(brand?.slug ?? "");
  const formName = String(form?.form_name ?? "");
  const formToken = String(form?.public_form_token ?? "");
  const isIneffablePage =
    /ineffable/i.test(brandName) || /ineffable/i.test(brandSlug);
  const isAlyssaMainForm =
    /alyssa/i.test(formName) || formToken === alyssaDefaultForm.publicFormToken;

  if (isIneffablePage && isAlyssaMainForm) {
    missing.push(
      "這個公開頁仍然連接 Alyssa 表格，請先改用 Ineffable Beauty 表格。"
    );
  }

  return Array.from(new Set(missing));
}

async function validatePublishReadiness(
  row: LandingPageRow,
  version: LandingPageVersionRow
) {
  return validatePublishReadinessWithResolvedForm(row, version);

  /*
  const missing: string[] = [];
  const content = version.content_json ?? {};

  if (!row.brand_id) missing.push("品牌未設定");
  if (!row.treatment_id) missing.push("療程未設定");
  if (!row.package_id) missing.push("套餐未設定");
  if (!row.branch_id) missing.push("分店未設定");
  if (!row.form_id) missing.push("未連接登記表格");
  if (!hasText(row.title)) missing.push("頁面標題未填");
  if (!hasText(content.heroTitle)) missing.push("Hero 標題未填");
  if (!hasText(content.ctaText)) missing.push("CTA 文字未填");
  if (hasInternalPublicCopy(content)) {
    missing.push("公開文案仍包含內部說明，請先改成客人會看到的內容");
  }

  if (!hasSupabaseAdminEnv()) return missing;

  const supabase = createSupabaseAdminClient();
  const [
    brandResult,
    treatmentResult,
    packageResult,
    branchResult,
    formResult,
  ] = await Promise.all([
    row.brand_id
      ? supabase.from("brands").select("id,name,slug").eq("id", row.brand_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    row.treatment_id
      ? supabase
          .from("treatments")
          .select("id,brand_id")
          .eq("id", row.treatment_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    row.package_id
      ? supabase
          .from("packages")
          .select("id,treatment_id")
          .eq("id", row.package_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    row.branch_id
      ? supabase
          .from("branches")
          .select("id,brand_id")
          .eq("id", row.branch_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    row.form_id
      ? supabase
          .from("forms")
          .select("id,brand_id,form_name,public_form_token")
          .eq("id", row.form_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (brandResult.error) {
    console.warn("landing_page_publish_brand_check_failed", {
      code: brandResult.error.code,
      message: brandResult.error.message,
    });
  }

  if (formResult.error) {
    console.warn("landing_page_publish_form_check_failed", {
      code: formResult.error.code,
      message: formResult.error.message,
    });
  }

  const brand = brandResult.data as Record<string, unknown> | null;
  const treatment = treatmentResult.data as Record<string, unknown> | null;
  const packageRow = packageResult.data as Record<string, unknown> | null;
  const branch = branchResult.data as Record<string, unknown> | null;
  const form = formResult.data as Record<string, unknown> | null;

  if (row.brand_id && !brand) missing.push("品牌資料未找到");
  if (row.treatment_id && !treatment) missing.push("療程資料未找到");
  if (row.package_id && !packageRow) missing.push("套餐資料未找到");
  if (row.branch_id && !branch) missing.push("分店資料未找到");
  if (row.form_id && !form) missing.push("表格資料未找到");

  if (row.brand_id && treatment?.brand_id && treatment.brand_id !== row.brand_id) {
    missing.push("療程品牌與頁面品牌不一致");
  }

  if (
    row.treatment_id &&
    packageRow?.treatment_id &&
    packageRow.treatment_id !== row.treatment_id
  ) {
    missing.push("套餐與療程不一致");
  }

  if (row.brand_id && branch?.brand_id && branch.brand_id !== row.brand_id) {
    missing.push("分店品牌與頁面品牌不一致");
  }

  if (row.brand_id && form?.brand_id && form.brand_id !== row.brand_id) {
    missing.push("表格品牌與頁面品牌不一致");
  }

  const brandName = String(brand?.name ?? "");
  const brandSlug = String(brand?.slug ?? "");
  const formName = String(form?.form_name ?? "");
  const formToken = String(form?.public_form_token ?? "");
  const isIneffablePage =
    /ineffable/i.test(brandName) || /ineffable/i.test(brandSlug);
  const isAlyssaMainForm =
    /alyssa/i.test(formName) || formToken === alyssaDefaultForm.publicFormToken;

  if (isIneffablePage && isAlyssaMainForm) {
    missing.push("Ineffable 公開頁仍然連接 Alyssa 表格，請先改用 Ineffable 表格");
  }

  return Array.from(new Set(missing));
  */
}

export async function getLandingPageBySlug(slug: string) {
  const row = await findLandingPageRow(slug);
  if (!row) {
    const canonicalSlug = getCanonicalLandingPageSlug(slug);
    const fallback =
      getLocalLandingPageBySlug(canonicalSlug) ?? getLocalLandingPageBySlug(slug);
    return fallback
      ? {
          ...fallback,
          builderSource: "local_config" as const,
          contentSectionsExplicit: false,
        }
      : null;
  }

  const version =
    (await getLatestVersion(row.id, "draft")) ??
    (await getPublishedVersionForRow(row)) ??
    (await getLatestVersion(row.id));

  return rowToConfig(row, version);
}

export async function getLandingPageById(id: string) {
  const row = await findLandingPageRow(id);
  if (!row) {
    const canonicalSlug = getCanonicalLandingPageSlug(id);
    const fallback =
      getLocalLandingPageById(canonicalSlug) ??
      getLocalLandingPageBySlug(canonicalSlug) ??
      getLocalLandingPageById(id) ??
      getLocalLandingPageBySlug(id);
    return fallback
      ? {
          ...fallback,
          builderSource: "local_config" as const,
          contentSectionsExplicit: false,
        }
      : null;
  }

  const version =
    (await getLatestVersion(row.id, "draft")) ??
    (await getPublishedVersionForRow(row)) ??
    (await getLatestVersion(row.id));

  return rowToConfig(row, version);
}

export async function getPublishedLandingPageBySlug(slug: string) {
  if (hasSupabaseAdminEnv()) {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("landing_pages")
      .select("*")
      .in("slug", getLandingPageLookupSlugs(slug))
      .eq("status", "published");

    if (error) {
      console.warn("published landing page lookup failed", {
        code: error.code,
        message: error.message,
      });
    } else {
      const row = pickLandingPageRowBySlug(
        ((data ?? []) as LandingPageRow[]),
        slug
      );

      if (!row) {
        // Fall through to local fallback below.
      } else {
        const version = await getPublishedVersionForRow(row);

        if (!version) {
          console.warn("published_landing_page_version_unavailable", {
            pageId: row.id,
            slug: row.slug,
            versionId: row.published_version_id,
            versionStatus: "missing",
          });
          if (hasPersistedPageState(row)) {
            const page = rowToConfig(row, null);
            logLandingPageLoad({
              pageId: row.id,
              slug: row.slug,
              loadedFrom: "published",
              page,
            });
            return page;
          }
        } else {
          const page = rowToConfig(row, version);
          logLandingPageLoad({
            pageId: row.id,
            slug: row.slug,
            loadedFrom: "published",
            page,
          });
          return page;
        }
      }
    }
  }

  const canonicalSlug = getCanonicalLandingPageSlug(slug);
  const fallback =
    getLocalLandingPageBySlug(canonicalSlug) ?? getLocalLandingPageBySlug(slug);
  return fallback
    ? {
        ...fallback,
        builderSource: "local_config" as const,
        contentSectionsExplicit: false,
      }
    : null;
}

export async function getLandingPageEditorState(
  pageId: string
): Promise<LandingPageEditorData | null> {
  if (hasSupabaseAdminEnv()) {
    const row = await findLandingPageRow(pageId);
    if (row) {
      const latestDraft = await getLatestVersion(row.id, "draft");
      const publishedVersion = await getPublishedVersionForRow(row);
      const latestVersion = latestDraft ?? publishedVersion;
      const loadedFrom: LandingPageLoadSource = latestDraft
        ? "draft"
        : publishedVersion
          ? "published"
          : hasPersistedPageState(row)
            ? "row"
            : "seed";
      const page = rowToConfig(row, latestVersion);

      logLandingPageLoad({
        pageId: row.id,
        slug: row.slug,
        loadedFrom,
        page,
      });

      return {
        page,
        source: "supabase",
        loadedFrom,
        canPersist: true,
        statusMessage:
          loadedFrom === "draft"
            ? "正在載入最新草稿。"
            : loadedFrom === "published"
              ? "正在載入最新已發布版本。"
              : loadedFrom === "row"
                ? "正在載入頁面目前保存內容。"
                : "正在載入預設內容；儲存後會以草稿為準。",
        latestDraftVersionNumber: latestDraft?.version_number ?? null,
        publishedVersionNumber: publishedVersion?.version_number ?? null,
        pageRecordId: row.id,
        versionId: latestVersion?.id ?? null,
        versionCreatedAt: latestVersion?.created_at ?? null,
      };
    }
  }

  const page = await getLandingPageById(pageId);
  if (!page) return null;

  const canPersist = page.builderSource === "supabase";

  return {
    page,
    source: page.builderSource ?? "local_config",
    loadedFrom: "seed",
    canPersist,
    statusMessage: canPersist
      ? "這個 Landing Page 可以儲存草稿及發布公開版本。"
      : "目前只可查看內容；儲存草稿及發布功能稍後開放。",
    latestDraftVersionNumber: null,
    publishedVersionNumber: null,
    pageRecordId: null,
    versionId: null,
    versionCreatedAt: null,
  };
}

export const getLandingPageEditorData = getLandingPageEditorState;

export async function getLandingPageList() {
  if (hasSupabaseAdminEnv()) {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("landing_pages")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      console.warn("landing page list lookup failed", {
        code: error.code,
        message: error.message,
      });
    } else if (data && data.length > 0) {
      const pages = await Promise.all(
        (data as LandingPageRow[]).map(async (row) => {
          const version =
            (await getLatestVersion(row.id, "draft")) ??
            (await getPublishedVersionForRow(row)) ??
            (await getLatestVersion(row.id));
          return rowToConfig(row, version);
        })
      );

      return {
        pages,
        source: "supabase" as const,
        canPersist: true,
      };
    }
  }

  return {
    pages: alyssaLandingPages.map((page) => ({
      ...page,
      builderSource: "local_config" as const,
    })),
    source: "local_config" as const,
    canPersist: false,
  };
}

export async function createLandingPageDraft(input: CreateLandingPageDraftInput) {
  if (!hasSupabaseAdminEnv()) {
    return {
      ok: false,
      message: "暫時未能建立 Landing Page 草稿，請確認正式資料庫設定。",
      pageId: null as string | null,
      slug: null as string | null,
    };
  }

  const supabase = createSupabaseAdminClient();
  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select("slug")
    .eq("id", input.brandId)
    .maybeSingle<{ slug: string | null }>();

  if (brandError || !brand?.slug) {
    console.warn("landing_page_brand_slug_lookup_failed", brandError);
    return {
      ok: false,
      message: "Landing Page 未能建立，請確認品牌資料及品牌代號。",
      pageId: null,
      slug: null,
    };
  }

  const slug = await createUniqueLandingPageSlug(input.title, brand.slug);
  const content: LandingPageContent = {
    templateName: "offer-landing-page",
    testingStatus: "ready_for_testing",
    heroTitle: input.heroTitle,
    heroSubtitle: input.heroSubtitle,
    offerBadge: input.offerBadge,
    offerHeadline: input.title,
    offerBody: input.heroSubtitle,
    ctaText: input.ctaText || "立即預約體驗",
    secondaryCtaText: "",
    painPoints: [],
    benefits: [],
    trustItems: [],
    sections: [],
    processSteps: [],
    contentSections: [],
    faqs: [],
  };
  const imageAssets: LandingPageImageAssets = {
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

  const { data: page, error: pageError } = await supabase
    .from("landing_pages")
    .insert({
      slug,
      title: input.title,
      brand_id: input.brandId,
      treatment_id: input.treatmentId,
      package_id: input.packageId,
      branch_id: input.branchId,
      form_id: input.formId,
      template_key: "premium_offer_landing_page",
      mode: "landing_page",
      status: "draft",
      content_json: content,
      image_assets_json: imageAssets,
    })
    .select("id,slug")
    .single<{ id: string; slug: string }>();

  if (pageError || !page) {
    console.warn("landing_page_create_failed", pageError);
    return {
      ok: false,
      message: "Landing Page 草稿未能建立，請稍後再試。",
      pageId: null,
      slug: null,
    };
  }

  const { error: versionError } = await supabase
    .from("landing_page_versions")
    .insert({
      page_id: page.id,
      version_number: 1,
      status: "draft",
      content_json: content,
      image_assets_json: imageAssets,
    });

  if (versionError) {
    console.warn("landing_page_initial_version_failed", versionError);
    return {
      ok: false,
      message:
        "Landing Page 已建立，但初始草稿未能建立。請到 Landing Pages 檢查。",
      pageId: null,
      slug: null,
    };
  }

  return {
    ok: true,
    message: "Landing Page 草稿已建立。",
    pageId: page.slug,
    slug: page.slug,
  };
}

export async function saveLandingPageDraft(
  pageId: string,
  content: LandingPageContent,
  imageAssets: LandingPageImageAssets,
  meta: LandingPageDraftMeta = {}
): Promise<LandingPageMutationResult> {
  const row = await findLandingPageRow(pageId);
  if (!row || !hasSupabaseAdminEnv()) {
    return {
      ok: false,
      source: "local_config",
      message: "目前未能儲存草稿，請確認這個 Landing Page 已連接正式資料。",
    };
  }

  const supabase = createSupabaseAdminClient();
  const latest = await getLatestVersion(row.id);
  const versionNumber = (latest?.version_number ?? 0) + 1;

  const { error: versionError } = await supabase
    .from("landing_page_versions")
    .insert({
      page_id: row.id,
      version_number: versionNumber,
      status: "draft",
      content_json: content,
      image_assets_json: imageAssets,
    });

  if (versionError) {
    return {
      ok: false,
      source: "supabase",
      message: `草稿未能儲存：${versionError.message}`,
    };
  }

  const { error: pageError } = await supabase
    .from("landing_pages")
    .update({
      title: meta.title ?? row.title,
      form_id: meta.formId ?? row.form_id,
      status: row.published_version_id ? row.status : "draft",
      content_json: content,
      image_assets_json: imageAssets,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  if (pageError) {
    return {
      ok: false,
      source: "supabase",
      message: `Landing Page 未能更新：${pageError.message}`,
    };
  }

  return {
    ok: true,
    source: "supabase",
    message: `草稿版本 ${versionNumber} 已儲存。`,
    versionNumber,
  };
}

export async function publishLandingPageFromEditor(
  pageId: string,
  content: LandingPageContent,
  imageAssets: LandingPageImageAssets,
  meta: LandingPageDraftMeta = {}
): Promise<LandingPageMutationResult> {
  const row = await findLandingPageRow(pageId);
  if (!row || !hasSupabaseAdminEnv()) {
    return {
      ok: false,
      source: "local_config",
      message: "目前未能發布，請確認這個 Landing Page 已連接正式資料。",
    };
  }

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const publishRow: LandingPageRow = {
    ...row,
    title: meta.title ?? row.title,
    form_id: meta.formId ?? row.form_id,
    content_json: content as unknown as Record<string, unknown>,
    image_assets_json: imageAssets as unknown as Record<string, unknown>,
    updated_at: now,
  };
  const latest = await getLatestVersion(row.id);
  const versionNumber = (latest?.version_number ?? 0) + 1;
  const pendingVersion: LandingPageVersionRow = {
    id: "pending",
    page_id: row.id,
    version_number: versionNumber,
    status: "published",
    content_json: publishRow.content_json,
    image_assets_json: publishRow.image_assets_json,
    created_at: now,
  };
  const missing = await validatePublishReadiness(publishRow, pendingVersion);

  if (missing.length > 0) {
    return {
      ok: false,
      source: "supabase",
      message: `發布前請先完成：${missing.join("、")}`,
    };
  }

  const { data: version, error: versionError } = await supabase
    .from("landing_page_versions")
    .insert({
      page_id: row.id,
      version_number: versionNumber,
      status: "published",
      content_json: content,
      image_assets_json: imageAssets,
    })
    .select("*")
    .single<LandingPageVersionRow>();

  if (versionError || !version) {
    return {
      ok: false,
      source: "supabase",
      message: `發布版本未能建立：${versionError?.message ?? "unknown error"}`,
    };
  }

  const { error: pageError } = await supabase
    .from("landing_pages")
    .update({
      title: publishRow.title,
      form_id: publishRow.form_id,
      status: "published",
      content_json: content,
      image_assets_json: imageAssets,
      published_version_id: version.id,
      published_at: now,
      updated_at: now,
    })
    .eq("id", row.id);

  if (pageError) {
    return {
      ok: false,
      source: "supabase",
      message: `Landing Page 發布狀態未能更新：${pageError.message}`,
    };
  }

  return {
    ok: true,
    source: "supabase",
    message: `發布版本 ${version.version_number} 已更新公開頁。`,
    page: rowToConfig({ ...publishRow, status: "published", published_at: now }, version),
    versionNumber: version.version_number,
  };
}

export async function saveLandingPageDraftWithSlug(
  pageId: string,
  content: LandingPageContent,
  imageAssets: LandingPageImageAssets,
  meta: LandingPageDraftMeta = {}
): Promise<LandingPageMutationResult> {
  const row = await findLandingPageRow(pageId);
  if (!row || !hasSupabaseAdminEnv()) {
    return {
      ok: false,
      source: "local_config",
      message: "目前未能保存，請確認這個 Landing Page 已連接正式資料。",
    };
  }

  const supabase = createSupabaseAdminClient();
  const latest = await getLatestVersion(row.id);
  const versionNumber = (latest?.version_number ?? 0) + 1;
  const savedAt = new Date().toISOString();
  const nextSlug = normalizeEditableLandingPageSlug(meta.slug, row.slug);
  const slugConflict = await ensureLandingPageSlugAvailable(nextSlug, row.id);

  if (slugConflict) {
    return {
      ok: false,
      source: "supabase",
      message: slugConflict,
    };
  }

  const { error: versionError } = await supabase
    .from("landing_page_versions")
    .insert({
      page_id: row.id,
      version_number: versionNumber,
      status: "draft",
      content_json: content,
      image_assets_json: imageAssets,
    });

  if (versionError) {
    return {
      ok: false,
      source: "supabase",
      message: `草稿未能保存：${versionError.message}`,
    };
  }

  const updatedRow: LandingPageRow = {
    ...row,
    slug: nextSlug,
    title: meta.title ?? row.title,
    form_id: meta.formId ?? row.form_id,
    content_json: content as unknown as Record<string, unknown>,
    image_assets_json: imageAssets as unknown as Record<string, unknown>,
    updated_at: savedAt,
  };

  const { error: pageError } = await supabase
    .from("landing_pages")
    .update({
      slug: nextSlug,
      title: updatedRow.title,
      form_id: updatedRow.form_id,
      status: row.published_version_id ? row.status : "draft",
      content_json: content,
      image_assets_json: imageAssets,
      updated_at: savedAt,
    })
    .eq("id", row.id);

  if (pageError) {
    return {
      ok: false,
      source: "supabase",
      message: `Landing Page 未能更新：${pageError.message}`,
    };
  }

  return {
    ok: true,
    source: "supabase",
    message: `草稿版本 ${versionNumber} 已保存。`,
    page: rowToConfig(updatedRow, {
      id: "draft",
      page_id: row.id,
      version_number: versionNumber,
      status: "draft",
      content_json: content as unknown as Record<string, unknown>,
      image_assets_json: imageAssets as unknown as Record<string, unknown>,
      created_at: savedAt,
    }),
    versionNumber,
  };
}

export async function publishLandingPageFromEditorWithSlug(
  pageId: string,
  content: LandingPageContent,
  imageAssets: LandingPageImageAssets,
  meta: LandingPageDraftMeta = {}
): Promise<LandingPageMutationResult> {
  const row = await findLandingPageRow(pageId);
  if (!row || !hasSupabaseAdminEnv()) {
    return {
      ok: false,
      source: "local_config",
      message: "目前未能發布，請確認這個 Landing Page 已連接正式資料。",
    };
  }

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const nextSlug = normalizeEditableLandingPageSlug(meta.slug, row.slug);
  const slugConflict = await ensureLandingPageSlugAvailable(nextSlug, row.id);

  if (slugConflict) {
    return {
      ok: false,
      source: "supabase",
      message: slugConflict,
    };
  }

  const publishRow: LandingPageRow = {
    ...row,
    slug: nextSlug,
    title: meta.title ?? row.title,
    form_id: meta.formId ?? row.form_id,
    content_json: content as unknown as Record<string, unknown>,
    image_assets_json: imageAssets as unknown as Record<string, unknown>,
    updated_at: now,
  };
  const latest = await getLatestVersion(row.id);
  const versionNumber = (latest?.version_number ?? 0) + 1;
  const pendingVersion: LandingPageVersionRow = {
    id: "pending",
    page_id: row.id,
    version_number: versionNumber,
    status: "published",
    content_json: publishRow.content_json,
    image_assets_json: publishRow.image_assets_json,
    created_at: now,
  };
  const missing = await validatePublishReadiness(publishRow, pendingVersion);

  if (missing.length > 0) {
    return {
      ok: false,
      source: "supabase",
      message: `發布前請先完成：${missing.join("、")}`,
    };
  }

  const { data: version, error: versionError } = await supabase
    .from("landing_page_versions")
    .insert({
      page_id: row.id,
      version_number: versionNumber,
      status: "published",
      content_json: content,
      image_assets_json: imageAssets,
    })
    .select("*")
    .single<LandingPageVersionRow>();

  if (versionError || !version) {
    return {
      ok: false,
      source: "supabase",
      message: `發布版本未能建立：${versionError?.message ?? "unknown error"}`,
    };
  }

  const { error: pageError } = await supabase
    .from("landing_pages")
    .update({
      slug: nextSlug,
      title: publishRow.title,
      form_id: publishRow.form_id,
      status: "published",
      content_json: content,
      image_assets_json: imageAssets,
      published_version_id: version.id,
      published_at: now,
      updated_at: now,
    })
    .eq("id", row.id);

  if (pageError) {
    return {
      ok: false,
      source: "supabase",
      message: `Landing Page 發布狀態未能更新：${pageError.message}`,
    };
  }

  return {
    ok: true,
    source: "supabase",
    message: `發布版本 ${version.version_number} 已更新公開頁。`,
    page: rowToConfig(
      { ...publishRow, status: "published", published_at: now },
      version
    ),
    versionNumber: version.version_number,
  };
}

export async function publishLandingPage(
  pageId: string
): Promise<LandingPageMutationResult> {
  const row = await findLandingPageRow(pageId);
  if (!row || !hasSupabaseAdminEnv()) {
    return {
      ok: false,
      source: "local_config",
      message: "目前未能發布，請確認這個 Landing Page 已連接正式資料。",
    };
  }

  const supabase = createSupabaseAdminClient();
  let version = await getLatestVersion(row.id, "draft");

  if (!version) {
    return {
      ok: false,
      source: "supabase",
      message: "請先保存草稿，然後再發布公開頁。",
    };
  }

  const missing = await validatePublishReadiness(row, version);

  if (missing.length > 0) {
    return {
      ok: false,
      source: "supabase",
      message: `發布前請先完成：${missing.join("、")}`,
    };
  }

  if (!version) {
    const latest = await getLatestVersion(row.id);
    const versionNumber = (latest?.version_number ?? 0) + 1;
    const { data, error } = await supabase
      .from("landing_page_versions")
      .insert({
        page_id: row.id,
        version_number: versionNumber,
        status: "published",
        content_json: row.content_json,
        image_assets_json: row.image_assets_json,
      })
      .select("*")
      .single<LandingPageVersionRow>();

    if (error) {
      return {
        ok: false,
        source: "supabase",
        message: `發布版本未能建立：${error.message}`,
      };
    }

    version = data;
  } else {
    const { error } = await supabase
      .from("landing_page_versions")
      .update({ status: "published" })
      .eq("id", version.id);

    if (error) {
      return {
        ok: false,
        source: "supabase",
        message: `發布版本未能更新：${error.message}`,
      };
    }
  }

  const publishedAt = new Date().toISOString();
  const { error: pageError } = await supabase
    .from("landing_pages")
    .update({
      status: "published",
      content_json: version.content_json,
      image_assets_json: version.image_assets_json,
      published_version_id: version.id,
      published_at: publishedAt,
      updated_at: publishedAt,
    })
    .eq("id", row.id);

  if (pageError) {
    return {
      ok: false,
      source: "supabase",
      message: `Landing Page 未能發布：${pageError.message}`,
    };
  }

  return {
    ok: true,
    source: "supabase",
    message: `版本 ${version.version_number} 已發布。`,
    versionNumber: version.version_number,
  };
}
