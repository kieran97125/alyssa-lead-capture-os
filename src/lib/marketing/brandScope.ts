export const ALYSSA_ALL_BRAND_SCOPE = "alyssa-all";
export const ALYSSA_ALL_BRAND_LABEL = "Alyssa All";

export type BrandScopeReference = {
  id: string;
  name: string;
  slug?: string | null;
};

export type BrandScopeOption = {
  value: string;
  label: string;
};

function normalized(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isGosBrand(brand: BrandScopeReference) {
  const slug = normalized(brand.slug);
  const name = normalized(brand.name);
  return slug === "gos-beauty" || name === "gos" || name === "gos-beauty";
}

export function isAlyssaAllScope(value: string | null | undefined) {
  return normalized(value) === ALYSSA_ALL_BRAND_SCOPE;
}

export function brandsForScope<T extends BrandScopeReference>(
  brands: T[],
  scope: string | null | undefined
) {
  if (!scope) return brands;
  if (isAlyssaAllScope(scope)) return brands.filter((brand) => !isGosBrand(brand));

  const requested = normalized(scope);
  return brands.filter(
    (brand) => brand.id === scope || normalized(brand.slug) === requested
  );
}

export function brandIdsForScope(
  brands: BrandScopeReference[],
  scope: string | null | undefined
) {
  return brandsForScope(brands, scope).map((brand) => brand.id);
}

export function brandMatchesScope(
  brand: BrandScopeReference,
  scope: string | null | undefined
) {
  if (!scope) return true;
  if (isAlyssaAllScope(scope)) return !isGosBrand(brand);
  const requested = normalized(scope);
  return brand.id === scope || normalized(brand.slug) === requested;
}

export function normalizeBrandScope(
  value: string | null | undefined,
  brands: BrandScopeReference[]
) {
  if (isAlyssaAllScope(value)) return ALYSSA_ALL_BRAND_SCOPE;
  const requested = normalized(value);
  return (
    brands.find(
      (brand) => brand.id === value || normalized(brand.slug) === requested
    )?.id ?? ""
  );
}

export function brandScopeLabel(
  brands: BrandScopeReference[],
  scope: string | null | undefined
) {
  if (isAlyssaAllScope(scope)) return ALYSSA_ALL_BRAND_LABEL;
  if (!scope) return "全部品牌";
  return brandsForScope(brands, scope)[0]?.name ?? "全部品牌";
}

export function brandScopeOptions(
  brands: BrandScopeReference[]
): BrandScopeOption[] {
  const options = brands.map((brand) => ({
    value: brand.id,
    label: brand.name,
  }));
  return brands.some((brand) => !isGosBrand(brand))
    ? [
        {
          value: ALYSSA_ALL_BRAND_SCOPE,
          label: ALYSSA_ALL_BRAND_LABEL,
        },
        ...options,
      ]
    : options;
}
