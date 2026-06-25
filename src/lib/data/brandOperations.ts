import {
  getBranch,
  getBrand,
  getFormBranches,
  getFormBranchSettings,
  getPackage,
  getTreatment,
  packagePriceLabel,
  type ConfigurationData,
  type FormSetting,
} from "@/lib/data/configuration";
import { getPublicEmbedPreviewUrl, getPublicPathUrl } from "@/lib/data/appUrl";

export const META_URL_PARAMETER_GUIDE =
  "utm_source=meta&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}&placement={{placement}}&lh_source=meta&lh_medium=paid_social&lh_campaign={{campaign.name}}&lh_content={{ad.name}}&lh_term={{adset.name}}&lh_campaign_id={{campaign.id}}&lh_adset_id={{adset.id}}&lh_ad_id={{ad.id}}&lh_placement={{placement}}";

export function normalizeBrandSlug(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

export function isLikelyTestBrand(
  brand: { name?: string | null; slug?: string | null } | null | undefined
) {
  const name = normalizeBrandSlug(brand?.name);
  const slug = normalizeBrandSlug(brand?.slug);
  const combined = `${name} ${slug}`;

  return (
    combined.includes("codex used brand 50969") ||
    combined.includes("codex-used-brand-50969") ||
    combined.includes("test brand") ||
    combined.includes("seed brand")
  );
}

export function getVisibleBrands<T extends { name?: string | null; slug?: string | null }>(
  brands: T[]
) {
  return brands.filter((brand) => !isLikelyTestBrand(brand));
}

export function getBrandPixelId(brandSlug: string | null | undefined) {
  const slug = normalizeBrandSlug(brandSlug);

  if (slug === "alyssa" || slug.startsWith("alyssa-")) {
    return process.env.NEXT_PUBLIC_META_PIXEL_ID_ALYSSA?.trim() || "";
  }

  if (slug === "ineffable" || slug === "ineffable-beauty") {
    return (
      process.env.NEXT_PUBLIC_META_PIXEL_ID_INEFFABLE?.trim() ||
      process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ||
      ""
    );
  }

  return process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || "";
}

export function getBrandSuggestedDomains(brandSlug: string | null | undefined) {
  const slug = normalizeBrandSlug(brandSlug);

  if (slug === "alyssa" || slug.startsWith("alyssa-")) {
    return [
      "https://www.alyssa.hk",
      "https://alyssa.hk",
      "https://go.beautytrialhk.com",
    ];
  }

  if (slug === "ineffable" || slug === "ineffable-beauty") {
    return [
      "https://www.ineffablebeautyhk.com",
      "https://ineffablebeautyhk.com",
      "https://go.beautytrialhk.com",
    ];
  }

  return ["https://go.beautytrialhk.com"];
}

function slugSafe(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function shortToken(value: string) {
  const parts = value.split("-").filter(Boolean);
  return slugSafe(parts.slice(-2).join("-") || value).slice(0, 18) || "form";
}

export function buildWixEmbedCode({
  form,
  brandSlug,
  pixelId,
  eventValue,
  version = "20260623",
}: {
  form: FormSetting;
  brandSlug: string;
  pixelId?: string;
  eventValue?: number | string | null;
  version?: string;
}) {
  const safeBrandSlug = slugSafe(brandSlug || "brand");
  const targetId = `launchhub-${safeBrandSlug}-form-${shortToken(
    form.publicFormToken
  )}`;
  const lines = [
    `<div id="${targetId}"></div>`,
    "",
    `<script`,
    `  src="${getPublicPathUrl(`/embed/alyssa-form.js?v=${version}`)}"`,
    `  data-form-token="${form.publicFormToken}"`,
    `  data-brand="${safeBrandSlug}"`,
    `  data-form-id="${form.id}"`,
  ];

  if (pixelId) {
    lines.push(`  data-pixel-id="${pixelId}"`);
    lines.push(`  data-pixel-event-value="${eventValue || 388}"`);
    lines.push(`  data-pixel-currency="HKD"`);
  }

  lines.push(`  data-target="#${targetId}">`);
  lines.push(`</script>`);

  return lines.join("\n");
}

export function getFormOperations(config: ConfigurationData, form: FormSetting) {
  const brand = getBrand(config, form.brandId);
  const treatment = getTreatment(config, form.defaultTreatmentId);
  const selectedPackage = getPackage(config, form.defaultPackageId);
  const branches = getFormBranches(config, form);
  const branchSettings = getFormBranchSettings(config, form);
  const defaultBranchId =
    branchSettings.find((item) => item.isDefault)?.branchId ||
    form.defaultBranchId ||
    branches[0]?.id ||
    null;
  const branch = getBranch(config, defaultBranchId);
  const branchLabel =
    branches.length > 1
      ? `多分店（${branches.length}）`
      : branch?.name || "未設定";
  const brandSlug = brand?.slug || "brand";
  const pixelId = getBrandPixelId(brandSlug);
  const embedCode = buildWixEmbedCode({
    form,
    brandSlug,
    pixelId,
    eventValue: selectedPackage?.promoPrice,
  });

  return {
    brand,
    treatment,
    package: selectedPackage,
    branch,
    branches,
    branchSettings,
    branchLabel,
    brandSlug,
    pixelId,
    pixelConfigured: Boolean(pixelId),
    embedCode,
    previewUrl: getPublicEmbedPreviewUrl(form.publicFormToken),
    packageLabel: packagePriceLabel(selectedPackage),
    suggestedDomains: getBrandSuggestedDomains(brandSlug),
  };
}
