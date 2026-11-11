import type { ReportKolPerformance, ReportKolRow, ReportMainPerformance, ReportMainRow, ReportSnapshot } from "@/lib/reports/types";

export const KOL_EVENT_HEADERS = ["Account", "KOL", "療程", "優惠名稱", "Metric Date", "Metric Kind", "Metric Count", "Revenue", "Inquiry Key", "Source Order"] as const;
export type ReportKolEventTable = { headers: unknown[]; rows: unknown[][]; readAt: string };
type PerformanceInput = { table: ReportKolEventTable; startDate: string; endDate: string };
type Event = { account: string; person: string; treatment: string; offer: string; date: string; kind: string; count: number; revenue: number; order: number };
export const MAIN_REPORT_SEGMENTS = ["Alyssa Main", "Alyssa Main Medical", "Alyssa Main Organic"] as const;
const clean = (value: unknown) => String(value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const isKolAccount = (value: string): value is ReportKolRow["accountLabel"] => value === "Alyssa Main" || value === "Alyssa Main Medical";

export function includesMainKolReport(accountIds: string[] | null | undefined, canAccessMain: boolean) {
  return canAccessMain && (accountIds == null || accountIds.includes("alyssa-main"));
}

/** Render only the Main section explicitly included in this immutable snapshot. */
export function selectedKolPerformance(snapshot: ReportSnapshot) {
  return snapshot.selection.accountIds && !snapshot.selection.accountIds.includes("alyssa-main")
    ? undefined : snapshot.kolPerformance;
}
export function selectedMainPerformance(snapshot: ReportSnapshot) {
  return snapshot.selection.accountIds && !snapshot.selection.accountIds.includes("alyssa-main")
    ? undefined : snapshot.mainPerformance;
}

/** The adjacent KOL column already names the person. Keep the actual offer
 * wording; remove only its repeated introduction, never the source snapshot.
 */
export function kolOfferLabels(row: Pick<ReportKolRow, "kol" | "offers">) {
  const person = row.kol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const introduction = new RegExp(`^(?:查詢|了解)?\\s*${person}(?=\\s|分享|推介|做|專屬|\\$|[0-9])\\s*(?:(?:分享|推介)(?:嘅|的)?|做(?:嘅|的))?\\s*`, "i");
  return [...new Set(row.offers.map(offer => offer.replace(introduction, "").trim() || offer))];
}

function metricDate(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 36526 && value <= 73415) {
    return new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000).toISOString().slice(0, 10);
  }
  const text = clean(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text) && new Date(`${text}T00:00:00Z`).toISOString().slice(0, 10) === text) return text;
  throw new Error("KOL 成效日期無效。");
}
function numeric(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("KOL 成效數字未完整。");
  return value;
}

/** The evaluated Sheet projection owns attribution and stage dates. Date range
 * filtering and inquiry deduplication happen locally, without changing shared
 * Dashboard controls. No source ordinal or individual event is persisted.
 */
function selectedEvents(input: PerformanceInput): Event[] {
  const headers = input.table.headers.map(clean);
  const indices = KOL_EVENT_HEADERS.map(header => {
    if (headers.filter(value => value === header).length !== 1) throw new Error("KOL 成效欄位缺少或重複。");
    return headers.indexOf(header);
  });
  const latestQueries = new Map<number, Event>();
  const events: Event[] = [];
  for (const raw of input.table.rows) {
    if (raw.every(value => value === "" || value == null)) continue;
    const values = indices.map(index => raw[index]);
    if (values.some(value => typeof value === "string" && value.startsWith("#"))) throw new Error("KOL 成效來源未完成計算。");
    const [account, person, treatment, offer] = values.slice(0, 4).map(clean);
    const kind = clean(values[5]), count = numeric(values[6]), revenue = numeric(values[7]);
    const inquiry = numeric(values[8]), order = numeric(values[9]);
    if (!person || !treatment || (!offer && account !== "Alyssa Main Organic") || !["lead", "book", "show", "no_show", "revenue", "inquiry"].includes(kind) ||
      !MAIN_REPORT_SEGMENTS.some(segment => segment === account) ||
      count < 0 || !Number.isSafeInteger(count) || inquiry < 0 || !Number.isSafeInteger(inquiry) || order < 0 || !Number.isSafeInteger(order) ||
      (kind !== "revenue" && revenue !== 0) || (kind === "revenue" && count !== 0) || (kind === "inquiry" && (!inquiry || !order || count !== 1))) {
      throw new Error("KOL 成效資料未完整。");
    }
    const date = metricDate(values[4]);
    if (date < input.startDate || date > input.endDate) continue;
    const event = { account, person, treatment, offer, date, kind, count, revenue, order };
    if (kind === "inquiry") {
      const previous = latestQueries.get(inquiry);
      if (!previous || date > previous.date || date === previous.date && order > previous.order) latestQueries.set(inquiry, event);
    } else if (count > 0 || Math.abs(revenue) > 0) events.push(event);
  }
  events.push(...latestQueries.values());
  return events;
}

function aggregateKolPerformance(input: PerformanceInput, events: Event[]): ReportKolPerformance {
  const groups = new Map<string, { row: ReportKolRow; inquiries: number; treatments: Set<string>; offers: Set<string> }>();
  for (const event of events) {
    if (!isKolAccount(event.account)) continue;
    const key = JSON.stringify([event.account, event.person]);
    let group = groups.get(key);
    if (!group) {
      group = { row: { accountLabel: event.account, kol: event.person, treatments: [], offers: [], leads: 0, bookings: 0, shows: 0, noShows: 0, bookRate: null, showUpRate: null, revenue: 0 }, inquiries: 0, treatments: new Set(), offers: new Set() };
      groups.set(key, group);
    }
    const metric = ({ lead: "leads", book: "bookings", show: "shows", no_show: "noShows" } as const)[event.kind as "lead" | "book" | "show" | "no_show"];
    if (metric) group.row[metric] += event.count;
    if (event.kind === "revenue") group.row.revenue += event.revenue;
    if (event.kind === "inquiry") group.inquiries += event.count;
    group.treatments.add(event.treatment); group.offers.add(event.offer);
  }
  const rows = [...groups.values()].sort((a, b) => a.row.accountLabel.localeCompare(b.row.accountLabel) || b.row.leads - a.row.leads || b.inquiries - a.inquiries || a.row.kol.localeCompare(b.row.kol));
  return { version: "lead-sheet-kol-v1", readAt: input.table.readAt, startDate: input.startDate, endDate: input.endDate, rows: rows.map(group => ({
    ...group.row, treatments: [...group.treatments].sort((a, b) => a.localeCompare(b, "zh-TW")), offers: [...group.offers].sort((a, b) => a.localeCompare(b, "zh-TW")),
    bookRate: group.row.leads ? group.row.bookings / group.row.leads : null,
    showUpRate: group.row.bookings ? group.row.shows / group.row.bookings : null,
    revenue: Math.round((group.row.revenue + Number.EPSILON) * 100) / 100,
  })) };
}

export function buildKolPerformance(input: PerformanceInput) {
  return aggregateKolPerformance(input, selectedEvents(input));
}

/** Three mutually exclusive segments retain source-owned dates and sum to the
 * selected Main account, with rates recalculated from each segment's counts.
 */
export function buildMainReportPerformance(input: PerformanceInput): { kolPerformance: ReportKolPerformance; mainPerformance: ReportMainPerformance } {
  const events = selectedEvents(input);
  const rows: ReportMainRow[] = MAIN_REPORT_SEGMENTS.map(accountLabel => ({ accountLabel, leads: 0, bookings: 0, shows: 0, noShows: 0, bookRate: null, showUpRate: null, leadToShowRate: null, revenue: 0 }));
  for (const event of events) {
    const row = rows.find(row => row.accountLabel === event.account)!;
    const metric = ({ lead: "leads", book: "bookings", show: "shows", no_show: "noShows" } as const)[event.kind as "lead" | "book" | "show" | "no_show"];
    if (metric) row[metric] += event.count;
    if (event.kind === "revenue") row.revenue += event.revenue;
  }
  rows.forEach(row => {
    row.bookRate = row.leads ? row.bookings / row.leads : null;
    row.showUpRate = row.bookings ? row.shows / row.bookings : null;
    row.leadToShowRate = row.leads ? row.shows / row.leads : null;
    row.revenue = Math.round((row.revenue + Number.EPSILON) * 100) / 100;
  });
  return {
    kolPerformance: aggregateKolPerformance(input, events),
    mainPerformance: { version: "lead-sheet-main-segments-v1", readAt: input.table.readAt, startDate: input.startDate, endDate: input.endDate, rows },
  };
}
