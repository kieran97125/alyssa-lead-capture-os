import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";
import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = fileURLToPath(new URL("../", import.meta.url));
const cache = new Map();
function load(filename) {
  if (cache.has(filename)) return cache.get(filename);
  const source = readFileSync(path.join(root, filename), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const loadedModule = { exports: {} };
  cache.set(filename, loadedModule.exports);
  vm.runInNewContext(output, {
    module: loadedModule, exports: loadedModule.exports, process, Buffer, console, URL, TextEncoder, TextDecoder,
    require(id) { return id === "server-only" ? {} : id.startsWith("@/") ? load(`src/${id.slice(2)}.ts`) : require(id); },
  }, { filename });
  return loadedModule.exports;
}
const { renderReportPptx } = load("src/lib/reports/pptx.ts");
const { reportMetrics } = load("src/lib/reports/metrics.ts");
const { REPORT_SERIES_GROUPS } = load("src/lib/reports/seriesData.ts");
const A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const REL = "http://schemas.openxmlformats.org/package/2006/relationships";
const parse = text => new DOMParser().parseFromString(text.replace(/^\uFEFF/, ""), "application/xml");
const nodes = (root, namespace, name) => Array.from(root.getElementsByTagNameNS(namespace, name));
const child = (root, namespace, name) => Array.from(root.childNodes).filter(node => node.nodeType === 1 && node.namespaceURI === namespace && node.localName === name);
const text = element => nodes(element, A, "t").map(node => node.textContent).join("");
const serializer = new XMLSerializer();
const zero = () => reportMetrics({ leads: 0, bookings: 0, shows: 0, noShows: 0, pendingShows: 0 }, null);
function total(metrics) {
  const counts = { leads: 0, bookings: 0, shows: 0, noShows: 0, pendingShows: 0 };
  for (const metric of metrics) for (const key of Object.keys(counts)) counts[key] += metric[key];
  const spend = metrics.flatMap(metric => metric.spend === null ? [] : [metric.spend]);
  return reportMetrics(counts, spend.length ? spend.reduce((a, b) => a + b, 0) : null);
}
function fixture({ days = 7, treatments = 1, restricted = false } = {}) {
  const dates = Array.from({ length: days }, (_, index) => new Date(Date.UTC(2028, 1, 3 + index)).toISOString().slice(0, 10));
  const groupRows = REPORT_SERIES_GROUPS.map(group => ({ ...group, available: !restricted || group.key === "gos", metrics: zero() }));
  const dailyRows = groupRows.filter(group => group.available).flatMap((group, index) => dates.map((date, day) => ({ groupKey: group.key, date, metrics: reportMetrics({ leads: index + day + 1, bookings: day % 3, shows: day % 2, noShows: day === 2 ? 1 : 0, pendingShows: 0 }, group.key === "gos" ? 0 : group.key === "ib" || group.key === "kol-traffic" ? null : 100 + index) })));
  for (const group of groupRows) group.metrics = total(dailyRows.filter(row => row.groupKey === group.key).map(row => row.metrics));
  const treatmentRows = groupRows.filter(group => group.available).flatMap(group => Array.from({ length: group.key === "gos" ? treatments : 1 }, (_, index) => ({ groupKey: group.key, key: `${group.key}:${index}`, label: `${group.key}:療程 ${index + 1} & <緊緻> \"A\" 'B'`, metrics: index ? zero() : { ...group.metrics, spend: null } })));
  const auditRows = groupRows.filter(group => group.available).map(group => ({ key: group.key, groupKey: group.key, groupLabel: group.label, accountLabel: `${group.label} & <Account>`, brandLabel: `Brand \"${group.key}\"`, metrics: { ...group.metrics, spend: null } }));
  const daily = dates.map(date => ({ date, metrics: total(dailyRows.filter(row => row.date === date).map(row => row.metrics)) }));
  return { schemaVersion: 1, metricContractVersion: "growth-os-report-v1", reportId: "QA-FIXTURE", snapshotId: "QA-SNAPSHOT", snapshotSha256: "a".repeat(64), generatedAt: "2028-02-03T00:00:00Z", generatedBy: { memberId: null, identifier: "QA" }, title: "QA report", selection: { brandScope: restricted ? "gos" : "all", brandLabel: "QA", brands: [], breakdowns: ["brand", "treatment"] }, current: { startDate: dates[0], endDate: dates.at(-1), label: "QA 2028 February", totals: total(groupRows.map(row => row.metrics)) }, comparison: null, daily, brandRows: [], treatmentRows: [], spendMix: [], insights: [], actions: [], dataQuality: { status: "partial", sourceName: "QA", sourceStatus: "ready", sourceLastSuccessAt: null, spendCompleteBrandDays: 1, spendExpectedBrandDays: days * 6, factRows: 1, spendRows: 1, warnings: [] }, sources: [], series: { version: "cs-ad-series-v1", available: true, warnings: [], groupRows, dailyRows, treatmentRows, auditRows, arrivalSourceRows: groupRows.flatMap(group => ["AD", "KOL", "OG", "unclassified"].map(key => ({ groupKey: group.key, key, label: key, shows: null, noShows: null, pendingShows: null, available: false }))) } };
}
const template = await JSZip.loadAsync(readFileSync(path.join(root, "assets/report-templates/cs-ad-series-v1.pptx")));
async function inspect(bytes) {
  const zip = await JSZip.loadAsync(bytes);
  const slideNames = Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort((a, b) => Number(a.match(/slide(\d+)/)[1]) - Number(b.match(/slide(\d+)/)[1]));
  const slides = await Promise.all(slideNames.map(async name => parse(await zip.file(name).async("string"))));
  const allText = slides.flatMap(slide => nodes(slide, A, "t").map(node => node.textContent)).join("\n");
  assert.ok(!/\{\{|2026[.年\-/]|10月7日新增44個Lead|其他渠道未有資料|到店來源未分類5個/.test(allText), "No placeholders or stale values may reach an export");
  assert.ok(!Object.keys(zip.files).some(name => /notesSlides|notesMasters/.test(name)), "Exports must not retain private source notes");
  for (const name of Object.keys(template.files).filter(name => /^ppt\/(fonts|theme|slideMasters|slideLayouts)\//.test(name) && !template.files[name].dir)) {
    assert.deepEqual(await zip.file(name).async("nodebuffer"), await template.file(name).async("nodebuffer"), `Preserve approved fonts, theme, masters and layouts: ${name}`);
  }
  const presentation = parse(await zip.file("ppt/presentation.xml").async("string"));
  assert.equal(nodes(presentation, P, "sldId").length, slides.length);
  const rels = parse(await zip.file("ppt/_rels/presentation.xml.rels").async("string"));
  assert.equal(nodes(rels, REL, "Relationship").filter(node => node.getAttribute("Type").endsWith("/slide")).length, slides.length);
  const slideIds = nodes(presentation, P, "sldId").map(node => node.getAttribute("id"));
  assert.equal(new Set(slideIds).size, slides.length, "Every duplicated page has a unique presentation slide ID");
  for (const name of Object.keys(zip.files).filter(name => name.endsWith(".rels"))) {
    const relationships = parse(await zip.file(name).async("string"));
    for (const relationship of nodes(relationships, REL, "Relationship")) {
      if (relationship.getAttribute("TargetMode") === "External") continue;
      const target = relationship.getAttribute("Target");
      const base = name === "_rels/.rels" ? "" : path.posix.dirname(path.posix.dirname(name));
      const resolved = target.startsWith("/") ? target.slice(1) : path.posix.normalize(path.posix.join(base, target));
      assert.ok(zip.file(resolved), `Internal package relationship resolves: ${name} -> ${resolved}`);
    }
  }
  for (const [index, slide] of slides.entries()) {
    if (index) {
      const shapes = nodes(slide, P, "sp");
      assert.ok(shapes.some(shape => text(shape) === String(index + 1).padStart(2, "0")), `Footer page number on page ${index + 1}`);
    }
    for (const frame of nodes(slide, P, "graphicFrame")) {
      const transform = child(frame, P, "xfrm")[0];
      const offset = child(transform, A, "off")[0]; const extent = child(transform, A, "ext")[0];
      const x = Number(offset.getAttribute("x")); const y = Number(offset.getAttribute("y"));
      const width = Number(extent.getAttribute("cx")); const height = Number(extent.getAttribute("cy"));
      const table = nodes(frame, A, "tbl")[0];
      if (!table) continue;
      const actualHeight = child(table, A, "tr").reduce((sum, row) => sum + Number(row.getAttribute("h")), 0);
      assert.equal(height, actualHeight, `Native table frame height must match all rows on page ${index + 1}`);
      assert.ok(x >= 0 && y >= 0 && x + width <= 12192000 && y + height <= 6350000, `Native table exceeds content canvas on page ${index + 1}`);
    }
  }
  return { zip, slides, allText, tableCount: slides.reduce((sum, slide) => sum + nodes(slide, A, "tbl").length, 0) };
}
const tables = slide => nodes(slide, A, "tbl").map(table => child(table, A, "tr").map(row => child(row, A, "tc").map(text)));
const baseSnapshot = fixture();
const baseBytes = await renderReportPptx(baseSnapshot);
const base = await inspect(baseBytes);
assert.equal(base.slides.length, 18, "The approved seven-day report uses its 18-page structure");
assert.equal(base.tableCount, 20, "All 20 tables remain native and editable");
assert.equal(tables(base.slides[1])[0].find(row => row[0] === "GOS Beauty")[1], "0.00", "Explicit zero advertising spend remains zero");
assert.equal(tables(base.slides[1])[0].find(row => row[0] === "Ineffable Beauty")[1], "未有資料", "Missing spend is never a zero");
assert.equal(tables(base.slides[2])[0].find(row => row[0] === "Ineffable Beauty")[3], "未有資料", "Missing costs remain unavailable");
assert.equal(tables(base.slides[1])[0].find(row => row[0] === "GOS Beauty")[2], "2/3–9", "Spend period uses the approved compact same-month form");
assert.equal(tables(base.slides[2])[0].find(row => row[0] === "GOS Beauty")[1], "2/3–9", "Cost period fits the approved narrow column");
assert.ok(base.allText.includes('gos:療程 1 & <緊緻> "A" \'B\''), "Special XML characters round-trip as exact editable text");
assert.ok((await base.zip.file("ppt/slides/slide13.xml").async("string")).includes("&amp;"), "XML ampersands are escaped");
for (const [index, slide] of base.slides.entries()) {
  const original = parse(await template.file(`ppt/slides/slide${index + 1}.xml`).async("string"));
  const shapes = nodes(slide, P, "sp");
  for (const shape of nodes(original, P, "sp")) {
    const id = nodes(shape, P, "cNvPr")[0].getAttribute("id");
    const actual = shapes.find(node => nodes(node, P, "cNvPr")[0].getAttribute("id") === id);
    assert.ok(actual, `Retain approved native shape ${index + 1}:${id}`);
    assert.equal(serializer.serializeToString(child(actual, P, "spPr")[0]), serializer.serializeToString(child(shape, P, "spPr")[0]), `Shape position, fill and geometry retained ${index + 1}:${id}`);
    const expectedRun = nodes(shape, A, "rPr")[0]; const actualRun = nodes(actual, A, "rPr")[0];
    if (expectedRun) assert.equal(serializer.serializeToString(actualRun), serializer.serializeToString(expectedRun), `Shape typography retained ${index + 1}:${id}`);
  }
  const actualTables = nodes(slide, A, "tbl"); const expectedTables = nodes(original, A, "tbl");
  actualTables.forEach((table, tableIndex) => {
    const expected = expectedTables[tableIndex];
    for (const tag of ["tblPr", "tblGrid"]) assert.equal(serializer.serializeToString(child(table, A, tag)[0]), serializer.serializeToString(child(expected, A, tag)[0]), `Table grid and style retained ${index + 1}`);
    assert.equal(serializer.serializeToString(child(table, A, "tr")[0]), serializer.serializeToString(child(expected, A, "tr")[0]), `Table header retained ${index + 1}`);
    const actualRows = child(table, A, "tr"); const originalRows = child(expected, A, "tr");
    const hasTotal = index !== 2;
    actualRows.slice(1).forEach((row, rowIndex) => {
      const prototype = hasTotal && rowIndex === actualRows.length - 2 ? originalRows.at(-1) : originalRows[1 + rowIndex % 2];
      const expectedCells = child(prototype, A, "tc");
      child(row, A, "tc").forEach((cell, column) => {
        assert.equal(serializer.serializeToString(child(cell, A, "tcPr")[0]), serializer.serializeToString(child(expectedCells[column], A, "tcPr")[0]), `Table cell fill, borders and margins retained ${index + 1}:${rowIndex}:${column}`);
        const actualFont = nodes(cell, A, "rPr")[0]; const expectedFont = nodes(expectedCells[column], A, "rPr")[0];
        assert.equal(actualFont ? serializer.serializeToString(actualFont) : "", expectedFont ? serializer.serializeToString(expectedFont) : "", `Table data fonts and sizes retained ${index + 1}:${rowIndex}:${column}`);
      });
    });
  });
  nodes(slide, P, "graphicFrame").forEach((frame, frameIndex) => {
    const expected = nodes(original, P, "graphicFrame")[frameIndex];
    const transform = child(frame, P, "xfrm")[0]; const expectedTransform = child(expected, P, "xfrm")[0];
    assert.equal(serializer.serializeToString(child(transform, A, "off")[0]), serializer.serializeToString(child(expectedTransform, A, "off")[0]), `Table position retained ${index + 1}`);
    assert.equal(child(transform, A, "ext")[0].getAttribute("cx"), child(expectedTransform, A, "ext")[0].getAttribute("cx"), `Table width retained ${index + 1}`);
  });
}
const restricted = await inspect(await renderReportPptx(fixture({ restricted: true })));
const groupRows = tables(restricted.slides[3])[0];
assert.ok(groupRows.filter(row => ["Alyssa 廣告", "Alyssa Medical 廣告", "KOL + Traffic", "Ineffable Beauty", "Skin Light"].includes(row[0])).every(row => row.slice(1).every(value => value === "—")), "Restricted groups reveal no performance values");
for (const label of ["Alyssa 廣告", "Alyssa Medical 廣告", "KOL + Traffic", "Ineffable Beauty", "Skin Light"]) assert.ok(!restricted.allText.includes(`${label} & <Account>`), "Audit only includes allowed groups");
const missingAccountSnapshot = fixture();
const missingAccountGroup = missingAccountSnapshot.series.groupRows.find(row => row.key === "alyssa-ads");
assert.ok(missingAccountGroup.metrics.spend > 0 && missingAccountGroup.metrics.cpl !== null && missingAccountGroup.metrics.costPerBooking !== null && missingAccountGroup.metrics.costPerShow !== null);
missingAccountGroup.available = false;
const zeroDenominatorGroup = missingAccountSnapshot.series.groupRows.find(row => row.key === "alyssa-medical-ads");
zeroDenominatorGroup.metrics = reportMetrics({ leads: 0, bookings: 0, shows: 0, noShows: 0, pendingShows: 0 }, 100);
const missingAccount = await inspect(await renderReportPptx(missingAccountSnapshot));
assert.equal(tables(missingAccount.slides[1])[0].find(row => row[0] === missingAccountGroup.label)[1], new Intl.NumberFormat("en-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(missingAccountGroup.metrics.spend), "Known spend remains visible when account performance is unavailable");
assert.deepEqual(tables(missingAccount.slides[2])[0].find(row => row[0] === missingAccountGroup.label).slice(3), ["未有資料", "未有資料", "未有資料"], "Unavailable account performance cannot publish subset-derived CPL, CPBook or CPShow");
assert.deepEqual(tables(missingAccount.slides[2])[0].find(row => row[0] === "GOS Beauty").slice(3), ["0.00", "0.00", "0.00"], "Available account costs preserve explicit zero spend");
assert.deepEqual(tables(missingAccount.slides[2])[0].find(row => row[0] === zeroDenominatorGroup.label).slice(3), ["不適用", "不適用", "不適用"], "Available zero-denominator costs remain not applicable");
const longSnapshot = fixture({ days: 29, treatments: 23 });
longSnapshot.series.auditRows = Array.from({ length: 22 }, (_, index) => {
  const group = longSnapshot.series.groupRows[index < 13 ? 0 : 3];
  return { key: `audit:${index}`, groupKey: group.key, groupLabel: group.label, accountLabel: `QA-AUDIT-${index}`, brandLabel: "QA", metrics: reportMetrics({ leads: index + 1, bookings: index % 4, shows: index % 3, noShows: index % 2, pendingShows: 0 }, null) };
});
const longBytes = await renderReportPptx(longSnapshot);
const long = await inspect(longBytes);
assert.ok(long.slides.length > 18, "Longer periods and treatment sets paginate rather than truncate");
const longTreatmentRows = long.slides.flatMap(slide => tables(slide).flat()).filter(row => row[0].startsWith("gos:療程"));
assert.equal(longTreatmentRows.length, 23, "Every treatment survives pagination exactly once");
assert.equal(new Set(longTreatmentRows.map(row => row[0])).size, 23);
const overallDailyPages = long.slides.filter(slide => text(slide).includes("每日查詢、預約及到店"));
const dailyRows = overallDailyPages.flatMap(slide => tables(slide)[0].slice(1, -1));
assert.equal(dailyRows.length, 29, "Every date survives overall daily pagination exactly once");
assert.equal(new Set(dailyRows.map(row => row[0])).size, 29);
assert.deepEqual([1, 2, 3, 4].map(index => dailyRows.reduce((sum, row) => sum + Number(row[index]), 0)), [longSnapshot.current.totals.leads, longSnapshot.current.totals.bookings, longSnapshot.current.totals.shows, longSnapshot.current.totals.noShows], "Paginated daily totals reconcile with snapshot totals");
for (const slide of overallDailyPages) {
  const rows = tables(slide)[0];
  assert.deepEqual(rows.at(-1).slice(1).map(Number), [1, 2, 3, 4].map(index => rows.slice(1, -1).reduce((sum, row) => sum + Number(row[index]), 0)), "Every page subtotal reconciles");
}
const auditPages = long.slides.filter(slide => text(slide).includes("來源分組核對"));
const auditRows = auditPages.flatMap(slide => tables(slide)[0].slice(1, -1));
assert.equal(auditRows.length, 22, "Every audit source survives pagination exactly once");
assert.equal(new Set(auditRows.map(row => row[1])).size, 22);
for (const slide of auditPages) {
  const rows = tables(slide)[0];
  assert.deepEqual(rows.at(-1).slice(2).map(Number), [2, 3, 4, 5].map(index => rows.slice(1, -1).reduce((sum, row) => sum + Number(row[index]), 0)), "Every audit page subtotal reconciles");
}
// Use actual Chinese promotion copy, including the accepted 160-character
// boundary. Short synthetic labels cannot catch native table row overflow.
const promotionLabels = [
  "秋季雙十限定面部緊緻輪廓管理療程，配合細緻眼周及頸部護理，先由美容師了解皮膚狀態，再按個人需要安排舒適體驗與療程後保養建議，預約時可查詢適合時段。",
  "週年限定無針水光補濕修護組合，先做溫和清潔及皮膚分析，再配合精華導入與舒緩面膜，適合關注乾燥粗糙和上妝不貼服的客人，療程內容由美容師於到店時詳細說明。",
  "雙十全比堅尼脫毛體驗優惠，配合三個自選小部位護理，預約前先確認操作範圍與到店安排，美容師會了解皮膚及毛髮狀況，並提供療程前準備和療程後日常護理建議。",
  "秋冬腰腹輪廓緊緻管理組合，配合暖宮溫養與舒適身體護理，先由美容師了解客人重點關注的位置，再安排合適操作時段及療程步驟，詳情可透過官方預約渠道查詢。",
  "柔清舒敏面部護理限定方案，包含溫和潔面、人手針清與修眉、精華按摩及舒緩導入，美容師會先了解近期皮膚狀況和保養習慣，並於療程後提供適合日常使用的護理建議。",
  "眼周及頸部細緻輪廓護理組合，配合面部緊緻管理與修復面膜，先了解客人希望改善的觀感和日常作息，再由美容師安排合適的療程流程，預約時可查詢優惠及可選時段。",
  "小腿循環舒緩與熱感人手穴按護理，配合腿部線條管理及舒適放鬆體驗，美容師會先了解活動習慣和關注位置，再安排操作強度與療程後保養建議，適合於工作後預約體驗。",
];
assert.equal(new Set(promotionLabels).size, 7);
assert.ok(promotionLabels.every(label => Array.from(label).length >= 66 && Array.from(label).length <= 80));
const acceptedLongLabel = promotionLabels[0] + promotionLabels[1] + "名額安排以店舖確認為準。";
assert.equal(Array.from(acceptedLongLabel).length, 160);
const rateCell = value => value === null ? "不適用" : `${(value * 100).toFixed(1)}%`;
const countCells = metrics => [metrics.leads, metrics.bookings, metrics.shows, metrics.noShows].map(String);
const efficiencyCells = metrics => [...countCells(metrics), rateCell(metrics.bookRate), rateCell(metrics.showUpRate)];
const paragraphText = cell => child(nodes(cell, A, "txBody")[0], A, "p").map(text).join("\n");
const editableRows = slide => child(nodes(slide, A, "tbl")[0], A, "tr").map(row => child(row, A, "tc").map(paragraphText));
function stressMetrics(index) {
  return reportMetrics({ leads: 101 + index * 7, bookings: 11 + index, shows: 5 + index, noShows: 2 + index % 2, pendingShows: 0 }, null);
}
function treatmentFixture(labels) {
  const snapshot = fixture({ treatments: labels.length });
  const rows = labels.map((label, index) => ({ groupKey: "gos", key: `stress-treatment:${index}`, label, metrics: stressMetrics(index) }));
  snapshot.series.treatmentRows = [...snapshot.series.treatmentRows.filter(row => row.groupKey !== "gos"), ...rows];
  return { snapshot, rows };
}
/** Reassemble native editable fragments, preserving every source paragraph. */
function verifyFragments(pages, expected, textColumns, description) {
  let sourceIndex = 0, offsets = Array.from({ length: textColumns }, () => 0), fragments = 0, continuations = 0, continuationPages = 0;
  const actualCounts = Array.from({ length: 4 }, () => 0);
  for (const slide of pages) {
    const tableRows = editableRows(slide);
    const rows = tableRows.slice(1, -1);
    assert.ok(rows.length, `${description}: every data page has a source fragment`);
    for (const row of rows) {
      assert.ok(sourceIndex < expected.length, `${description}: no unexpected row or duplicate source`);
      const source = expected[sourceIndex];
      const first = offsets.every(offset => offset === 0);
      assert.equal(row[0].startsWith("（續）"), !first, `${description}: continuation text is identified`);
      const values = row.slice(0, textColumns);
      if (!first) { values[0] = values[0].slice(3); continuations++; }
      assert.ok(values.some(value => value.length > 0), `${description}: no empty continuation fragment`);
      values.forEach((value, column) => {
        assert.ok(source.values[column].slice(offsets[column]).startsWith(value), `${description}: source ${sourceIndex + 1} column ${column + 1} is neither truncated nor reordered`);
        offsets[column] += value.length;
      });
      assert.deepEqual(row.slice(textColumns), first ? source.metricCells : Array.from({ length: source.metricCells.length }, () => ""), `${description}: counts and rates occur on the first fragment only`);
      row.slice(textColumns, textColumns + 4).forEach((value, index) => { actualCounts[index] += Number(value); });
      fragments++;
      if (offsets.every((offset, column) => offset === source.values[column].length)) {
        sourceIndex++; offsets = Array.from({ length: textColumns }, () => 0);
      }
    }
    const subtotal = tableRows.at(-1).slice(textColumns, textColumns + 4).map(Number);
    assert.deepEqual(subtotal, [0, 1, 2, 3].map(index => rows.reduce((sum, row) => sum + Number(row[textColumns + index]), 0)), `${description}: page subtotal never counts a continuation twice`);
    if (rows.every(row => row.slice(textColumns).every(value => value === ""))) {
      continuationPages++;
      assert.deepEqual(subtotal, [0, 0, 0, 0], `${description}: a continuation-only page has zero subtotal`);
    }
  }
  assert.equal(sourceIndex, expected.length, `${description}: every complete source label reconstructs exactly`);
  assert.ok(offsets.every(offset => offset === 0), `${description}: the final label is complete`);
  assert.deepEqual(actualCounts, [0, 1, 2, 3].map(index => expected.reduce((sum, row) => sum + Number(row.metricCells[index]), 0)), `${description}: fragment totals reconcile with original records`);
  return { fragments, continuations, continuationPages };
}
async function verifyStressCellStyles(pages, exemplar, description) {
  const original = parse(await template.file(`ppt/slides/slide${exemplar}.xml`).async("string"));
  const expected = nodes(original, A, "tbl")[0];
  const expectedRows = child(expected, A, "tr");
  for (const slide of pages) {
    const table = nodes(slide, A, "tbl")[0];
    for (const tag of ["tblPr", "tblGrid"]) assert.equal(serializer.serializeToString(child(table, A, tag)[0]), serializer.serializeToString(child(expected, A, tag)[0]), `${description}: approved native grid and table style remain exact`);
    const rows = child(table, A, "tr");
    assert.equal(serializer.serializeToString(rows[0]), serializer.serializeToString(expectedRows[0]), `${description}: approved header remains exact`);
    rows.slice(1).forEach((row, rowIndex) => {
      const prototype = rowIndex === rows.length - 2 ? expectedRows.at(-1) : expectedRows[1 + rowIndex % 2];
      child(row, A, "tc").forEach((cell, column) => {
        const expectedCell = child(prototype, A, "tc")[column];
        assert.equal(serializer.serializeToString(child(cell, A, "tcPr")[0]), serializer.serializeToString(child(expectedCell, A, "tcPr")[0]), `${description}: every fragment retains approved cell fill, borders and margins`);
        const font = nodes(expectedCell, A, "rPr")[0];
        for (const actualFont of nodes(cell, A, "rPr")) assert.equal(serializer.serializeToString(actualFont), serializer.serializeToString(font), `${description}: wrapping never shrinks or changes approved typography`);
      });
    });
  }
}
const naturalFixture = treatmentFixture(promotionLabels);
const naturalBytes = await renderReportPptx(naturalFixture.snapshot);
const natural = await inspect(naturalBytes);
const naturalPages = natural.slides.filter(slide => text(slide).includes("GOS Beauty 療程成效"));
assert.ok(naturalPages.length > 1, "Seven real promotion labels paginate before wrapped rows exceed the content canvas");
verifyFragments(naturalPages, naturalFixture.rows.map(row => ({ values: [row.label], metricCells: efficiencyCells(row.metrics) })), 1, "66–80-character promotion labels");
await verifyStressCellStyles(naturalPages, 13, "66–80-character promotion labels");
const boundaryFixture = treatmentFixture([acceptedLongLabel]);
const boundaryBytes = await renderReportPptx(boundaryFixture.snapshot);
const boundary = await inspect(boundaryBytes);
const boundaryPages = boundary.slides.filter(slide => text(slide).includes("GOS Beauty 療程成效"));
const boundaryFragments = verifyFragments(boundaryPages, boundaryFixture.rows.map(row => ({ values: [row.label], metricCells: efficiencyCells(row.metrics) })), 1, "Accepted 160-character treatment label");
await verifyStressCellStyles(boundaryPages, 13, "Accepted 160-character treatment label");
const auditStressSnapshot = fixture();
auditStressSnapshot.series.auditRows = ["alyssa-ads", "gos"].map((key, index) => {
  const group = auditStressSnapshot.series.groupRows.find(row => row.key === key);
  return { key: `stress-audit:${index}`, groupKey: key, groupLabel: group.label, accountLabel: (`【官方廣告帳戶】${promotionLabels[index]}${promotionLabels[index + 1]}`).slice(0, 120), brandLabel: (`【原始品牌名稱】${promotionLabels[index + 2]}${promotionLabels[index + 3]}`).slice(0, 120), metrics: stressMetrics(index + 8) };
});
assert.ok(auditStressSnapshot.series.auditRows.every(row => row.accountLabel.length === 120 && row.brandLabel.length === 120));
const auditStressBytes = await renderReportPptx(auditStressSnapshot);
const auditStress = await inspect(auditStressBytes);
let auditStressContinuations = 0, auditStressContinuationPages = 0;
for (const [key, exemplar] of [["alyssa-ads", 17], ["gos", 18]]) {
  const source = auditStressSnapshot.series.auditRows.find(row => row.groupKey === key);
  const titleId = exemplar === 17 ? "217" : "227";
  const pages = auditStress.slides.filter(slide => nodes(slide, P, "sp").some(shape => nodes(shape, P, "cNvPr")[0].getAttribute("id") === titleId));
  const fragments = verifyFragments(pages, [{ values: [source.groupLabel, `${source.accountLabel}\n${source.brandLabel}`], metricCells: countCells(source.metrics) }], 2, "120-character account and brand labels");
  auditStressContinuations += fragments.continuations;
  auditStressContinuationPages += fragments.continuationPages;
  await verifyStressCellStyles(pages, exemplar, "120-character account and brand labels");
}
assert.ok(auditStressContinuations > 0, "Oversize audit account and brand labels split into editable continuation rows");
assert.ok(auditStressContinuationPages > 0, "Audit fixture exercises zero-subtotal continuation-only pages");
if (process.env.REPORT_TEMPLATE_QA_DIR) {
  mkdirSync(process.env.REPORT_TEMPLATE_QA_DIR, { recursive: true });
  writeFileSync(path.join(process.env.REPORT_TEMPLATE_QA_DIR, "base.pptx"), baseBytes);
  writeFileSync(path.join(process.env.REPORT_TEMPLATE_QA_DIR, "long.pptx"), longBytes);
  writeFileSync(path.join(process.env.REPORT_TEMPLATE_QA_DIR, "fixture.json"), JSON.stringify(baseSnapshot, null, 2));
  writeFileSync(path.join(process.env.REPORT_TEMPLATE_QA_DIR, "natural-labels.pptx"), naturalBytes);
  writeFileSync(path.join(process.env.REPORT_TEMPLATE_QA_DIR, "natural-labels.json"), JSON.stringify(naturalFixture.snapshot, null, 2));
  writeFileSync(path.join(process.env.REPORT_TEMPLATE_QA_DIR, "boundary-label.pptx"), boundaryBytes);
  writeFileSync(path.join(process.env.REPORT_TEMPLATE_QA_DIR, "boundary-label.json"), JSON.stringify(boundaryFixture.snapshot, null, 2));
  writeFileSync(path.join(process.env.REPORT_TEMPLATE_QA_DIR, "audit-labels.pptx"), auditStressBytes);
  writeFileSync(path.join(process.env.REPORT_TEMPLATE_QA_DIR, "audit-labels.json"), JSON.stringify(auditStressSnapshot, null, 2));
}
console.log(`PASS: approved 18-slide/20-table base, exact template geometry/fonts/styles, stale-data sanitation, XML escaping, zero versus missing, unavailable account costs, restricted groups, ${long.slides.length}-slide pagination, all dates/treatments, natural Chinese labels on ${naturalPages.length} pages, accepted 160-character label (${boundaryFragments.fragments} fragments), 120-character audit labels (${auditStressContinuations} continuations), exact fragment reconstruction, reconciled totals, footer numbering and table bounds`);
