import { z } from "zod";

export const managedFormPlacementKinds = ["unspecified", "wix", "landing_page", "both"] as const;
export type ManagedFormPlacementKind = typeof managedFormPlacementKinds[number];

export function normalizePlacementUrl(value: string): string | null {
  const text = value.trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    return url.toString();
  } catch { return null; }
}

/** Browser-safe field contract shared by the guided creator and server actions. */
export const managedFormSchema = z.object({
  formName: z.string().trim().min(1, "請輸入名稱。").max(160, "名稱請保持在 160 字以內。"),
  brandId: z.string().trim().min(1, "請選擇品牌。"),
  defaultTreatmentId: z.string().trim().min(1, "請選擇療程。"),
  defaultPackageId: z.string().trim().min(1, "請選擇優惠。"),
  packageSelectionMode: z.enum(["fixed", "customer_choice"]),
  packageIds: z.array(z.string().trim().min(1)).max(100),
  defaultBranchId: z.string().trim().min(1, "請選擇分店。"),
  branchIds: z.array(z.string().trim().min(1)).max(100),
  allowedDomains: z.string().max(8_000, "網站設定過長，請減少網址。"),
  placementKind: z.enum(managedFormPlacementKinds),
  placementUrl: z.string().trim().max(2_000).refine(
    value => !value || normalizePlacementUrl(value) !== null,
    "請輸入完整網站網址，例如 https://example.com/offer。",
  ),
  expectedRevision: z.number().int().positive().optional(),
  requestId: z.uuid().optional(),
});

export type ManagedFormFields = z.input<typeof managedFormSchema>;
export type ManagedFormValues = z.output<typeof managedFormSchema>;
