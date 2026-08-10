import "server-only";

import path from "node:path";
import PptxGenJS from "pptxgenjs";
import {
  count,
  dateTimeHkt,
  deltaLabel,
  money,
  percentage,
  reportTheme,
  shortDate,
  stripHash,
  type ReportTheme,
} from "@/lib/reports/presentationUtils";
import type {
  ReportBreakdownRow,
  ReportNarrativeItem,
  ReportSnapshot,
} from "@/lib/reports/types";

const SH = 7.5;
const FONT = "Microsoft JhengHei";
const assetPath = (...parts: string[]) => path.join(process.cwd(), "public", ...parts);

function hex(value: string) {
  return stripHash(value);
}

function reportLogo(snapshot: ReportSnapshot) {
  const brand = snapshot.selection.brands.length === 1 ? snapshot.selection.brands[0] : null;
  if (brand?.logoKey === "ineffable") {
    return {
      path: assetPath("report-assets", "brands", "ineffable-beauty.png"),
      w: 2.05,
      h: 1.68,
    };
  }
  if (brand?.logoKey === "gos") {
    return {
      path: assetPath("report-assets", "brands", "gos-beauty.png"),
      w: 3.0,
      h: 1.2,
    };
  }
  return { path: assetPath("icons", "growth-os-512.png"), w: 1.18, h: 1.18 };
}

function addFooter(slide: PptxGenJS.Slide, snapshot: ReportSnapshot, pageNumber: number, theme: ReportTheme) {
  slide.addText(`${snapshot.reportId} · ${snapshot.metricContractVersion}`, {
    x: 0.65,
    y: 7.14,
    w: 9.7,
    h: 0.16,
    fontFace: FONT,
    fontSize: 8,
    color: hex(theme.muted),
    margin: 0,
  });
  slide.addText(String(pageNumber), {
    x: 12.0,
    y: 7.12,
    w: 0.65,
    h: 0.18,
    fontFace: FONT,
    fontSize: 8,
    color: hex(theme.muted),
    align: "right",
    margin: 0,
  });
  slide.addNotes(`Immutable aggregate snapshot ${snapshot.snapshotId}. SHA-256 ${snapshot.snapshotSha256}. No customer names, phone numbers, or CRM notes are included.`);
}

function addHeader(
  slide: PptxGenJS.Slide,
  snapshot: ReportSnapshot,
  theme: ReportTheme,
  pageNumber: number,
  kicker: string,
  title: string,
  subtitle?: string
) {
  slide.background = { color: "FFFFFF" };
  slide.addText(kicker.toUpperCase(), {
    x: 0.68,
    y: 0.42,
    w: 5.5,
    h: 0.22,
    fontFace: FONT,
    fontSize: 10,
    bold: true,
    color: hex(theme.accent),
    charSpacing: 1.7,
    margin: 0,
  });
  slide.addText(title, {
    x: 0.65,
    y: 0.74,
    w: 11.9,
    h: 0.56,
    fontFace: FONT,
    fontSize: 35,
    bold: true,
    color: hex(theme.dark),
    margin: 0,
    breakLine: false,
    fit: "shrink",
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.67,
      y: 1.38,
      w: 11.8,
      h: 0.32,
      fontFace: FONT,
      fontSize: 16,
      color: hex(theme.muted),
      margin: 0,
      breakLine: false,
      fit: "shrink",
    });
  }
  addFooter(slide, snapshot, pageNumber, theme);
}

function addMetricCard(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  theme: ReportTheme,
  input: { x: number; y: number; w: number; h: number; label: string; value: string; note: string }
) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x: input.x,
    y: input.y,
    w: input.w,
    h: input.h,
    rectRadius: 0.08,
    fill: { color: hex(theme.accentSoft), transparency: 12 },
    line: { color: hex(theme.line), width: 1 },
  });
  slide.addText(input.label, {
    x: input.x + 0.18,
    y: input.y + 0.16,
    w: input.w - 0.36,
    h: 0.2,
    fontFace: FONT,
    fontSize: 11,
    bold: true,
    color: hex(theme.muted),
    margin: 0,
  });
  slide.addText(input.value, {
    x: input.x + 0.18,
    y: input.y + 0.48,
    w: input.w - 0.36,
    h: 0.5,
    fontFace: FONT,
    fontSize: 27,
    bold: true,
    color: hex(theme.dark),
    margin: 0,
    fit: "shrink",
  });
  slide.addText(input.note, {
    x: input.x + 0.18,
    y: input.y + input.h - 0.36,
    w: input.w - 0.36,
    h: 0.22,
    fontFace: FONT,
    fontSize: 10,
    color: hex(theme.muted),
    margin: 0,
    fit: "shrink",
  });
}

function addNarrativeCard(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  theme: ReportTheme,
  item: ReportNarrativeItem,
  x: number,
  y: number,
  w: number,
  h = 0.86
) {
  const color = item.tone === "positive" ? theme.good : item.tone === "attention" ? theme.warning : theme.accent;
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.05,
    fill: { color: "FAF8F9" },
    line: { color: "FAF8F9", transparency: 100 },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x,
    y,
    w: 0.07,
    h,
    fill: { color: hex(color) },
    line: { color: hex(color), transparency: 100 },
  });
  slide.addText(item.title, {
    x: x + 0.22,
    y: y + 0.13,
    w: w - 0.35,
    h: 0.24,
    fontFace: FONT,
    fontSize: 16,
    bold: true,
    color: hex(theme.dark),
    margin: 0,
    fit: "shrink",
  });
  slide.addText(item.detail, {
    x: x + 0.22,
    y: y + 0.43,
    w: w - 0.35,
    h: h - 0.52,
    fontFace: FONT,
    fontSize: 11,
    color: hex(theme.muted),
    margin: 0,
    valign: "top",
    fit: "shrink",
  });
}

function addSectionLabel(slide: PptxGenJS.Slide, label: string, x: number, y: number, w: number, theme: ReportTheme) {
  slide.addText(label, {
    x,
    y,
    w,
    h: 0.28,
    fontFace: FONT,
    fontSize: 17,
    bold: true,
    color: hex(theme.dark),
    margin: 0,
  });
}

function chunks<T>(rows: T[], size: number) {
  return Array.from({ length: Math.ceil(rows.length / size) }, (_, index) => rows.slice(index * size, (index + 1) * size));
}

function addBreakdownTable(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  theme: ReportTheme,
  rows: ReportBreakdownRow[],
  treatment: boolean
) {
  const x = 0.67;
  const y = 1.94;
  const widths = [3.5, 1.15, 1.15, 1.15, 1.45, 1.45, 1.55];
  const labels = [treatment ? "療程／品牌" : "品牌", "Lead", "Book", "Show", "Book Rate", "Show-up", treatment ? "Spend" : "CPL"];
  let cursor = x;
  widths.forEach((w, index) => {
    slide.addShape(pptx.ShapeType.rect, {
      x: cursor,
      y,
      w,
      h: 0.48,
      fill: { color: hex(theme.dark) },
      line: { color: hex(theme.dark), width: 0.4 },
    });
    slide.addText(labels[index], {
      x: cursor + 0.08,
      y: y + 0.12,
      w: w - 0.16,
      h: 0.19,
      fontFace: FONT,
      fontSize: 11,
      bold: true,
      color: "FFFFFF",
      align: index === 0 ? "left" : "right",
      margin: 0,
      fit: "shrink",
    });
    cursor += w;
  });
  rows.forEach((row, rowIndex) => {
    const rowY = y + 0.48 + rowIndex * 0.48;
    const values = [
      `${row.label}\n${row.detail}`,
      count(row.metrics.leads),
      count(row.metrics.bookings),
      count(row.metrics.shows),
      percentage(row.metrics.bookRate),
      percentage(row.metrics.showUpRate),
      treatment ? "未分配" : money(row.metrics.cpl, 2),
    ];
    let cellX = x;
    widths.forEach((w, index) => {
      slide.addShape(pptx.ShapeType.rect, {
        x: cellX,
        y: rowY,
        w,
        h: 0.48,
        fill: { color: rowIndex % 2 ? "FAF8F9" : "FFFFFF" },
        line: { color: hex(theme.line), width: 0.45 },
      });
      slide.addText(values[index], {
        x: cellX + 0.08,
        y: rowY + (index === 0 ? 0.06 : 0.14),
        w: w - 0.16,
        h: index === 0 ? 0.36 : 0.18,
        fontFace: FONT,
        fontSize: index === 0 ? 10 : 11,
        bold: index === 0,
        color: index === 0 ? hex(theme.dark) : hex(theme.text),
        align: index === 0 ? "left" : "right",
        margin: 0,
        fit: "shrink",
      });
      cellX += w;
    });
  });
}

function addDailyTable(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  theme: ReportTheme,
  rows: ReportSnapshot["daily"]
) {
  const x = 0.67;
  const y = 1.94;
  const widths = [1.55, 1.75, 1.3, 1.3, 1.3, 1.3, 1.45, 1.55];
  const labels = ["日期", "Spend", "Lead", "Book", "Show", "No-show", "Pending", "CPL"];
  let cursor = x;
  widths.forEach((w, index) => {
    slide.addShape(pptx.ShapeType.rect, {
      x: cursor,
      y,
      w,
      h: 0.45,
      fill: { color: hex(theme.dark) },
      line: { color: hex(theme.dark), width: 0.4 },
    });
    slide.addText(labels[index], {
      x: cursor + 0.08,
      y: y + 0.11,
      w: w - 0.16,
      h: 0.18,
      fontFace: FONT,
      fontSize: 11,
      bold: true,
      color: "FFFFFF",
      align: index === 0 ? "left" : "right",
      margin: 0,
    });
    cursor += w;
  });
  rows.forEach((row, rowIndex) => {
    const rowY = y + 0.45 + rowIndex * 0.38;
    const values = [
      row.date,
      money(row.metrics.spend),
      count(row.metrics.leads),
      count(row.metrics.bookings),
      count(row.metrics.shows),
      count(row.metrics.noShows),
      count(row.metrics.pendingShows),
      money(row.metrics.cpl, 2),
    ];
    let cellX = x;
    widths.forEach((w, index) => {
      slide.addShape(pptx.ShapeType.rect, {
        x: cellX,
        y: rowY,
        w,
        h: 0.38,
        fill: { color: rowIndex % 2 ? "FAF8F9" : "FFFFFF" },
        line: { color: hex(theme.line), width: 0.4 },
      });
      slide.addText(values[index], {
        x: cellX + 0.08,
        y: rowY + 0.1,
        w: w - 0.16,
        h: 0.17,
        fontFace: FONT,
        fontSize: 10,
        color: hex(theme.text),
        align: index === 0 ? "left" : "right",
        margin: 0,
        fit: "shrink",
      });
      cellX += w;
    });
  });
}

function addCover(pptx: PptxGenJS, snapshot: ReportSnapshot, theme: ReportTheme, pageNumber: number) {
  const slide = pptx.addSlide();
  slide.background = { color: theme.coverLight ? "FFF9F4" : hex(theme.dark) };
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 0.16,
    h: SH,
    fill: { color: hex(theme.accent) },
    line: { color: hex(theme.accent), transparency: 100 },
  });
  slide.addText("ALYSSA GROWTH OS · MANAGEMENT REPORT", {
    x: 0.7,
    y: 0.58,
    w: 6.2,
    h: 0.22,
    fontFace: FONT,
    fontSize: 11,
    bold: true,
    color: theme.coverLight ? hex(theme.accent) : hex(theme.accentSoft),
    charSpacing: 1.7,
    margin: 0,
  });
  const logo = reportLogo(snapshot);
  slide.addImage({
    path: logo.path,
    x: 0.7,
    y: 1.15,
    w: logo.w,
    h: logo.h,
    altText: `${snapshot.selection.brandLabel} logo`,
  });
  slide.addText(snapshot.title, {
    x: 0.7,
    y: 3.08,
    w: 11.7,
    h: 1.18,
    fontFace: FONT,
    fontSize: 50,
    bold: true,
    color: theme.coverLight ? hex(theme.dark) : "FFFFFF",
    margin: 0,
    valign: "middle",
    fit: "shrink",
  });
  slide.addText(`${snapshot.current.startDate} — ${snapshot.current.endDate}`, {
    x: 0.72,
    y: 4.55,
    w: 5.6,
    h: 0.34,
    fontFace: FONT,
    fontSize: 19,
    color: theme.coverLight ? hex(theme.muted) : "EFDCE5",
    margin: 0,
  });
  const chips = [snapshot.selection.brandLabel, snapshot.comparison ? "上月同期對比" : "不作同期對比"];
  chips.forEach((label, index) => {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.72 + index * 2.35,
      y: 5.18,
      w: 2.12,
      h: 0.48,
      rectRadius: 0.1,
      fill: { color: theme.coverLight ? hex(theme.accentSoft) : hex(theme.darkSoft) },
      line: { color: theme.coverLight ? hex(theme.line) : hex(theme.darkSoft), transparency: 100 },
    });
    slide.addText(label, {
      x: 0.85 + index * 2.35,
      y: 5.33,
      w: 1.86,
      h: 0.18,
      fontFace: FONT,
      fontSize: 11,
      bold: true,
      color: theme.coverLight ? hex(theme.dark) : "FFFFFF",
      align: "center",
      margin: 0,
      fit: "shrink",
    });
  });
  slide.addText(`Snapshot ${snapshot.snapshotId}`, {
    x: 0.72,
    y: 6.9,
    w: 7.2,
    h: 0.18,
    fontFace: FONT,
    fontSize: 8,
    color: theme.coverLight ? hex(theme.muted) : "D8BCC9",
    margin: 0,
  });
  slide.addText(dateTimeHkt(snapshot.generatedAt), {
    x: 9.3,
    y: 6.88,
    w: 3.3,
    h: 0.18,
    fontFace: FONT,
    fontSize: 8,
    color: theme.coverLight ? hex(theme.muted) : "D8BCC9",
    align: "right",
    margin: 0,
  });
  slide.addNotes(`Cover. Immutable aggregate snapshot ${snapshot.snapshotId}. Page ${pageNumber}.`);
}

export async function renderReportPptx(snapshot: ReportSnapshot) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Alyssa Growth OS";
  pptx.company = "Alyssa Growth OS";
  pptx.subject = `${snapshot.current.label} performance report`;
  pptx.title = snapshot.title;
  pptx.theme = { headFontFace: FONT, bodyFontFace: FONT };
  pptx.defineSlideMaster({
    title: "GROWTH_OS_BLANK",
    background: { color: "FFFFFF" },
    objects: [],
    slideNumber: { x: 12.0, y: 7.12, w: 0.65, h: 0.18, fontFace: FONT, fontSize: 8, color: "8F7884", align: "right", margin: 0 },
  });

  const theme = reportTheme(snapshot);
  const previous = snapshot.comparison?.totals ?? null;
  let pageNumber = 1;
  addCover(pptx, snapshot, theme, pageNumber++);

  {
    const slide = pptx.addSlide();
    addHeader(slide, snapshot, theme, pageNumber++, "Executive overview", "管理層一頁摘要", "PDF 與 PPTX 共用同一份不可修改彙總快照。 ");
    const cards = [
      ["廣告費", money(snapshot.current.totals.spend), "Daily Spend Ledger"],
      ["Lead", count(snapshot.current.totals.leads), "查詢日期歸屬"],
      ["Book", count(snapshot.current.totals.bookings), `${percentage(snapshot.current.totals.bookRate)} Book Rate`],
      ["Show", count(snapshot.current.totals.shows), `${percentage(snapshot.current.totals.showUpRate)} Show-up`],
    ];
    cards.forEach(([label, value, note], index) => addMetricCard(pptx, slide, theme, {
      x: 0.68 + index * 3.08,
      y: 1.92,
      w: 2.84,
      h: 1.42,
      label,
      value,
      note,
    }));
    addSectionLabel(slide, "轉換效率", 0.7, 3.72, 5.4, theme);
    const rates = [
      ["Lead → Book", percentage(snapshot.current.totals.bookRate), deltaLabel(snapshot.current.totals.bookRate, previous?.bookRate ?? null)],
      ["Book → Show", percentage(snapshot.current.totals.showUpRate), deltaLabel(snapshot.current.totals.showUpRate, previous?.showUpRate ?? null)],
      ["Lead → Show", percentage(snapshot.current.totals.leadToShowRate), deltaLabel(snapshot.current.totals.leadToShowRate, previous?.leadToShowRate ?? null)],
    ];
    rates.forEach(([label, value, delta], index) => {
      const y = 4.15 + index * 0.74;
      slide.addText(label, { x: 0.72, y, w: 2.2, h: 0.25, fontFace: FONT, fontSize: 16, color: hex(theme.text), margin: 0 });
      slide.addText(value, { x: 3.0, y: y - 0.04, w: 1.25, h: 0.32, fontFace: FONT, fontSize: 21, bold: true, color: hex(theme.dark), align: "right", margin: 0 });
      slide.addText(delta, { x: 4.45, y: y + 0.03, w: 1.55, h: 0.2, fontFace: FONT, fontSize: 10, color: hex(theme.muted), align: "right", margin: 0, fit: "shrink" });
      slide.addShape(pptx.ShapeType.line, { x: 0.72, y: y + 0.42, w: 5.28, h: 0, line: { color: hex(theme.line), width: 0.6 } });
    });
    addSectionLabel(slide, "即時判讀", 6.45, 3.72, 5.9, theme);
    snapshot.insights.slice(0, 3).forEach((item, index) => addNarrativeCard(pptx, slide, theme, item, 6.45, 4.12 + index * 0.86, 6.18, 0.74));
  }

  {
    const slide = pptx.addSlide();
    addHeader(slide, snapshot, theme, pageNumber++, "Funnel", "漏斗量與轉換", "Book、Show、No-show 及 Pending Show 來自 Lead Sheet 狀態彙總。 ");
    const funnel = [
      ["Lead", snapshot.current.totals.leads, theme.accent],
      ["Book", snapshot.current.totals.bookings, theme.darkSoft],
      ["Show", snapshot.current.totals.shows, theme.good],
    ] as const;
    const max = Math.max(1, snapshot.current.totals.leads);
    funnel.forEach(([label, value, color], index) => {
      const y = 2.18 + index * 1.12;
      slide.addText(label, { x: 0.75, y, w: 1.3, h: 0.28, fontFace: FONT, fontSize: 18, bold: true, color: hex(theme.dark), margin: 0 });
      slide.addText(count(value), { x: 5.95, y, w: 0.95, h: 0.28, fontFace: FONT, fontSize: 18, bold: true, color: hex(theme.dark), align: "right", margin: 0 });
      slide.addShape(pptx.ShapeType.roundRect, { x: 0.75, y: y + 0.42, w: 6.15, h: 0.38, rectRadius: 0.08, fill: { color: hex(theme.accentSoft) }, line: { color: hex(theme.accentSoft), transparency: 100 } });
      slide.addShape(pptx.ShapeType.roundRect, { x: 0.75, y: y + 0.42, w: Math.max(0.18, (value / max) * 6.15), h: 0.38, rectRadius: 0.08, fill: { color: hex(color) }, line: { color: hex(color), transparency: 100 } });
    });
    slide.addShape(pptx.ShapeType.roundRect, { x: 7.55, y: 2.0, w: 5.05, h: 3.9, rectRadius: 0.08, fill: { color: "FAF8F9" }, line: { color: hex(theme.line), width: 0.7 } });
    addSectionLabel(slide, "漏斗狀態", 7.9, 2.34, 4.3, theme);
    const states = [
      ["已到店 Show", count(snapshot.current.totals.shows)],
      ["No-show", count(snapshot.current.totals.noShows)],
      ["待到店 Pending", count(snapshot.current.totals.pendingShows)],
      ["Lead → Show", percentage(snapshot.current.totals.leadToShowRate)],
    ];
    states.forEach(([label, value], index) => {
      const y = 2.92 + index * 0.69;
      slide.addText(label, { x: 7.92, y, w: 2.6, h: 0.23, fontFace: FONT, fontSize: 15, color: hex(theme.muted), margin: 0 });
      slide.addText(value, { x: 10.55, y: y - 0.03, w: 1.65, h: 0.28, fontFace: FONT, fontSize: 18, bold: true, color: hex(theme.dark), align: "right", margin: 0 });
      slide.addShape(pptx.ShapeType.line, { x: 7.92, y: y + 0.39, w: 4.28, h: 0, line: { color: hex(theme.line), width: 0.6 } });
    });
  }

  {
    const slide = pptx.addSlide();
    addHeader(slide, snapshot, theme, pageNumber++, "Daily trend", "每日成效走勢", "原生 PowerPoint 圖表，可自行改色、改標籤或重排。 ");
    const labels = snapshot.daily.map((row) => shortDate(row.date));
    slide.addChart(
      pptx.ChartType.line,
      [
        { name: "Lead", labels, values: snapshot.daily.map((row) => row.metrics.leads) },
        { name: "Book", labels, values: snapshot.daily.map((row) => row.metrics.bookings) },
        { name: "Show", labels, values: snapshot.daily.map((row) => row.metrics.shows) },
      ],
      {
        x: 0.72,
        y: 1.95,
        w: 11.9,
        h: 4.75,
        chartColors: [hex(theme.accent), hex(theme.darkSoft), hex(theme.good)],
        showLegend: true,
        legendPos: "b",
        legendFontFace: FONT,
        legendFontSize: 13,
        showTitle: false,
        showValue: false,
        catAxisLabelFontFace: FONT,
        catAxisLabelFontSize: 10,
        valAxisLabelFontFace: FONT,
        valAxisLabelFontSize: 10,
        showValAxisTitle: false,
        showCatAxisTitle: false,
        valGridLine: { color: hex(theme.line), size: 0.6 },
        lineSize: 2.5,
        lineDataSymbol: "circle",
        lineDataSymbolSize: 4,
        altText: "每日 Lead、Book、Show 走勢",
      }
    );
  }

  {
    const slide = pptx.addSlide();
    addHeader(slide, snapshot, theme, pageNumber++, "Efficiency", "成本效率與同期變化", snapshot.comparison ? `比較窗口：${snapshot.comparison.label}` : "今次未有啟用同期比較。 ");
    const metrics = [
      ["CPL", money(snapshot.current.totals.cpl, 2), snapshot.current.totals.cpl, previous?.cpl ?? null],
      ["CPA · Book", money(snapshot.current.totals.costPerBooking, 2), snapshot.current.totals.costPerBooking, previous?.costPerBooking ?? null],
      ["CPA · Show", money(snapshot.current.totals.costPerShow, 2), snapshot.current.totals.costPerShow, previous?.costPerShow ?? null],
      ["Lead", count(snapshot.current.totals.leads), snapshot.current.totals.leads, previous?.leads ?? null],
      ["Book", count(snapshot.current.totals.bookings), snapshot.current.totals.bookings, previous?.bookings ?? null],
      ["Show", count(snapshot.current.totals.shows), snapshot.current.totals.shows, previous?.shows ?? null],
    ] as const;
    metrics.forEach(([label, value, current, prior], index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      addMetricCard(pptx, slide, theme, {
        x: 0.72 + col * 4.13,
        y: 2.0 + row * 2.18,
        w: 3.82,
        h: 1.82,
        label,
        value,
        note: `${deltaLabel(current, prior)} vs 上月同期`,
      });
    });
  }

  {
    const slide = pptx.addSlide();
    addHeader(slide, snapshot, theme, pageNumber++, "Media mix", "廣告費渠道組合", "只採用 Daily Spend Ledger；舊資料未分類會獨立顯示。 ");
    snapshot.spendMix.forEach((row, index) => {
      const y = 2.02 + index * 0.88;
      slide.addText(row.label, { x: 0.75, y, w: 3.4, h: 0.24, fontFace: FONT, fontSize: 16, bold: true, color: hex(theme.dark), margin: 0 });
      slide.addText(`${money(row.amount, 2)} · ${percentage(row.share)}`, { x: 9.3, y, w: 3.2, h: 0.24, fontFace: FONT, fontSize: 14, color: hex(theme.text), align: "right", margin: 0 });
      slide.addShape(pptx.ShapeType.roundRect, { x: 0.75, y: y + 0.36, w: 11.75, h: 0.26, rectRadius: 0.06, fill: { color: hex(theme.accentSoft) }, line: { color: hex(theme.accentSoft), transparency: 100 } });
      slide.addShape(pptx.ShapeType.roundRect, { x: 0.75, y: y + 0.36, w: Math.max(row.amount > 0 ? 0.18 : 0, (row.share ?? 0) * 11.75), h: 0.26, rectRadius: 0.06, fill: { color: row.key === "legacy_unclassified" ? hex(theme.warning) : hex(theme.accent) }, line: { color: row.key === "legacy_unclassified" ? hex(theme.warning) : hex(theme.accent), transparency: 100 } });
    });
  }

  const brandPages = snapshot.selection.breakdowns.includes("brand") ? chunks(snapshot.brandRows, 9) : [];
  brandPages.forEach((rows, index) => {
    const slide = pptx.addSlide();
    addHeader(slide, snapshot, theme, pageNumber++, "Breakdown · Brand", `按品牌拆分${brandPages.length > 1 ? ` (${index + 1}/${brandPages.length})` : ""}`, "品牌層可歸屬 Daily Spend，因此顯示 CPL。 ");
    addBreakdownTable(pptx, slide, theme, rows, false);
  });

  const treatmentPages = snapshot.selection.breakdowns.includes("treatment") ? chunks(snapshot.treatmentRows, 9) : [];
  treatmentPages.forEach((rows, index) => {
    const slide = pptx.addSlide();
    addHeader(slide, snapshot, theme, pageNumber++, "Breakdown · Treatment", `按療程拆分${treatmentPages.length > 1 ? ` (${index + 1}/${treatmentPages.length})` : ""}`, "Spend 只到品牌層；療程頁不估算或攤分 Spend／CPL。 ");
    addBreakdownTable(pptx, slide, theme, rows, true);
  });

  {
    const slide = pptx.addSlide();
    addHeader(slide, snapshot, theme, pageNumber++, "Decision support", "洞察與下一步", "規則式判讀由快照數字直接產生，不加入無來源推測。 ");
    addSectionLabel(slide, "數據洞察", 0.72, 1.95, 5.7, theme);
    addSectionLabel(slide, "建議行動", 6.75, 1.95, 5.7, theme);
    snapshot.insights.forEach((item, index) => addNarrativeCard(pptx, slide, theme, item, 0.72, 2.4 + index * 1.02, 5.72, 0.88));
    snapshot.actions.forEach((item, index) => addNarrativeCard(pptx, slide, theme, item, 6.75, 2.4 + index * 1.15, 5.85, 1.0));
  }

  chunks(snapshot.daily, 11).forEach((rows, index, all) => {
    const slide = pptx.addSlide();
    addHeader(slide, snapshot, theme, pageNumber++, "Audit table", `每日數據核對${all.length > 1 ? ` (${index + 1}/${all.length})` : ""}`, "每行均可追溯到同一 report snapshot；不包含客戶個人資料。 ");
    addDailyTable(pptx, slide, theme, rows);
  });

  {
    const slide = pptx.addSlide();
    addHeader(slide, snapshot, theme, pageNumber++, "Data contract", "數據品質與口徑", `快照 SHA-256：${snapshot.snapshotSha256}`);
    slide.addShape(pptx.ShapeType.roundRect, { x: 0.72, y: 2.0, w: 4.7, h: 4.25, rectRadius: 0.08, fill: { color: hex(theme.accentSoft) }, line: { color: hex(theme.line), width: 0.7 } });
    addSectionLabel(slide, "本次品質狀態", 1.02, 2.35, 3.9, theme);
    const qualityLabel = snapshot.dataQuality.status === "complete" ? "完整" : snapshot.dataQuality.status === "missing" ? "未有數據" : "部分完整";
    slide.addText(qualityLabel, { x: 1.0, y: 2.86, w: 3.9, h: 0.58, fontFace: FONT, fontSize: 31, bold: true, color: snapshot.dataQuality.status === "complete" ? hex(theme.good) : snapshot.dataQuality.status === "missing" ? hex(theme.warning) : hex(theme.accent), margin: 0 });
    const qualityRows = [
      `Lead Sheet：${snapshot.dataQuality.sourceStatus}`,
      `最後同步：${dateTimeHkt(snapshot.dataQuality.sourceLastSuccessAt)}`,
      `Spend 完整品牌日：${snapshot.dataQuality.spendCompleteBrandDays}/${snapshot.dataQuality.spendExpectedBrandDays}`,
      `彙總行：${count(snapshot.dataQuality.factRows)} · Spend 行：${count(snapshot.dataQuality.spendRows)}`,
    ];
    qualityRows.forEach((text, index) => slide.addText(text, { x: 1.02, y: 3.7 + index * 0.47, w: 3.92, h: 0.24, fontFace: FONT, fontSize: 14, color: hex(theme.muted), margin: 0, fit: "shrink" }));
    addSectionLabel(slide, "指標定義", 5.92, 2.02, 6.2, theme);
    const definitions = [
      ["Book Rate", "Book ÷ Lead"],
      ["Show-up Rate", "Show ÷ Book"],
      ["CPL", "品牌層 Spend ÷ Lead"],
      ["CPA · Book / Show", "品牌層 Spend ÷ Book / Show"],
      ["療程 Spend", "未分配；不作推算"],
      ["同期", "上月相同日號窗口，月底按實際日數截短"],
    ];
    definitions.forEach(([label, detail], index) => {
      const y = 2.55 + index * 0.58;
      slide.addText(label, { x: 5.92, y, w: 2.15, h: 0.24, fontFace: FONT, fontSize: 14, bold: true, color: hex(theme.dark), margin: 0 });
      slide.addText(detail, { x: 8.15, y, w: 4.0, h: 0.24, fontFace: FONT, fontSize: 14, color: hex(theme.muted), margin: 0, fit: "shrink" });
      slide.addShape(pptx.ShapeType.line, { x: 5.92, y: y + 0.37, w: 6.25, h: 0, line: { color: hex(theme.line), width: 0.5 } });
    });
    snapshot.dataQuality.warnings.slice(0, 2).forEach((warning, index) => slide.addText(`• ${warning}`, { x: 5.92, y: 6.18 + index * 0.3, w: 6.2, h: 0.24, fontFace: FONT, fontSize: 10, color: hex(theme.warning), margin: 0, fit: "shrink" }));
  }

  const output = await pptx.write({ outputType: "uint8array", compression: true });
  if (!(output instanceof Uint8Array)) {
    throw new Error("PPTX renderer returned an unexpected output type.");
  }
  return output;
}
