import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const preparerPath = path.join(repoRoot, "scripts/prepare-attribution-bridge.mjs");
let source = await readFile(preparerPath, "utf8");

const strictHelper = `  if (!source.includes(from)) {
    throw new Error(\`Missing \${label}: \${from.slice(0, 120)}\`);
  }
  return source.replace(from, to);`;

const tolerantHelper = `  if (!source.includes(from)) {
    const escaped = from
      .trim()
      .split(/\\s+/)
      .map((part) => part.replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&"))
      .join("\\\\s+");
    const flexiblePattern = new RegExp(escaped);
    if (flexiblePattern.test(source)) {
      return source.replace(flexiblePattern, to.trim());
    }
    throw new Error(\`Missing \${label}: \${from.slice(0, 120)}\`);
  }
  return source.replace(from, to);`;

if (!source.includes("flexiblePattern")) {
  if (!source.includes(strictHelper)) {
    throw new Error("Attribution preparer helper changed unexpectedly");
  }
  source = source.replace(strictHelper, tolerantHelper);
  await writeFile(preparerPath, source, "utf8");
}

await import("./prepare-attribution-bridge.mjs");
