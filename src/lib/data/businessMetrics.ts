import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";

export type DateRangeKey = "today" | "yesterday" | "last7" | "month" | "custom";

export type CountItem = {
  label: string;
  count: number;
};

export type PerformanceRow = {
  key: string;
  label: string;
  leads: number;
  bookings: number;
  paid: number;
  amount: number;
  share?: number;
  meta?: string[];
};

export type LeadRow = {
  id: string;
  created_at: string;
  submitted_at: string | null;
  customer_name: string | null;
  phone: string | null;
  appointment_date: string | null;
  appointment_time: string | null;
  price: number | string | null;
  currency: string | null;
  source_type: string | null;
  payment_status: string | null;
  lead_status: string | null;
  booking_status: string | null;
  brands?: { name: string | null } | { name: string | null }[] | null;
  treatments?: { name: string | null } | { name: string | null }[] | null;
  packages?:
    | { name: string | null; promo_price: number | string | null }
    | { name: string | null; promo_price: number | string | null }[]
    | null;
  branches?: { name: string | null } | { name: string | null }[] | null;
  lead_source_snapshots?:
    | {
        utm_source: string | null;
        utm_medium: string | null;
        utm_campaign: string | null;
        utm_content: string | null;
        tracking_status: string | null;
        audit_reason: string | null;
      }
    | {
        utm_source: string | null;
        utm_medium: string | null;
        utm_campaign: string | null;
        utm_content: string | null;
        tracking_status: string | null;
        audit_reason: string | null;
      }[]
    | null;
};

export const dateRangeOptions: Array<{ key: DateRangeKey; label: string }> = [
  { key: "today", label: "今日" },
  { key: "yesterday", label: "昨日" },
  { key: "last7", label: "近7日" },
  { key: "month", label: "本月" },
  { key: "custom", label: "自訂日期" },
];

export function relation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function asNumber(value: number | string | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function money(value: number, currency = "HKD") {
  return new Intl.NumberFormat("zh-HK", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function formatDateTime(value: string | null) {
  if (!value) return "未有登記";

  return new Intl.DateTimeFormat("zh-HK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Hong_Kong",
  }).format(new Date(value));
}

export function formatAppointment(lead: LeadRow) {
  if (!lead.appointment_date && !lead.appointment_time) return "未選";
  return [lead.appointment_date, lead.appointment_time].filter(Boolean).join(" ");
}

function hkDateToUtcIso(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day) - 8 * 60 * 60 * 1000).toISOString();
}

export function getDateRange(range: DateRangeKey) {
  const now = new Date();
  const hkNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const year = hkNow.getUTCFullYear();
  const month = hkNow.getUTCMonth();
  const day = hkNow.getUTCDate();

  if (range === "today") {
    return {
      key: range,
      label: "今日",
      start: hkDateToUtcIso(year, month, day),
      end: hkDateToUtcIso(year, month, day + 1),
    };
  }

  if (range === "yesterday") {
    return {
      key: range,
      label: "昨日",
      start: hkDateToUtcIso(year, month, day - 1),
      end: hkDateToUtcIso(year, month, day),
    };
  }

  if (range === "month") {
    return {
      key: range,
      label: "本月",
      start: hkDateToUtcIso(year, month, 1),
      end: hkDateToUtcIso(year, month + 1, 1),
    };
  }

  return {
    key: range,
    label: range === "custom" ? "自訂日期（暫用近7日）" : "近7日",
    start: hkDateToUtcIso(year, month, day - 6),
    end: hkDateToUtcIso(year, month, day + 1),
  };
}

export function parseRange(value: string | string[] | undefined): DateRangeKey {
  const raw = Array.isArray(value) ? value[0] : value;
  return dateRangeOptions.some((item) => item.key === raw)
    ? (raw as DateRangeKey)
    : "last7";
}

export function sourceLabel(lead: LeadRow) {
  const snapshot = relation(lead.lead_source_snapshots);

  if (lead.source_type === "whatsapp_ctwa") return "WhatsApp CTWA";
  if (lead.source_type === "organic_unknown") return "Organic / unknown";
  if (lead.source_type === "manual") return "Manual";
  if (lead.source_type === "imported") return "Imported";

  return [snapshot?.utm_source, snapshot?.utm_medium]
    .filter(Boolean)
    .join(" / ") || "可追蹤來源";
}

export function campaignLabel(lead: LeadRow) {
  const snapshot = relation(lead.lead_source_snapshots);
  return snapshot?.utm_campaign || "未設定";
}

export function contentLabel(lead: LeadRow) {
  const snapshot = relation(lead.lead_source_snapshots);
  return snapshot?.utm_content || "未設定";
}

export function businessStatus(lead: LeadRow) {
  if (lead.payment_status === "paid") return "已付款";
  if (lead.lead_status === "lost") return "已流失";
  if (lead.booking_status === "confirmed") return "已確認預約";
  if (lead.payment_status === "pending") return "待付款確認";
  if (lead.payment_status === "booking_only") return "只預約未付款";
  if (lead.lead_status === "submitted") return "已提交";
  return lead.lead_status || "未設定";
}

export function isBooking(lead: LeadRow) {
  return ["requested", "confirmed", "rescheduled", "show", "no_show"].includes(
    lead.booking_status ?? ""
  );
}

export function isTrackable(lead: LeadRow) {
  const snapshot = relation(lead.lead_source_snapshots);
  return (
    lead.source_type !== "organic_unknown" &&
    snapshot?.tracking_status !== "organic_unknown" &&
    snapshot?.tracking_status !== "missing"
  );
}

export function countBy<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  const counts = new Map<string, number>();

  rows.forEach((row) => {
    const value = typeof row[key] === "string" && row[key] ? row[key] : "未設定";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });

  return Array.from(counts, ([label, count]) => ({ label, count })).sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label)
  );
}

function addPerformance(
  rows: Map<string, PerformanceRow>,
  key: string,
  label: string,
  lead: LeadRow,
  meta: string[] = []
) {
  const current =
    rows.get(key) ??
    ({
      key,
      label,
      leads: 0,
      bookings: 0,
      paid: 0,
      amount: 0,
      meta,
    } satisfies PerformanceRow);

  current.leads += 1;
  current.bookings += isBooking(lead) ? 1 : 0;
  current.paid += lead.payment_status === "paid" ? 1 : 0;
  current.amount += asNumber(lead.price);
  rows.set(key, current);
}

export function buildPerformance(leads: LeadRow[]) {
  const brands = new Map<string, PerformanceRow>();
  const sources = new Map<string, PerformanceRow>();
  const treatments = new Map<string, PerformanceRow>();
  const branches = new Map<string, PerformanceRow>();

  leads.forEach((lead) => {
    const brand = relation(lead.brands)?.name || "未設定品牌";
    const treatment = relation(lead.treatments)?.name || "未設定療程";
    const packageName = relation(lead.packages)?.name || "未設定套餐";
    const branch = relation(lead.branches)?.name || "未設定分店";
    const source = sourceLabel(lead);
    const campaign = campaignLabel(lead);
    const content = contentLabel(lead);

    addPerformance(brands, brand, brand, lead);
    addPerformance(
      sources,
      [source, campaign, content].join("|"),
      source,
      lead,
      [campaign, content]
    );
    addPerformance(
      treatments,
      [treatment, packageName].join("|"),
      treatment,
      lead,
      [packageName, money(asNumber(lead.price), lead.currency || "HKD")]
    );
    addPerformance(branches, branch, branch, lead);
  });

  return {
    brandPerformance: Array.from(brands.values()).sort((a, b) => b.leads - a.leads),
    sourcePerformance: Array.from(sources.values()).sort((a, b) => b.leads - a.leads),
    treatmentPerformance: Array.from(treatments.values()).sort(
      (a, b) => b.leads - a.leads
    ),
    branchPerformance: Array.from(branches.values())
      .map((row) => ({
        ...row,
        share: leads.length > 0 ? row.leads / leads.length : 0,
      }))
      .sort((a, b) => b.leads - a.leads),
  };
}

export async function countRows(table: string) {
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });

  if (error) throw error;
  return count ?? 0;
}

export async function getLeadRows(rangeKey: DateRangeKey, limit = 5000) {
  if (!hasSupabaseAdminEnv()) {
    return { range: getDateRange(rangeKey), leads: [], error: null };
  }

  const range = getDateRange(rangeKey);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("leads")
    .select(
      `
        id,
        created_at,
        submitted_at,
        customer_name,
        phone,
        appointment_date,
        appointment_time,
        price,
        currency,
        source_type,
        payment_status,
        lead_status,
        booking_status,
        brands(name),
        treatments(name),
        packages(name,promo_price),
        branches(name),
        lead_source_snapshots(
          utm_source,
          utm_medium,
          utm_campaign,
          utm_content,
          tracking_status,
          audit_reason
        )
      `
    )
    .gte("created_at", range.start)
    .lt("created_at", range.end)
    .order("created_at", { ascending: false })
    .limit(limit);

  return {
    range,
    leads: ((data ?? []) as unknown as LeadRow[]),
    error,
  };
}
