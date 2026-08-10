import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFile(`${root}${path}`, "utf8");
const [packageJson, route, snapshot, pdf, pptx, client, boundary] = await Promise.all([
  read("package.json").then(JSON.parse),
  read("src/app/api/internal/reports/export/route.ts"),
  read("src/lib/reports/snapshot.ts"),
  read("src/lib/reports/pdf.tsx"),
  read("src/lib/reports/pptx.ts"),
  read("src/components/reports/ReportGeneratorForm.tsx"),
  read("src/lib/security/routeBoundary.ts"),
]);

assert.equal(packageJson.dependencies["@react-pdf/renderer"], "4.6.0");
assert.equal(packageJson.dependencies.pptxgenjs, "4.0.1");
assert.match(route, /buildReportSnapshot/);
assert.match(route, /requireModuleAccess\("performance"\)/);
assert.match(route, /application\/pdf/);
assert.match(route, /presentationml\.presentation/);
assert.match(route, /x-report-snapshot-id/);
assert.match(route, /cache-control.*no-store/is);
assert.match(snapshot, /marketing_report_snapshots/);
assert.match(snapshot, /snapshotSha256/);
assert.match(snapshot, /aggregateMetrics\(rows, \[\], false\)/);
assert.match(snapshot, /generated_by_identifier/);
assert.doesNotMatch(snapshot, /generated_by_email|access\.email/);
assert.doesNotMatch(snapshot, /customer_name|phone_number|crm_notes/i);
assert.match(pdf, /renderToBuffer/);
assert.match(pdf, /NotoSansTC-Regular\.ttf/);
assert.match(pdf, /Polyline/);
assert.match(pptx, /ChartType\.line/);
assert.match(pptx, /outputType: "uint8array"/);
assert.match(client, /setBreakdowns\(\[\]\)/);
assert.match(client, /toggleBreakdown\("brand"\)/);
assert.match(client, /toggleBreakdown\("treatment"\)/);
assert.match(client, /不會做品牌 × 療程交叉表/);
assert.match(boundary, /"\/api\/internal"/);
assert.match(boundary, /"\/reports"/);

console.log("Report export and immutable snapshot contracts verified.");
