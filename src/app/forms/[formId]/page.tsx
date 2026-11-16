import { randomUUID } from "crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppNav } from "@/components/alyssa/AppNav";
import { CopyButton } from "@/components/alyssa/CopyButton";
import { ManagedFormEditor } from "@/components/acquisition/ManagedFormEditor";
import { WixSetupPanel } from "@/components/acquisition/WixSetupPanel";
import { AcquisitionBadge } from "@/components/acquisition/AcquisitionCatalogue";
import { SystemButton } from "@/components/system/SystemButton";
import { SystemDetails } from "@/components/system/SystemDetails";
import { SystemConfirmationDialog } from "@/components/system/SystemConfirmationDialog";
import { archiveFormAction, duplicateFormAction, restoreFormAction, updateFormAction } from "@/app/forms/actions";
import { META_URL_PARAMETER_GUIDE, getFormOperations } from "@/lib/data/brandOperations";
import { getAcquisitionConfigurationData, getFormBranchSettings, getFormPackageSettings } from "@/lib/data/configuration";
import { getLandingPageList } from "@/lib/data/landingPageStore";
import { alyssaDefaultForm } from "@/lib/data/alyssaConfig";
import { getFormActivitySummaries } from "@/lib/acquisition/formActivity";
import { acquisitionDate, formManagementState, formPlacementLabel } from "@/lib/acquisition/managementDisplay";

export const dynamic = "force-dynamic";

export default async function FormConfigPage({ params, searchParams }: {
  params: Promise<{ formId: string }>;
  searchParams?: Promise<{ form_status?: string | string[] }>;
}) {
  const [{ formId }, query, configuration] = await Promise.all([params, searchParams, getAcquisitionConfigurationData()]);
  if (!configuration.available) return <main className="alyssa-shell"><AppNav /><section role="alert" className="mx-auto mt-8 max-w-3xl rounded-[var(--radius-panel)] border border-system-border bg-system-card p-6"><h1 className="text-xl font-semibold">暫時未能讀取表格設定</h1><p className="mt-2 text-sm text-system-muted-foreground">已有設定仍然保留，請重新載入後再試。</p></section></main>;
  const config = configuration.config;
  const form = config.forms.find(item => item.id === formId || item.publicFormToken === formId || (formId === alyssaDefaultForm.id && item.publicFormToken === alyssaDefaultForm.publicFormToken));
  if (!form) notFound();
  const [pages, activity] = await Promise.all([getLandingPageList(), getFormActivitySummaries([form.id])]);
  const ops = getFormOperations(config, form);
  const state = formManagementState(form, config);
  const observed = activity.get(form.id);
  const linkedPages = pages.pages.filter(page => page.formId === form.id || page.formToken === form.publicFormToken);
  const message = Array.isArray(query?.form_status) ? query.form_status[0] : query?.form_status;
  const previewUrl = `/forms/${form.id}/preview`;
  const returnTo = `/forms/${form.id}`;
  const needsAttention = Boolean(observed?.available && observed.blockedCount + observed.uncertainCount > 0);

  return <main className="alyssa-shell"><AppNav /><div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-9">
    <header className="flex flex-wrap items-end justify-between gap-5"><div className="min-w-0"><Link href={`/campaigns?${new URLSearchParams({ tab: "forms", brand: ops.brand?.slug ?? "" })}`} className="text-sm text-system-muted-foreground hover:underline">表格及廣告頁</Link><div className="mt-3 flex flex-wrap items-center gap-3"><h1 className="break-words text-3xl font-semibold tracking-tight">{form.formName}</h1><AcquisitionBadge {...state} /></div><p className="mt-3 text-sm text-system-muted-foreground">{ops.brand?.name ?? "未設定品牌"} · {ops.packageLabel} · {ops.branchLabel}</p></div><SystemButton nativeButton={false} render={<Link href={previewUrl} />}>預覽表格</SystemButton></header>
    {message ? <p role="status" className="mt-5 rounded-[var(--radius-control)] border border-system-border bg-system-card p-4 text-sm">{message}</p> : null}
    <section aria-label="登記及同步情況" className="mt-6 grid gap-3 sm:grid-cols-3"><Summary label="用途" value={formPlacementLabel(form.placementKind)} /><Summary label="最近收到登記" value={observed?.available ? acquisitionDate(observed.lastRegistrationAt) : "暫時未能確認"} /><Summary label="最近完成同步" value={observed?.available ? acquisitionDate(observed.lastDeliveryAt) : "暫時未能確認"} /></section>
    {needsAttention ? <div role="status" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-control)] border border-system-border bg-system-card p-4 text-sm"><p>有 {observed!.blockedCount + observed!.uncertainCount} 項登記同步需要處理。</p><SystemButton variant="outline" density="compact" nativeButton={false} render={<Link href={`/leads?form=${encodeURIComponent(form.publicFormToken)}`} />}>查看登記</SystemButton></div> : observed?.available && observed.pendingCount > 0 ? <p className="mt-4 text-sm text-system-muted-foreground">有 {observed.pendingCount} 項登記正在等候同步。</p> : null}
    <div className="mt-6 grid items-start gap-5 xl:grid-cols-[1.1fr_1fr]">
      <ManagedFormEditor key={`${form.id}-${form.revision}`} config={config} setting={form} selectedPackageIds={getFormPackageSettings(config, form).map(item => item.packageId)} selectedBranchIds={getFormBranchSettings(config, form).map(item => item.branchId)} action={updateFormAction} />
      <aside className="grid min-w-0 gap-5">
        <WixSetupPanel formName={form.formName} embedCode={ops.embedCode} wixAttributionBridgeCode={ops.wixAttributionBridgeCode} previewUrl={previewUrl} placementUrl={form.placementUrl} trackingParameters={META_URL_PARAMETER_GUIDE} />
        <section className="rounded-[var(--radius-panel)] border border-system-border bg-system-card p-5"><h2 className="font-semibold">使用這張表格的廣告頁</h2>{!pages.available ? <p className="mt-3 text-sm text-system-muted-foreground">暫時未能確認，請稍後重新載入。</p> : linkedPages.length ? <ul className="mt-3 grid gap-3">{linkedPages.map(page => <li key={page.id} className="flex flex-wrap items-center justify-between gap-2 text-sm"><Link href={`/landing-pages/${page.id}`} className="font-medium hover:underline">{page.title}</Link><AcquisitionBadge label={page.status === "published" ? "已發佈" : page.status === "archived" ? "已停用" : "草稿"} tone={page.status === "published" ? "success" : "muted"} /></li>)}</ul> : <p className="mt-3 text-sm text-system-muted-foreground">未有廣告頁使用這張表格。</p>}</section>
        <SystemDetails title="技術資料"><dl className="grid gap-4"><Technical label="表格識別碼" value={form.publicFormToken} /><Technical label="Pixel" value={ops.pixelId || "未設定"} /><Technical label="允許網站" value={form.allowedDomains.join("、") || "未設定"} /><Technical label="完成後前往" value={ops.successRedirectUrl || "留在表格顯示完成訊息"} /><Technical label="更新時間" value={acquisitionDate(form.updatedAt)} /><Technical label="設定版本" value={form.revision ? String(form.revision) : "未能確認"} /></dl><div className="mt-4 flex flex-wrap gap-2"><CopyButton value={form.publicFormToken} label="複製識別碼" /><SystemButton variant="outline" density="compact" nativeButton={false} render={<Link href={`/embed/${encodeURIComponent(form.publicFormToken)}`} target="_blank" />}>開啟正式表格</SystemButton></div></SystemDetails>
        <SystemDetails title="更多操作"><div className="flex flex-wrap items-center gap-3"><form action={duplicateFormAction}><input type="hidden" name="formId" value={form.id} /><input type="hidden" name="expectedRevision" value={form.revision ?? ""} /><input type="hidden" name="requestId" value={randomUUID()} /><SystemButton variant="outline" type="submit">複製成新表格</SystemButton></form>{form.status === "archived" ? <form action={restoreFormAction}><MutationFields formId={form.id} revision={form.revision} returnTo={returnTo} /><SystemButton variant="outline" type="submit">重新啟用</SystemButton></form> : <SystemConfirmationDialog triggerLabel="停用表格" triggerSize="default" title="停用這張表格？" description="停用後不會接收新登記，已有客人記錄會保留。" confirmControl={<form action={archiveFormAction}><MutationFields formId={form.id} revision={form.revision} returnTo={returnTo} /><input type="hidden" name="confirmArchive" value="yes" /><SystemButton variant="destructive" type="submit">停用表格</SystemButton></form>} />}</div></SystemDetails>
      </aside>
    </div>
  </div></main>;
}

function Summary({ label, value }: { label: string; value: string }) { return <div className="min-w-0 rounded-[var(--radius-card)] border border-system-border bg-system-card p-4"><p className="text-xs text-system-muted-foreground">{label}</p><p className="mt-2 break-words text-sm font-semibold">{value}</p></div>; }
function Technical({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><dt className="text-xs text-system-muted-foreground">{label}</dt><dd className="mt-1 break-all text-sm">{value}</dd></div>; }
function MutationFields({ formId, revision, returnTo }: { formId: string; revision?: number; returnTo: string }) { return <><input type="hidden" name="formId" value={formId} /><input type="hidden" name="expectedRevision" value={revision ?? ""} /><input type="hidden" name="returnTo" value={returnTo} /></>; }
