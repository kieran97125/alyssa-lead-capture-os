import type { ConfigurationData } from "@/lib/data/configuration";

export type AcquisitionActionResult = void | { ok: false; message: string; fieldErrors?: Record<string, string> };
export type AcquisitionConfiguration = Pick<ConfigurationData, "brands" | "treatments" | "packages" | "branches" | "forms">;
export const acquisitionFieldClass = "mt-2 w-full min-w-0 rounded-[var(--radius-control)] border border-system-input bg-system-card px-3 py-2.5 text-sm text-system-foreground outline-none focus-visible:border-system-primary focus-visible:ring-2 focus-visible:ring-system-ring/30 disabled:bg-system-muted disabled:text-system-muted-foreground";
