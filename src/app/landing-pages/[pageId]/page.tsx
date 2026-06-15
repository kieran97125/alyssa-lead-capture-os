import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppNav } from "@/components/alyssa/AppNav";
import {
  StatusSummary,
  WorkflowStepper,
} from "@/components/alyssa/GuidedUX";
import { MotionReveal } from "@/components/alyssa/MotionReveal";
import {
  publishLandingPageAction,
  saveLandingPageDraftAction,
} from "@/app/landing-pages/[pageId]/actions";
import { getConfigurationData, landingPageTemplates } from "@/lib/data/configuration";
import {
  getLandingPageContext,
  getLandingPageImageUrl,
  landingPageImageSlots,
  type LandingPageConfig,
} from "@/lib/data/landingPages";
import { getPublicLandingPageUrl } from "@/lib/data/appUrl";
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
  const publicUrl = getPublicLandingPageUrl(page.slug);
  const previewUrl = publicUrl;
  const publicDisplay =
    page.status === "published" ? publicUrl : "草稿，發布後才會公開";
  const actionMessage =
    typeof query?.builder_status === "string" ? query.builder_status : null;
  const price = context.package ? `HK$${context.package.promoPrice}` : "未設定";

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <section className="rounded-[28px] border border-[#ead9cf] bg-white/86 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.1)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
                Landing Page 編輯
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#321428]">
                {page.title}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
                在這裡準備廣告落地頁內容、圖片、優惠、FAQ 同登記表格連接。
                草稿不會影響公開頁，發布後客人才會看到更新。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/settings/templates"
                className="rounded-full border border-[#d9b66f] bg-white px-5 py-3 text-sm font-bold text-[#5a2348]"
              >
                查看模板設定
              </Link>
              <Link
                href={previewUrl}
                className="rounded-full bg-[#5a2348] px-5 py-3 text-sm font-bold text-white"
              >
                開啟預覽
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

        <div className="mt-6">
          <WorkflowStepper
            currentIndex={2}
            steps={[
              "基本設定",
              "內容和圖片",
              "表格連接",
              "儲存草稿",
              "發布公開頁",
            ]}
          />
        </div>

        <section className="alyssa-premium-card mt-6 min-w-0 p-5">
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
                儲存 / 發布
              </p>
              <h2 className="mt-2 text-xl font-bold text-[#321428]">
                先儲存草稿，確認後才發布公開頁
              </h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#6d4a5c]">
                {statusMessage}
              </p>
              {actionMessage && (
                <p className="mt-3 rounded-2xl border border-[#d9b66f] bg-[#fff6f0] px-4 py-3 text-sm font-bold text-[#5a2348]">
                  {actionMessage}
                </p>
              )}
            </div>
            <div className="flex min-w-0 flex-wrap gap-2">
              <div>
                <button
                  type="submit"
                  form="landing-page-editor-form"
                  disabled={!canPersist}
                  className="rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(228,111,100,0.22)] transition hover:-translate-y-1 disabled:cursor-not-allowed disabled:bg-[#d8c5bc] disabled:shadow-none"
                >
                  儲存草稿，不會影響公開頁
                </button>
              </div>
              <form action={publishLandingPageAction}>
                <input type="hidden" name="pageId" value={page.id} />
                <button
                  type="submit"
                  disabled={!canPersist}
                  className="rounded-full border border-[#d9b66f] bg-white px-5 py-3 text-sm font-bold text-[#5a2348] transition hover:-translate-y-1 disabled:cursor-not-allowed disabled:text-[#9b8c86]"
                >
                  發布公開頁
                </button>
              </form>
            </div>
          </div>
          <p className="mt-4 text-xs font-semibold leading-5 text-[#7b5a6a]">
            儲存草稿適合任何時候使用；發布會更新公開 /lp 頁面，建議先檢查右邊預覽和公開 URL。
          </p>
          <div className="mt-4">
            <StatusSummary
              items={[
                {
                  label: "目前狀態",
                  value: page.status,
                  tone: page.status === "published" ? "good" : "warn",
                },
                {
                  label: "最新草稿",
                  value: latestDraftVersionNumber
                    ? `草稿 ${latestDraftVersionNumber}`
                    : "未有已儲存草稿",
                },
                {
                  label: "公開版本",
                  value: publishedVersionNumber
                    ? `版本 ${publishedVersionNumber}`
                    : "未發布",
                },
                {
                  label: "上次發布時間",
                  value: formatDate(page.publishedAt),
                },
                {
                  label: "公開 URL",
                  value: publicDisplay,
                },
              ]}
            />
          </div>
        </section>

        <section className="alyssa-premium-card mt-6 min-w-0 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
                投放前檢查
              </p>
              <h2 className="mt-2 text-xl font-bold text-[#321428]">
                Campaign 上線前快速確認
              </h2>
            </div>
            <Link
              href={previewUrl}
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
              value={connectedForm?.publicFormToken ?? page.formToken}
              ready={Boolean(connectedForm?.publicFormToken ?? page.formToken)}
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
            <EditorSection
              eyebrow="基本"
              title="基本設定"
              description="設定頁面名稱、網址代號、狀態同是否準備好測試。"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <TextField label="頁面標題" value={page.title} name="title" />
                <TextField label="網址代號" value={page.slug} readOnly />
                <SelectField
                  label="狀態"
                  value={page.status}
                  options={["draft", "published", "archived"]}
                />
                <SelectField
                  label="用途"
                  value={page.mode}
                  options={["form_only", "landing_page"]}
                />
                <TextField label="測試狀態" value={readinessLabel(page.testingStatus)} />
                <input type="hidden" name="testingStatus" value={page.testingStatus} />
                <TextField label="公開連結" value={publicDisplay} />
              </div>
            </EditorSection>

            <EditorSection
              eyebrow="版型"
              title="版型"
              description="選擇廣告落地頁的內容結構。更多版型管理稍後加入。"
            >
              <div className="grid gap-3 lg:grid-cols-2">
                <input type="hidden" name="templateName" value={page.templateName} />
                {landingPageTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    title={template.name}
                    body={template.useCase}
                    status={
                      template.name === page.templateName
                        ? "目前使用"
                        : template.status === "prepared"
                          ? "可使用"
                          : "未來模板"
                    }
                  />
                ))}
              </div>
            </EditorSection>

            <EditorSection
              eyebrow="首屏"
              title="首屏內容"
              description="公開頁第一屏的主標題、副標題同圖片。"
            >
              <div className="grid gap-4">
                <TextField label="主標題" value={page.heroTitle} name="heroTitle" />
                <TextAreaField label="副標題" value={page.heroSubtitle} name="heroSubtitle" />
                <TextField label="主圖片網址" value={page.heroImageUrl} readOnly />
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
              description="設定優惠標籤、優惠文字、主按鈕同次要按鈕。"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <TextField label="優惠標籤" value={page.offerBadge} name="offerBadge" />
                <TextField label="優惠標題" value={page.offerHeadline} name="offerHeadline" />
                <TextAreaField label="優惠內容" value={page.offerBody} name="offerBody" wide />
                <TextField label="主要按鈕文字" value={page.ctaText} name="ctaText" />
                <TextField label="次要按鈕文字" value={page.secondaryCtaText} name="secondaryCtaText" />
              </div>
            </EditorSection>

            <EditorSection
              eyebrow="受眾"
              title="痛點 / 賣點"
              description="用於快速測試市場角度同優惠吸引力。"
            >
              <div className="grid gap-5 lg:grid-cols-2">
                <Repeater title="客人痛點" items={page.painPoints} name="painPoints" />
                <Repeater title="主要賣點" items={page.benefits} name="benefits" />
              </div>
            </EditorSection>

            <EditorSection
              eyebrow="內容"
              title="內容區塊"
              description="顯示在公開頁的內容段落。"
            >
              <StructuredRepeater
                title="Landing Page 內容"
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
                <TextField label="品牌" value={context.brand?.name ?? "未設定"} />
                <TextField label="療程" value={context.treatment?.name ?? "未設定"} />
                <TextField label="套餐" value={context.package?.name ?? "未設定"} />
                <TextField label="價錢" value={price} />
                <TextField label="分店" value={context.branch?.name ?? "未設定"} />
                <TextField
                  label="付款備註"
                  value={
                    context.package?.paymentRequired
                      ? "套餐可要求先付款；只預約時仍會保留套餐價值"
                      : "客人可只提交預約，不需要先付款"
                  }
                />
              </div>
            </EditorSection>

            <EditorSection
              eyebrow="信任"
              title="流程 / 信任元素"
              description="説明客人理解預約和療程流程，提升信任感。"
            >
              <div className="grid gap-5 lg:grid-cols-2">
                <StructuredRepeater
                  titleName="processStepTitles"
                  bodyName="processStepBodies"
                  title="流程"
                  items={page.processSteps.map((step) => ({
                    title: step.title,
                    body: step.body,
                  }))}
                />
                <Repeater title="信任元素" items={page.trustItems} name="trustItems" />
              </div>
            </EditorSection>

            <EditorSection
              eyebrow="常見問題"
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

            <EditorSection
              eyebrow="表格"
              title="按鈕 / 登記表格連接"
              description="這個 Landing Page 會連接到同一張登記表格，方便客人留下資料。"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <TextField label="按鈕連到" value="#alyssa-lp-form" />
                <TextField label="連接表格" value={connectedForm?.formName ?? page.formId} />
                <TextField label="表格代號" value={connectedForm?.publicFormToken ?? page.formToken} />
                <TextField label="表格顯示位置" value="alyssa-lp-form-target" />
              </div>
            </EditorSection>

            <EditorSection
              eyebrow="預覽"
              title="預覽 / 發布狀態"
              description="發布會把已保存草稿變成客人可看到的公開內容。"
            >
              <div className="grid gap-4 md:grid-cols-3">
                <TextField label="預覽連結" value={previewUrl} />
                <TextField label="公開連結" value={publicDisplay} />
                <TextField label="發布狀態" value={page.status} />
                <TextField label="最後更新" value={formatDate(page.updatedAt)} />
                <TextField label="發布時間" value={formatDate(page.publishedAt)} />
                <TextField
                  label="儲存狀態"
                  value={canPersist ? "已可儲存 / 發布" : "等待連接儲存 / 發布"}
                />
              </div>
            </EditorSection>

          </form>

          <PreviewPanel
            page={page}
            price={price}
            treatment={context.treatment?.name ?? "未設定療程"}
            branch={context.branch?.name ?? "未設定分店"}
            previewUrl={previewUrl}
            formToken={connectedForm?.publicFormToken ?? page.formToken}
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

function readinessLabel(status: LandingPageConfig["testingStatus"]) {
  return status === "ready_for_testing" ? "可開始測試" : "目前可查看";
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
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-xl font-bold text-[#321428]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">{description}</p>
      <div className="mt-5 min-w-0">{children}</div>
    </section>
    </MotionReveal>
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
  readOnly = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
  name?: string;
  readOnly?: boolean;
}) {
  return (
    <label className={`block min-w-0 ${wide ? "md:col-span-2" : ""}`}>
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {label}
      </span>
      <textarea
        name={name}
        readOnly={readOnly || !name}
        defaultValue={value}
        rows={4}
        className="mt-2 w-full min-w-0 resize-none rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-4 py-3 text-sm font-semibold leading-6 text-[#5a2348] outline-none transition focus:border-[#e46f64] focus:bg-white"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
}: {
  label: string;
  value: string;
  options: string[];
}) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {label}
      </span>
      <select
        disabled
        value={value}
        className="mt-2 w-full min-w-0 rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-4 py-3 text-sm font-semibold text-[#5a2348] opacity-100 outline-none"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function TemplateCard({
  title,
  body,
  status,
}: {
  title: string;
  body: string;
  status: string;
}) {
  return (
    <article className="min-w-0 rounded-2xl border border-[#ead9cf] bg-[#fff6f0] p-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h3 className="font-bold text-[#321428]">{title}</h3>
        <span className="rounded-full bg-white/78 px-3 py-1 text-xs font-bold text-[#9a5d76]">
          {status}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">{body}</p>
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
        {hasImage ? "已設定圖片" : "未設定圖片"}
          </p>
          <p className="mt-1 text-lg font-bold">{label}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        <TextField label="圖片位置" value={label} />
        <TextField label="建議圖片類型" value={recommendedType} />
        <TextField label="建議比例" value={ratio} />
        <TextField label="圖片網址" value={value} name={name} />
        <TextField label="目前圖片" value={value || "尚未設定，會使用精緻佔位圖"} />
      </div>
      <p className="mt-3 text-xs font-semibold leading-5 text-[#7b5a6a]">
        未來可接素材庫、Wix assets 或外部圖片 URL；目前不會上傳或儲存新素材。
      </p>
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
  return (
    <div className="min-w-0">
      <h3 className="font-bold text-[#321428]">{title}</h3>
      <div className="mt-3 grid gap-3">
        {items.map((item, index) => (
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
  return (
    <div>
      <h3 className="font-bold text-[#321428]">{title}</h3>
      <div className="mt-3 grid gap-4">
        {items.map((item, index) => (
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
}: {
  page: LandingPageConfig;
  price: string;
  treatment: string;
  branch: string;
  previewUrl: string;
  formToken: string;
}) {
  const heroImageUrl = page.heroImageUrl || page.mobileHeroImageUrl;

  return (
    <MotionReveal delay={0.16}>
    <aside className="h-fit min-w-0 rounded-[28px] border border-[#ead9cf] bg-white/90 p-5 shadow-[0_24px_70px_rgba(90,35,72,0.12)] xl:sticky xl:top-32">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        預覽
      </p>
      <div
        className="mt-4 overflow-hidden rounded-[24px] bg-[#321428] text-white"
        style={
          heroImageUrl
            ? {
                backgroundImage: `linear-gradient(90deg, rgba(50,20,40,0.86), rgba(90,35,72,0.5)), url(${heroImageUrl})`,
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
          <div className="mt-5 inline-flex rounded-full bg-white px-4 py-2 text-sm font-bold text-[#5a2348]">
            {page.ctaText}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        <PreviewInfo label="優惠" value={`${page.offerHeadline} · ${price}`} />
        <PreviewInfo label="療程" value={treatment} />
        <PreviewInfo label="分店" value={branch} />
        <PreviewInfo label="登記表格" value={formToken} />
        <PreviewInfo label="預覽連結" value={previewUrl} />
      </div>

      <Link
        href={previewUrl}
        className="mt-5 inline-flex w-full justify-center rounded-full bg-[#5a2348] px-5 py-3 text-sm font-bold text-white"
      >
        開啟預覽
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
