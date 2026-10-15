import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { DOMParser, XMLSerializer, type Document, type Element } from "@xmldom/xmldom";
import { reportMetrics } from "@/lib/reports/metrics";
import { REPORT_SERIES_GROUPS } from "@/lib/reports/seriesData";
import type { ReportMetrics, ReportRevenueMetrics, ReportSeriesGroupKey, ReportSnapshot } from "@/lib/reports/types";

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
type TableFit = { fontSize: number };
function applyTableFit(slide: Document, index: number, fit?: TableFit) {
  if (!fit) return;
  const layout = tableLayout(slide, index);
  const totalWidth = layout.columns.reduce((sum, width) => sum + width, 0);
  const widths = layout.columns.length === 7
    ? [totalWidth * 0.60, ...layout.columns.slice(1).map(width => width * totalWidth * 0.40 / (totalWidth - layout.columns[0]))]
    : [totalWidth * 0.22, totalWidth * 0.5, ...layout.columns.slice(2).map(width => width * totalWidth * 0.28 / layout.columns.slice(2).reduce((sum, value) => sum + value, 0))];
  direct(direct(layout.table, A, "tblGrid")[0], A, "gridCol").forEach((column, i) => column.setAttribute("w", String(Math.round(widths[i]))));
  const transform = direct(layout.frame, P, "xfrm")[0];
  direct(transform, A, "off")[0].setAttribute("y", String(150 * EMU_PER_PIXEL));
  layout.rows.forEach((row, i) => {
    row.setAttribute("h", "1");
    direct(row, A, "tc").forEach(cell => {
      const pointSize = Math.min(cellFont(cell) * 72 / 96, i === 0 ? 11 : fit.fontSize);
      [...elements(cell, A, "rPr"), ...elements(cell, A, "endParaRPr"), ...elements(cell, A, "defRPr")].forEach(style => style.setAttribute("sz", String(Math.round(pointSize * 100))));
      const properties = direct(cell, A, "tcPr")[0];
      if (properties) {
        properties.setAttribute("marT", String(Math.round(1.5 * EMU_PER_PIXEL)));
        properties.setAttribute("marB", String(Math.round(1.5 * EMU_PER_PIXEL)));
        properties.setAttribute("marL", String(6 * EMU_PER_PIXEL));
        properties.setAttribute("marR", String(6 * EMU_PER_PIXEL));
      }
    });
  });
  const header = layout.rows[0];
  header.setAttribute("h", String(measuredRowHeight(rowText(header), header, widths)));
}
/** Prefer one brand table: widen labels and reduce type before adding a page. */
function fitNativeRows(slide: Document, rows: DataRow[], totalCells: (metrics: ReportMetrics) => string[]) {
  const serializer = new XMLSerializer();
  const original = serializer.serializeToString(slide);
  const fits = (layout: TableLayout) => {
    const height = measuredRowHeight(rowText(layout.rows[0]), layout.rows[0], layout.columns)
      + measuredRowHeight(totalCells(sum(rows.map(row => row.metrics))), layout.rows.at(-1)!, layout.columns)
      + rows.reduce((height, row, i) => height + measuredRowHeight(row.values, layout.rows[1 + i % 2], layout.columns), 0);
    return layout.top + height <= CONTENT_BOTTOM;
  };
  let layout = tableLayout(slide, 0);
  if (fits(layout)) return { parts: rows.length ? [rows] : [[]], fit: undefined };
  let fit: TableFit = { fontSize: 11 };
  for (let fontSize = 18; fontSize >= 11; fontSize -= 0.5) {
    const trial = parse(original); fit = { fontSize }; applyTableFit(trial, 0, fit);
    layout = tableLayout(trial, 0);
    if (fits(layout)) return { parts: [rows], fit };
  }
  // Only genuinely oversized sets paginate, at the same bounded readable size.
  return { parts: paginateNativeRows(layout, rows, totalCells, Infinity), fit };
}
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
type Page = { exemplar: number; tables?: string[][][]; shapes?: Record<number, string>; tableFit?: TableFit; revenueFont?: number; revenueSummaries?: number[] };

/** Financial rows reuse the approved cost table's native cells and typography. */
function configureRevenueTable(slide: Document, fontSize: number) {
  const layout = tableLayout(slide, 0), grid = direct(layout.table, A, "tblGrid")[0];
  const totalWidth = layout.columns.reduce((a, b) => a + b, 0), weights = [36, 12, 12, 13, 10, 9, 8];
  const prototype = direct(grid, A, "gridCol").at(-1)!;
  while (direct(grid, A, "gridCol").length < 7) grid.appendChild(prototype.cloneNode(true));
  direct(grid, A, "gridCol").forEach((col, i) => col.setAttribute("w", String(Math.round(totalWidth * weights[i] / 100))));
  const headers = ["Account／療程", "試做收入 HK$", "開單收入 HK$", "總收益 HK$", "開單／到店", "開單率", "ROAS"];
  layout.rows.forEach((row, index) => {
    const last = direct(row, A, "tc").at(-1)!;
    while (direct(row, A, "tc").length < 7) row.appendChild(last.cloneNode(true));
    row.setAttribute("h", "1");
    direct(row, A, "tc").forEach((cell, i) => {
      if (!index) setText(cell, headers[i]);
      [...elements(cell, A, "rPr"), ...elements(cell, A, "endParaRPr"), ...elements(cell, A, "defRPr")].forEach(style => style.setAttribute("sz", String(Math.round((index ? fontSize : 11) * 100))));
      const props = direct(cell, A, "tcPr")[0];
      if (props) for (const [name, value] of [["marL", 6], ["marR", 6], ["marT", 2], ["marB", 2]] as const) props.setAttribute(name, String(value * EMU_PER_PIXEL));
    });
  });
  const transform = direct(layout.frame, P, "xfrm")[0];
  direct(transform, A, "off")[0].setAttribute("y", String(180 * EMU_PER_PIXEL));
}
function revenueCells(m: ReportRevenueMetrics) {
  return [money(m.trialRevenue), money(m.orderRevenue), money(m.totalRevenue), `${m.orderVisits}/${m.attendedVisits}`, rate(m.closeRate), m.roas === null ? "" : `${m.roas.toFixed(2)}×`];
}
function revenuePages(snapshot: ReportSnapshot, source: Document): Page[] {
  const revenue = snapshot.arrivalRevenue;
  if (!revenue?.accountRows.length) return [];
  const rows = revenue.accountRows.flatMap(account => [
    { summary: true, values: [account.label, ...revenueCells(account.metrics)] },
    ...revenue.treatmentRows.filter(t => t.accountId === account.accountId).map(t => ({ summary: false, values: [`${account.label}／${t.label}`, ...revenueCells(t.metrics)] })),
  ]);
  const total = ["所選 Account 合計", ...revenueCells(revenue.totals)];
  const original = new XMLSerializer().serializeToString(source);
  let fontSize = 18, layout: TableLayout;
  for (;; fontSize -= 0.5) {
    const trial = parse(original); configureRevenueTable(trial, fontSize); layout = tableLayout(trial, 0);
    const height = measuredRowHeight(rowText(layout.rows[0]), layout.rows[0], layout.columns) + measuredRowHeight(total, layout.rows.at(-1)!, layout.columns)
      + rows.reduce((h, r) => h + measuredRowHeight(r.values, layout.rows[1], layout.columns), 0);
    if (layout.top + height <= CONTENT_BOTTOM || fontSize <= 13) break;
  }
  const headerHeight = measuredRowHeight(rowText(layout!.rows[0]), layout!.rows[0], layout!.columns), totalHeight = measuredRowHeight(total, layout!.rows.at(-1)!, layout!.columns);
  const available = CONTENT_BOTTOM - layout!.top - headerHeight - totalHeight;
  const fragments = rows.flatMap(row => splitDataRow({ values: row.values, metrics: empty() }, layout!.rows[1], layout!.columns, available).map(part => ({ ...row, values: part.values })));
  const parts: typeof fragments[] = []; let current: typeof fragments = [], used = 0;
  for (const row of fragments) {
    const height = measuredRowHeight(row.values, layout!.rows[1], layout!.columns);
    if (current.length && used + height > available) { parts.push(current); current = []; used = 0; }
    current.push(row); used += height;
  }
  if (current.length) parts.push(current);
  return parts.map((part, i) => ({ exemplar: 3, revenueFont: fontSize, revenueSummaries: part.flatMap((r, index) => r.summary ? [index + 1] : []),
    shapes: { 194: "REVENUE", 195: `到店收益及開單率${i ? "（續）" : ""}` }, tables: [[...part.map(r => r.values), total]] }));
}

function pagesFor(snapshot: ReportSnapshot, sourceSlides: Document[]): Page[] {
  const series = snapshot.series;
  const groups = REPORT_SERIES_GROUPS.filter(group => !snapshot.selection.accountIds || series?.groupRows.some(row => row.key === group.key)).map(group => series?.groupRows.find(row => row.key === group.key) ?? { ...group, available: false, metrics: empty() });
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
    ...revenuePages(snapshot, sourceSlides[2]),
    { exemplar: 4, shapes: { 58: series?.warnings[0] ?? "" }, tables: [[...groups.map(group => [group.label, ...(group.available ? efficiencyCells(group.metrics) : dash(6))]), ["合計", ...efficiencyCells(totals)]]] },
  ];
  for (const daily of chunks(snapshot.daily, 7)) pages.push({ exemplar: 5, tables: [[...daily.map(row => [row.date.slice(5).replace("-", "/"), ...metricCells(row.metrics)]), ["合計", ...metricCells(sum(daily.map(row => row.metrics)))]]] });
  const dateChunks = chunks(snapshot.daily.map(row => row.date), 7);
  for (let pair = 0; pair < 3; pair++) for (const dates of dateChunks) {
    const pairGroups = REPORT_SERIES_GROUPS.slice(pair * 2, pair * 2 + 2).map(item => groups.find(group => group.key === item.key));
    if (pairGroups.every(group => !group)) continue;
    const tables = pairGroups.map(group => {
      if (!group) return [["未選取 Account", ...dash(4)], ["合計", ...dash(4)]];
      const rows = dates.map(date => series?.dailyRows.find(row => row.groupKey === group.key && row.date === date));
      return [...rows.map((row, i) => [dates[i].slice(5).replace("-", "/"), ...(group.available && row ? metricCells(row.metrics) : dash(4))]), ["合計", ...(group.available ? metricCells(sum(rows.flatMap(row => row ? [row.metrics] : []))) : dash(4))]];
    });
    const titleIds = [[78, 80], [91, 93], [104, 106]][pair];
    pages.push({ exemplar: 6 + pair, tables, shapes: Object.fromEntries(pairGroups.map((group, index) => [titleIds[index], group?.label ?? "未選取 Account"])) });
  }
  const treatmentExemplars: Array<[ReportSeriesGroupKey, number]> = [["alyssa-ads", 9], ["alyssa-medical-ads", 10], ["kol-traffic", 11], ["gos", 13], ["ib", 14], ["skin-light", 15]];
  for (const [key, exemplar] of treatmentExemplars) {
    if (!groups.some(group => group.key === key)) continue;
    const data = series?.treatmentRows.filter(row => row.groupKey === key) ?? [];
    const totalCells = (metrics: ReportMetrics) => ["本頁小計", ...metricCells(metrics), "", ""];
    const { parts: splits, fit } = fitNativeRows(sourceSlides[exemplar - 1], data.map(row => ({ values: [row.label, ...efficiencyCells(row.metrics)], metrics: row.metrics })), totalCells);
    splits.forEach((rows, i) => {
      const source = key === "kol-traffic" && i > 0 ? 12 : exemplar;
      const titleId = ({ 9: 114, 10: 124, 11: 134, 12: 144, 13: 154, 14: 164, 15: 174 } as Record<number, number>)[source];
      const available = byGroup(key).available;
      pages.push({ exemplar: source, tableFit: fit, shapes: { [titleId]: `${byGroup(key).label} 療程成效${i > 0 ? "（續）" : ""}` }, tables: [[...rows.map(row => row.values), ...(rows.length ? [] : [[available ? "本期沒有療程記錄" : "未有可用資料", ...dash(6)]]), [splits.length === 1 ? "合計" : "本頁小計", ...(available ? metricCells(sum(rows.map(row => row.metrics))) : dash(4)), "", ""]]] });
    });
  }
  const sourceKeys = ["AD", "KOL", "OG", "unclassified"] as const;
  const sourceValues = groups.map(group => sourceKeys.map(key => series?.arrivalSourceRows.find(row => row.groupKey === group.key && row.key === key)));
  pages.push({ exemplar: 16, shapes: { 210: sourceValues.some(rows => rows.some(row => !row?.available)) ? "未有可核對嘅到店來源資料" : "" }, tables: [[...groups.map((group, i) => [group.label, ...sourceValues[i].map(row => row?.available && row.shows !== null ? String(row.shows) : "—"), group.available ? String(group.metrics.shows) : "—"]), ["合計", ...sourceKeys.map((_, index) => sourceValues.every(rows => rows[index]?.available) ? String(sourceValues.reduce((count, rows) => count + (rows[index]?.shows ?? 0), 0)) : "—"), String(totals.shows)]]] });
  const audit = series?.auditRows ?? [];
  for (const [rows, exemplar] of [[audit, 17]] as const) {
    const totalCells = (metrics: ReportMetrics) => ["本頁小計", "", ...metricCells(metrics)];
    const { parts, fit } = fitNativeRows(sourceSlides[exemplar - 1], rows.map(row => ({ values: [row.groupLabel, `${row.accountLabel}\n${row.brandLabel}`, ...metricCells(row.metrics)], metrics: row.metrics })), totalCells);
    for (const part of parts) pages.push({ exemplar, tableFit: fit, tables: [[...part.map(row => row.values), ...(part.length ? [] : [["本期沒有記錄", "", ...dash(4)]]), totalCells(sum(part.map(row => row.metrics)))]] });
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
    if (page.revenueFont !== undefined) configureRevenueTable(slide, page.revenueFont);
    applyTableFit(slide, 0, page.tableFit);
    Object.entries(page.shapes ?? {}).forEach(([id, text]) => setShape(slide, Number(id), text));
    if (page.exemplar > 1) { setShape(slide, footerIds[page.exemplar - 1], footer); setShape(slide, pageIds[page.exemplar - 1], String(i + 1).padStart(2, "0")); }
    page.tables?.forEach((rows, table) => setTable(slide, table, rows, page.exemplar !== 3));
    if (page.revenueFont !== undefined) {
      const rows = tableLayout(slide, 0).rows;
      [...(page.revenueSummaries ?? []), rows.length - 1].forEach(index => elements(rows[index], A, "rPr").forEach(style => style.setAttribute("b", "1")));
    }
    const xml = serializer.serializeToString(slide);
    if (/\{\{/.test(xml)) throw new Error("Unfilled report template slot");
    zip.file(`ppt/slides/slide${i + 1}.xml`, xml);
    zip.file(`ppt/slides/_rels/slide${i + 1}.xml.rels`, sourceRelationships[page.exemplar - 1]);
  }
  // Selected Accounts can produce fewer pages than the approved base deck.
  // Remove unused source XML instead of retaining stale template values.
  for (let i = pages.length + 1; i <= sourceSlides.length; i++) {
    zip.remove(`ppt/slides/slide${i}.xml`);
    zip.remove(`ppt/slides/_rels/slide${i}.xml.rels`);
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
