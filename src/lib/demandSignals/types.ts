export const demandSignalTypes = [
  "need",
  "objection",
  "price",
  "results",
  "trust",
  "booking_barrier",
] as const;

export type DemandSignalType = (typeof demandSignalTypes)[number];

export const demandSignalSources = ["whatsapp", "lead_form", "crm", "manual"] as const;
export type DemandSignalSource = (typeof demandSignalSources)[number];

export const demandSignalStatuses = ["new", "reviewed", "validated", "applied", "rejected"] as const;
export type DemandSignalStatus = (typeof demandSignalStatuses)[number];

export const demandSignalAssetTypes = [
  "creative_brief",
  "faq",
  "ad_hook",
  "offer_idea",
  "landing_page_message",
  "system_card",
] as const;
export type DemandSignalAssetType = (typeof demandSignalAssetTypes)[number];

export const demandSignalTypeLabels: Record<DemandSignalType, string> = {
  need: "Need",
  objection: "Objection",
  price: "Price",
  results: "Results",
  trust: "Trust",
  booking_barrier: "Booking Barrier",
};

export const demandSignalSourceLabels: Record<DemandSignalSource, string> = {
  whatsapp: "WhatsApp",
  lead_form: "Lead Form",
  crm: "CRM",
  manual: "Manual",
};

export const demandSignalStatusLabels: Record<DemandSignalStatus, string> = {
  new: "New",
  reviewed: "Reviewed",
  validated: "Validated",
  applied: "Applied",
  rejected: "Rejected",
};

export const demandSignalAssetTypeLabels: Record<DemandSignalAssetType, string> = {
  creative_brief: "Creative Brief",
  faq: "FAQ",
  ad_hook: "Ad Hook",
  offer_idea: "Offer Idea",
  landing_page_message: "Landing Page Message",
  system_card: "System Card",
};

export type DemandSignalOutcome = {
  distinctLeadKey: string;
  booked: boolean;
  showed: boolean;
  paid: boolean;
  revenue: number;
};

export type DemandSignalRecord = {
  id: string;
  brandId: string;
  signalType: DemandSignalType;
  exactQuote: string;
  normalizedTag: string;
  summary: string | null;
  sourceType: DemandSignalSource;
  status: DemandSignalStatus;
  confidence: number;
  occurredAt: string;
  leadId: string | null;
  contactId: string | null;
  formId: string | null;
  treatmentId: string | null;
  treatmentName: string | null;
  formName: string | null;
  sourceLabel: string;
  reviewedAt: string | null;
  outcome: DemandSignalOutcome;
};

export type DemandSignalTaxonomyItem = {
  id: string;
  brandId: string;
  signalType: DemandSignalType;
  normalizedTag: string;
  label: string;
  description: string | null;
  status: "active" | "archived";
};

export type DemandSignalAsset = {
  id: string;
  brandId: string;
  assetType: DemandSignalAssetType;
  title: string;
  content: Record<string, unknown>;
  status: "draft" | "reviewed" | "applied" | "archived";
  landingPageId: string | null;
  updatedAt: string;
  signalIds: string[];
};

export type DemandSignalAggregate = {
  key: string;
  label: string;
  signalType: DemandSignalType;
  occurrences: number;
  distinctLeads: number;
  booked: number;
  showed: number;
  paid: number;
  revenue: number;
  bookRate: number;
  showRate: number;
  paidRate: number;
};

export type DemandSignalFilters = {
  brandId?: string;
  period?: "30d" | "90d" | "all";
  search?: string;
  signalType?: DemandSignalType | "all";
  sourceType?: DemandSignalSource | "all";
  status?: DemandSignalStatus | "all";
  treatmentId?: string | "all";
  formId?: string | "all";
};

export type DemandSignalOverview = {
  filters: DemandSignalFilters;
  brands: Array<{ id: string; name: string; slug: string }>;
  treatments: Array<{ id: string; brandId: string; name: string }>;
  forms: Array<{ id: string; brandId: string; name: string }>;
  tableReady: boolean;
  fixtureMode: boolean;
  error: string | null;
  taxonomy: DemandSignalTaxonomyItem[];
  signals: DemandSignalRecord[];
  assets: DemandSignalAsset[];
  headline: {
    signals: number;
    distinctLeads: number;
    booked: number;
    showed: number;
    paid: number;
    revenue: number;
    trendPercent: number | null;
  };
  topSignals: DemandSignalAggregate[];
  outcomeComparison: DemandSignalAggregate[];
};
