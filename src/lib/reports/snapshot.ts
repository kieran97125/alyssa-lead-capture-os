import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { getConfiguredBrands, type BrandSetting } from "@/lib/data/configuration";
import {
  ALYSSA_ALL_BRAND_LABEL,
  ALYSSA_ALL_BRAND_SCOPE,
  brandScopeLabel,
  brandScopeOptions,
  brandsForScope,
  isAlyssaAllScope,
  normalizeBrandScope,
} from "@/lib/marketing/brandScope";
import {
  getCompletedHkReportRange,
  getHkMonthContext,
} from "@/lib/marketing/pacing";
import {
  ALL_SPEND_TYPES,
  EDITABLE_SPEND_TYPES,
  SPEND_TYPE_LABELS,
  isSpendType,
  type SpendType,
} from "@/lib/marketing/spendTypes";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";
import { getCurrentInternalAccess } from "@/lib/security/internalAccessServer";
import {
  REPORT_METRIC_CONTRACT_VERSION,
  reportBreakdownDimensions,
  reportOutputFormats,
  type ReportBrand,
  type ReportBreakdownDimension,
  type ReportBreakdownRow,
  type ReportDailyRow,
  type ReportExportRequest,
  type ReportGeneratorOptions,
  type ReportMetrics,
  type ReportNarrativeItem,
  type ReportOutputFormat,
  type ReportSnapshot,
  type ReportSpendMixRow,
} from "@/lib/reports/types";
import {
  reportMetrics,
  reportSpendTotal,
} from "@/lib/reports/metrics";

type MetricKind = "lead" | "book" | "show" | "no_show" | "pending_show";

type MetricFact = {
  brandId: string;
  brandLabel: string;
  metricDate: string;
  metricKind: MetricKind;
  treatmentLabel: string;
  metricCount: number;
};

type SpendFact = {
  brandId: string;
  spendDate: string;
  spendType: SpendType;
  amount: number;
};

type SourceFact = {
  id: string;
  name: string;
  status: string;
  lastSuccessAt: string | null;
};

type BaseCounts = {
  leads: number;
  bookings: number;
  shows: number;
  noShows: number;
  pendingShows: number;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_REPORT_DAYS = 366;
const PAGE_SIZE = 1000;

export class ReportExportError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code = "report_export_invalid"
  ) {
    super(message);
    this.name = "ReportExportError";
  }
}

function dateAtUtc(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const date = dateAtUtc(value);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function addDays(value: string, amount: number) {
  const date = dateAtUtc(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function listDates(startDate: string, endDate: string) {
  const dates: string[] = [];
  for (let value = startDate; value <= endDate; value = addDays(value, 1)) {
    dates.push(value);
  }
  return dates;
}

function previousMonthDate(value: string) {
  const source = dateAtUtc(value);
  const year = source.getUTCFullYear();
  const month = source.getUTCMonth();
  const day = source.getUTCDate();
  const previousMonthEnd = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1, Math.min(day, previousMonthEnd)))
    .toISOString()
    .slice(0, 10);
}

function cleanText(value: unknown, maxLength = 100) {
  return typeof value === "string"
    ? value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

function normalizeBreakdowns(value: unknown): ReportBreakdownDimension[] {
  if (!Array.isArray(value)) return [];
  return reportBreakdownDimensions.filter((dimension) => value.includes(dimension));
}

export function normalizeReportExportRequest(input: unknown): ReportExportRequest {
  const body = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const month = getHkMonthContext();
  const defaultRange = getCompletedHkReportRange();
  const latestCompletedDate = month.throughDate;
  let startDate = isIsoDate(body.startDate) ? body.startDate : defaultRange.startDate;
  let endDate = isIsoDate(body.endDate) ? body.endDate : defaultRange.endDate;

  if (endDate > latestCompletedDate) endDate = latestCompletedDate;
  if (startDate > latestCompletedDate) startDate = latestCompletedDate;
  if (startDate > endDate) [startDate, endDate] = [endDate, startDate];
  if (addDays(startDate, MAX_REPORT_DAYS - 1) < endDate) {
    startDate = addDays(endDate, -(MAX_REPORT_DAYS - 1));
  }

  const requestedFormat = cleanText(body.format, 10) as ReportOutputFormat;
  return {
    startDate,
    endDate,
    brandScope: cleanText(body.brandScope, 100),
    comparison: body.comparison !== false,
    breakdowns: normalizeBreakdowns(body.breakdowns),
    format: reportOutputFormats.includes(requestedFormat) ? requestedFormat : "pdf",
  };
}

function brandLogoKey(brand: BrandSetting): ReportBrand["logoKey"] {
  const token = `${brand.slug} ${brand.name}`.toLowerCase();
  if (token.includes("ineffable")) return "ineffable";
  if (token.includes("gos")) return "gos";
  return "none";
}

function reportBrand(brand: BrandSetting): ReportBrand {
  return {
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    color: brand.primaryColor || "#5A2348",
    secondaryColor: brand.secondaryColor || "#F3E7EC",
    logoKey: brandLogoKey(brand),
  };
}

export async function getReportGeneratorOptions(): Promise<ReportGeneratorOptions> {
  const [brands, defaultRange] = await Promise.all([
    getConfiguredBrands(),
    Promise.resolve(getCompletedHkReportRange()),
  ]);
  return {
    defaultStartDate: defaultRange.startDate,
    defaultEndDate: defaultRange.endDate,
    brandOptions: [
      { value: "", label: "全部品牌" },
      ...brandScopeOptions(brands),
    ],
  };
}

function scopedBrands(brands: BrandSetting[], scope: string) {
  if (!scope) return brands;
  if (isAlyssaAllScope(scope)) {
    const selected = brandsForScope(brands, ALYSSA_ALL_BRAND_SCOPE);
    if (selected.length === 0) {
      throw new ReportExportError("你目前未獲授權匯出 Alyssa All 品牌資料。", 403, "brand_scope_denied");
    }
    return selected;
  }
  const normalized = normalizeBrandScope(scope, brands);
  if (!normalized) {
    throw new ReportExportError("你揀選嘅品牌不存在，或者未獲授權。", 403, "brand_scope_denied");
  }
  return brands.filter((brand) => brand.id === normalized);
}

function emptyCounts(): BaseCounts {
  return { leads: 0, bookings: 0, shows: 0, noShows: 0, pendingShows: 0 };
}

function addFact(counts: BaseCounts, fact: MetricFact) {
  const value = Math.max(0, fact.metricCount);
  if (fact.metricKind === "lead") counts.leads += value;
  if (fact.metricKind === "book") counts.bookings += value;
  if (fact.metricKind === "show") counts.shows += value;
  if (fact.metricKind === "no_show") counts.noShows += value;
  if (fact.metricKind === "pending_show") counts.pendingShows += value;
}

function aggregateMetrics(facts: MetricFact[], spends: SpendFact[], attributable = true) {
  const counts = emptyCounts();
  facts.forEach((fact) => addFact(counts, fact));
  const spend = reportSpendTotal(
    spends.map((fact) => fact.amount),
    attributable
  );
  return reportMetrics(counts, spend);
}

function rangeFacts<T extends { metricDate?: string; spendDate?: string }>(
  rows: T[],
  startDate: string,
  endDate: string
) {
  return rows.filter((row) => {
    const date = row.metricDate ?? row.spendDate ?? "";
    return date >= startDate && date <= endDate;
  });
}

function buildDailyRows(
  dates: string[],
  facts: MetricFact[],
  spends: SpendFact[]
): ReportDailyRow[] {
  return dates.map((date) => ({
    date,
    metrics: aggregateMetrics(
      facts.filter((fact) => fact.metricDate === date),
      spends.filter((fact) => fact.spendDate === date)
    ),
  }));
}

function buildBrandRows(
  brands: BrandSetting[],
  facts: MetricFact[],
  spends: SpendFact[]
): ReportBreakdownRow[] {
  return brands
    .map((brand) => ({
      key: brand.id,
      label: brand.name,
      detail: "品牌層廣告費及 Lead Sheet 漏斗",
      brandId: brand.id,
      metrics: aggregateMetrics(
        facts.filter((fact) => fact.brandId === brand.id),
        spends.filter((fact) => fact.brandId === brand.id)
      ),
    }))
    .sort((left, right) => right.metrics.leads - left.metrics.leads || left.label.localeCompare(right.label, "zh-HK"));
}

function buildTreatmentRows(facts: MetricFact[]): ReportBreakdownRow[] {
  const grouped = new Map<string, MetricFact[]>();
  for (const fact of facts) {
    const key = JSON.stringify([fact.brandId, fact.treatmentLabel || "未分類療程"]);
    const rows = grouped.get(key) ?? [];
    rows.push(fact);
    grouped.set(key, rows);
  }
  return Array.from(grouped, ([key, rows]) => ({
    key,
    label: rows[0]?.treatmentLabel || "未分類療程",
    detail: rows[0]?.brandLabel || "未分類品牌",
    brandId: rows[0]?.brandId ?? null,
    metrics: aggregateMetrics(rows, [], false),
  })).sort((left, right) => right.metrics.leads - left.metrics.leads || left.label.localeCompare(right.label, "zh-HK"));
}

function buildSpendMix(spends: SpendFact[]): ReportSpendMixRow[] {
  if (spends.length === 0) return [];
  const total = spends.reduce((sum, fact) => sum + fact.amount, 0);
  return ALL_SPEND_TYPES.map((spendType) => {
    const amount = spends
      .filter((fact) => fact.spendType === spendType)
      .reduce((sum, fact) => sum + fact.amount, 0);
    return {
      key: spendType,
      label: SPEND_TYPE_LABELS[spendType],
      amount,
      share: total > 0 ? amount / total : null,
    };
  }).sort((left, right) => right.amount - left.amount);
}

function change(current: number | null, previous: number | null) {
  if (current === null || previous === null || previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}

function percent(value: number | null) {
  return value === null
    ? "未有可比基準"
    : new Intl.NumberFormat("zh-HK", { style: "percent", maximumFractionDigits: 1 }).format(Math.abs(value));
}

function buildNarrative(input: {
  current: ReportMetrics;
  previous: ReportMetrics | null;
  brandRows: ReportBreakdownRow[];
  treatmentRows: ReportBreakdownRow[];
  coverage: { complete: number; expected: number };
}) {
  const insights: ReportNarrativeItem[] = [];
  const actions: ReportNarrativeItem[] = [];
  const leadChange = input.previous ? change(input.current.leads, input.previous.leads) : null;
  const cplChange = input.previous ? change(input.current.cpl, input.previous.cpl) : null;

  if (leadChange !== null) {
    insights.push({
      title: `Lead ${leadChange >= 0 ? "上升" : "下跌"} ${percent(leadChange)}`,
      detail: "與上月相同日號窗口比較；只採用同一 Lead Sheet 彙總口徑。",
      tone: leadChange >= 0 ? "positive" : "attention",
    });
  }
  if (cplChange !== null) {
    insights.push({
      title: `CPL ${cplChange <= 0 ? "改善" : "上升"} ${percent(cplChange)}`,
      detail: "CPL = 已記錄廣告費 ÷ Lead；需配合 Spend 完整度判讀。",
      tone: cplChange <= 0 ? "positive" : "attention",
    });
  }
  const topBrand = input.brandRows[0];
  if (topBrand) {
    insights.push({
      title: `${topBrand.label} 貢獻最多 Lead`,
      detail: `本期 ${Math.round(topBrand.metrics.leads).toLocaleString("zh-HK")} 個 Lead；品牌頁可再檢查轉換效率。`,
      tone: "neutral",
    });
  }
  const topTreatment = input.treatmentRows[0];
  if (topTreatment) {
    insights.push({
      title: `最高量療程：${topTreatment.label}`,
      detail: `${topTreatment.detail} · ${Math.round(topTreatment.metrics.leads).toLocaleString("zh-HK")} 個 Lead；療程層不分配廣告費。`,
      tone: "neutral",
    });
  }

  if ((input.current.bookRate ?? 0) < 0.12) {
    actions.push({
      title: "檢查 Lead → Book 首次跟進",
      detail: "抽查回覆速度、話術同未聯絡原因，先處理最大漏斗流失點。",
      tone: "attention",
    });
  } else {
    actions.push({
      title: "維持 Lead → Book 節奏",
      detail: "保留現有高效來源及跟進時段，並用同期窗口持續監察。",
      tone: "positive",
    });
  }
  if ((input.current.showUpRate ?? 0) < 0.55) {
    actions.push({
      title: "加強到店前確認",
      detail: "針對已 Book 名單安排分段提醒，並記錄 No-show 原因。",
      tone: "attention",
    });
  } else {
    actions.push({
      title: "複製高到店率做法",
      detail: "將高 Show-up 品牌或療程嘅確認流程整理成團隊標準。",
      tone: "positive",
    });
  }
  if (input.coverage.complete < input.coverage.expected) {
    actions.push({
      title: "補齊廣告費記錄",
      detail: `目前完整 ${input.coverage.complete}/${input.coverage.expected} 個品牌日；未完整前成本指標只供方向判讀。`,
      tone: "attention",
    });
  } else {
    actions.push({
      title: "保持每日 Spend 結帳",
      detail: "每日四類廣告費已齊，可直接用 CPL／CPA 支援預算決策。",
      tone: "positive",
    });
  }
  return { insights: insights.slice(0, 4), actions: actions.slice(0, 3) };
}

function spendCoverage(dates: string[], brandIds: string[], spends: SpendFact[]) {
  const typesByBrandDate = new Map<string, Set<SpendType>>();
  for (const fact of spends) {
    const key = `${fact.brandId}:${fact.spendDate}`;
    const types = typesByBrandDate.get(key) ?? new Set<SpendType>();
    types.add(fact.spendType);
    typesByBrandDate.set(key, types);
  }
  let complete = 0;
  for (const brandId of brandIds) {
    for (const date of dates) {
      const types = typesByBrandDate.get(`${brandId}:${date}`) ?? new Set<SpendType>();
      if (
        types.has("legacy_unclassified") ||
        EDITABLE_SPEND_TYPES.every((type) => types.has(type))
      ) {
        complete += 1;
      }
    }
  }
  return { complete, expected: dates.length * brandIds.length };
}

function fixtureData(brands: BrandSetting[], startDate: string, endDate: string) {
  const dates = listDates(startDate, endDate);
  const treatments: Record<string, string[]> = {
    alyssa: ["Facelift 體驗", "水光護理"],
    am: ["輪廓管理", "肌膚管理"],
    ineffable: ["柔清舒敏護理", "緊緻輪廓護理"],
    "gos-beauty": ["Signature Facial", "美肌管理"],
  };
  const metricFacts: MetricFact[] = [];
  const spendFacts: SpendFact[] = [];
  brands.forEach((brand, brandIndex) => {
    dates.forEach((date, dateIndex) => {
      const leads = Math.max(
        2,
        5 - brandIndex +
          ((dateIndex * (brandIndex + 2) + brandIndex) % 5) +
          (dateIndex % 3 === 0 ? 2 : 0)
      );
      const bookings = Math.max(1, Math.floor(leads * (0.16 + brandIndex * 0.02)));
      const shows =
        bookings === 1
          ? (dateIndex + brandIndex) % 4 === 0
            ? 0
            : 1
          : Math.min(
              bookings,
              Math.max(
                0,
                Math.round(bookings * (0.5 + (dateIndex % 2) * 0.12))
              )
            );
      const noShows = Math.max(0, bookings - shows - (dateIndex % 3 === 0 ? 1 : 0));
      const pendingShows = Math.max(0, bookings - shows - noShows);
      const treatmentList = treatments[brand.slug] ?? ["主要療程", "其他療程"];
      const treatmentLabel = treatmentList[dateIndex % treatmentList.length];
      const counts: Array<[MetricKind, number]> = [
        ["lead", leads],
        ["book", bookings],
        ["show", shows],
        ["no_show", noShows],
        ["pending_show", pendingShows],
      ];
      counts.forEach(([metricKind, metricCount]) => {
        if (metricCount > 0) {
          metricFacts.push({
            brandId: brand.id,
            brandLabel: brand.name,
            metricDate: date,
            metricKind,
            treatmentLabel,
            metricCount,
          });
        }
      });
      ALL_SPEND_TYPES.forEach((spendType, spendIndex) => {
        if (spendType === "legacy_unclassified" || (dateIndex + brandIndex) % 5 === 0) return;
        spendFacts.push({
          brandId: brand.id,
          spendDate: date,
          spendType,
          amount: 40 + brandIndex * 11 + dateIndex * 3 + spendIndex * 17,
        });
      });
    });
  });
  return {
    metricFacts,
    spendFacts,
    source: {
      id: "fixture-lead-sheet",
      name: "Alyssa Workspace Lead Sheet",
      status: "connected",
      lastSuccessAt: new Date().toISOString(),
    } satisfies SourceFact,
  };
}

async function fetchMetricFacts(input: {
  sourceId: string;
  brandIds: string[];
  startDate: string;
  endDate: string;
}) {
  const supabase = createSupabaseAdminClient();
  const rows: MetricFact[] = [];
  for (let offset = 0; offset < 50_000; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("marketing_treatment_performance_daily")
      .select("brand_id,brand_label,metric_date,metric_kind,treatment_label,metric_count")
      .eq("data_source_id", input.sourceId)
      .in("brand_id", input.brandIds)
      .gte("metric_date", input.startDate)
      .lte("metric_date", input.endDate)
      .order("metric_date", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as Array<Record<string, unknown>>;
    rows.push(
      ...page.map((row) => ({
        brandId: String(row.brand_id ?? ""),
        brandLabel: cleanText(row.brand_label, 120) || "未分類品牌",
        metricDate: String(row.metric_date ?? ""),
        metricKind: String(row.metric_kind ?? "lead") as MetricKind,
        treatmentLabel: cleanText(row.treatment_label, 160) || "未分類療程",
        metricCount: Math.max(0, Number(row.metric_count) || 0),
      }))
    );
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

async function fetchSpendFacts(input: {
  brandIds: string[];
  startDate: string;
  endDate: string;
}) {
  const supabase = createSupabaseAdminClient();
  const rows: SpendFact[] = [];
  for (let offset = 0; offset < 50_000; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("marketing_daily_spend_entries")
      .select("brand_id,spend_date,spend_type,amount")
      .in("brand_id", input.brandIds)
      .gte("spend_date", input.startDate)
      .lte("spend_date", input.endDate)
      .order("spend_date", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as Array<Record<string, unknown>>;
    rows.push(
      ...page.map((row) => ({
        brandId: String(row.brand_id ?? ""),
        spendDate: String(row.spend_date ?? ""),
        spendType: isSpendType(String(row.spend_type ?? ""))
          ? (String(row.spend_type) as SpendType)
          : "legacy_unclassified",
        amount: Math.max(0, Number(row.amount) || 0),
      }))
    );
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

async function loadProductionFacts(
  brandIds: string[],
  startDate: string,
  endDate: string
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("marketing_data_sources")
    .select("id,display_name,status,last_success_at")
    .eq("provider_key", "google_sheets")
    .eq("configuration->>sourceProfile", "alyssa_workspace_lead_funnel")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const source = data
    ? ({
        id: String(data.id),
        name: String(data.display_name || "Lead Sheet"),
        status: String(data.status || "draft"),
        lastSuccessAt: typeof data.last_success_at === "string" ? data.last_success_at : null,
      } satisfies SourceFact)
    : null;
  const [metricFacts, spendFacts] = await Promise.all([
    source
      ? fetchMetricFacts({ sourceId: source.id, brandIds, startDate, endDate })
      : Promise.resolve([]),
    fetchSpendFacts({ brandIds, startDate, endDate }),
  ]);
  return { metricFacts, spendFacts, source };
}

function titleForScope(scope: string, brands: BrandSetting[]) {
  if (isAlyssaAllScope(scope)) return `${ALYSSA_ALL_BRAND_LABEL} Growth Report`;
  if (brands.length === 1) return `${brands[0].name} Growth Report`;
  return "Growth OS 跨品牌成效報告";
}

function validUuid(value: string | undefined | null) {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

async function persistSnapshot(snapshot: ReportSnapshot, format: ReportOutputFormat) {
  if (!hasSupabaseAdminEnv()) return;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("marketing_report_snapshots").insert({
    id: snapshot.snapshotId,
    report_id: snapshot.reportId,
    generated_at: snapshot.generatedAt,
    generated_by_member_id: validUuid(snapshot.generatedBy.memberId),
    generated_by_identifier: snapshot.generatedBy.identifier,
    start_date: snapshot.current.startDate,
    end_date: snapshot.current.endDate,
    brand_scope: snapshot.selection.brandScope || "all",
    brand_ids: snapshot.selection.brands.map((brand) => brand.id),
    comparison_json: snapshot.comparison,
    split_dimensions: snapshot.selection.breakdowns,
    output_format: format,
    metric_contract_version: snapshot.metricContractVersion,
    snapshot_json: snapshot,
    data_quality_json: snapshot.dataQuality,
    source_sync_json: snapshot.sources,
    snapshot_sha256: snapshot.snapshotSha256,
  });
  if (error) {
    console.warn("marketing_report_snapshot_insert_failed", {
      code: error.code,
      message: error.message,
    });
    throw new ReportExportError(
      "報告快照未能安全保存，今次未有生成檔案。請聯絡系統管理員。",
      503,
      "snapshot_persist_failed"
    );
  }
}

export async function buildReportSnapshot(
  request: ReportExportRequest
): Promise<ReportSnapshot> {
  const [availableBrands, access] = await Promise.all([
    getConfiguredBrands(),
    getCurrentInternalAccess(),
  ]);
  const selectedBrands = scopedBrands(availableBrands, request.brandScope);
  if (selectedBrands.length === 0) {
    throw new ReportExportError("你目前未獲分配任何可匯出品牌。", 403, "brand_scope_denied");
  }

  const previousStartDate = previousMonthDate(request.startDate);
  const previousEndDate = previousMonthDate(request.endDate);
  const combinedStart = request.comparison && previousStartDate < request.startDate
    ? previousStartDate
    : request.startDate;
  const combinedEnd = request.endDate;
  const brandIds = selectedBrands.map((brand) => brand.id);
  const loaded = hasSupabaseAdminEnv()
    ? await loadProductionFacts(brandIds, combinedStart, combinedEnd)
    : fixtureData(selectedBrands, combinedStart, combinedEnd);

  const currentFacts = rangeFacts(loaded.metricFacts, request.startDate, request.endDate);
  const currentSpends = rangeFacts(loaded.spendFacts, request.startDate, request.endDate);
  const previousFacts = request.comparison
    ? rangeFacts(loaded.metricFacts, previousStartDate, previousEndDate)
    : [];
  const previousSpends = request.comparison
    ? rangeFacts(loaded.spendFacts, previousStartDate, previousEndDate)
    : [];
  const currentTotals = aggregateMetrics(currentFacts, currentSpends);
  const previousTotals = request.comparison
    ? aggregateMetrics(previousFacts, previousSpends)
    : null;
  const brandRows = buildBrandRows(selectedBrands, currentFacts, currentSpends);
  const treatmentRows = buildTreatmentRows(currentFacts);
  const currentDates = listDates(request.startDate, request.endDate);
  const coverage = spendCoverage(currentDates, brandIds, currentSpends);
  const narrative = buildNarrative({
    current: currentTotals,
    previous: previousTotals,
    brandRows,
    treatmentRows,
    coverage,
  });
  const source = loaded.source;
  const warnings: string[] = [];
  if (!source) warnings.push("未找到 Lead Sheet 資料來源；漏斗指標可能未有數據。");
  if (source && source.status !== "connected") warnings.push("Lead Sheet 尚未完成成功同步，數據可能未更新。");
  if (currentFacts.length === 0) warnings.push("揀選日期內未有 Lead Sheet 漏斗彙總。");
  if (coverage.complete < coverage.expected) {
    warnings.push(`廣告費完整度為 ${coverage.complete}/${coverage.expected} 個品牌日；成本指標只供方向判讀。`);
  }
  const qualityStatus =
    currentFacts.length === 0 && currentSpends.length === 0
      ? "missing"
      : source?.status === "connected" && coverage.complete === coverage.expected
        ? "complete"
        : "partial";
  const generatedAt = new Date().toISOString();
  const reportId = `GR-${generatedAt.slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const snapshotId = randomUUID();
  const brandLabel = request.brandScope
    ? brandScopeLabel(availableBrands, request.brandScope)
    : "全部品牌";
  const snapshotBase: ReportSnapshot = {
    schemaVersion: 1,
    metricContractVersion: REPORT_METRIC_CONTRACT_VERSION,
    reportId,
    snapshotId,
    snapshotSha256: "",
    generatedAt,
    generatedBy: {
      memberId: access.memberId ?? null,
      identifier: access.memberId
        ? `member:${access.memberId}`
        : access.accessLevel === "master"
          ? "system-owner"
          : "system-admin",
    },
    title: titleForScope(request.brandScope, selectedBrands),
    selection: {
      brandScope: request.brandScope,
      brandLabel,
      brands: selectedBrands.map(reportBrand),
      breakdowns: request.breakdowns,
    },
    current: {
      startDate: request.startDate,
      endDate: request.endDate,
      label: `${request.startDate} 至 ${request.endDate}`,
      totals: currentTotals,
    },
    comparison: request.comparison && previousTotals
      ? {
          startDate: previousStartDate,
          endDate: previousEndDate,
          label: `${previousStartDate} 至 ${previousEndDate}`,
          totals: previousTotals,
        }
      : null,
    daily: buildDailyRows(currentDates, currentFacts, currentSpends),
    brandRows,
    treatmentRows,
    spendMix: buildSpendMix(currentSpends),
    insights: narrative.insights,
    actions: narrative.actions,
    dataQuality: {
      status: qualityStatus,
      sourceName: source?.name || "Lead Sheet",
      sourceStatus: source?.status || "missing",
      sourceLastSuccessAt: source?.lastSuccessAt || null,
      spendCompleteBrandDays: coverage.complete,
      spendExpectedBrandDays: coverage.expected,
      factRows: currentFacts.length,
      spendRows: currentSpends.length,
      warnings,
    },
    sources: [
      {
        name: source?.name || "Lead Sheet",
        status: source?.status || "missing",
        lastSuccessAt: source?.lastSuccessAt || null,
      },
      {
        name: "Daily Spend Ledger",
        status: coverage.complete === coverage.expected ? "complete" : "partial",
        lastSuccessAt: null,
      },
    ],
  };
  snapshotBase.snapshotSha256 = createHash("sha256")
    .update(JSON.stringify({ ...snapshotBase, snapshotSha256: "" }))
    .digest("hex");
  await persistSnapshot(snapshotBase, request.format);
  return snapshotBase;
}
