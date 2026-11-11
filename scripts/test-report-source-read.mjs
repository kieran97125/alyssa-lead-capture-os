import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url), cache = new Map();
let sourceReads = [], sequence = [], onRead;
const mocks = {
  "server-only": {},
  "@/lib/integrations/googleSheetsLeadTable": {
    readLiveReportTables: async (configuration, options) => {
      sourceReads.push({ configuration, options });
      const next = sequence.shift();
      onRead?.();
      if (next instanceof Error) throw next;
      return next;
    },
  },
};
function load(path) {
  if (cache.has(path)) return cache.get(path).exports;
  const loadedModule = { exports: {} }; cache.set(path, loadedModule);
  const code = ts.transpileModule(readFileSync(new URL("../" + path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "module", "exports", code)(
    name => mocks[name] ?? (name.startsWith("@/") ? load("src/" + name.slice(2) + ".ts") : require(name)), loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
const { readClassifiedReportSources } = load("src/lib/reports/sourceRead.ts");
const { ReportTreatmentCategoryError, reportTreatmentFailureDiagnostic } = load("src/lib/reports/treatmentCategories.ts");
const configuration = { sourceProfile: "alyssa_workspace_lead_funnel", spreadsheetId: "synthetic_workbook_12345678" };
const controller = new AbortController(), options = { signal: controller.signal, includeKolPerformance: true };
function tables(rows, stamp) {
  return {
    treatmentCategories: { headers: ["Account", "Original Treatment", "Dashboard 技術分類"], rows, readAt: stamp },
    arrivalRevenue: { headers: [], rows: [[stamp]], readAt: stamp },
    kolPerformance: { headers: [], rows: [[stamp]], readAt: stamp },
  };
}
const healthy = tables([["Alyssa Main", "Synthetic offer", "Sheet category"]], "latest");
const before = console.warn, diagnostics = [];
console.warn = (...args) => diagnostics.push(args);
function reset(...reads) { sequence = reads; sourceReads = []; onRead = undefined; diagnostics.length = 0; }
try {
  reset(healthy);
  const direct = await readClassifiedReportSources(configuration, options);
  assert.equal(direct.tables, healthy); assert.equal(sourceReads.length, 1);
  assert.equal(diagnostics.length, 0, "A valid read does not add requests or warnings");
  assert.equal(direct.classifyTreatment("Alyssa Main", "Synthetic offer"), "Sheet category");

  for (const failedRows of [[], [["Alyssa Main", "private-synthetic-offer", "#N/A"]], [
    ["Alyssa Main", "private-synthetic-offer", "first"], ["Alyssa Main", "private-synthetic-offer", "second"],
  ]]) {
    reset(tables(failedRows, "discarded"), healthy);
    const recovered = await readClassifiedReportSources(configuration, options);
    assert.equal(sourceReads.length, 2);
    assert.equal(recovered.tables, healthy, "Financial, KOL and category tables all come from the successful complete re-read");
    assert.equal(recovered.tables.arrivalRevenue.rows[0][0], "latest");
    assert.equal(recovered.tables.kolPerformance.rows[0][0], "latest");
    assert.equal(recovered.tables.treatmentCategories.readAt, "latest");
    assert.ok(sourceReads.every(read => read.configuration === configuration && read.options === options && read.options.signal === controller.signal));
    assert.equal(diagnostics.length, 1);
    assert.ok(!JSON.stringify(diagnostics).includes("private-synthetic-offer"), "Source cells never enter diagnostics");
    assert.ok(Object.values(diagnostics[0][1].counts).every(value => typeof value === "number"));
  }

  const conflicting = tables([["Alyssa Main", "Synthetic offer", "first"], ["Alyssa Main", "Synthetic offer", "second"]], "conflict");
  reset(conflicting, conflicting, healthy);
  await assert.rejects(readClassifiedReportSources(configuration, options), error => error instanceof ReportTreatmentCategoryError && error.reason === "conflict");
  assert.equal(sourceReads.length, 2, "A persistent error stops after two reads, without inventing a classification");
  assert.deepEqual(reportTreatmentFailureDiagnostic(new Error("private source cells")), { reason: "unclassified", counts: {} });

  reset({ ...healthy, treatmentCategories: { ...healthy.treatmentCategories, headers: [] } }, healthy);
  await assert.rejects(readClassifiedReportSources(configuration, options), error => error.reason === "headers");
  assert.equal(sourceReads.length, 1, "A schema error requires repair rather than automatic repeated reads");

  const providerError = new Error("Synthetic provider deadline");
  reset(providerError, healthy);
  await assert.rejects(readClassifiedReportSources(configuration, options), error => error === providerError);
  assert.equal(sourceReads.length, 1, "Do not reset the source reader's own provider deadline");

  const cancelled = new AbortController();
  reset(tables([], "discarded"), healthy);
  onRead = () => cancelled.abort();
  await assert.rejects(readClassifiedReportSources(configuration, { signal: cancelled.signal, includeKolPerformance: false }), error => error.name === "AbortError");
  assert.equal(sourceReads.length, 1, "Cancellation prevents the second attempt");
  assert.equal(sourceReads[0].options.includeKolPerformance, false, "Account selection cannot grow during recovery");
} finally { console.warn = before; }
console.log("PASS: source-owned classifications, bounded complete-source recovery, no mixed financial/KOL batches, persistent conflict/schema rejection, shared cancellation and cell-free diagnostics");
