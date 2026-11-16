import type { PackageSetting } from "@/lib/data/configuration";

/** Pure display formatting shared by server readers and browser editors. */
export function packagePriceLabel(item: PackageSetting | null | undefined) {
  if (!item) return "未設定";
  const price = item.promoPrice !== null && item.promoPrice !== "" ? item.promoPrice : item.originalPrice;
  if (price === null || price === "") return `${item.name} · 預約查詢`;
  const amount = typeof price === "string" ? Number(price) : price;
  const label = typeof amount === "number" && Number.isFinite(amount)
    ? new Intl.NumberFormat("zh-HK", { style: "currency", currency: item.currency || "HKD", maximumFractionDigits: 0 }).format(amount)
    : "未設定";
  return `${item.name} · ${label}`;
}
