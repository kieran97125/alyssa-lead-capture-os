import { reportMetrics, reportSpendTotal } from "@/lib/reports/metrics";
import type { ReportMetrics, ReportSeries, ReportSeriesGroupKey } from "@/lib/reports/types";

type SeriesBrand = { id: string; name: string; slug: string };
export type SeriesMetricFact = {
  brandId: string;
  brandLabel: string;
  accountLabel: string;
  sourceLabel: string;
  campaignLabel: string;
  metricDate: string;
  metricKind: "lead" | "book" | "show" | "no_show" | "pending_show";
  treatmentLabel: string;
  metricCount: number;
};
type SeriesSpendFact = { brandId: string; spendDate: string; amount: number };

export const REPORT_SERIES_GROUPS: ReadonlyArray<{ key: ReportSeriesGroupKey; label: string }> = [
  { key: "alyssa-ads", label: "Alyssa 廣告" },
  { key: "alyssa-medical-ads", label: "Alyssa Medical 廣告" },
  { key: "kol-traffic", label: "KOL + Traffic" },
  { key: "gos", label: "GOS Beauty" },
  { key: "ib", label: "Ineffable Beauty" },
  { key: "skin-light", label: "Skin Light" },
];

function normalized(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function brandKind(brand: SeriesBrand): ReportSeriesGroupKey | null {
  const tokens = [normalized(brand.slug), normalized(brand.name)];
  if (tokens.some(token => ["am", "aesthetics", "aesthetics medical", "alyssa medical"].includes(token))) return "alyssa-medical-ads";
  if (tokens.some(token => ["alyssa", "alyssa aesthetics"].includes(token))) return "alyssa-ads";
  if (tokens.some(token => ["gos", "gos beauty"].includes(token))) return "gos";
  if (tokens.some(token => ["ineffable", "ineffable beauty"].includes(token))) return "ib";
  if (tokens.some(token => ["skinlight", "skin light", "skin light beauty"].includes(token))) return "skin-light";
  return null;
}

/** Require an explicit Account, then use the stage-specific Brand dimensions. */
export function reportSeriesGroupForFact(fact: SeriesMetricFact, brand: SeriesBrand): ReportSeriesGroupKey | null {
  const account = normalized(fact.accountLabel);
  const label = normalized(fact.brandLabel);
  if (account === "alyssa main") return "kol-traffic";
  if (account === "alyssa medical") return "alyssa-medical-ads";
  if (account === "alyssa aesthetics") {
    if (["am", "aesthetics", "aesthetics medical", "alyssa medical"].includes(label)) return "alyssa-medical-ads";
    if (["alyssa", "alyssa aesthetics"].includes(label)) return "alyssa-ads";
    const kind = brandKind(brand);
    return kind === "alyssa-ads" || kind === "alyssa-medical-ads" ? kind : null;
  }
  if (["gos", "gos beauty"].includes(account)) return "gos";
  if (["ineffable", "ineffable beauty"].includes(account)) return "ib";
  if (["skinlight", "skin light", "skin light beauty"].includes(account)) return "skin-light";
  return null;
}

function possibleGroupsForBrand(brand: SeriesBrand): ReportSeriesGroupKey[] {
  const kind = brandKind(brand);
  return kind === "alyssa-ads" ? ["alyssa-ads", "kol-traffic"] : kind ? [kind] : [];
}

function aggregate(facts: SeriesMetricFact[], spendAmounts: number[] = [], attributable = true): ReportMetrics {
  const counts = { leads: 0, bookings: 0, shows: 0, noShows: 0, pendingShows: 0 };
  for (const fact of facts) {
    const count = Math.max(0, Number.isFinite(fact.metricCount) ? fact.metricCount : 0);
    if (fact.metricKind === "lead") counts.leads += count;
    if (fact.metricKind === "book") counts.bookings += count;
    if (fact.metricKind === "show") counts.shows += count;
    if (fact.metricKind === "no_show") counts.noShows += count;
    if (fact.metricKind === "pending_show") counts.pendingShows += count;
  }
  return reportMetrics(counts, reportSpendTotal(spendAmounts, attributable));
}

/**
 * Consume only the authorized, persisted aggregate facts used by the immutable
 * report snapshot. No customer records or live Sheet reads enter this model.
 */
export function buildReportSeries(input: {
  brands: SeriesBrand[];
  metricFacts: SeriesMetricFact[];
  spendFacts: SeriesSpendFact[];
  dates: string[];
  sourceAvailable: boolean;
}): ReportSeries {
  const brands = new Map(input.brands.map(brand => [brand.id, brand]));
  const dates = new Set(input.dates);
  const allowedGroups = new Set(input.brands.flatMap(possibleGroupsForBrand));
  const invalidGroups = new Set<ReportSeriesGroupKey>();
  const groupFacts = new Map<ReportSeriesGroupKey, SeriesMetricFact[]>();
  const audit = new Map<string, { accountLabel: string; brandLabel: string; groupKey: ReportSeriesGroupKey | null; facts: SeriesMetricFact[] }>();
  const warnings = new Set<string>();

  for (const fact of input.metricFacts) {
    const brand = brands.get(fact.brandId);
    if (!brand || !dates.has(fact.metricDate)) continue;
    const key = reportSeriesGroupForFact(fact, brand);
    const auditKey = JSON.stringify([fact.accountLabel, fact.brandId, fact.brandLabel]);
    const row = audit.get(auditKey) ?? { accountLabel: fact.accountLabel || "未有 Account", brandLabel: fact.brandLabel || brand.name, groupKey: key, facts: [] };
    row.facts.push(fact);
    audit.set(auditKey, row);
    if (!key) {
      possibleGroupsForBrand(brand).forEach(group => invalidGroups.add(group));
      warnings.add("部分彙總未有可核對嘅 Account／品牌分類，相關組別暫不顯示成效。");
      continue;
    }
    // Account can further identify an authorized physical Brand's report group.
    allowedGroups.add(key);
    const rows = groupFacts.get(key) ?? [];
    rows.push(fact);
    groupFacts.set(key, rows);
  }

  const spendByGroup = new Map<ReportSeriesGroupKey, SeriesSpendFact[]>();
  for (const fact of input.spendFacts) {
    const brand = brands.get(fact.brandId);
    if (!brand || !dates.has(fact.spendDate)) continue;
    const key = brandKind(brand);
    if (!key) continue;
    const rows = spendByGroup.get(key) ?? [];
    rows.push(fact);
    spendByGroup.set(key, rows);
  }

  const groupRows: ReportSeries["groupRows"] = REPORT_SERIES_GROUPS.map(group => {
    const available = input.sourceAvailable && allowedGroups.has(group.key) && !invalidGroups.has(group.key);
    return { ...group, available, metrics: aggregate(groupFacts.get(group.key) ?? [], (spendByGroup.get(group.key) ?? []).map(row => row.amount), group.key !== "kol-traffic") };
  });
  const dailyRows: ReportSeries["dailyRows"] = groupRows.filter(group => group.available).flatMap(group => input.dates.map(date => ({
    groupKey: group.key,
    date,
    metrics: aggregate((groupFacts.get(group.key) ?? []).filter(fact => fact.metricDate === date), (spendByGroup.get(group.key) ?? []).filter(fact => fact.spendDate === date).map(fact => fact.amount), group.key !== "kol-traffic"),
  })));
  const treatmentRows: ReportSeries["treatmentRows"] = groupRows.filter(group => group.available).flatMap(group => {
    const treatments = new Map<string, SeriesMetricFact[]>();
    for (const fact of groupFacts.get(group.key) ?? []) {
      const label = fact.treatmentLabel || "未分類療程";
      const rows = treatments.get(label) ?? [];
      rows.push(fact);
      treatments.set(label, rows);
    }
    return [...treatments].map(([label, facts]) => ({ groupKey: group.key, key: JSON.stringify([group.key, label]), label, metrics: aggregate(facts, [], false) }));
  }).sort((left, right) => right.metrics.leads - left.metrics.leads || left.label.localeCompare(right.label, "zh-HK"));
  // The persisted facts' sourceLabel describes Lead acquisition. The accepted
  // arrival projection does not publish its separate AD/KOL/OG source field.
  // Keep absence explicit; never relabel acquisition sources as arrival sources.
  const arrivalSourceRows: ReportSeries["arrivalSourceRows"] = REPORT_SERIES_GROUPS.flatMap(group => (["AD", "KOL", "OG", "unclassified"] as const).map(key => ({
    groupKey: group.key, key, label: key === "unclassified" ? "未分類" : key,
    shows: null, noShows: null, pendingShows: null, available: false,
  })));
  const auditRows: ReportSeries["auditRows"] = [...audit].map(([key, row]) => ({
    key, accountLabel: row.accountLabel, brandLabel: row.brandLabel, groupKey: row.groupKey,
    groupLabel: REPORT_SERIES_GROUPS.find(group => group.key === row.groupKey)?.label || "未分類",
    metrics: aggregate(row.facts, [], false),
  })).sort((left, right) => left.accountLabel.localeCompare(right.accountLabel, "zh-HK") || left.brandLabel.localeCompare(right.brandLabel, "zh-HK"));
  if (!input.sourceAvailable) warnings.add("未有可用嘅已同步 Lead 彙總，系列成效暫不顯示。");
  return { version: "cs-ad-series-v1", available: groupRows.some(group => group.available), warnings: [...warnings], groupRows, dailyRows, treatmentRows, arrivalSourceRows, auditRows };
}
