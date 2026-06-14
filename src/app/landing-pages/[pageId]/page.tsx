import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppNav } from "@/components/alyssa/AppNav";
import { MotionReveal } from "@/components/alyssa/MotionReveal";
import { landingPageTemplates } from "@/lib/data/configuration";
import {
  getLandingPageById,
  getLandingPageContext,
  getLandingPageImageUrl,
  landingPageImageSlots,
  type LandingPageConfig,
} from "@/lib/data/landingPages";

export default async function LandingPageConfigPage({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { pageId } = await params;
  const page = getLandingPageById(pageId);

  if (!page) notFound();

  const context = getLandingPageContext(page);
  const previewUrl = `/lp/${page.slug}`;
  const price = context.package ? `HK$${context.package.promoPrice}` : "未設定";

  return (
    <main className="alyssa-shell">
      <AppNav showInternalWarning />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <section className="rounded-[28px] border border-[#ead9cf] bg-white/86 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.1)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
                Landing page editor
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#321428]">
                {page.title}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
                結構化 campaign landing page editor foundation。內容編輯 UI
                預留，儲存功能將於 DB-backed builder 階段加入。
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
                開啟 public preview
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

        <section className="mt-6 rounded-[24px] border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
          內容編輯 UI 預留，儲存功能將於 DB-backed builder 階段加入。現時 public
          landing page 仍使用現有 config，表格提交同 UTM 擷取流程保持不變。
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_390px]">
          <div className="grid gap-6">
            <EditorSection
              eyebrow="Basic"
              title="基本設定"
              description="頁面識別、slug、狀態同測試 readiness。"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <TextField label="Page title" value={page.title} />
                <TextField label="Slug" value={page.slug} />
                <SelectField
                  label="Status"
                  value={page.status}
                  options={["draft", "active", "paused"]}
                />
                <SelectField
                  label="Mode"
                  value={page.mode}
                  options={["form_only", "landing_page"]}
                />
                <TextField label="Testing readiness" value={readinessLabel(page.testingStatus)} />
                <TextField label="Public URL" value={previewUrl} />
              </div>
            </EditorSection>

            <EditorSection
              eyebrow="Template"
              title="Template"
              description="選擇 campaign page 結構。完整 template switching 會在 builder 階段加入。"
            >
              <div className="grid gap-3 lg:grid-cols-2">
                {landingPageTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    title={template.name}
                    body={template.useCase}
                    status={
                      template.name === page.templateName
                        ? "目前使用"
                        : template.status === "prepared"
                          ? "可作 V1 基礎"
                          : "未來模板"
                    }
                  />
                ))}
              </div>
            </EditorSection>

            <EditorSection
              eyebrow="Hero"
              title="Hero"
              description="Public landing page 第一屏的主標題、subcopy 同 visual。"
            >
              <div className="grid gap-4">
                <TextField label="Hero title" value={page.heroTitle} />
                <TextAreaField label="Hero subtitle" value={page.heroSubtitle} />
                <TextField label="Hero image URL" value={page.heroImageUrl} />
              </div>
            </EditorSection>

            <EditorSection
              eyebrow="Assets"
              title="圖片素材"
              description="目前支援圖片 URL / placeholder；上傳及素材庫會於後續版本加入。"
            >
              <div className="grid gap-4 lg:grid-cols-2">
                {landingPageImageSlots.map((slot) => (
                  <ImageSlotCard
                    key={slot.key}
                    label={slot.label}
                    recommendedType={slot.recommendedType}
                    ratio={slot.ratio}
                    value={getLandingPageImageUrl(page, slot.key)}
                  />
                ))}
              </div>
            </EditorSection>

            <EditorSection
              eyebrow="Offer"
              title="Offer"
              description="Offer block、badge、主 CTA 同次要 CTA。"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <TextField label="Offer badge" value={page.offerBadge} />
                <TextField label="Offer headline" value={page.offerHeadline} />
                <TextAreaField label="Offer body" value={page.offerBody} wide />
                <TextField label="Primary CTA" value={page.ctaText} />
                <TextField label="Secondary CTA" value={page.secondaryCtaText} />
              </div>
            </EditorSection>

            <EditorSection
              eyebrow="Audience"
              title="Pain points / benefits"
              description="用於快速測試市場角度同 offer resonance。"
            >
              <div className="grid gap-5 lg:grid-cols-2">
                <Repeater title="Pain points" items={page.painPoints} />
                <Repeater title="Benefits" items={page.benefits} />
              </div>
            </EditorSection>

            <EditorSection
              eyebrow="Treatment"
              title="Treatment summary"
              description="由設定層連接品牌、療程、套餐、分店。"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <TextField label="Brand" value={context.brand?.name ?? "未設定"} />
                <TextField label="Treatment" value={context.treatment?.name ?? "未設定"} />
                <TextField label="Package" value={context.package?.name ?? "未設定"} />
                <TextField label="Price" value={price} />
                <TextField label="Branch" value={context.branch?.name ?? "未設定"} />
                <TextField
                  label="Payment note"
                  value={
                    context.package?.paymentRequired
                      ? "套餐可有付款 flow；booking_only 仍保留套餐價值"
                      : "可只預約，未啟動付款 flow"
                  }
                />
              </div>
            </EditorSection>

            <EditorSection
              eyebrow="Trust"
              title="Process / trust section"
              description="説明客人流程同建立 campaign trust cues。"
            >
              <div className="grid gap-5 lg:grid-cols-2">
                <StructuredRepeater
                  title="Process"
                  items={page.processSteps.map((step) => ({
                    title: step.title,
                    body: step.body,
                  }))}
                />
                <Repeater title="Trust cues" items={page.trustItems} />
              </div>
            </EditorSection>

            <EditorSection
              eyebrow="FAQ"
              title="FAQ"
              description="常見問題會顯示在 public landing page 底部。"
            >
              <StructuredRepeater
                title="FAQ questions / answers"
                items={page.faqs.map((faq) => ({
                  title: faq.question,
                  body: faq.answer,
                }))}
              />
            </EditorSection>

            <EditorSection
              eyebrow="Form"
              title="CTA / Form connection"
              description="Landing page mode 使用同一 public form token，同一 UTM capture flow。"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <TextField label="CTA target" value="#alyssa-lp-form" />
                <TextField label="Form ID" value={page.formId} />
                <TextField label="Form token" value={page.formToken} />
                <TextField label="Embed target" value="alyssa-lp-form-target" />
              </div>
            </EditorSection>

            <EditorSection
              eyebrow="Preview"
              title="Preview / publish status"
              description="正式 publish workflow 會在 DB-backed builder 階段加入。"
            >
              <div className="grid gap-4 md:grid-cols-3">
                <TextField label="Preview URL" value={previewUrl} />
                <TextField label="Public URL" value={previewUrl} />
                <TextField label="Publish status" value={page.status} />
              </div>
            </EditorSection>

            <EditorSection
              eyebrow="Workflow"
              title="儲存 / 發布流程預留"
              description="此頁目前仍是 editor UI foundation；真正儲存與發布會在 DB-backed builder 階段加入。"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <WorkflowCard
                  title="Save draft"
                  body="未來會將內容寫入 landing_page_versions，保留 draft version，不影響 public landing page。"
                />
                <WorkflowCard
                  title="Internal preview"
                  body="內部使用者可預覽 draft version，方便檢查文案、圖片同表格連接。"
                />
                <WorkflowCard
                  title="Publish"
                  body="發布時會更新 published_version_id，public /lp/[slug] 只讀 published content。"
                />
                <WorkflowCard
                  title="Role permissions"
                  body="日後由 team access 控制誰可以編輯、儲存 draft、發布或 archive。"
                />
              </div>
            </EditorSection>
          </div>

          <PreviewPanel
            page={page}
            price={price}
            treatment={context.treatment?.name ?? "未設定療程"}
            branch={context.branch?.name ?? "未設定分店"}
            previewUrl={previewUrl}
          />
        </div>
      </div>
    </main>
  );
}

function readinessLabel(status: LandingPageConfig["testingStatus"]) {
  return status === "ready_for_testing" ? "可開始測試" : "Foundation only";
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
    <section className="alyssa-premium-card p-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-xl font-bold text-[#321428]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
    </MotionReveal>
  );
}

function TextField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {label}
      </span>
      <input
        readOnly
        value={value}
        className="mt-2 w-full rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-4 py-3 text-sm font-semibold text-[#5a2348] outline-none"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <label className={`block ${wide ? "md:col-span-2" : ""}`}>
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {label}
      </span>
      <textarea
        readOnly
        value={value}
        rows={4}
        className="mt-2 w-full resize-none rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-4 py-3 text-sm font-semibold leading-6 text-[#5a2348] outline-none"
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
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {label}
      </span>
      <select
        disabled
        value={value}
        className="mt-2 w-full rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-4 py-3 text-sm font-semibold text-[#5a2348] opacity-100 outline-none"
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
    <article className="rounded-2xl border border-[#ead9cf] bg-[#fff6f0] p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-bold text-[#321428]">{title}</h3>
        <span className="rounded-full bg-white/78 px-3 py-1 text-xs font-bold text-[#9a5d76]">
          {status}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">{body}</p>
    </article>
  );
}

function WorkflowCard({ title, body }: { title: string; body: string }) {
  return (
    <article className="rounded-2xl bg-[#fff6f0] p-4">
      <h3 className="font-bold text-[#321428]">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">{body}</p>
    </article>
  );
}

function ImageSlotCard({
  label,
  recommendedType,
  ratio,
  value,
}: {
  label: string;
  recommendedType: string;
  ratio: string;
  value: string;
}) {
  const hasImage = Boolean(value);

  return (
    <article className="rounded-2xl border border-[#ead9cf] bg-[#fff6f0] p-4">
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
            {hasImage ? "已設定圖片 URL" : "Premium placeholder"}
          </p>
          <p className="mt-1 text-lg font-bold">{label}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        <TextField label="Image slot" value={label} />
        <TextField label="Recommended image type" value={recommendedType} />
        <TextField label="Recommended ratio" value={ratio} />
        <TextField label="Current image URL" value={value || "尚未設定，會使用 premium placeholder"} />
      </div>
      <p className="mt-3 text-xs font-semibold leading-5 text-[#7b5a6a]">
        未來可接 Supabase Storage、Wix assets 或外部圖片 URL；目前不會上傳或儲存新素材。
      </p>
    </article>
  );
}

function Repeater({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="font-bold text-[#321428]">{title}</h3>
      <div className="mt-3 grid gap-3">
        {items.map((item, index) => (
          <TextField key={`${title}-${index}`} label={`Item ${index + 1}`} value={item} />
        ))}
      </div>
    </div>
  );
}

function StructuredRepeater({
  title,
  items,
}: {
  title: string;
  items: Array<{ title: string; body: string }>;
}) {
  return (
    <div>
      <h3 className="font-bold text-[#321428]">{title}</h3>
      <div className="mt-3 grid gap-4">
        {items.map((item, index) => (
          <div key={`${title}-${index}`} className="rounded-2xl bg-[#fff6f0] p-4">
            <TextField label={`Title ${index + 1}`} value={item.title} />
            <div className="mt-3">
              <TextAreaField label={`Body ${index + 1}`} value={item.body} />
            </div>
          </div>
        ))}
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
}: {
  page: LandingPageConfig;
  price: string;
  treatment: string;
  branch: string;
  previewUrl: string;
}) {
  const heroImageUrl = page.heroImageUrl || page.mobileHeroImageUrl;

  return (
    <aside className="h-fit rounded-[28px] border border-[#ead9cf] bg-white/90 p-5 shadow-[0_24px_70px_rgba(90,35,72,0.12)] xl:sticky xl:top-32">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        Live-style preview
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
        <PreviewInfo label="Offer" value={`${page.offerHeadline} · ${price}`} />
        <PreviewInfo label="Treatment" value={treatment} />
        <PreviewInfo label="Branch" value={branch} />
        <PreviewInfo label="Form connection" value={page.formToken} />
        <PreviewInfo label="Preview URL" value={previewUrl} />
      </div>

      <Link
        href={previewUrl}
        className="mt-5 inline-flex w-full justify-center rounded-full bg-[#5a2348] px-5 py-3 text-sm font-bold text-white"
      >
        開啟 public preview
      </Link>
    </aside>
  );
}

function PreviewInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#fff6f0] p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-semibold text-[#5a2348]">
        {value}
      </p>
    </div>
  );
}
