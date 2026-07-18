import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(repoRoot, "src/components/alyssa/PublicLeadForm.tsx");
let source = await readFile(target, "utf8");

const before = `  const firstTouch = hasCurrentParams
    ? { ...basePayload, ...paramPayload }
    : firstTrackingStored ||
      authoritativeTrackingTouch ||
      firstStored || { ...basePayload, ...paramPayload };`;

const after = `  // LAUNCHHUB_FIRST_TOUCH_LOCK_V2
  // First touch is the first valid acquisition touch and must not be replaced by
  // a later clean URL, browser cookies, or a subsequent campaign visit.
  const firstTouch =
    firstTrackingStored ||
    getTrackingTouch(lockedDetails.local) ||
    authoritativeTrackingTouch ||
    getTrackingTouch(firstStored) ||
    { ...basePayload, ...paramPayload };`;

if (!source.includes("LAUNCHHUB_FIRST_TOUCH_LOCK_V2")) {
  if (!source.includes(before)) {
    throw new Error("PublicLeadForm first-touch selection changed unexpectedly");
  }
  source = source.replace(before, after);
  await writeFile(target, source, "utf8");
}

console.log("Prepared immutable first-touch attribution selection.");
