import { AppNav } from "@/components/alyssa/AppNav";
import { AcquisitionHeader } from "@/components/acquisition/AcquisitionHeader";
import { AcquisitionCatalogue, type AcquisitionActivity } from "@/components/acquisition/AcquisitionCatalogue";
import { getAcquisitionConfigurationData } from "@/lib/data/configuration";
import { getLandingPageList } from "@/lib/data/landingPageStore";
import { getFormActivitySummaries } from "@/lib/acquisition/formActivity";

export const dynamic = "force-dynamic";

export default async function CampaignsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams ?? {};
  const first = (key: string) => Array.isArray(query[key]) ? query[key]?.[0] ?? "" : query[key] ?? "";
  const tab = first("tab") === "pages" ? "pages" : "forms";
  const [configuration, pageResult] = await Promise.all([getAcquisitionConfigurationData(), getLandingPageList().then(value => ({ available: true as const, value })).catch(() => ({ available: false as const, value: null }))]);
  const message = first("form_status") || first("landing_status");
  let activity = new Map<string, AcquisitionActivity>();
  if (configuration.available && tab === "forms") {
    try { activity = await getFormActivitySummaries(configuration.config.forms.map(form => form.id)); } catch { /* Per-form unavailable states remain explicit. */ }
  }
  return <main className="alyssa-shell" data-testid="acquisition-management-screen"><AppNav /><div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-9">
    <AcquisitionHeader tab={tab} brand={first("brand")} />
    {message ? <p role="status" className="mt-5 rounded-[var(--radius-control)] border border-system-border bg-system-card p-4 text-sm">{message}</p> : null}
    {configuration.available ? <AcquisitionCatalogue config={configuration.config} pages={pageResult.value?.pages ?? []} pagesAvailable={pageResult.available && pageResult.value?.available === true} activity={activity} tab={tab} query={{ brand: first("brand"), status: first("status") || (first("archive") === "archived" ? "archived" : first("archive") === "all" ? "all" : "active"), q: first("q"), treatment: first("treatment"), branch: first("branch") }} /> : <section role="alert" className="mt-6 rounded-[var(--radius-panel)] border border-system-border bg-system-card p-6"><h2 className="font-semibold">暫時未能讀取表格設定</h2><p className="mt-2 text-sm text-system-muted-foreground">已有內容仍然保留，請重新載入後再試。</p></section>}
  </div></main>;
}
