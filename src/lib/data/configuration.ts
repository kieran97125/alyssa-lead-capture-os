import {
  alyssaBranches,
  alyssaBrand,
  alyssaDefaultForm,
  alyssaPackages,
  alyssaTreatments,
} from "@/lib/data/alyssaConfig";
import { alyssaLandingPages } from "@/lib/data/landingPages";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";

export type BrandSetting = {
  id: string;
  name: string;
  slug: string;
  primaryColor: string | null;
  secondaryColor: string | null;
  whatsappNumber: string | null;
  defaultThankYouUrl: string | null;
};

export type TreatmentSetting = {
  id: string;
  brandId: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
};

export type PackageSetting = {
  id: string;
  treatmentId: string;
  name: string;
  originalPrice: number | string | null;
  promoPrice: number | string | null;
  currency: string;
  paymentRequired: boolean;
  status: string;
};

export type BranchSetting = {
  id: string;
  brandId: string;
  name: string;
  slug: string;
  address: string | null;
  openingHours: string | null;
  status: string;
};

export type FormSetting = {
  id: string;
  publicFormToken: string;
  brandId: string;
  formName: string;
  status: string;
  allowedDomains: string[];
  defaultTreatmentId: string | null;
  defaultPackageId: string | null;
  defaultBranchId: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type LandingPageTemplate = {
  id: string;
  name: string;
  useCase: string;
  recommendedFor: string;
  supportedSections: string[];
  status: "prepared" | "future";
};

export type ConfigurationData = {
  sourceLabel: string;
  brands: BrandSetting[];
  treatments: TreatmentSetting[];
  packages: PackageSetting[];
  branches: BranchSetting[];
  forms: FormSetting[];
  templates: LandingPageTemplate[];
  landingPages: typeof alyssaLandingPages;
};

export const landingPageTemplates: LandingPageTemplate[] = [
  {
    id: "offer-landing-page",
    name: "Offer landing page",
    useCase: "推廣首次體驗、限時優惠或特定 campaign angle。",
    recommendedFor: "Meta / paid social campaign 快速測試",
    supportedSections: ["Hero", "Offer", "Benefits", "Process", "FAQ", "Embedded form"],
    status: "prepared",
  },
  {
    id: "consultation-landing-page",
    name: "Consultation landing page",
    useCase: "用於免費諮詢、膚況分析或先 WhatsApp 跟進的 campaign。",
    recommendedFor: "低門檻查詢、教育型 campaign",
    supportedSections: ["Hero", "Pain points", "Consultation flow", "FAQ", "Embedded form"],
    status: "future",
  },
  {
    id: "treatment-trial-landing-page",
    name: "Treatment trial landing page",
    useCase: "集中介紹單一療程、體驗價同預約流程。",
    recommendedFor: "療程 trial、A/B offer 測試",
    supportedSections: ["Hero", "Treatment summary", "Package", "Trust", "FAQ", "Embedded form"],
    status: "future",
  },
  {
    id: "minimal-form-capture-page",
    name: "Minimal form capture page",
    useCase: "只有簡短文案、CTA 同表格，適合快速驗證廣告受眾。",
    recommendedFor: "快速 market angle smoke test",
    supportedSections: ["Headline", "Offer note", "Embedded form"],
    status: "future",
  },
];

function localConfiguration(): ConfigurationData {
  return {
    sourceLabel: "設定參考",
    brands: [
      {
        id: alyssaBrand.id,
        name: alyssaBrand.name,
        slug: alyssaBrand.slug,
        primaryColor: alyssaBrand.primaryColor,
        secondaryColor: alyssaBrand.secondaryColor,
        whatsappNumber: alyssaBrand.whatsappNumber,
        defaultThankYouUrl: alyssaBrand.defaultThankYouUrl,
      },
    ],
    treatments: alyssaTreatments.map((treatment) => ({
      id: treatment.id,
      brandId: alyssaBrand.id,
      name: treatment.name,
      slug: treatment.slug,
      description: treatment.description,
      status: "active",
    })),
    packages: alyssaPackages.map((item) => ({
      id: item.id,
      treatmentId: item.treatmentId,
      name: item.name,
      originalPrice: item.originalPrice,
      promoPrice: item.promoPrice,
      currency: item.currency,
      paymentRequired: item.paymentRequired,
      status: "active",
    })),
    branches: alyssaBranches.map((branch) => ({
      id: branch.id,
      brandId: alyssaBrand.id,
      name: branch.name,
      slug: branch.slug,
      address: null,
      openingHours: null,
      status: "active",
    })),
    forms: [
      {
        id: alyssaDefaultForm.id,
        publicFormToken: alyssaDefaultForm.publicFormToken,
        brandId: alyssaDefaultForm.brandId,
        formName: alyssaDefaultForm.formName,
        status: alyssaDefaultForm.status,
        allowedDomains: alyssaDefaultForm.allowedDomains,
        defaultTreatmentId: alyssaDefaultForm.defaultTreatmentId,
        defaultPackageId: alyssaDefaultForm.defaultPackageId,
        defaultBranchId: alyssaDefaultForm.defaultBranchId,
        createdAt: null,
        updatedAt: null,
      },
    ],
    templates: landingPageTemplates,
    landingPages: alyssaLandingPages,
  };
}

function asTextArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function moneyValue(value: number | string | null | undefined, currency = "HKD") {
  const amount = typeof value === "string" ? Number(value) : value;
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "未設定";

  return new Intl.NumberFormat("zh-HK", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function packagePriceLabel(item: PackageSetting | null | undefined) {
  if (!item) return "未設定";
  return `${item.name} · ${moneyValue(item.promoPrice, item.currency)}`;
}

export function getBrand(data: ConfigurationData, id: string | null | undefined) {
  return data.brands.find((item) => item.id === id) ?? null;
}

export function getTreatment(data: ConfigurationData, id: string | null | undefined) {
  return data.treatments.find((item) => item.id === id) ?? null;
}

export function getPackage(data: ConfigurationData, id: string | null | undefined) {
  return data.packages.find((item) => item.id === id) ?? null;
}

export function getBranch(data: ConfigurationData, id: string | null | undefined) {
  return data.branches.find((item) => item.id === id) ?? null;
}

export function getLinkedForms(data: ConfigurationData, predicate: (form: FormSetting) => boolean) {
  return data.forms.filter(predicate);
}

export function getLinkedLandingPages(
  data: ConfigurationData,
  predicate: (page: (typeof alyssaLandingPages)[number]) => boolean
) {
  return data.landingPages.filter(predicate);
}

export async function getConfigurationData(): Promise<ConfigurationData> {
  if (!hasSupabaseAdminEnv()) return localConfiguration();

  try {
    const supabase = createSupabaseAdminClient();
    const [brands, treatments, packages, branches, forms] = await Promise.all([
      supabase
        .from("brands")
        .select("id,name,slug,primary_color,secondary_color,whatsapp_number,default_thank_you_url")
        .order("name", { ascending: true }),
      supabase
        .from("treatments")
        .select("id,brand_id,name,slug,description,status")
        .order("name", { ascending: true }),
      supabase
        .from("packages")
        .select("id,treatment_id,name,original_price,promo_price,currency,payment_required,status")
        .order("name", { ascending: true }),
      supabase
        .from("branches")
        .select("id,brand_id,name,slug,address,opening_hours,status")
        .order("name", { ascending: true }),
      supabase
        .from("forms")
        .select("id,public_form_token,brand_id,form_name,status,allowed_domains,default_treatment_id,default_package_id,default_branch_id,created_at,updated_at")
        .order("form_name", { ascending: true }),
    ]);

    if (brands.error) throw brands.error;
    if (treatments.error) throw treatments.error;
    if (packages.error) throw packages.error;
    if (branches.error) throw branches.error;
    if (forms.error) throw forms.error;

    return {
      sourceLabel: "正式設定",
      brands: ((brands.data ?? []) as unknown[]).map((item) => {
        const row = item as Record<string, string | null>;
        return {
          id: row.id ?? "",
          name: row.name ?? "未命名品牌",
          slug: row.slug ?? "",
          primaryColor: row.primary_color ?? null,
          secondaryColor: row.secondary_color ?? null,
          whatsappNumber: row.whatsapp_number ?? null,
          defaultThankYouUrl: row.default_thank_you_url ?? null,
        };
      }),
      treatments: ((treatments.data ?? []) as unknown[]).map((item) => {
        const row = item as Record<string, string | null>;
        return {
          id: row.id ?? "",
          brandId: row.brand_id ?? "",
          name: row.name ?? "未命名療程",
          slug: row.slug ?? "",
          description: row.description ?? null,
          status: row.status ?? "active",
        };
      }),
      packages: ((packages.data ?? []) as unknown[]).map((item) => {
        const row = item as Record<string, string | number | boolean | null>;
        return {
          id: String(row.id ?? ""),
          treatmentId: String(row.treatment_id ?? ""),
          name: String(row.name ?? "未命名套餐"),
          originalPrice:
            typeof row.original_price === "number" || typeof row.original_price === "string"
              ? row.original_price
              : null,
          promoPrice:
            typeof row.promo_price === "number" || typeof row.promo_price === "string"
              ? row.promo_price
              : null,
          currency: String(row.currency ?? "HKD"),
          paymentRequired: Boolean(row.payment_required),
          status: String(row.status ?? "active"),
        };
      }),
      branches: ((branches.data ?? []) as unknown[]).map((item) => {
        const row = item as Record<string, unknown>;
        return {
          id: String(row.id ?? ""),
          brandId: String(row.brand_id ?? ""),
          name: String(row.name ?? "未命名分店"),
          slug: String(row.slug ?? ""),
          address: typeof row.address === "string" ? row.address : null,
          openingHours: row.opening_hours ? JSON.stringify(row.opening_hours) : null,
          status: String(row.status ?? "active"),
        };
      }),
      forms: ((forms.data ?? []) as unknown[]).map((item) => {
        const row = item as Record<string, unknown>;
        return {
          id: String(row.id ?? ""),
          publicFormToken: String(row.public_form_token ?? ""),
          brandId: String(row.brand_id ?? ""),
          formName: String(row.form_name ?? "未命名表格"),
          status: String(row.status ?? "active"),
          allowedDomains: asTextArray(row.allowed_domains),
          defaultTreatmentId:
            typeof row.default_treatment_id === "string" ? row.default_treatment_id : null,
          defaultPackageId:
            typeof row.default_package_id === "string" ? row.default_package_id : null,
          defaultBranchId:
            typeof row.default_branch_id === "string" ? row.default_branch_id : null,
          createdAt: typeof row.created_at === "string" ? row.created_at : null,
          updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
        };
      }),
      templates: landingPageTemplates,
      landingPages: alyssaLandingPages,
    };
  } catch (error) {
    console.error("configuration_data_read_failed", error);
    return localConfiguration();
  }
}
