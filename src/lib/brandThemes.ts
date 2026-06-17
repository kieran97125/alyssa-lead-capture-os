export type PublicBrandTheme = {
  key: "alyssa" | "ineffable" | "fallback";
  brandName: string;
  colors: {
    background: string;
    softBackground: string;
    card: string;
    border: string;
    text: string;
    heading: string;
    muted: string;
    accent: string;
    accentSoft: string;
    cta: string;
    ctaHover: string;
    ctaText: string;
    dark: string;
    darkMuted: string;
  };
};

const alyssaTheme: PublicBrandTheme = {
  key: "alyssa",
  brandName: "Alyssa",
  colors: {
    background: "#fff9f3",
    softBackground: "#fff6f0",
    card: "#ffffff",
    border: "#ead9cf",
    text: "#321428",
    heading: "#321428",
    muted: "#6d4a5c",
    accent: "#9a5d76",
    accentSoft: "#f8e8e2",
    cta: "#5a2348",
    ctaHover: "#4a1d3a",
    ctaText: "#ffffff",
    dark: "#321428",
    darkMuted: "rgba(255,255,255,0.72)",
  },
};

const ineffableTheme: PublicBrandTheme = {
  key: "ineffable",
  brandName: "Ineffable Beauty",
  colors: {
    background: "#F8EFE6",
    softBackground: "#FFF8F2",
    card: "#FFF8F2",
    border: "#E8D3C4",
    text: "#3A241C",
    heading: "#3A241C",
    muted: "#8B5E4B",
    accent: "#C8683C",
    accentSoft: "#F1DCCD",
    cta: "#C8683C",
    ctaHover: "#B45531",
    ctaText: "#FFF8F2",
    dark: "#3A241C",
    darkMuted: "rgba(255,248,242,0.76)",
  },
};

const fallbackTheme: PublicBrandTheme = {
  ...alyssaTheme,
  key: "fallback",
};

function normalizeBrandToken(value: string | null | undefined) {
  return (value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function resolvePublicBrandTheme({
  brandSlug,
  brandName,
}: {
  brandSlug?: string | null;
  brandName?: string | null;
} = {}) {
  const slug = normalizeBrandToken(brandSlug);
  const name = normalizeBrandToken(brandName);

  if (
    slug === "ineffable" ||
    slug === "ineffable-beauty" ||
    name === "ineffable" ||
    name === "ineffable-beauty"
  ) {
    return ineffableTheme;
  }

  if (slug === "alyssa" || name === "alyssa") {
    return alyssaTheme;
  }

  return fallbackTheme;
}

export function publicThemeStyle(theme: PublicBrandTheme) {
  return {
    "--public-bg": theme.colors.background,
    "--public-soft-bg": theme.colors.softBackground,
    "--public-card": theme.colors.card,
    "--public-border": theme.colors.border,
    "--public-text": theme.colors.text,
    "--public-heading": theme.colors.heading,
    "--public-muted": theme.colors.muted,
    "--public-accent": theme.colors.accent,
    "--public-accent-soft": theme.colors.accentSoft,
    "--public-cta": theme.colors.cta,
    "--public-cta-hover": theme.colors.ctaHover,
    "--public-cta-text": theme.colors.ctaText,
    "--public-dark": theme.colors.dark,
    "--public-dark-muted": theme.colors.darkMuted,
  } as Record<string, string>;
}
