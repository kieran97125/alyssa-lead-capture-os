import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LandingPageView } from "@/components/acquisition/LandingPageView";
import { getLandingPageDraftPreview } from "@/lib/data/landingPageStore";
import { getConfigurationData } from "@/lib/data/configuration";
import { requireModuleAccess } from "@/lib/security/internalAccessServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "廣告頁預覽", robots: { index: false, follow: false } };

export default async function LandingPagePreview({ params, searchParams }: {
  params: Promise<{ pageId: string }>; searchParams: Promise<{ version?: string; revision?: string }>;
}) {
  const { pageId } = await params;
  const query = await searchParams;
  const access = await requireModuleAccess("landing_pages");
  if (!access.allowed) redirect("/login?next=" + encodeURIComponent(`/landing-pages/${pageId}/preview`) + "&error=permission_denied");
  if (query.revision !== undefined && (!/^\d+$/.test(query.revision) || !Number.isSafeInteger(Number(query.revision)) || Number(query.revision) < 1)) notFound();
  const [preview, config] = await Promise.all([
    getLandingPageDraftPreview(pageId, { versionId: query.version, revision: query.revision === undefined ? undefined : Number(query.revision) }),
    getConfigurationData({ strict: true }),
  ]);
  if (!preview) notFound();
  return <div data-testid="protected-landing-page-preview">
    <header className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 border-b border-system-border bg-system-card px-4 py-3 text-system-foreground">
      <div><p className="font-semibold">廣告頁預覽</p><p className="text-xs text-system-muted-foreground">只供內部檢查，登記及廣告追蹤已停用。</p></div>
      <Link href={`/landing-pages/${preview.page.id}`} className="text-sm font-semibold text-system-primary underline underline-offset-4">返回編輯</Link>
    </header>
    <LandingPageView page={preview.page} config={config} preview />
  </div>;
}
