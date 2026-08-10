import type { ReportMetrics, ReportSnapshot } from "@/lib/reports/types";

export type ReportTheme = {
  accent: string;
  accentSoft: string;
  dark: string;
  darkSoft: string;
  text: string;
  muted: string;
  line: string;
  good: string;
  warning: string;
  coverLight: boolean;
};

function normalizeHex(value: string | undefined, fallback: string) {
  const cleaned = (value || "").replace("#", "").trim();
  return /^[0-9a-f]{6}$/i.test(cleaned) ? `#${cleaned.toUpperCase()}` : fallback;
}

export function reportTheme(snapshot: ReportSnapshot): ReportTheme {
  const brand = snapshot.selection.brands.length === 1
    ? snapshot.selection.brands[0]
    : null;
  if (brand?.logoKey === "ineffable") {
    return {
      accent: "#69C7E8",
      accentSoft: "#DFF4FB",
      dark: "#123A4A",
      darkSoft: "#1B5064",
      text: "#173B4D",
      muted: "#557384",
      line: "#B9E4F3",
      good: "#24836B",
      warning: "#C26D2B",
      coverLight: false,
    };
  }
  if (brand?.logoKey === "gos") {
    return {
      accent: "#F36B32",
      accentSoft: "#FADCCB",
      dark: "#292725",
      darkSoft: "#4A4541",
      text: "#292725",
      muted: "#746E69",
      line: "#EAD8C8",
      good: "#2F826E",
      warning: "#C45C2B",
      coverLight: true,
    };
  }
  return {
    accent: normalizeHex(brand?.color, "#9A5D76"),
    accentSoft: normalizeHex(brand?.secondaryColor, "#F3E7EC"),
    dark: "#321428",
    darkSoft: "#5A2348",
    text: "#321428",
    muted: "#6D4A5C",
    line: "#EAD9E1",
    good: "#2E7D68",
    warning: "#B8662D",
    coverLight: false,
  };
}

export function stripHash(value: string) {
  return value.replace(/^#/, "");
}

export function money(value: number | null, decimals = 0) {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("zh-HK", {
    style: "currency",
    currency: "HKD",
    maximumFractionDigits: decimals,
  }).format(value);
}

export function count(value: number) {
  return Math.round(value).toLocaleString("zh-HK");
}

export function percentage(value: number | null, digits = 1) {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("zh-HK", {
    style: "percent",
    maximumFractionDigits: digits,
  }).format(value);
}

export function metricDelta(current: number | null, previous: number | null) {
  if (current === null || previous === null || previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}

export function deltaLabel(current: number | null, previous: number | null) {
  const delta = metricDelta(current, previous);
  if (delta === null) return "未有可比基準";
  if (Math.abs(delta) < 0.0005) return "與上月相若";
  return `${delta > 0 ? "+" : "−"}${percentage(Math.abs(delta))}`;
}

export function shortDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return new Intl.DateTimeFormat("zh-HK", {
    month: "numeric",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function dateTimeHkt(value: string | null) {
  if (!value) return "未有記錄";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未有記錄";
  return `${new Intl.DateTimeFormat("zh-HK", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Hong_Kong",
  }).format(date)} HKT`;
}

export function primaryMetricRows(metrics: ReportMetrics) {
  return [
    ["廣告費", money(metrics.spend), metrics.spend],
    ["Lead", count(metrics.leads), metrics.leads],
    ["Book", count(metrics.bookings), metrics.bookings],
    ["Show", count(metrics.shows), metrics.shows],
    ["CPL", money(metrics.cpl, 2), metrics.cpl],
    ["CPA · Show", money(metrics.costPerShow, 2), metrics.costPerShow],
  ] as const;
}
