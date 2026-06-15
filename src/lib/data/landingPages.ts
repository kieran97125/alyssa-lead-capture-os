import {
  alyssaBranches,
  alyssaBrand,
  alyssaDefaultForm,
  alyssaPackages,
  alyssaTreatments,
} from "@/lib/data/alyssaConfig";

export type LandingPageMode = "form_only" | "landing_page";
export type LandingPageStatus = "draft" | "active" | "paused" | "published" | "archived";

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
  faqs: Array<{
    question: string;
    answer: string;
  }>;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
  latestVersionNumber?: number | null;
  builderSource?: "local_config" | "supabase";
};

export const defaultLandingPageContent: LandingPageContent = {
  templateName: "高質感優惠 Landing Page",
  testingStatus: "ready_for_testing",
  heroTitle: "HK$388 首次醫學美容體驗",
  heroSubtitle:
    "適合用作廣告測試及預約收集，系統會同時記錄來源資料，方便之後跟進成效。",
  offerBadge: "HK$388 首次體驗優惠",
  offerHeadline: "首次體驗優惠 HK$388",
  offerBody:
    "客人可先了解療程、價錢及分店安排，再提交資料由團隊 WhatsApp 跟進預約。",
  ctaText: "立即預約體驗",
  secondaryCtaText: "查看療程詳情",
  painPoints: [
    "客人預約前需要清楚知道療程、價錢及分店安排。",
    "市場部可以快速測試不同優惠角度，毋須每次重新製作網站頁面。",
    "每個登記都會保留來源及預約資料，方便之後交由團隊跟進。",
  ],
  benefits: [
    "HK$388 首次體驗優惠，降低首次預約門檻。",
    "同一張表格可用於 Wix 或 Landing Page。",
    "保留來源資料，方便之後接駁 CRM。",
  ],
  trustItems: [
    "療程、套餐及分店資料清楚顯示。",
    "提交後可由團隊 WhatsApp 跟進預約。",
    "Wix 仍然是主網站；此頁用作 Campaign 測試。",
  ],
  sections: [
    {
      title: "適合快速測試 Campaign",
      body: "Landing Page 可用於新優惠、新療程或新文案角度測試，毋須每次重新製作完整網站頁面。",
    },
    {
      title: "同一張表格可用於 Wix 或 Landing Page",
      body: "如果 Wix 已有完整內容頁，可只嵌入登記表格；如要快速測試廣告角度，則可使用 Landing Page。",
    },
    {
      title: "保留來源資料，方便之後接駁 CRM",
      body: "登記會保留廣告來源、Campaign、素材及預約資料，方便日後跟進成交、到店及流失結果。",
    },
  ],
  processSteps: [
    {
      title: "1. 了解優惠內容",
      body: "客人先查看療程、套餐價錢及分店安排。",
    },
    {
      title: "2. 提交預約資料",
      body: "表格會收集聯絡方式、預約偏好及來源資料。",
    },
    {
      title: "3. 團隊跟進確認",
      body: "團隊可按登記內容以 WhatsApp 跟進預約及付款安排。",
    },
  ],
  faqs: [
    {
      question: "HK$388 是否需要即時付款？",
      answer:
        "此頁可支援只預約模式。提交後團隊會按情況跟進付款及預約確認安排。",
    },
    {
      question: "這頁會取代 Wix 網站嗎？",
      answer:
        "不會。Wix 仍然是主網站；Landing Page 只用作廣告優惠及文案角度測試。",
    },
    {
      question: "廣告來源會保留嗎？",
      answer:
        "會。由廣告連結帶入的 UTM、click ID 及頁面來源會跟隨登記資料保存，方便之後分析成效。",
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
    trustImageUrl: "",
    createdAt: "2026-06-14T00:00:00.000Z",
    updatedAt: "2026-06-14T00:00:00.000Z",
    publishedAt: "2026-06-14T00:00:00.000Z",
    ...defaultLandingPageContent,
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
    recommendedType: "高質感診所、諮詢或自然亮澤肌膚視覺",
    ratio: "16:9 或 4:3",
  },
  {
    key: "mobileHeroImageUrl",
    label: "手機 Hero 圖片",
    recommendedType: "手機首屏使用的人像、診所或療程近鏡",
    ratio: "4:5",
  },
  {
    key: "offerImageUrl",
    label: "優惠圖片",
    recommendedType: "療程房、儀器細節或體驗價值視覺",
    ratio: "1:1 或 4:5",
  },
  {
    key: "treatmentImageUrl",
    label: "療程圖片",
    recommendedType: "療程、產品服務或效果期待相關視覺",
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
    recommendedType: "WhatsApp 預約確認",
    ratio: "1:1",
  },
  {
    key: "trustImageUrl",
    label: "診所 / 信任圖片",
    recommendedType: "乾淨診所、專業環境或接待區視覺",
    ratio: "16:9",
  },
] as const;

export type LandingPageImageSlotKey = (typeof landingPageImageSlots)[number]["key"];

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
