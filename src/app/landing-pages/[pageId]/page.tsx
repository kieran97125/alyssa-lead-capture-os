import { randomUUID } from "node:crypto";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppNav } from "@/components/alyssa/AppNav";
import { LandingPageSectionBuilder } from "@/components/alyssa/LandingPageSectionBuilder";
import { LandingPageEditorForm } from "@/components/acquisition/LandingPageEditorForm";
import { LandingPageFormChoice } from "@/components/acquisition/LandingPageFormChoice";
import { LandingPageImageField } from "@/components/acquisition/LandingPageImageField";
import { SystemDetails } from "@/components/system/SystemDetails";
import { saveLandingPageDraftAction, saveAndPreviewLandingPageAction, publishLandingPageAction } from "./actions";
import { getConfigurationData, getBrand, getTreatment, getPackage, getBranch, packagePriceLabel } from "@/lib/data/configuration";
import { getResolvedLandingPageContentSections } from "@/lib/data/landingPages";
import { getPublicLandingPageUrl } from "@/lib/data/appUrl";
import { getLandingPageEditorState } from "@/lib/data/landingPageStore";
import { requireModuleAccess } from "@/lib/security/internalAccessServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LandingPageConfigPage({ params, searchParams }: {
  params: Promise<{ pageId: string }>; searchParams?: Promise<{ builder_status?: string | string[] }>;
}) {
  const { pageId } = await params;
  const access = await requireModuleAccess("landing_pages");
  if (!access.allowed) redirect("/login?next=" + encodeURIComponent("/landing-pages/" + pageId) + "&error=permission_denied");
  const [editor, config, query] = await Promise.all([getLandingPageEditorState(pageId), getConfigurationData({ strict: true }), searchParams]);
  if (!editor) notFound();
  const { page } = editor;
  const form = config.forms.find(f => f.id === page.formId) ?? config.forms.find(f => f.publicFormToken === page.formToken);
  const forms = config.forms.filter(f => f.brandId === page.brandId && (f.status === "active" || f.id === form?.id));
  const publishedUrl = editor.publishedSlug ? getPublicLandingPageUrl(editor.publishedSlug) : null;
  const disabled = !editor.canPersist || page.status === "archived";
  return <main className="alyssa-shell">
    <AppNav />
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-7 sm:px-6" data-testid="landing-page-editor">
      <header className="space-y-3">
        <Link href="/campaigns?tab=pages" className="text-sm font-semibold text-system-muted-foreground hover:text-system-primary">← 表格及廣告頁</Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="alyssa-kicker">編輯廣告頁</p><h1 className="mt-2 text-2xl font-bold text-system-foreground">{page.title}</h1></div>
          {publishedUrl ? <a href={publishedUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-system-primary underline underline-offset-4">查看目前公開頁 ↗</a> : <span className="rounded-full bg-system-muted px-3 py-1 text-sm text-system-muted-foreground">尚未發布</span>}
        </div>
        <p className="text-sm leading-6 text-system-muted-foreground">修改內容後，先儲存並預覽；確認好再{publishedUrl ? "更新公開頁" : "發布"}。</p>
        {typeof query?.builder_status === "string" ? <p role="status" className="rounded-[var(--radius-control)] border border-system-border bg-system-card p-3 text-sm">{query.builder_status}</p> : null}
        {disabled ? <p role="status" className="text-sm font-semibold text-system-destructive">{page.status === "archived" ? "此頁已封存，請先返回列表還原。" : editor.statusMessage}</p> : null}
      </header>
      <LandingPageEditorForm key={`${page.id}-${editor.revision}`} saveAction={saveLandingPageDraftAction} previewAction={saveAndPreviewLandingPageAction} publishAction={publishLandingPageAction} disabled={disabled} published={Boolean(publishedUrl)}>
        <input type="hidden" name="pageId" value={page.id} />
        <input type="hidden" name="expectedRevision" value={editor.revision} />
        <input type="hidden" name="requestId" value={randomUUID()} />
        <input type="hidden" name="templateName" value={page.templateName} />
        <input type="hidden" name="testingStatus" value={page.testingStatus} />
        {(["painPoints", "benefits", "trustItems"] as const).flatMap(key => page[key].map((value, i) => <input key={`${key}-${i}`} type="hidden" name={key} value={value} />))}
        {page.sections.map((item, i) => <span hidden key={`section-${i}`}><input name="sectionTitles" value={item.title} readOnly /><input name="sectionBodies" value={item.body} readOnly /></span>)}
        {page.processSteps.map((item, i) => <span hidden key={`process-${i}`}><input name="processStepTitles" value={item.title} readOnly /><input name="processStepBodies" value={item.body} readOnly /></span>)}
        {page.faqs.map((item, i) => <span hidden key={`faq-${i}`}><input name="faqQuestions" value={item.question} readOnly /><input name="faqAnswers" value={item.answer} readOnly /></span>)}
        {(["processImage1Url", "processImage2Url", "processImage3Url", "processImage4Url", "processImage5Url", "processImage6Url", "trustImageUrl"] as const).map(key => <input key={key} type="hidden" name={key} value={page[key]} />)}
        <EditorSection title="1. 首屏內容" description="客人打開廣告頁時，首先看到的內容。">
          <TextField label="主標題" name="heroTitle" value={page.heroTitle} />
          <TextAreaField label="補充說明" name="heroSubtitle" value={page.heroSubtitle} />
          <div className="grid gap-4 sm:grid-cols-2"><TextField label="登記按鈕文字" name="ctaText" value={page.ctaText} /><TextField label="次要按鈕文字（可留空）" name="secondaryCtaText" value={page.secondaryCtaText} /></div>
        </EditorSection>
        <EditorSection title="2. 優惠內容" description="用簡短文字，說清楚今次推廣。">
          <div className="grid gap-4 sm:grid-cols-2"><TextField label="優惠標籤" name="offerBadge" value={page.offerBadge} /><TextField label="優惠標題" name="offerHeadline" value={page.offerHeadline} /></div>
          <TextAreaField label="優惠說明" name="offerBody" value={page.offerBody} />
        </EditorSection>
        <EditorSection title="3. 圖片" description="先看圖片是否適合，按「更換圖片」即可貼上新圖片連結。">
          <div className="grid gap-4 sm:grid-cols-2">
            <LandingPageImageField label="首屏主圖" name="heroImageUrl" value={page.heroImageUrl} guidance="電腦版最上方的大圖，建議使用橫圖。" />
            <LandingPageImageField label="手機主圖" name="mobileHeroImageUrl" value={page.mobileHeroImageUrl} guidance="手機版最上方的圖片，可使用直圖。" />
            <LandingPageImageField label="優惠圖片" name="offerImageUrl" value={page.offerImageUrl} guidance="展示今次優惠或療程特色。" />
            <LandingPageImageField label="登記區圖片" name="treatmentImageUrl" value={page.treatmentImageUrl} guidance="放在登記表格旁的療程圖片。" />
          </div>
        </EditorSection>
        <EditorSection title="4. 更多內容" description="按需要加入療程介紹、圖片或常見問題，亦可調整次序。"><LandingPageSectionBuilder initialSections={getResolvedLandingPageContentSections(page)} /></EditorSection>
        <EditorSection title="5. 登記表格" description="優惠、分店及登記設定會跟隨所選表格。">
          <LandingPageFormChoice initialFormId={form?.id ?? ""} options={forms.map(item => ({
            id: item.id, name: item.formName, active: item.status === "active",
            summary: [getBrand(config, item.brandId)?.name, getTreatment(config, item.defaultTreatmentId)?.name, packagePriceLabel(getPackage(config, item.defaultPackageId)), getBranch(config, item.defaultBranchId)?.name].filter(Boolean).join(" · "),
          }))} />
        </EditorSection>
        <SystemDetails title="頁面名稱及網址">
          <div className="grid gap-4"><TextField label="內部名稱" name="title" value={page.title} /><TextField label="網址最後一段" name="slug" value={page.slug} />
          <p className="text-xs text-system-muted-foreground">更改網址後，需要更新廣告及已分享的連結。公開頁會在發布後更新。</p></div>
        </SystemDetails>
      </LandingPageEditorForm>
    </div>
  </main>;
}

function EditorSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section className="grid min-w-0 gap-4 rounded-[var(--radius-panel)] border border-system-border bg-system-card p-5" data-editor-section data-editor-section-label={title}><div><h2 className="text-lg font-semibold text-system-foreground">{title}</h2><p className="mt-1 text-sm leading-6 text-system-muted-foreground">{description}</p></div>{children}</section>;
}

function TextField({
  label,
  value,
  name,
  readOnly = false,
  guidance,
}: {
  label: string;
  value: string;
  name?: string;
  readOnly?: boolean;
  guidance?: string[];
}) {
  return (
    <label className="block min-w-0">
      <span className="text-sm font-medium text-system-foreground">
        {label}
      </span>
      <input
        name={name}
        readOnly={readOnly || !name}
        defaultValue={value}
        className="mt-2 w-full min-w-0 rounded-[var(--radius-control)] border border-system-input bg-system-card px-3 py-2.5 text-sm text-system-foreground outline-none transition focus-visible:border-system-ring focus-visible:ring-2 focus-visible:ring-system-ring/30"
      />
      {guidance && <p className="mt-2 text-xs text-system-muted-foreground">{guidance.join(" · ")}</p>}
    </label>
  );
}

function TextAreaField({
  label,
  value,
  wide = false,
  name,
}: {
  label: string;
  value: string;
  wide?: boolean;
  name?: string;
}) {
  return (
    <label className={`block min-w-0 ${wide ? "md:col-span-2" : ""}`}>
      <span className="text-sm font-medium text-system-foreground">
        {label}
      </span>
      <textarea
        name={name}
        defaultValue={value}
        rows={4}
        className="mt-2 w-full min-w-0 resize-y rounded-[var(--radius-control)] border border-system-input bg-system-card px-3 py-2.5 text-sm leading-6 text-system-foreground outline-none transition focus-visible:border-system-ring focus-visible:ring-2 focus-visible:ring-system-ring/30"
      />
    </label>
  );
}
