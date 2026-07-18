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

const deterministicHelper = `  if (!source.includes(from)) {
    if (label === "lead event attribution trace") return source;
    throw new Error(\`Missing \${label}: \${from.slice(0, 120)}\`);
  }
  return source.replace(from, to);`;

if (!source.includes('label === "lead event attribution trace"')) {
  if (!source.includes(strictHelper)) {
    throw new Error("Attribution preparer helper changed unexpectedly");
  }
  source = source.replace(strictHelper, deterministicHelper);
  await writeFile(preparerPath, source, "utf8");
}

await import("./prepare-attribution-bridge.mjs");
