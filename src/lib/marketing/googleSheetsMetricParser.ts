export type SheetBrandReference = {
  id: string;
  name: string;
  slug: string;
};

export type ParsedDailySpendMetric = {
  brandId: string;
  date: string;
  spend: number;
};

export type ParsedLeadFunnelMetric = {
  brandId: string;
  date: string;
  leads: number;
  bookings: number;
  shows: number;
};

const BOOKING_STATUSES = new Set(["已預約", "已到店", "no show"]);

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;
  const parsed = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseGoogleSheetDate(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const day = Math.floor(value);
    if (day < 1) return null;
    const epoch = Date.UTC(1899, 11, 30);
    return new Date(epoch + day * 86_400_000).toISOString().slice(0, 10);
  }
  if (typeof value !== "string") return null;
  const match = value.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (!match) return null;
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(
    2,
    "0"
  )}`;
}

export function normalizeGoogleSheetBrandKey(value: unknown) {
  return stringValue(value)
    .toLowerCase()
    .replace(/[\s_-]+/g, " ")
    .trim();
}

export function aggregateDailySpendRows(input: {
  rows: unknown[][];
  brandId: string;
  throughDate: string;
  dateIndex: number;
  spendIndex: number;
}) {
  const metrics = new Map<string, ParsedDailySpendMetric>();
  for (const row of input.rows) {
    const date = parseGoogleSheetDate(row[input.dateIndex]);
    if (!date || date > input.throughDate) continue;
    metrics.set(date, {
      brandId: input.brandId,
      date,
      spend: Math.max(0, numberValue(row[input.spendIndex])),
    });
  }
  return Array.from(metrics.values());
}

export function aggregateLeadFunnelColumns(input: {
  createdAtValues: unknown[][];
  followStatusValues: unknown[][];
  brandValues: unknown[][];
  confirmationDateValues: unknown[][];
  brands: SheetBrandReference[];
  sourceBrandId: string | null;
  throughDate: string;
}) {
  const brandLookup = new Map<string, SheetBrandReference>();
  for (const brand of input.brands) {
    brandLookup.set(normalizeGoogleSheetBrandKey(brand.name), brand);
    brandLookup.set(normalizeGoogleSheetBrandKey(brand.slug), brand);
  }
  const rowCount = Math.max(
    input.createdAtValues.length,
    input.followStatusValues.length,
    input.brandValues.length,
    input.confirmationDateValues.length
  );
  const metrics = new Map<string, ParsedLeadFunnelMetric>();
  const getMetric = (brandId: string, date: string) => {
    const key = `${brandId}:${date}`;
    const existing = metrics.get(key);
    if (existing) return existing;
    const metric = {
      brandId,
      date,
      leads: 0,
      bookings: 0,
      shows: 0,
    };
    metrics.set(key, metric);
    return metric;
  };

  for (let index = 0; index < rowCount; index += 1) {
    const followStatus = stringValue(input.followStatusValues[index]?.[0]);
    const brand = input.sourceBrandId
      ? input.brands.find((item) => item.id === input.sourceBrandId)
      : brandLookup.get(
          normalizeGoogleSheetBrandKey(input.brandValues[index]?.[0])
        );
    if (!brand) continue;

    const createdDate = parseGoogleSheetDate(
      input.createdAtValues[index]?.[0]
    );
    if (createdDate && createdDate <= input.throughDate) {
      const createdMetric = getMetric(brand.id, createdDate);
      createdMetric.leads += 1;
      if (BOOKING_STATUSES.has(followStatus)) {
        createdMetric.bookings += 1;
      }
    }

    const showDate = parseGoogleSheetDate(
      input.confirmationDateValues[index]?.[0]
    );
    if (
      followStatus === "已到店" &&
      showDate &&
      showDate <= input.throughDate
    ) {
      getMetric(brand.id, showDate).shows += 1;
    }
  }

  return Array.from(metrics.values());
}
