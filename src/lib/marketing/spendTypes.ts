export const EDITABLE_SPEND_TYPES = [
  "meta_whatsapp",
  "meta_lead_form",
  "meta_website_form",
  "google_ads",
] as const;

export const ALL_SPEND_TYPES = [
  ...EDITABLE_SPEND_TYPES,
  "legacy_unclassified",
] as const;

export type EditableSpendType = (typeof EDITABLE_SPEND_TYPES)[number];
export type SpendType = (typeof ALL_SPEND_TYPES)[number];

export type SpendTypeOption = {
  value: EditableSpendType;
  label: string;
  shortLabel: string;
  description: string;
};

export const SPEND_TYPE_OPTIONS: SpendTypeOption[] = [
  {
    value: "meta_whatsapp",
    label: "Meta · WhatsApp",
    shortLabel: "WhatsApp",
    description: "Meta 直接對話／WhatsApp 廣告費",
  },
  {
    value: "meta_lead_form",
    label: "Meta · Lead Form",
    shortLabel: "Lead Form",
    description: "Meta 即時表單廣告費",
  },
  {
    value: "meta_website_form",
    label: "Meta · Website Form",
    shortLabel: "Website Form",
    description: "Meta 導流網站表單廣告費",
  },
  {
    value: "google_ads",
    label: "Google Ads",
    shortLabel: "Google Ads",
    description: "Google Ads 廣告費",
  },
];

export const SPEND_TYPE_LABELS: Record<SpendType, string> = {
  meta_whatsapp: "Meta · WhatsApp",
  meta_lead_form: "Meta · Lead Form",
  meta_website_form: "Meta · Website Form",
  google_ads: "Google Ads",
  legacy_unclassified: "舊資料 · 未分類",
};

export function isEditableSpendType(value: string): value is EditableSpendType {
  return (EDITABLE_SPEND_TYPES as readonly string[]).includes(value);
}

export function isSpendType(value: string): value is SpendType {
  return (ALL_SPEND_TYPES as readonly string[]).includes(value);
}

export function normalizeEditableSpendType(
  value: string | null | undefined
): EditableSpendType {
  return value && isEditableSpendType(value) ? value : "meta_whatsapp";
}

export function emptySpendTypeAmounts(): Record<SpendType, number> {
  return {
    meta_whatsapp: 0,
    meta_lead_form: 0,
    meta_website_form: 0,
    google_ads: 0,
    legacy_unclassified: 0,
  };
}
