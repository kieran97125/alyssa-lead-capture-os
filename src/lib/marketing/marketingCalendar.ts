import "server-only";

import {
  getConfigurationData,
  type TreatmentSetting,
} from "@/lib/data/configuration";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";
import {
  getHkMonthContextForMonth,
  type HkMonthContext,
} from "@/lib/marketing/pacing";
import type { CalendarItem } from "@/lib/marketing/commandCenter";

export type MarketingCalendarSnapshot = {
  month: HkMonthContext;
  brands: Array<{
    id: string;
    name: string;
    color: string;
  }>;
  treatments: TreatmentSetting[];
  calendarItems: CalendarItem[];
  schemaReady: boolean;
  treatmentLinkReady: boolean;
  warnings: string[];
};

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapRows(
  rows: Array<Record<string, unknown>>,
  month: HkMonthContext
): CalendarItem[] {
  return rows.map((row) => ({
    id: String(row.id ?? ""),
    brandId: String(row.brand_id ?? ""),
    treatmentId: textValue(row.treatment_id),
    treatmentLabel: textValue(row.treatment_label),
    title: String(row.title ?? "未命名事項"),
    itemType: String(row.item_type ?? "task") as CalendarItem["itemType"],
    channel: textValue(row.channel),
    status: String(row.status ?? "planned") as CalendarItem["status"],
    scheduledDate: String(row.scheduled_date ?? month.monthStart),
    scheduledTime: textValue(row.scheduled_time),
    assigneeEmail: textValue(row.assignee_email),
    notes: textValue(row.notes),
    sortOrder: numberValue(row.sort_order),
    showOnPerformanceTimeline: row.show_on_performance_timeline !== false,
    updatedAt: textValue(row.updated_at),
  }));
}

function fixtureItems(month: HkMonthContext, brandId: string): CalendarItem[] {
  if (process.env.ALYSSA_E2E_FIXTURES !== "1" || !brandId) return [];
  return [
    {
      id: "10000000-0000-4000-8000-000000000001",
      brandId,
      treatmentId: null,
      treatmentLabel: null,
      title: "DEP Reels 上線",
      itemType: "post",
      channel: "IG",
      status: "published",
      scheduledDate:
        month.monthStart.slice(0, 8) + String(Math.min(5, month.daysInMonth)).padStart(2, "0"),
      scheduledTime: null,
      assigneeEmail: null,
      notes: "素材及投放同日上線",
      sortOrder: 0,
      showOnPerformanceTimeline: true,
      updatedAt: `${month.today}T02:00:00.000Z`,
    },
  ];
}

export async function getMarketingCalendarSnapshot(
  requestedMonth?: unknown
): Promise<MarketingCalendarSnapshot> {
  const month = getHkMonthContextForMonth(requestedMonth);
  const config = await getConfigurationData();
  const brands = config.brands.map((brand) => ({
    id: brand.id,
    name: brand.name,
    color: brand.primaryColor || "#5a2348",
  }));
  const visibleBrandIds = brands.map((brand) => brand.id);

  if (!hasSupabaseAdminEnv()) {
    return {
      month,
      brands,
      treatments: config.treatments.filter((item) => item.status === "active"),
      calendarItems: fixtureItems(month, brands[0]?.id ?? ""),
      schemaReady: process.env.ALYSSA_E2E_FIXTURES === "1",
      treatmentLinkReady: process.env.ALYSSA_E2E_FIXTURES === "1",
      warnings:
        process.env.ALYSSA_E2E_FIXTURES === "1"
          ? []
          : ["營銷日曆資料層尚未連接。"],
    };
  }

  if (visibleBrandIds.length === 0) {
    return {
      month,
      brands,
      treatments: [],
      calendarItems: [],
      schemaReady: true,
      treatmentLinkReady: true,
      warnings: ["你目前未獲分配任何品牌嘅日曆權限。"],
    };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const extended = await supabase
      .from("marketing_calendar_items")
      .select(
        "id,brand_id,treatment_id,treatment_label,title,item_type,channel,status,scheduled_date,scheduled_time,assignee_email,notes,sort_order,show_on_performance_timeline,updated_at"
      )
      .in("brand_id", visibleBrandIds)
      .gte("scheduled_date", month.monthStart)
      .lte("scheduled_date", month.monthEnd)
      .order("scheduled_date", { ascending: true })
      .order("sort_order", { ascending: true });

    if (!extended.error) {
      return {
        month,
        brands,
        treatments: config.treatments.filter((item) => item.status === "active"),
        calendarItems: mapRows(
          (extended.data ?? []) as Array<Record<string, unknown>>,
          month
        ),
        schemaReady: true,
        treatmentLinkReady: true,
        warnings: [],
      };
    }
    if (!extended.error.message.includes("treatment_")) throw extended.error;

    const legacy = await supabase
      .from("marketing_calendar_items")
      .select(
        "id,brand_id,title,item_type,channel,status,scheduled_date,scheduled_time,assignee_email,notes,sort_order,updated_at"
      )
      .in("brand_id", visibleBrandIds)
      .gte("scheduled_date", month.monthStart)
      .lte("scheduled_date", month.monthEnd)
      .order("scheduled_date", { ascending: true })
      .order("sort_order", { ascending: true });
    if (legacy.error) throw legacy.error;
    return {
      month,
      brands,
      treatments: config.treatments.filter((item) => item.status === "active"),
      calendarItems: mapRows(
        (legacy.data ?? []) as Array<Record<string, unknown>>,
        month
      ),
      schemaReady: true,
      treatmentLinkReady: false,
      warnings: ["日曆可正常使用；療程標記會喺 migration 套用後啟用。"],
    };
  } catch (error) {
    console.warn("marketing_calendar_snapshot_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return {
      month,
      brands,
      treatments: config.treatments.filter((item) => item.status === "active"),
      calendarItems: [],
      schemaReady: false,
      treatmentLinkReady: false,
      warnings: ["營銷日曆暫時未能完整讀取，請檢查資料庫狀態。"],
    };
  }
}
