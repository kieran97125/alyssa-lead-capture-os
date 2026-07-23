export type PublicBrandTheme = {
  key: "alyssa" | "ineffable" | "gos" | "fallback";
  brandName: string;
  formLayout: "standard" | "compact";
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
  formLayout: "standard",
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
  formLayout: "standard",
  colors: {
    background: "#FFF8FC",
    softBackground: "#F6F2FF",
    card: "#FFFFFF",
    border: "#F0C9DF",
    text: "#5A2348",
    heading: "#5A2348",
    muted: "#6F6070",
    accent: "#D85BA3",
    accentSoft: "#FFF1F7",
    cta: "#D85BA3",
    ctaHover: "#C04D92",
    ctaText: "#FFFFFF",
    dark: "#5A2348",
    darkMuted: "rgba(90,35,72,0.72)",
  },
};

const gosTheme: PublicBrandTheme = {
  key: "gos",
  brandName: "GOS Beauty",
  formLayout: "compact",
  colors: {
    background: "#FFF9F4",
    softBackground: "#FFF4EA",
    card: "#FFFFFF",
    border: "#EAD8C8",
    text: "#292725",
    heading: "#292725",
    muted: "#746E69",
    accent: "#FF5A1F",
    accentSoft: "#FFF1E7",
    cta: "#FF5A1F",
    ctaHover: "#E94C14",
    ctaText: "#FFFFFF",
    dark: "#292725",
    darkMuted: "rgba(41,39,37,0.68)",
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

  if (
    slug === "gos" ||
    slug === "gos-beauty" ||
    slug === "gosbeauty" ||
    name === "gos" ||
    name === "gos-beauty" ||
    name === "gosbeauty"
  ) {
    return gosTheme;
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
