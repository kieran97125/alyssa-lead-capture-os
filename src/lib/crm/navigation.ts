import { isAlyssaAllScope } from "@/lib/marketing/brandScope";

/** Only routes that actually understand Brand scope inherit the current selection. */
export function withCrmBrandScope(href: string, brandScope: string | null | undefined) {
  if (!brandScope) return href;
  const url = new URL(href, "https://crm.invalid");
  if (url.origin !== "https://crm.invalid") return href;
  if (!["/crm", "/crm/settings", "/crm/settings/whatsapp"].includes(url.pathname)) return href;
  if (url.pathname !== "/crm" && isAlyssaAllScope(brandScope)) return href;
  url.searchParams.set("brand", brandScope);
  return `${url.pathname}${url.search}${url.hash}`;
}
