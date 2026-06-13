import {
  alyssaBranches,
  alyssaBrand,
  alyssaDefaultForm,
  alyssaPackages,
  alyssaTreatments,
} from "@/lib/data/alyssaConfig";

export type LandingPageMode = "form_only" | "landing_page";

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
  status: "draft" | "active" | "paused";
  testingStatus: "foundation" | "ready_for_testing";
  templateName: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrl: string;
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
};

export const alyssaLandingPages: LandingPageConfig[] = [
  {
    id: "alyssa-main-trial-offer",
    slug: "alyssa-main-trial-offer",
    title: "Alyssa 首次體驗療程 Campaign",
    brandId: alyssaBrand.id,
    treatmentId: alyssaDefaultForm.defaultTreatmentId,
    packageId: alyssaDefaultForm.defaultPackageId,
    branchId: alyssaDefaultForm.defaultBranchId,
    formId: alyssaDefaultForm.id,
    formToken: alyssaDefaultForm.publicFormToken,
    mode: "landing_page",
    status: "draft",
    testingStatus: "ready_for_testing",
    templateName: "Premium offer landing page",
    heroTitle: "首次到訪醫學美容體驗",
    heroSubtitle:
      "為首次了解 Alyssa 的客人而設，一頁完成療程了解、優惠確認同預約登記，同時保留廣告來源追蹤。",
    heroImageUrl:
      "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=1200&q=80",
    offerBadge: "HKD 388 First-Visit Trial",
    offerHeadline: "首次體驗優惠 HK$388",
    offerBody:
      "適合想先了解膚況、療程方向同預算配搭的客人。提交後由團隊以 WhatsApp 跟進預約。",
    ctaText: "立即預約體驗",
    secondaryCtaText: "先了解療程內容",
    painPoints: [
      "想試醫美療程，但唔想一開始就被 hard sell",
      "想知道自己膚況適合咩療程同預算方向",
      "想比較不同廣告 offer 的預約反應同來源質素",
    ],
    benefits: [
      "以 HK$388 體驗首次療程 offer",
      "登記時保留 UTM、click ID 同來源資料",
      "預約資料可日後銜接 WhatsApp CRM 跟進",
    ],
    trustItems: [
      "香港客人常用 WhatsApp 跟進流程",
      "同一 shared lead base，日後可回寫 paid / show / lost outcome",
      "Wix 主網站不變，campaign page 用於快速測試",
    ],
    sections: [
      {
        title: "適合首次了解 Alyssa 的客人",
        body: "Landing page mode 將 offer、療程重點同登記表格放在同一頁，減少跳轉，適合廣告 campaign 快速測試。",
      },
      {
        title: "保持 Form-only mode",
        body: "如 Wix 已有完整內容頁，仍可只嵌入表格；Landing page mode 只是額外 campaign testing layer。",
      },
      {
        title: "CRM-ready attribution",
        body: "Lead Capture OS 負責保留來源資料同 lead base；WhatsApp CRM app 日後負責 CS follow-up 同 outcome write-back。",
      },
    ],
    processSteps: [
      {
        title: "1. 留低基本資料",
        body: "客人選擇療程、套餐、分店同預約時段，系統同步保存來源資料。",
      },
      {
        title: "2. WhatsApp 跟進",
        body: "團隊按登記資料確認時間、分店同療程安排。",
      },
      {
        title: "3. 到店體驗",
        body: "日後 CRM app 可把 paid / show / no-show / lost outcome 回寫到 shared lead base。",
      },
    ],
    faqs: [
      {
        question: "HK$388 是否代表已付款？",
        answer:
          "不是。booking_only 代表客人只提交預約，未啟動付款流程；套餐價錢仍會保留作 offer 金額。",
      },
      {
        question: "這頁會取代 Wix 主網站嗎？",
        answer:
          "不會。Wix 仍然是主網站；這頁只用於快速測試 campaign、offer 同廣告角度。",
      },
      {
        question: "UTM 同 fbclid 會保留嗎？",
        answer:
          "會。public landing page 使用同一 embed script，會把 parent page URL 上的 UTM / click ID 傳入表格 submit flow。",
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
