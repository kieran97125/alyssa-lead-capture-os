export type ReportingWorkbookBrand = {
  id: string;
  name: string;
  slug: string;
};

export type ReportingWorkbookSheet = {
  sheetId: number;
  title: string;
  hidden: boolean;
  rowCount: number;
  columnCount: number;
};

export type ReportingWorkbookBrandMapping = {
  brandId: string;
  brandName: string;
  brandSlug: string;
  tabName: string;
  sheetId: number;
};

export type ReportingWorkbookTabMatch = {
  mappings: ReportingWorkbookBrandMapping[];
  unmatchedBrands: ReportingWorkbookBrand[];
  unmatchedTabs: ReportingWorkbookSheet[];
  ambiguousBrands: ReportingWorkbookBrand[];
};

const spreadsheetIdPattern = /^[A-Za-z0-9_-]{20,}$/;
const genericBrandWords = new Set([
  "beauty",
  "clinic",
  "group",
  "hk",
  "hong",
  "kong",
  "limited",
  "ltd",
]);

function cleanText(value: unknown) {
  return typeof value === "string"
    ? value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim()
    : "";
}

function normalizeIdentity(value: unknown) {
  return cleanText(value)
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

export function parseGoogleSpreadsheetId(value: unknown) {
  const input = cleanText(value);
  if (spreadsheetIdPattern.test(input)) return input;

  try {
    const url = new URL(input);
    if (
      url.protocol !== "https:" ||
      !["docs.google.com", "drive.google.com"].includes(
        url.hostname.toLocaleLowerCase("en")
      )
    ) {
      return null;
    }
    const spreadsheetMatch = url.pathname.match(
      /\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/
    );
    if (spreadsheetMatch?.[1]) return spreadsheetMatch[1];
    const fileMatch = url.pathname.match(/\/file\/d\/([A-Za-z0-9_-]{20,})/);
    return fileMatch?.[1] ?? null;
  } catch {
    return null;
  }
}

export function canonicalGoogleSpreadsheetUrl(spreadsheetId: string) {
  if (!spreadsheetIdPattern.test(spreadsheetId)) return null;
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
}

export function normalizeReportingMonth(value: unknown) {
  const input = cleanText(value);
  const match = input.match(/^(\d{4})-(\d{2})(?:-01)?$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 2020 || year > 2100 || month < 1 || month > 12) return null;
  return `${match[1]}-${match[2]}-01`;
}

export function columnFromIndex(index: number) {
  if (!Number.isInteger(index) || index < 0) return "";
  let value = index + 1;
  let column = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    value = Math.floor((value - 1) / 26);
  }
  return column;
}

function headerIndex(headers: unknown[], aliases: string[]) {
  const normalized = headers.map(normalizeIdentity);
  for (const alias of aliases) {
    const index = normalized.indexOf(normalizeIdentity(alias));
    if (index >= 0) return index;
  }
  return -1;
}

export function resolveMonthlyOverviewColumns(headers: unknown[]) {
  const dateIndex = headerIndex(headers, [
    "Date",
    "Report Date",
    "數據日期",
    "日期",
  ]);
  const spendIndex = headerIndex(headers, [
    "累計廣告費$",
    "累計廣告費",
    "總廣告費$",
    "總廣告費",
    "廣告費合計",
    "Total Ad Spend",
  ]);

  return {
    dateIndex,
    spendIndex,
    dateColumn: columnFromIndex(dateIndex),
    spendColumn: columnFromIndex(spendIndex),
    valid: dateIndex >= 0 && spendIndex >= 0,
  };
}

function brandCandidates(brand: ReportingWorkbookBrand) {
  const nameWords = cleanText(brand.name)
    .toLocaleLowerCase("en")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  const meaningfulWords = nameWords.filter(
    (word) => !genericBrandWords.has(normalizeIdentity(word))
  );
  const acronym = nameWords.map((word) => word[0] ?? "").join("");
  const candidates = [
    { value: normalizeIdentity(brand.name), score: 100 },
    { value: normalizeIdentity(brand.slug), score: 96 },
    { value: normalizeIdentity(meaningfulWords.join(" ")), score: 92 },
    { value: normalizeIdentity(acronym), score: 84 },
    { value: normalizeIdentity(nameWords[0]), score: 76 },
    { value: normalizeIdentity(brand.slug.split("-")[0]), score: 72 },
  ];
  const unique = new Map<string, number>();
  for (const candidate of candidates) {
    if (!candidate.value) continue;
    unique.set(
      candidate.value,
      Math.max(unique.get(candidate.value) ?? 0, candidate.score)
    );
  }
  return unique;
}

export function matchReportingWorkbookTabs(input: {
  brands: ReportingWorkbookBrand[];
  sheets: ReportingWorkbookSheet[];
}): ReportingWorkbookTabMatch {
  const availableSheets = input.sheets.filter((sheet) => !sheet.hidden);
  const usedSheetIds = new Set<number>();
  const mappings: ReportingWorkbookBrandMapping[] = [];
  const unmatchedBrands: ReportingWorkbookBrand[] = [];
  const ambiguousBrands: ReportingWorkbookBrand[] = [];

  for (const brand of input.brands) {
    const candidates = brandCandidates(brand);
    const matches = availableSheets
      .filter((sheet) => !usedSheetIds.has(sheet.sheetId))
      .flatMap((sheet) => {
        const score = candidates.get(normalizeIdentity(sheet.title)) ?? 0;
        return score > 0 ? [{ sheet, score }] : [];
      })
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.sheet.title.localeCompare(right.sheet.title, "zh-HK")
      );
    if (matches.length === 0) {
      unmatchedBrands.push(brand);
      continue;
    }
    if (matches.length > 1 && matches[0].score === matches[1].score) {
      ambiguousBrands.push(brand);
      continue;
    }
    const sheet = matches[0].sheet;
    usedSheetIds.add(sheet.sheetId);
    mappings.push({
      brandId: brand.id,
      brandName: brand.name,
      brandSlug: brand.slug,
      tabName: sheet.title,
      sheetId: sheet.sheetId,
    });
  }

  return {
    mappings,
    unmatchedBrands,
    ambiguousBrands,
    unmatchedTabs: availableSheets.filter(
      (sheet) => !usedSheetIds.has(sheet.sheetId)
    ),
  };
}

export function validateReportingMonthDates(input: {
  values: unknown[];
  reportingMonth: string;
  parseDate: (value: unknown) => string | null;
}) {
  const expectedPrefix = `${input.reportingMonth.slice(0, 7)}-`;
  const parsedDates = input.values
    .map(input.parseDate)
    .filter((value): value is string => Boolean(value));
  const matchingDates = parsedDates.filter((value) =>
    value.startsWith(expectedPrefix)
  );
  const outsideDates = parsedDates.filter(
    (value) => !value.startsWith(expectedPrefix)
  );
  return {
    valid: matchingDates.length > 0 && outsideDates.length === 0,
    parsedDateCount: parsedDates.length,
    matchingDateCount: matchingDates.length,
    outsideDates: Array.from(new Set(outsideDates)).slice(0, 5),
  };
}

export function isMetricFromActiveReportingVersion(input: {
  sourceReportingWorkbookId: string | null | undefined;
  workbookStatus: string | null | undefined;
  workbookReportingMonth: string | null | undefined;
  currentReportingMonth: string;
}) {
  if (!input.sourceReportingWorkbookId) return true;
  return (
    input.workbookStatus === "active" &&
    input.workbookReportingMonth === input.currentReportingMonth
  );
}

export function shouldSyncReportingSource(input: {
  sourceReportingWorkbookId: string | null | undefined;
  activeCurrentWorkbookId: string | null | undefined;
}) {
  return (
    !input.sourceReportingWorkbookId ||
    input.sourceReportingWorkbookId === input.activeCurrentWorkbookId
  );
}
