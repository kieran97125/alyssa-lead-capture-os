import { redirect } from "next/navigation";

export default async function NewFormAliasPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams ?? {};
  const params = new URLSearchParams({ mode: "wix" });
  for (const [key, value] of Object.entries(query)) {
    if (key === "mode" || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) params.append(key === "form_status" ? "campaign_status" : key, item);
  }
  redirect(`/campaigns/new?${params}`);
}
