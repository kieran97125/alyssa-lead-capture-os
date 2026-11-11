import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import * as pdfRenderer from "@react-pdf/renderer";

const nativeRequire = createRequire(import.meta.url), cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const loadedModule = { exports: {} }; cache.set(file, loadedModule);
  const code = ts.transpileModule(readFileSync(new URL("../" + file, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  new Function("require", "module", "exports", code)(id => id === "server-only" ? {} : id === "@react-pdf/renderer" ? pdfRenderer : id.startsWith("@/") ? load("src/" + id.slice(2) + ".ts") : nativeRequire(id), loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

/** Entirely synthetic; stable IDs/dates make exported-page images reproducible. */
export function kolVisualSnapshot(stress = false) {
  const { reportMetrics } = load("src/lib/reports/metrics.ts");
  const metrics = reportMetrics({ leads: 120, bookings: 20, shows: 10, noShows: 2, pendingShows: 0 }, null);
  const row = { accountLabel: "Alyssa Main Medical", kol: "QA B", treatments: ["示範療程乙"], offers: ["QA B 分享嘅指定療程體驗優惠", "QA B 分享嘅周年限定雙項療程優惠"], leads: 31, bookings: 3, shows: 2, noShows: 1, bookRate: 3/31, showUpRate: 2/3, revenue: 1234.5 };
  const rows = stress ? [{ ...row, kol: "QA Long", leads: 7777, offers: ["雙十一指定療程優惠及原文內容".repeat(150) + "完結標記"], treatments: ["療程標記"] }] : [
    { ...row, accountLabel: "Alyssa Main", kol: "QA A", offers: ["QA A 分享嘅雙十一護理體驗優惠"] }, row,
    { ...row, kol: "QA C", leads: 0, bookings: 0, shows: 1, noShows: 0, bookRate: null, showUpRate: null, offers: ["QA C 分享嘅指定體驗及後續護理優惠"] },
  ];
  const range = { startDate: "2028-11-01", endDate: "2028-11-10", readAt: "2028-11-11T00:00:00Z" };
  return { schemaVersion: 1, metricContractVersion: "growth-os-report-v1", reportId: "QA-REPORT-LAYOUT", snapshotId: "qa-layout", snapshotSha256: "a".repeat(64), generatedAt: "2028-11-11T00:00:00Z", generatedBy: { memberId: null, identifier: "QA" }, title: "QA Report Layout",
    selection: { brandScope: "", brandLabel: "QA", accountIds: ["alyssa-main"], brands: [], breakdowns: [] }, current: { ...range, label: "2028-11-01 至 2028-11-10", totals: metrics }, comparison: null, daily: [], brandRows: [], treatmentRows: [], spendMix: [], insights: [], actions: [], sources: [],
    dataQuality: { status: "complete", sourceName: "QA", sourceStatus: "connected", sourceLastSuccessAt: range.readAt, factRows: 0, spendRows: 0, spendCompleteBrandDays: 0, spendExpectedBrandDays: 0, warnings: [] },
    series: { version: "cs-ad-series-v1", available: true, groupRows: [{ key: "kol-traffic", label: "KOL + Traffic", available: true, metrics }], treatmentRows: [], dailyRows: [], arrivalSourceRows: [], auditRows: [], warnings: [] },
    kolPerformance: { ...range, version: "lead-sheet-kol-v1", rows },
    mainPerformance: { ...range, version: "lead-sheet-main-segments-v1", rows: [
      { accountLabel: "Alyssa Main", leads: 120, bookings: 20, shows: 10, noShows: 2, bookRate: 1/6, leadToShowRate: 1/12, showUpRate: 0.5, revenue: 1234.5 },
      { accountLabel: "Alyssa Main Medical", leads: 31, bookings: 0, shows: 0, noShows: 0, bookRate: 0, leadToShowRate: 0, showUpRate: null, revenue: 0 },
      { accountLabel: "Alyssa Main Organic", leads: 12, bookings: 2, shows: 4, noShows: 2, bookRate: 1/6, leadToShowRate: 1/3, showUpRate: 2, revenue: 9876543.21 },
    ] },
  };
}

export async function renderKolVisualFixtures(directory) {
  mkdirSync(directory, { recursive: true });
  const { renderReportPptx } = load("src/lib/reports/pptx.ts");
  const { renderReportPdf } = load("src/lib/reports/pdf.tsx");
  const normal = kolVisualSnapshot(), stress = kolVisualSnapshot(true);
  writeFileSync(path.join(directory, "normal.pptx"), await renderReportPptx(normal));
  writeFileSync(path.join(directory, "normal.pdf"), await renderReportPdf(normal));
  writeFileSync(path.join(directory, "stress.pdf"), await renderReportPdf(stress));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await renderKolVisualFixtures(process.argv[2]);
