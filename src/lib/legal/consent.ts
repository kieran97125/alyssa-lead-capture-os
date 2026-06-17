export const LEGAL_CONSENT_TEXT =
  "我已閱讀並同意《私隱政策》、《條款及細則》及《免責聲明》，並同意你們使用我提交的資料作預約、客戶服務及相關跟進用途。";

export const LEGAL_CONSENT_HELPER_TEXT =
  "提交資料前，請確認你已閱讀並同意相關條款。";

export const LEGAL_CONSENT_REQUIRED_MESSAGE = "請先閱讀並同意相關條款。";

export type BrandLegalProfile = {
  brandSlug: string;
  brandName: string;
  operatingCompanyName: string | null;
  contactLabel: string;
  lastUpdated: string;
  privacyPolicyUrl: string;
  termsUrl: string;
  disclaimerUrl: string;
};

const brandLegalProfiles: Record<
  string,
  Pick<
    BrandLegalProfile,
    "brandName" | "operatingCompanyName" | "contactLabel" | "lastUpdated"
  >
> = {
  alyssa: {
    brandName: "Alyssa",
    operatingCompanyName: "Alyssa Group Limited",
    contactLabel: "如有查詢，請透過登記表格或 WhatsApp 聯絡我們。",
    lastUpdated: "2026年6月",
  },
  ineffable: {
    brandName: "Ineffable Beauty",
    operatingCompanyName: "Alyssa Group Limited",
    contactLabel: "如有查詢，請透過登記表格或 WhatsApp 聯絡我們。",
    lastUpdated: "2026年6月",
  },
  "ineffable-beauty": {
    brandName: "Ineffable Beauty",
    operatingCompanyName: "Alyssa Group Limited",
    contactLabel: "如有查詢，請透過登記表格或 WhatsApp 聯絡我們。",
    lastUpdated: "2026年6月",
  },
  "skin-light": {
    brandName: "Skin Light",
    operatingCompanyName: "Alyssa Group Limited",
    contactLabel: "如有查詢，請透過登記表格或 WhatsApp 聯絡我們。",
    lastUpdated: "2026年6月",
  },
};

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
}: {
  brandSlug?: string | null;
  brandName?: string | null;
} = {}): BrandLegalProfile {
  const normalizedSlug = brandSlug || "alyssa";
  const profile = brandLegalProfiles[normalizedSlug];
  const displayName = profile?.brandName || brandName || "品牌";
  const legalLinks = getLegalLinks(normalizedSlug);

  return {
    brandSlug: normalizedSlug,
    brandName: displayName,
    operatingCompanyName: profile?.operatingCompanyName || null,
    contactLabel: profile?.contactLabel || "如有查詢，請透過登記表格聯絡我們。",
    lastUpdated: profile?.lastUpdated || "2026年6月",
    ...legalLinks,
  };
}

export function getLegalFooterText(profile: BrandLegalProfile) {
  if (profile.operatingCompanyName) {
    return `© 2026 ${profile.brandName}，由 ${profile.operatingCompanyName} 營運。`;
  }

  return `© 2026 ${profile.brandName}。`;
}

export function resolveLegalBrandDisplay(brandSlug: string) {
  return getBrandLegalProfile({
    brandSlug,
    brandName: brandLegalProfiles[brandSlug]?.brandName || "品牌",
  });
}
