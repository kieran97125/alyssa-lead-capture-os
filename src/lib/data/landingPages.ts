import {
  alyssaBranches,
  alyssaBrand,
  alyssaDefaultForm,
  alyssaPackages,
  alyssaTreatments,
} from "@/lib/data/alyssaConfig";

export type LandingPageMode = "form_only" | "landing_page";
export type LandingPageStatus =
  | "draft"
  | "active"
  | "paused"
  | "published"
  | "archived";

export type LandingPageContentSectionType =
  | "text"
  | "image_text"
  | "cards"
  | "steps"
  | "faq"
  | "image_grid";

export type LandingPageContentSectionLayout =
  | "text"
  | "image_text"
  | "two_cards"
  | "three_cards"
  | "cards"
  | "steps"
  | "faq"
  | "image_grid";

export type LandingPageContentSectionColumns = 1 | 2 | 3 | 4;
export type LandingPageContentSectionImageMode =
  | "none"
  | "optional"
  | "required";

export type LandingPageContentSectionItem = {
  id: string;
  title: string;
  body: string;
  imageUrl: string;
  caption: string;
  ctaText: string;
  ctaUrl: string;
};

export type LandingPageContentSection = {
  id: string;
  name: string;
  type: LandingPageContentSectionType;
  layout: LandingPageContentSectionLayout;
  label: string;
  title: string;
  subtitle: string;
  columns: LandingPageContentSectionColumns;
  itemImageMode: LandingPageContentSectionImageMode;
  order?: number;
  items: LandingPageContentSectionItem[];
};

export type LandingPageContent = {
  templateName: string;
  testingStatus: "foundation" | "ready_for_testing";
  heroTitle: string;
  heroSubtitle: string;
  offerBadge: string;
  offerHeadline: string;
  offerBody: string;
  ctaText: string;
  secondaryCtaText: string;
  painPoints: string[];
  benefits: string[];
  trustItems: string[];
  sections: Array<{
    title: string;
    body: string;
  }>;
  processSteps: Array<{
    title: string;
    body: string;
  }>;
  contentSections: LandingPageContentSection[];
  faqs: Array<{
    question: string;
    answer: string;
  }>;
};

export type LandingPageImageAssets = {
  heroImageUrl: string;
  mobileHeroImageUrl: string;
  offerImageUrl: string;
  treatmentImageUrl: string;
  processImage1Url: string;
  processImage2Url: string;
  processImage3Url: string;
  processImage4Url: string;
  processImage5Url: string;
  processImage6Url: string;
  trustImageUrl: string;
};

export type LandingPageConfig = {
  id: string;
  slug: string;
  title: string;
  brandId: string;
  treatmentId: string;
  packageId: string;
  branchId: string;
  formId: string;
  formToken: string;
  mode: LandingPageMode;
  status: LandingPageStatus;
  testingStatus: "foundation" | "ready_for_testing";
  templateName: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrl: string;
  mobileHeroImageUrl: string;
  offerImageUrl: string;
  treatmentImageUrl: string;
  processImage1Url: string;
  processImage2Url: string;
  processImage3Url: string;
  processImage4Url: string;
  processImage5Url: string;
  processImage6Url: string;
  trustImageUrl: string;
  offerBadge: string;
  offerHeadline: string;
  offerBody: string;
  ctaText: string;
  secondaryCtaText: string;
  painPoints: string[];
  benefits: string[];
  trustItems: string[];
  sections: Array<{
    title: string;
    body: string;
  }>;
  processSteps: Array<{
    title: string;
    body: string;
  }>;
  contentSections: LandingPageContentSection[];
  faqs: Array<{
    question: string;
    answer: string;
  }>;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
  latestVersionNumber?: number | null;
  builderSource?: "local_config" | "supabase";
  contentSectionsExplicit?: boolean;
};

export const defaultLandingPageContent: LandingPageContent = {
  templateName: "Offer landing page",
  testingStatus: "ready_for_testing",
  heroTitle: "HK$388 首次療程體驗",
  heroSubtitle:
    "適合想先了解療程、價錢及分店安排的客人，由團隊跟進預約及確認細節。",
  offerBadge: "HK$388 首次體驗優惠",
  offerHeadline: "首次療程體驗 HK$388",
  offerBody:
    "提交資料後，團隊會按你選擇的療程、套餐及分店安排跟進，協助確認適合你的體驗時間。",
  ctaText: "立即預約體驗",
  secondaryCtaText: "查看療程詳情",
  painPoints: [
    "預約前想清楚了解療程內容及價錢。",
    "希望有團隊協助確認分店、時間及療程安排。",
    "想用較低門檻先體驗服務，再決定下一步。",
  ],
  benefits: [
    "首次體驗價清晰，預約前已知道套餐安排。",
    "團隊會按你提交的資料跟進，減少來回溝通時間。",
    "適合用作新療程或新優惠的廣告落地頁。",
  ],
  trustItems: [
    "清楚列明療程、套餐、價錢及分店資訊。",
    "提交資料後由團隊跟進預約安排。",
    "頁面只保留客人需要知道的公開資訊。",
  ],
  sections: [
    {
      title: "體驗前先了解重點",
      body: "客人可以在預約前快速了解療程、價錢及分店安排，減少不必要疑問。",
    },
    {
      title: "適合首次體驗客人",
      body: "以清楚優惠及簡單表格收集預約資料，方便團隊跟進。",
    },
    {
      title: "流程簡單清晰",
      body: "客人提交資料後，團隊會按所選療程及分店確認下一步安排。",
    },
  ],
  processSteps: [
    {
      title: "1. 填寫預約資料",
      body: "留下姓名、電話、療程及心水預約時間。",
    },
    {
      title: "2. 團隊跟進確認",
      body: "團隊會根據提交資料確認分店、時間及療程安排。",
    },
    {
      title: "3. 到店體驗療程",
      body: "按確認時間到店，由團隊提供療程體驗及建議。",
    },
  ],
  contentSections: [],
  faqs: [
    {
      question: "HK$388 包括什麼？",
      answer:
        "實際內容會按所選療程及套餐安排確認，團隊會在跟進時清楚說明。",
    },
    {
      question: "提交後幾時會有人聯絡？",
      answer: "團隊會盡快按你提交的電話或 WhatsApp 資料跟進。",
    },
    {
      question: "可以先查詢再決定嗎？",
      answer: "可以。提交表格後，團隊可先協助確認療程及預約細節。",
    },
  ],
};

export const alyssaLandingPages: LandingPageConfig[] = [
  {
    id: "alyssa-main-trial-offer",
    slug: "alyssa-main-trial-offer",
    title: "Alyssa 首次體驗 Campaign",
    brandId: alyssaBrand.id,
    treatmentId: alyssaDefaultForm.defaultTreatmentId,
    packageId: alyssaDefaultForm.defaultPackageId,
    branchId: alyssaDefaultForm.defaultBranchId,
    formId: alyssaDefaultForm.id,
    formToken: alyssaDefaultForm.publicFormToken,
    mode: "landing_page",
    status: "published",
    heroImageUrl:
      "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=1200&q=80",
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
    createdAt: "2026-06-14T00:00:00.000Z",
    updatedAt: "2026-06-14T00:00:00.000Z",
    publishedAt: "2026-06-14T00:00:00.000Z",
    ...defaultLandingPageContent,
  },
  {
    id: "ineffable-388-488b24",
    slug: "ineffable-388-488b24",
    title: "Ineffable Beauty $388 柔清舒敏針清",
    brandId: alyssaBrand.id,
    treatmentId: alyssaDefaultForm.defaultTreatmentId,
    packageId: alyssaDefaultForm.defaultPackageId,
    branchId: alyssaDefaultForm.defaultBranchId,
    formId: alyssaDefaultForm.id,
    formToken: alyssaDefaultForm.publicFormToken,
    mode: "landing_page",
    status: "published",
    heroImageUrl: "/ineffable-wix/assets/hero-model.png",
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
    createdAt: "2026-06-14T00:00:00.000Z",
    updatedAt: "2026-06-14T00:00:00.000Z",
    publishedAt: "2026-06-14T00:00:00.000Z",
    ...defaultLandingPageContent,
    heroTitle: "$388 柔清舒敏針清",
    offerBadge: "HK$388 首次體驗優惠",
    offerHeadline: "$388 柔清舒敏針清",
  },
  {
    id: "ineffable-388-13e933",
    slug: "ineffable-388-13e933",
    title: "$388 柔清舒敏護理首次體驗",
    brandId: alyssaBrand.id,
    treatmentId: alyssaDefaultForm.defaultTreatmentId,
    packageId: alyssaDefaultForm.defaultPackageId,
    branchId: alyssaDefaultForm.defaultBranchId,
    formId: alyssaDefaultForm.id,
    formToken: alyssaDefaultForm.publicFormToken,
    mode: "landing_page",
    status: "published",
    heroImageUrl: "/ineffable-wix/assets/hero-model.png",
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
    createdAt: "2026-06-18T00:00:00.000Z",
    updatedAt: "2026-06-18T00:00:00.000Z",
    publishedAt: "2026-06-18T00:00:00.000Z",
    ...defaultLandingPageContent,
    heroTitle: "$388 柔清舒敏護理首次體驗",
    offerBadge: "HK$388 首次體驗優惠",
    offerHeadline: "$388 柔清舒敏護理首次體驗",
  },
];

export function getLandingPageBySlug(slug: string) {
  return alyssaLandingPages.find((page) => page.slug === slug) ?? null;
}

export function getLandingPageById(id: string) {
  return alyssaLandingPages.find((page) => page.id === id) ?? null;
}

export const landingPageImageSlots = [
  {
    key: "heroImageUrl",
    label: "Hero 圖片",
    recommendedType: "高級診所、諮詢、亮澤肌膚或療程氛圍主視覺",
    ratio: "16:9 或 4:3",
  },
  {
    key: "mobileHeroImageUrl",
    label: "手機 Hero 圖片",
    recommendedType: "適合手機首屏的直向主視覺",
    ratio: "4:5",
  },
  {
    key: "offerImageUrl",
    label: "優惠圖片",
    recommendedType: "療程房、儀器細節、套餐價值或優惠視覺",
    ratio: "1:1 或 4:5",
  },
  {
    key: "treatmentImageUrl",
    label: "療程圖片",
    recommendedType: "療程、產品、儀器或服務體驗視覺",
    ratio: "1:1 或 4:5",
  },
  {
    key: "processImage1Url",
    label: "流程圖片 1",
    recommendedType: "諮詢或皮膚分析",
    ratio: "1:1",
  },
  {
    key: "processImage2Url",
    label: "流程圖片 2",
    recommendedType: "療程體驗",
    ratio: "1:1",
  },
  {
    key: "processImage3Url",
    label: "流程圖片 3",
    recommendedType: "預約確認或 WhatsApp 跟進",
    ratio: "1:1",
  },
  {
    key: "processImage4Url",
    label: "步驟圖片 4",
    recommendedType: "療程流程或舒緩修護畫面",
    ratio: "1:1",
  },
  {
    key: "processImage5Url",
    label: "步驟圖片 5",
    recommendedType: "療程流程或效果說明畫面",
    ratio: "1:1",
  },
  {
    key: "processImage6Url",
    label: "步驟圖片 6",
    recommendedType: "療程完成或預約跟進畫面",
    ratio: "1:1",
  },
  {
    key: "trustImageUrl",
    label: "診所 / 信任圖片",
    recommendedType: "乾淨診所、專業環境或團隊形象",
    ratio: "16:9",
  },
] as const;

export type LandingPageImageSlotKey =
  (typeof landingPageImageSlots)[number]["key"];

export function getLandingPageImageUrl(
  page: LandingPageConfig,
  key: LandingPageImageSlotKey
) {
  return page[key];
}

export function getLandingPageImageStatus(page: LandingPageConfig) {
  const filledCount = landingPageImageSlots.filter((slot) =>
    Boolean(getLandingPageImageUrl(page, slot.key))
  ).length;

  if (filledCount === 0) return "尚未設定圖片";
  if (filledCount === landingPageImageSlots.length) return "已設定圖片";
  return "部分設定圖片";
}

function contentSectionTypeFromLayout(
  layout: LandingPageContentSectionLayout,
  label = "",
  title = ""
): LandingPageContentSectionType {
  if (layout === "two_cards") return "cards";
  if (layout === "three_cards") {
    const text = `${label} ${title}`.toLowerCase();
    return text.includes("step") || text.includes("流程") || text.includes("療程")
      ? "steps"
      : "cards";
  }
  if (layout === "cards" || layout === "steps") return layout;
  return layout;
}

function columnsFromLayout(
  layout: LandingPageContentSectionLayout
): LandingPageContentSectionColumns {
  if (layout === "two_cards") return 2;
  if (layout === "three_cards" || layout === "image_grid") return 3;
  return 1;
}

function imageModeFromType(
  type: LandingPageContentSectionType
): LandingPageContentSectionImageMode {
  if (type === "text" || type === "faq") return "none";
  if (type === "steps" || type === "image_grid") return "required";
  return "optional";
}

export function normalizeLandingPageContentSection(
  section: LandingPageContentSection,
  index = 0
): LandingPageContentSection {
  const layout = section.layout ?? section.type ?? "text";
  const label = section.label || section.name || "";
  const type = contentSectionTypeFromLayout(
    layout as LandingPageContentSectionLayout,
    label,
    section.title
  );
  const columns =
    section.columns && [1, 2, 3, 4].includes(section.columns)
      ? section.columns
      : columnsFromLayout(layout as LandingPageContentSectionLayout);
  const itemImageMode =
    section.itemImageMode &&
    ["none", "optional", "required"].includes(section.itemImageMode)
      ? section.itemImageMode
      : imageModeFromType(type);

  return {
    id: section.id || `section-${index + 1}`,
    name: section.name || label || section.title || `Section ${index + 1}`,
    type,
    layout: type,
    label: label || section.name || section.title || "",
    title: section.title || "",
    subtitle: section.subtitle || "",
    columns,
    itemImageMode,
    order: section.order ?? index + 1,
    items: (section.items ?? []).map((item, itemIndex) => ({
      id: item.id || `item-${itemIndex + 1}`,
      title: item.title || "",
      body: item.body || "",
      imageUrl: item.imageUrl || "",
      caption: item.caption || "",
      ctaText: item.ctaText || "",
      ctaUrl: item.ctaUrl || "",
    })),
  };
}

export function normalizeLandingPageContentSections(
  sections: LandingPageContentSection[]
) {
  return sections
    .map((section, index) => normalizeLandingPageContentSection(section, index))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function getResolvedLandingPageContentSections(
  page: LandingPageConfig
): LandingPageContentSection[] {
  if (page.contentSectionsExplicit) {
    return normalizeLandingPageContentSections(page.contentSections);
  }

  if (page.contentSections.length > 0) {
    return normalizeLandingPageContentSections(page.contentSections);
  }

  const processImages = [
    page.processImage1Url,
    page.processImage2Url,
    page.processImage3Url,
    page.processImage4Url,
    page.processImage5Url,
    page.processImage6Url,
  ];
  const processItems = processImages
    .map((imageUrl, index) => ({
      id: `legacy-step-${index + 1}`,
      title: page.processSteps[index]?.title || "",
      body: page.processSteps[index]?.body || "",
      imageUrl,
      caption: "",
      ctaText: "",
      ctaUrl: "",
    }))
    .filter((item) => item.imageUrl);
  const sections: LandingPageContentSection[] = [];

  if (processItems.length > 0) {
    sections.push({
      id: "legacy-treatment-steps",
      name: "??瘚?",
      type: "steps",
      layout: "steps",
      label: "療程流程",
      title: "由清潔到舒緩修護",
      subtitle: "了解每一步療程安排，預約前更清楚。",
      columns: processItems.length >= 4 ? 4 : 3,
      itemImageMode: "required",
      order: 1,
      items: processItems,
    });
  }

  return normalizeLandingPageContentSections(sections);
}

export function getLandingPageContext(page: LandingPageConfig) {
  const brand = page.brandId === alyssaBrand.id ? alyssaBrand : null;
  const treatment =
    alyssaTreatments.find((item) => item.id === page.treatmentId) ?? null;
  const selectedPackage =
    alyssaPackages.find((item) => item.id === page.packageId) ?? null;
  const branch = alyssaBranches.find((item) => item.id === page.branchId) ?? null;

  return {
    brand,
    treatment,
    package: selectedPackage,
    branch,
  };
}
