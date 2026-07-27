import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";
import { getDemandSignalOverview } from "@/lib/demandSignals/service";
import {
  demandSignalAssetTypeLabels, demandSignalAssetTypes, demandSignalSourceLabels,
  demandSignalSources, demandSignalStatusLabels, demandSignalStatuses,
  demandSignalTypeLabels, demandSignalTypes, type DemandSignalFilters,
} from "@/lib/demandSignals/types";
import { createDemandSignalAction, createDemandSignalAssetAction, updateDemandSignalStatusAction } from "./actions";

export const dynamic = "force-dynamic";
type Query = Record<string, string | string[] | undefined>;
const value = (query: Query, key: string) => typeof query[key] === "string" ? String(query[key]) : "";
const percent = (number: number) => `${number.toFixed(1)}%`;
const money = (number: number) => new Intl.NumberFormat("zh-HK", { style: "currency", currency: "HKD", maximumFractionDigits: 0 }).format(number);
const date = (input: string) => input ? new Intl.DateTimeFormat("zh-HK", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Hong_Kong" }).format(new Date(input)) : "-";

function returnPath(query: Query) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, item]) => {
    if (!key.startsWith("signal_") && typeof item === "string" && item) params.set(key, item);
  });
  return `/growth-intelligence/demand-signals${params.size ? `?${params}` : ""}`;
}

export default async function DemandSignalsPage({ searchParams }: { searchParams?: Promise<Query> }) {
  const query = (await searchParams) ?? {};
  const filters: DemandSignalFilters = {
    brandId: value(query, "brand") || undefined,
    period: (value(query, "period") as DemandSignalFilters["period"]) || "30d",
    search: value(query, "search") || undefined,
    signalType: (value(query, "type") as DemandSignalFilters["signalType"]) || "all",
    sourceType: (value(query, "source") as DemandSignalFilters["sourceType"]) || "all",
    status: (value(query, "status") as DemandSignalFilters["status"]) || "all",
    treatmentId: value(query, "treatment") || "all",
    formId: value(query, "form") || "all",
  };
  const overview = await getDemandSignalOverview(filters);
  const brandId = overview.filters.brandId || overview.brands[0]?.id || "";
  const treatments = overview.treatments.filter((item) => item.brandId === brandId);
  const forms = overview.forms.filter((item) => item.brandId === brandId);
  const taxonomy = new Map(overview.taxonomy.map((item) => [`${item.signalType}:${item.normalizedTag}`, item.label]));
  const feedback = value(query, "signal_success") || value(query, "signal_error");
  const feedbackOk = Boolean(value(query, "signal_success"));
  const back = returnPath(query);

  return (
    <main className="alyssa-shell min-h-screen">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <header className="rounded-[28px] border border-[#ead9cf] bg-white/90 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.1)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div><p className="alyssa-kicker">Growth Intelligence</p><h1 className="mt-2 text-3xl font-bold text-[#321428]">Demand Signals</h1>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#6d4a5c]">將 WhatsApp、表格同 CRM 入面嘅真實客人字句，連結到預約、到店、付款及收入結果。所有素材只建立草稿，必須人手覆核，唔會自動發布。</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-bold"><Badge>Brand-scoped</Badge><Badge green>Server-only data</Badge><Badge warning>Human review required</Badge></div>
          </div>
        </header>

        {overview.fixtureMode && <Notice testId="demand-signals-preview-mode">Preview fixture mode：呢批係產品中性示範資料，只用作驗證介面；未寫入任何客戶或 production 資料。</Notice>}
        {!overview.tableReady && !overview.fixtureMode && <Notice>Demand Signals migration 尚未套用；現有 LaunchHub、CRM、表格及 UTM 照常運作，但新模組暫時只讀。</Notice>}
        {feedback && <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm font-bold ${feedbackOk ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>{feedback.replaceAll("_", " ")}</div>}

        <form method="get" className="mt-6 grid gap-3 rounded-[24px] border border-[#ead9cf] bg-white/90 p-4 shadow-sm md:grid-cols-2 xl:grid-cols-8">
          <Select name="brand" label="Brand" selected={brandId} options={overview.brands.map((item) => [item.id, item.name])} />
          <Select name="period" label="Period" selected={overview.filters.period || "30d"} options={[["30d", "30 days"], ["90d", "90 days"], ["all", "All time"]]} />
          <Select name="type" label="Type" selected={overview.filters.signalType || "all"} options={[["all", "All types"], ...demandSignalTypes.map((item) => [item, demandSignalTypeLabels[item]] as [string, string])]} />
          <Select name="source" label="Source" selected={overview.filters.sourceType || "all"} options={[["all", "All sources"], ...demandSignalSources.map((item) => [item, demandSignalSourceLabels[item]] as [string, string])]} />
          <Select name="status" label="Status" selected={overview.filters.status || "all"} options={[["all", "All status"], ...demandSignalStatuses.map((item) => [item, demandSignalStatusLabels[item]] as [string, string])]} />
          <Select name="treatment" label="Treatment" selected={overview.filters.treatmentId || "all"} options={[["all", "All treatments"], ...treatments.map((item) => [item.id, item.name] as [string, string])]} />
          <Select name="form" label="Form" selected={overview.filters.formId || "all"} options={[["all", "All forms"], ...forms.map((item) => [item.id, item.name] as [string, string])]} />
          <label className="grid gap-1 text-xs font-bold text-[#6d4a5c]">Search<span className="flex gap-2"><input name="search" defaultValue={overview.filters.search || ""} className="min-w-0 flex-1 rounded-xl border border-[#ead9cf] px-3 py-2 text-sm" placeholder="客人字句／tag" /><button className="rounded-xl bg-[#5a2348] px-3 py-2 text-white">Go</button></span></label>
        </form>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <Metric label="Signals" value={String(overview.headline.signals)} helper={overview.headline.trendPercent === null ? "No prior baseline" : `${overview.headline.trendPercent > 0 ? "+" : ""}${overview.headline.trendPercent}% vs prior`} />
          <Metric label="Distinct Leads" value={String(overview.headline.distinctLeads)} helper="跨來源去重" />
          <Metric label="Booked" value={String(overview.headline.booked)} helper="已確認預約" />
          <Metric label="Showed" value={String(overview.headline.showed)} helper="已到店" />
          <Metric label="Paid" value={String(overview.headline.paid)} helper="已付款" />
          <Metric label="Revenue" value={money(overview.headline.revenue)} helper="已付款 lead" />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Card><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="alyssa-kicker">Top Demand Signals</p><h2 className="mt-2 text-xl font-bold text-[#321428]">最多人提及兼有結果嘅需求</h2></div><span className="text-xs font-bold text-[#7b5a6a]">Distinct lead 去重，唔會跨來源重複計</span></div>
            <div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-[#ead9cf] text-xs uppercase text-[#9a5d76]"><tr><th className="p-3">Signal</th><th className="p-3">Leads</th><th className="p-3">Book</th><th className="p-3">Show</th><th className="p-3">Paid</th><th className="p-3">Revenue</th></tr></thead><tbody>
              {overview.topSignals.map((item) => <tr key={item.key} className="border-b border-[#f3e8e1] font-semibold text-[#5a2348]"><td className="p-3"><strong className="block text-[#321428]">{taxonomy.get(item.key) || item.label}</strong><span className="text-xs text-[#9a5d76]">{demandSignalTypeLabels[item.signalType]} · {item.occurrences} mentions</span></td><td className="p-3">{item.distinctLeads}</td><td className="p-3">{percent(item.bookRate)}</td><td className="p-3">{percent(item.showRate)}</td><td className="p-3">{percent(item.paidRate)}</td><td className="p-3">{money(item.revenue)}</td></tr>)}
              {!overview.topSignals.length && <tr><td colSpan={6} className="p-8 text-center font-semibold text-[#9a5d76]">未有符合條件嘅 Demand Signal。</td></tr>}
            </tbody></table></div>
          </Card>
          <Card><p className="alyssa-kicker">Outcome Comparison</p><h2 className="mt-2 text-xl font-bold text-[#321428]">Book／Show／Paid 比較</h2><div className="mt-4 grid gap-3">
            {overview.outcomeComparison.map((item) => <div key={item.key} className="rounded-2xl border border-[#ead9cf] bg-[#fffaf6] p-4"><div className="flex justify-between gap-2"><strong>{item.label}</strong><span className="text-xs font-bold text-[#9a5d76]">{item.distinctLeads} leads</span></div><div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-bold"><Rate label="Book" value={item.bookRate} /><Rate label="Show" value={item.showRate} /><Rate label="Paid" value={item.paidRate} /></div></div>)}
          </div></Card>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
          <form action={createDemandSignalAction} className="alyssa-premium-card grid h-fit gap-4 p-5"><input type="hidden" name="brandId" value={brandId} /><input type="hidden" name="returnTo" value={back} />
            <div><p className="alyssa-kicker">Manual Capture</p><h2 className="mt-2 text-xl font-bold text-[#321428]">新增真實客人 Signal</h2><p className="mt-2 text-sm font-semibold text-[#6d4a5c]">只記錄客人真實字句；系統唔會自動推斷或發布素材。</p></div>
            <div className="grid gap-3 sm:grid-cols-2"><FieldSelect name="signalType" label="Signal type" options={demandSignalTypes.map((item) => [item, demandSignalTypeLabels[item]])} /><FieldSelect name="sourceType" label="Source" defaultValue="manual" options={[["manual", demandSignalSourceLabels.manual], ["crm", demandSignalSourceLabels.crm]]} /><FieldSelect name="treatmentId" label="Treatment (optional)" options={[["", "Not linked"], ...treatments.map((item) => [item.id, item.name] as [string, string])]} /><FieldSelect name="formId" label="Form (optional)" options={[["", "Not linked"], ...forms.map((item) => [item.id, item.name] as [string, string])]} /></div>
            <label className="grid gap-1 text-xs font-bold text-[#6d4a5c]">Exact customer wording<textarea required minLength={2} maxLength={2000} rows={4} name="exactQuote" className="rounded-2xl border border-[#ead9cf] bg-[#fffaf6] px-4 py-3 text-sm" /></label>
            <label className="grid gap-1 text-xs font-bold text-[#6d4a5c]">Normalized tag<input required name="normalizedTag" className="rounded-2xl border border-[#ead9cf] bg-[#fffaf6] px-4 py-3 text-sm" placeholder="results_timeline" /></label>
            <label className="grid gap-1 text-xs font-bold text-[#6d4a5c]">Internal summary (optional)<input name="summary" maxLength={500} className="rounded-2xl border border-[#ead9cf] bg-[#fffaf6] px-4 py-3 text-sm" /></label>
            <button disabled={!overview.tableReady} className="rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white disabled:opacity-40">Create Signal</button>
          </form>
          <Card><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="alyssa-kicker">Evidence Inbox</p><h2 className="mt-2 text-xl font-bold text-[#321428]">Signal 列表及覆核</h2></div><span className="text-xs font-bold text-[#7b5a6a]">{overview.signals.length} results</span></div>
            <div className="mt-4 grid gap-3">{overview.signals.map((signal) => <article key={signal.id} data-testid="demand-signal-row" className="rounded-2xl border border-[#ead9cf] bg-white p-4"><div className="flex flex-wrap justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap gap-2 text-[11px] font-bold"><span>{demandSignalTypeLabels[signal.signalType]}</span><span>{signal.sourceLabel}</span><span>{demandSignalStatusLabels[signal.status]}</span></div><blockquote className="mt-3 whitespace-pre-wrap text-base font-bold leading-7 text-[#321428]">“{signal.exactQuote}”</blockquote><p className="mt-2 text-xs font-semibold text-[#7b5a6a]">{signal.normalizedTag} · {signal.treatmentName || "No treatment"} · {signal.formName || "No form"} · {date(signal.occurredAt)}</p></div><div className="grid min-w-[150px] grid-cols-2 gap-2 text-center text-xs font-bold"><Outcome label="Booked" active={signal.outcome.booked} /><Outcome label="Showed" active={signal.outcome.showed} /><Outcome label="Paid" active={signal.outcome.paid} /><span>{money(signal.outcome.revenue)}</span></div></div>
              {!overview.fixtureMode && overview.tableReady && <div className="mt-4 flex flex-wrap gap-2">{signal.status === "new" && <StatusForm signalId={signal.id} leadId={signal.leadId} brandId={brandId} status="reviewed" back={back} label="Review" />}{signal.status !== "rejected" && <StatusForm signalId={signal.id} leadId={signal.leadId} brandId={brandId} status="rejected" back={back} label="Reject" />}{["reviewed", "validated", "applied"].includes(signal.status) && <form action={createDemandSignalAssetAction} className="flex flex-wrap gap-2"><input type="hidden" name="brandId" value={brandId} /><input type="hidden" name="signalIds" value={signal.id} /><input type="hidden" name="returnTo" value={back} /><select name="assetType" className="rounded-full border px-3 py-2 text-xs font-bold">{demandSignalAssetTypes.map((item) => <option key={item} value={item}>{demandSignalAssetTypeLabels[item]}</option>)}</select><button className="rounded-full border border-[#d9b66f] px-4 py-2 text-xs font-bold">Create draft</button></form>}</div>}
            </article>)}{!overview.signals.length && <p className="py-8 text-center text-sm font-bold text-[#9a5d76]">未有符合條件嘅 Signal。</p>}</div>
          </Card>
        </section>

        <section className="mt-6 alyssa-premium-card p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="alyssa-kicker">Controlled Drafts</p><h2 className="mt-2 text-xl font-bold text-[#321428]">Signal → Asset 草稿</h2></div><Link href="/landing-pages" className="rounded-full border px-4 py-2 text-xs font-bold">Open Landing Pages</Link></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{overview.assets.map((asset) => <article key={asset.id} className="rounded-2xl border border-[#ead9cf] bg-[#fffaf6] p-4"><span className="text-xs font-bold">{demandSignalAssetTypeLabels[asset.assetType]} · {asset.status}</span><h3 className="mt-3 font-bold">{asset.title}</h3><p className="mt-2 text-xs">{asset.signalIds.length} linked signal(s) · {date(asset.updatedAt)}</p><p className="mt-3 rounded-xl bg-white p-3 text-xs font-semibold">Draft only · Human review required · Auto publish off</p></article>)}{!overview.assets.length && <p className="text-sm font-semibold text-[#9a5d76]">覆核 Signal 後，可以建立 FAQ、Ad Hook、Offer、Landing Page Message、Creative Brief 或 System Card 草稿。</p>}</div></section>
      </div>
    </main>
  );
}

function Badge({ children, green, warning }: { children: React.ReactNode; green?: boolean; warning?: boolean }) { return <span className={`rounded-full px-3 py-2 ${green ? "bg-[#eef8f1] text-[#207044]" : warning ? "bg-[#fff1ec] text-[#b44d45]" : "bg-[#f4ece8] text-[#5a2348]"}`}>{children}</span>; }
function Notice({ children, testId }: { children: React.ReactNode; testId?: string }) { return <div data-testid={testId} className="mt-5 rounded-2xl border border-[#d9b66f] bg-[#fff8e8] px-4 py-3 text-sm font-bold text-[#6b4b13]">{children}</div>; }
function Card({ children }: { children: React.ReactNode }) { return <div className="alyssa-premium-card min-w-0 p-5">{children}</div>; }
function Select({ name, label, selected, options }: { name: string; label: string; selected: string; options: Array<[string, string]> }) { return <label className="grid gap-1 text-xs font-bold text-[#6d4a5c]">{label}<select name={name} defaultValue={selected} className="min-w-0 rounded-xl border border-[#ead9cf] bg-white px-3 py-2 text-sm">{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>; }
function FieldSelect({ name, label, options, defaultValue }: { name: string; label: string; options: Array<[string, string]>; defaultValue?: string }) { return <label className="grid gap-1 text-xs font-bold text-[#6d4a5c]">{label}<select name={name} defaultValue={defaultValue} className="rounded-2xl border border-[#ead9cf] bg-[#fffaf6] px-4 py-3 text-sm">{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>; }
function Metric({ label, value: metric, helper }: { label: string; value: string; helper: string }) { return <article className="alyssa-premium-card p-4"><p className="text-[11px] font-bold uppercase text-[#9a5d76]">{label}</p><p className="mt-2 text-2xl font-bold text-[#321428]">{metric}</p><p className="mt-1 text-[11px] font-semibold text-[#7b5a6a]">{helper}</p></article>; }
function Rate({ label, value: rate }: { label: string; value: number }) { return <div className="rounded-xl bg-white p-2"><span className="block text-[#9a5d76]">{label}</span><span className="mt-1 block text-sm">{percent(rate)}</span></div>; }
function Outcome({ label, active }: { label: string; active: boolean }) { return <span className={`rounded-lg px-2 py-2 ${active ? "bg-emerald-50 text-emerald-700" : "bg-[#f8fafc] text-[#94a3b8]"}`}>{label}</span>; }
function StatusForm({ signalId, leadId, brandId, status, back, label }: { signalId: string; leadId: string | null; brandId: string; status: string; back: string; label: string }) { return <form action={updateDemandSignalStatusAction}><input type="hidden" name="brandId" value={brandId} /><input type="hidden" name="signalId" value={signalId} /><input type="hidden" name="leadId" value={leadId || ""} /><input type="hidden" name="status" value={status} /><input type="hidden" name="returnTo" value={back} /><button className="rounded-full border px-4 py-2 text-xs font-bold">{label}</button></form>; }
