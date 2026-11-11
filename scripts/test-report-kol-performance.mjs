import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";
import { KOL_REPORT_EVENT_HEADERS, kolReportProjectionFormula } from "./lead-sheet-kol-report-projection.mjs";

const nativeRequire = createRequire(import.meta.url), cache = new Map();
function load(path) {
  if (cache.has(path)) return cache.get(path).exports;
  const loadedModule = { exports: {} }; cache.set(path, loadedModule);
  const code = ts.transpileModule(readFileSync(new URL("../" + path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function("require", "module", "exports", code)(id => id === "server-only" ? {} : id.startsWith("@/") ? load("src/" + id.slice(2) + ".ts") : nativeRequire(id), loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
const { buildKolPerformance, buildMainReportPerformance, includesMainKolReport, kolOfferLabels, KOL_EVENT_HEADERS } = load("src/lib/reports/kolPerformance.ts");
const { reportMetrics } = load("src/lib/reports/metrics.ts");
const { renderReportPptx } = load("src/lib/reports/pptx.ts");
const { renderReportText } = load("src/lib/reports/text.ts");
assert.deepEqual([...KOL_EVENT_HEADERS], KOL_REPORT_EVENT_HEADERS);
assert.deepEqual(kolOfferLabels({ kol: "Kiu", offers: ["Kiu 分享嘅瘦鼻翼", "Kiu分享嘅1010瘦面", "Kiu 9周年$999優惠"] }), ["瘦鼻翼", "1010瘦面", "9周年$999優惠"]);
assert.deepEqual(kolOfferLabels({ kol: "A+B", offers: ["A+B 分享嘅指定優惠", "另一位分享嘅其他優惠"] }), ["指定優惠", "另一位分享嘅其他優惠"]);
assert.ok(!kolReportProjectionFormula().includes("mkt_dashboard!"), "Export must not mutate or inherit another operator's date filters");
assert.ok(!kolReportProjectionFormula().includes("KOL成效!"));
for (const selection of [null, undefined, ["alyssa-main"], ["alyssa-main", "gos-beauty"]]) assert.equal(includesMainKolReport(selection, true), true);
for (const selection of [["gos-beauty"], ["ineffable", "skin-light"], ["alyssa-medical"], ["alyssa-aesthetics"]]) assert.equal(includesMainKolReport(selection, true), false);
assert.equal(includesMainKolReport(null, false), false);
const serial = day => (Date.parse(day + "T00:00:00Z") - Date.UTC(1899, 11, 30)) / 86400000;
const event = (kind, day, { person = "Kiu", account = "Alyssa Main Medical", count = kind === "revenue" ? 0 : 1, revenue = 0, inquiry = 0, order = 0, treatment = "瘦鼻翼", offer = "Kiu 分享嘅瘦鼻翼" } = {}) => [account, person, treatment, offer, serial(day), kind, count, revenue, inquiry, order];
const sourceRows = [
  event("lead", "2026-10-31"), event("book", "2026-11-01"), event("show", "2026-11-10"), event("no_show", "2026-11-11"),
  event("lead", "2026-11-01", { count: 2 }), event("no_show", "2026-11-10"),
  event("revenue", "2026-11-10", { revenue: 100.1 }), event("revenue", "2026-11-10", { revenue: 0.2 }), event("revenue", "2026-11-09", { revenue: -5 }),
  event("inquiry", "2026-11-01", { person: "Old", inquiry: 1, order: 10 }),
  event("inquiry", "2026-11-10", { person: "New", inquiry: 1, order: 11 }),
  event("inquiry", "2026-11-11", { person: "Future", inquiry: 1, order: 12 }),
  event("inquiry", "2026-11-03", { person: "Earlier", inquiry: 2, order: 13 }),
  event("inquiry", "2026-11-03", { person: "Latest", inquiry: 2, order: 14 }),
  event("inquiry", "2026-11-01", { person: "Replaced", inquiry: 3, order: 15 }),
  event("inquiry", "2026-11-02", { account: "Alyssa Main Organic", person: "Organic", inquiry: 3, order: 16 }),
  event("lead", "2026-11-01", { account: "Alyssa Main Organic", person: "Organic", offer: "", count: 3 }),
  event("book", "2026-11-02", { account: "Alyssa Main Organic", person: "Organic", offer: "" }),
  event("show", "2026-11-03", { account: "Alyssa Main Organic", person: "Organic", offer: "", count: 2 }),
  event("no_show", "2026-11-03", { account: "Alyssa Main Organic", person: "Organic", offer: "" }),
  event("revenue", "2026-11-03", { account: "Alyssa Main Organic", person: "Organic", offer: "", revenue: 500 }),
];
const table = { headers: [...KOL_EVENT_HEADERS], rows: sourceRows, readAt: "2026-11-11T05:00:00Z" };
const range = { startDate: "2026-11-01", endDate: "2026-11-10" };
const kol = buildKolPerformance({ table, ...range });
const combined = buildMainReportPerformance({ table, ...range });
assert.deepEqual(combined.kolPerformance, kol);
assert.deepEqual(combined.mainPerformance.rows.map(row => row.accountLabel), ["Alyssa Main", "Alyssa Main Medical", "Alyssa Main Organic"]);
const organic = combined.mainPerformance.rows[2];
assert.deepEqual([organic.leads, organic.bookings, organic.shows, organic.noShows, organic.bookRate, organic.leadToShowRate, organic.showUpRate, organic.revenue], [3, 1, 2, 1, 1/3, 2/3, 2, 500]);
assert.deepEqual(combined.mainPerformance.rows.reduce((total, row) => total.map((value, index) => value + row[["leads", "bookings", "shows", "noShows"][index]]), [0,0,0,0]), [5, 2, 3, 2]);
const kiu = kol.rows.find(row => row.kol === "Kiu");
assert.deepEqual([kiu.leads, kiu.bookings, kiu.shows, kiu.noShows, kiu.bookRate, kiu.showUpRate, kiu.revenue], [2, 1, 1, 1, 0.5, 1, 95.3]);
assert.equal(kiu.accountLabel, "Alyssa Main Medical");
assert.ok(kol.rows.some(row => row.kol === "New"));
assert.ok(kol.rows.some(row => row.kol === "Latest"));
assert.ok(kol.rows.every(row => !["Old", "Earlier", "Replaced", "Organic", "Future"].includes(row.kol)), "Latest inquiry is selected across KOL and Organic within the selected dates, using source order for ties");
assert.equal(kol.rows.find(row => row.kol === "New").bookRate, null);
assert.ok(!JSON.stringify(kol).includes("Inquiry Key") && !JSON.stringify(kol).includes("Source Order"));
assert.deepEqual(buildKolPerformance({ table: { ...table, headers: [...table.headers].reverse(), rows: sourceRows.map(row => [...row].reverse()) }, ...range }), kol);
assert.throws(() => buildKolPerformance({ table: { ...table, headers: [...table.headers, "KOL"] }, ...range }));
for (const [column, value] of [[0, "GOS Beauty"], [4, "#REF!"], [6, -1], [6, "1"], [8, -1]]) {
  const row = [...sourceRows[1]]; row[column] = value;
  assert.throws(() => buildKolPerformance({ table: { ...table, rows: [row] }, ...range }));
}
const blank = buildKolPerformance({ table: { ...table, rows: [[]] }, ...range });
assert.deepEqual(blank.rows, []);

function fixture(performance = kol, accountIds = ["alyssa-main"], mainPerformance = combined.mainPerformance) {
  const metrics = reportMetrics({ leads: 2, bookings: 1, shows: 1, noShows: 1, pendingShows: 0 }, null);
  const group = accountIds.includes("alyssa-main") ? { key: "kol-traffic", label: "KOL + Traffic" } : { key: "gos", label: "GOS Beauty" };
  return { schemaVersion: 1, metricContractVersion: "growth-os-report-v1", reportId: "QA-KOL", snapshotId: "qa-snapshot", snapshotSha256: "qa", generatedAt: "2026-11-11T05:00:00Z", generatedBy: { memberId: null, identifier: "qa" }, title: "KOL Report QA",
    selection: { brandScope: "", brandLabel: "QA", accountIds, brands: [], breakdowns: [] }, current: { ...range, label: "2026-11-01 至 2026-11-10", totals: metrics }, comparison: null, daily: [], brandRows: [], treatmentRows: [], spendMix: [], insights: [], actions: [], sources: [],
    dataQuality: { status: "complete", spendCompleteBrandDays: 0, spendExpectedBrandDays: 0, warnings: [] },
    series: { version: "cs-ad-series-v1", groupRows: [{ ...group, available: true, metrics }], treatmentRows: [], dailyRows: [], arrivalSourceRows: [], auditRows: [], warnings: [] }, kolPerformance: performance, mainPerformance };
}
const A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const parse = xml => new DOMParser().parseFromString(xml, "application/xml");
const nodes = (root, ns, tag) => [...root.getElementsByTagNameNS(ns, tag)];
const text = root => nodes(root, A, "t").map(node => node.textContent).join("");
async function inspect(bytes) {
  const zip = await JSZip.loadAsync(bytes), names = Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name));
  const slides = await Promise.all(names.map(name => zip.file(name).async("string").then(parse)));
  const kolPages = slides.filter(slide => text(slide).includes("KOL PERFORMANCE"));
  const mainPages = slides.filter(slide => text(slide).includes("Alyssa Main 分組成效"));
  for (const slide of [...kolPages, ...mainPages]) {
    const table = nodes(slide, A, "tbl")[0];
    assert.equal(nodes(table, A, "tr")[0].getElementsByTagNameNS(A, "tc").length, kolPages.includes(slide) ? 11 : 9);
    const frame = nodes(slide, P, "graphicFrame")[0], transform = nodes(frame, P, "xfrm")[0];
    const off = nodes(transform, A, "off")[0], ext = nodes(transform, A, "ext")[0];
    const height = nodes(table, A, "tr").reduce((sum, row) => sum + Number(row.getAttribute("h")), 0);
    assert.equal(Number(ext.getAttribute("cy")), height);
    assert.ok(Number(off.getAttribute("y")) + height <= 6350000, "KOL table stays inside the slide");
  }
  return { kolPages, mainPages, slides, zip };
}
const mainBytes = await renderReportPptx(fixture());
assert.equal((await inspect(mainBytes)).kolPages.length, 1);
assert.equal((await inspect(mainBytes)).mainPages.length, 1);
assert.equal(nodes((await inspect(mainBytes)).mainPages[0], A, "tr").length, 4, "One header and exactly three Main segment rows");
assert.equal((await inspect(await renderReportPptx(fixture(kol, ["gos-beauty"])))).kolPages.length, 0);
assert.equal((await inspect(await renderReportPptx(fixture(kol, ["gos-beauty"])))).mainPages.length, 0);
const legacy = fixture(); delete legacy.kolPerformance; delete legacy.mainPerformance;
assert.equal((await inspect(await renderReportPptx(legacy))).kolPages.length, 0);
assert.equal((await inspect(await renderReportPptx(fixture(blank)))).kolPages.length, 1);
assert.ok(renderReportText(fixture()).includes("## KOL成效"));
assert.ok(!renderReportText(fixture(kol, ["ineffable", "skin-light"])).includes("## KOL成效"));
assert.ok(renderReportText(fixture()).includes("## Alyssa Main 分組成效"));
assert.ok(!renderReportText(fixture(kol, ["ineffable", "skin-light"])).includes("## Alyssa Main 分組成效"));
const stress = { ...kol, rows: Array.from({ length: 35 }, (_, i) => ({ ...kiu, kol: `QA ${i + 1}`, offers: ["雙十一指定療程優惠及原文內容".repeat(i ? 5 : 150)] })) };
const stressBytes = await renderReportPptx(fixture(stress));
const stressInspection = await inspect(stressBytes);
assert.ok(stressInspection.kolPages.length > 1, "Large tables paginate without shrinking below the readable floor");
const stressTableRows = stressInspection.kolPages.flatMap(slide => nodes(nodes(slide, A, "tbl")[0], A, "tr").slice(1).map(row => nodes(row, A, "tc").map(text)));
assert.deepEqual([4, 5, 6, 7].map(column => stressTableRows.reduce((sum, row) => sum + Number(row[column]), 0)), ["leads", "bookings", "shows", "noShows"].map(key => stress.rows.reduce((sum, row) => sum + row[key], 0)), "Continuation rows never duplicate a count");
assert.equal(stressTableRows.map(row => row[3]).join(""), stress.rows.flatMap(row => kolOfferLabels(row)).join(""), "All long offer copy survives native pagination exactly once");

if (process.env.KOL_VALIDATION_PATH) {
  const live = JSON.parse(readFileSync(process.env.KOL_VALIDATION_PATH, "utf8"));
  const liveReports = buildMainReportPerformance(live), result = liveReports.kolPerformance;
  assert.equal(result.rows.length, live.expected.length);
  for (const expected of live.expected) {
    const actual = result.rows.find(row => row.accountLabel === expected[0] && row.kol === expected[1]);
    assert.ok(actual, `Missing group ${expected[1]}`);
    assert.deepEqual([actual.leads, actual.bookings, actual.shows, actual.noShows, actual.bookRate ?? "—", actual.showUpRate ?? "—", actual.revenue], expected.slice(4));
    assert.deepEqual([...actual.treatments].sort(), expected[2].split("\n").sort());
    assert.deepEqual([...actual.offers].sort(), expected[3].split("\n").sort());
  }
  if (live.expectedMain) for (const expected of live.expectedMain) {
    const actual = liveReports.mainPerformance.rows.find(row => row.accountLabel === expected[0]);
    assert.deepEqual([actual.leads, actual.bookings, actual.shows, actual.noShows, actual.bookRate ?? "—", actual.leadToShowRate ?? "—", actual.showUpRate ?? "—"], expected.slice(1));
  }
  const bytes = await renderReportPptx(fixture(result, ["alyssa-main"], liveReports.mainPerformance));
  const pages = await inspect(bytes);
  if (process.env.KOL_QA_OUTPUT) { mkdirSync(process.env.KOL_QA_OUTPUT, { recursive: true }); writeFileSync(process.env.KOL_QA_OUTPUT + "/kol-live-preview.pptx", bytes); }
  assert.equal(pages.kolPages.length, 1, "Current live period fits the requested single KOL page");
  assert.equal(pages.mainPages.length, 1, "The three Main segments share one extra page");
  console.log(`PASS: ${live.table.rows.length} evaluated source events match all ${live.expected.length} live KOL rows and ${live.expectedMain?.length ?? 0} Main segments, with one native editable page per section`);
}
if (process.env.KOL_QA_OUTPUT) { mkdirSync(process.env.KOL_QA_OUTPUT, { recursive: true }); writeFileSync(process.env.KOL_QA_OUTPUT + "/kol-synthetic-preview.pptx", mainBytes); writeFileSync(process.env.KOL_QA_OUTPUT + "/kol-stress-preview.pptx", stressBytes); }
console.log("PASS: Main-only visibility, source-owned stage dates, latest inquiry and Organic replacement, income cents/refunds, source privacy, fail-closed schema, editable 11-column output, readable pagination, empty/legacy snapshots and text delivery");
