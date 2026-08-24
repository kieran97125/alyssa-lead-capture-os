import type {
  DailyOverviewBrandRow,
  DailyOverviewSnapshot,
} from "@/lib/marketing/dailyOverview";
import type { DailyDerivedMetrics } from "@/lib/marketing/dailyOverviewMath";
import { SPEND_TYPE_LABELS, type SpendType } from "@/lib/marketing/spendTypes";

const DAILY_SPEND_TYPES: SpendType[] = [
  "meta_whatsapp",
  "meta_lead_form",
  "meta_website_form",
  "google_ads",
  "legacy_unclassified",
];

type ExcelCell = {
  value: string | number | null;
  style?: "header" | "money" | "percent" | "integer" | "text";
};

type Worksheet = {
  name: string;
  rows: ExcelCell[][];
};

export type DailyOverviewExcelInput = Pick<
  DailyOverviewSnapshot,
  | "monthStart"
  | "monthLabel"
  | "throughDate"
  | "selectedBrandScope"
  | "reportBrands"
  | "allBrands"
>;

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cellXml(cell: ExcelCell) {
  const styleId =
    cell.style === "header"
      ? "Header"
      : cell.style === "money"
        ? "Money"
        : cell.style === "percent"
          ? "Percent"
          : cell.style === "integer"
            ? "Integer"
            : "Default";
  if (cell.value === null || cell.value === "") {
    return `<Cell ss:StyleID="${styleId}"/>`;
  }
  const numeric = typeof cell.value === "number";
  const type = numeric ? "Number" : "String";
  const value = numeric ? String(cell.value) : escapeXml(String(cell.value));
  return `<Cell ss:StyleID="${styleId}"><Data ss:Type="${type}">${value}</Data></Cell>`;
}

function worksheetXml(sheet: Worksheet) {
  const safeName = sheet.name.replace(/[\\/:*?\[\]]/g, " ").slice(0, 31) || "Sheet";
  return [
    `<Worksheet ss:Name="${escapeXml(safeName)}">`,
    "<Table>",
    ...sheet.rows.map((row) => `<Row>${row.map(cellXml).join("")}</Row>`),
    "</Table>",
    "<WorksheetOptions xmlns=\"urn:schemas-microsoft-com:office:excel\"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane><ActivePane>2</ActivePane><ProtectObjects>False</ProtectObjects><ProtectScenarios>False</ProtectScenarios></WorksheetOptions>",
    "</Worksheet>",
  ].join("");
}

function workbookXml(sheets: Worksheet[]) {
  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<?mso-application progid=\"Excel.Sheet\"?>",
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">',
    "<Styles>",
    '<Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="10"/></Style>',
    '<Style ss:ID="Header"><Alignment ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#5A2348" ss:Pattern="Solid"/></Style>',
    '<Style ss:ID="Integer"><NumberFormat ss:Format="0"/></Style>',
    '<Style ss:ID="Money"><NumberFormat ss:Format="&quot;HK$&quot;#,##0.00"/></Style>',
    '<Style ss:ID="Percent"><NumberFormat ss:Format="0.0%"/></Style>',
    "</Styles>",
    ...sheets.map(worksheetXml),
    "</Workbook>",
  ].join("");
}

function metricCells(metrics: DailyDerivedMetrics): ExcelCell[] {
  return [
    { value: metrics.spend, style: "money" },
    { value: metrics.leads, style: "integer" },
    { value: metrics.bookings, style: "integer" },
    { value: metrics.bookingRate, style: "percent" },
    { value: metrics.shows, style: "integer" },
    { value: metrics.cpl, style: "money" },
    { value: metrics.costPerBooking, style: "money" },
    { value: metrics.costPerShow, style: "money" },
  ];
}

function dailyWorksheet(brands: DailyOverviewBrandRow[]): Worksheet {
  const headers = [
    "日期",
    "星期",
    "品牌",
    ...DAILY_SPEND_TYPES.map((type) => SPEND_TYPE_LABELS[type]),
    "總廣告費",
    "Lead",
    "Book",
    "BR",
    "Show",
    "CPL",
    "CPA · Book",
    "CPA · Show",
    "累計廣告費",
    "累計 Lead",
    "累計 Book",
    "累計 BR",
    "累計 Show",
    "累計 CPL",
    "累計 CPA · Book",
    "累計 CPA · Show",
  ];
  const rows: ExcelCell[][] = [
    headers.map((value) => ({ value, style: "header" as const })),
  ];
  for (const brand of brands) {
    for (const cell of brand.cells) {
      rows.push([
        { value: cell.date },
        { value: cell.weekday },
        { value: brand.name },
        ...DAILY_SPEND_TYPES.map((type) => ({
          value: cell.spendByType.daily[type],
          style: "money" as const,
        })),
        ...metricCells(cell.daily),
        ...metricCells(cell.cumulative),
      ]);
    }
  }
  return { name: "每日數據", rows };
}

function summaryWorksheet(input: DailyOverviewExcelInput): Worksheet {
  const summaryBrands =
    input.reportBrands.length > 1
      ? [input.allBrands, ...input.reportBrands]
      : input.reportBrands;
  const rows: ExcelCell[][] = [
    [
      { value: "月份", style: "header" },
      { value: input.monthLabel },
      { value: "數據截至", style: "header" },
      { value: input.throughDate },
    ],
    [],
    [
      "品牌",
      "總廣告費",
      "Lead",
      "Book",
      "BR",
      "Show",
      "CPL",
      "CPA · Book",
      "CPA · Show",
      "Lead 目標",
      "Book 目標",
      "Show 目標",
      "廣告費完整日數",
      "應有日數",
    ].map((value) => ({ value, style: "header" as const })),
  ];
  for (const brand of summaryBrands) {
    rows.push([
      { value: brand.name },
      ...metricCells(brand.total),
      { value: brand.leadTarget, style: "integer" },
      { value: brand.bookingTarget, style: "integer" },
      { value: brand.showTarget, style: "integer" },
      { value: brand.spendCoverageDays, style: "integer" },
      { value: brand.expectedSpendDays, style: "integer" },
    ]);
  }
  return { name: "月份摘要", rows };
}

function safeFilenamePart(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[^A-Za-z0-9\u3400-\u9FFF_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "All_Brands";
}

export function buildDailyOverviewExcelWorkbook(input: DailyOverviewExcelInput) {
  const scope = safeFilenamePart(input.allBrands.name);
  const month = input.monthStart.slice(0, 7);
  return {
    filename: `Alyssa_Daily_Overview_${month}_${scope}.xls`,
    body: `\uFEFF${workbookXml([
      dailyWorksheet(input.reportBrands),
      summaryWorksheet(input),
    ])}`,
  };
}
