import "server-only";

import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";
import type { OperationalAnnotation } from "@/lib/marketing/operationalAnnotations";

type AnnotationBrand = {
  id: string;
  name: string;
  color: string;
};

type AnnotationQueryInput = {
  startDate: string;
  endDate: string;
  brands: AnnotationBrand[];
};

function textValue(value: unknown, maxLength = 240) {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function fixtureAnnotations(input: AnnotationQueryInput): OperationalAnnotation[] {
  if (process.env.ALYSSA_E2E_FIXTURES !== "1" || input.brands.length === 0) {
    return [];
  }
  const brand = input.brands[0];
  return [
    {
      id: "10000000-0000-4000-8000-000000000001",
      date: input.startDate,
      title: "DEP Reels 上線",
      itemType: "post",
      channel: "IG",
      status: "published",
      brandId: brand.id,
      brandName: brand.name,
      brandColor: brand.color,
      treatmentId: null,
      treatmentLabel: null,
      notes: "素材及投放同日上線",
    },
  ];
}

function mapEventRows(
  rows: Array<Record<string, unknown>>,
  brands: AnnotationBrand[]
): OperationalAnnotation[] {
  const brandById = new Map(brands.map((brand) => [brand.id, brand]));
  return rows.flatMap((row) => {
    const brandId = String(row.brand_id ?? "");
    const brand = brandById.get(brandId);
    if (!brand) return [];
    const eventType = String(row.event_type ?? "operation");
    return [
      {
        id: String(row.id ?? ""),
        date: String(row.event_date ?? ""),
        title: String(row.title ?? "未命名操作").slice(0, 180),
        itemType: String(row.item_type ?? "task"),
        channel: textValue(row.channel, 80),
        status:
          eventType === "calendar_published"
            ? "published"
            : eventType === "task_milestone"
              ? "done"
              : eventType,
        brandId,
        brandName: brand.name,
        brandColor: brand.color,
        treatmentId: textValue(row.treatment_id, 80),
        treatmentLabel: textValue(row.treatment_label, 180),
        notes: textValue(row.notes, 240),
      },
    ];
  });
}

function mapLegacyCalendarRows(
  rows: Array<Record<string, unknown>>,
  brands: AnnotationBrand[]
): OperationalAnnotation[] {
  const brandById = new Map(brands.map((brand) => [brand.id, brand]));
  return rows.flatMap((row) => {
    const brandId = String(row.brand_id ?? "");
    const brand = brandById.get(brandId);
    if (!brand) return [];
    return [
      {
        id: String(row.id ?? ""),
        date: String(row.scheduled_date ?? ""),
        title: String(row.title ?? "未命名操作").slice(0, 180),
        itemType: String(row.item_type ?? "task"),
        channel: textValue(row.channel, 80),
        status: String(row.status ?? "idea"),
        brandId,
        brandName: brand.name,
        brandColor: brand.color,
        treatmentId: textValue(row.treatment_id, 80),
        treatmentLabel: textValue(row.treatment_label, 180),
        notes: textValue(row.notes, 240),
      },
    ];
  });
}

export async function getOperationalAnnotations(
  input: AnnotationQueryInput
): Promise<OperationalAnnotation[]> {
  if (input.brands.length === 0) return [];
  if (!hasSupabaseAdminEnv()) return fixtureAnnotations(input);

  const supabase = createSupabaseAdminClient();
  const brandIds = input.brands.map((brand) => brand.id);
  const events = await supabase
    .from("marketing_operational_events")
    .select(
      "id,brand_id,treatment_id,treatment_label,event_date,event_type,title,item_type,channel,notes"
    )
    .in("brand_id", brandIds)
    .gte("event_date", input.startDate)
    .lte("event_date", input.endDate)
    .order("event_date", { ascending: true });

  if (!events.error) {
    return mapEventRows(
      (events.data ?? []) as Array<Record<string, unknown>>,
      input.brands
    );
  }

  // Migration-safe fallback: older deployments keep the existing calendar dots
  // until the central operational-event table is available.
  const legacy = await supabase
    .from("marketing_calendar_items")
    .select(
      "id,brand_id,treatment_id,treatment_label,title,item_type,channel,status,scheduled_date,notes"
    )
    .in("brand_id", brandIds)
    .gte("scheduled_date", input.startDate)
    .lte("scheduled_date", input.endDate)
    .order("scheduled_date", { ascending: true })
    .order("sort_order", { ascending: true });
  if (legacy.error) throw legacy.error;
  return mapLegacyCalendarRows(
    (legacy.data ?? []) as Array<Record<string, unknown>>,
    input.brands
  );
}
