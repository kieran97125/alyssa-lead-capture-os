type PublicOfferCopyInput = {
  brandName: string | null | undefined;
  treatmentName: string | null | undefined;
  treatmentDescription?: string | null;
  packageName: string | null | undefined;
  branchName: string | null | undefined;
  promoPrice?: number | string | null;
  originalPrice?: number | string | null;
  currency?: string | null;
};

function positivePrice(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** Public defaults come from the selected campaign, never another brand's offer. */
export function getPublicOfferCopy(input: PublicOfferCopyInput) {
  const brandName = input.brandName?.trim() || "客服";
  const treatmentName = input.treatmentName?.trim() || "療程";
  const packageName = input.packageName?.trim() || treatmentName;
  const hasConfiguredPromo = input.promoPrice !== null && input.promoPrice !== undefined && String(input.promoPrice).trim() !== "";
  // An explicit zero or invalid promotional price must never advertise a
  // different paid price. Keep it as an enquiry until the offer is configured.
  const price = hasConfiguredPromo ? positivePrice(input.promoPrice) : positivePrice(input.originalPrice);
  const currency = /^[A-Z]{3}$/.test(input.currency?.trim().toUpperCase() || "")
    ? input.currency!.trim().toUpperCase()
    : "HKD";
  const priceLabel = price === null ? null : new Intl.NumberFormat("en-HK", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price);
  const offerLabel = priceLabel ? `${priceLabel} ${packageName}` : packageName;

  return {
    priceLabel: priceLabel || "預約查詢",
    heroTitle: offerLabel,
    heroSubtitle: input.treatmentDescription?.trim() || `了解${treatmentName}內容、價錢及分店安排，登記後由團隊跟進確認。`,
    offerBadge: priceLabel ? `${priceLabel} 療程優惠` : "療程查詢",
    locationTreatmentSummary: [input.branchName?.trim(), treatmentName].filter(Boolean).join(" · "),
    registrationTitle: priceLabel ? `立即登記 ${priceLabel} 優惠` : `登記查詢${packageName}`,
    formTitle: priceLabel ? `登記 ${priceLabel} 優惠` : `登記查詢${packageName}`,
    followUpText: `填寫資料後，${brandName}${brandName === "客服" ? "" : " 團隊"}會透過 WhatsApp 跟進確認。`,
  };
}
