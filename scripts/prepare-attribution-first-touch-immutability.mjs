import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(repoRoot, "src/components/alyssa/PublicLeadForm.tsx");
let source = await readFile(target, "utf8");

const from = `  const firstTouch = hasCurrentParams
    ? { ...basePayload, ...paramPayload }
    : firstTrackingStored ||
      authoritativeTrackingTouch ||
      firstStored || { ...basePayload, ...paramPayload };`;

const to = `  // LAUNCHHUB_FIRST_TOUCH_IMMUTABLE: a later or empty visit must never
  // replace the first valid acquisition touch.
  const currentTouch = { ...basePayload, ...paramPayload };
  const firstTouch =
    firstTrackingStored ||
    lockedTouch ||
    authoritativeTrackingTouch ||
    getTrackingTouch(currentTouch) ||
    firstStored ||
    currentTouch;`;

if (!source.includes("LAUNCHHUB_FIRST_TOUCH_IMMUTABLE")) {
  if (!source.includes(from)) {
    throw new Error("PublicLeadForm first-touch selection changed unexpectedly");
  }
  source = source.replace(from, to);
  await writeFile(target, source, "utf8");
}

console.log("Prepared immutable first-touch attribution selection.");
