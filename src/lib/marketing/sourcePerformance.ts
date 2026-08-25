import "server-only";

import { getConfiguredBrands } from "@/lib/data/configuration";
import { brandsForScope } from "@/lib/marketing/brandScope";
import {
  buildSourcePerformanceGroups,
  type SourceMetricFact,
  type SourceSpendFact,
} from "@/lib/marketing/sourcePerformanceMath";
import { isSpendType, type SpendType } from "@/lib/marketing/spendTypes";
import type { InternalAccessContext } from "@/lib/security/internalAccess";
import { canAccessInternalBrand } from "@/lib/security/internalAccessServer";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";

export type SourcePerformanceSnapshot = ReturnType<typeof buildSourcePerformanceGroups> & {
  startDate: string;
  endDate: string;
  brandScope: string | null;
  live: boolean;
  warnings: string[];
};

type SourceRow = {
  id: string;
  brandId: string | null;
  status: string;
  dataset: string;
  lastSuccessAt: string | null;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function sourcePriority(source: SourceRow, brandId: string) {
  const statusScore =
    source.status === "connected"
      ? 4
      : source.status === "syncing"
        ? 3
        : source.status === "warning"
          ? 2
          : source.status === "draft"
            ? 1
            : 0;
  const scopeScore = source.brandId === brandId ? 2 : source.brandId ? 0 : 1;
  const successScore = source.lastSuccessAt
    ? new Date(source.lastSuccessAt).getTime() / 1_000_000_000_000
    : 0;
  return statusScore * 100 + scopeScore * 10 + successScore;
}

function chooseFunnelSource(sources: SourceRow[], brandId: string) {
  return (
    sources
      .filter(
        (source) =>
          source.dataset === "lead_funnel" &&
          (source.brandId === null || source.brandId === brandId)
      )
      .sort(
        (left, right) =>
          sourcePriority(right, brandId) - sourcePriority(left, brandId)
      )[0] ?? null
  );
}

function fixtureSnapshot(input: {
  startDate: string;
  endDate: string;
  brandScope: string | null;
  brands: Array<{ id: string; name: string; primaryColor?: string | null }>;
}): SourcePerformanceSnapshot {
  const spendFacts: SourceSpendFact[] = [];
  const metricFacts: SourceMetricFact[] = [];
  input.brands.forEach((brand, brandIndex) => {
    const spendTypes: SpendType[] = [
      "meta_whatsapp",
      "meta_lead_form",
      "meta_website_form",
      "google_ads",
    ];
    spendTypes.forEach((spendType, sourceIndex) => {
      spendFacts.push({
        brandId: brand.id,
        date: input.endDate,
        spendType,
        amount: 900 + brandIndex * 220 + sourceIndex * 160,
      });
    });
    const sources = [
      ["WhatsApp 廣告", "CTWA / 手動新增"],
      ["Facebook Lead Form", "Fixture-lead-form"],
      ["meta / paid_social", "Fixture website conversion"],
      ["Google Ads", "Google Search"],
    ] as const;
    sources.forEach(([sourceLabel, campaignLabel], sourceIndex) => {
      const leads = Math.max(2, 18 - sourceIndex * 3 + brandIndex);
      metricFacts.push(
        {
          brandId: brand.id,
          metricDate: input.endDate,
          metricKind: "lead",
          sourceLabel,
          campaignLabel,
          count: leads,
        },
        {
          brandId: brand.id,
          metricDate: input.endDate,
          metricKind: "book",
          sourceLabel,
          campaignLabel,
          count: Math.max(1, Math.floor(leads * 0.18)),
        },
        {
          brandId: brand.id,
          metricDate: input.endDate,
          metricKind: "show",
          sourceLabel,
          campaignLabel,
          count: Math.max(1, Math.floor(leads * 0.09)),
        }
      );
    });
  });
  return {
    ...buildSourcePerformanceGroups({
      brands: input.brands.map((brand) => ({
        id: brand.id,
        name: brand.name,
        color: brand.primaryColor,
      })),
      spendFacts,
      metricFacts,
    }),
    startDate: input.startDate,
    endDate: input.endDate,
    brandScope: input.brandScope,
    live: false,
    warnings: ["Source Performance 暫時使用驗收數據。"],
  };
}

export async function getSourcePerformanceSnapshot(
  input: {
    startDate: string;
    endDate: string;
    brandScope?: string | null;
  },
  access: InternalAccessContext
): Promise<SourcePerformanceSnapshot> {
  const configuredBrands = await getConfiguredBrands();
  const permittedBrands = configuredBrands.filter((brand) =>
    canAccessInternalBrand(access, brand.id)
  );
  const selectedBrands = brandsForScope(permittedBrands, input.brandScope);
  const brandScope = input.brandScope || null;
  if (!hasSupabaseAdminEnv()) {
    return fixtureSnapshot({
      startDate: input.startDate,
      endDate: input.endDate,
      brandScope,
      brands: selectedBrands,
    });
  }
  if (selectedBrands.length === 0) {
    return {
      ...buildSourcePerformanceGroups({ brands: [], spendFacts: [], metricFacts: [] }),
      startDate: input.startDate,
      endDate: input.endDate,
      brandScope,
      live: true,
      warnings: ["目前品牌範圍未有可顯示嘅 Source Performance。"],
    };
  }

  const supabase = createSupabaseAdminClient();
  const brandIds = selectedBrands.map((brand) => brand.id);
  const [sourcesResult, spendResult, metricResult] = await Promise.all([
    supabase
      .from("marketing_data_sources")
      .select("id,brand_id,status,configuration,last_success_at"),
    supabase
      .from("marketing_daily_spend_entries")
      .select("brand_id,spend_date,spend_type,amount")
      .in("brand_id", brandIds)
      .gte("spend_date", input.startDate)
      .lte("spend_date", input.endDate),
    supabase
      .from("marketing_treatment_performance_daily")
      .select(
        "data_source_id,brand_id,metric_date,metric_kind,source_label,campaign_label,metric_count"
      )
      .in("brand_id", brandIds)
      .in("metric_kind", ["lead", "book", "show"])
      .gte("metric_date", input.startDate)
      .lte("metric_date", input.endDate),
  ]);

  const errors = [sourcesResult.error, spendResult.error, metricResult.error].filter(Boolean);
  if (errors.length > 0) {
    console.warn("source_performance_snapshot_failed", {
      messages: errors.map((error) => error?.message),
    });
    return fixtureSnapshot({
      startDate: input.startDate,
      endDate: input.endDate,
      brandScope,
      brands: selectedBrands,
    });
  }

  const sources: SourceRow[] = ((sourcesResult.data ?? []) as Array<Record<string, unknown>>).map(
    (row) => {
      const configuration = record(row.configuration);
      return {
        id: String(row.id ?? ""),
        brandId: text(row.brand_id) || null,
        status: text(row.status) || "draft",
        dataset: text(configuration.dataset),
        lastSuccessAt: text(row.last_success_at) || null,
      };
    }
  );
  const funnelSourceByBrand = new Map(
    selectedBrands.map((brand) => [brand.id, chooseFunnelSource(sources, brand.id)?.id ?? null])
  );

  const spendFacts: SourceSpendFact[] = ((spendResult.data ?? []) as Array<Record<string, unknown>>)
    .flatMap((row): SourceSpendFact[] => {
      const spendType = text(row.spend_type);
      if (!isSpendType(spendType)) return [];
      return [
        {
          brandId: String(row.brand_id ?? ""),
          date: String(row.spend_date ?? ""),
          spendType,
          amount: numberValue(row.amount),
        },
      ];
    });

  const metricFacts: SourceMetricFact[] = ((metricResult.data ?? []) as Array<Record<string, unknown>>)
    .flatMap((row): SourceMetricFact[] => {
      const brandId = String(row.brand_id ?? "");
      const canonicalSourceId = funnelSourceByBrand.get(brandId);
      if (!canonicalSourceId || String(row.data_source_id ?? "") !== canonicalSourceId) return [];
      const metricKind = text(row.metric_kind);
      if (!(["lead", "book", "show"] as const).includes(metricKind as "lead" | "book" | "show")) {
        return [];
      }
      return [
        {
          brandId,
          metricDate: String(row.metric_date ?? ""),
          metricKind: metricKind as "lead" | "book" | "show",
          sourceLabel: text(row.source_label),
          campaignLabel: text(row.campaign_label),
          count: numberValue(row.metric_count),
        },
      ];
    });

  const groups = buildSourcePerformanceGroups({
    brands: selectedBrands.map((brand) => ({
      id: brand.id,
      name: brand.name,
      color: brand.primaryColor,
    })),
    spendFacts,
    metricFacts,
  });
  const missingFunnelBrands = selectedBrands
    .filter((brand) => !funnelSourceByBrand.get(brand.id))
    .map((brand) => brand.name);

  return {
    ...groups,
    startDate: input.startDate,
    endDate: input.endDate,
    brandScope,
    live: true,
    warnings:
      missingFunnelBrands.length > 0
        ? [`${missingFunnelBrands.join("、")} 未有可用 Lead Funnel Source，Source 轉化數可能不完整。`]
        : [],
  };
}
