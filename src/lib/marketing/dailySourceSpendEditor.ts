import "server-only";

import { getConfiguredBrands } from "@/lib/data/configuration";
import { canEditDailySpendAccess } from "@/lib/marketing/dailyOverview";
import {
  SPEND_TYPE_LABELS,
  normalizeEditableSpendType,
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

export type DailySourceSpendEntry = {
  id: string;
  amount: number;
  note: string | null;
  revision: number;
  updatedBy: string | null;
  updatedAt: string;
};

export type DailySourceSpendBrand = {
  id: string;
  name: string;
  color: string;
  secondaryColor: string;
  entry: DailySourceSpendEntry | null;
  previousEntry: DailySourceSpendEntry | null;
};

export type DailySourceSpendEditorSnapshot = {
  brands: DailySourceSpendBrand[];
  selectedDate: string;
  previousDate: string;
  spendType: EditableSpendType;
  spendTypeLabel: string;
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

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function entryFromRow(row: Record<string, unknown>): DailySourceSpendEntry {
  return {
    id: String(row.id ?? ""),
    amount: numberValue(row.amount),
    note:
      typeof row.note === "string" && row.note.trim() ? row.note.trim() : null,
    revision: numberValue(row.revision),
    updatedBy:
      typeof row.updated_by_email === "string" && row.updated_by_email.trim()
        ? row.updated_by_email.trim()
        : null,
    updatedAt: String(row.updated_at ?? ""),
  };
}

export async function getDailySourceSpendEditorSnapshot(input: {
  selectedDate: string;
  requestedSpendType?: string | null;
}): Promise<DailySourceSpendEditorSnapshot> {
  const [brands, access] = await Promise.all([
    getConfiguredBrands(),
    getCurrentInternalAccess(),
  ]);
  const permittedBrands = brands.filter((brand) =>
    canAccessInternalBrand(access, brand.id)
  );
  const spendType = normalizeEditableSpendType(input.requestedSpendType);
  const priorDate = previousDate(input.selectedDate);
  const canEdit = canEditDailySpendAccess({
    accessLevel: access.accessLevel,
    workspaceRole: access.workspaceRole,
  });

  const baseBrands = permittedBrands.map((brand) => ({
    id: brand.id,
    name: brand.name,
    color: brand.primaryColor || "#5A2348",
    secondaryColor: brand.secondaryColor || "#F8E8E2",
  }));

  if (permittedBrands.length === 0 || !hasSupabaseAdminEnv()) {
    return {
      brands: baseBrands.map((brand) => ({
        ...brand,
        entry: null,
        previousEntry: null,
      })),
      selectedDate: input.selectedDate,
      previousDate: priorDate,
      spendType,
      spendTypeLabel: SPEND_TYPE_LABELS[spendType],
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
      "id,brand_id,spend_date,amount,note,revision,updated_by_email,updated_at"
    )
    .in(
      "brand_id",
      permittedBrands.map((brand) => brand.id)
    )
    .in("spend_date", [input.selectedDate, priorDate])
    .eq("spend_type", spendType);

  if (error) {
    console.warn("daily_source_spend_editor_failed", {
      code: error.code,
      message: error.message,
    });
  }

  const currentByBrand = new Map<string, DailySourceSpendEntry>();
  const previousByBrand = new Map<string, DailySourceSpendEntry>();
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const brandId = String(row.brand_id ?? "");
    const spendDate = String(row.spend_date ?? "");
    if (!brandId) continue;
    const entry = entryFromRow(row);
    if (spendDate === input.selectedDate) currentByBrand.set(brandId, entry);
    if (spendDate === priorDate) previousByBrand.set(brandId, entry);
  }

  const editorBrands = baseBrands.map((brand) => ({
    ...brand,
    entry: currentByBrand.get(brand.id) ?? null,
    previousEntry: previousByBrand.get(brand.id) ?? null,
  }));

  return {
    brands: editorBrands,
    selectedDate: input.selectedDate,
    previousDate: priorDate,
    spendType,
    spendTypeLabel: SPEND_TYPE_LABELS[spendType],
    completionCount: editorBrands.filter((brand) => brand.entry !== null).length,
    total: editorBrands.reduce((sum, brand) => sum + (brand.entry?.amount ?? 0), 0),
    previousTotal: editorBrands.reduce(
      (sum, brand) => sum + (brand.previousEntry?.amount ?? 0),
      0
    ),
    canEdit,
    live: !error,
  };
}
