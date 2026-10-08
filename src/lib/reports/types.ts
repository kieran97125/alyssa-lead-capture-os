export const REPORT_METRIC_CONTRACT_VERSION = "growth-os-report-v1";

export const reportOutputFormats = ["pdf", "pptx", "txt", "google_slides"] as const;
export type ReportOutputFormat = (typeof reportOutputFormats)[number];

export const reportBreakdownDimensions = ["brand", "treatment"] as const;
export type ReportBreakdownDimension =
  (typeof reportBreakdownDimensions)[number];

export type ReportExportRequest = {
  startDate: string;
  endDate: string;
  brandScope: string;
  comparison: boolean;
  breakdowns: ReportBreakdownDimension[];
  format: ReportOutputFormat;
};

export type ReportBrand = {
  id: string;
  name: string;
  slug: string;
  color: string;
  secondaryColor: string;
  logoKey: "growth-os" | "ineffable" | "gos" | "none";
};

export type ReportMetrics = {
  spend: number | null;
  leads: number;
  bookings: number;
  shows: number;
  noShows: number;
  pendingShows: number;
  bookRate: number | null;
  showUpRate: number | null;
  leadToShowRate: number | null;
  cpl: number | null;
  costPerBooking: number | null;
  costPerShow: number | null;
};

export type ReportPeriod = {
  startDate: string;
  endDate: string;
  label: string;
  totals: ReportMetrics;
};

export type ReportDailyRow = {
  date: string;
  metrics: ReportMetrics;
};

export type ReportBreakdownRow = {
  key: string;
  label: string;
  detail: string;
  brandId: string | null;
  metrics: ReportMetrics;
};

export type ReportSpendMixRow = {
  key: string;
  label: string;
  amount: number;
  share: number | null;
};

export type ReportNarrativeItem = {
  title: string;
  detail: string;
  tone: "positive" | "attention" | "neutral";
};

export type ReportDataQuality = {
  status: "complete" | "partial" | "missing";
  sourceName: string;
  sourceStatus: string;
  sourceLastSuccessAt: string | null;
  spendCompleteBrandDays: number;
  spendExpectedBrandDays: number;
  factRows: number;
  spendRows: number;
  warnings: string[];
};

export type ReportSeriesGroupKey =
  | "alyssa-ads"
  | "alyssa-medical-ads"
  | "kol-traffic"
  | "gos"
  | "ib"
  | "skin-light";

/** Presentation-only grouping. Original Account/Brand identities stay intact. */
export type ReportSeries = {
  version: "cs-ad-series-v1";
  available: boolean;
  warnings: string[];
  groupRows: Array<{
    key: ReportSeriesGroupKey;
    label: string;
    metrics: ReportMetrics;
    available: boolean;
  }>;
  dailyRows: Array<{
    groupKey: ReportSeriesGroupKey;
    date: string;
    metrics: ReportMetrics;
  }>;
  treatmentRows: Array<{
    groupKey: ReportSeriesGroupKey;
    key: string;
    label: string;
    metrics: ReportMetrics;
  }>;
  arrivalSourceRows: Array<{
    groupKey?: ReportSeriesGroupKey;
    key: "AD" | "KOL" | "OG" | "unclassified";
    label: string;
    shows: number | null;
    noShows: number | null;
    pendingShows: number | null;
    available: boolean;
  }>;
  auditRows: Array<{
    key: string;
    accountLabel: string;
    brandLabel: string;
    groupKey: ReportSeriesGroupKey | null;
    groupLabel: string;
    metrics: ReportMetrics;
  }>;
};

export type ReportSnapshot = {
  schemaVersion: 1;
  metricContractVersion: typeof REPORT_METRIC_CONTRACT_VERSION;
  reportId: string;
  snapshotId: string;
  snapshotSha256: string;
  generatedAt: string;
  generatedBy: {
    memberId: string | null;
    identifier: string;
  };
  title: string;
  selection: {
    brandScope: string;
    brandLabel: string;
    brands: ReportBrand[];
    breakdowns: ReportBreakdownDimension[];
  };
  current: ReportPeriod;
  comparison: ReportPeriod | null;
  daily: ReportDailyRow[];
  brandRows: ReportBreakdownRow[];
  treatmentRows: ReportBreakdownRow[];
  spendMix: ReportSpendMixRow[];
  insights: ReportNarrativeItem[];
  actions: ReportNarrativeItem[];
  dataQuality: ReportDataQuality;
  sources: Array<{
    name: string;
    status: string;
    lastSuccessAt: string | null;
  }>;
  series?: ReportSeries;
};

export type ReportGeneratorOptions = {
  defaultStartDate: string;
  defaultEndDate: string;
  brandOptions: Array<{ value: string; label: string }>;
};
