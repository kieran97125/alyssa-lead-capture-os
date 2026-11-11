import { kolOfferLabels } from "@/lib/reports/kolPerformance";
import type { ReportKolRow } from "@/lib/reports/types";

export const KOL_PDF_WIDTHS = [15, 6, 14, 23, 6, 6, 6, 6, 6, 6, 6] as const;
export const KOL_PDF_LINE_HEIGHT = 11;
export const KOL_PDF_BODY_HEIGHT = 300;
const ROW_PADDING = 14;
const FONT_SIZE = 7.5;
const TABLE_INNER_WIDTH = 960 - 52 * 2 - 18;

export type KolPdfFragment = {
  row: ReportKolRow;
  rowIndex: number;
  textCells: string[];
  showMetrics: boolean;
  height: number;
};

// Conservative glyph widths keep explicit line breaks inside the native PDF
// cells, including long unbroken offer names. No characters are discarded.
function linesForCell(value: string, width: number) {
  const advanceFor = (character: string) => FONT_SIZE * (/^[\x20-\x7e]$/.test(character) ? 0.75 : 1.05);
  const lines: string[] = [];
  for (const paragraph of value.split("\n")) {
    let line = "", used = 0;
    for (const character of paragraph) {
      const advance = advanceFor(character);
      if (line && used + advance > width) {
        const space = line.lastIndexOf(" ");
        if (space > 0 && space < line.length - 1) {
          lines.push(line.slice(0, space + 1)); line = line.slice(space + 1);
          used = [...line].reduce((sum, glyph) => sum + advanceFor(glyph), 0);
        } else {
          lines.push(line); line = ""; used = 0;
        }
      }
      line += character; used += advance;
    }
    lines.push(line);
  }
  return lines;
}

/** Explicit pages repeat the section/table headers and count each KOL once. */
export function paginateKolPdfRows(rows: ReportKolRow[]) {
  const pages: KolPdfFragment[][] = [[]];
  let used = 0;
  const maxLines = Math.floor((KOL_PDF_BODY_HEIGHT - ROW_PADDING) / KOL_PDF_LINE_HEIGHT);
  rows.forEach((row, rowIndex) => {
    const cells = [row.accountLabel, row.kol, row.treatments.join("\n"), kolOfferLabels(row).join("\n")]
      .map((value, column) => linesForCell(value, TABLE_INNER_WIDTH * KOL_PDF_WIDTHS[column] / 100 - 4));
    const lineCount = Math.max(...cells.map(cell => cell.length));
    for (let start = 0; start < lineCount; start += maxLines) {
      const textCells = cells.map(cell => cell.slice(start, start + maxLines).join("\n"));
      const height = Math.min(maxLines, lineCount - start) * KOL_PDF_LINE_HEIGHT + ROW_PADDING;
      if (used && used + height > KOL_PDF_BODY_HEIGHT) {
        pages.push([]); used = 0;
      }
      pages.at(-1)!.push({ row, rowIndex, textCells, showMetrics: start === 0, height });
      used += height;
    }
  });
  return pages;
}
