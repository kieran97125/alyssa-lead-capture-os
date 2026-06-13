import Link from "next/link";
import { notFound } from "next/navigation";
import { AppNav } from "@/components/alyssa/AppNav";
import {
  getLandingPageById,
  getLandingPageContext,
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
                Landing page config
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#321428]">
                {page.title}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
                這是 Landing Page Generator V1 的 config preview。可以清楚核對
                hero、offer、CTA、sections、FAQ 同表格連接；完整拖拉式 editor
                仍屬未來 builder work。
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

        <section className="mt-6 grid gap-5 lg:grid-cols-2">
          <ConfigPanel
            title="Basic setup"
            description="Campaign page 基本識別同測試狀態。"
            rows={[
              ["Page ID", page.id],
              ["Slug", page.slug],
              ["Mode", page.mode],
              ["Status", page.status],
              ["Testing readiness", readinessLabel(page.testingStatus)],
              ["Template", page.templateName],
            ]}
          />
          <ConfigPanel
            title="Brand / treatment / package / branch"
            description="目前由 seed/config-backed 設定提供，日後可升級為完整設定後台。"
            rows={[
              ["Brand", context.brand?.name ?? "未設定"],
              ["Treatment", context.treatment?.name ?? "未設定"],
              ["Package", context.package?.name ?? "未設定"],
              ["Price", price],
              ["Payment required", context.package?.paymentRequired ? "需要付款 flow" : "不需要付款 flow"],
              ["Branch", context.branch?.name ?? "未設定"],
            ]}
          />
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <ConfigPanel
            title="Hero content"
            description="Public landing page 第一屏使用的 headline、subcopy 同視覺素材。"
            rows={[
              ["Hero title", page.heroTitle],
              ["Hero subtitle", page.heroSubtitle],
              ["Hero image", page.heroImageUrl],
            ]}
          />
          <ConfigPanel
            title="Offer copy / CTA"
            description="Offer block 同主要行動按鈕，會連到同頁 embedded form。"
            rows={[
              ["Offer badge", page.offerBadge],
              ["Offer headline", page.offerHeadline],
              ["Offer body", page.offerBody],
              ["Primary CTA", page.ctaText],
              ["Secondary CTA", page.secondaryCtaText],
            ]}
          />
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-3">
          <ListPanel title="Pain points" items={page.painPoints} />
          <ListPanel title="Benefits" items={page.benefits} />
          <ListPanel title="Trust cues" items={page.trustItems} />
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-2">
          <StructuredPanel
            title="Sections"
            items={page.sections.map((item) => ({
              heading: item.title,
              body: item.body,
            }))}
          />
          <StructuredPanel
            title="Process"
            items={page.processSteps.map((item) => ({
              heading: item.title,
              body: item.body,
            }))}
          />
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <StructuredPanel
            title="FAQ"
            items={page.faqs.map((item) => ({
              heading: item.question,
              body: item.answer,
            }))}
          />
          <ConfigPanel
            title="Form connection / preview URL"
            description="Landing page mode 仍然使用同一 public form token，同一 UTM capture flow。"
            rows={[
              ["Form ID", page.formId],
              ["Form token", page.formToken],
              ["Preview URL", previewUrl],
              ["Public URL", previewUrl],
              ["Embed target", "alyssa-lp-form-target"],
            ]}
          />
        </section>
      </div>
    </main>
  );
}

function readinessLabel(status: LandingPageConfig["testingStatus"]) {
  return status === "ready_for_testing" ? "可開始測試" : "Foundation only";
}

function ConfigPanel({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: Array<[string, string]>;
}) {
  return (
    <section className="rounded-[24px] border border-[#ead9cf] bg-white/86 p-5 shadow-sm">
      <h2 className="text-xl font-bold text-[#321428]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">{description}</p>
      <dl className="mt-4 grid gap-3">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-[#fff6f0] p-4">
            <dt className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
              {label}
            </dt>
            <dd className="mt-2 break-words text-sm font-semibold text-[#5a2348]">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ListPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-[24px] border border-[#ead9cf] bg-white/86 p-5 shadow-sm">
      <h2 className="text-xl font-bold text-[#321428]">{title}</h2>
      <div className="mt-4 grid gap-3">
        {items.map((item) => (
          <p
            key={item}
            className="rounded-2xl bg-[#fff6f0] px-4 py-3 text-sm font-semibold leading-6 text-[#5a2348]"
          >
            {item}
          </p>
        ))}
      </div>
    </section>
  );
}

function StructuredPanel({
  title,
  items,
}: {
  title: string;
  items: Array<{ heading: string; body: string }>;
}) {
  return (
    <section className="rounded-[24px] border border-[#ead9cf] bg-white/86 p-5 shadow-sm">
      <h2 className="text-xl font-bold text-[#321428]">{title}</h2>
      <div className="mt-4 grid gap-3">
        {items.map((item) => (
          <article key={item.heading} className="rounded-2xl bg-[#fff6f0] p-4">
            <h3 className="font-bold text-[#321428]">{item.heading}</h3>
            <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">{item.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
