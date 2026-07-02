import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";
import { CopyButton } from "@/components/alyssa/CopyButton";
import { MotionReveal } from "@/components/alyssa/MotionReveal";
import {
  META_URL_PARAMETER_GUIDE,
  getBrandPixelId,
  getBrandSuggestedDomains,
  getFormOperations,
} from "@/lib/data/brandOperations";
import { getBrandDisplayDefaults } from "@/lib/data/brandDefaults";
import {
  getConfigurationData,
  packagePriceLabel,
} from "@/lib/data/configuration";
import { getLeadRows } from "@/lib/data/businessMetrics";
import { getLandingPageList } from "@/lib/data/landingPageStore";
import {
  isLegacyFormCandidate,
  isLegacyLandingPageCandidate,
  matchesArchiveView,
} from "@/lib/data/legacyCleanup";

export const dynamic = "force-dynamic";

function pickBrandSlug(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BrandWorkspacePage({
  searchParams,
}: {
  searchParams?: Promise<{ brand?: string | string[] }>;
}) {
  const [config, landingPages, monthLeads] = await Promise.all([
    getConfigurationData(),
    getLandingPageList(),
    getLeadRows("month", 5000, { includeTestData: false }),
  ]);
  const query = await searchParams;
  const requestedBrand = pickBrandSlug(query?.brand);
  const selectedBrand =
    config.brands.find(
      (brand) => brand.slug === requestedBrand || brand.id === requestedBrand
    ) ?? config.brands[0];

  const forms = config.forms.filter(
    (form) =>
      form.brandId === selectedBrand?.id &&
      matchesArchiveView("active", {
        status: form.status,
        isLegacy: isLegacyFormCandidate(form),
      })
  );
  const treatments = config.treatments.filter(
    (treatment) => treatment.brandId === selectedBrand?.id
  );
  const branches = config.branches.filter(
    (branch) => branch.brandId === selectedBrand?.id
  );
  const pages = landingPages.pages.filter(
    (page) =>
      page.brandId === selectedBrand?.id &&
      matchesArchiveView("active", {
        status: page.status,
        isLegacy: isLegacyLandingPageCandidate(page),
      })
  );
  const leads = monthLeads.leads.filter(
    (lead) =>
      lead.brand_id === selectedBrand?.id ||
      lead.brand?.id === selectedBrand?.id
  );
  const pixelId = getBrandPixelId(selectedBrand?.slug);
  const suggestedDomains = getBrandSuggestedDomains(selectedBrand?.slug);
  const brandDefaults = getBrandDisplayDefaults(selectedBrand);

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <header className="rounded-[28px] border border-[#ead9cf] bg-white/86 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.1)]">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="alyssa-kicker">Brand Workspace</p>
              <h1 className="mt-2 text-3xl font-bold text-[#321428]">
                {selectedBrand?.name || "Brand Workspace"}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
                以品牌為中心管理表格、療程、分店、Landing Page、Leads 同 Wix 上線資料，避免 Alyssa 同 Ineffable 設定混用。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {config.brands.map((brand) => (
                <Link
                  key={brand.id}
                  href={`/brands?brand=${brand.slug}`}
                  className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
                    brand.id === selectedBrand?.id
                      ? "border-[#e46f64] bg-[#e46f64] text-white"
                      : "border-[#ead9cf] bg-white text-[#5a2348]"
                  }`}
                >
                  {brand.name}
                </Link>
              ))}
            </div>
          </div>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <WorkspaceStat label="Forms" value={forms.length} />
          <WorkspaceStat
            label="Published LP"
            value={pages.filter((page) => page.status === "published").length}
          />
          <WorkspaceStat label="Leads 本月" value={leads.length} />
          <WorkspaceStat label="Branches" value={branches.length} />
          <WorkspaceStat label="Treatments" value={treatments.length} />
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <MotionReveal>
            <section className="alyssa-premium-card p-5">
              <p className="alyssa-kicker">Quick Actions</p>
              <h2 className="mt-2 text-xl font-bold text-[#321428]">
                {selectedBrand?.name} Launch 工作區
              </h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <ActionCard
                  href={`/forms/new?brand=${selectedBrand?.slug || ""}`}
                  title="Create Wix Form"
                  body="選療程、優惠、分店，生成可貼入 Wix 的表格。"
                />
                <ActionCard
                  href={`/campaigns/new?brand=${selectedBrand?.slug || ""}`}
                  title="Create Landing Page"
                  body="建立一頁廣告 Landing Page，連接同一套 lead capture。"
                />
                <ActionCard
                  href={`/settings/treatments?brand=${selectedBrand?.slug || ""}`}
                  title="Treatment Library"
                  body="查看此品牌可用療程及可建立表格的項目。"
                />
                <ActionCard
                  href={`/settings/branches?brand=${selectedBrand?.slug || ""}`}
                  title="Branch Library"
                  body="查看此品牌分店資料，確保表格只顯示正確分店。"
                />
                <ActionCard
                  href="/crm"
                  title="CRM 工作台"
                  body="跟進客人、確認預約、記錄 CS 對話及追蹤 Show / No-show。"
                />
              </div>
            </section>
          </MotionReveal>

          <MotionReveal delay={0.08}>
            <section className="alyssa-premium-card p-5">
              <p className="alyssa-kicker">Setup Status</p>
              <h2 className="mt-2 text-xl font-bold text-[#321428]">
                上線前檢查
              </h2>
              <div className="mt-4 grid gap-3">
                <SetupRow
                  label="Meta Pixel"
                  value={
                    brandDefaults.conversionMode === "thank_you_redirect"
                      ? `${brandDefaults.pixelIdReference || pixelId || "Not set"} · Wix thank-you owns CompleteRegistration`
                      : pixelId
                        ? `已設定：${pixelId}`
                        : "未設定，embed 會省略 data-pixel-id"
                  }
                  good={Boolean(pixelId)}
                />
                <SetupRow
                  label="Allowed domains"
                  value={suggestedDomains.join(", ")}
                  good
                />
                <SetupRow
                  label="Website / thank-you"
                  value={`${brandDefaults.websiteDomain || suggestedDomains[0] || "未設定"} → ${brandDefaults.thankYouUrl || "Default brand flow"}`}
                  good={Boolean(suggestedDomains[0])}
                />
                <SetupRow
                  label="Default conversion mode"
                  value={brandDefaults.conversionMode}
                  good
                />
                <SetupRow
                  label="Google Sheet Sync"
                  value={
                    process.env.GOOGLE_SHEETS_SYNC_ENABLED === "true"
                      ? "已啟用"
                      : "未啟用或未設定"
                  }
                  good={process.env.GOOGLE_SHEETS_SYNC_ENABLED === "true"}
                />
              </div>
            </section>
          </MotionReveal>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="alyssa-premium-card min-w-0 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="alyssa-kicker">Recent Forms</p>
                <h2 className="mt-2 text-xl font-bold text-[#321428]">
                  此品牌表格
                </h2>
              </div>
              <Link
                href={`/forms?brand=${selectedBrand?.slug || ""}`}
                className="rounded-full border border-[#ead9cf] bg-white px-4 py-2 text-sm font-bold text-[#5a2348]"
              >
                View all
              </Link>
            </div>
            <div className="mt-4 grid gap-3">
              {forms.slice(0, 5).map((form) => {
                const ops = getFormOperations(config, form);
                return (
                  <div
                    key={form.id}
                    className="rounded-2xl border border-[#ead9cf] bg-[#fff9f3] p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <h3 className="font-bold text-[#321428]">{form.formName}</h3>
                        <p className="mt-1 break-all font-mono text-xs font-semibold text-[#7b5a6a]">
                          {form.publicFormToken}
                        </p>
                        <p className="mt-2 text-sm font-semibold text-[#5a2348]">
                          {ops.treatment?.name || "未設定療程"} · {ops.packageLabel}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <CopyButton value={ops.embedCode} label="Copy Embed" />
                        <Link
                          href={`/forms/${form.id}`}
                          className="rounded-full bg-[#5a2348] px-3 py-1.5 text-xs font-bold text-white"
                        >
                          Edit
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
              {forms.length === 0 && (
                <p className="rounded-2xl bg-[#fff6f0] p-4 text-sm font-semibold text-[#6d4a5c]">
                  此品牌暫時未有表格。先建立一張 Wix Form 開始收集 Leads。
                </p>
              )}
            </div>
          </section>

          <section className="alyssa-premium-card min-w-0 p-5">
            <p className="alyssa-kicker">Meta URL Parameters</p>
            <h2 className="mt-2 text-xl font-bold text-[#321428]">
              廣告 URL 參數
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">
              貼到 Meta Ads 的 URL Parameters。正式廣告不要加入 pixel_debug 或 attribution_debug。
            </p>
            <div className="mt-4">
              <CopyButton value={META_URL_PARAMETER_GUIDE} label="Copy URL Parameters" />
            </div>
            <pre className="mt-4 max-h-48 overflow-auto rounded-2xl bg-[#321428] p-4 text-xs leading-6 text-[#fff9f3]">
              {META_URL_PARAMETER_GUIDE}
            </pre>
          </section>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-2">
          <LibraryPanel
            title="Treatment Library"
            href={`/settings/treatments?brand=${selectedBrand?.slug || ""}`}
            items={treatments.map((treatment) => {
              const packages = config.packages.filter(
                (item) => item.treatmentId === treatment.id
              );
              return `${treatment.name} · ${
                packages[0] ? packagePriceLabel(packages[0]) : "未設定套餐"
              }`;
            })}
          />
          <LibraryPanel
            title="Branch Library"
            href={`/settings/branches?brand=${selectedBrand?.slug || ""}`}
            items={branches.map((branch) => `${branch.name} · ${branch.status}`)}
          />
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-2">
          <LibraryPanel
            title="Recent Leads"
            href={`/leads?brand=${selectedBrand?.slug || ""}`}
            items={leads.slice(0, 5).map((lead) => {
              const treatment = lead.treatment?.name || "未設定療程";
              const branch = lead.branch?.name || "未設定分店";
              return `${lead.customer_name || lead.contact?.customer_name || "Lead"} · ${treatment} · ${branch}`;
            })}
          />
          <LibraryPanel
            title="Landing Pages"
            href={`/landing-pages?brand=${selectedBrand?.slug || ""}`}
            items={pages.slice(0, 5).map((page) => `${page.title} · ${page.status}`)}
          />
        </section>
      </div>
    </main>
  );
}

function WorkspaceStat({ label, value }: { label: string; value: number }) {
  return (
    <MotionReveal>
      <div className="alyssa-premium-card p-5">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
          {label}
        </p>
        <p className="mt-3 text-3xl font-bold text-[#321428]">{value}</p>
      </div>
    </MotionReveal>
  );
}

function ActionCard({
  href,
  title,
  body,
}: {
  href: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-[#ead9cf] bg-[#fff9f3] p-4 transition hover:-translate-y-0.5 hover:border-[#e46f64]"
    >
      <h3 className="font-bold text-[#321428]">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-[#6d4a5c]">{body}</p>
    </Link>
  );
}

function SetupRow({
  label,
  value,
  good,
}: {
  label: string;
  value: string;
  good: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl bg-[#fff9f3] p-4">
      <div>
        <p className="text-sm font-bold text-[#321428]">{label}</p>
        <p className="mt-1 break-words text-sm leading-6 text-[#6d4a5c]">
          {value}
        </p>
      </div>
      <span
        className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
          good ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
        }`}
      >
        {good ? "OK" : "Check"}
      </span>
    </div>
  );
}

function LibraryPanel({
  title,
  href,
  items,
}: {
  title: string;
  href: string;
  items: string[];
}) {
  return (
    <section className="alyssa-premium-card min-w-0 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-[#321428]">{title}</h2>
        <Link
          href={href}
          className="rounded-full border border-[#ead9cf] bg-white px-4 py-2 text-sm font-bold text-[#5a2348]"
        >
          Open
        </Link>
      </div>
      <div className="mt-4 grid gap-2">
        {items.length > 0 ? (
          items.map((item) => (
            <p
              key={item}
              className="rounded-2xl bg-[#fff9f3] px-4 py-3 text-sm font-semibold text-[#5a2348]"
            >
              {item}
            </p>
          ))
        ) : (
          <p className="rounded-2xl bg-[#fff6f0] px-4 py-3 text-sm font-semibold text-[#6d4a5c]">
            暫時未有資料。
          </p>
        )}
      </div>
    </section>
  );
}
