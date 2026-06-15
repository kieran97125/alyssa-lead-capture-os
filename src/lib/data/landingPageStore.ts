import { randomBytes } from "crypto";
import { alyssaDefaultForm } from "@/lib/data/alyssaConfig";
import {
  alyssaLandingPages,
  getLandingPageById as getLocalLandingPageById,
  getLandingPageBySlug as getLocalLandingPageBySlug,
  type LandingPageConfig,
  type LandingPageContent,
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
  canPersist: boolean;
  statusMessage: string;
  latestDraftVersionNumber: number | null;
  publishedVersionNumber: number | null;
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

function asString(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
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

async function createUniqueLandingPageSlug(title: string) {
  const base = `alyssa-${slugify(title)}`;

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

function asStringArray(value: unknown, fallback: string[]) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : fallback;
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
        keys.map((key) => [key, asString(record[key as string], "")])
      ) as T;

      return keys.every((key) => mapped[key]) ? mapped : null;
    })
    .filter((item): item is T => Boolean(item));

  return items.length > 0 ? items : fallback;
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
    trustImageUrl: page.trustImageUrl,
  };
}

function mergeContent(
  fallback: LandingPageConfig,
  content: Record<string, unknown> | null
) {
  return {
    templateName: asString(content?.templateName, fallback.templateName),
    testingStatus:
      content?.testingStatus === "foundation" ||
      content?.testingStatus === "ready_for_testing"
        ? content.testingStatus
        : fallback.testingStatus,
    heroTitle: asString(content?.heroTitle, fallback.heroTitle),
    heroSubtitle: asString(content?.heroSubtitle, fallback.heroSubtitle),
    offerBadge: asString(content?.offerBadge, fallback.offerBadge),
    offerHeadline: asString(content?.offerHeadline, fallback.offerHeadline),
    offerBody: asString(content?.offerBody, fallback.offerBody),
    ctaText: asString(content?.ctaText, fallback.ctaText),
    secondaryCtaText: asString(
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
    processSteps: asObjectArray(content?.processSteps, fallback.processSteps, [
      "title",
      "body",
    ]),
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
    trustImageUrl: asString(imageAssets?.trustImageUrl, fallback.trustImageUrl),
  };
}

function mapKnownId(
  value: string | null,
  mapping: Record<string, string>,
  fallback: string
) {
  return value ? mapping[value] ?? value : fallback;
}

function rowToConfig(
  row: LandingPageRow,
  version?: LandingPageVersionRow | null
): LandingPageConfig {
  const fallback =
    getLocalLandingPageBySlug(row.slug) ??
    getLocalLandingPageById(row.slug) ??
    alyssaLandingPages[0];

  const content = mergeContent(fallback, version?.content_json ?? row.content_json);
  const images = mergeImageAssets(
    fallback,
    version?.image_assets_json ?? row.image_assets_json
  );

  return {
    ...fallback,
    ...content,
    ...images,
    id: row.slug,
    slug: row.slug,
    title: row.title,
    brandId: mapKnownId(row.brand_id, supabaseToLocalIds.brand, fallback.brandId),
    treatmentId: mapKnownId(
      row.treatment_id,
      supabaseToLocalIds.treatment,
      fallback.treatmentId
    ),
    packageId: mapKnownId(
      row.package_id,
      supabaseToLocalIds.package,
      fallback.packageId
    ),
    branchId: mapKnownId(row.branch_id, supabaseToLocalIds.branch, fallback.branchId),
    formId: mapKnownId(row.form_id, supabaseToLocalIds.form, fallback.formId),
    formToken: fallback.formToken || alyssaDefaultForm.publicFormToken,
    mode: row.mode,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    latestVersionNumber: version?.version_number ?? null,
    builderSource: "supabase",
  };
}

async function findLandingPageRow(pageId: string) {
  if (!hasSupabaseAdminEnv()) return null;

  const supabase = createSupabaseAdminClient();
  const column = uuidPattern.test(pageId) ? "id" : "slug";
  const { data, error } = await supabase
    .from("landing_pages")
    .select("*")
    .eq(column, pageId)
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

export async function getLandingPageBySlug(slug: string) {
  const row = await findLandingPageRow(slug);
  if (!row) {
    const fallback = getLocalLandingPageBySlug(slug);
    return fallback ? { ...fallback, builderSource: "local_config" as const } : null;
  }

  const version = row.published_version_id
    ? await getVersionById(row.published_version_id)
    : await getLatestVersion(row.id);

  return rowToConfig(row, version);
}

export async function getLandingPageById(id: string) {
  const row = await findLandingPageRow(id);
  if (!row) {
    const fallback =
      getLocalLandingPageById(id) ?? getLocalLandingPageBySlug(id);
    return fallback ? { ...fallback, builderSource: "local_config" as const } : null;
  }

  const version = row.published_version_id
    ? await getVersionById(row.published_version_id)
    : await getLatestVersion(row.id);

  return rowToConfig(row, version);
}

export async function getPublishedLandingPageBySlug(slug: string) {
  if (hasSupabaseAdminEnv()) {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("landing_pages")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle<LandingPageRow>();

    if (error) {
      console.warn("published landing page lookup failed", {
        code: error.code,
        message: error.message,
      });
    } else if (data) {
      const version = data.published_version_id
        ? await getVersionById(data.published_version_id)
        : await getLatestVersion(data.id, "published");
      return rowToConfig(data, version);
    }
  }

  const fallback = getLocalLandingPageBySlug(slug);
  return fallback ? { ...fallback, builderSource: "local_config" as const } : null;
}

export async function getLandingPageEditorData(
  pageId: string
): Promise<LandingPageEditorData | null> {
  if (hasSupabaseAdminEnv()) {
    const row = await findLandingPageRow(pageId);
    if (row) {
      const latestDraft = await getLatestVersion(row.id, "draft");
      const publishedVersion = row.published_version_id
        ? await getVersionById(row.published_version_id)
        : await getLatestVersion(row.id, "published");
      const latestVersion = latestDraft ?? (await getLatestVersion(row.id));
      const page = rowToConfig(row, latestVersion);

      return {
        page,
        source: "supabase",
        canPersist: true,
        statusMessage:
          "這個 Landing Page 已可儲存草稿和發布公開版本。",
        latestDraftVersionNumber: latestDraft?.version_number ?? null,
        publishedVersionNumber: publishedVersion?.version_number ?? null,
      };
    }
  }

  const page = await getLandingPageById(pageId);
  if (!page) return null;

  const canPersist = page.builderSource === "supabase";

  return {
    page,
    source: page.builderSource ?? "local_config",
    canPersist,
    statusMessage: canPersist
      ? "這個 Landing Page 已可儲存草稿和發布公開版本。"
      : "目前只可查看內容；儲存草稿及發布功能稍後開放。",
    latestDraftVersionNumber: null,
    publishedVersionNumber: null,
  };
}

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
          const version = row.published_version_id
            ? await getVersionById(row.published_version_id)
            : await getLatestVersion(row.id);
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
      message: "暫時未能建立 Landing Page 草稿。",
      pageId: null as string | null,
      slug: null as string | null,
    };
  }

  const supabase = createSupabaseAdminClient();
  const slug = await createUniqueLandingPageSlug(input.title);
  const content: LandingPageContent = {
    templateName: "Premium offer landing page",
    testingStatus: "ready_for_testing",
    heroTitle: input.heroTitle,
    heroSubtitle: input.heroSubtitle,
    offerBadge: input.offerBadge,
    offerHeadline: input.title,
    offerBody: input.heroSubtitle,
    ctaText: input.ctaText,
    secondaryCtaText: "查看療程詳情",
    painPoints: [
      "客人需要清楚知道今次優惠適合甚麼需要。",
      "團隊需要快速測試新療程或新文案角度。",
      "每個登記都會連接同一套來源追蹤基礎。",
    ],
    benefits: [
      "清楚展示療程及套餐價錢。",
      "可用於廣告流量測試。",
      "表格會收集客人資料及預約意向。",
    ],
    trustItems: [
      "適合 Alyssa campaign 測試。",
      "Wix 仍然是主要網站。",
      "Landing Page 只用於快速測試優惠及角度。",
    ],
    sections: [
      {
        title: "為 Campaign 測試而設",
        body: "這個 Landing Page 草稿已連接登記表格，可在編輯頁調整文案後再發布。",
      },
    ],
    processSteps: [
      {
        title: "1. 客人提交登記",
        body: "客人透過 Landing Page 內的表格留下資料。",
      },
      {
        title: "2. 團隊跟進",
        body: "團隊可按登記資料安排 WhatsApp 或電話跟進。",
      },
      {
        title: "3. 查看成效",
        body: "之後可在 dashboard 及 performance 頁查看來源及預約成效。",
      },
    ],
    faqs: [
      {
        question: "這會取代 Wix 網站嗎？",
        answer: "不會。Wix 仍然是主要網站；Landing Page 用於快速測試廣告優惠及文案。",
      },
    ],
  };
  const imageAssets: LandingPageImageAssets = {
    heroImageUrl: "",
    mobileHeroImageUrl: "",
    offerImageUrl: "",
    treatmentImageUrl: "",
    processImage1Url: "",
    processImage2Url: "",
    processImage3Url: "",
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
        "Landing Page 已建立，但草稿版本未能建立。請稍後再試或到 Landing Pages 檢查。",
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
      message:
        "目前仍未啟用儲存草稿功能，請先完成 Landing Page 儲存 / 發布設定。",
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
      message: `Draft save failed: ${versionError.message}`,
    };
  }

  const { error: pageError } = await supabase
    .from("landing_pages")
    .update({
      title: meta.title ?? row.title,
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
      message: `Draft page update failed: ${pageError.message}`,
    };
  }

  return {
    ok: true,
    source: "supabase",
    message: `Draft version ${versionNumber} saved.`,
    versionNumber,
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
      message:
        "目前仍未啟用發布功能，請先完成 Landing Page 儲存 / 發布設定。",
    };
  }

  const supabase = createSupabaseAdminClient();
  let version = await getLatestVersion(row.id, "draft");

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
        message: `Publish version creation failed: ${error.message}`,
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
        message: `Publish version update failed: ${error.message}`,
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
      message: `Publish page update failed: ${pageError.message}`,
    };
  }

  return {
    ok: true,
    source: "supabase",
    message: `Published version ${version.version_number}.`,
    versionNumber: version.version_number,
  };
}
