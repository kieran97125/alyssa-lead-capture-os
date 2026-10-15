import { accountsForAllowedBrands, brandIdsForLeadAccount, leadAccountById, leadAccountBrandLabel } from "@/lib/marketing/leadAccountScope";
import { buildGoogleSheetBrandLookup, normalizeGoogleSheetBrandKey, parseGoogleSheetDate, type SheetBrandReference } from "@/lib/marketing/googleSheetsMetricParser";
import type { ReportArrivalRevenue, ReportRevenueMetrics } from "@/lib/reports/types";
import type { ReportTreatmentClassifier } from "@/lib/reports/treatmentCategories";

export const ARRIVAL_REVENUE_HEADERS = ["品牌", "結果", "到店日期", "Account", "療程", "Appointment ID", "試做價", "開單金額", "總金額"] as const;
export type ArrivalRevenueTable = { headers: unknown[]; rows: unknown[][]; readAt: string };
const text = (v: unknown) => String(v ?? "").replace(/\u00a0/g, " ").trim();
const empty = (): ReportRevenueMetrics => ({ attendedVisits: 0, orderVisits: 0, trialRevenue: 0, orderRevenue: 0, totalRevenue: 0, closeRate: null, roas: null });

/** Currency stays in integer cents until presentation. Blank is distinct from 0. */
function cents(value: unknown): number | null {
  if (value === null || value === undefined || text(value) === "") return null;
  const token = typeof value === "string" ? value.trim().replace(/^(?:HK\$|HKD|\$)\s*/i, "").replace(/,/g, "") : value;
  if (typeof token !== "number" && (typeof token !== "string" || !/^-?\d+(?:\.\d{1,2})?$/.test(token))) throw new Error("到店收益金額格式無效。");
  const amount = Number(token), result = Math.round(amount * 100);
  if (!Number.isFinite(amount) || !Number.isSafeInteger(result)) throw new Error("到店收益金額超出有效範圍。");
  return result;
}
function finish(m: ReportRevenueMetrics, spend?: number): ReportRevenueMetrics {
  return { ...m, trialRevenue: m.trialRevenue / 100, orderRevenue: m.orderRevenue / 100, totalRevenue: m.totalRevenue / 100,
    closeRate: m.attendedVisits ? m.orderVisits / m.attendedVisits : null,
    roas: spend && spend > 0 ? (m.totalRevenue / 100) / spend : null,
    adSpend: spend && spend > 0 ? spend : null,
    adRoi: spend && spend > 0 ? ((m.totalRevenue / 100) - spend) / spend : null };
}

/** No customer identifiers leave this aggregation or enter the saved report. */
export function buildArrivalRevenue(input: {
  table: ArrivalRevenueTable; brands: SheetBrandReference[]; brandAliases?: Record<string, string>;
  accountIds?: string[] | null; startDate: string; endDate: string;
  spendFacts: Array<{ brandId: string; spendDate: string; amount: number }>;
  classifyTreatment?: ReportTreatmentClassifier;
}): ReportArrivalRevenue {
  const headers = input.table.headers.map(text);
  const indices = ARRIVAL_REVENUE_HEADERS.map(header => {
    if (headers.filter(value => value === header).length !== 1) throw new Error("到店收益欄位缺少或重複。");
    return headers.indexOf(header);
  });
  const allowed = new Set(accountsForAllowedBrands(input.brands, input.brands.map(b => b.id)).map(a => a.id));
  const selected = input.accountIds ? new Set(input.accountIds) : allowed;
  const lookup = buildGoogleSheetBrandLookup(input.brands, input.brandAliases);
  // Existing source aliases used by the governed arrival display.
  for (const [alias, target] of [["Alyssa Aesthetics", "alyssa"], ["SkinLight", "skin-light"]]) {
    const brand = lookup.get(normalizeGoogleSheetBrandKey(target));
    if (brand && !lookup.has(normalizeGoogleSheetBrandKey(alias))) lookup.set(normalizeGoogleSheetBrandKey(alias), brand);
  }
  const accounts = new Map<string, { label: string; metrics: ReportRevenueMetrics; entered: boolean }>();
  const brandGroups = new Map<string, { accountId: string; brandId: string; label: string; metrics: ReportRevenueMetrics; entered: boolean }>();
  const treatments = new Map<string, { accountId: string; accountLabel: string; brandId: string; brandLabel: string; label: string; metrics: ReportRevenueMetrics; entered: boolean }>();
  const seen = new Set<string>();
  for (const row of input.table.rows) {
    const [brandLabel, outcome, arrival, accountLabel, treatment, appointmentId, trial, order, total] = indices.map(index => row[index]);
    const account = leadAccountById(accountLabel);
    if (!account || !allowed.has(account.id) || !selected.has(account.id)) continue;
    if (!["已到店", "已完成", "show", "show up"].includes(text(outcome).toLowerCase())) continue;
    const day = parseGoogleSheetDate(arrival);
    if (!day || day < input.startDate || day > input.endDate) continue;
    const brand = lookup.get(normalizeGoogleSheetBrandKey(brandLabel));
    if (!brand) continue;
    const id = text(appointmentId);
    if (!id || seen.has(id)) throw new Error("到店收益預約識別缺少或重複，請先核對到店紀錄。");
    seen.add(id);
    const a = cents(trial), b = cents(order), c = cents(total);
    // AH is authoritative. Only an absent total falls back to AF + AG.
    const revenue = c ?? (a ?? 0) + (b ?? 0);
    const entered = a !== null || b !== null || (c !== null && c !== 0);
    const parent = accounts.get(account.id) ?? { label: account.label, metrics: empty(), entered: false };
    accounts.set(account.id, parent);
    const brandKey = JSON.stringify([account.id, brand.id]);
    const brandGroup = brandGroups.get(brandKey) ?? { accountId: account.id, brandId: brand.id, label: leadAccountBrandLabel(account.id, brand), metrics: empty(), entered: false };
    brandGroups.set(brandKey, brandGroup);
    const label = input.classifyTreatment?.(account.label, text(treatment)) ?? (text(treatment) || "未分類療程"), key = JSON.stringify([account.id, brand.id, label]);
    const child = treatments.get(key) ?? { accountId: account.id, accountLabel: account.label, brandId: brand.id, brandLabel: brandGroup.label, label, metrics: empty(), entered: false };
    treatments.set(key, child);
    for (const group of [parent, brandGroup, child]) {
      group.metrics.attendedVisits++; group.metrics.orderVisits += Number((b ?? 0) > 0);
      group.metrics.trialRevenue += a ?? 0; group.metrics.orderRevenue += b ?? 0; group.metrics.totalRevenue += revenue;
      group.entered ||= entered;
    }
  }
  const accountRows = [...accounts].filter(([, row]) => row.entered).map(([accountId, row]) => {
    const spendBrands = new Set(brandIdsForLeadAccount(input.brands, accountId, "spend"));
    const spend = input.spendFacts.filter(f => spendBrands.has(f.brandId) && f.spendDate >= input.startDate && f.spendDate <= input.endDate).reduce((sum, f) => sum + f.amount, 0);
    return { accountId, label: row.label, metrics: finish(row.metrics, spend) };
  });
  const included = new Set(accountRows.map(row => row.accountId));
  const brandRows = [...brandGroups.values()].filter(row => included.has(row.accountId) && row.entered).map(row => {
    const allocated = brandIdsForLeadAccount(input.brands, row.accountId, "spend").includes(row.brandId);
    const spend = allocated ? input.spendFacts.filter(f => f.brandId === row.brandId && f.spendDate >= input.startDate && f.spendDate <= input.endDate).reduce((sum, f) => sum + f.amount, 0) : undefined;
    return { accountId: row.accountId, brandId: row.brandId, label: row.label, metrics: finish(row.metrics, spend) };
  });
  const treatmentRows = [...treatments.values()].filter(row => included.has(row.accountId) && row.entered).map(row => ({ accountId: row.accountId, accountLabel: row.accountLabel, brandId: row.brandId, brandLabel: row.brandLabel, label: row.label, metrics: finish(row.metrics) }));
  const totals = empty();
  for (const [id, row] of accounts) if (included.has(id)) {
    for (const field of ["attendedVisits", "orderVisits", "trialRevenue", "orderRevenue", "totalRevenue"] as const) totals[field] += row.metrics[field];
  }
  const allSpendBrands = new Set(accountRows.flatMap(row => brandIdsForLeadAccount(input.brands, row.accountId, "spend")));
  const spend = input.spendFacts.filter(f => allSpendBrands.has(f.brandId) && f.spendDate >= input.startDate && f.spendDate <= input.endDate).reduce((sum, f) => sum + f.amount, 0);
  // A combined paid return is not comparable when any included Account has no
  // allocated paid Spend (for example an organic/KOL Account).
  const comparableSpend = accountRows.every(row => row.metrics.roas !== null) ? spend : undefined;
  return { version: "arrival-revenue-v1", readAt: input.table.readAt, accountRows, brandRows, treatmentRows, totals: finish(totals, comparableSpend) };
}

/** One hierarchy for presentation and text, including old immutable snapshots. */
export function arrivalRevenueDisplayRows(revenue: ReportArrivalRevenue) {
  return revenue.accountRows.flatMap(account => {
    const summary = { summary: true, label: account.label, metrics: account.metrics };
    const brands = revenue.brandRows?.filter(row => row.accountId === account.accountId) ?? [];
    if (brands.length && (account.accountId === "alyssa-aesthetics" || brands.length > 1)) {
      const path = (brand: typeof brands[number]) => brand.label === account.label ? account.label : `${account.label}／${brand.label}`;
      return [{ ...summary, label: `${account.label}（合計）` }, ...brands.flatMap(brand => [
        { summary: true, label: path(brand), metrics: brand.metrics },
        ...revenue.treatmentRows.filter(row => row.accountId === account.accountId && row.brandId === brand.brandId)
          .map(row => ({ summary: false, label: `${path(brand)}／${row.label}`, metrics: row.metrics })),
      ])];
    }
    return [summary, ...revenue.treatmentRows.filter(row => row.accountId === account.accountId)
      .map(row => ({ summary: false, label: `${account.label}／${row.label}`, metrics: row.metrics }))];
  });
}
