import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(repoRoot, "src/app/api/public/leads/route.ts");
let source = await readFile(target, "utf8");

const from = `  if (!hasSupabaseAdminEnv()) {`;
const to = `  // Attribution E2E must never write synthetic leads into a linked database.\n  if (process.env.ALYSSA_E2E_FIXTURES === "1" || !hasSupabaseAdminEnv()) {`;

if (!source.includes(to)) {
  if (!source.includes(from)) {
    throw new Error("Public lead API local fallback condition changed unexpectedly");
  }
  source = source.replace(from, to);
  await writeFile(target, source, "utf8");
}

console.log("Prepared attribution E2E database isolation.");
