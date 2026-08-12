import "server-only";

import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";
import type { LeadSheetTreatmentAlias } from "@/lib/marketing/googleSheetsMetricParser";

export type TreatmentMappingRule = {
  id: string;
  brandId: string;
  brandName: string;
  brandSlug: string;
  itemCode: string;
  keywords: string[];
  outputLabel: string;
  dashboardLabel: string;
  note: string | null;
  enabled: boolean;
  sortOrder: number;
  revision: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type TreatmentMappingRuleInput = {
  id?: string;
  brandId: string;
  itemCode: string;
  keywords: string | string[];
  outputLabel: string;
  dashboardLabel: string;
  note?: string;
  enabled: boolean;
  sortOrder: number;
  expectedRevision?: number | null;
};

export type TreatmentMappingMutationResult = {
  ok: boolean;
  message: string;
};

export type TreatmentAliasResolution = {
  aliases: LeadSheetTreatmentAlias[];
  source: "system" | "legacy_fallback";
};

type ValidatedTreatmentMappingValue = {
  brand_id: string;
  item_code: string;
  keywords: string[];
  output_label: string;
  dashboard_label: string;
  note: string | null;
  enabled: boolean;
  sort_order: number;
};

type TreatmentMappingValidation =
  | { ok: false; error: string }
  | { ok: true; value: ValidatedTreatmentMappingValue };

function clean(value: unknown, max = 2000) {
  return typeof value === "string"
    ? value.replace(/\u00a0/g, " ").trim().slice(0, max)
    : "";
}

export function normalizeTreatmentMappingItemCode(value: string) {
  return clean(value, 120)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 120);
}

export function parseTreatmentMappingKeywords(value: string | string[]) {
  const parts = Array.isArray(value)
    ? value
    : value.split(/[|｜\n\r]+/g);
  const seen = new Set<string>();
  const output: string[] = [];
  for (const part of parts) {
    const keyword = clean(part, 160).replace(/\s+/g, " ");
    const key = keyword.toLocaleLowerCase("zh-HK");
    if (!keyword || seen.has(key)) continue;
    seen.add(key);
    output.push(keyword);
    if (output.length >= 50) break;
  }
  return output;
}

function brandObject(value: unknown) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function mapRule(value: unknown): TreatmentMappingRule {
  const row = value as Record<string, unknown>;
  const brand = brandObject(row.brands);
  return {
    id: clean(row.id, 80),
    brandId: clean(row.brand_id, 80),
    brandName: clean(brand?.name, 160) || "未命名品牌",
    brandSlug: clean(brand?.slug, 120),
    itemCode: clean(row.item_code, 120),
    keywords: Array.isArray(row.keywords)
      ? row.keywords.map((item) => clean(item, 160)).filter(Boolean)
      : [],
    outputLabel: clean(row.output_label, 2000),
    dashboardLabel: clean(row.dashboard_label, 180),
    note: clean(row.note, 1000) || null,
    enabled: row.enabled !== false,
    sortOrder: Number.isInteger(row.sort_order) ? Number(row.sort_order) : 0,
    revision: Number.isInteger(row.revision) ? Number(row.revision) : 1,
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
  };
}

function isMissingMappingTable(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const message = error.message || "";
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    message.includes("treatment_mapping_rules")
  );
}

export async function getTreatmentMappingRules(input: {
  brandId?: string | null;
  includeDisabled?: boolean;
} = {}) {
  if (!hasSupabaseAdminEnv()) return [] as TreatmentMappingRule[];
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("treatment_mapping_rules")
    .select(
      "id,brand_id,item_code,keywords,output_label,dashboard_label,note,enabled,sort_order,revision,created_at,updated_at,brands!inner(name,slug)"
    )
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (input.brandId) query = query.eq("brand_id", input.brandId);
  if (!input.includeDisabled) query = query.eq("enabled", true);
  const { data, error } = await query;
  if (error) {
    if (isMissingMappingTable(error)) return [];
    throw error;
  }
  return (data ?? []).map(mapRule);
}

export async function resolveTreatmentMappingAliases(
  fallbackAliases: LeadSheetTreatmentAlias[] = []
): Promise<TreatmentAliasResolution> {
  if (!hasSupabaseAdminEnv()) {
    return { aliases: fallbackAliases, source: "legacy_fallback" };
  }
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("treatment_mapping_rules")
    .select(
      "id,brand_id,item_code,keywords,output_label,dashboard_label,note,enabled,sort_order,revision,created_at,updated_at,brands!inner(name,slug)"
    )
    .eq("enabled", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    if (isMissingMappingTable(error)) {
      return { aliases: fallbackAliases, source: "legacy_fallback" };
    }
    console.warn("treatment_mapping_system_read_failed", {
      code: error.code,
      message: error.message,
    });
    return { aliases: fallbackAliases, source: "legacy_fallback" };
  }
  const rules = (data ?? []).map(mapRule);
  return {
    source: "system",
    aliases: rules.map((rule) => ({
      label: rule.dashboardLabel || rule.outputLabel,
      brand: rule.brandName,
      keywords: rule.keywords,
    })),
  };
}

function validateInput(
  input: TreatmentMappingRuleInput
): TreatmentMappingValidation {
  const itemCode = normalizeTreatmentMappingItemCode(input.itemCode);
  const keywords = parseTreatmentMappingKeywords(input.keywords);
  const outputLabel = clean(input.outputLabel, 2000);
  const dashboardLabel = clean(input.dashboardLabel, 180);
  const brandId = clean(input.brandId, 80);
  const note = clean(input.note, 1000) || null;
  const sortOrder = Number(input.sortOrder);
  if (!brandId) return { ok: false, error: "請選擇品牌。" };
  if (!itemCode || itemCode.length < 2) {
    return { ok: false, error: "項目代號格式不正確。" };
  }
  if (keywords.length === 0) {
    return { ok: false, error: "至少需要一個配對關鍵字。" };
  }
  if (!outputLabel) return { ok: false, error: "請填寫標準輸出。" };
  if (!dashboardLabel) {
    return { ok: false, error: "請填寫 Dashboard 分類。" };
  }
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 100000) {
    return { ok: false, error: "排序必須為 0 至 100000 的整數。" };
  }
  return {
    ok: true,
    value: {
      brand_id: brandId,
      item_code: itemCode,
      keywords,
      output_label: outputLabel,
      dashboard_label: dashboardLabel,
      note,
      enabled: Boolean(input.enabled),
      sort_order: sortOrder,
    },
  };
}

function mutationError(error: { code?: string; message?: string }) {
  if (error.code === "23505") {
    return "同一品牌已經有相同項目代號，請使用唯一代號。";
  }
  if (isMissingMappingTable(error)) {
    return "療程分類資料表尚未完成 migration，暫時未能儲存。";
  }
  return "療程分類規則未能儲存，請重新整理後再試。";
}

export async function createTreatmentMappingRule(
  input: TreatmentMappingRuleInput,
  actor: string
): Promise<TreatmentMappingMutationResult> {
  if (!hasSupabaseAdminEnv()) {
    return { ok: false, message: "正式資料服務尚未連接。" };
  }
  const validation = validateInput(input);
  if (!validation.ok) return { ok: false, message: validation.error };
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("treatment_mapping_rules").insert({
    ...validation.value,
    revision: 1,
    created_by_email: clean(actor, 320) || "system",
    updated_by_email: clean(actor, 320) || "system",
  });
  if (error) {
    console.warn("treatment_mapping_create_failed", {
      code: error.code,
      message: error.message,
    });
    return { ok: false, message: mutationError(error) };
  }
  return {
    ok: true,
    message: "療程分類規則已新增，Dashboard 會即時使用新設定。",
  };
}

export async function updateTreatmentMappingRule(
  input: TreatmentMappingRuleInput,
  actor: string
): Promise<TreatmentMappingMutationResult> {
  if (!hasSupabaseAdminEnv()) {
    return { ok: false, message: "正式資料服務尚未連接。" };
  }
  const id = clean(input.id, 80);
  const expectedRevision = Number(input.expectedRevision);
  if (!id || !Number.isInteger(expectedRevision) || expectedRevision < 1) {
    return { ok: false, message: "規則版本已失效，請重新整理頁面。" };
  }
  const validation = validateInput(input);
  if (!validation.ok) return { ok: false, message: validation.error };
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("treatment_mapping_rules")
    .update({
      ...validation.value,
      updated_by_email: clean(actor, 320) || "system",
    })
    .eq("id", id)
    .eq("brand_id", validation.value.brand_id)
    .eq("revision", expectedRevision)
    .select("id,revision")
    .maybeSingle();
  if (error) {
    console.warn("treatment_mapping_update_failed", {
      code: error.code,
      message: error.message,
    });
    return { ok: false, message: mutationError(error) };
  }
  if (!data) {
    return {
      ok: false,
      message: "呢條規則已被另一位使用者更新。為免覆蓋新資料，請重新載入再儲存。",
    };
  }
  return {
    ok: true,
    message: "療程分類規則已更新，Dashboard 會即時使用新設定。",
  };
}
