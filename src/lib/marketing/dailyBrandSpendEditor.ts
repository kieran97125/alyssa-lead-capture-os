import "server-only";

import { getConfiguredBrands } from "@/lib/data/configuration";
import { canEditDailySpendAccess } from "@/lib/marketing/dailyOverview";
import {
  EDITABLE_SPEND_TYPES,
  type EditableSpendType,
} from "@/lib/marketing/spendTypes";
import {
  canAccessInternalBrand,
  getCurrentInternalAccess,
} from "@/lib/security/internalAccessServer";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";

export type DailyBrandSpendEntry = {
  id: string;
  spendType: EditableSpendType;
  amount: number;
  note: string | null;
  revision: number;
  updatedBy: string | null;
  updatedAt: string;
};

export type DailyBrandSpendEditorSnapshot = {
  brands: Array<{
    id: string;
    name: string;
    color: string;
    secondaryColor: string;
  }>;
  selectedBrandId: string;
  selectedBrandName: string;
  selectedDate: string;
  previousDate: string;
  entries: Record<EditableSpendType, DailyBrandSpendEntry | null>;
  previousEntries: Record<EditableSpendType, DailyBrandSpendEntry | null>;
  completionCount: number;
  total: number;
  previousTotal: number;
  canEdit: boolean;
  live: boolean;
};

function previousDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function emptyEntries(): Record<EditableSpendType, DailyBrandSpendEntry | null> {
  return {
    meta_whatsapp: null,
    meta_lead_form: null,
    meta_website_form: null,
    google_ads: null,
  };
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getDailyBrandSpendEditorSnapshot(input: {
  selectedDate: string;
  requestedBrandId?: string | null;
  reportingBrandScope?: string | null;
}): Promise<DailyBrandSpendEditorSnapshot> {
  const [brands, access] = await Promise.all([
    getConfiguredBrands(),
    getCurrentInternalAccess(),
  ]);
  const permittedBrands = brands.filter((brand) =>
    canAccessInternalBrand(access, brand.id)
  );
  const requested = input.requestedBrandId?.trim() || "";
  const reportingScope = input.reportingBrandScope?.trim() || "";
  const selectedBrand =
    permittedBrands.find((brand) => brand.id === requested) ??
    permittedBrands.find((brand) => brand.id === reportingScope) ??
    permittedBrands[0] ??
    null;
  const selectedBrandId = selectedBrand?.id ?? "";
  const selectedBrandName = selectedBrand?.name ?? "未有品牌";
  const priorDate = previousDate(input.selectedDate);
  const canEdit = canEditDailySpendAccess({
    accessLevel: access.accessLevel,
    workspaceRole: access.workspaceRole,
  });

  if (!selectedBrand || !hasSupabaseAdminEnv()) {
    return {
      brands: permittedBrands.map((brand) => ({
        id: brand.id,
        name: brand.name,
        color: brand.primaryColor || "#5A2348",
        secondaryColor: brand.secondaryColor || "#F8E8E2",
      })),
      selectedBrandId,
      selectedBrandName,
      selectedDate: input.selectedDate,
      previousDate: priorDate,
      entries: emptyEntries(),
      previousEntries: emptyEntries(),
      completionCount: 0,
      total: 0,
      previousTotal: 0,
      canEdit,
      live: false,
    };
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("marketing_daily_spend_entries")
    .select(
      "id,spend_date,spend_type,amount,note,revision,updated_by_email,updated_at"
    )
    .eq("brand_id", selectedBrand.id)
    .in("spend_date", [input.selectedDate, priorDate])
    .in("spend_type", [...EDITABLE_SPEND_TYPES]);
  if (error) {
    console.warn("daily_brand_spend_editor_failed", {
      code: error.code,
      message: error.message,
    });
  }

  const current = emptyEntries();
  const previous = emptyEntries();
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const spendType = String(row.spend_type ?? "") as EditableSpendType;
    if (!EDITABLE_SPEND_TYPES.includes(spendType)) continue;
    const entry: DailyBrandSpendEntry = {
      id: String(row.id ?? ""),
      spendType,
      amount: numberValue(row.amount),
      note: typeof row.note === "string" && row.note.trim() ? row.note.trim() : null,
      revision: numberValue(row.revision),
      updatedBy:
        typeof row.updated_by_email === "string" && row.updated_by_email.trim()
          ? row.updated_by_email.trim()
          : null,
      updatedAt: String(row.updated_at ?? ""),
    };
    if (String(row.spend_date ?? "") === input.selectedDate) current[spendType] = entry;
    if (String(row.spend_date ?? "") === priorDate) previous[spendType] = entry;
  }

  return {
    brands: permittedBrands.map((brand) => ({
      id: brand.id,
      name: brand.name,
      color: brand.primaryColor || "#5A2348",
      secondaryColor: brand.secondaryColor || "#F8E8E2",
    })),
    selectedBrandId,
    selectedBrandName,
    selectedDate: input.selectedDate,
    previousDate: priorDate,
    entries: current,
    previousEntries: previous,
    completionCount: EDITABLE_SPEND_TYPES.filter((spendType) => current[spendType] !== null).length,
    total: EDITABLE_SPEND_TYPES.reduce(
      (sum, spendType) => sum + (current[spendType]?.amount ?? 0),
      0
    ),
    previousTotal: EDITABLE_SPEND_TYPES.reduce(
      (sum, spendType) => sum + (previous[spendType]?.amount ?? 0),
      0
    ),
    canEdit,
    live: !error,
  };
}
