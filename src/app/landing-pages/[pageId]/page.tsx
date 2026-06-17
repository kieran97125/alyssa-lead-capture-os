import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppNav } from "@/components/alyssa/AppNav";
import { LandingPageEditorDirtyState } from "@/components/alyssa/LandingPageEditorDirtyState";
import { MotionReveal } from "@/components/alyssa/MotionReveal";
import {
  publicThemeStyle,
  resolvePublicBrandTheme,
} from "@/lib/brandThemes";
import {
  publishLandingPageAction,
  saveLandingPageDraftAction,
} from "@/app/landing-pages/[pageId]/actions";
import {
  getBranch,
  getBrand,
  getConfigurationData,
  getPackage,
  getTreatment,
  packagePriceLabel,
  type FormSetting,
} from "@/lib/data/configuration";
import {
  getLandingPageContext,
  getLandingPageImageUrl,
  landingPageImageSlots,
  type LandingPageConfig,
} from "@/lib/data/landingPages";
import { getPublicEmbedPreviewUrl, getPublicLandingPageUrl } from "@/lib/data/appUrl";
import { getLandingPageEditorData } from "@/lib/data/landingPageStore";

export const dynamic = "force-dynamic";

export default async function LandingPageConfigPage({
  params,
  searchParams,
}: {
  params: Promise<{ pageId: string }>;
  searchParams?: Promise<{ builder_status?: string | string[] }>;
}) {
  const { pageId } = await params;
  const query = await searchParams;
  const [editorData, config] = await Promise.all([
    getLandingPageEditorData(pageId),
    getConfigurationData(),
  ]);

  if (!editorData) notFound();

  const {
    page,
    canPersist,
    statusMessage,
    latestDraftVersionNumber,
    publishedVersionNumber,
  } = editorData;
  const context = getLandingPageContext(page);
  const connectedForm =
    config.forms.find((form) => form.id === page.formId) ??
    config.forms.find((form) => form.publicFormToken === page.formToken) ??
    null;
  const selectedFormId = connectedForm?.id ?? config.forms[0]?.id ?? "";
  const selectedFormToken = connectedForm?.publicFormToken ?? page.formToken;
  const selectedFormPreviewUrl = selectedFormToken
    ? getPublicEmbedPreviewUrl(selectedFormToken)
    : "";
  const publicBrand =
    (connectedForm ? getBrand(config, connectedForm.brandId) : null) ??
    getBrand(config, page.brandId) ??
    context.brand ??
    null;
  const previewThemeStyle = publicThemeStyle(
    resolvePublicBrandTheme({
      brandSlug: publicBrand?.slug,
      brandName: publicBrand?.name,
    })
  ) as CSSProperties;
  const publicUrl = getPublicLandingPageUrl(page.slug);
  const publicDisplay = page.status === "published" ? publicUrl : "發布後才會公開";
  const actionMessage =
    typeof query?.builder_status === "string" ? query.builder_status : null;
  const selectedBrand =
    (connectedForm ? getBrand(config, connectedForm.brandId) : null) ??
    getBrand(config, page.brandId) ??
    context.brand ??
    null;
  const selectedTreatment =
    getTreatment(config, page.treatmentId) ??
    (connectedForm
      ? getTreatment(config, connectedForm.defaultTreatmentId)
      : null) ??
    context.treatment ??
    null;
  const selectedPackage =
    getPackage(config, page.packageId) ??
    (connectedForm ? getPackage(config, connectedForm.defaultPackageId) : null) ??
    context.package ??
    null;
  const selectedBranch =
    getBranch(config, page.branchId) ??
    (connectedForm ? getBranch(config, connectedForm.defaultBranchId) : null) ??
    context.branch ??
    null;
  const price = selectedPackage ? `HK$${selectedPackage.promoPrice}` : "未設定";
  const isIneffablePage =
    /ineffable/i.test(selectedBrand?.name ?? "") ||
    /ineffable/i.test(selectedBrand?.slug ?? "");
  const isAlyssaMainForm =
    /alyssa/i.test(connectedForm?.formName ?? "") ||
    selectedFormToken === "alyssa-main-form-dev-token";
  const publishMissingItems = [
    !selectedBrand ? "品牌未設定" : null,
    !selectedTreatment ? "療程未設定" : null,
    !selectedPackage ? "套餐未設定" : null,
    !selectedBranch ? "分店未設定" : null,
    !connectedForm ? "未連接登記表格" : null,
    connectedForm && selectedBrand && connectedForm.brandId !== selectedBrand.id
      ? "表格品牌與頁面品牌不一致"
      : null,
    isIneffablePage && isAlyssaMainForm
      ? "Ineffable 公開頁仍然連接 Alyssa 表格"
      : null,
    !page.title.trim() ? "頁面標題未填" : null,
    !page.heroTitle.trim() ? "Hero 標題未填" : null,
    !page.ctaText.trim() ? "CTA 文字未填" : null,
    !latestDraftVersionNumber ? "請先保存草稿" : null,
  ].filter((item): item is string => Boolean(item));
  const canPublish = canPersist && publishMissingItems.length === 0;

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <section className="rounded-[28px] border border-[#ead9cf] bg-white/86 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.1)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="alyssa-kicker">Landing Page 編輯</p>
              <h1 className="mt-2 text-3xl font-bold text-[#321428]">
                {page.title}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
                編輯廣告頁內容、圖片、優惠及連接表格。草稿保存後，可再發布成公開頁。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={publicUrl}
                className="rounded-full bg-[#5a2348] px-5 py-3 text-sm font-bold text-white"
              >
                開啟公開頁
              </Link>
              <Link
                href="/landing-pages"
                className="rounded-full border border-[#d9b66f] bg-white px-5 py-3 text-sm font-bold text-[#5a2348]"
              >
                返回列表
              </Link>
            </div>
          </div>
        </section>

        <section className="alyssa-premium-card mt-6 min-w-0 p-5">
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="alyssa-kicker">草稿與發布</p>
              <h2 className="mt-2 text-xl font-bold text-[#321428]">
                保存草稿後才發布公開頁
              </h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#6d4a5c]">
                {statusMessage}
              </p>
              {actionMessage && (
                <p className="mt-3 rounded-2xl border border-[#d9b66f] bg-[#fff6f0] px-4 py-3 text-sm font-bold text-[#5a2348]">
                  {actionMessage}
                </p>
              )}
              <LandingPageEditorDirtyState
                editorFormId="landing-page-editor-form"
                publishButtonId="landing-page-publish-button"
              />
              {publishMissingItems.length > 0 && (
                <p className="mt-3 rounded-2xl border border-[#ead9cf] bg-white px-4 py-3 text-sm font-semibold leading-6 text-[#6d4a5c]">
                  發布前請完成：{publishMissingItems.join("、")}
                </p>
              )}
            </div>
            <div className="flex min-w-0 flex-wrap gap-2">
              <button
                type="submit"
                form="landing-page-editor-form"
                disabled={!canPersist}
                className="rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(228,111,100,0.22)] transition hover:-translate-y-1 disabled:cursor-not-allowed disabled:bg-[#d8c5bc] disabled:shadow-none"
              >
                儲存草稿
              </button>
              <form action={publishLandingPageAction}>
                <input type="hidden" name="pageId" value={page.id} />
                <button
                  id="landing-page-publish-button"
                  type="submit"
                  disabled={!canPublish}
                  className="rounded-full border border-[#d9b66f] bg-white px-5 py-3 text-sm font-bold text-[#5a2348] transition hover:-translate-y-1 disabled:cursor-not-allowed disabled:text-[#9b8c86]"
                >
                  發布公開頁
                </button>
              </form>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-5">
            <InfoPill label="狀態" value={statusLabel(page.status)} />
            <InfoPill
              label="草稿版本"
              value={latestDraftVersionNumber ? `${latestDraftVersionNumber}` : "未有"}
            />
            <InfoPill
              label="發布版本"
              value={publishedVersionNumber ? `${publishedVersionNumber}` : "未發布"}
            />
            <InfoPill label="發布時間" value={formatDate(page.publishedAt)} />
            <InfoPill label="公開連結" value={publicDisplay} />
          </div>
        </section>

        <section className="alyssa-premium-card mt-6 min-w-0 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="alyssa-kicker">投放前檢查</p>
              <h2 className="mt-2 text-xl font-bold text-[#321428]">
                Campaign 上線前快速確認
              </h2>
            </div>
            <Link
              href={publicUrl}
              className="rounded-full border border-[#d9b66f] bg-white px-5 py-3 text-sm font-bold text-[#5a2348]"
            >
              開啟公開頁
            </Link>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ChecklistItem
              label="公開頁"
              value={page.status === "published" ? "已發布，可開啟" : "發布後才公開"}
              ready={page.status === "published"}
            />
            <ChecklistItem
              label="表格預覽"
              value={connectedForm ? "已連接表格" : "未找到連接表格"}
              ready={Boolean(connectedForm)}
            />
            <ChecklistItem
              label="表格代號"
              value={selectedFormToken || "未設定"}
              ready={Boolean(selectedFormToken)}
            />
            <ChecklistItem
              label="Allowed domain"
              value={
                connectedForm && connectedForm.allowedDomains.length > 0
                  ? `${connectedForm.allowedDomains.length} 個已設定`
                  : "如嵌入 Wix，請先加入"
              }
              ready={Boolean(connectedForm && connectedForm.allowedDomains.length > 0)}
            />
            <ChecklistItem label="測試 Lead" value="投放前提交一次測試" ready={false} />
            <ChecklistItem label="UTM" value="用廣告測試連結確認來源" ready={false} />
            <ChecklistItem label="價格" value={price} ready={price !== "未設定"} />
            <ChecklistItem
              label="公開內容"
              value="確認文案及圖片"
              ready={page.status === "published"}
            />
          </div>
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_390px]">
          <form
            id="landing-page-editor-form"
            action={saveLandingPageDraftAction}
            className="grid min-w-0 gap-6"
          >
            <input type="hidden" name="pageId" value={page.id} />
            <input type="hidden" name="templateName" value={page.templateName} />
            <input type="hidden" name="testingStatus" value={page.testingStatus} />

            <EditorSection
              eyebrow="基本"
              title="基本設定"
              description="設定頁面標題、狀態及公開連結。"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <TextField label="頁面標題" value={page.title} name="title" />
                <TextField label="Slug" value={page.slug} readOnly />
                <TextField label="狀態" value={statusLabel(page.status)} readOnly />
                <TextField label="公開連結" value={publicDisplay} readOnly />
              </div>
            </EditorSection>

            <EditorSection
              eyebrow="表格"
              title="連接登記表格"
              description="這個 Landing Page 會使用所選表格收集 Leads。"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <FormSelect
                  label="選擇表格"
                  name="connectedFormId"
                  defaultValue={selectedFormId}
                  forms={config.forms}
                />
                <TextField
                  label="表格代號"
                  value={selectedFormToken || "未設定"}
                  readOnly
                />
                {selectedFormPreviewUrl && (
                  <Link
                    href={selectedFormPreviewUrl}
                    className="inline-flex justify-center rounded-full border border-[#d9b66f] bg-white px-5 py-3 text-sm font-bold text-[#5a2348]"
                  >
                    預覽表格
                  </Link>
                )}
                <Link
                  href="/forms"
                  className="inline-flex justify-center rounded-full bg-[#5a2348] px-5 py-3 text-sm font-bold text-white"
                >
                  管理表格
                </Link>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {config.forms.slice(0, 4).map((form) => (
                  <FormSummaryCard
                    key={form.id}
                    form={form}
                    active={form.id === selectedFormId}
                    brand={getBrand(config, form.brandId)?.name ?? "未設定品牌"}
                    treatment={
                      getTreatment(config, form.defaultTreatmentId)?.name ??
                      "未設定療程"
                    }
                    packageLabel={packagePriceLabel(
                      getPackage(config, form.defaultPackageId)
                    )}
                    branch={
                      getBranch(config, form.defaultBranchId)?.name ?? "未設定分店"
                    }
                  />
                ))}
              </div>
            </EditorSection>

            <EditorSection
              eyebrow="首屏"
              title="Hero 內容"
              description="公開頁第一屏的主標題、副標題和圖片。"
            >
              <div className="grid gap-4">
                <TextField label="Hero 標題" value={page.heroTitle} name="heroTitle" />
                <TextAreaField
                  label="Hero 副標題"
                  value={page.heroSubtitle}
                  name="heroSubtitle"
                />
                <TextField label="Hero 圖片 URL" value={page.heroImageUrl} name="heroImageUrl" />
              </div>
            </EditorSection>

            <EditorSection
              eyebrow="圖片"
              title="圖片素材"
              description="目前可填圖片網址；上傳及素材庫會稍後加入。"
            >
              <div className="grid gap-4 lg:grid-cols-2">
                {landingPageImageSlots.map((slot) => (
                  <ImageSlotCard
                    key={slot.key}
                    name={slot.key}
                    label={slot.label}
                    recommendedType={slot.recommendedType}
                    ratio={slot.ratio}
                    value={getLandingPageImageUrl(page, slot.key)}
                  />
                ))}
              </div>
            </EditorSection>

            <EditorSection
              eyebrow="優惠"
              title="優惠內容"
              description="設定優惠標籤、優惠文字、主按鈕和次要按鈕。"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <TextField label="優惠標籤" value={page.offerBadge} name="offerBadge" />
                <TextField label="優惠標題" value={page.offerHeadline} name="offerHeadline" />
                <TextAreaField label="優惠內容" value={page.offerBody} name="offerBody" wide />
                <TextField label="主按鈕文字" value={page.ctaText} name="ctaText" />
                <TextField
                  label="次要按鈕文字"
                  value={page.secondaryCtaText}
                  name="secondaryCtaText"
                />
              </div>
            </EditorSection>

            <EditorSection
              eyebrow="賣點"
              title="痛點 / 賣點"
              description="用簡短文字說明客人需要和優惠價值。"
            >
              <div className="grid gap-5 lg:grid-cols-2">
                <Repeater title="客人痛點" items={page.painPoints} name="painPoints" />
                <Repeater title="主要賣點" items={page.benefits} name="benefits" />
              </div>
            </EditorSection>

            <EditorSection
              eyebrow="內容"
              title="內容段落"
              description="公開頁中的說明段落。"
            >
              <StructuredRepeater
                title="Landing Page 段落"
                titleName="sectionTitles"
                bodyName="sectionBodies"
                items={page.sections}
              />
            </EditorSection>

            <EditorSection
              eyebrow="療程"
              title="療程摘要"
              description="顯示這個頁面連接的品牌、療程、套餐和分店。"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <TextField label="品牌" value={selectedBrand?.name ?? "未設定"} readOnly />
                <TextField
                  label="療程"
                  value={selectedTreatment?.name ?? "未設定"}
                  readOnly
                />
                <TextField
                  label="套餐"
                  value={selectedPackage?.name ?? "未設定"}
                  readOnly
                />
                <TextField label="價錢" value={price} readOnly />
                <TextField
                  label="分店"
                  value={selectedBranch?.name ?? "未設定"}
                  readOnly
                />
              </div>
            </EditorSection>

            <EditorSection
              eyebrow="信任"
              title="流程 / 信任元素"
              description="幫客人理解預約和療程流程。"
            >
              <div className="grid gap-5 lg:grid-cols-2">
                <StructuredRepeater
                  titleName="processStepTitles"
                  bodyName="processStepBodies"
                  title="預約流程"
                  items={page.processSteps}
                />
                <Repeater title="信任元素" items={page.trustItems} name="trustItems" />
              </div>
            </EditorSection>

            <EditorSection
              eyebrow="FAQ"
              title="常見問題"
              description="常見問題會顯示在公開頁底部。"
            >
              <StructuredRepeater
                titleName="faqQuestions"
                bodyName="faqAnswers"
                title="常見問題內容"
                items={page.faqs.map((faq) => ({
                  title: faq.question,
                  body: faq.answer,
                }))}
              />
            </EditorSection>
          </form>

          <PreviewPanel
            page={page}
            price={price}
            treatment={selectedTreatment?.name ?? "未設定療程"}
            branch={selectedBranch?.name ?? "未設定分店"}
            previewUrl={publicUrl}
            formToken={selectedFormToken}
            themeStyle={previewThemeStyle}
          />
        </div>
      </div>
    </main>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "未發布";

  return new Intl.DateTimeFormat("zh-HK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusLabel(status: LandingPageConfig["status"]) {
  if (status === "published") return "已發布";
  if (status === "draft") return "草稿";
  if (status === "archived") return "已封存";
  if (status === "paused") return "暫停";
  return "可使用";
}

function EditorSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <MotionReveal>
      <section className="alyssa-premium-card min-w-0 p-5">
        <p className="alyssa-kicker">{eyebrow}</p>
        <h2 className="mt-2 text-xl font-bold text-[#321428]">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">{description}</p>
        <div className="mt-5 min-w-0">{children}</div>
      </section>
    </MotionReveal>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-[#fff6f0] p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-semibold text-[#5a2348]">
        {value}
      </p>
    </div>
  );
}

function TextField({
  label,
  value,
  name,
  readOnly = false,
}: {
  label: string;
  value: string;
  name?: string;
  readOnly?: boolean;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {label}
      </span>
      <input
        name={name}
        readOnly={readOnly || !name}
        defaultValue={value}
        className="mt-2 w-full min-w-0 rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-4 py-3 text-sm font-semibold text-[#5a2348] outline-none transition focus:border-[#e46f64] focus:bg-white"
      />
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
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {label}
      </span>
      <textarea
        name={name}
        defaultValue={value}
        rows={4}
        className="mt-2 w-full min-w-0 resize-none rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-4 py-3 text-sm font-semibold leading-6 text-[#5a2348] outline-none transition focus:border-[#e46f64] focus:bg-white"
      />
    </label>
  );
}

function FormSelect({
  label,
  name,
  forms,
  defaultValue,
}: {
  label: string;
  name: string;
  forms: FormSetting[];
  defaultValue: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {label}
      </span>
      <select
        name={name}
        required
        defaultValue={defaultValue}
        className="mt-2 w-full min-w-0 rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-4 py-3 text-sm font-semibold text-[#5a2348] outline-none transition focus:border-[#e46f64] focus:bg-white"
      >
        {forms.map((form) => (
          <option key={form.id} value={form.id}>
            {form.formName}
          </option>
        ))}
      </select>
    </label>
  );
}

function FormSummaryCard({
  form,
  active,
  brand,
  treatment,
  packageLabel,
  branch,
}: {
  form: FormSetting;
  active: boolean;
  brand: string;
  treatment: string;
  packageLabel: string;
  branch: string;
}) {
  return (
    <article
      className={`min-w-0 rounded-2xl border p-4 ${
        active ? "border-[#c9828e] bg-white" : "border-[#ead9cf] bg-[#fff6f0]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-bold text-[#321428]">{form.formName}</h3>
        {active && (
          <span className="rounded-full bg-[#5a2348] px-3 py-1 text-xs font-bold text-white">
            目前使用
          </span>
        )}
      </div>
      <p className="mt-2 break-words rounded-xl bg-[#fff6f0] px-3 py-2 font-mono text-xs font-semibold text-[#5a2348]">
        {form.publicFormToken}
      </p>
      <div className="mt-3 grid gap-1 text-xs font-semibold leading-5 text-[#6d4a5c]">
        <p>{brand}</p>
        <p>{treatment}</p>
        <p>{packageLabel}</p>
        <p>{branch}</p>
      </div>
    </article>
  );
}

function ImageSlotCard({
  name,
  label,
  recommendedType,
  ratio,
  value,
}: {
  name: string;
  label: string;
  recommendedType: string;
  ratio: string;
  value: string;
}) {
  const hasImage = Boolean(value);

  return (
    <article className="min-w-0 rounded-2xl border border-[#ead9cf] bg-[#fff6f0] p-4">
      <div
        className="flex min-h-40 items-end overflow-hidden rounded-[18px] border border-[#ead9cf] bg-[#321428] p-4 text-white"
        style={
          hasImage
            ? {
                backgroundImage: `linear-gradient(180deg, rgba(50,20,40,0.1), rgba(50,20,40,0.74)), url(${value})`,
                backgroundPosition: "center",
                backgroundSize: "cover",
              }
            : undefined
        }
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/70">
            {hasImage ? "已設定圖片" : "尚未設定圖片"}
          </p>
          <p className="mt-1 text-lg font-bold">{label}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        <TextField label="圖片欄位" value={label} readOnly />
        <TextField label="建議素材" value={recommendedType} readOnly />
        <TextField label="建議比例" value={ratio} readOnly />
        <TextField label="圖片 URL" value={value} name={name} />
      </div>
    </article>
  );
}

function Repeater({
  title,
  items,
  name,
}: {
  title: string;
  items: string[];
  name: string;
}) {
  const visibleItems = items.length > 0 ? items : ["", "", ""];

  return (
    <div className="min-w-0">
      <h3 className="font-bold text-[#321428]">{title}</h3>
      <div className="mt-3 grid gap-3">
        {visibleItems.map((item, index) => (
          <TextField
            key={`${title}-${index}`}
            label={`項目 ${index + 1}`}
            value={item}
            name={name}
          />
        ))}
      </div>
    </div>
  );
}

function StructuredRepeater({
  title,
  items,
  titleName,
  bodyName,
}: {
  title: string;
  items: Array<{ title: string; body: string }>;
  titleName: string;
  bodyName: string;
}) {
  const visibleItems =
    items.length > 0
      ? items
      : [
          { title: "", body: "" },
          { title: "", body: "" },
          { title: "", body: "" },
        ];

  return (
    <div>
      <h3 className="font-bold text-[#321428]">{title}</h3>
      <div className="mt-3 grid gap-4">
        {visibleItems.map((item, index) => (
          <div key={`${title}-${index}`} className="min-w-0 rounded-2xl bg-[#fff6f0] p-4">
            <TextField
              label={`標題 ${index + 1}`}
              value={item.title}
              name={titleName}
            />
            <div className="mt-3">
              <TextAreaField
                label={`內容 ${index + 1}`}
                value={item.body}
                name={bodyName}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChecklistItem({
  label,
  value,
  ready,
}: {
  label: string;
  value: string;
  ready: boolean;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-[#ead9cf] bg-[#fff6f0] p-4">
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
            ready ? "bg-emerald-100 text-emerald-700" : "bg-white text-[#9a5d76]"
          }`}
        >
          {ready ? "✓" : "•"}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#321428]">{label}</p>
          <p className="mt-1 break-words text-xs font-semibold leading-5 text-[#6d4a5c]">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function PreviewPanel({
  page,
  price,
  treatment,
  branch,
  previewUrl,
  formToken,
  themeStyle,
}: {
  page: LandingPageConfig;
  price: string;
  treatment: string;
  branch: string;
  previewUrl: string;
  formToken: string;
  themeStyle: CSSProperties;
}) {
  const heroImageUrl = page.heroImageUrl || page.mobileHeroImageUrl;

  return (
    <MotionReveal delay={0.16}>
      <aside className="h-fit min-w-0 rounded-[28px] border border-[#ead9cf] bg-white/90 p-5 shadow-[0_24px_70px_rgba(90,35,72,0.12)] xl:sticky xl:top-32">
        <p className="alyssa-kicker">預覽</p>
        <div
          className="mt-4 overflow-hidden rounded-[24px] bg-[var(--public-dark)] text-white"
          style={themeStyle}
        >
          <div
            className="min-h-full"
          style={
            heroImageUrl
              ? {
                  backgroundImage: `linear-gradient(90deg, color-mix(in srgb, var(--public-dark) 86%, transparent), color-mix(in srgb, var(--public-cta) 50%, transparent)), url(${heroImageUrl})`,
                  backgroundPosition: "center",
                  backgroundSize: "cover",
                }
              : undefined
          }
        >
          <div className="p-5">
            <p className="w-fit rounded-full bg-white/16 px-3 py-1 text-xs font-bold">
              {page.offerBadge}
            </p>
            <h2 className="mt-4 text-3xl font-bold leading-tight">{page.heroTitle}</h2>
            <p className="mt-3 text-sm leading-6 text-white/82">{page.heroSubtitle}</p>
            <div className="mt-5 inline-flex rounded-full bg-[var(--public-cta)] px-4 py-2 text-sm font-bold text-[var(--public-cta-text)]">
              {page.ctaText}
            </div>
          </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          <PreviewInfo label="優惠" value={`${page.offerHeadline} · ${price}`} />
          <PreviewInfo label="療程" value={treatment} />
          <PreviewInfo label="分店" value={branch} />
          <PreviewInfo label="登記表格" value={formToken || "未設定"} />
          <PreviewInfo label="公開頁" value={previewUrl} />
        </div>

        <Link
          href={previewUrl}
          className="mt-5 inline-flex w-full justify-center rounded-full bg-[#5a2348] px-5 py-3 text-sm font-bold text-white"
        >
          開啟公開頁
        </Link>
      </aside>
    </MotionReveal>
  );
}

function PreviewInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-[#fff6f0] p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-semibold text-[#5a2348]">
        {value}
      </p>
    </div>
  );
}
