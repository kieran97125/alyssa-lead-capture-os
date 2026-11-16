import type { ConfigurationData, FormSetting } from "@/lib/data/configuration";
import { defaultLandingPageContent, type LandingPageConfig } from "@/lib/data/landingPages";

export const fixtureIds = {
  brandA: "a1000000-0000-4000-8000-000000000001",
  brandB: "b1000000-0000-4000-8000-000000000001",
  face: "a2000000-0000-4000-8000-000000000001",
  body: "a2000000-0000-4000-8000-000000000002",
  treatmentB: "b2000000-0000-4000-8000-000000000001",
  faceOffer: "a3000000-0000-4000-8000-000000000001",
  bodyOffer: "a3000000-0000-4000-8000-000000000002",
  inactiveOffer: "a3000000-0000-4000-8000-000000000003",
  offerB: "b3000000-0000-4000-8000-000000000001",
  branchA: "a4000000-0000-4000-8000-000000000001",
  branchASecond: "a4000000-0000-4000-8000-000000000002",
  branchB: "b4000000-0000-4000-8000-000000000001",
  activeFormA: "a5000000-0000-4000-8000-000000000001",
  stoppedFormA: "a5000000-0000-4000-8000-000000000002",
  activeFormB: "b5000000-0000-4000-8000-000000000001",
};

const form = (id: string, brandId: string, name: string, status: string, treatmentId: string,
  packageId: string, branchId: string): FormSetting => ({
  id, brandId, formName: name, status,
  revision: 1, placementKind: "wix", placementUrl: "https://example.test/promotion",
  publicFormToken: `fixture-${id}`, allowedDomains: ["https://example.test"],
  defaultTreatmentId: treatmentId, defaultPackageId: packageId,
  defaultBranchId: branchId, packageSelectionMode: "fixed",
  conversionMode: "form_submit_pixel", successRedirectUrl: null,
  createdAt: "2026-11-16T00:00:00.000Z", updatedAt: "2026-11-16T00:00:00.000Z",
});

/** Synthetic choices exercise the real dependent controls without a linked database. */
export const acquisitionFixtureConfig: ConfigurationData = {
  sourceLabel: "隔離驗收資料",
  brands: [
    { id: fixtureIds.brandA, name: "示例美容 A", slug: "fixture-a", primaryColor: null,
      secondaryColor: null, whatsappNumber: null, defaultThankYouUrl: null },
    { id: fixtureIds.brandB, name: "示例美容 B", slug: "fixture-b", primaryColor: null,
      secondaryColor: null, whatsappNumber: null, defaultThankYouUrl: null },
  ],
  treatments: [
    { id: fixtureIds.face, brandId: fixtureIds.brandA, name: "面部護理", slug: "face", description: null, status: "active" },
    { id: fixtureIds.body, brandId: fixtureIds.brandA, name: "身體護理", slug: "body", description: null, status: "active" },
    { id: fixtureIds.treatmentB, brandId: fixtureIds.brandB, name: "塑形護理", slug: "sculpt", description: null, status: "active" },
  ],
  packages: [
    { id: fixtureIds.faceOffer, treatmentId: fixtureIds.face, name: "柔潤面部體驗", groupName: null,
      originalPrice: 880, promoPrice: 480, currency: "HKD", paymentRequired: false, status: "active", displayOrder: 0 },
    { id: fixtureIds.bodyOffer, treatmentId: fixtureIds.body, name: "輕盈身體體驗", groupName: null,
      originalPrice: 980, promoPrice: 580, currency: "HKD", paymentRequired: false, status: "active", displayOrder: 0 },
    { id: fixtureIds.inactiveOffer, treatmentId: fixtureIds.face, name: "已停用舊優惠", groupName: null,
      originalPrice: null, promoPrice: 280, currency: "HKD", paymentRequired: false, status: "archived", displayOrder: 1 },
    { id: fixtureIds.offerB, treatmentId: fixtureIds.treatmentB, name: "塑形體驗", groupName: null,
      originalPrice: 1080, promoPrice: 680, currency: "HKD", paymentRequired: false, status: "active", displayOrder: 0 },
  ],
  branches: [
    { id: fixtureIds.branchA, brandId: fixtureIds.brandA, name: "A 分店一", slug: "branch-a1", address: null, openingHours: null, status: "active" },
    { id: fixtureIds.branchASecond, brandId: fixtureIds.brandA, name: "A 分店二", slug: "branch-a2", address: null, openingHours: null, status: "active" },
    { id: fixtureIds.branchB, brandId: fixtureIds.brandB, name: "B 分店", slug: "branch-b", address: null, openingHours: null, status: "active" },
  ],
  forms: [
    form(fixtureIds.activeFormA, fixtureIds.brandA, "A 現有登記表", "active", fixtureIds.face, fixtureIds.faceOffer, fixtureIds.branchA),
    form(fixtureIds.stoppedFormA, fixtureIds.brandA, "A 已停用登記表", "archived", fixtureIds.body, fixtureIds.bodyOffer, fixtureIds.branchASecond),
    form(fixtureIds.activeFormB, fixtureIds.brandB, "B 現有登記表", "active", fixtureIds.treatmentB, fixtureIds.offerB, fixtureIds.branchB),
  ],
  formBranches: [], formPackages: [], templates: [], landingPages: [],
};

export const acquisitionFixtureDraft: LandingPageConfig = {
  ...defaultLandingPageContent,
  id: "a6000000-0000-4000-8000-000000000001", slug: "fixture-unpublished-draft",
  title: "尚未發布的草稿", brandId: fixtureIds.brandA, treatmentId: fixtureIds.face,
  packageId: fixtureIds.faceOffer, branchId: fixtureIds.branchA,
  formId: fixtureIds.activeFormA, formToken: `fixture-${fixtureIds.activeFormA}`,
  mode: "landing_page", status: "draft", testingStatus: "ready_for_testing",
  templateName: "Offer landing page", heroTitle: "尚未發布的草稿標題",
  heroSubtitle: "這是已儲存草稿的內容，公開頁尚未更新。", offerBadge: "柔潤面部體驗",
  offerHeadline: "面部護理體驗", offerBody: "預覽目前草稿。", ctaText: "預約面部體驗",
  secondaryCtaText: "了解療程", painPoints: [], benefits: ["按需要選擇護理"], trustItems: [],
  sections: [], processSteps: [], contentSections: [], faqs: [], contentSectionsExplicit: true,
  heroImageUrl: "", mobileHeroImageUrl: "", offerImageUrl: "", treatmentImageUrl: "",
  processImage1Url: "", processImage2Url: "", processImage3Url: "", processImage4Url: "",
  processImage5Url: "", processImage6Url: "", trustImageUrl: "",
  createdAt: "2026-11-16T00:00:00.000Z", updatedAt: "2026-11-16T00:00:00.000Z",
  publishedAt: null, latestVersionNumber: 3, builderSource: "supabase",
};
