import "server-only";
import { randomUUID } from "crypto";
import {
  aggregateDemandSignalOutcomes,
  aggregateTopDemandSignals,
  buildDemandSignalHeadline,
} from "@/lib/demandSignals/analytics";
import {
  demandSignalAssetTypeLabels,
  demandSignalAssetTypes,
  demandSignalSourceLabels,
  demandSignalSources,
  demandSignalStatuses,
  demandSignalTypes,
  type DemandSignalAsset,
  type DemandSignalAssetType,
  type DemandSignalFilters,
  type DemandSignalOverview,
  type DemandSignalRecord,
  type DemandSignalSource,
  type DemandSignalStatus,
  type DemandSignalTaxonomyItem,
  type DemandSignalType,
} from "@/lib/demandSignals/types";
import { getConfigurationData } from "@/lib/data/configuration";
import { getCrmBookingsByCaseIds, getCrmCasesBySourceLeadIds } from "@/lib/crm/store";
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";

type Row = Record<string, unknown>;
type CreateSignalInput = {
  brandId: string;
  signalType: DemandSignalType;
  exactQuote: string;
  normalizedTag: string;
  summary?: string;
  sourceType: DemandSignalSource;
  sourceRecordId?: string;
  leadId?: string;
  contactId?: string;
  formId?: string;
  treatmentId?: string;
  occurredAt?: string;
  confidence?: number;
};

function clean(value: unknown, max = 2000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function number(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : {};
}

export function normalizeDemandSignalTag(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9\u3400-\u9fff]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || "manual_review"
  );
}

function validType(value: string): value is DemandSignalType {
  return demandSignalTypes.includes(value as DemandSignalType);
}
function validSource(value: string): value is DemandSignalSource {
  return demandSignalSources.includes(value as DemandSignalSource);
}
function validStatus(value: string): value is DemandSignalStatus {
  return demandSignalStatuses.includes(value as DemandSignalStatus);
}
function validAssetType(value: string): value is DemandSignalAssetType {
  return demandSignalAssetTypes.includes(value as DemandSignalAssetType);
}
function previewFixturesEnabled() {
  return process.env.ALYSSA_E2E_FIXTURES === "1" || process.env.VERCEL_ENV === "preview";
}
function missingTable(error: { code?: string; message?: string } | null) {
  const message = error?.message?.toLowerCase() || "";
  return error?.code === "42P01" || error?.code === "PGRST205" || message.includes("demand_signal");
}

function periodBounds(period: DemandSignalFilters["period"] = "30d") {
  if (period === "all") return { current: null, previous: null };
  const days = period === "90d" ? 90 : 30;
  return {
    current: new Date(Date.now() - days * 86_400_000),
    previous: new Date(Date.now() - days * 2 * 86_400_000),
  };
}

function matches(signal: DemandSignalRecord, filters: DemandSignalFilters) {
  const search = clean(filters.search, 200).toLowerCase();
  if (
    search &&
    ![signal.exactQuote, signal.summary || "", signal.normalizedTag, signal.treatmentName || "", signal.formName || ""].some(
      (value) => value.toLowerCase().includes(search)
    )
  ) return false;
  if (filters.signalType && filters.signalType !== "all" && signal.signalType !== filters.signalType) return false;
  if (filters.sourceType && filters.sourceType !== "all" && signal.sourceType !== filters.sourceType) return false;
  if (filters.status && filters.status !== "all" && signal.status !== filters.status) return false;
  if (filters.treatmentId && filters.treatmentId !== "all" && signal.treatmentId !== filters.treatmentId) return false;
  if (filters.formId && filters.formId !== "all" && signal.formId !== filters.formId) return false;
  return true;
}

function fixtureSignals(brandId: string, treatmentId?: string, formId?: string) {
  const now = Date.now();
  const data: Array<{
    type: DemandSignalType; quote: string; tag: string; source: DemandSignalSource;
    days: number; booked: boolean; showed: boolean; paid: boolean; revenue: number; status: DemandSignalStatus;
  }> = [
    { type: "results", quote: "通常做幾多次先會見到明顯效果？", tag: "results_timeline", source: "whatsapp", days: 1, booked: true, showed: true, paid: true, revenue: 388, status: "reviewed" },
    { type: "price", quote: "體驗價之後仲有冇其他收費？", tag: "price_comparison", source: "lead_form", days: 3, booked: true, showed: false, paid: false, revenue: 0, status: "new" },
    { type: "trust", quote: "可唔可以睇下真實客人案例？", tag: "authentic_review", source: "crm", days: 5, booked: true, showed: true, paid: false, revenue: 0, status: "reviewed" },
    { type: "booking_barrier", quote: "放工時間先方便，七點後有冇位？", tag: "schedule_fit", source: "whatsapp", days: 7, booked: false, showed: false, paid: false, revenue: 0, status: "new" },
    { type: "objection", quote: "做完會唔會紅腫，好耐先退？", tag: "safety_concern", source: "manual", days: 11, booked: true, showed: true, paid: true, revenue: 388, status: "validated" },
  ];
  return data.map((item, index): DemandSignalRecord => ({
    id: `preview-signal-${index + 1}`,
    brandId,
    signalType: item.type,
    exactQuote: item.quote,
    normalizedTag: item.tag,
    summary: null,
    sourceType: item.source,
    status: item.status,
    confidence: item.source === "manual" ? 1 : 0.8,
    occurredAt: new Date(now - item.days * 86_400_000).toISOString(),
    leadId: `preview-lead-${index + 1}`,
    contactId: `preview-contact-${index + 1}`,
    formId: formId || null,
    treatmentId: treatmentId || null,
    treatmentName: null,
    formName: null,
    sourceLabel: demandSignalSourceLabels[item.source],
    reviewedAt: item.status === "new" ? null : new Date(now).toISOString(),
    outcome: {
      distinctLeadKey: `preview-lead-${index + 1}`,
      booked: item.booked,
      showed: item.showed,
      paid: item.paid,
      revenue: item.revenue,
    },
  }));
}

async function hydrate(rows: Row[], treatmentNames: Map<string, string>, formNames: Map<string, string>) {
  const leadIds = Array.from(new Set(rows.map((row) => clean(row.lead_id, 100)).filter(Boolean)));
  const leads = new Map<string, Row>();
  if (leadIds.length) {
    const { data } = await createSupabaseAdminClient()
      .from("leads")
      .select("id,contact_id,form_id,treatment_id,booking_status,payment_status,price,crm_status")
      .in("id", leadIds);
    ((data ?? []) as Row[]).forEach((lead) => leads.set(clean(lead.id, 100), lead));
  }
  const cases = await getCrmCasesBySourceLeadIds(leadIds);
  const bookings = await getCrmBookingsByCaseIds(Array.from(cases.values()).map((item) => item.id));

  return rows.map((row): DemandSignalRecord => {
    const id = clean(row.id, 100);
    const leadId = clean(row.lead_id, 100) || null;
    const lead = leadId ? leads.get(leadId) : undefined;
    const crmCase = leadId ? cases.get(leadId) : undefined;
    const booking = crmCase ? bookings.get(crmCase.id) : undefined;
    const typeText = clean(row.signal_type, 40);
    const sourceText = clean(row.source_type, 40);
    const statusText = clean(row.status, 40);
    const signalType = validType(typeText) ? typeText : "need";
    const sourceType = validSource(sourceText) ? sourceText : "manual";
    const status = validStatus(statusText) ? statusText : "new";
    const crmStatus = crmCase?.status || clean(lead?.crm_status, 40);
    const bookingStatus = booking?.status || clean(lead?.booking_status, 40);
    const paymentStatus = clean(lead?.payment_status, 40);
    const contactId = clean(row.contact_id, 100) || clean(lead?.contact_id, 100) || null;
    const treatmentId = clean(row.treatment_id, 100) || clean(lead?.treatment_id, 100) || null;
    const formId = clean(row.form_id, 100) || clean(lead?.form_id, 100) || null;
    const booked = ["booked", "confirmed", "showed", "paid"].includes(crmStatus) || ["booked", "confirmed", "showed"].includes(bookingStatus);
    const showed = crmStatus === "showed" || bookingStatus === "showed" || bookingStatus === "show";
    const paid = crmStatus === "paid" || paymentStatus === "paid";
    return {
      id,
      brandId: clean(row.brand_id, 100),
      signalType,
      exactQuote: clean(row.exact_quote, 2000),
      normalizedTag: clean(row.normalized_tag, 100),
      summary: clean(row.summary, 500) || null,
      sourceType,
      status,
      confidence: Math.max(0, Math.min(1, number(row.confidence))),
      occurredAt: clean(row.occurred_at, 100),
      leadId,
      contactId,
      formId,
      treatmentId,
      treatmentName: treatmentId ? treatmentNames.get(treatmentId) || null : null,
      formName: formId ? formNames.get(formId) || null : null,
      sourceLabel: demandSignalSourceLabels[sourceType],
      reviewedAt: clean(row.reviewed_at, 100) || null,
      outcome: { distinctLeadKey: leadId || contactId || id, booked, showed, paid, revenue: paid ? number(lead?.price) : 0 },
    };
  });
}

function mapTaxonomy(row: Row): DemandSignalTaxonomyItem | null {
  const type = clean(row.signal_type, 40);
  if (!validType(type)) return null;
  return {
    id: clean(row.id, 100), brandId: clean(row.brand_id, 100), signalType: type,
    normalizedTag: clean(row.normalized_tag, 100), label: clean(row.label, 200),
    description: clean(row.description, 500) || null, status: row.status === "archived" ? "archived" : "active",
  };
}

function mapAsset(row: Row, signalIds: string[]): DemandSignalAsset | null {
  const type = clean(row.asset_type, 60);
  if (!validAssetType(type)) return null;
  const status = clean(row.status, 40);
  return {
    id: clean(row.id, 100), brandId: clean(row.brand_id, 100), assetType: type,
    title: clean(row.title, 300), content: record(row.content_json),
    status: status === "reviewed" || status === "applied" || status === "archived" ? status : "draft",
    landingPageId: clean(row.landing_page_id, 100) || null,
    updatedAt: clean(row.updated_at, 100), signalIds,
  };
}

export async function getDemandSignalOverview(filters: DemandSignalFilters = {}): Promise<DemandSignalOverview> {
  const config = await getConfigurationData();
  const brand = config.brands.find((item) => item.id === filters.brandId) || config.brands[0];
  const brandId = brand?.id || "";
  const normalized: DemandSignalFilters = { ...filters, brandId, period: filters.period || "30d" };
  const treatments = config.treatments
    .filter((item) => item.brandId === brandId)
    .map((item) => ({ id: item.id, brandId: item.brandId, name: item.name }));
  const forms = config.forms
    .filter((item) => item.brandId === brandId)
    .map((item) => ({ id: item.id, brandId: item.brandId, name: item.formName }));
  const base = {
    filters: normalized,
    brands: config.brands.map((item) => ({ id: item.id, name: item.name, slug: item.slug })),
    treatments,
    forms,
  };
  const fallback = (fixtureMode: boolean, error: string | null): DemandSignalOverview => {
    const fixture = fixtureMode
      ? fixtureSignals(brandId || "preview-brand", treatments.find((item) => item.brandId === brandId)?.id, forms.find((item) => item.brandId === brandId)?.id)
      : [];
    const signals = fixture.filter((item) => matches(item, normalized));
    return {
      ...base, tableReady: false, fixtureMode, error, taxonomy: [], signals, assets: [],
      headline: buildDemandSignalHeadline(signals),
      topSignals: aggregateTopDemandSignals(signals).slice(0, 8),
      outcomeComparison: aggregateDemandSignalOutcomes(signals),
    };
  };
  if (!brandId || !hasSupabaseAdminEnv()) {
    const fixtureMode = previewFixturesEnabled();
    return fallback(fixtureMode, fixtureMode ? null : "supabase_admin_not_configured");
  }

  const supabase = createSupabaseAdminClient();
  const bounds = periodBounds(normalized.period);
  let query = supabase.from("demand_signals").select("*").eq("brand_id", brandId).order("occurred_at", { ascending: false }).limit(2000);
  if (bounds.previous) query = query.gte("occurred_at", bounds.previous.toISOString());
  const [signalResult, taxonomyResult, assetResult, linkResult] = await Promise.all([
    query,
    supabase.from("demand_signal_taxonomy").select("*").eq("brand_id", brandId).eq("status", "active"),
    supabase.from("demand_signal_assets").select("*").eq("brand_id", brandId).order("updated_at", { ascending: false }).limit(100),
    supabase.from("demand_signal_asset_links").select("signal_id,asset_id").eq("brand_id", brandId),
  ]);
  if (signalResult.error) {
    const fixtureMode = previewFixturesEnabled() && missingTable(signalResult.error);
    return fallback(fixtureMode, fixtureMode ? null : "demand_signals_migration_required");
  }
  const treatmentNames = new Map(treatments.map((item) => [item.id, item.name]));
  const formNames = new Map(forms.map((item) => [item.id, item.name]));
  const hydrated = await hydrate((signalResult.data ?? []) as Row[], treatmentNames, formNames);
  const matched = hydrated.filter((item) => matches(item, normalized));
  const current = bounds.current ? matched.filter((item) => new Date(item.occurredAt) >= bounds.current!) : matched;
  const previous = bounds.current && bounds.previous
    ? matched.filter((item) => { const date = new Date(item.occurredAt); return date >= bounds.previous! && date < bounds.current!; })
    : [];
  const links = new Map<string, string[]>();
  ((linkResult.data ?? []) as Row[]).forEach((row) => {
    const assetId = clean(row.asset_id, 100);
    const signalId = clean(row.signal_id, 100);
    if (assetId && signalId) links.set(assetId, [...(links.get(assetId) ?? []), signalId]);
  });
  return {
    ...base, tableReady: true, fixtureMode: false, error: null,
    taxonomy: ((taxonomyResult.data ?? []) as Row[]).map(mapTaxonomy).filter((item): item is DemandSignalTaxonomyItem => Boolean(item)),
    signals: current,
    assets: ((assetResult.data ?? []) as Row[]).map((row) => mapAsset(row, links.get(clean(row.id, 100)) ?? [])).filter((item): item is DemandSignalAsset => Boolean(item)),
    headline: buildDemandSignalHeadline(current, previous),
    topSignals: aggregateTopDemandSignals(current).slice(0, 8),
    outcomeComparison: aggregateDemandSignalOutcomes(current),
  };
}

async function validateRelations(input: CreateSignalInput) {
  const supabase = createSupabaseAdminClient();
  const { data: brand } = await supabase.from("brands").select("id").eq("id", input.brandId).maybeSingle();
  if (!brand) throw new Error("invalid_brand");
  if (input.treatmentId) {
    const { data } = await supabase.from("treatments").select("id").eq("id", input.treatmentId).eq("brand_id", input.brandId).maybeSingle();
    if (!data) throw new Error("treatment_brand_mismatch");
  }
  if (input.formId) {
    const { data } = await supabase.from("forms").select("id").eq("id", input.formId).eq("brand_id", input.brandId).maybeSingle();
    if (!data) throw new Error("form_brand_mismatch");
  }
}

export async function createDemandSignal(input: CreateSignalInput) {
  if (!hasSupabaseAdminEnv()) return { ok: false, message: "database_not_ready" };
  const brandId = clean(input.brandId, 100);
  const exactQuote = clean(input.exactQuote, 2000);
  if (!brandId || exactQuote.length < 2) return { ok: false, message: "required_fields_missing" };
  if (!validType(input.signalType) || !validSource(input.sourceType)) return { ok: false, message: "invalid_signal_type_or_source" };
  const normalized = { ...input, brandId };
  const supabase = createSupabaseAdminClient();
  let leadId = clean(input.leadId, 100) || null;
  let contactId = clean(input.contactId, 100) || null;
  const sourceRecordId = clean(input.sourceRecordId, 200) || randomUUID();
  let sourceQuote = exactQuote;

  if (input.sourceType === "whatsapp") {
    const { data: message, error } = await supabase.from("whatsapp_messages")
      .select("id,brand_id,lead_id,direction,body").eq("id", sourceRecordId).maybeSingle();
    if (error || !message || message.brand_id !== brandId || message.direction !== "inbound") return { ok: false, message: "invalid_whatsapp_source" };
    leadId = message.lead_id || leadId;
    sourceQuote = clean(message.body, 2000);
    if (sourceQuote.length < 2) return { ok: false, message: "whatsapp_message_has_no_text" };
  }
  if (leadId) {
    const { data: lead } = await supabase.from("leads").select("contact_id,brand_id,form_id,treatment_id").eq("id", leadId).maybeSingle();
    if (!lead || lead.brand_id !== brandId) return { ok: false, message: "lead_brand_mismatch" };
    if (contactId && lead.contact_id && contactId !== lead.contact_id) return { ok: false, message: "contact_lead_mismatch" };
    contactId = lead.contact_id || null;
    normalized.formId ||= lead.form_id || undefined;
    normalized.treatmentId ||= lead.treatment_id || undefined;
  }
  await validateRelations(normalized);
  const { data: existing } = await supabase.from("demand_signal_source_refs").select("signal_id")
    .eq("brand_id", brandId).eq("source_type", input.sourceType).eq("source_record_id", sourceRecordId).maybeSingle();
  if (existing?.signal_id) return { ok: true, message: "signal_already_captured", signalId: existing.signal_id };

  const tag = normalizeDemandSignalTag(input.normalizedTag);
  const { error: taxonomyError } = await supabase.from("demand_signal_taxonomy").upsert({
    brand_id: brandId, signal_type: input.signalType, normalized_tag: tag,
    label: tag.replaceAll("_", " "), status: "active", updated_at: new Date().toISOString(),
  }, { onConflict: "brand_id,signal_type,normalized_tag", ignoreDuplicates: true });
  if (taxonomyError) return { ok: false, message: "taxonomy_create_failed" };

  const { data: signal, error } = await supabase.from("demand_signals").insert({
    brand_id: brandId, signal_type: input.signalType, exact_quote: sourceQuote,
    normalized_tag: tag, summary: clean(input.summary, 500) || null, source_type: input.sourceType,
    status: "new", confidence: Math.max(0, Math.min(1, input.confidence ?? (input.sourceType === "manual" ? 1 : 0.8))),
    occurred_at: input.occurredAt || new Date().toISOString(), lead_id: leadId, contact_id: contactId,
    form_id: clean(normalized.formId, 100) || null, treatment_id: clean(normalized.treatmentId, 100) || null,
  }).select("id").single();
  if (error || !signal) return { ok: false, message: "signal_create_failed" };
  const { error: refError } = await supabase.from("demand_signal_source_refs").insert({
    brand_id: brandId, signal_id: signal.id, source_type: input.sourceType, source_record_id: sourceRecordId,
    lead_id: leadId, contact_id: contactId, form_id: clean(normalized.formId, 100) || null,
    treatment_id: clean(normalized.treatmentId, 100) || null,
    metadata_json: { capture: "explicit_human_or_form_action" },
  });
  if (refError) {
    await supabase.from("demand_signals").delete().eq("id", signal.id).eq("brand_id", brandId);
    if (refError.code === "23505") {
      const { data: concurrent } = await supabase.from("demand_signal_source_refs").select("signal_id")
        .eq("brand_id", brandId).eq("source_type", input.sourceType).eq("source_record_id", sourceRecordId).maybeSingle();
      if (concurrent?.signal_id) return { ok: true, message: "signal_already_captured", signalId: concurrent.signal_id };
    }
    return { ok: false, message: "source_ref_create_failed" };
  }
  return { ok: true, message: "signal_created", signalId: signal.id };
}

export function createDemandSignalFromFormAnswer(input: {
  brandId: string; leadId: string; contactId: string; formId: string; treatmentId: string; answer: string;
}) {
  return createDemandSignal({
    ...input, signalType: "need", exactQuote: input.answer, normalizedTag: "customer_language",
    sourceType: "lead_form", sourceRecordId: `${input.formId}:${input.leadId}`, confidence: 0.75,
  });
}

export async function updateDemandSignalStatus(input: { brandId: string; signalId: string; status: DemandSignalStatus }) {
  if (!hasSupabaseAdminEnv()) return { ok: false, message: "database_not_ready" };
  if (!validStatus(input.status)) return { ok: false, message: "invalid_status" };
  const reviewed = input.status !== "new" && input.status !== "rejected";
  const { data, error } = await createSupabaseAdminClient().from("demand_signals").update({
    status: input.status, reviewed_at: reviewed ? new Date().toISOString() : null,
    reviewed_by: reviewed ? "LaunchHub admin" : null, updated_at: new Date().toISOString(),
  }).eq("id", input.signalId).eq("brand_id", input.brandId).select("id").maybeSingle();
  return error || !data ? { ok: false, message: "signal_update_failed" } : { ok: true, message: "signal_updated" };
}

function assetContent(type: DemandSignalAssetType, signals: Row[]) {
  const evidence = signals.map((signal) => ({ signal_id: signal.id, signal_type: signal.signal_type, normalized_tag: signal.normalized_tag, exact_quote: signal.exact_quote }));
  const quote = clean(signals[0]?.exact_quote, 2000);
  const tag = clean(signals[0]?.normalized_tag, 100).replaceAll("_", " ");
  const drafts: Record<DemandSignalAssetType, Record<string, unknown>> = {
    creative_brief: { objective: `回應「${tag}」需求`, audience_voice: quote, evidence, human_review_required: true },
    faq: { question: quote, answer_draft: "請按品牌已核准資料補充答案。", evidence, human_review_required: true },
    ad_hook: { hook_draft: quote ? `你是否都有呢個疑問：${quote}` : tag, evidence, human_review_required: true },
    offer_idea: { insight: quote, offer_direction: `降低「${tag}」相關阻力`, evidence, human_review_required: true },
    landing_page_message: { headline_draft: quote, supporting_message: `針對「${tag}」補充清晰解答。`, evidence, human_review_required: true, auto_publish: false },
    system_card: { title: tag, customer_language: quote, recommended_action: "交由團隊覆核並加入 campaign planning。", evidence, human_review_required: true },
  };
  return drafts[type];
}

export async function createDemandSignalAsset(input: { brandId: string; signalIds: string[]; assetType: DemandSignalAssetType; title?: string; landingPageId?: string }) {
  if (!hasSupabaseAdminEnv()) return { ok: false, message: "database_not_ready" };
  if (!validAssetType(input.assetType)) return { ok: false, message: "invalid_asset_type" };
  const ids = Array.from(new Set(input.signalIds.map((item) => clean(item, 100)).filter(Boolean)));
  if (!input.brandId || !ids.length) return { ok: false, message: "signal_selection_required" };
  const supabase = createSupabaseAdminClient();
  const { data: signals, error } = await supabase.from("demand_signals").select("id,signal_type,normalized_tag,exact_quote,status")
    .eq("brand_id", input.brandId).in("id", ids);
  if (error || !signals || signals.length !== ids.length) return { ok: false, message: "invalid_signal_selection" };
  if (signals.some((signal) => !["reviewed", "validated", "applied"].includes(signal.status))) return { ok: false, message: "review_signals_before_conversion" };
  const landingPageId = clean(input.landingPageId, 100) || null;
  if (landingPageId) {
    const { data: page } = await supabase.from("landing_pages").select("id").eq("id", landingPageId).eq("brand_id", input.brandId).maybeSingle();
    if (!page) return { ok: false, message: "landing_page_brand_mismatch" };
  }
  const title = clean(input.title, 300) || `${demandSignalAssetTypeLabels[input.assetType]} · ${clean(signals[0].normalized_tag, 100).replaceAll("_", " ")}`;
  const { data: asset, error: assetError } = await supabase.from("demand_signal_assets").insert({
    brand_id: input.brandId, asset_type: input.assetType, title,
    content_json: assetContent(input.assetType, signals as Row[]), status: "draft",
    landing_page_id: landingPageId, created_by: "LaunchHub admin",
  }).select("id").single();
  if (assetError || !asset) return { ok: false, message: "asset_create_failed" };
  const { error: linkError } = await supabase.from("demand_signal_asset_links").insert(ids.map((signalId) => ({ brand_id: input.brandId, signal_id: signalId, asset_id: asset.id })));
  if (linkError) {
    await supabase.from("demand_signal_assets").delete().eq("id", asset.id).eq("brand_id", input.brandId);
    return { ok: false, message: "asset_link_failed" };
  }
  await supabase.from("demand_signals").update({ status: "applied", updated_at: new Date().toISOString() }).eq("brand_id", input.brandId).in("id", ids);
  return { ok: true, message: "asset_draft_created", assetId: asset.id };
}

export async function getDemandSignalsForLead(brandId: string, leadId: string) {
  if (!brandId || !leadId || !hasSupabaseAdminEnv()) return [];
  const { data, error } = await createSupabaseAdminClient().from("demand_signals")
    .select("id,signal_type,exact_quote,normalized_tag,source_type,status,occurred_at")
    .eq("brand_id", brandId).eq("lead_id", leadId).order("occurred_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as Array<{ id: string; signal_type: DemandSignalType; exact_quote: string; normalized_tag: string; source_type: DemandSignalSource; status: DemandSignalStatus; occurred_at: string }>;
}
