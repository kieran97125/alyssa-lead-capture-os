import { alyssaDefaultForm } from "@/lib/data/alyssaConfig";

export type LandingPageMode = "form_only" | "landing_page";

export type LandingPageConfig = {
  id: string;
  slug: string;
  title: string;
  brandId: string;
  treatmentId: string;
  packageId: string;
  formId: string;
  formToken: string;
  mode: LandingPageMode;
  status: "draft" | "active" | "paused";
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrl: string;
  offerBadge: string;
  ctaText: string;
  sections: Array<{
    title: string;
    body: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

export const alyssaLandingPages: LandingPageConfig[] = [
  {
    id: "alyssa-main-trial-offer",
    slug: "alyssa-main-trial-offer",
    title: "Alyssa First-Visit Trial Offer",
    brandId: "alyssa-brand-seed",
    treatmentId: alyssaDefaultForm.defaultTreatmentId,
    packageId: alyssaDefaultForm.defaultPackageId,
    formId: alyssaDefaultForm.id,
    formToken: alyssaDefaultForm.publicFormToken,
    mode: "landing_page",
    status: "draft",
    heroTitle: "首次到訪醫學美容體驗",
    heroSubtitle:
      "為想快速測試廣告 offer 的 campaign 提供一頁式登記、來源追蹤同預約提交。",
    heroImageUrl: "",
    offerBadge: "HKD 388 First-Visit Trial",
    ctaText: "預約 WhatsApp 跟進",
    sections: [
      {
        title: "Form-only embed",
        body: "Wix 保持主網站角色；Lead Capture OS 負責表格、UTM、source snapshot 同 lead attribution。",
      },
      {
        title: "Campaign landing page",
        body: "同一份 form config 可以包裝成快速測試用 landing page，仍然使用相同 lead capture model。",
      },
      {
        title: "Future builder direction",
        body: "日後可加入 hero image、copy、offer blocks、FAQ、testimonials 同視覺素材管理。",
      },
    ],
    createdAt: "2026-06-14T00:00:00.000Z",
    updatedAt: "2026-06-14T00:00:00.000Z",
  },
];

export function getLandingPageBySlug(slug: string) {
  return alyssaLandingPages.find((page) => page.slug === slug) ?? null;
}

export function getLandingPageById(id: string) {
  return alyssaLandingPages.find((page) => page.id === id) ?? null;
}
