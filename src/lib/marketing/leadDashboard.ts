import "server-only";

import { readLiveLeadTable } from "@/lib/integrations/googleSheetsLeadTable";
import {
  buildLeadSheetGroups,
  normalizeGoogleSheetBrandKey,
  type LeadSheetPerformanceDiagnostics,
  type LeadSheetTreatmentAlias,
  type SheetBrandReference,
} from "@/lib/marketing/googleSheetsMetricParser";
import {
  buildLeadDashboardModel,
  type LeadDashboardFilters,
  type LeadDashboardModel,
} from "@/lib/marketing/leadDashboardMath";
import { getHkMonthContext } from "@/lib/marketing/pacing";
import type { InternalAccessContext } from "@/lib/security/internalAccess";
import { getCurrentInternalAccess } from "@/lib/security/internalAccessServer";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";

type LeadDashboardSource = {
  id: string;
  display_name: string;
  status: string;
  last_success_at: string | null;
  configuration: Record<string, unknown>;
};

type BrandRow = SheetBrandReference & {
  primary_color: string | null;
};

export type LeadDashboardSnapshot = LeadDashboardModel & {
  filters: LeadDashboardFilters;
  sourceName: string;
  sourceStatus: string;
  lastSuccessAt: string | null;
  loadedAt: string | null;
  brandColors: Record<string, string>;
  diagnostics: LeadSheetPerformanceDiagnostics;
  warnings: string[];
  live: boolean;
};

function firstString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());
}

export function normalizeLeadDashboardFilters(input: {
  startDate?: unknown;
  endDate?: unknown;
  brandId?: unknown;
  treatment?: unknown;
}): LeadDashboardFilters {
  const month = getHkMonthContext();
  let startDate = firstString(input.startDate);
  let endDate = firstString(input.endDate);
  if (!isIsoDate(startDate)) startDate = month.monthStart;
  if (!isIsoDate(endDate)) endDate = month.monthEnd;
  if (startDate > endDate) [startDate, endDate] = [endDate, startDate];
  return {
    startDate,
    endDate,
    brandId: firstString(input.brandId),
    treatment: firstString(input.treatment),
  };
}

function stringRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) => {
      const normalized = firstString(item);
      return normalized ? [[key, normalized]] : [];
    })
  );
}

function treatmentAliases(value: unknown): LeadSheetTreatmentAlias[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    const label = firstString(row.label);
    const brand = firstString(row.brand) || null;
    const keywords = Array.isArray(row.keywords)
      ? row.keywords.map(firstString).filter(Boolean)
      : [];
    return label && keywords.length > 0 ? [{ label, brand, keywords }] : [];
  });
}

function emptyDiagnostics(): LeadSheetPerformanceDiagnostics {
  return {
    sourceRows: 0,
    acceptedRows: 0,
    unknownBrandRows: 0,
    invalidCreatedDateRows: 0,
    invalidShowDateRows: 0,
    invalidAppointmentDateRows: 0,
    uncategorizedTreatmentRows: 0,
  };
}

function fixtureData(filters: LeadDashboardFilters): LeadDashboardSnapshot {
  const brands: BrandRow[] = [
    {
      id: "alyssa-brand",
      name: "Alyssa",
      slug: "alyssa",
      primary_color: "#5a2348",
    },
    {
      id: "am-brand",
      name: "AM",
      slug: "am",
      primary_color: "#9f617d",
    },
    {
      id: "ib-brand",
      name: "Ineffable Beauty",
      slug: "ineffable",
      primary_color: "#69c7e8",
    },
    {
      id: "gos-brand",
      name: "GOS Beauty",
      slug: "gos-beauty",
      primary_color: "#e79245",
    },
  ];
  const rows = [
    [
      filters.startDate,
      "Alyssa",
      "91234567",
      "lead-1",
      "$988 Facelift",
      "Facebook Lead Form",
      "Facelift-yanyan-lead-form",
      "已預約",
      filters.startDate,
      "14:00",
      "",
      "尖沙咀",
      "等待到店",
    ],
    [
      filters.startDate,
      "Alyssa",
      "91234567",
      "lead-2",
      "$988 Facelift",
      "Facebook Lead Form",
      "Facelift-yanyan-lead-form",
      "已到店",
      filters.startDate,
      "14:00",
      filters.startDate,
      "尖沙咀",
      "",
    ],
    [
      filters.startDate,
      "Ineffable Beauty",
      "92345678",
      "lead-3",
      "$388 柔清舒敏護理",
      "WhatsApp 廣告",
      "CTWA / 手動新增",
      "no show",
      filters.startDate,
      "16:00",
      "",
      "銅鑼灣",
      "再跟進",
    ],
  ];
  const headers = [
    "Created At",
    "品牌",
    "電話",
    "lead_key",
    "療程項目",
    "來源",
    "Campaign / 廣告",
    "跟進狀態",
    "預約日期",
    "預約時間",
    "確認到店日期",
    "分店",
    "CS Remark",
  ];
  const parsed = buildLeadSheetGroups({
    headers,
    rows,
    brands,
    sourceBrandId: null,
    brandAliases: { "Alyssa Medical": "am" },
    appsScriptContract: true,
    dedupeByIdentity: true,
  });
  const model = buildLeadDashboardModel({
    groups: parsed.groups,
    brands,
    filters,
  });
  return {
    ...model,
    filters,
    sourceName: "Alyssa Workspace Lead Funnel",
    sourceStatus: "connected",
    lastSuccessAt: new Date().toISOString(),
    loadedAt: new Date().toISOString(),
    brandColors: Object.fromEntries(
      brands.map((brand) => [brand.id, brand.primary_color || "#5a2348"])
    ),
    diagnostics: parsed.diagnostics,
    warnings: [],
    live: true,
  };
}

function emptySnapshot(
  filters: LeadDashboardFilters,
  warning: string,
  source?: LeadDashboardSource | null
): LeadDashboardSnapshot {
  const model = buildLeadDashboardModel({
    groups: [],
    brands: [],
    filters,
  });
  return {
    ...model,
    filters,
    sourceName: source?.display_name || "Lead Sheet",
    sourceStatus: source?.status || "draft",
    lastSuccessAt: source?.last_success_at || null,
    loadedAt: null,
    brandColors: {},
    diagnostics: emptyDiagnostics(),
    warnings: [warning],
    live: false,
  };
}

export async function getLeadDashboardSnapshot(
  requestedFilters: Parameters<typeof normalizeLeadDashboardFilters>[0],
  providedAccess?: InternalAccessContext
): Promise<LeadDashboardSnapshot> {
  const filters = normalizeLeadDashboardFilters(requestedFilters);
  if (!hasSupabaseAdminEnv()) {
    return process.env.ALYSSA_E2E_FIXTURES === "1"
      ? fixtureData(filters)
      : emptySnapshot(filters, "正式 Lead 資料層尚未連接。");
  }

  const access = providedAccess ?? (await getCurrentInternalAccess());
  const allowedBrandIds =
    access.source === "supabase_auth" && access.accessLevel !== "master"
      ? access.brandIds ?? []
      : null;
  if (allowedBrandIds !== null && allowedBrandIds.length === 0) {
    return emptySnapshot(filters, "你目前未獲分配任何品牌嘅 Dashboard 權限。");
  }

  try {
    const supabase = createSupabaseAdminClient();
    const [sourceResult, brandsResult] = await Promise.all([
      supabase
        .from("marketing_data_sources")
        .select("id,display_name,status,last_success_at,configuration")
        .eq("provider_key", "google_sheets")
        .eq("configuration->>sourceProfile", "alyssa_workspace_lead_funnel")
        .maybeSingle(),
      supabase
        .from("brands")
        .select("id,name,slug,primary_color")
        .order("name", { ascending: true }),
    ]);
    if (sourceResult.error) throw sourceResult.error;
    if (brandsResult.error) throw brandsResult.error;
    const source = (sourceResult.data as LeadDashboardSource | null) ?? null;
    if (!source) {
      return emptySnapshot(filters, "未找到正式 Lead Funnel 資料來源。");
    }
    const brands = (brandsResult.data ?? []) as BrandRow[];
    const allowedBrandIdSet =
      allowedBrandIds === null ? null : new Set(allowedBrandIds);
    const visibleBrands = brands.filter(
      (brand) => !allowedBrandIdSet || allowedBrandIdSet.has(brand.id)
    );
    const aliases = treatmentAliases(source.configuration.treatmentAliases);
    const liveTable = await readLiveLeadTable(source.configuration);
    const parsed = buildLeadSheetGroups({
      ...liveTable,
      brands,
      sourceBrandId: null,
      brandAliases: stringRecord(source.configuration.brandAliases),
      treatmentAliases: aliases,
      appsScriptContract: true,
      dedupeByIdentity: true,
    });
    const visibleBrandKeys = new Set(
      visibleBrands.flatMap((brand) => [
        normalizeGoogleSheetBrandKey(brand.name),
        normalizeGoogleSheetBrandKey(brand.slug),
      ])
    );
    const model = buildLeadDashboardModel({
      groups: parsed.groups,
      brands,
      filters,
      allowedBrandIds,
      treatmentLabels: aliases
        .filter(
          (alias) =>
            !alias.brand ||
            visibleBrandKeys.has(normalizeGoogleSheetBrandKey(alias.brand))
        )
        .map((alias) => alias.label),
    });
    const warnings: string[] = [];
    if (source.status !== "connected") {
      warnings.push("Lead Funnel 連接狀態需要檢查；以下仍為今次即時讀取結果。");
    }
    if (parsed.diagnostics.unknownBrandRows > 0) {
      warnings.push(
        `${parsed.diagnostics.unknownBrandRows} 行品牌未能對應，暫未計入 Dashboard。`
      );
    }
    if (parsed.diagnostics.invalidCreatedDateRows > 0) {
      warnings.push(
        `${parsed.diagnostics.invalidCreatedDateRows} 行 Created At 無效，Lead／Book 暫未計入。`
      );
    }

    return {
      ...model,
      filters,
      sourceName: source.display_name,
      sourceStatus: source.status,
      lastSuccessAt: source.last_success_at,
      loadedAt: new Date().toISOString(),
      brandColors: Object.fromEntries(
        visibleBrands.map((brand) => [
          brand.id,
          brand.primary_color || "#5a2348",
        ])
      ),
      diagnostics: parsed.diagnostics,
      warnings,
      live: true,
    };
  } catch (error) {
    console.warn("lead_dashboard_live_read_failed", {
      code:
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : "unknown",
      message: error instanceof Error ? error.message : "unknown",
    });
    return emptySnapshot(
      filters,
      error instanceof Error
        ? error.message
        : "Lead Dashboard 暫時未能讀取，請稍後再試。"
    );
  }
}
