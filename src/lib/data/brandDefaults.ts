import type {
  BrandSetting,
  PackageSetting,
  TreatmentSetting,
} from "@/lib/data/configuration";

export type BrandLaunchDefaults = {
  brandSlug: string;
  websiteDomain: string;
  thankYouPath: string;
  thankYouUrl: string;
  defaultConversionMode: "thank_you_redirect";
  defaultCurrency: "HKD";
  pixelIdReference: string;
};

export const brandLaunchDefaults = {
  alyssa: {
    brandSlug: "alyssa",
    websiteDomain: "https://www.alyssa.hk",
    thankYouPath: "/thankyou",
    thankYouUrl: "https://www.alyssa.hk/thankyou",
    defaultConversionMode: "thank_you_redirect",
    defaultCurrency: "HKD",
    pixelIdReference: "1076420440840443",
  },
  ineffable: {
    brandSlug: "ineffable",
    websiteDomain: "https://www.ineffablebeautyhk.com",
    thankYouPath: "/thank-you",
    thankYouUrl: "https://www.ineffablebeautyhk.com/thank-you",
    defaultConversionMode: "thank_you_redirect",
    defaultCurrency: "HKD",
    pixelIdReference: "1020143980486592",
  },
} as const satisfies Record<string, BrandLaunchDefaults>;

export function normalizeBrandSlug(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

export function getBrandLaunchDefaults(
  brandSlug: string | null | undefined
): BrandLaunchDefaults | null {
  const slug = normalizeBrandSlug(brandSlug);
  if (slug === "alyssa" || slug.startsWith("alyssa-")) {
    return brandLaunchDefaults.alyssa;
  }
  if (slug === "ineffable" || slug === "ineffable-beauty") {
    return brandLaunchDefaults.ineffable;
  }
  return null;
}

export function getTreatmentSlugForRedirect(
  treatment: TreatmentSetting | null | undefined
) {
  const slug = treatment?.slug?.trim();
  return slug || "offer";
}

export function getOfferValueForRedirect(
  offer: PackageSetting | null | undefined
) {
  const rawValue = offer?.promoPrice ?? offer?.originalPrice ?? null;
  const numericValue =
    typeof rawValue === "string" ? Number(rawValue) : rawValue;
  if (typeof numericValue === "number" && Number.isFinite(numericValue)) {
    return String(Math.round(numericValue));
  }
  return "";
}

export function buildBrandSuccessRedirectUrl({
  brandSlug,
  treatmentSlug,
  value,
}: {
  brandSlug: string | null | undefined;
  treatmentSlug: string;
  value: string | number | null | undefined;
}) {
  const defaults = getBrandLaunchDefaults(brandSlug);
  if (!defaults) return "";

  const url = new URL(defaults.thankYouUrl);
  url.searchParams.set("submitted", "1");
  url.searchParams.set("treatment", treatmentSlug || "offer");
  if (value !== null && value !== undefined && String(value).trim()) {
    url.searchParams.set("value", String(value).trim());
  }
  return url.toString();
}

export function isValidBrandSuccessRedirectUrl(
  brandSlug: string | null | undefined,
  value: string | null | undefined
) {
  const defaults = getBrandLaunchDefaults(brandSlug);
  if (!defaults || !value) return false;

  try {
    const url = new URL(value);
    const expected = new URL(defaults.thankYouUrl);
    return (
      url.protocol === "https:" &&
      url.hostname.replace(/^www\./, "") ===
        expected.hostname.replace(/^www\./, "") &&
      url.pathname.replace(/\/+$/, "") === expected.pathname.replace(/\/+$/, "")
    );
  } catch {
    return false;
  }
}

export function getBrandDisplayDefaults(brand: BrandSetting | null | undefined) {
  const defaults = getBrandLaunchDefaults(brand?.slug);
  return {
    websiteDomain: defaults?.websiteDomain ?? "",
    thankYouUrl: defaults?.thankYouUrl ?? brand?.defaultThankYouUrl ?? "",
    conversionMode: defaults?.defaultConversionMode ?? "form_submit_pixel",
    currency: defaults?.defaultCurrency ?? "HKD",
    pixelIdReference: defaults?.pixelIdReference ?? "",
  };
}
