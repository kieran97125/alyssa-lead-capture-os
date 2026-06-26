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

function escapeHtmlAttr(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildWixEmbedCode({
  form,
  brandSlug,
  pixelId,
  eventValue,
  conversionMode,
  successRedirectUrl,
  version = "20260623",
}: {
  form: FormSetting;
  brandSlug: string;
  pixelId?: string;
  eventValue?: number | string | null;
  conversionMode?: "form_submit_pixel" | "thank_you_redirect" | null;
  successRedirectUrl?: string | null;
  version?: string;
}) {
  const safeBrandSlug = slugSafe(brandSlug || "brand");
  const targetId = `launchhub-${safeBrandSlug}-form-${shortToken(
    form.publicFormToken
  )}`;
  const isThankYouRedirect =
    conversionMode === "thank_you_redirect" && Boolean(successRedirectUrl);
  const scriptVersion = isThankYouRedirect
    ? "20260625-mobile-fit"
    : version;
  const lines = isThankYouRedirect
    ? [
        `<div class="ib-launchhub-form-card">`,
        `  <div id="${escapeHtmlAttr(targetId)}"></div>`,
        "",
        `  <script`,
      ]
    : [`<div id="${escapeHtmlAttr(targetId)}"></div>`, "", `<script`];
  const scriptIndent = isThankYouRedirect ? "    " : "  ";
  const closingScript = isThankYouRedirect ? `  </script>` : `</script>`;

  lines.push(
    `${scriptIndent}src="${escapeHtmlAttr(
      getPublicPathUrl(`/embed/alyssa-form.js?v=${scriptVersion}`)
    )}"`,
    `${scriptIndent}data-form-token="${escapeHtmlAttr(form.publicFormToken)}"`,
    `${scriptIndent}data-brand="${escapeHtmlAttr(safeBrandSlug)}"`,
    `${scriptIndent}data-form-id="${escapeHtmlAttr(form.id)}"`
  );

  if (pixelId && conversionMode !== "thank_you_redirect") {
    lines.push(`${scriptIndent}data-pixel-id="${escapeHtmlAttr(pixelId)}"`);
    lines.push(
      `${scriptIndent}data-pixel-event-value="${escapeHtmlAttr(
        eventValue || 388
      )}"`
    );
    lines.push(`${scriptIndent}data-pixel-currency="HKD"`);
  }

  if (isThankYouRedirect) {
    lines.push(
      `${scriptIndent}data-pixel-event-value="${escapeHtmlAttr(
        eventValue || 388
      )}"`
    );
    lines.push(`${scriptIndent}data-pixel-currency="HKD"`);
    lines.push(`${scriptIndent}data-conversion-mode="thank_you_redirect"`);
    lines.push(
      `${scriptIndent}data-success-redirect-url="${escapeHtmlAttr(
        successRedirectUrl
      )}"`
    );
    lines.push(`${scriptIndent}data-lazy-load="true"`);
    lines.push(`${scriptIndent}data-lazy-root-margin="600px"`);
  }

  lines.push(`${scriptIndent}data-target="#${escapeHtmlAttr(targetId)}">`);
  lines.push(closingScript);

  if (isThankYouRedirect) {
    lines.push("", `</div>`);
  }

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
    conversionMode: form.conversionMode,
    successRedirectUrl: form.successRedirectUrl,
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
    conversionMode: form.conversionMode || "form_submit_pixel",
    successRedirectUrl: form.successRedirectUrl || "",
    embedCode,
    previewUrl: getPublicEmbedPreviewUrl(form.publicFormToken),
    packageLabel: packagePriceLabel(selectedPackage),
    suggestedDomains: getBrandSuggestedDomains(brandSlug),
  };
}
