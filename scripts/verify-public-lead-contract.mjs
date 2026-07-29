import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import ts from "typescript";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const routePath = path.join(repoRoot, "src/app/api/public/leads/route.ts");
const packagePath = path.join(repoRoot, "package.json");
const [routeSource, packageSource] = await Promise.all([
  readFile(routePath, "utf8"),
  readFile(packagePath, "utf8"),
]);

const packageJson = JSON.parse(packageSource);
const buildScript = String(packageJson.scripts?.build ?? "");

if (/\bprepare-[\w-]+\.mjs\b/.test(buildScript)) {
  throw new Error(
    "Build contract failed: production builds must not rewrite application source."
  );
}

const sourceFile = ts.createSourceFile(
  routePath,
  routeSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS
);

const allowedLeadColumns = new Set([
  "id",
  "contact_id",
  "lead_uid",
  "source_snapshot_id",
  "source_type",
  "form_id",
  "brand_id",
  "treatment_id",
  "package_id",
  "branch_id",
  "customer_name",
  "phone",
  "normalized_phone",
  "appointment_date",
  "appointment_time",
  "price",
  "currency",
  "payment_status",
  "lead_status",
  "booking_status",
  "crm_status",
  "submitted_at",
  "created_at",
  "updated_at",
]);

const requiredLeadInsertColumns = new Set([
  "contact_id",
  "lead_uid",
  "source_snapshot_id",
  "source_type",
  "form_id",
  "brand_id",
  "package_id",
  "phone",
  "normalized_phone",
  "payment_status",
  "lead_status",
  "booking_status",
  "submitted_at",
]);

function propertyName(node) {
  if (
    ts.isIdentifier(node) ||
    ts.isStringLiteral(node) ||
    ts.isNumericLiteral(node)
  ) {
    return node.text;
  }
  return null;
}

function objectKeys(objectLiteral, label, { allowSpread = false } = {}) {
  return objectLiteral.properties.flatMap((property) => {
    if (allowSpread && ts.isSpreadAssignment(property)) {
      return [];
    }

    if (
      !ts.isPropertyAssignment(property) &&
      !ts.isShorthandPropertyAssignment(property)
    ) {
      throw new Error(
        `Build contract failed: ${label} must use explicit static properties.`
      );
    }

    const name = propertyName(property.name);
    if (!name) {
      throw new Error(
        `Build contract failed: ${label} contains a computed property.`
      );
    }
    return [name];
  });
}

function isFromLeadsInsert(node) {
  if (
    !ts.isCallExpression(node) ||
    !ts.isPropertyAccessExpression(node.expression) ||
    node.expression.name.text !== "insert"
  ) {
    return false;
  }

  const fromCall = node.expression.expression;
  return (
    ts.isCallExpression(fromCall) &&
    ts.isPropertyAccessExpression(fromCall.expression) &&
    fromCall.expression.name.text === "from" &&
    fromCall.arguments.length === 1 &&
    ts.isStringLiteral(fromCall.arguments[0]) &&
    fromCall.arguments[0].text === "leads"
  );
}

const leadInsertObjects = [];
const successResponseObjects = [];

function visit(node) {
  if (isFromLeadsInsert(node)) {
    const payload = node.arguments[0];
    if (!payload || !ts.isObjectLiteralExpression(payload)) {
      throw new Error(
        "Build contract failed: leads.insert() must receive a static object."
      );
    }
    leadInsertObjects.push(payload);
  }

  if (ts.isObjectLiteralExpression(node)) {
    const okProperty = node.properties.find(
      (property) =>
        ts.isPropertyAssignment(property) &&
        propertyName(property.name) === "ok" &&
        property.initializer.kind === ts.SyntaxKind.TrueKeyword
    );
    const hasSourceSnapshot = node.properties.some(
      (property) =>
        (ts.isPropertyAssignment(property) ||
          ts.isShorthandPropertyAssignment(property)) &&
        propertyName(property.name) === "source_snapshot_id"
    );
    if (okProperty && hasSourceSnapshot) {
      const keys = new Set(
        objectKeys(node, "success response object", { allowSpread: true })
      );
      successResponseObjects.push({ node, keys });
    }
  }

  ts.forEachChild(node, visit);
}

visit(sourceFile);

if (leadInsertObjects.length !== 1) {
  throw new Error(
    `Build contract failed: expected exactly one leads.insert() object, found ${leadInsertObjects.length}.`
  );
}

const leadInsertKeys = new Set(
  objectKeys(leadInsertObjects[0], "leads.insert()")
);
const unknownLeadColumns = [...leadInsertKeys].filter(
  (column) => !allowedLeadColumns.has(column)
);
const missingRequiredColumns = [...requiredLeadInsertColumns].filter(
  (column) => !leadInsertKeys.has(column)
);

if (unknownLeadColumns.length > 0) {
  throw new Error(
    `Build contract failed: leads.insert() contains unknown columns: ${unknownLeadColumns.join(", ")}.`
  );
}

if (missingRequiredColumns.length > 0) {
  throw new Error(
    `Build contract failed: leads.insert() is missing required columns: ${missingRequiredColumns.join(", ")}.`
  );
}

if (leadInsertKeys.has("attribution_trace_id")) {
  throw new Error(
    "Build contract failed: attribution_trace_id belongs in telemetry and the API response, not the leads table."
  );
}

if (successResponseObjects.length !== 2) {
  throw new Error(
    `Build contract failed: expected local and production success responses, found ${successResponseObjects.length}.`
  );
}

for (const { keys } of successResponseObjects) {
  if (!keys.has("attribution_trace_id")) {
    throw new Error(
      "Build contract failed: every public lead success response must include attribution_trace_id."
    );
  }
}

console.log(
  "Verified public lead insert columns, success trace responses, and immutable build source."
);
