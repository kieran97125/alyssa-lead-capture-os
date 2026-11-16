import { notFound } from "next/navigation";
import { CrmInboxTable } from "@/components/crm/CrmInboxTable";
import "@/components/crm/crm-shell.css";
import { SystemButton } from "@/components/system/SystemButton";
import { filterCrmBookingQueue, crmDayKey } from "@/lib/crm/operationQueues";
import { resolveCrmChannelReadiness, resolveSingleCrmBrand } from "@/lib/crm/channelReadiness";
import type { CrmLeadCase, CrmStatus } from "@/lib/crm/leadOps";
import type { WhatsAppConnectionRecord } from "@/lib/crm/whatsapp";

export const dynamic = "force-dynamic";

// HKT has crossed midnight while UTC remains on the previous calendar day.
const fixtureNow = Date.parse("2026-11-15T16:30:00.000Z");
const fixtureBrands = [
  { id: "fixture-brand-a", slug: "fixture-a", name: "示例品牌 A" },
  { id: "fixture-brand-b", slug: "fixture-b", name: "示例品牌 B" },
];

function fixtureCase(key: string, status: CrmStatus, brand = fixtureBrands[0]): CrmLeadCase {
  return {
    id: `fixture-${key}`,
    createdAt: "2026-11-15T16:10:00.000Z",
    lastActivityAt: "2026-11-15T16:20:00.000Z",
    createdLabel: "2026年11月16日 上午12:10",
    lastActivityLabel: "2026年11月16日 上午12:20",
    customerName: `測試個案 ${key}`,
    phone: `TEST-${key}`,
    normalizedPhone: `TEST-${key}`,
    email: "",
    brandName: brand.name,
    brandSlug: brand.slug,
    canonicalIdentity: `${brand.slug}:TEST-${key}`,
    treatmentOffer: `${brand.name} 測試療程`,
    packagePrice: "HK$888",
    branchName: "測試分店",
    appointmentLabel: "2026-11-16 09:00",
    crmSourceType: "landing_form",
    sourceLabel: "Landing Page / 網站表格",
    sourceTypeRaw: "reg_form_utm",
    campaignLabel: "隔離驗收",
    adLabel: "隔離驗收",
    landingPageSlug: null,
    pageUrl: null,
    status,
    statusLabel: status,
    assignedCsLabel: "測試同事",
    nextFollowUpLabel: "未設定",
    nextFollowUpAt: null,
    confirmedBookingDate: "2026-11-16",
    confirmedBookingTime: "09:00",
    confirmedBookingLabel: "2026-11-16 09:00",
    bookingStatus: status,
    whatsappUrl: null,
    ctwa: {
      ctwa_source_id: null, ctwa_source_url: null,
      ctwa_referral_headline: null, ctwa_referral_body: null,
      campaign_id: null, adset_id: null, ad_id: null,
      phone_number_id: null, whatsapp_business_account_id: null,
    },
  };
}

const fixtureCases = [
  fixtureCase("NOSHOW-A", "no_show"),
  fixtureCase("BOOKED-A", "booked"),
  fixtureCase("SHOWED-A", "showed"),
  fixtureCase("CANCELLED-A", "cancelled"),
  fixtureCase("NOSHOW-B", "no_show", fixtureBrands[1]),
];

const queueOptions = [
  { value: "", label: "全部預約結果" },
  { value: "booked", label: "已預約" },
  { value: "today_bookings", label: "今日預約" },
  { value: "no_show", label: "No Show" },
  { value: "showed", label: "已到店" },
  { value: "cancelled", label: "已取消" },
];

export default async function CrmFoundationFixture({ searchParams }: {
  searchParams: Promise<{ queue?: string; brand?: string; health?: string }>;
}) {
  if (process.env.ALYSSA_E2E_FIXTURES !== "1" && process.env.NODE_ENV === "production") notFound();
  const query = await searchParams;
  const queue = queueOptions.some(item => item.value === query.queue) ? query.queue! : "";
  const selectedBrand = resolveSingleCrmBrand(fixtureBrands, query.brand);
  const cases = selectedBrand ? fixtureCases.filter(item => item.brandSlug === selectedBrand.slug) : fixtureCases;
  const visibleCases = filterCrmBookingQueue(cases, queue, fixtureNow);
  const readiness = selectedBrand ? resolveCrmChannelReadiness({
    ok: query.health !== "unavailable",
    tableReady: true,
    encryptionConfigured: true,
    connection: {
      status: selectedBrand.id === "fixture-brand-a" ? "saved" : "test_succeeded",
    } as WhatsAppConnectionRecord,
  }) : null;

  return <main className="crm-shell min-w-0 space-y-4 overflow-hidden bg-system-background p-4 text-system-foreground" data-testid="crm-foundation-fixture">
    <header className="space-y-1">
      <h1 className="text-2xl font-bold">CRM 預約流程驗收</h1>
      <p className="text-sm text-system-muted-foreground">隔離測試資料 · 香港日期 <time data-testid="fixture-hkt-day">{crmDayKey(fixtureNow)}</time></p>
    </header>
    <form className="flex flex-wrap items-end gap-3" method="get">
      <label className="grid gap-1 text-sm font-medium">品牌
        <select name="brand" aria-label="品牌" defaultValue={selectedBrand?.slug || ""} className="rounded-md border border-system-border bg-system-card px-3 py-2">
          <option value="">全部品牌</option>
          {fixtureBrands.map(brand => <option key={brand.id} value={brand.slug}>{brand.name}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-medium">預約佇列
        <select name="queue" aria-label="預約佇列" defaultValue={queue} className="rounded-md border border-system-border bg-system-card px-3 py-2">
          {queueOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      <SystemButton type="submit" density="compact">套用篩選</SystemButton>
    </form>
    <section className="rounded-md border border-system-border bg-system-card p-3" aria-label="品牌連接狀態">
      {readiness ? <>
        <p role="status" data-testid="fixture-channel-status">{selectedBrand!.name} · {readiness.label}</p>
        <p className="mt-1 text-sm text-system-muted-foreground">{readiness.description}</p>
      </> : <p role="status" data-testid="fixture-channel-status">全部品牌 · 請先選擇品牌確認連接狀態</p>}
    </section>
    <section className="min-w-0" aria-label="預約結果">
      <h2 className="mb-2 text-base font-semibold">符合條件：<span data-testid="fixture-result-count">{visibleCases.length}</span></h2>
      <CrmInboxTable cases={visibleCases} now={fixtureNow} />
    </section>
  </main>;
}
