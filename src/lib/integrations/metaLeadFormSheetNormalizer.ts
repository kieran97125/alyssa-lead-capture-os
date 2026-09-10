import {
  formatHongKongDateTime,
  GOOGLE_SHEETS_LEAD_HEADERS,
  GOOGLE_SHEETS_LEAD_LEGACY_HEADERS,
} from "@/lib/integrations/googleSheetsLeadSync";
import type { LeadSheetTreatmentAlias } from "@/lib/marketing/googleSheetsMetricParser";

export type MetaLeadNormalizationBrand = {
  id: string;
  name: string;
  slug: string;
};

export type MetaLeadFormRowRewrite = {
  rowNumber: number;
  leadId: string;
  values: string[];
};

export type MetaLeadFormNormalizationResult = {
  rows: unknown[][];
  rewrites: MetaLeadFormRowRewrite[];
};

function compactString(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedComparable(value: unknown) {
  return compactString(value)
    .toLowerCase()
    .replace(/[／/]+/g, "/")
    .replace(/[\s_-]+/g, " ")
    .trim();
}

function canonicalHeader(value: unknown) {
  return normalizedComparable(value).replace(/\s*\/\s*/g, "/");
}

type LeadSheetHeaderContract = "legacy" | "v3";

function matchesOperationalHeaders(
  headers: unknown[],
  contract: readonly string[]
) {
  if (headers.length < contract.length) return false;
  return contract.every(
    (header, index) => canonicalHeader(headers[index]) === canonicalHeader(header)
  );
}

function operationalHeaderContract(
  headers: unknown[]
): LeadSheetHeaderContract | null {
  if (matchesOperationalHeaders(headers, GOOGLE_SHEETS_LEAD_HEADERS)) {
    return "v3";
  }
  if (matchesOperationalHeaders(headers, GOOGLE_SHEETS_LEAD_LEGACY_HEADERS)) {
    return "legacy";
  }
  return null;
}

function prefixedId(value: unknown, prefix: string) {
  const raw = compactString(value);
  const match = raw.match(new RegExp(`^${prefix}:(\\d+)$`, "i"));
  return match?.[1] ?? "";
}

export function isMetaLeadFormRawRow(row: unknown[]) {
  return Boolean(
    prefixedId(row[0], "l") &&
      prefixedId(row[2], "ag") &&
      prefixedId(row[4], "as") &&
      prefixedId(row[6], "c") &&
      prefixedId(row[8], "f") &&
      compactString(row[1])
  );
}

function buildBrandLookup(
  brands: MetaLeadNormalizationBrand[],
  aliases: Record<string, string>
) {
  const lookup = new Map<string, MetaLeadNormalizationBrand>();
  for (const brand of brands) {
    const values = [brand.id, brand.name, brand.slug];
    const withoutBeauty = brand.name.replace(/\s+beauty$/i, "");
    if (withoutBeauty) values.push(withoutBeauty);
    for (const value of values) {
      const key = normalizedComparable(value);
      if (key) lookup.set(key, brand);
    }
  }
  for (const [alias, target] of Object.entries(aliases)) {
    const targetKey = normalizedComparable(target);
    const targetBrand =
      lookup.get(targetKey) ||
      brands.find((brand) =>
        [brand.id, brand.name, brand.slug]
          .map(normalizedComparable)
          .includes(targetKey)
      );
    if (targetBrand) lookup.set(normalizedComparable(alias), targetBrand);
  }
  return lookup;
}

function findTreatmentAlias(input: {
  haystack: string;
  aliases: LeadSheetTreatmentAlias[];
}) {
  return input.aliases.find((alias) =>
    alias.keywords.some((keyword) => {
      const normalized = normalizedComparable(keyword);
      return Boolean(normalized && input.haystack.includes(normalized));
    })
  );
}

function inferBrandFromText(
  haystack: string,
  brands: MetaLeadNormalizationBrand[],
  lookup: Map<string, MetaLeadNormalizationBrand>
) {
  const direct = brands.find((brand) => {
    const candidates = [brand.name, brand.slug]
      .map(normalizedComparable)
      .filter(Boolean);
    return candidates.some((candidate) => haystack.includes(candidate));
  });
  if (direct) return direct;

  const candidates: Array<[RegExp, string[]]> = [
    [/\bgos\b|gos beauty/i, ["gos beauty", "gos", "gos-beauty"]],
    [/ineffable|\bib\b/i, ["ineffable beauty", "ineffable"]],
    [
      /alyssa medical|julaine|julaïne|xeomin|\bam\b/i,
      ["am", "alyssa medical", "alyssa醫療", "alyssa 醫療"],
    ],
    [/alyssa/i, ["alyssa"]],
  ];
  for (const [pattern, targets] of candidates) {
    if (!pattern.test(haystack)) continue;
    for (const target of targets) {
      const brand = lookup.get(normalizedComparable(target));
      if (brand) return brand;
    }
  }
  return null;
}

function extractPhone(rawAnswers: string[]) {
  const prefixed = rawAnswers.find((value) => /^p\s*:/i.test(value));
  const fallback = rawAnswers.find((value) => /\+?\d[\d\s()-]{7,}/.test(value));
  const value = prefixed || fallback || "";
  if (!value) return "";
  const stripped = value.replace(/^p\s*:\s*/i, "").trim();
  const hasPlus = stripped.startsWith("+");
  const digits = stripped.replace(/\D/g, "");
  if (digits.length < 8) return "";
  return `${hasPlus ? "+" : ""}${digits}`;
}

function extractEmail(rawAnswers: string[]) {
  const value =
    rawAnswers.find((item) => /^e\s*:/i.test(item)) ||
    rawAnswers.find((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item)) ||
    "";
  return value.replace(/^e\s*:\s*/i, "").trim().toLowerCase();
}

function extractCustomerName(rawAnswers: string[], phone: string, email: string) {
  const phoneIndex = rawAnswers.findIndex((value) => {
    const candidate = value.replace(/^p\s*:\s*/i, "").replace(/\D/g, "");
    return Boolean(phone && candidate && phone.replace(/\D/g, "") === candidate);
  });
  if (phoneIndex > 0) {
    for (let index = phoneIndex - 1; index >= 0; index -= 1) {
      const candidate = rawAnswers[index];
      if (!candidate || candidate === email) continue;
      if (/^(?:p|e)\s*:/i.test(candidate)) continue;
      if (/^(?:created|new|processed)$/i.test(candidate)) continue;
      return candidate.slice(0, 120);
    }
  }

  return (
    rawAnswers
      .filter(Boolean)
      .filter((candidate) => candidate !== email)
      .filter((candidate) => !/^(?:p|e)\s*:/i.test(candidate))
      .find((candidate) => /[a-z\u3400-\u9fff]/i.test(candidate))
      ?.slice(0, 120) || ""
  );
}

function metaAnswerSummary(input: {
  rawAnswers: string[];
  customerName: string;
  phone: string;
  email: string;
}) {
  const phoneDigits = input.phone.replace(/\D/g, "");
  const values = input.rawAnswers.filter((value) => {
    if (!value || value === input.customerName || value === input.email) return false;
    if (/^(?:p|e)\s*:/i.test(value)) return false;
    if (phoneDigits && value.replace(/\D/g, "") === phoneDigits) return false;
    if (/^(?:created|new|processed)$/i.test(value)) return false;
    return true;
  });
  const unique = Array.from(new Set(values)).slice(0, 6);
  return unique.length > 0
    ? `Meta 表單答案：${unique.join("｜")}`.slice(0, 500)
    : "";
}

function campaignAdLabel(campaignName: string, adName: string) {
  return [campaignName, adName].filter(Boolean).join(" / ").slice(0, 500);
}

function normalizedRow(input: {
  rawRow: unknown[];
  brands: MetaLeadNormalizationBrand[];
  brandAliases: Record<string, string>;
  treatmentAliases: LeadSheetTreatmentAlias[];
  contract: LeadSheetHeaderContract;
}) {
  const row = input.rawRow.map(compactString);
  const leadId = prefixedId(row[0], "l");
  if (!leadId) return null;

  const adName = row[3] || "";
  const adSetName = row[5] || "";
  const campaignName = row[7] || "";
  const formName = row[9] || "Meta Instant Form";
  const platform = (row[11] || "fb").toLowerCase();
  const rawAnswers = row.slice(12).filter(Boolean);
  const phone = extractPhone(rawAnswers);
  const email = extractEmail(rawAnswers);
  const customerName = extractCustomerName(rawAnswers, phone, email);
  const haystack = normalizedComparable(
    [adName, adSetName, campaignName, formName, ...rawAnswers].join(" ")
  );
  const brandLookup = buildBrandLookup(input.brands, input.brandAliases);
  const treatmentAlias = findTreatmentAlias({
    haystack,
    aliases: input.treatmentAliases,
  });
  const brandFromTreatment = treatmentAlias?.brand
    ? brandLookup.get(normalizedComparable(treatmentAlias.brand)) ?? null
    : null;
  const brand =
    brandFromTreatment ||
    inferBrandFromText(haystack, input.brands, brandLookup);
  if (!brand || !phone) return null;

  const sourcePlatform = platform === "ig" ? "Instagram" : "Facebook";
  const treatmentItem =
    compactString(treatmentAlias?.label) ||
    rawAnswers.find(
      (value) => value !== customerName && !/^p\s*:/i.test(value)
    ) ||
    "未分類療程";
  const createdAt = formatHongKongDateTime(row[1]);
  if (!createdAt) return null;

  const legacyValues = [
    createdAt,
    "待跟進",
    brand.name,
    "",
    customerName,
    phone,
    email,
    `Meta Lead Form · ${formName}`.slice(0, 240),
    treatmentItem.slice(0, 160),
    "",
    "",
    "",
    `Meta Lead Form / ${sourcePlatform}`,
    campaignAdLabel(campaignName, adName),
    "",
    "",
    `meta_lead:${leadId}`,
    metaAnswerSummary({ rawAnswers, customerName, phone, email }),
    "",
    "",
    "",
    "",
  ];
  const values =
    input.contract === "v3"
      ? [createdAt, ...legacyValues]
      : legacyValues;

  return { leadId, values };
}

export function normalizeMetaLeadFormRows(input: {
  headers: unknown[];
  rows: unknown[][];
  headerRow: number;
  brands: MetaLeadNormalizationBrand[];
  brandAliases?: Record<string, string>;
  treatmentAliases?: LeadSheetTreatmentAlias[];
}): MetaLeadFormNormalizationResult {
  const contract = operationalHeaderContract(input.headers);
  if (!contract) {
    return { rows: input.rows, rewrites: [] };
  }

  const rows = input.rows.map((row) => [...row]);
  const rewrites: MetaLeadFormRowRewrite[] = [];
  rows.forEach((row, index) => {
    if (!isMetaLeadFormRawRow(row)) return;
    const normalized = normalizedRow({
      rawRow: row,
      brands: input.brands,
      brandAliases: input.brandAliases ?? {},
      treatmentAliases: input.treatmentAliases ?? [],
      contract,
    });
    if (!normalized) return;
    rows[index] = normalized.values;
    rewrites.push({
      rowNumber: input.headerRow + 1 + index,
      leadId: normalized.leadId,
      values: normalized.values,
    });
  });

  return { rows, rewrites };
}
