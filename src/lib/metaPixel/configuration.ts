export type BrandPixelFallbacks = {
  brandSlug: string | null | undefined;
  configuredPixelId?: string | null;
  alyssaPixelId?: string | null;
  ineffablePixelId?: string | null;
  legacyPixelId?: string | null;
};

export function cleanConfiguredPixelId(
  value: string | null | undefined
) {
  const cleaned = value?.trim().replace(/[^0-9]/g, "") ?? "";
  return cleaned || "";
}

export function resolveBrandPixelId({
  brandSlug,
  configuredPixelId,
  alyssaPixelId,
  ineffablePixelId,
  legacyPixelId,
}: BrandPixelFallbacks) {
  const brandPixelId = cleanConfiguredPixelId(configuredPixelId);
  if (brandPixelId) return brandPixelId;

  const slug = (brandSlug || "").trim().toLowerCase();

  if (slug === "alyssa" || slug.startsWith("alyssa-")) {
    return cleanConfiguredPixelId(alyssaPixelId);
  }

  if (slug === "ineffable" || slug === "ineffable-beauty") {
    return (
      cleanConfiguredPixelId(ineffablePixelId) ||
      cleanConfiguredPixelId(legacyPixelId)
    );
  }

  return "";
}
