import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(repoRoot, "src/components/alyssa/PublicLeadForm.tsx");
let source = await readFile(target, "utf8");

const marker = `  useEffect(() => {\n    async function loadConfig() {`;
const replacement = `  // LAUNCHHUB_EARLY_ATTRIBUTION_CAPTURE\n  useEffect(() => {\n    const earlyAttribution = captureCurrentPageAttribution({\n      formToken,\n      formId: formId || publicForm.id,\n      brandSlug: brand.slug || brandSlug || "alyssa",\n      initialQueryString,\n      serverInitialAttribution,\n    });\n    const mergedAttribution = mergeAttributionEnvelopes(\n      attributionRef.current,\n      earlyAttribution\n    ) as AttributionEnvelope;\n    attributionRef.current = mergedAttribution;\n    setAttribution(mergedAttribution);\n  }, [\n    brand.slug,\n    brandSlug,\n    formId,\n    formToken,\n    initialQueryString,\n    publicForm.id,\n    serverInitialAttribution,\n  ]);\n\n  useEffect(() => {\n    async function loadConfig() {`;

if (!source.includes("LAUNCHHUB_EARLY_ATTRIBUTION_CAPTURE")) {
  if (!source.includes(marker)) {
    throw new Error("PublicLeadForm config loader marker changed unexpectedly");
  }
  source = source.replace(marker, replacement);
  await writeFile(target, source, "utf8");
}

console.log("Prepared early first-touch attribution capture.");
