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
  logoUrl?: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  whatsappNumber: string | null;
  defaultThankYouUrl: string | null;
  legalPageUrl?: string | null;
  legalLinkLabel?: string | null;
  privacyUrl?: string | null;
  disclaimerUrl?: string | null;
  operatorName?: string | null;
  metaPixelId?: string | null;
  metaPixelPageViewOnEmbed?: boolean;
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
  groupName: string | null;
  originalPrice: number | string | null;
  promoPrice: number | string | null;
  currency: string;
  paymentRequired: boolean;
  status: string;
  displayOrder: number;
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
  packageSelectionMode: "fixed" | "customer_choice";
  conversionMode?: "form_submit_pixel" | "thank_you_redirect" | null;
  successRedirectUrl?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type FormBranchSetting = {
  id: string;
  formId: string;
  branchId: string;
  isDefault: boolean;
  isActive: boolean;
  displayOrder: number;
  createdAt?: string | null;
};

export type FormPackageSetting = {
  id: string;
  formId: string;
  packageId: string;
  isDefault: boolean;
  isActive: boolean;
  displayOrder: number;
  createdAt?: string | null;
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
  formBranches: FormBranchSetting[];
  formPackages: FormPackageSetting[];
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
        logoUrl: alyssaBrand.logoUrl,
        primaryColor: alyssaBrand.primaryColor,
        secondaryColor: alyssaBrand.secondaryColor,
        whatsappNumber: alyssaBrand.whatsappNumber,
        defaultThankYouUrl: alyssaBrand.defaultThankYouUrl,
        legalPageUrl: null,
        legalLinkLabel: null,
        privacyUrl: "https://www.alyssa.hk/privacy",
        disclaimerUrl: "https://www.alyssa.hk/disclaimer",
        operatorName: "Alyssa Group Limited",
        metaPixelId: null,
        metaPixelPageViewOnEmbed: false,
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
      groupName: null,
      originalPrice: item.originalPrice,
      promoPrice: item.promoPrice,
      currency: item.currency,
      paymentRequired: item.paymentRequired,
      status: "active",
      displayOrder: 0,
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
        packageSelectionMode: "fixed",
        conversionMode: "thank_you_redirect",
        successRedirectUrl:
          "https://www.alyssa.hk/thankyou?submitted=1&treatment=medical-beauty-trial&value=388",
        createdAt: null,
        updatedAt: null,
      },
    ],
    formBranches: alyssaDefaultForm.defaultBranchId
      ? [
          {
            id: `${alyssaDefaultForm.id}:${alyssaDefaultForm.defaultBranchId}`,
            formId: alyssaDefaultForm.id,
            branchId: alyssaDefaultForm.defaultBranchId,
            isDefault: true,
            isActive: true,
            displayOrder: 0,
            createdAt: null,
          },
        ]
      : [],
    formPackages: alyssaDefaultForm.defaultPackageId
      ? [
          {
            id: `${alyssaDefaultForm.id}:${alyssaDefaultForm.defaultPackageId}`,
            formId: alyssaDefaultForm.id,
            packageId: alyssaDefaultForm.defaultPackageId,
            isDefault: true,
            isActive: true,
            displayOrder: 0,
            createdAt: null,
          },
        ]
      : [],
    templates: landingPageTemplates,
    landingPages: alyssaLandingPages,
  };
}

function asTextArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizeFormConversionMode(
  value: unknown
): FormSetting["conversionMode"] {
  return value === "thank_you_redirect"
    ? "thank_you_redirect"
    : "form_submit_pixel";
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
  const price =
    item.promoPrice !== null && item.promoPrice !== ""
      ? item.promoPrice
      : item.originalPrice;
  return `${item.name} · ${
    price === null || price === "" ? "預約查詢" : moneyValue(price, item.currency)
  }`;
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

export function getFormBranchSettings(data: ConfigurationData, form: FormSetting) {
  const settings = data.formBranches
    .filter((item) => item.formId === form.id && item.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  if (settings.length > 0) return settings;

  return form.defaultBranchId
    ? [
        {
          id: `${form.id}:${form.defaultBranchId}`,
          formId: form.id,
          branchId: form.defaultBranchId,
          isDefault: true,
          isActive: true,
          displayOrder: 0,
          createdAt: null,
        },
      ]
    : [];
}

export function getFormBranches(data: ConfigurationData, form: FormSetting) {
  return getFormBranchSettings(data, form)
    .map((item) => getBranch(data, item.branchId))
    .filter((item): item is BranchSetting => Boolean(item));
}

export function getFormPackageSettings(
  data: ConfigurationData,
  form: FormSetting
) {
  const settings = data.formPackages
    .filter((item) => item.formId === form.id && item.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  if (settings.length > 0) return settings;

  return form.defaultPackageId
    ? [
        {
          id: `${form.id}:${form.defaultPackageId}`,
          formId: form.id,
          packageId: form.defaultPackageId,
          isDefault: true,
          isActive: true,
          displayOrder: 0,
          createdAt: null,
        },
      ]
    : [];
}

export function getFormPackages(data: ConfigurationData, form: FormSetting) {
  return getFormPackageSettings(data, form)
    .map((item) => getPackage(data, item.packageId))
    .filter((item): item is PackageSetting => Boolean(item));
}

function fallbackFormBranches(forms: FormSetting[]): FormBranchSetting[] {
  return forms
    .filter((form) => Boolean(form.defaultBranchId))
    .map((form) => ({
      id: `${form.id}:${form.defaultBranchId}`,
      formId: form.id,
      branchId: form.defaultBranchId as string,
      isDefault: true,
      isActive: true,
      displayOrder: 0,
      createdAt: null,
    }));
}

function fallbackFormPackages(forms: FormSetting[]): FormPackageSetting[] {
  return forms
    .filter((form) => Boolean(form.defaultPackageId))
    .map((form) => ({
      id: `${form.id}:${form.defaultPackageId}`,
      formId: form.id,
      packageId: form.defaultPackageId as string,
      isDefault: true,
      isActive: true,
      displayOrder: 0,
      createdAt: null,
    }));
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
      supabase.from("brands").select("*").order("name", { ascending: true }),
      supabase
        .from("treatments")
        .select("id,brand_id,name,slug,description,status")
        .order("name", { ascending: true }),
      supabase
        .from("packages")
        .select("*")
        .order("created_at", { ascending: true }),
      supabase
        .from("branches")
        .select("id,brand_id,name,slug,address,opening_hours,status")
        .order("name", { ascending: true }),
      supabase
        .from("forms")
        .select("*")
        .order("form_name", { ascending: true }),
    ]);

    if (brands.error) throw brands.error;
    if (treatments.error) throw treatments.error;
    if (packages.error) throw packages.error;
    if (branches.error) throw branches.error;
    if (forms.error) throw forms.error;

    const mappedForms: FormSetting[] = ((forms.data ?? []) as unknown[]).map((item) => {
      const row = item as Record<string, unknown>;
      return {
        id: String(row.id ?? ""),
        publicFormToken: String(row.public_form_token ?? ""),
        brandId: String(row.brand_id ?? ""),
        formName: String(row.form_name ?? "Untitled form"),
        status: String(row.status ?? "active"),
        allowedDomains: asTextArray(row.allowed_domains),
        defaultTreatmentId:
          typeof row.default_treatment_id === "string" ? row.default_treatment_id : null,
        defaultPackageId:
          typeof row.default_package_id === "string" ? row.default_package_id : null,
        defaultBranchId:
          typeof row.default_branch_id === "string" ? row.default_branch_id : null,
        packageSelectionMode:
          row.package_selection_mode === "customer_choice"
            ? "customer_choice"
            : "fixed",
        conversionMode: normalizeFormConversionMode(row.conversion_mode),
        successRedirectUrl:
          typeof row.success_redirect_url === "string"
            ? row.success_redirect_url
            : null,
        createdAt: typeof row.created_at === "string" ? row.created_at : null,
        updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
      };
    });
    const formBranches = await supabase
      .from("form_branches")
      .select("id,form_id,branch_id,is_default,is_active,display_order,created_at")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });
    const mappedFormBranches = formBranches.error
      ? fallbackFormBranches(mappedForms)
      : ((formBranches.data ?? []) as unknown[]).map((item) => {
          const row = item as Record<string, unknown>;
          return {
            id: String(row.id ?? ""),
            formId: String(row.form_id ?? ""),
            branchId: String(row.branch_id ?? ""),
            isDefault: Boolean(row.is_default),
            isActive: row.is_active !== false,
            displayOrder:
              typeof row.display_order === "number" ? row.display_order : 0,
            createdAt: typeof row.created_at === "string" ? row.created_at : null,
          };
        });

    if (formBranches.error) {
      console.warn("form_branches_read_failed", {
        code: formBranches.error.code,
        message: formBranches.error.message,
      });
    }
    const formPackages = await supabase
      .from("form_packages")
      .select("id,form_id,package_id,is_default,is_active,display_order,created_at")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });
    const mappedFormPackages = formPackages.error
      ? fallbackFormPackages(mappedForms)
      : ((formPackages.data ?? []) as unknown[]).map((item) => {
          const row = item as Record<string, unknown>;
          return {
            id: String(row.id ?? ""),
            formId: String(row.form_id ?? ""),
            packageId: String(row.package_id ?? ""),
            isDefault: Boolean(row.is_default),
            isActive: row.is_active !== false,
            displayOrder:
              typeof row.display_order === "number" ? row.display_order : 0,
            createdAt: typeof row.created_at === "string" ? row.created_at : null,
          };
        });

    if (formPackages.error) {
      console.warn("form_packages_read_failed", {
        code: formPackages.error.code,
        message: formPackages.error.message,
      });
    }

    return {
      sourceLabel: "正式設定",
      brands: ((brands.data ?? []) as unknown[]).map((item) => {
        const row = item as Record<string, unknown>;
        return {
          id: typeof row.id === "string" ? row.id : "",
          name:
            typeof row.name === "string" ? row.name : "未命名品牌",
          slug: typeof row.slug === "string" ? row.slug : "",
          logoUrl: typeof row.logo_url === "string" ? row.logo_url : null,
          primaryColor:
            typeof row.primary_color === "string" ? row.primary_color : null,
          secondaryColor:
            typeof row.secondary_color === "string"
              ? row.secondary_color
              : null,
          whatsappNumber:
            typeof row.whatsapp_number === "string"
              ? row.whatsapp_number
              : null,
          defaultThankYouUrl:
            typeof row.default_thank_you_url === "string"
              ? row.default_thank_you_url
              : null,
          legalPageUrl:
            typeof row.legal_page_url === "string" ? row.legal_page_url : null,
          legalLinkLabel:
            typeof row.legal_link_label === "string"
              ? row.legal_link_label
              : null,
          privacyUrl:
            typeof row.privacy_url === "string" ? row.privacy_url : null,
          disclaimerUrl:
            typeof row.disclaimer_url === "string"
              ? row.disclaimer_url
              : null,
          operatorName:
            typeof row.operator_name === "string" ? row.operator_name : null,
          metaPixelId:
            typeof row.meta_pixel_id === "string" ? row.meta_pixel_id : null,
          metaPixelPageViewOnEmbed:
            row.meta_pixel_pageview_on_embed === true,
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
      packages: ((packages.data ?? []) as unknown[])
        .map((item) => {
          const row = item as Record<string, string | number | boolean | null>;
          return {
            id: String(row.id ?? ""),
            treatmentId: String(row.treatment_id ?? ""),
            name: String(row.name ?? "未命名套餐"),
            groupName:
              typeof row.group_name === "string" && row.group_name.trim()
                ? row.group_name
                : null,
            originalPrice:
              typeof row.original_price === "number" ||
              typeof row.original_price === "string"
                ? row.original_price
                : null,
            promoPrice:
              typeof row.promo_price === "number" ||
              typeof row.promo_price === "string"
                ? row.promo_price
                : null,
            currency: String(row.currency ?? "HKD"),
            paymentRequired: Boolean(row.payment_required),
            status: String(row.status ?? "active"),
            displayOrder:
              typeof row.display_order === "number" ? row.display_order : 0,
          };
        })
        .sort(
          (a, b) =>
            a.displayOrder - b.displayOrder ||
            a.name.localeCompare(b.name, "zh-HK")
        ),
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
          packageSelectionMode:
            row.package_selection_mode === "customer_choice"
              ? "customer_choice"
              : "fixed",
          conversionMode: normalizeFormConversionMode(row.conversion_mode),
          successRedirectUrl:
            typeof row.success_redirect_url === "string"
              ? row.success_redirect_url
              : null,
          createdAt: typeof row.created_at === "string" ? row.created_at : null,
          updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
        };
      }),
      formBranches: mappedFormBranches,
      formPackages: mappedFormPackages,
      templates: landingPageTemplates,
      landingPages: alyssaLandingPages,
    };
  } catch (error) {
    console.error("configuration_data_read_failed", error);
    return localConfiguration();
  }
}
