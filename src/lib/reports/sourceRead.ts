import "server-only";
import { readLiveReportTables, type LeadTableSourceConfiguration } from "@/lib/integrations/googleSheetsLeadTable";
import {
  buildReportTreatmentClassifier,
  ReportTreatmentCategoryError,
  reportTreatmentFailureDiagnostic,
} from "@/lib/reports/treatmentCategories";

/** Re-read every live report source together if a Sheet calculation is incomplete.
 * Never combine an earlier financial/KOL read with a later classification map.
 * Both attempts retain the caller's one export deadline and cancellation signal.
 */
export async function readClassifiedReportSources(
  configuration: LeadTableSourceConfiguration,
  options: Parameters<typeof readLiveReportTables>[1] = {}
) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    options.signal?.throwIfAborted();
    const tables = await readLiveReportTables(configuration, options);
    try {
      return { tables, classifyTreatment: buildReportTreatmentClassifier(tables.treatmentCategories) };
    } catch (error) {
      console.warn("report_treatment_validation_failed", { attempt, ...reportTreatmentFailureDiagnostic(error) });
      // Schema errors need a deliberate repair. A source recalculation can
      // briefly expose incomplete, empty or conflicting evaluated cells.
      if (attempt === 2 || !(error instanceof ReportTreatmentCategoryError) || error.reason === "headers") throw error;
    }
  }
  throw new Error("Unreachable report source read state.");
}
