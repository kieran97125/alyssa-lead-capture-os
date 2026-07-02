export const LEGAL_CONSENT_TEXT =
  "我已閱讀並同意相關條款。";

export const LEGAL_CONSENT_HELPER_TEXT =
  "提交資料前，請確認你已閱讀並同意相關條款。";

export const LEGAL_CONSENT_REQUIRED_MESSAGE = "請先閱讀並同意相關條款。";

export const IMAGE_REFERENCE_DISCLAIMER_FULL =
  "本網站、廣告頁面及相關宣傳內容所使用之圖片、影片、人物相片、療程畫面、肌膚狀態、前後對比或其他視覺素材，除非另有明確標示，均為示意圖或參考圖片，只供一般展示及說明用途。實際療程效果、感受、所需次數及結果會因個人體質、皮膚狀況、生活習慣、護理方式及其他因素而有所不同。相關圖片及內容不構成任何效果保證、醫療建議、專業診斷或治療承諾。";

export const IMAGE_REFERENCE_FOOTER_NOTE =
  "圖片只供示意及參考，實際療程效果因個人情況而異。";

export const DEFAULT_SINGLE_LEGAL_LINK_LABEL = "法律條款";
export const INEFFABLE_LEGAL_PAGE_URL =
  "https://www.ineffablebeautyhk.com/legal";

export type BrandLegalSettingsInput = {
  slug?: string | null;
  name?: string | null;
  legalPageUrl?: string | null;
  legalLinkLabel?: string | null;
  privacyUrl?: string | null;
  disclaimerUrl?: string | null;
  operatorName?: string | null;
  operatingCompanyName?: string | null;
};

export type BrandLegalProfile = {
  brandSlug: string;
  brandName: string;
  operatingCompanyName: string | null;
  contactLabel: string;
  lastUpdated: string;
  privacyPolicyUrl: string;
  termsUrl: string;
  disclaimerUrl: string;
  hasSeparateLegalLinks: boolean;
  legalPageUrl: string | null;
  legalLinkLabel: string;
};

export type LegalFooterLink = {
  label: string;
  href: string;
};

const brandLegalProfiles: Record<
  string,
  Pick<
    BrandLegalProfile,
    | "brandName"
    | "operatingCompanyName"
    | "contactLabel"
    | "lastUpdated"
    | "privacyPolicyUrl"
    | "disclaimerUrl"
    | "legalPageUrl"
    | "legalLinkLabel"
  >
> = {
  alyssa: {
    brandName: "Alyssa",
    operatingCompanyName: "Alyssa Group Limited",
    contactLabel:
      "如有查詢，請透過品牌官方 WhatsApp 或客服渠道聯絡我們。",
    lastUpdated: "2026年6月",
    privacyPolicyUrl: "https://www.alyssa.hk/privacy",
    disclaimerUrl: "https://www.alyssa.hk/disclaimer",
    legalPageUrl: null,
    legalLinkLabel: DEFAULT_SINGLE_LEGAL_LINK_LABEL,
  },
  ineffable: {
    brandName: "Ineffable Beauty",
    operatingCompanyName: "YISSA GROUP LIMITED",
    contactLabel:
      "如有查詢，請透過 Ineffable Beauty 官方 WhatsApp 或客服渠道聯絡我們。",
    lastUpdated: "2026年6月",
    privacyPolicyUrl: "/legal/ineffable/privacy",
    disclaimerUrl: "/legal/ineffable/disclaimer",
    legalPageUrl: INEFFABLE_LEGAL_PAGE_URL,
    legalLinkLabel: DEFAULT_SINGLE_LEGAL_LINK_LABEL,
  },
  "ineffable-beauty": {
    brandName: "Ineffable Beauty",
    operatingCompanyName: "YISSA GROUP LIMITED",
    contactLabel:
      "如有查詢，請透過 Ineffable Beauty 官方 WhatsApp 或客服渠道聯絡我們。",
    lastUpdated: "2026年6月",
    privacyPolicyUrl: "/legal/ineffable/privacy",
    disclaimerUrl: "/legal/ineffable/disclaimer",
    legalPageUrl: INEFFABLE_LEGAL_PAGE_URL,
    legalLinkLabel: DEFAULT_SINGLE_LEGAL_LINK_LABEL,
  },
  "skin-light": {
    brandName: "Skin Light",
    operatingCompanyName: "YISSA GROUP LIMITED",
    contactLabel:
      "如有查詢，請透過品牌官方 WhatsApp 或客服渠道聯絡我們。",
    lastUpdated: "2026年6月",
    privacyPolicyUrl: "/legal/skin-light/privacy",
    disclaimerUrl: "/legal/skin-light/disclaimer",
    legalPageUrl: null,
    legalLinkLabel: DEFAULT_SINGLE_LEGAL_LINK_LABEL,
  },
};

function clean(value: string | null | undefined) {
  return String(value ?? "").trim();
}

function normalizeSlug(value: string | null | undefined) {
  return clean(value).toLowerCase() || "alyssa";
}

function normalizeUrl(value: string | null | undefined) {
  const cleaned = clean(value);
  if (!cleaned) return null;

  try {
    return new URL(cleaned).toString();
  } catch {
    return cleaned;
  }
}

export function getLegalLinks(brandSlug = "alyssa") {
  return {
    privacyPolicyUrl: `/legal/${brandSlug}/privacy`,
    termsUrl: `/legal/${brandSlug}/terms`,
    disclaimerUrl: `/legal/${brandSlug}/disclaimer`,
  };
}

export function getBrandLegalProfile({
  brandSlug = "alyssa",
  brandName = "Alyssa",
  legalPageUrl,
  legalLinkLabel,
  privacyUrl,
  disclaimerUrl,
  operatorName,
  operatingCompanyName,
}: {
  brandSlug?: string | null;
  brandName?: string | null;
  legalPageUrl?: string | null;
  legalLinkLabel?: string | null;
  privacyUrl?: string | null;
  disclaimerUrl?: string | null;
  operatorName?: string | null;
  operatingCompanyName?: string | null;
} = {}): BrandLegalProfile {
  const normalizedSlug = normalizeSlug(brandSlug);
  const profile = brandLegalProfiles[normalizedSlug];
  const displayName = profile?.brandName || clean(brandName) || "品牌";
  const legalLinks = getLegalLinks(normalizedSlug);
  const configuredSingleLegalPageUrl =
    normalizeUrl(legalPageUrl) ?? normalizeUrl(profile?.legalPageUrl);
  const explicitPrivacyUrl = normalizeUrl(privacyUrl);
  const explicitDisclaimerUrl = normalizeUrl(disclaimerUrl);
  const shouldPreferSeparateLinks =
    normalizedSlug === "alyssa" &&
    Boolean(explicitPrivacyUrl || explicitDisclaimerUrl || profile?.privacyPolicyUrl);
  const singleLegalPageUrl = shouldPreferSeparateLinks
    ? null
    : configuredSingleLegalPageUrl;
  const explicitOperatorName = clean(operatorName);
  const explicitOperatingCompanyName = clean(operatingCompanyName);
  const operatorFromSettings =
    normalizedSlug === "alyssa" && explicitOperatorName === "YISSA GROUP LIMITED"
      ? ""
      : explicitOperatorName;
  const singleLegalLinkLabel =
    clean(legalLinkLabel) ||
    clean(profile?.legalLinkLabel) ||
    DEFAULT_SINGLE_LEGAL_LINK_LABEL;

  return {
    brandSlug: normalizedSlug,
    brandName: displayName,
    operatingCompanyName:
      operatorFromSettings ||
      explicitOperatingCompanyName ||
      profile?.operatingCompanyName ||
      null,
    contactLabel:
      profile?.contactLabel ||
      "如有查詢，請透過品牌官方 WhatsApp 或客服渠道聯絡我們。",
    lastUpdated: profile?.lastUpdated || "2026年6月",
    legalPageUrl: singleLegalPageUrl,
    legalLinkLabel: singleLegalLinkLabel,
    privacyPolicyUrl:
      explicitPrivacyUrl ||
      normalizeUrl(profile?.privacyPolicyUrl) ||
      legalLinks.privacyPolicyUrl,
    termsUrl: legalLinks.termsUrl,
    disclaimerUrl:
      explicitDisclaimerUrl ||
      normalizeUrl(profile?.disclaimerUrl) ||
      legalLinks.disclaimerUrl,
    hasSeparateLegalLinks: Boolean(
      explicitPrivacyUrl ||
        explicitDisclaimerUrl ||
        shouldPreferSeparateLinks
    ),
  };
}

export function getBrandLegalProfileFromSettings(
  brand: BrandLegalSettingsInput | null | undefined
) {
  return getBrandLegalProfile({
    brandSlug: brand?.slug,
    brandName: brand?.name,
    legalPageUrl: brand?.legalPageUrl,
    legalLinkLabel: brand?.legalLinkLabel,
    privacyUrl: brand?.privacyUrl,
    disclaimerUrl: brand?.disclaimerUrl,
    operatorName: brand?.operatorName,
    operatingCompanyName: brand?.operatingCompanyName,
  });
}

export function getLegalFooterLinks(profile: BrandLegalProfile): LegalFooterLink[] {
  if (profile.legalPageUrl) {
    return [
      {
        label: profile.legalLinkLabel || DEFAULT_SINGLE_LEGAL_LINK_LABEL,
        href: profile.legalPageUrl,
      },
    ];
  }

  if (profile.hasSeparateLegalLinks) {
    return [
      { label: "私隱政策", href: profile.privacyPolicyUrl },
      { label: "免責聲明", href: profile.disclaimerUrl },
    ];
  }

  return [
    { label: "私隱政策", href: profile.privacyPolicyUrl },
    { label: "條款及細則", href: profile.termsUrl },
    { label: "免責聲明", href: profile.disclaimerUrl },
  ];
}

export function getLegalFooterText(profile: BrandLegalProfile) {
  if (profile.operatingCompanyName) {
    return `© 2026 ${profile.brandName}，由 ${profile.operatingCompanyName} 營運。`;
  }

  return `© 2026 ${profile.brandName}`;
}

export function resolveLegalBrandDisplay(brandSlug: string) {
  return getBrandLegalProfile({
    brandSlug,
    brandName: brandLegalProfiles[brandSlug]?.brandName || "品牌",
  });
}
