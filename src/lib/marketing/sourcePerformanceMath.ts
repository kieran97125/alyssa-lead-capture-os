import {
  ALL_SPEND_TYPES,
  EDITABLE_SPEND_TYPES,
  SPEND_TYPE_LABELS,
  type SpendType,
} from "@/lib/marketing/spendTypes";

export type SourceSpendFact = {
  brandId: string;
  date: string;
  spendType: SpendType;
  amount: number;
};

export type SourceMetricFact = {
  brandId: string;
  metricDate: string;
  metricKind: "lead" | "book" | "show";
  sourceLabel: string;
  campaignLabel: string;
  count: number;
};

export type SourcePerformanceMetrics = {
  spend: number;
  spendShare: number | null;
  leads: number;
  bookings: number;
  shows: number;
  bookingRate: number | null;
  leadToShowRate: number | null;
  cpl: number | null;
  costPerBooking: number | null;
  costPerShow: number | null;
};

export type SourcePerformanceRow = {
  sourceKey: SpendType;
  sourceLabel: string;
  metrics: SourcePerformanceMetrics;
};

export type BrandSourcePerformanceGroup = {
  brandId: string;
  brandName: string;
  brandColor: string;
  totalSpend: number;
  rows: SourcePerformanceRow[];
};

export type SourcePerformanceBrandReference = {
  id: string;
  name: string;
  color?: string | null;
};

function normalized(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[／/]+/g, "/")
    .replace(/[\s_-]+/g, " ")
    .trim();
}

function containsAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}

/**
 * Canonical paid-source classification shared by Spend and funnel reporting.
 * Explicit source evidence wins over campaign naming so a Meta Instant Form
 * campaign containing words such as "website" is still classified as Lead Form.
 */
export function classifyFunnelSpendType(input: {
  sourceLabel: string | null | undefined;
  campaignLabel: string | null | undefined;
}): SpendType {
  const source = normalized(input.sourceLabel);
  const campaign = normalized(input.campaignLabel);
  const joined = `${source} ${campaign}`;

  if (
    containsAny(source, [
      "facebook lead form",
      "meta lead form",
      "instant form",
      "lead ads",
      "lead ad",
    ])
  ) {
    return "meta_lead_form";
  }

  if (
    containsAny(source, ["whatsapp", "ctwa", "wa 廣告", "wa廣告"]) ||
    containsAny(campaign, ["ctwa", "whatsapp"])
  ) {
    return "meta_whatsapp";
  }

  if (
    containsAny(source, ["google ads", "google /", "google paid", "paid search"]) ||
    containsAny(campaign, ["google ads", "google search", "google pmax", "pmax"])
  ) {
    return "google_ads";
  }

  if (
    containsAny(campaign, ["lead form", "lead-form", "instant form"]) &&
    containsAny(joined, ["meta", "facebook", "instagram", "fb", "ig"])
  ) {
    return "meta_lead_form";
  }

  if (
    containsAny(campaign, [
      "website",
      "web form",
      "website form",
      "complete registration",
      "completed registration",
      "conversion website",
      "wix",
    ]) &&
    containsAny(joined, [
      "meta",
      "facebook",
      "instagram",
      "paid social",
      "paid_social",
      "fb",
      "ig",
    ])
  ) {
    return "meta_website_form";
  }

  if (
    containsAny(source, ["直接", "無追蹤", "未標記", "unknown", "direct"]) ||
    (!source && !campaign)
  ) {
    return "legacy_unclassified";
  }

  return "legacy_unclassified";
}

function safeRatio(numerator: number, denominator: number) {
  return denominator > 0 && Number.isFinite(numerator) && Number.isFinite(denominator)
    ? numerator / denominator
    : null;
}

function emptyMetrics(): Omit<SourcePerformanceMetrics, "spendShare"> {
  return {
    spend: 0,
    leads: 0,
    bookings: 0,
    shows: 0,
    bookingRate: null,
    leadToShowRate: null,
    cpl: null,
    costPerBooking: null,
    costPerShow: null,
  };
}

function buildRows(input: {
  brandIds: Set<string>;
  spendFacts: SourceSpendFact[];
  metricFacts: SourceMetricFact[];
}) {
  const base = new Map<SpendType, ReturnType<typeof emptyMetrics>>();
  for (const spendType of ALL_SPEND_TYPES) base.set(spendType, emptyMetrics());

  for (const fact of input.spendFacts) {
    if (!input.brandIds.has(fact.brandId)) continue;
    const metrics = base.get(fact.spendType) ?? emptyMetrics();
    metrics.spend += fact.amount;
    base.set(fact.spendType, metrics);
  }

  for (const fact of input.metricFacts) {
    if (!input.brandIds.has(fact.brandId)) continue;
    const spendType = classifyFunnelSpendType(fact);
    const metrics = base.get(spendType) ?? emptyMetrics();
    if (fact.metricKind === "lead") metrics.leads += fact.count;
    if (fact.metricKind === "book") metrics.bookings += fact.count;
    if (fact.metricKind === "show") metrics.shows += fact.count;
    base.set(spendType, metrics);
  }

  const totalSpend = Array.from(base.values()).reduce(
    (sum, metrics) => sum + metrics.spend,
    0
  );
  const rows = ALL_SPEND_TYPES.flatMap((spendType): SourcePerformanceRow[] => {
    const metrics = base.get(spendType) ?? emptyMetrics();
    const hasActivity =
      metrics.spend > 0 || metrics.leads > 0 || metrics.bookings > 0 || metrics.shows > 0;
    const shouldShow =
      EDITABLE_SPEND_TYPES.includes(spendType as (typeof EDITABLE_SPEND_TYPES)[number]) ||
      hasActivity;
    if (!shouldShow) return [];
    return [
      {
        sourceKey: spendType,
        sourceLabel: SPEND_TYPE_LABELS[spendType],
        metrics: {
          ...metrics,
          spendShare: safeRatio(metrics.spend, totalSpend),
          bookingRate: safeRatio(metrics.bookings, metrics.leads),
          leadToShowRate: safeRatio(metrics.shows, metrics.leads),
          cpl: safeRatio(metrics.spend, metrics.leads),
          costPerBooking: safeRatio(metrics.spend, metrics.bookings),
          costPerShow: safeRatio(metrics.spend, metrics.shows),
        },
      },
    ];
  });
  return { totalSpend, rows };
}

export function buildSourcePerformanceGroups(input: {
  brands: SourcePerformanceBrandReference[];
  spendFacts: SourceSpendFact[];
  metricFacts: SourceMetricFact[];
}) {
  const brandGroups = input.brands.map((brand): BrandSourcePerformanceGroup => {
    const built = buildRows({
      brandIds: new Set([brand.id]),
      spendFacts: input.spendFacts,
      metricFacts: input.metricFacts,
    });
    return {
      brandId: brand.id,
      brandName: brand.name,
      brandColor: brand.color || "#5A2348",
      totalSpend: built.totalSpend,
      rows: built.rows,
    };
  });
  const overall = buildRows({
    brandIds: new Set(input.brands.map((brand) => brand.id)),
    spendFacts: input.spendFacts,
    metricFacts: input.metricFacts,
  });
  return {
    overall: {
      brandId: "all",
      brandName: "所選品牌合計",
      brandColor: "#253A57",
      totalSpend: overall.totalSpend,
      rows: overall.rows,
    } satisfies BrandSourcePerformanceGroup,
    brands: brandGroups,
  };
}

export function sourceMetricChange(current: number | null, previous: number | null) {
  if (current === null || previous === null || previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}
