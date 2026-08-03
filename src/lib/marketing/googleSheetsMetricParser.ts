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

export type LeadSheetStatus = "lead" | "booked" | "show" | "no_show";

export type LeadSheetGroupRow = {
  rowNumber: number;
  createdAt: unknown;
  createdDate: string | null;
  status: LeadSheetStatus;
  appointmentDate: string | null;
  appointmentTime: string;
  confirmationDate: string | null;
  branchLabel: string;
  csRemark: string;
};

export type LeadSheetLeadGroup = {
  key: string;
  brandId: string;
  brandLabel: string;
  treatmentLabel: string;
  sourceLabel: string;
  campaignLabel: string;
  branchLabel: string;
  firstTouchDate: string | null;
  rows: LeadSheetGroupRow[];
};

export type ParsedLeadSheetGroups = {
  groups: LeadSheetLeadGroup[];
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
  "appointmentTime",
  "confirmationDate",
  "source",
  "campaign",
  "status",
  "showUp",
  "phone",
  "leadKey",
  "csRemark",
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
  appointmentTime: ["預約時間", "Appointment Time"],
  confirmationDate: [
    "確認到店日期",
    "Confirmed Show Date",
    "Confirmation Date",
  ],
  source: ["來源", "Source"],
  campaign: ["Campaign / 廣告", "Campaign／廣告", "Campaign / Ad"],
  status: ["Status", "狀態"],
  showUp: ["Show up", "Show Up", "Show-up", "到店"],
  phone: ["電話", "Tel No.", "Phone", "phone_number", "Tel"],
  leadKey: ["lead_key", "Lead Key", "leadKey"],
  csRemark: ["CS Remark", "Follow Up Remark", "Follow-up Remark", "備註"],
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

function normalizeAppsScriptLeadSheetStatus(input: {
  followStatus: unknown;
  status?: unknown;
  showUp?: unknown;
}) {
  const followStatus = compactString(input.followStatus);
  const joined = [followStatus, input.showUp, input.status]
    .map(compactString)
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    joined.includes("no show") ||
    joined.includes("noshow") ||
    joined.includes("no-show")
  ) {
    return "no_show" as const;
  }
  if (
    followStatus === "已到店" ||
    followStatus === "已完成" ||
    joined.includes("已到店") ||
    joined.includes("完成療程")
  ) {
    return "show" as const;
  }
  if (followStatus === "已預約") return "booked" as const;
  return "lead" as const;
}

function matchingTreatmentAlias(input: {
  treatment: unknown;
  offer: unknown;
  campaign: unknown;
  aliases: LeadSheetTreatmentAlias[];
}) {
  const treatment = compactString(input.treatment);
  const offer = compactString(input.offer);
  const campaign = compactString(input.campaign);
  const haystack = normalizeComparableText(
    [treatment, offer, campaign].filter(Boolean).join(" ")
  );
  return input.aliases.find((rule) =>
    rule.keywords.some((keyword) => {
      const normalized = normalizeComparableText(keyword);
      return Boolean(normalized && haystack.includes(normalized));
    })
  );
}

function treatmentLabel(input: {
  treatment: unknown;
  offer: unknown;
  matchedAlias: LeadSheetTreatmentAlias | undefined;
  fallbackLabel?: string;
}) {
  const treatment = compactString(input.treatment);
  const offer = compactString(input.offer);
  if (input.matchedAlias?.label) {
    return compactString(input.matchedAlias.label).slice(0, 160);
  }

  const fallback = input.fallbackLabel || treatment || offer;
  return fallback ? fallback.slice(0, 160) : "未分類療程";
}

function defaultDimensionLabel(value: unknown, fallback: string) {
  return compactString(value).slice(0, 180) || fallback;
}

function phoneIdentity(value: unknown) {
  const digits = compactString(value).replace(/\D/g, "");
  return digits.length >= 8 ? digits.slice(-8) : "";
}

function createdAtSortValue(value: unknown, rowNumber: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${String(Math.floor(value)).padStart(10, "0")}.${String(
      Math.round((value - Math.floor(value)) * 1_000_000)
    ).padStart(6, "0")}|${String(rowNumber).padStart(10, "0")}`;
  }
  const raw = compactString(value);
  const date = parseGoogleSheetDate(value);
  if (date) {
    const timeMatch = raw.match(/(?:T|\s)(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    const time = timeMatch
      ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}:${
          timeMatch[3] || "00"
        }`
      : "00:00:00";
    return `${date} ${time}|${String(rowNumber).padStart(10, "0")}`;
  }
  return `9999-12-31 23:59:59|${String(rowNumber).padStart(10, "0")}`;
}

export function buildLeadSheetGroups(input: {
  headers: unknown[];
  rows: unknown[][];
  brands: SheetBrandReference[];
  sourceBrandId: string | null;
  brandAliases?: Record<string, string>;
  treatmentAliases?: LeadSheetTreatmentAlias[];
  appsScriptContract?: boolean;
  dedupeByIdentity?: boolean;
}): ParsedLeadSheetGroups {
  const columns = resolveLeadSheetColumns(input.headers);
  const brandLookup = buildBrandLookup(input.brands, input.brandAliases);
  const sourceBrand = input.sourceBrandId
    ? input.brands.find((brand) => brand.id === input.sourceBrandId) ?? null
    : null;
  const diagnostics: LeadSheetPerformanceDiagnostics = {
    sourceRows: 0,
    acceptedRows: 0,
    unknownBrandRows: 0,
    invalidCreatedDateRows: 0,
    invalidShowDateRows: 0,
    invalidAppointmentDateRows: 0,
    uncategorizedTreatmentRows: 0,
  };
  const groupedRows = new Map<
    string,
    Array<{
      sortValue: string;
      brand: SheetBrandReference;
      treatmentLabel: string;
      sourceLabel: string;
      campaignLabel: string;
      branchLabel: string;
      row: LeadSheetGroupRow;
    }>
  >();
  const aliases = input.treatmentAliases ?? [];
  const valueAt = (row: unknown[], field: LeadSheetFieldKey): unknown => {
    const index = columns[field];
    return index >= 0 ? row[index] : "";
  };

  input.rows.forEach((rawRow, index) => {
    const rowNumber = index + 2;
    const selectedValues = leadSheetFieldKeys.map((field) =>
      valueAt(rawRow, field)
    );
    if (!selectedValues.some((value) => compactString(value))) return;
    diagnostics.sourceRows += 1;

    const rowBrand =
      sourceBrand ||
      brandLookup.get(
        normalizeGoogleSheetBrandKey(valueAt(rawRow, "brand"))
      );
    const rowBrandAliases = rowBrand
      ? new Set(automaticBrandAliases(rowBrand))
      : new Set<string>();
    const eligibleAliases = input.appsScriptContract
      ? aliases
      : aliases.filter(
          (alias) =>
            !alias.brand ||
            rowBrandAliases.has(normalizeGoogleSheetBrandKey(alias.brand))
        );
    const matchedAlias = matchingTreatmentAlias({
      treatment: valueAt(rawRow, "treatment"),
      offer: valueAt(rawRow, "offer"),
      campaign: valueAt(rawRow, "campaign"),
      aliases: eligibleAliases,
    });
    const aliasBrand = input.appsScriptContract && matchedAlias?.brand
      ? brandLookup.get(normalizeGoogleSheetBrandKey(matchedAlias.brand))
      : null;
    const brand = sourceBrand || aliasBrand || rowBrand;
    if (!brand) {
      diagnostics.unknownBrandRows += 1;
      return;
    }
    diagnostics.acceptedRows += 1;

    const canonicalTreatment = treatmentLabel({
      treatment: valueAt(rawRow, "treatment"),
      offer: valueAt(rawRow, "offer"),
      matchedAlias,
      fallbackLabel: input.appsScriptContract ? "其他" : undefined,
    });
    if (canonicalTreatment === "未分類療程") {
      diagnostics.uncategorizedTreatmentRows += 1;
    }

    const createdAt = valueAt(rawRow, "createdAt");
    const createdDate = parseGoogleSheetDate(createdAt);
    if (!createdDate) diagnostics.invalidCreatedDateRows += 1;
    const statusInput = {
      followStatus: valueAt(rawRow, "followStatus"),
      status: valueAt(rawRow, "status"),
      showUp: valueAt(rawRow, "showUp"),
    };
    const status = input.appsScriptContract
      ? normalizeAppsScriptLeadSheetStatus(statusInput)
      : normalizeLeadSheetStatus(statusInput);
    const confirmationDate = parseGoogleSheetDate(
      valueAt(rawRow, "confirmationDate")
    );
    if (status === "show" && !confirmationDate) {
      diagnostics.invalidShowDateRows += 1;
    }
    const appointmentDate = parseGoogleSheetDate(
      valueAt(rawRow, "appointmentDate")
    );
    if (["booked", "no_show"].includes(status) && !appointmentDate) {
      diagnostics.invalidAppointmentDateRows += 1;
    }

    const phone = phoneIdentity(valueAt(rawRow, "phone"));
    const leadKey = compactString(valueAt(rawRow, "leadKey"));
    const identity =
      input.dedupeByIdentity === false
        ? `row:${rowNumber}`
        : phone
          ? `phone:${phone}`
          : leadKey
            ? `lead:${leadKey}`
            : `row:${rowNumber}`;
    const groupKey = `${brand.id}|${identity}`;
    const branchLabel = defaultDimensionLabel(
      valueAt(rawRow, "branch"),
      "未標記分店"
    );
    const item = {
      sortValue: createdAtSortValue(createdAt, rowNumber),
      brand,
      treatmentLabel: canonicalTreatment,
      sourceLabel: defaultDimensionLabel(
        valueAt(rawRow, "source"),
        "未標記來源"
      ),
      campaignLabel: defaultDimensionLabel(
        valueAt(rawRow, "campaign"),
        "未標記 Campaign"
      ),
      branchLabel,
      row: {
        rowNumber,
        createdAt,
        createdDate,
        status,
        appointmentDate,
        appointmentTime: compactString(valueAt(rawRow, "appointmentTime")),
        confirmationDate,
        branchLabel,
        csRemark: compactString(valueAt(rawRow, "csRemark")).slice(0, 500),
      } satisfies LeadSheetGroupRow,
    };
    const existing = groupedRows.get(groupKey);
    if (existing) existing.push(item);
    else groupedRows.set(groupKey, [item]);
  });

  const groups = Array.from(groupedRows.entries()).map(([key, items]) => {
    items.sort((left, right) => left.sortValue.localeCompare(right.sortValue));
    const first = items[0];
    return {
      key,
      brandId: first.brand.id,
      brandLabel: first.brand.name,
      treatmentLabel: first.treatmentLabel,
      sourceLabel: first.sourceLabel,
      campaignLabel: first.campaignLabel,
      branchLabel: first.branchLabel,
      firstTouchDate: first.row.createdDate,
      rows: items.map((item) => item.row),
    } satisfies LeadSheetLeadGroup;
  });

  return { groups, diagnostics };
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
  const parsed = buildLeadSheetGroups({
    ...input,
    appsScriptContract: false,
    dedupeByIdentity: false,
  });
  const dailyMetrics = new Map<string, ParsedLeadFunnelMetric>();
  const metricFacts = new Map<string, ParsedLeadSheetMetricFact>();
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

  parsed.groups.forEach((group) => {
    const dimensions = {
      brandId: group.brandId,
      brandLabel: group.brandLabel,
      treatmentLabel: group.treatmentLabel,
      sourceLabel: group.sourceLabel,
      campaignLabel: group.campaignLabel,
      branchLabel: group.branchLabel,
    };
    const isBook = group.rows.some((row) => row.status !== "lead");
    const createdDate = group.firstTouchDate;

    if (createdDate && createdDate <= input.dailyThroughDate) {
      const daily = getDailyMetric(group.brandId, createdDate);
      daily.leads += 1;
      if (isBook) daily.bookings += 1;
    }
    if (createdDate && createdDate <= input.activityThroughDate) {
      addFact({ ...dimensions, metricDate: createdDate, metricKind: "lead" });
      if (isBook) {
        addFact({ ...dimensions, metricDate: createdDate, metricKind: "book" });
      }
    }

    const showDate = group.rows
      .filter((row) => row.status === "show" && row.confirmationDate)
      .map((row) => row.confirmationDate as string)
      .sort()[0];
    if (showDate && showDate <= input.dailyThroughDate) {
      getDailyMetric(group.brandId, showDate).shows += 1;
    }
    if (showDate && showDate <= input.activityThroughDate) {
      addFact({ ...dimensions, metricDate: showDate, metricKind: "show" });
    }

    const noShowDate = group.rows
      .filter((row) => row.status === "no_show" && row.appointmentDate)
      .map((row) => row.appointmentDate as string)
      .sort()[0];
    if (noShowDate && noShowDate <= input.activityThroughDate) {
      addFact({
        ...dimensions,
        metricDate: noShowDate,
        metricKind: "no_show",
      });
    }

    const pendingDate = group.rows
      .filter((row) => row.status === "booked" && row.appointmentDate)
      .map((row) => row.appointmentDate as string)
      .sort()[0];
    if (pendingDate && pendingDate <= input.pendingThroughDate) {
      addFact({
        ...dimensions,
        metricDate: pendingDate,
        metricKind: "pending_show",
      });
    }
  });

  return {
    dailyMetrics: Array.from(dailyMetrics.values()),
    metricFacts: Array.from(metricFacts.values()),
    diagnostics: parsed.diagnostics,
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
