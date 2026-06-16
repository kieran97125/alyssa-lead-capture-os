export const LEGAL_CONSENT_TEXT =
  "我已閱讀並同意《私隱政策》、《條款及細則》及《免責聲明》，並同意你們使用我提交的資料作預約、客戶服務及相關跟進用途。";

export const LEGAL_CONSENT_HELPER_TEXT =
  "提交資料前，請確認你已閱讀並同意相關條款。";

export const LEGAL_CONSENT_REQUIRED_MESSAGE = "請先閱讀並同意相關條款。";

export type BrandLegalProfile = {
  brandSlug: string;
  brandName: string;
  operatingCompanyName: string | null;
  privacyPolicyUrl: string;
  termsUrl: string;
  disclaimerUrl: string;
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
  const displayName = brandName || normalizedSlug;
  const legalLinks = getLegalLinks(normalizedSlug);

  return {
    brandSlug: normalizedSlug,
    brandName: displayName,
    operatingCompanyName:
      normalizedSlug === "alyssa" ? "Alyssa Group Limited" : null,
    ...legalLinks,
  };
}

export function getLegalFooterText(profile: BrandLegalProfile) {
  if (profile.operatingCompanyName) {
    return `© 2026 ${profile.brandName}。服務由 ${profile.operatingCompanyName} 營運。`;
  }

  return `© 2026 ${profile.brandName}。品牌營運資料待更新。`;
}
