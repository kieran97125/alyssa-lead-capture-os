import { redirect } from "next/navigation";

export default async function CreateCampaignAliasPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) query.append(key, item);
  }
  redirect("/campaigns/new" + (query.size ? "?" + query.toString() : ""));
}
