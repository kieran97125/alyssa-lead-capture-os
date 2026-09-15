export type LeadFunnelEventType = "lead" | "book" | "show" | "no_show";

export type LeadFunnelEventLedgerTable = {
  headers: unknown[];
  rows: unknown[][];
};

type BrandReference = { id: string; name: string; slug: string };

type LedgerAwareLeadGroup = {
  key: string;
  brandId: string;
  currentStatus: "lead" | "booked" | "show" | "no_show";
  currentRowNumber: number;
  bookDate: string | null;
  bookDateSource: "last_updated" | "legacy_created_at" | "event_ledger" | null;
  showDate: string | null;
  noShowDate: string | null;
  pendingRowNumber: number | null;
  usesEventLedger: boolean;
};

const EVENT_HEADER_ALIASES = {
  eventId: ["event id", "event_id"],
  eventAt: ["event at", "event_at"],
  eventDate: ["event date", "event_date"],
  eventType: ["event type", "event_type"],
  leadKey: ["lead_key", "lead key", "leadkey"],
  brand: ["brand", "品牌"],
  phoneLast8: ["phone last8", "phone_last8", "電話尾8位"],
  sourceRow: ["source row", "source_row", "來源行"],
} as const;

function compactString(value: unknown) {
  return typeof value === "string"
    ? value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim()
    : value === null || value === undefined ? "" : String(value).trim();
}

function normalizeComparable(value: unknown) {
  return compactString(value).toLowerCase().replace(/[／/]+/g, "/")
    .replace(/[\s_-]+/g, " ").trim();
}

function normalizeHeader(value: unknown) {
  return normalizeComparable(value).replace(/\s*\/\s*/g, "/");
}

function supportedDate(value: string) {
  return value >= "2000-01-01" && value <= "2100-12-31";
}

function parseSheetDate(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const day = Math.floor(value);
    // Check range before calling toISOString: an enormous finite serial throws.
    if (day < 36526 || day > 73415) return null;
    const parsed = new Date(Date.UTC(1899, 11, 30) + day * 86_400_000);
    const date = parsed.toISOString().slice(0, 10);
    return supportedDate(date) ? date : null;
  }
  const raw = compactString(value);
  // Explicit timezone-bearing instants belong to the HKT calendar day, not UTC.
  if (/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw)) {
    const localDay = raw.slice(0, 10);
    const calendarCheck = new Date(`${localDay}T00:00:00.000Z`);
    if (Number.isNaN(calendarCheck.getTime()) ||
        calendarCheck.toISOString().slice(0, 10) !== localDay) return null;
    const instant = new Date(raw);
    if (Number.isNaN(instant.getTime())) return null;
    const hkt = new Date(instant.getTime() + 8 * 60 * 60 * 1000);
    if (Number.isNaN(hkt.getTime())) return null;
    const date = hkt.toISOString().slice(0, 10);
    return supportedDate(date) ? date : null;
  }
  const match = raw.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:$|\s|T)/);
  if (!match) return null;
  const date = `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  if (!supportedDate(date)) return null;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
    ? date : null;
}

function phoneIdentity(value: unknown) {
  const digits = compactString(value).replace(/\D/g, "");
  return digits.length >= 8 ? digits.slice(-8) : "";
}

function normalizeEventType(value: unknown): LeadFunnelEventType | null {
  const normalized = normalizeComparable(value);
  if (["lead", "new lead"].includes(normalized)) return "lead";
  if (["book", "booked", "已預約"].includes(normalized)) return "book";
  if (["show", "show up", "completed", "已到店", "已完成"].includes(normalized)) return "show";
  if (["no show", "noshow", "未到店"].includes(normalized)) return "no_show";
  // Operational status_change audit rows intentionally do not create KPI events.
  return null;
}

function buildBrandLookup(brands: BrandReference[], aliases: Record<string, string> = {}) {
  const lookup = new Map<string, BrandReference>();
  for (const brand of brands) {
    const name = normalizeComparable(brand.name);
    const slug = normalizeComparable(brand.slug);
    if (name) lookup.set(name, brand);
    if (slug) lookup.set(slug, brand);
    const withoutBeauty = name.replace(/\s+beauty$/i, "");
    if (withoutBeauty) lookup.set(withoutBeauty, brand);
  }
  for (const [alias, target] of Object.entries(aliases)) {
    const targetKey = normalizeComparable(target);
    const brand = lookup.get(targetKey) || brands.find((item) =>
      normalizeComparable(item.id) === targetKey ||
      normalizeComparable(item.name) === targetKey ||
      normalizeComparable(item.slug) === targetKey);
    if (brand) lookup.set(normalizeComparable(alias), brand);
  }
  return lookup;
}

function resolveColumn(headers: unknown[], aliases: readonly string[]) {
  const accepted = aliases.map(normalizeHeader);
  const matches = headers.flatMap((header, index) =>
    accepted.includes(normalizeHeader(header)) ? [index] : []);
  if (matches.length > 1) {
    throw new Error(`Lead Funnel Event Ledger 有重複欄位：${aliases[0]}。已停止計算，避免歷史事件錯配。`);
  }
  return matches[0] ?? -1;
}

function earliestDate(values: string[]) {
  return values.length > 0 ? [...values].sort()[0] : null;
}

/**
 * Applies the immutable `_funnel_events` ledger to Book / Show / No Show dates. An empty legacy ledger
 * stays compatible, but a populated ledger with a broken schema must never
 * silently revert to current-state dates. Incomplete identity rows are ignored.
 */
export function applyLeadFunnelEventLedger<T extends LedgerAwareLeadGroup>(input: {
  groups: T[];
  eventLedger?: LeadFunnelEventLedgerTable | null;
  brands: BrandReference[];
  brandAliases?: Record<string, string>;
}): T[] {
  const ledger = input.eventLedger;
  if (!ledger || ledger.rows.length === 0) return input.groups;

  const columns = {
    eventId: resolveColumn(ledger.headers, EVENT_HEADER_ALIASES.eventId),
    eventType: resolveColumn(ledger.headers, EVENT_HEADER_ALIASES.eventType),
    brand: resolveColumn(ledger.headers, EVENT_HEADER_ALIASES.brand),
    eventDate: resolveColumn(ledger.headers, EVENT_HEADER_ALIASES.eventDate),
    eventAt: resolveColumn(ledger.headers, EVENT_HEADER_ALIASES.eventAt),
    leadKey: resolveColumn(ledger.headers, EVENT_HEADER_ALIASES.leadKey),
    phone: resolveColumn(ledger.headers, EVENT_HEADER_ALIASES.phoneLast8),
    sourceRow: resolveColumn(ledger.headers, EVENT_HEADER_ALIASES.sourceRow),
  };
  if (columns.eventType < 0 || columns.brand < 0 ||
      (columns.eventDate < 0 && columns.eventAt < 0) ||
      (columns.leadKey < 0 && columns.phone < 0 && columns.sourceRow < 0)) {
    throw new Error("Lead Funnel Event Ledger 欄位不完整。已停止計算，唔會退回舊日期口徑。");
  }

  const brandLookup = buildBrandLookup(input.brands, input.brandAliases);
  const eventsByGroup = new Map<string, Array<{ type: LeadFunnelEventType; date: string }>>();
  const eventFingerprints = new Map<string, string>();

  for (const row of ledger.rows) {
    const type = normalizeEventType(row[columns.eventType]);
    const brand = brandLookup.get(normalizeComparable(row[columns.brand]));
    const date = (columns.eventDate >= 0 ? parseSheetDate(row[columns.eventDate]) : null) ||
      (columns.eventAt >= 0 ? parseSheetDate(row[columns.eventAt]) : null);
    if (!type || !brand || !date) continue;

    const phone = columns.phone >= 0 ? phoneIdentity(row[columns.phone]) : "";
    const leadKey = columns.leadKey >= 0 ? compactString(row[columns.leadKey]) : "";
    const sourceRow = columns.sourceRow >= 0 ? Number(compactString(row[columns.sourceRow])) : NaN;
    const identity = phone ? `phone:${phone}` : leadKey ? `lead:${leadKey}` :
      Number.isInteger(sourceRow) && sourceRow >= 2 ? `row:${sourceRow}` : "";
    if (!identity) continue;

    const key = `${brand.id}|${identity}`;
    const eventId = columns.eventId >= 0 ? compactString(row[columns.eventId]) : "";
    if (eventId) {
      const fingerprint = JSON.stringify([key, type, date]);
      const previous = eventFingerprints.get(eventId);
      if (previous && previous !== fingerprint) {
        // Do not include private Lead identities in an operator-facing error.
        throw new Error("Lead Funnel Event Ledger 同一 Event ID 有矛盾內容。請先核對事件紀錄；歷史日期未被覆寫。");
      }
      if (previous) continue;
      eventFingerprints.set(eventId, fingerprint);
    }
    const existing = eventsByGroup.get(key);
    const event = { type, date };
    if (existing) existing.push(event);
    else eventsByGroup.set(key, [event]);
  }

  return input.groups.map((group) => {
    const events = eventsByGroup.get(group.key) ?? [];
    if (events.length === 0) return group;
    const datesFor = (type: LeadFunnelEventType) =>
      events.filter((event) => event.type === type).map((event) => event.date);
    const bookDate = earliestDate(datesFor("book"));
    return {
      ...group,
      usesEventLedger: true,
      bookDate,
      bookDateSource: bookDate ? ("event_ledger" as const) : null,
      showDate: earliestDate(datesFor("show")),
      noShowDate: earliestDate(datesFor("no_show")),
      pendingRowNumber: group.currentStatus === "booked" ? group.currentRowNumber : null,
    };
  });
}
