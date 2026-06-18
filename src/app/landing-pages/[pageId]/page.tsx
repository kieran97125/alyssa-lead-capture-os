import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppNav } from "@/components/alyssa/AppNav";
import { LandingPageEditorDirtyState } from "@/components/alyssa/LandingPageEditorDirtyState";
import { LandingPageEditorFollowPreview } from "@/components/alyssa/LandingPageEditorFollowPreview";
import { LandingPageSectionBuilder } from "@/components/alyssa/LandingPageSectionBuilder";
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
  getResolvedLandingPageContentSections,
  type LandingPageContentSection,
  type LandingPageContentSectionLayout,
  type LandingPageConfig,
} from "@/lib/data/landingPages";
import {
  getPublicEmbedPreviewUrl,
  getPublicLandingPageUrl,
} from "@/lib/data/appUrl";
import { getLandingPageEditorState } from "@/lib/data/landingPageStore";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
    getLandingPageEditorState(pageId),
    getConfigurationData(),
  ]);

  if (!editorData) notFound();

  const {
    page,
    canPersist,
    statusMessage,
    latestDraftVersionNumber,
    publishedVersionNumber,
    loadedFrom,
    pageRecordId,
    versionId,
    versionCreatedAt,
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
  const publicUrl = getPublicLandingPageUrl(page.slug);
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
  const publicBrand =
    selectedBrand ??
    (connectedForm ? getBrand(config, connectedForm.brandId) : null) ??
    null;
  const previewThemeStyle = publicThemeStyle(
    resolvePublicBrandTheme({
      brandSlug: publicBrand?.slug,
      brandName: publicBrand?.name,
    })
  ) as CSSProperties;
  const publicDisplay = page.status === "published" ? publicUrl : "發布後可開啟";
  const publishMissingItems = [
    !selectedBrand ? "品牌未設定" : null,
    !selectedTreatment ? "療程未設定" : null,
    !selectedPackage ? "套餐未設定" : null,
    !selectedBranch ? "分店未設定" : null,
    !connectedForm ? "未連接表格" : null,
    !page.title.trim() ? "頁面名稱未填寫" : null,
    !page.heroTitle.trim() ? "Hero 標題未填寫" : null,
    !page.ctaText.trim() ? "CTA 按鈕文字未填寫" : null,
    !latestDraftVersionNumber ? "請先保存草稿" : null,
  ].filter((item): item is string => Boolean(item));
  const canPublish = canPersist && publishMissingItems.length === 0;
  const canSaveDraftAction = true;
  const canPublishAction = true;
  const contentSections = getResolvedLandingPageContentSections(page);
  const editorDebugItems = [
    `loadedFrom=${loadedFrom}`,
    `pageId=${pageRecordId ?? page.id}`,
    `slug=${page.slug}`,
    `versionId=${versionId ?? "none"}`,
    `versionCreatedAt=${versionCreatedAt ?? "none"}`,
    `updatedAt=${page.updatedAt ?? "none"}`,
    `publishedAt=${page.publishedAt ?? "none"}`,
    `contentSections=${contentSections.length}`,
  ];

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
                按公開頁順序編輯內容：Hero、優惠摘要、療程流程、表格圖片及 FAQ。
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
                保存內容後再發布公開頁
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
                disabled={!canPersist || !canSaveDraftAction}
                className="rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(228,111,100,0.22)] transition hover:-translate-y-1 disabled:cursor-not-allowed disabled:bg-[#d8c5bc] disabled:shadow-none"
              >
                保存草稿
              </button>
              <button
                id="landing-page-publish-button"
                type="submit"
                form="landing-page-editor-form"
                formAction={publishLandingPageAction}
                disabled={!canPublish || !canPublishAction}
                className="rounded-full border border-[#d9b66f] bg-white px-5 py-3 text-sm font-bold text-[#5a2348] transition hover:-translate-y-1 disabled:cursor-not-allowed disabled:text-[#9b8c86]"
              >
                發布公開頁
              </button>
              {!canPublishAction && (
                <p className="max-w-[260px] rounded-2xl bg-[#fff6f0] px-4 py-3 text-sm font-bold leading-6 text-[#5a2348]">
                  只有 Owner 可以發布公開頁。
                </p>
              )}
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-6">
            <InfoPill label="狀態" value={statusLabel(page.status)} />
            <InfoPill label="載入來源" value={loadedFromLabel(loadedFrom)} />
            <InfoPill
              label="草稿版本"
              value={latestDraftVersionNumber ? `${latestDraftVersionNumber}` : "未保存"}
            />
            <InfoPill
              label="發布版本"
              value={publishedVersionNumber ? `${publishedVersionNumber}` : "未發布"}
            />
            <InfoPill label="發布時間" value={formatDate(page.publishedAt)} />
            <InfoPill label="公開頁" value={publicDisplay} />
          </div>
          <p className="mt-3 rounded-2xl bg-[#3b2433] px-4 py-3 font-mono text-xs leading-6 text-white/80">
            {editorDebugItems.join(" · ")}
          </p>
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
              location="公開頁位置：頁面設定"
              title="基本資料"
              description="設定頁面名稱、狀態及公開網址。"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <TextField label="頁面名稱" value={page.title} name="title" />
                <TextField label="Slug" value={page.slug} name="slug" />
                <TextField label="狀態" value={statusLabel(page.status)} readOnly />
                <TextField label="公開頁網址" value={publicDisplay} readOnly />
              </div>
            </EditorSection>

            <EditorSection
              location="公開頁位置：表格連接"
              title="連接登記表格"
              description="公開頁會使用這張表格收集 Leads。"
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
                  查看表格
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
              location="公開頁位置：Hero"
              title="Hero 首屏內容"
              description="客人進入頁面第一眼看到的標題、文案及主圖。"
            >
              <div className="grid gap-4">
                <TextField label="Hero 標題" value={page.heroTitle} name="heroTitle" />
                <TextAreaField
                  label="Hero 副標題"
                  value={page.heroSubtitle}
                  name="heroSubtitle"
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <TextField
                    label="Hero 圖片 URL"
                    value={page.heroImageUrl}
                    name="heroImageUrl"
                    guidance={[
                      "建議比例：16:9",
                      "建議尺寸：1920 × 1080px",
                      "用途：桌面首屏主視覺",
                    ]}
                  />
                  <TextField
                    label="手機 Hero 圖片 URL"
                    value={page.mobileHeroImageUrl}
                    name="mobileHeroImageUrl"
                    guidance={[
                      "建議比例：4:5",
                      "建議尺寸：1080 × 1350px",
                      "用途：手機首屏主視覺",
                    ]}
                  />
                </div>
              </div>
            </EditorSection>

            <EditorSection
              location="公開頁位置：優惠摘要"
              title="優惠摘要"
              description="用於說明今次 Campaign 主打優惠，不會顯示其他療程卡。"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <TextField label="優惠標籤" value={page.offerBadge} name="offerBadge" />
                <TextField
                  label="優惠標題"
                  value={page.offerHeadline}
                  name="offerHeadline"
                />
                <TextAreaField
                  label="優惠內容"
                  value={page.offerBody}
                  name="offerBody"
                  wide
                />
                <TextField
                  label="優惠摘要圖片 URL"
                  value={page.offerImageUrl}
                  name="offerImageUrl"
                  guidance={[
                    "建議比例：4:5 或 1:1",
                    "建議尺寸：1080 × 1350px / 1080 × 1080px",
                    "用途：優惠重點或療程價值視覺",
                  ]}
                />
              </div>
            </EditorSection>

            <EditorSection
              location="公開頁位置：療程資料"
              title="療程 / 套餐 / 分店"
              description="這些資料來自已連接的表格設定。"
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
              location="公開頁位置：中段內容"
              title="自由內容區塊"
              description="新增圖片、文字、卡片或 FAQ 區塊；公開頁會按排序顯示。"
            >
              <LandingPageSectionBuilder initialSections={contentSections} />
            </EditorSection>

            <EditorSection
              location="公開頁位置：預約表格旁邊"
              title="表格區內容"
              description="表格本身不需在這裡編輯；這裡只設定 CTA 文字及表格旁圖片。"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <TextField label="主按鈕文字" value={page.ctaText} name="ctaText" />
                <TextField
                  label="次按鈕文字"
                  value={page.secondaryCtaText}
                  name="secondaryCtaText"
                />
                <TextField
                  label="表格旁圖片 URL"
                  value={page.treatmentImageUrl}
                  name="treatmentImageUrl"
                  guidance={[
                    "建議比例：4:5",
                    "建議尺寸：1080 × 1350px",
                    "用途：表格旁邊提升預約信心",
                  ]}
                />
              </div>
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

function loadedFromLabel(source: "draft" | "published" | "row" | "seed") {
  if (source === "draft") return "最新草稿";
  if (source === "published") return "最新已發布版本";
  if (source === "row") return "頁面保存內容";
  return "預設內容";
}

function EditorSection({
  location,
  title,
  description,
  children,
}: {
  location: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <MotionReveal>
      <section
        data-editor-section
        data-editor-section-label={title}
        className="alyssa-premium-card min-w-0 scroll-mt-24 p-5"
      >
        <p className="alyssa-kicker">{location}</p>
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
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {label}
      </span>
      <input
        name={name}
        readOnly={readOnly || !name}
        defaultValue={value}
        className="mt-2 w-full min-w-0 rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-4 py-3 text-sm font-semibold text-[#5a2348] outline-none transition focus:border-[#e46f64] focus:bg-white"
      />
      {guidance && <ImageGuidance items={guidance} />}
    </label>
  );
}

function ImageGuidance({ items }: { items: string[] }) {
  return (
    <div className="mt-2 rounded-2xl border border-[#ead9cf] bg-white/75 px-3 py-2 text-xs font-semibold leading-5 text-[#6d4a5c]">
      {items.map((item) => (
        <p key={item}>{item}</p>
      ))}
    </div>
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
            已連接
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

const layoutOptions: Array<{
  value: LandingPageContentSectionLayout;
  label: string;
}> = [
  { value: "text", label: "文字區塊" },
  { value: "image_text", label: "圖片 + 文字" },
  { value: "two_cards", label: "2 張卡片" },
  { value: "three_cards", label: "3 張卡片" },
  { value: "faq", label: "FAQ" },
  { value: "image_grid", label: "圖片格仔" },
];

// Kept only for legacy draft form compatibility while the client builder owns the visible editor UI.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function SectionBuilder({
  sections,
}: {
  sections: LandingPageContentSection[];
}) {
  const visibleSections = sections.slice(0, 8);
  const nextSection =
    visibleSections.length < 8
      ? {
          id: `section-${visibleSections.length + 1}`,
          name: "",
          type: "text" as const,
          layout: "text" as const,
          label: "",
          title: "",
          subtitle: "",
          columns: 1 as const,
          itemImageMode: "none" as const,
          items: [],
        }
      : null;

  return (
    <div className="grid gap-4">
      {visibleSections.map((section, sectionIndex) => (
        <SectionEditorCard
          key={`${section.id}-${sectionIndex}`}
          section={section}
          index={sectionIndex}
          enabled={sectionIndex < sections.length}
        />
      ))}
      {nextSection && (
        <SectionEditorCard
          section={nextSection}
          index={visibleSections.length}
          enabled={false}
        />
      )}
    </div>
  );
}

function SectionEditorCard({
  section,
  index,
  enabled,
}: {
  section: LandingPageContentSection;
  index: number;
  enabled: boolean;
}) {
  const sectionNumber = index + 1;
  const visibleItems = Array.from({ length: enabled ? 6 : 0 }).map(
    (_, itemIndex) =>
      section.items[itemIndex] ?? {
        id: `item-${itemIndex + 1}`,
        title: "",
        body: "",
        imageUrl: "",
        caption: "",
        ctaText: "",
        ctaUrl: "",
      }
  );

  return (
    <section className="min-w-0 rounded-2xl border border-[#ead9cf] bg-[#fff6f0] p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
            Section {sectionNumber}
          </p>
          <h3 className="mt-1 font-bold text-[#321428]">
            內容區塊 {sectionNumber}
          </h3>
        </div>
        <label className="inline-flex items-center gap-2 text-sm font-bold text-[#5a2348]">
          <input
            type="checkbox"
            name={`contentSectionEnabled${index}`}
            value="true"
            defaultChecked={enabled}
            className="h-4 w-4 accent-[#d85ba3]"
          />
          使用此區塊
        </label>
      </div>

      <input type="hidden" name="contentSectionIds" value={section.id} />
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <TextField
          label="排序"
          value={`${sectionNumber}`}
          name="contentSectionOrders"
        />
        <label className="block min-w-0">
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
            版面
          </span>
          <select
            name="contentSectionLayouts"
            defaultValue={section.layout}
            className="mt-2 w-full min-w-0 rounded-2xl border border-[#ead9cf] bg-white px-4 py-3 text-sm font-semibold text-[#5a2348] outline-none transition focus:border-[#e46f64]"
          >
            {layoutOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <TextField
          label="Section 標籤"
          value={section.label}
          name="contentSectionLabels"
        />
        <TextField
          label="Section 標題"
          value={section.title}
          name="contentSectionTitles"
        />
        <TextAreaField
          label="Section 副標題 / 內容"
          value={section.subtitle}
          name="contentSectionSubtitles"
          wide
        />
      </div>

      <div className="mt-5 grid gap-3">
        {visibleItems.map((item, itemIndex) => (
          <div
            key={`${section.id}-item-${itemIndex}`}
            className="rounded-2xl border border-[#ead9cf] bg-white/80 p-4"
          >
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
              Item {itemIndex + 1}
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <TextField
                label={
                  section.layout === "faq"
                    ? `問題 ${itemIndex + 1}`
                    : `項目 ${itemIndex + 1} 標題`
                }
                value={item.title}
                name={`contentSection${index}ItemTitles`}
              />
              <TextField
                label={`項目 ${itemIndex + 1} 圖片 URL`}
                value={item.imageUrl}
                name={`contentSection${index}ItemImageUrls`}
              />
              <TextAreaField
                label={
                  section.layout === "faq"
                    ? `答案 ${itemIndex + 1}`
                    : `項目 ${itemIndex + 1} 內容`
                }
                value={item.body}
                name={`contentSection${index}ItemBodies`}
                wide
              />
              <TextField
                label={`項目 ${itemIndex + 1} CTA 文字`}
                value={item.ctaText}
                name={`contentSection${index}ItemCtaTexts`}
              />
              <TextField
                label={`項目 ${itemIndex + 1} CTA URL`}
                value={item.ctaUrl}
                name={`contentSection${index}ItemCtaUrls`}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
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
      <div className="grid gap-3">
        <Link
          href={previewUrl}
          className="inline-flex justify-center rounded-full bg-[#5a2348] px-5 py-3 text-sm font-bold text-white xl:hidden"
        >
          開啟公開頁預覽
        </Link>
      <aside className="hidden h-fit min-w-0 rounded-[28px] border border-[#ead9cf] bg-white/90 p-5 shadow-[0_24px_70px_rgba(90,35,72,0.12)] xl:sticky xl:top-32 xl:block">
        <p className="alyssa-kicker">預覽</p>
        <LandingPageEditorFollowPreview previewUrl={previewUrl} />
        <div
          className="mt-5 overflow-hidden rounded-[24px] bg-[var(--public-dark)] text-white"
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
              <h2 className="mt-4 text-3xl font-bold leading-tight">
                {page.heroTitle}
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/82">
                {page.heroSubtitle}
              </p>
              <div className="mt-5 inline-flex rounded-full bg-[var(--public-cta)] px-4 py-2 text-sm font-bold text-[var(--public-cta-text)]">
                {page.ctaText}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          <InfoPill label="療程" value={treatment} />
          <InfoPill label="價錢" value={price} />
          <InfoPill label="分店" value={branch} />
          <InfoPill label="表格代號" value={formToken || "未設定"} />
        </div>
        <Link
          href={previewUrl}
          className="mt-5 inline-flex w-full justify-center rounded-full bg-[#5a2348] px-5 py-3 text-sm font-bold text-white"
        >
          開啟公開頁
        </Link>
      </aside>
      </div>
    </MotionReveal>
  );
}
