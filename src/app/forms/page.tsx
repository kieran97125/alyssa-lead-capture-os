import { redirect } from "next/navigation";

/** Keep installed bookmarks while giving staff one management catalogue. */
export default async function FormsAliasPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams ?? {};
  const params = new URLSearchParams({ tab: "forms" });
  for (const [key, value] of Object.entries(query)) {
    if (key === "tab" || key === "archive" || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) params.append(key, item);
  }
  if (!params.has("status") && typeof query.archive === "string") params.set("status", query.archive === "all" ? "all" : query.archive === "archived" ? "archived" : "active");
  redirect(`/campaigns?${params}`);
}
