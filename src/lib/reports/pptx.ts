import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { DOMParser, XMLSerializer, type Document, type Element } from "@xmldom/xmldom";
import { reportMetrics } from "@/lib/reports/metrics";
import { REPORT_SERIES_GROUPS } from "@/lib/reports/seriesData";
import type { ReportMetrics, ReportSeriesGroupKey, ReportSnapshot } from "@/lib/reports/types";

export const REPORT_PRESENTATION_TEMPLATE = "cs-ad-series-v1";
const A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const REL = "http://schemas.openxmlformats.org/package/2006/relationships";
const CT = "http://schemas.openxmlformats.org/package/2006/content-types";
const formatter = new Intl.NumberFormat("en-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const empty = () => reportMetrics({ leads: 0, bookings: 0, shows: 0, noShows: 0, pendingShows: 0 }, null);
const money = (value: number | null) => value === null ? "未有資料" : formatter.format(value);
const rate = (value: number | null) => value === null ? "不適用" : `${(value * 100).toFixed(1)}%`;
const metricCells = (m: ReportMetrics) => [m.leads, m.bookings, m.shows, m.noShows].map(String);
const efficiencyCells = (m: ReportMetrics) => [...metricCells(m), rate(m.bookRate), rate(m.showUpRate)];
const dash = (length: number) => Array.from({ length }, () => "—");
const chunks = <T,>(rows: T[], size: number): T[][] => rows.length ? Array.from({ length: Math.ceil(rows.length / size) }, (_, i) => rows.slice(i * size, (i + 1) * size)) : [[]];
const elements = (root: Element | Document, ns: string, name: string) => Array.from(root.getElementsByTagNameNS(ns, name));
const direct = (root: Element, ns: string, name: string) => Array.from(root.childNodes).filter((node): node is Element => node.nodeType === 1 && (node as Element).namespaceURI === ns && (node as Element).localName === name);
function parse(xml: string): Document {
  return new DOMParser({ onError: level => { if (level !== "warning") throw new Error("Invalid report template XML"); } }).parseFromString(xml.replace(/^\uFEFF/, ""), "application/xml");
}

/** Update native text while retaining the approved paragraph and run styles. */
function setText(root: Element, text: string) {
  const body = elements(root, A, "txBody")[0] ?? elements(root, P, "txBody")[0];
  if (!body) throw new Error("Report template text body missing");
  const existing = direct(body, A, "p");
  const paragraphStyle = existing[0] && direct(existing[0], A, "pPr")[0];
  const runStyle = elements(body, A, "rPr")[0];
  const endStyle = elements(body, A, "endParaRPr")[0];
  existing.forEach(node => body.removeChild(node));
  for (const line of text.split("\n")) {
    const p = body.ownerDocument!.createElementNS(A, "a:p");
    if (paragraphStyle) p.appendChild(paragraphStyle.cloneNode(true));
    const run = body.ownerDocument!.createElementNS(A, "a:r");
    if (runStyle) run.appendChild(runStyle.cloneNode(true));
    const value = body.ownerDocument!.createElementNS(A, "a:t");
    value.appendChild(body.ownerDocument!.createTextNode(line)); run.appendChild(value); p.appendChild(run);
    if (endStyle) p.appendChild(endStyle.cloneNode(true));
    body.appendChild(p);
  }
}
function setShape(slide: Document, id: number, text: string) {
  const shape = elements(slide, P, "sp").find(node => elements(node, P, "cNvPr")[0]?.getAttribute("id") === String(id));
  if (!shape) throw new Error(`Report template shape ${id} missing`);
  setText(shape, text);
}

const EMU_PER_PIXEL = 9525;
const CONTENT_BOTTOM = 660 * EMU_PER_PIXEL;
type TableLayout = { table: Element; frame: Element; columns: number[]; rows: Element[]; top: number };
function tableLayout(slide: Document, index: number): TableLayout {
  const table = elements(slide, A, "tbl")[index];
  if (!table) throw new Error("Report template table missing");
  let frame = table.parentNode as Element;
  while (frame && !(frame.namespaceURI === P && frame.localName === "graphicFrame")) frame = frame.parentNode as Element;
  if (!frame) throw new Error("Report template table frame missing");
  const transform = direct(frame, P, "xfrm")[0];
  const offset = transform && direct(transform, A, "off")[0];
  const grid = direct(table, A, "tblGrid")[0];
  return { table, frame, columns: direct(grid, A, "gridCol").map(column => Number(column.getAttribute("w"))), rows: direct(table, A, "tr"), top: Number(offset?.getAttribute("y") ?? 0) };
}
function cellFont(cell: Element) {
  const style = elements(cell, A, "rPr").find(node => node.hasAttribute("sz"))
    ?? elements(cell, A, "endParaRPr").find(node => node.hasAttribute("sz"));
  return Number(style?.getAttribute("sz") ?? 1800) / 100 * 96 / 72;
}
function glyphWidth(character: string, font: number) {
  if (/\s/.test(character)) return font * 0.34;
  if (/[ilI.,'`:;!|]/.test(character)) return font * 0.32;
  if (/[MW@%]/.test(character)) return font * 0.86;
  if (/[A-Z]/.test(character)) return font * 0.69;
  if (/[a-z0-9]/.test(character)) return font * 0.62;
  if (/[\u0000-\u007f]/.test(character)) return font * 0.58;
  return font;
}
/** Conservative line measurement using the native grid, font and margins. */
function wrappedLines(value: string, cell: Element, column: number) {
  const style = direct(cell, A, "tcPr")[0];
  const width = Math.max(1, (column - Number(style?.getAttribute("marL") ?? 91440) - Number(style?.getAttribute("marR") ?? 91440)) / EMU_PER_PIXEL);
  const font = cellFont(cell);
  let lines = 1, used = 0;
  for (const token of value.match(/\r\n|\n|[A-Za-z0-9]+|[^A-Za-z0-9]/gu) ?? [""]) {
    if (token === "\n" || token === "\r\n") { lines++; used = 0; continue; }
    const tokenWidth = Array.from(token).reduce((sum, character) => sum + glyphWidth(character, font), 0);
    if (tokenWidth <= width) {
      if (used > 0 && used + tokenWidth > width) { lines++; used = 0; }
      used += tokenWidth;
    } else {
      for (const character of token) {
        const advance = glyphWidth(character, font);
        if (used > 0 && used + advance > width) { lines++; used = 0; }
        used += advance;
      }
    }
  }
  return lines;
}
function measuredRowHeight(values: string[], row: Element, columns: number[]) {
  const cells = direct(row, A, "tc");
  const height = cells.reduce((maximum, cell, column) => {
    const style = direct(cell, A, "tcPr")[0];
    const padding = Number(style?.getAttribute("marT") ?? 45720) + Number(style?.getAttribute("marB") ?? 45720);
    // Noto Sans TC's full line box exceeds its nominal point size. Budget it
    // explicitly so PowerPoint/Slides cannot expand a wrapped row off-canvas.
    const lineHeight = cellFont(cell) * 1.25 * EMU_PER_PIXEL;
    return Math.max(maximum, Math.ceil(wrappedLines(values[column] ?? "", cell, columns[column]) * lineHeight + padding));
  }, Number(row.getAttribute("h")));
  return height;
}
function rowText(row: Element) {
  return direct(row, A, "tc").map(cell => direct(elements(cell, A, "txBody")[0], A, "p").map(paragraph => elements(paragraph, A, "t").map(node => node.textContent ?? "").join("")).join("\n"));
}
type DataRow = { values: string[]; metrics: ReportMetrics };
function splitDataRow(row: DataRow, prototype: Element, columns: number[], maxHeight: number): DataRow[] {
  if (measuredRowHeight(row.values, prototype, columns) <= maxHeight) return [row];
  const remaining = row.values.map(value => Array.from(value));
  const output: DataRow[] = [];
  let first = true;
  while (remaining.some(characters => characters.length)) {
    const values = remaining.map((characters, column) => {
      // Counts only appear on the first fragment. Subsequent fragments remain
      // editable text and contribute no second copy to a page subtotal.
      if (column >= 2 || (row.values.length === 7 && column >= 1)) {
        const value = first ? characters.join("") : ""; characters.length = 0; return value;
      }
      const prefix = !first && column === 0 ? "（續）" : "";
      let count = 0;
      while (count < characters.length) {
        const candidate = prefix + characters.slice(0, count + 1).join("");
        const partial = row.values.map(() => ""); partial[column] = candidate;
        if (measuredRowHeight(partial, prototype, columns) > maxHeight) break;
        count++;
      }
      if (characters.length && count === 0) throw new Error("Report label cannot fit the approved template");
      return prefix + characters.splice(0, count).join("");
    });
    if (measuredRowHeight(values, prototype, columns) > maxHeight) throw new Error("Report row cannot fit the approved template");
    output.push({ values, metrics: first ? row.metrics : empty() });
    first = false;
  }
  return output;
}
function paginateNativeRows(layout: TableLayout, rows: DataRow[], totalCells: (metrics: ReportMetrics) => string[], maxRows: number): DataRow[][] {
  if (!rows.length) return [[]];
  const headerHeight = measuredRowHeight(rowText(layout.rows[0]), layout.rows[0], layout.columns);
  const totalHeight = measuredRowHeight(totalCells(sum(rows.map(row => row.metrics))), layout.rows.at(-1)!, layout.columns);
  const available = CONTENT_BOTTOM - layout.top - headerHeight - totalHeight;
  const prototypes = layout.rows.slice(1, -1);
  const fragments = rows.flatMap(row => splitDataRow(row, prototypes[0], layout.columns, available));
  const pages: DataRow[][] = [];
  let page: DataRow[] = [], used = 0;
  for (const row of fragments) {
    let height = measuredRowHeight(row.values, prototypes[page.length % Math.min(2, prototypes.length)], layout.columns);
    if (page.length && (page.length >= maxRows || used + height > available)) {
      pages.push(page); page = []; used = 0;
      height = measuredRowHeight(row.values, prototypes[0], layout.columns);
    }
    if (height > available) throw new Error("Report row exceeds the approved content canvas");
    page.push(row); used += height;
  }
  if (page.length) pages.push(page);
  return pages;
}

/** Reuse editable rows. Pagination keeps the reference font sizes readable. */
function setTable(slide: Document, index: number, data: string[][], hasTotal = true) {
  const layout = tableLayout(slide, index);
  const { table, frame } = layout;
  const original = layout.rows;
  const prototypes = original.slice(1, hasTotal ? -1 : undefined);
  const total = original[original.length - 1];
  if (!prototypes.length || !total) throw new Error("Report template rows missing");
  original.slice(1).forEach(row => table.removeChild(row));
  data.forEach((values, i) => {
    const exemplar = hasTotal && i === data.length - 1 ? total : prototypes[i % Math.min(2, prototypes.length)];
    const row = exemplar.cloneNode(true) as Element;
    const cells = direct(row, A, "tc");
    if (values.length !== cells.length) throw new Error("Report template column mismatch");
    row.setAttribute("h", String(measuredRowHeight(values, exemplar, layout.columns)));
    cells.forEach((cell, c) => setText(cell, values[c])); table.appendChild(row);
  });
  const transform = direct(frame, P, "xfrm")[0];
  const ext = transform && direct(transform, A, "ext")[0];
  if (ext) ext.setAttribute("cy", String(direct(table, A, "tr").reduce((sum, row) => sum + Number(row.getAttribute("h")), 0)));
}
function sum(rows: ReportMetrics[]): ReportMetrics {
  const counts = { leads: 0, bookings: 0, shows: 0, noShows: 0, pendingShows: 0 };
  rows.forEach(row => { for (const key of Object.keys(counts) as Array<keyof typeof counts>) counts[key] += row[key]; });
  const spends = rows.flatMap(row => row.spend === null ? [] : [row.spend]);
  return reportMetrics(counts, spends.length ? spends.reduce((a, b) => a + b, 0) : null);
}
type Page = { exemplar: number; tables?: string[][][]; shapes?: Record<number, string> };

function pagesFor(snapshot: ReportSnapshot, sourceSlides: Document[]): Page[] {
  const series = snapshot.series;
  const groups = REPORT_SERIES_GROUPS.map(group => series?.groupRows.find(row => row.key === group.key) ?? { ...group, available: false, metrics: empty() });
  const byGroup = (key: ReportSeriesGroupKey) => groups.find(group => group.key === key)!;
  const startMonth = Number(snapshot.current.startDate.slice(5, 7));
  const endMonth = Number(snapshot.current.endDate.slice(5, 7));
  const startDay = Number(snapshot.current.startDate.slice(8));
  const endDay = Number(snapshot.current.endDate.slice(8));
  const shortPeriod = `${startMonth}/${startDay}–${snapshot.current.startDate.slice(0, 7) === snapshot.current.endDate.slice(0, 7) ? endDay : `${endMonth}/${endDay}`}`;
  const totals = snapshot.current.totals;
  const covered = groups.some(group => group.metrics.spend !== null);
  const cost = (value: number | null, spend: number | null) => spend === null ? "未有資料" : value === null ? "不適用" : formatter.format(value);
  const pages: Page[] = [
    { exemplar: 1, shapes: { 38: snapshot.current.label, 40: String(totals.leads), 42: String(totals.bookings), 44: String(totals.shows), 46: String(totals.noShows) } },
    { exemplar: 2, shapes: { 188: snapshot.dataQuality.spendCompleteBrandDays < snapshot.dataQuality.spendExpectedBrandDays ? "部分廣告費未齊" : "" }, tables: [[...groups.map(group => [group.label, money(group.metrics.spend), group.metrics.spend === null ? "未有資料" : shortPeriod, "—"]), ["已入帳合計", money(covered ? groups.reduce((value, group) => value + (group.metrics.spend ?? 0), 0) : null), "", ""]]] },
    { exemplar: 3, tables: [groups.map(group => [group.label, group.metrics.spend === null ? "未有資料" : shortPeriod, money(group.metrics.spend), ...[group.metrics.cpl, group.metrics.costPerBooking, group.metrics.costPerShow].map(value => group.available ? cost(value, group.metrics.spend) : "未有資料")])] },
    { exemplar: 4, shapes: { 58: series?.warnings[0] ?? "" }, tables: [[...groups.map(group => [group.label, ...(group.available ? efficiencyCells(group.metrics) : dash(6))]), ["合計", ...efficiencyCells(totals)]]] },
  ];
  for (const daily of chunks(snapshot.daily, 7)) pages.push({ exemplar: 5, tables: [[...daily.map(row => [row.date.slice(5).replace("-", "/"), ...metricCells(row.metrics)]), ["合計", ...metricCells(sum(daily.map(row => row.metrics)))]]] });
  const dateChunks = chunks(snapshot.daily.map(row => row.date), 7);
  for (let pair = 0; pair < 3; pair++) for (const dates of dateChunks) {
    const tables = groups.slice(pair * 2, pair * 2 + 2).map(group => {
      const rows = dates.map(date => series?.dailyRows.find(row => row.groupKey === group.key && row.date === date));
      return [...rows.map((row, i) => [dates[i].slice(5).replace("-", "/"), ...(group.available && row ? metricCells(row.metrics) : dash(4))]), ["合計", ...(group.available ? metricCells(sum(rows.flatMap(row => row ? [row.metrics] : []))) : dash(4))]];
    });
    pages.push({ exemplar: 6 + pair, tables });
  }
  const treatmentExemplars: Array<[ReportSeriesGroupKey, number]> = [["alyssa-ads", 9], ["alyssa-medical-ads", 10], ["kol-traffic", 11], ["gos", 13], ["ib", 14], ["skin-light", 15]];
  for (const [key, exemplar] of treatmentExemplars) {
    const data = series?.treatmentRows.filter(row => row.groupKey === key) ?? [];
    const totalCells = (metrics: ReportMetrics) => ["本頁小計", ...metricCells(metrics), "", ""];
    const splits = paginateNativeRows(tableLayout(sourceSlides[exemplar - 1], 0), data.map(row => ({ values: [row.label, ...efficiencyCells(row.metrics)], metrics: row.metrics })), totalCells, 7);
    if (key === "kol-traffic" && splits.length === 1) splits.push([]);
    splits.forEach((rows, i) => {
      const source = key === "kol-traffic" && i > 0 ? 12 : exemplar;
      const titleId = ({ 9: 114, 10: 124, 11: 134, 12: 144, 13: 154, 14: 164, 15: 174 } as Record<number, number>)[source];
      const available = byGroup(key).available;
      pages.push({ exemplar: source, shapes: { [titleId]: `${byGroup(key).label} 療程成效${i > 0 ? "（續）" : ""}` }, tables: [[...rows.map(row => row.values), ...(rows.length ? [] : [[available ? "本期沒有療程記錄" : "未有可用資料", ...dash(6)]]), ["本頁小計", ...(available ? metricCells(sum(rows.map(row => row.metrics))) : dash(4)), "", ""]]] });
    });
  }
  const sourceKeys = ["AD", "KOL", "OG", "unclassified"] as const;
  const sourceValues = groups.map(group => sourceKeys.map(key => series?.arrivalSourceRows.find(row => row.groupKey === group.key && row.key === key)));
  pages.push({ exemplar: 16, shapes: { 210: sourceValues.some(rows => rows.some(row => !row?.available)) ? "未有可核對嘅到店來源資料" : "" }, tables: [[...groups.map((group, i) => [group.label, ...sourceValues[i].map(row => row?.available && row.shows !== null ? String(row.shows) : "—"), group.available ? String(group.metrics.shows) : "—"]), ["合計", ...sourceKeys.map((_, index) => sourceValues.every(rows => rows[index]?.available) ? String(sourceValues.reduce((count, rows) => count + (rows[index]?.shows ?? 0), 0)) : "—"), String(totals.shows)]]] });
  const audit = series?.auditRows ?? [];
  const primary = audit.filter(row => row.groupKey?.startsWith("alyssa-") || row.groupKey === "kol-traffic" || row.groupKey === null);
  const other = audit.filter(row => !primary.includes(row));
  for (const [rows, exemplar] of [[primary, 17], [other, 18]] as const) {
    const totalCells = (metrics: ReportMetrics) => ["本頁小計", "", ...metricCells(metrics)];
    const parts = paginateNativeRows(tableLayout(sourceSlides[exemplar - 1], 0), rows.map(row => ({ values: [row.groupLabel, `${row.accountLabel}\n${row.brandLabel}`, ...metricCells(row.metrics)], metrics: row.metrics })), totalCells, exemplar === 17 ? 4 : 3);
    for (const part of parts) pages.push({ exemplar, tables: [[...part.map(row => row.values), ...(part.length ? [] : [["本期沒有記錄", "", ...dash(4)]]), totalCells(sum(part.map(row => row.metrics)))]] });
  }
  return pages;
}

let templateBytes: Promise<Buffer> | undefined;
export async function renderReportPptx(snapshot: ReportSnapshot): Promise<Uint8Array> {
  templateBytes ??= readFile(path.join(process.cwd(), "assets", "report-templates", `${REPORT_PRESENTATION_TEMPLATE}.pptx`));
  const zip = await JSZip.loadAsync(await templateBytes);
  const sourceSlides = await Promise.all(Array.from({ length: 18 }, (_, i) => zip.file(`ppt/slides/slide${i + 1}.xml`)!.async("string")));
  const sourceRelationships = await Promise.all(Array.from({ length: 18 }, (_, i) => zip.file(`ppt/slides/_rels/slide${i + 1}.xml.rels`)!.async("string")));
  const pages = pagesFor(snapshot, sourceSlides.map(parse));
  const end = snapshot.current.startDate.slice(0, 4) === snapshot.current.endDate.slice(0, 4) ? snapshot.current.endDate.slice(5) : snapshot.current.endDate;
  const footer = `${snapshot.current.startDate.replaceAll("-", ".")}–${end.replaceAll("-", ".")}`;
  const footerIds = [0, 185, 196, 55, 66, 76, 89, 102, 115, 125, 135, 145, 155, 165, 175, 207, 218, 228];
  const pageIds = [0, 186, 197, 56, 67, 77, 90, 103, 116, 126, 136, 146, 156, 166, 176, 208, 219, 229];
  const serializer = new XMLSerializer();
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const slide = parse(sourceSlides[page.exemplar - 1]);
    Object.entries(page.shapes ?? {}).forEach(([id, text]) => setShape(slide, Number(id), text));
    if (page.exemplar > 1) { setShape(slide, footerIds[page.exemplar - 1], footer); setShape(slide, pageIds[page.exemplar - 1], String(i + 1).padStart(2, "0")); }
    page.tables?.forEach((rows, table) => setTable(slide, table, rows, page.exemplar !== 3));
    const xml = serializer.serializeToString(slide);
    if (/\{\{/.test(xml)) throw new Error("Unfilled report template slot");
    zip.file(`ppt/slides/slide${i + 1}.xml`, xml);
    zip.file(`ppt/slides/_rels/slide${i + 1}.xml.rels`, sourceRelationships[page.exemplar - 1]);
  }
  const presentation = parse(await zip.file("ppt/presentation.xml")!.async("string"));
  const list = elements(presentation, P, "sldIdLst")[0];
  while (list.firstChild) list.removeChild(list.firstChild);
  const relationships = parse(await zip.file("ppt/_rels/presentation.xml.rels")!.async("string"));
  elements(relationships, REL, "Relationship").filter(node => (node.getAttribute("Type") ?? "").endsWith("/slide")).forEach(node => node.parentNode!.removeChild(node));
  const contentTypes = parse(await zip.file("[Content_Types].xml")!.async("string"));
  elements(contentTypes, CT, "Override").filter(node => /^\/ppt\/slides\/slide\d+\.xml$/.test(node.getAttribute("PartName") ?? "")).forEach(node => node.parentNode!.removeChild(node));
  pages.forEach((_, i) => {
    const id = `rIdReportSlide${i + 1}`;
    const node = presentation.createElementNS(P, "p:sldId");
    node.setAttribute("id", String(256 + i)); node.setAttributeNS(R, "r:id", id); list.appendChild(node);
    const relation = relationships.createElementNS(REL, "Relationship");
    relation.setAttribute("Id", id); relation.setAttribute("Type", `${R}/slide`); relation.setAttribute("Target", `slides/slide${i + 1}.xml`); relationships.documentElement!.appendChild(relation);
    const content = contentTypes.createElementNS(CT, "Override");
    content.setAttribute("PartName", `/ppt/slides/slide${i + 1}.xml`); content.setAttribute("ContentType", "application/vnd.openxmlformats-officedocument.presentationml.slide+xml"); contentTypes.documentElement!.appendChild(content);
  });
  zip.file("ppt/presentation.xml", serializer.serializeToString(presentation));
  zip.file("ppt/_rels/presentation.xml.rels", serializer.serializeToString(relationships));
  zip.file("[Content_Types].xml", serializer.serializeToString(contentTypes));
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
