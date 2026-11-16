import type { ConfigurationData, FormSetting } from "@/lib/data/configuration";

export function acquisitionDate(value?: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "未有紀錄";
  return new Intl.DateTimeFormat("zh-HK", { timeZone: "Asia/Hong_Kong", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function formPlacementLabel(kind?: string | null) {
  return kind === "wix" ? "Wix 網站" : kind === "landing_page" ? "獨立廣告頁" : kind === "both" ? "網站及廣告頁" : "未分類";
}

export function safePlacementUrl(value?: string | null) {
  if (!value) return null;
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.toString() : null; } catch { return null; }
}

export function formManagementState(form: FormSetting, config: Pick<ConfigurationData, "brands" | "treatments" | "packages" | "branches">) {
  if (form.status === "archived") return { label: "已停用", tone: "muted" as const };
  if (form.status !== "active") return { label: form.status === "draft" ? "草稿" : form.status === "paused" ? "已暫停" : "需要核對", tone: "warning" as const };
  const ready = config.brands.some(item => item.id === form.brandId)
    && config.treatments.some(item => item.id === form.defaultTreatmentId && item.brandId === form.brandId && item.status === "active")
    && config.packages.some(item => item.id === form.defaultPackageId && item.treatmentId === form.defaultTreatmentId && item.status === "active")
    && config.branches.some(item => item.id === form.defaultBranchId && item.brandId === form.brandId && item.status === "active");
  return ready ? { label: "接收中", tone: "success" as const } : { label: "需要設定", tone: "warning" as const };
}
