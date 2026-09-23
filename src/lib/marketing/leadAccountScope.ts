export type LeadAccountDefinition = {
  id: string;
  label: string;
  sheetTab: string;
  color: string;
  aliases: string[];
  permissionBrandSlugs: string[];
  spendBrandSlugs: string[];
};

export type LeadAccountBrandReference = {
  id: string;
  name: string;
  slug?: string | null;
};

export const LEAD_ACCOUNTS: LeadAccountDefinition[] = [
  {
    id: "alyssa-main",
    label: "Alyssa Main",
    sheetTab: "Alyssa Main",
    color: "#5a2348",
    aliases: ["alyssa main", "alyssa-main"],
    permissionBrandSlugs: ["alyssa"],
    spendBrandSlugs: [],
  },
  {
    id: "alyssa-medical",
    label: "Alyssa Medical",
    sheetTab: "Alyssa Medical",
    color: "#7f6070",
    aliases: ["alyssa medical", "alyssa-medical"],
    permissionBrandSlugs: ["alyssa-medical"],
    spendBrandSlugs: ["alyssa-medical"],
  },
  {
    id: "alyssa-aesthetics",
    label: "Alyssa Aesthetics",
    sheetTab: "Alyssa Aesthetics",
    color: "#8E5B71",
    aliases: ["alyssa aesthetics", "alyssa-aesthetics"],
    permissionBrandSlugs: ["alyssa", "aesthetics"],
    spendBrandSlugs: ["alyssa", "aesthetics"],
  },
  {
    id: "gos-beauty",
    label: "GOS Beauty",
    sheetTab: "GOS Beauty",
    color: "#F36B32",
    aliases: ["gos", "gos beauty", "gos-beauty"],
    permissionBrandSlugs: ["gos-beauty"],
    spendBrandSlugs: ["gos-beauty"],
  },
  {
    id: "ineffable",
    label: "Ineffable",
    sheetTab: "Ineffable",
    color: "#69C7E8",
    aliases: ["ineffable", "ineffable beauty"],
    permissionBrandSlugs: ["ineffable"],
    spendBrandSlugs: ["ineffable"],
  },
  {
    id: "skin-light",
    label: "Skin Light",
    sheetTab: "Skin Light",
    color: "#9a7c75",
    aliases: ["skin light", "skinlight", "skin-light", "skin light beauty"],
    permissionBrandSlugs: ["skin-light"],
    spendBrandSlugs: ["skin-light"],
  },
];

function normalized(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[／/]+/g, "/")
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeLeadAccountKey(value: unknown) {
  return normalized(value).replace(/\s+/g, "-");
}

export function leadAccountById(value: unknown) {
  const requested = normalizeLeadAccountKey(value);
  return (
    LEAD_ACCOUNTS.find(
      (account) =>
        account.id === requested ||
        account.aliases.some(
          (alias) => normalizeLeadAccountKey(alias) === requested
        ) ||
        normalizeLeadAccountKey(account.label) === requested
    ) ?? null
  );
}

function fallbackAccountFromBrand(brandValue: unknown) {
  const brand = normalized(brandValue);
  if (!brand) return null;

  // Legacy Sheet compatibility. The old "Alyssa" and old "Alyssa Medical"
  // rows both belonged to the current Alyssa Aesthetics Omni account.
  if (
    [
      "alyssa",
      "alyssa aesthetics",
      "aesthetics",
      "aesthetics medical",
      "alyssa medical",
      "am",
    ].includes(brand)
  ) {
    return leadAccountById("alyssa-aesthetics");
  }
  if (brand === "gos" || brand === "gos beauty") {
    return leadAccountById("gos-beauty");
  }
  if (brand === "ineffable" || brand === "ineffable beauty") {
    return leadAccountById("ineffable");
  }
  if (["skin light", "skinlight", "skin light beauty"].includes(brand)) {
    return leadAccountById("skin-light");
  }
  return null;
}

export function resolveLeadAccount(
  accountValue: unknown,
  brandValue?: unknown
) {
  return leadAccountById(accountValue) ?? fallbackAccountFromBrand(brandValue);
}

export function leadAccountOptions() {
  return LEAD_ACCOUNTS.map((account) => ({
    value: account.id,
    label: account.label,
  }));
}

export function accountsForAllowedBrands(
  brands: LeadAccountBrandReference[],
  allowedBrandIds: string[] | null | undefined
) {
  if (allowedBrandIds === null || allowedBrandIds === undefined) {
    return LEAD_ACCOUNTS;
  }
  const allowed = new Set(allowedBrandIds);
  const allowedSlugs = new Set(
    brands
      .filter((brand) => allowed.has(brand.id))
      .map((brand) => normalizeLeadAccountKey(brand.slug || brand.name))
  );
  return LEAD_ACCOUNTS.filter((account) =>
    account.permissionBrandSlugs.some((slug) =>
      allowedSlugs.has(normalizeLeadAccountKey(slug))
    )
  );
}

export function brandIdsForLeadAccount(
  brands: LeadAccountBrandReference[],
  accountId: string | null | undefined,
  purpose: "permission" | "spend" = "permission"
) {
  const definitions = accountId
    ? [leadAccountById(accountId)].filter(
        (account): account is LeadAccountDefinition => Boolean(account)
      )
    : LEAD_ACCOUNTS;
  const slugs = new Set(
    definitions.flatMap((account) =>
      purpose === "spend"
        ? account.spendBrandSlugs
        : account.permissionBrandSlugs
    )
  );
  return brands
    .filter((brand) =>
      slugs.has(normalizeLeadAccountKey(brand.slug || brand.name))
    )
    .map((brand) => brand.id);
}

export function leadAccountForSpendBrandId(
  brands: LeadAccountBrandReference[],
  brandId: string
) {
  const brand = brands.find((item) => item.id === brandId);
  if (!brand) return null;
  const slug = normalizeLeadAccountKey(brand.slug || brand.name);
  return (
    LEAD_ACCOUNTS.find((account) =>
      account.spendBrandSlugs.some(
        (candidate) => normalizeLeadAccountKey(candidate) === slug
      )
    ) ?? null
  );
}

export function mapSpendFactsToLeadAccounts<T extends {
  brandId: string;
  spendDate: string;
  amount: number;
}>(facts: T[], brands: LeadAccountBrandReference[]) {
  return facts.flatMap((fact) => {
    const account = leadAccountForSpendBrandId(brands, fact.brandId);
    return account
      ? [{ brandId: account.id, spendDate: fact.spendDate, amount: fact.amount }]
      : [];
  });
}

export function leadAccountColor(accountId: string | null | undefined) {
  return leadAccountById(accountId)?.color || "#5a2348";
}

export function leadAccountLabel(accountId: string | null | undefined) {
  return leadAccountById(accountId)?.label || "未分類 Account";
}
