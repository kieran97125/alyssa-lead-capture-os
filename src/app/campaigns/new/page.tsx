import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";
import { AcquisitionCreationForm } from "@/components/acquisition/AcquisitionCreationForm";
import { SystemButton } from "@/components/system/SystemButton";
import { createCampaignAction } from "@/app/campaigns/new/actions";
import { getAcquisitionConfigurationData } from "@/lib/data/configuration";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage({ searchParams }: { searchParams?: Promise<{ brand?: string | string[]; mode?: string | string[]; campaign_status?: string | string[] }> }) {
  const [configuration, query] = await Promise.all([getAcquisitionConfigurationData(), searchParams]);
  const value = (input?: string | string[]) => Array.isArray(input) ? input[0] : input;
  const message = value(query?.campaign_status);
  return <main className="alyssa-shell"><AppNav /><div className="mx-auto max-w-4xl px-4 py-7 sm:px-6 sm:py-9">
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold tracking-widest text-system-muted-foreground">表格及廣告頁</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-system-foreground">新增推廣</h1></div><SystemButton variant="outline" nativeButton={false} render={<Link href="/campaigns" />}>返回管理</SystemButton></header>
    {message ? <p role="status" className="mb-5 rounded-[var(--radius-control)] border border-system-border bg-system-card p-4 text-sm">{message}</p> : null}
    {configuration.available ? configuration.config.brands.length ? <AcquisitionCreationForm config={configuration.config} initialBrandId={value(query?.brand)} initialMode={value(query?.mode) === "wix" ? "wix" : value(query?.mode) === "landing_page" ? "landing_page" : undefined} action={createCampaignAction} /> : <section className="rounded-[var(--radius-panel)] border border-system-border bg-system-card p-6"><h2 className="font-semibold">先加入品牌資料</h2><p className="mt-2 mb-4 text-sm text-system-muted-foreground">設定品牌、優惠及分店後，就可以建立登記表格。</p><SystemButton nativeButton={false} render={<Link href="/brands" />}>前往品牌資料</SystemButton></section> : <section role="alert" className="rounded-[var(--radius-panel)] border border-system-border bg-system-card p-6"><h2 className="font-semibold">暫時未能讀取設定</h2><p className="mt-2 text-sm text-system-muted-foreground">資料仍然保留，請重新載入後再試。</p></section>}
  </div></main>;
}
