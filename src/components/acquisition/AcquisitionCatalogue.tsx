import { randomUUID } from "crypto";
import Link from "next/link";
import { FileText, Globe } from "lucide-react";
import { archiveFormAction, duplicateFormAction, restoreFormAction } from "@/app/forms/actions";
import { archiveLandingPageAction, restoreLandingPageAction } from "@/app/landing-pages/actions";
import { SubmitButton } from "@/components/alyssa/SubmitButton";
import { SystemButton } from "@/components/system/SystemButton";
import { SystemDetails } from "@/components/system/SystemDetails";
import { SystemConfirmationDialog } from "@/components/system/SystemConfirmationDialog";
import { acquisitionDate, formManagementState, formPlacementLabel, safePlacementUrl } from "@/lib/acquisition/managementDisplay";
import { getPublicLandingPageUrl } from "@/lib/data/appUrl";
import { packagePriceLabel, type ConfigurationData } from "@/lib/data/configuration";
import type { LandingPageConfig } from "@/lib/data/landingPages";

export type AcquisitionActivity = { lastRegistrationAt: string | null; lastDeliveryAt: string | null; pendingCount: number; blockedCount: number; uncertainCount: number; available: boolean };
export type CatalogueQuery = { brand?: string; status?: string; q?: string; treatment?: string; branch?: string };

export function AcquisitionBadge({ label, tone = "muted" }: { label: string; tone?: "muted" | "warning" | "success" }) {
  return <span className={`inline-flex w-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${tone === "success" ? "bg-emerald-50 text-emerald-800" : tone === "warning" ? "bg-amber-50 text-amber-900" : "bg-system-muted text-system-muted-foreground"}`}>{label}</span>;
}

export function AcquisitionCatalogue({ config, pages, activity, tab, query, pagesAvailable = true }: {
  config: ConfigurationData;
  pages: LandingPageConfig[];
  activity: Map<string, AcquisitionActivity>;
  tab: "forms" | "pages";
  query: CatalogueQuery;
  pagesAvailable?: boolean;
}) {
  const brand = config.brands.find(item => item.id === query.brand || item.slug === query.brand);
  const invalidBrand = Boolean(query.brand && !brand);
  const forms = invalidBrand ? [] : config.forms.filter(item => !brand || item.brandId === brand.id);
  const scopedPages = invalidBrand ? [] : pages.filter(item => !brand || item.brandId === brand.id);
  const status = query.status || "active";
  const needle = (query.q ?? "").trim().toLocaleLowerCase();
  const filteredForms = forms.filter(item => (status === "all" || (status === "archived" ? item.status === "archived" : item.status !== "archived"))
    && (!query.treatment || item.defaultTreatmentId === query.treatment)
    && (!query.branch || item.defaultBranchId === query.branch || config.formBranches.some(branch => branch.formId === item.id && branch.branchId === query.branch))
    && (!needle || [item.formName, config.treatments.find(t => t.id === item.defaultTreatmentId)?.name, config.packages.find(p => p.id === item.defaultPackageId)?.name].some(value => value?.toLocaleLowerCase().includes(needle))));
  const filteredPages = scopedPages.filter(item => (status === "all" || (status === "archived" ? item.status === "archived" : item.status !== "archived"))
    && (!query.treatment || item.treatmentId === query.treatment) && (!query.branch || item.branchId === query.branch)
    && (!needle || [item.title, config.treatments.find(t => t.id === item.treatmentId)?.name].some(value => value?.toLocaleLowerCase().includes(needle))));
  const activeCount = tab === "forms" ? forms.filter(item => item.status !== "archived").length : scopedPages.filter(item => item.status !== "archived").length;
  const archivedCount = tab === "forms" ? forms.filter(item => item.status === "archived").length : scopedPages.filter(item => item.status === "archived").length;
  const returnTo = `/campaigns?${new URLSearchParams({ tab, status, ...(query.brand ? { brand: query.brand } : {}), ...(query.q ? { q: query.q } : {}) })}`;
  const fieldClass = "mt-1.5 w-full rounded-[var(--radius-control)] border border-system-input bg-system-card px-3 py-2 text-sm text-system-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-system-ring";
  return <div className="mt-6 grid gap-5">
    <form method="get" className="grid items-end gap-3 rounded-[var(--radius-panel)] border border-system-border bg-system-card p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.5fr_auto]" aria-label="篩選推廣">
      <input type="hidden" name="tab" value={tab} />
      <label className="text-xs font-medium text-system-muted-foreground">品牌<select aria-label="品牌" name="brand" className={fieldClass} defaultValue={brand?.slug ?? ""}><option value="">全部品牌</option>{config.brands.map(item => <option key={item.id} value={item.slug}>{item.name}</option>)}</select></label>
      <label className="text-xs font-medium text-system-muted-foreground">顯示<select aria-label="顯示" name="status" className={fieldClass} defaultValue={status}><option value="active">使用中（{activeCount}）</option><option value="archived">已停用（{archivedCount}）</option><option value="all">全部（{activeCount + archivedCount}）</option></select></label>
      <label className="text-xs font-medium text-system-muted-foreground">搜尋<input aria-label="搜尋" name="q" defaultValue={query.q ?? ""} placeholder="名稱、療程或優惠" className={fieldClass} /></label>
      <SystemButton type="submit" variant="outline">套用</SystemButton>
      <div className="sm:col-span-2 lg:col-span-4"><SystemDetails title="更多篩選"><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">療程<select aria-label="療程篩選" name="treatment" className={fieldClass} defaultValue={query.treatment ?? ""}><option value="">全部療程</option>{config.treatments.filter(item => !brand || item.brandId === brand.id).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="text-sm">分店<select aria-label="分店篩選" name="branch" className={fieldClass} defaultValue={query.branch ?? ""}><option value="">全部分店</option>{config.branches.filter(item => !brand || item.brandId === brand.id).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div></SystemDetails></div>
    </form>
    {invalidBrand ? <p role="alert" className="text-sm text-system-destructive">找不到這個品牌。請重新選擇。</p> : null}
    {tab === "pages" && !pagesAvailable ? <div role="alert" className="rounded-[var(--radius-panel)] border border-system-border bg-system-card p-6"><h2 className="font-semibold">暫時未能讀取廣告頁</h2><p className="mt-2 text-sm text-system-muted-foreground">請重新載入，已有內容仍然保留。</p></div> : <>
      <p className="text-sm text-system-muted-foreground" data-testid="acquisition-result-count">{tab === "forms" ? filteredForms.length : filteredPages.length} 個{tab === "forms" ? "登記表格" : "廣告頁"}{brand ? ` · ${brand.name}` : ""}</p>
      <div className="overflow-visible rounded-[var(--radius-panel)] border border-system-border bg-system-card" data-testid={tab === "forms" ? "form-management-list" : "landing-page-list"}>
        {tab === "forms" ? filteredForms.map(form => {
          const state = formManagementState(form, config);
          const brandName = config.brands.find(item => item.id === form.brandId)?.name ?? "未設定品牌";
          const offer = config.packages.find(item => item.id === form.defaultPackageId);
          const linkedPages = pages.filter(item => item.formId === form.id || item.formToken === form.publicFormToken);
          const observed = activity.get(form.id);
          const placement = safePlacementUrl(form.placementUrl);
          return <article key={form.id} className="grid min-w-0 gap-4 border-b border-system-border p-4 last:border-b-0 sm:p-5 lg:grid-cols-[1.5fr_1fr_1fr_auto] lg:items-center" data-testid="acquisition-form-row">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="min-w-0 break-words text-base font-semibold"><Link href={`/forms/${form.id}`} className="hover:underline">{form.formName}</Link></h2><AcquisitionBadge {...state} /></div><p className="mt-2 text-sm text-system-muted-foreground">{brandName} · {offer ? packagePriceLabel(offer) : "未設定優惠"}</p></div>
            <div className="min-w-0 text-sm"><p>{formPlacementLabel(form.placementKind)}</p>{placement ? <a href={placement} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs text-system-muted-foreground hover:underline">{new URL(placement).host}{new URL(placement).pathname === "/" ? "" : new URL(placement).pathname}</a> : <p className="mt-1 text-xs text-system-muted-foreground">{linkedPages.length ? `連接 ${linkedPages.length} 個廣告頁` : "未填寫放置位置"}</p>}</div>
            <div className="text-xs text-system-muted-foreground"><p>最近登記：{observed?.available ? acquisitionDate(observed.lastRegistrationAt) : "暫未能確認"}</p>{observed?.available && observed.blockedCount + observed.uncertainCount > 0 ? <p className="mt-1 text-amber-900">有同步記錄需要處理</p> : null}</div>
            <div className="flex flex-wrap gap-2"><SystemButton density="compact" nativeButton={false} render={<Link href={`/forms/${form.id}`} />}>管理</SystemButton><SystemDetails title="更多"><div className="grid min-w-40 gap-3"><Link href={`/leads?form=${encodeURIComponent(form.publicFormToken)}`} className="text-sm hover:underline">查看登記</Link><form action={duplicateFormAction}><input type="hidden" name="formId" value={form.id} /><input type="hidden" name="expectedRevision" value={form.revision ?? ""} /><input type="hidden" name="requestId" value={randomUUID()} /><SystemButton density="compact" variant="outline" render={<SubmitButton pendingLabel="複製中…">複製成新表格</SubmitButton>}>複製成新表格</SystemButton></form>{form.status === "archived" ? <form action={restoreFormAction}><MutationFields formId={form.id} revision={form.revision} returnTo={returnTo} /><SystemButton density="compact" variant="outline" type="submit">重新啟用</SystemButton></form> : <SystemConfirmationDialog triggerLabel="停用" triggerSize="sm" title="停用這張表格？" description="停用後不會接收新登記，已有客人記錄會保留。" confirmControl={<form action={archiveFormAction}><MutationFields formId={form.id} revision={form.revision} returnTo={returnTo} /><input type="hidden" name="confirmArchive" value="yes" /><SystemButton variant="destructive" type="submit">停用表格</SystemButton></form>} />}</div></SystemDetails></div>
          </article>;
        }) : filteredPages.map(page => {
          const published = page.status === "published";
          const form = config.forms.find(item => item.id === page.formId || item.publicFormToken === page.formToken);
          const linkedBrand = config.brands.find(item => item.id === page.brandId);
          const offer = config.packages.find(item => item.id === page.packageId);
          const url = published ? getPublicLandingPageUrl(page.publishedSlug || page.slug) : null;
          return <article key={page.id} className="grid gap-4 border-b border-system-border p-4 last:border-b-0 sm:p-5 lg:grid-cols-[1.5fr_1fr_auto] lg:items-center" data-testid="landing-page-row"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Globe size={17} aria-hidden="true" className="text-system-muted-foreground" /><h2 className="break-words font-semibold">{page.title}</h2><AcquisitionBadge label={published ? "已發佈" : page.status === "archived" ? "已停用" : "草稿"} tone={published ? "success" : "muted"} /></div><p className="mt-2 text-sm text-system-muted-foreground">{linkedBrand?.name ?? "未設定品牌"} · {offer ? packagePriceLabel(offer) : "未設定優惠"}</p></div><div className="min-w-0 text-sm"><p>{form?.formName ?? "需要連接登記表格"}</p><p className="mt-1 text-xs text-system-muted-foreground">{published ? "客人可透過連結開啟" : "發佈前只供內部預覽"}</p></div><div className="flex flex-wrap gap-2"><SystemButton density="compact" nativeButton={false} render={<Link href={`/landing-pages/${page.id}`} />}>編輯</SystemButton><SystemButton density="compact" variant="outline" nativeButton={false} render={<Link href={`/landing-pages/${page.id}/preview`} />}>預覽</SystemButton>{url ? <SystemButton density="compact" variant="outline" nativeButton={false} render={<a href={url} target="_blank" rel="noreferrer" />}>開啟廣告頁</SystemButton> : null}<SystemDetails title="更多">{page.status === "archived" ? <form action={restoreLandingPageAction}><input type="hidden" name="pageId" value={page.id} /><input type="hidden" name="expectedRevision" value={page.revision ?? ""} /><input type="hidden" name="requestId" value={randomUUID()} /><input type="hidden" name="returnTo" value={returnTo} /><SystemButton variant="outline" density="compact" type="submit">恢復草稿</SystemButton></form> : <SystemConfirmationDialog triggerLabel="停用廣告頁" triggerSize="sm" title="停用這個廣告頁？" description="公開連結將停止展示，已有登記記錄會保留。" confirmControl={<form action={archiveLandingPageAction}><input type="hidden" name="pageId" value={page.id} /><input type="hidden" name="expectedRevision" value={page.revision ?? ""} /><input type="hidden" name="requestId" value={randomUUID()} /><input type="hidden" name="returnTo" value={returnTo} /><input type="hidden" name="confirmArchive" value="yes" /><SystemButton variant="destructive" type="submit">停用廣告頁</SystemButton></form>} />}</SystemDetails></div></article>;
        })}
        {(tab === "forms" ? filteredForms.length : filteredPages.length) === 0 ? <div className="grid justify-items-center gap-3 p-10 text-center"><FileText size={28} aria-hidden="true" className="text-system-muted-foreground" /><h2 className="font-semibold">未有符合條件的{tab === "forms" ? "登記表格" : "廣告頁"}</h2><p className="text-sm text-system-muted-foreground">可以調整篩選，或者新增一個推廣。</p></div> : null}
      </div>
    </>}
  </div>;
}

function MutationFields({ formId, revision, returnTo }: { formId: string; revision?: number; returnTo: string }) {
  return <><input type="hidden" name="formId" value={formId} /><input type="hidden" name="expectedRevision" value={revision ?? ""} /><input type="hidden" name="returnTo" value={returnTo} /></>;
}
