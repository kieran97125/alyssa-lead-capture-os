import { redirect } from "next/navigation";

export default async function LandingPageListAlias({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (key === "tab" || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) query.append(key, item);
  }
  query.set("tab", "pages");
  redirect("/campaigns?" + query.toString());
}
