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

export type LeadSheetMetricKind =
  | "lead"
  | "book"
  | "show"
  | "no_show"
  | "pending_show";

export type LeadSheetTreatmentAlias = {
  label: string;
  keywords: string[];
  brand?: string | null;
};

export type ParsedLeadSheetMetricFact = {
  brandId: string;
  brandLabel: string;
  metricDate: string;
  metricKind: LeadSheetMetricKind;
  treatmentLabel: string;
  sourceLabel: string;
  campaignLabel: string;
  branchLabel: string;
  count: number;
};

export type LeadSheetPerformanceDiagnostics = {
  sourceRows: number;
  acceptedRows: number;
  unknownBrandRows: number;
  invalidCreatedDateRows: number;
  invalidShowDateRows: number;
  invalidAppointmentDateRows: number;
  uncategorizedTreatmentRows: number;
};

export type ParsedLeadSheetPerformance = {
  dailyMetrics: ParsedLeadFunnelMetric[];
  metricFacts: ParsedLeadSheetMetricFact[];
  diagnostics: LeadSheetPerformanceDiagnostics;
};

export const leadSheetFieldKeys = [
  "createdAt",
  "followStatus",
  "brand",
  "branch",
  "offer",
  "treatment",
  "appointmentDate",
  "confirmationDate",
  "source",
  "campaign",
  "status",
  "showUp",
] as const;

export type LeadSheetFieldKey = (typeof leadSheetFieldKeys)[number];
export type LeadSheetColumnMap = Record<LeadSheetFieldKey, number>;

const BOOKING_STATUSES = new Set(["已預約", "已到店", "no show"]);
const MIN_SUPPORTED_SHEET_DATE = "2000-01-01";
const MAX_SUPPORTED_SHEET_DATE = "2100-12-31";

const LEAD_SHEET_HEADER_ALIASES: Record<LeadSheetFieldKey, string[]> = {
  createdAt: ["Created At", "created_at", "建立時間"],
  followStatus: ["跟進狀態", "Follow-up Status", "Follow Up Status"],
  brand: ["品牌", "Brand"],
  branch: ["分店", "Branch"],
  offer: ["療程 / 優惠", "療程／優惠", "Treatment / Offer"],
  treatment: ["療程項目", "Treatment Item", "Treatment"],
  appointmentDate: ["預約日期", "Appointment Date"],
  confirmationDate: [
    "確認到店日期",
    "Confirmed Show Date",
    "Confirmation Date",
  ],
  source: ["來源", "Source"],
  campaign: ["Campaign / 廣告", "Campaign／廣告", "Campaign / Ad"],
  status: ["Status", "狀態"],
  showUp: ["Show up", "Show Up", "Show-up", "到店"],
};

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function compactString(value: unknown) {
  return stringValue(value)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeComparableText(value: unknown) {
  return compactString(value)
    .toLowerCase()
    .replace(/[／/]+/g, "/")
    .replace(/[\s_-]+/g, " ")
    .trim();
}

function numberValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;
  const parsed = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseGoogleSheetDate(value: unknown) {
  let parsedDate: string | null = null;

  if (typeof value === "number" && Number.isFinite(value)) {
    const day = Math.floor(value);
    if (day < 1) return null;
    const epoch = Date.UTC(1899, 11, 30);
    parsedDate = new Date(epoch + day * 86_400_000)
      .toISOString()
      .slice(0, 10);
  } else if (typeof value === "string") {
    const match = value.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (match) {
      parsedDate = `${match[1]}-${match[2].padStart(
        2,
        "0"
      )}-${match[3].padStart(2, "0")}`;
    }
  }

  if (
    !parsedDate ||
    parsedDate < MIN_SUPPORTED_SHEET_DATE ||
    parsedDate > MAX_SUPPORTED_SHEET_DATE
  ) {
    return null;
  }
  const calendarDate = new Date(`${parsedDate}T00:00:00.000Z`);
  if (
    Number.isNaN(calendarDate.getTime()) ||
    calendarDate.toISOString().slice(0, 10) !== parsedDate
  ) {
    return null;
  }
  return parsedDate;
}

export function normalizeGoogleSheetBrandKey(value: unknown) {
  return normalizeComparableText(value);
}

function normalizeHeader(value: unknown) {
  return normalizeComparableText(value).replace(/\s*\/\s*/g, "/");
}

export function resolveLeadSheetColumns(headers: unknown[]): LeadSheetColumnMap {
  const normalizedHeaders = headers.map(normalizeHeader);
  const resolved = Object.fromEntries(
    leadSheetFieldKeys.map((field) => {
      const aliases = LEAD_SHEET_HEADER_ALIASES[field].map(normalizeHeader);
      return [
        field,
        normalizedHeaders.findIndex((header) => aliases.includes(header)),
      ];
    })
  ) as LeadSheetColumnMap;

  const requiredFields: LeadSheetFieldKey[] = [
    "createdAt",
    "followStatus",
    "brand",
    "appointmentDate",
    "confirmationDate",
  ];
  const missing = requiredFields.filter((field) => resolved[field] < 0);
  if (resolved.treatment < 0 && resolved.offer < 0) {
    missing.push("treatment");
  }
  if (missing.length > 0) {
    const labels = missing.map(
      (field) => LEAD_SHEET_HEADER_ALIASES[field][0]
    );
    throw new Error(`Lead Sheet 缺少必要 header：${labels.join("、")}`);
  }

  return resolved;
}

function automaticBrandAliases(brand: SheetBrandReference) {
  const values = new Set([
    normalizeGoogleSheetBrandKey(brand.name),
    normalizeGoogleSheetBrandKey(brand.slug),
  ]);
  const withoutBeauty = normalizeGoogleSheetBrandKey(brand.name).replace(
    /\s+beauty$/i,
    ""
  );
  if (withoutBeauty) values.add(withoutBeauty);
  return Array.from(values).filter(Boolean);
}

function buildBrandLookup(
  brands: SheetBrandReference[],
  aliases: Record<string, string> = {}
) {
  const lookup = new Map<string, SheetBrandReference>();
  for (const brand of brands) {
    for (const alias of automaticBrandAliases(brand)) {
      lookup.set(alias, brand);
    }
  }
  for (const [alias, target] of Object.entries(aliases)) {
    const targetKey = normalizeGoogleSheetBrandKey(target);
    const brand =
      lookup.get(targetKey) ||
      brands.find(
        (item) =>
          normalizeGoogleSheetBrandKey(item.id) === targetKey ||
          normalizeGoogleSheetBrandKey(item.slug) === targetKey ||
          normalizeGoogleSheetBrandKey(item.name) === targetKey
      );
    if (brand) {
      lookup.set(normalizeGoogleSheetBrandKey(alias), brand);
    }
  }
  return lookup;
}

export function normalizeLeadSheetStatus(input: {
  followStatus: unknown;
  status?: unknown;
  showUp?: unknown;
}) {
  const followStatus = compactString(input.followStatus);
  const joined = [followStatus, input.status, input.showUp]
    .map(normalizeComparableText)
    .filter(Boolean)
    .join(" ");

  if (
    joined.includes("no show") ||
    joined.includes("noshow") ||
    joined.includes("no-show") ||
    joined.includes("未到店")
  ) {
    return "no_show" as const;
  }
  if (
    followStatus === "已到店" ||
    followStatus === "已完成" ||
    joined.includes("已到店") ||
    joined.includes("完成療程") ||
    joined === "show" ||
    joined.endsWith(" show")
  ) {
    return "show" as const;
  }
  if (
    followStatus === "已預約" ||
    joined.includes("已預約") ||
    joined.includes("confirmed") ||
    joined.includes("rescheduled") ||
    joined.includes("requested")
  ) {
    return "booked" as const;
  }
  return "lead" as const;
}

function treatmentLabel(input: {
  treatment: unknown;
  offer: unknown;
  campaign: unknown;
  brand: SheetBrandReference;
  aliases: LeadSheetTreatmentAlias[];
}) {
  const treatment = compactString(input.treatment);
  const offer = compactString(input.offer);
  const campaign = compactString(input.campaign);
  const haystack = normalizeComparableText(
    [treatment, offer, campaign].filter(Boolean).join(" ")
  );
  const brandKeys = new Set(automaticBrandAliases(input.brand));
  const matched = input.aliases.find((rule) => {
    if (rule.brand) {
      const ruleBrand = normalizeGoogleSheetBrandKey(rule.brand);
      if (!brandKeys.has(ruleBrand)) return false;
    }
    return rule.keywords.some((keyword) => {
      const normalized = normalizeComparableText(keyword);
      return Boolean(normalized && haystack.includes(normalized));
    });
  });
  if (matched?.label) return compactString(matched.label).slice(0, 160);

  const fallback = treatment || offer;
  return fallback ? fallback.slice(0, 160) : "未分類療程";
}

function defaultDimensionLabel(value: unknown, fallback: string) {
  return compactString(value).slice(0, 180) || fallback;
}

export function aggregateLeadSheetPerformance(input: {
  headers: unknown[];
  rows: unknown[][];
  brands: SheetBrandReference[];
  sourceBrandId: string | null;
  brandAliases?: Record<string, string>;
  treatmentAliases?: LeadSheetTreatmentAlias[];
  dailyThroughDate: string;
  activityThroughDate: string;
  pendingThroughDate: string;
}): ParsedLeadSheetPerformance {
  const columns = resolveLeadSheetColumns(input.headers);
  const brandLookup = buildBrandLookup(input.brands, input.brandAliases);
  const sourceBrand = input.sourceBrandId
    ? input.brands.find((brand) => brand.id === input.sourceBrandId) ?? null
    : null;
  const dailyMetrics = new Map<string, ParsedLeadFunnelMetric>();
  const metricFacts = new Map<string, ParsedLeadSheetMetricFact>();
  const diagnostics: LeadSheetPerformanceDiagnostics = {
    sourceRows: 0,
    acceptedRows: 0,
    unknownBrandRows: 0,
    invalidCreatedDateRows: 0,
    invalidShowDateRows: 0,
    invalidAppointmentDateRows: 0,
    uncategorizedTreatmentRows: 0,
  };

  const getDailyMetric = (brandId: string, date: string) => {
    const key = `${brandId}:${date}`;
    const existing = dailyMetrics.get(key);
    if (existing) return existing;
    const metric = {
      brandId,
      date,
      leads: 0,
      bookings: 0,
      shows: 0,
    };
    dailyMetrics.set(key, metric);
    return metric;
  };

  const valueAt = (
    row: unknown[],
    field: LeadSheetFieldKey
  ): unknown => {
    const index = columns[field];
    return index >= 0 ? row[index] : "";
  };

  const addFact = (
    fact: Omit<ParsedLeadSheetMetricFact, "count">
  ) => {
    const key = JSON.stringify([
      fact.brandId,
      fact.metricDate,
      fact.metricKind,
      fact.treatmentLabel,
      fact.sourceLabel,
      fact.campaignLabel,
      fact.branchLabel,
    ]);
    const existing = metricFacts.get(key);
    if (existing) {
      existing.count += 1;
      return;
    }
    metricFacts.set(key, { ...fact, count: 1 });
  };

  for (const row of input.rows) {
    const selectedValues = leadSheetFieldKeys.map((field) =>
      valueAt(row, field)
    );
    if (!selectedValues.some((value) => compactString(value))) continue;
    diagnostics.sourceRows += 1;

    const brand =
      sourceBrand ||
      brandLookup.get(
        normalizeGoogleSheetBrandKey(valueAt(row, "brand"))
      );
    if (!brand) {
      diagnostics.unknownBrandRows += 1;
      continue;
    }
    diagnostics.acceptedRows += 1;

    const canonicalTreatment = treatmentLabel({
      treatment: valueAt(row, "treatment"),
      offer: valueAt(row, "offer"),
      campaign: valueAt(row, "campaign"),
      brand,
      aliases: input.treatmentAliases ?? [],
    });
    if (canonicalTreatment === "未分類療程") {
      diagnostics.uncategorizedTreatmentRows += 1;
    }

    const dimensions = {
      brandId: brand.id,
      brandLabel: brand.name,
      treatmentLabel: canonicalTreatment,
      sourceLabel: defaultDimensionLabel(
        valueAt(row, "source"),
        "未標記來源"
      ),
      campaignLabel: defaultDimensionLabel(
        valueAt(row, "campaign"),
        "未標記 Campaign"
      ),
      branchLabel: defaultDimensionLabel(
        valueAt(row, "branch"),
        "未標記分店"
      ),
    };
    const normalizedStatus = normalizeLeadSheetStatus({
      followStatus: valueAt(row, "followStatus"),
      status: valueAt(row, "status"),
      showUp: valueAt(row, "showUp"),
    });
    const isBook = ["booked", "show", "no_show"].includes(normalizedStatus);
    const createdDate = parseGoogleSheetDate(valueAt(row, "createdAt"));

    if (!createdDate) {
      diagnostics.invalidCreatedDateRows += 1;
    } else {
      if (createdDate <= input.dailyThroughDate) {
        const daily = getDailyMetric(brand.id, createdDate);
        daily.leads += 1;
        if (isBook) daily.bookings += 1;
      }
      if (createdDate <= input.activityThroughDate) {
        addFact({
          ...dimensions,
          metricDate: createdDate,
          metricKind: "lead",
        });
        if (isBook) {
          addFact({
            ...dimensions,
            metricDate: createdDate,
            metricKind: "book",
          });
        }
      }
    }

    if (normalizedStatus === "show") {
      const showDate = parseGoogleSheetDate(
        valueAt(row, "confirmationDate")
      );
      if (!showDate) {
        diagnostics.invalidShowDateRows += 1;
      } else {
        if (showDate <= input.dailyThroughDate) {
          getDailyMetric(brand.id, showDate).shows += 1;
        }
        if (showDate <= input.activityThroughDate) {
          addFact({
            ...dimensions,
            metricDate: showDate,
            metricKind: "show",
          });
        }
      }
    }

    if (normalizedStatus === "no_show" || normalizedStatus === "booked") {
      const appointmentDate = parseGoogleSheetDate(
        valueAt(row, "appointmentDate")
      );
      if (!appointmentDate) {
        diagnostics.invalidAppointmentDateRows += 1;
      } else if (
        normalizedStatus === "no_show" &&
        appointmentDate <= input.activityThroughDate
      ) {
        addFact({
          ...dimensions,
          metricDate: appointmentDate,
          metricKind: "no_show",
        });
      } else if (
        normalizedStatus === "booked" &&
        appointmentDate <= input.pendingThroughDate
      ) {
        addFact({
          ...dimensions,
          metricDate: appointmentDate,
          metricKind: "pending_show",
        });
      }
    }
  }

  return {
    dailyMetrics: Array.from(dailyMetrics.values()),
    metricFacts: Array.from(metricFacts.values()),
    diagnostics,
  };
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
