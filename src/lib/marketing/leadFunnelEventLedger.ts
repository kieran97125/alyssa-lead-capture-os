export type LeadFunnelEventType = "lead" | "book" | "show" | "no_show";

export type LeadFunnelEventLedgerTable = {
  headers: unknown[];
  rows: unknown[][];
};

type BrandReference = {
  id: string;
  name: string;
  slug: string;
};

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
    : value === null || value === undefined
      ? ""
      : String(value).trim();
}

function normalizeComparable(value: unknown) {
  return compactString(value)
    .toLowerCase()
    .replace(/[／/]+/g, "/")
    .replace(/[\s_-]+/g, " ")
    .trim();
}

function normalizeHeader(value: unknown) {
  return normalizeComparable(value).replace(/\s*\/\s*/g, "/");
}

function parseSheetDate(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const day = Math.floor(value);
    if (day < 1) return null;
    const date = new Date(Date.UTC(1899, 11, 30) + day * 86_400_000)
      .toISOString()
      .slice(0, 10);
    return date >= "2000-01-01" && date <= "2100-12-31" ? date : null;
  }
  const raw = compactString(value);
  const match = raw.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (!match) return null;
  const date = `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
    ? date
    : null;
}

function phoneIdentity(value: unknown) {
  const digits = compactString(value).replace(/\D/g, "");
  return digits.length >= 8 ? digits.slice(-8) : "";
}

function normalizeEventType(value: unknown): LeadFunnelEventType | null {
  const normalized = normalizeComparable(value);
  if (["lead", "new lead"].includes(normalized)) return "lead";
  if (["book", "booked", "已預約"].includes(normalized)) return "book";
  if (["show", "show up", "completed", "已到店", "已完成"].includes(normalized)) {
    return "show";
  }
  if (["no show", "noshow", "no-show", "未到店"].includes(normalized)) {
    return "no_show";
  }
  return null;
}

function buildBrandLookup(
  brands: BrandReference[],
  aliases: Record<string, string> = {}
) {
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
    const brand =
      lookup.get(targetKey) ||
      brands.find(
        (item) =>
          normalizeComparable(item.id) === targetKey ||
          normalizeComparable(item.name) === targetKey ||
          normalizeComparable(item.slug) === targetKey
      );
    if (brand) lookup.set(normalizeComparable(alias), brand);
  }
  return lookup;
}

function resolveColumn(headers: unknown[], aliases: readonly string[]) {
  const normalized = headers.map(normalizeHeader);
  return normalized.findIndex((header) => aliases.includes(header));
}

function earliestDate(values: string[]) {
  return values.length > 0 ? [...values].sort()[0] : null;
}

/**
 * Applies the immutable `_funnel_events` ledger to already-deduplicated Lead
 * groups. Presence of any valid event for a Lead marks that Lead as ledger-
 * governed: Book / Show / No Show dates then come only from the ledger and are
 * never reconstructed from the current status row. This prevents a later Show
 * status from moving or deleting the earlier Book event.
 */
export function applyLeadFunnelEventLedger<T extends LedgerAwareLeadGroup>(input: {
  groups: T[];
  eventLedger?: LeadFunnelEventLedgerTable | null;
  brands: BrandReference[];
  brandAliases?: Record<string, string>;
}): T[] {
  const ledger = input.eventLedger;
  if (!ledger || ledger.rows.length === 0 || ledger.headers.length === 0) {
    return input.groups;
  }

  const eventTypeColumn = resolveColumn(
    ledger.headers,
    EVENT_HEADER_ALIASES.eventType
  );
  const brandColumn = resolveColumn(ledger.headers, EVENT_HEADER_ALIASES.brand);
  const eventDateColumn = resolveColumn(
    ledger.headers,
    EVENT_HEADER_ALIASES.eventDate
  );
  const eventAtColumn = resolveColumn(ledger.headers, EVENT_HEADER_ALIASES.eventAt);
  const leadKeyColumn = resolveColumn(ledger.headers, EVENT_HEADER_ALIASES.leadKey);
  const phoneColumn = resolveColumn(
    ledger.headers,
    EVENT_HEADER_ALIASES.phoneLast8
  );
  const sourceRowColumn = resolveColumn(
    ledger.headers,
    EVENT_HEADER_ALIASES.sourceRow
  );

  if (eventTypeColumn < 0 || brandColumn < 0) return input.groups;

  const brandLookup = buildBrandLookup(input.brands, input.brandAliases);
  const eventsByGroup = new Map<
    string,
    Array<{ type: LeadFunnelEventType; date: string }>
  >();

  for (const row of ledger.rows) {
    const type = normalizeEventType(row[eventTypeColumn]);
    const brand = brandLookup.get(normalizeComparable(row[brandColumn]));
    const date =
      (eventDateColumn >= 0 ? parseSheetDate(row[eventDateColumn]) : null) ||
      (eventAtColumn >= 0 ? parseSheetDate(row[eventAtColumn]) : null);
    if (!type || !brand || !date) continue;

    const phone = phoneColumn >= 0 ? phoneIdentity(row[phoneColumn]) : "";
    const leadKey = leadKeyColumn >= 0 ? compactString(row[leadKeyColumn]) : "";
    const sourceRow =
      sourceRowColumn >= 0 ? Number.parseInt(compactString(row[sourceRowColumn]), 10) : NaN;
    const identity = phone
      ? `phone:${phone}`
      : leadKey
        ? `lead:${leadKey}`
        : Number.isInteger(sourceRow) && sourceRow >= 2
          ? `row:${sourceRow}`
          : "";
    if (!identity) continue;

    const key = `${brand.id}|${identity}`;
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
    const showDate = earliestDate(datesFor("show"));
    const noShowDate = earliestDate(datesFor("no_show"));

    return {
      ...group,
      usesEventLedger: true,
      bookDate,
      bookDateSource: bookDate ? ("event_ledger" as const) : null,
      showDate,
      noShowDate,
      pendingRowNumber:
        group.currentStatus === "booked" ? group.currentRowNumber : null,
    };
  });
}
