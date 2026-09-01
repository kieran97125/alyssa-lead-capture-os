import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));

const requiredFiles = [
  "components.json",
  "src/app/design-system.css",
  "src/components/system/SystemButton.tsx",
  "src/components/system/SystemConfirmationDialog.tsx",
  "src/components/system/SystemConfirmationDialog.stories.tsx",
  "src/components/system/DesignSystemSpecimen.tsx",
  "src/app/e2e/design-system/page.tsx",
  ".storybook/main.ts",
  ".storybook/preview.ts",
  "e2e/design-quality.spec.ts",
  "design/registry-allowlist.json",
  "docs/design-system/README.md",
  "docs/design-system/CHANGELOG.md",
  "docs/design-system/decisions/ADR-001-design-quality-foundation.md",
  "docs/design-system/decisions/ADR-002-system-confirmation-dialog.md",
  "docs/design-system/rollback/2026-08-31-foundation-v1.md",
  "docs/design-system/rollback/2026-09-01-creative-job-delete-confirmation.md",
  "e2e/creative-production.spec.ts-snapshots/creative-job-delete-confirmation-desktop-chromium-linux.png",
  "e2e/creative-production.spec.ts-snapshots/creative-job-delete-confirmation-mobile-chromium-linux.png",
];
requiredFiles.forEach((file) =>
  assert.ok(exists(file), "Missing design system file: " + file)
);

const config = JSON.parse(read("components.json"));
assert.equal(config.style, "base-nova");
assert.equal(config.tailwind.cssVariables, true);
assert.deepEqual(config.registries, {});
assert.equal(config.aliases.ui, "@/components/ui");

const pkg = JSON.parse(read("package.json"));
assert.ok(pkg.dependencies?.["@base-ui/react"], "Base UI dependency is missing");
assert.ok(
  pkg.devDependencies?.["@storybook/nextjs-vite"],
  "Storybook Next.js Vite is missing"
);
assert.ok(
  pkg.devDependencies?.["@storybook/addon-a11y"],
  "Storybook a11y addon is missing"
);
assert.ok(
  pkg.devDependencies?.["@axe-core/playwright"],
  "Playwright axe integration is missing"
);

const globals = read("src/app/globals.css");
for (const requiredImport of [
  '@import "tw-animate-css";',
  '@import "shadcn/tailwind.css";',
  '@import "./design-system.css";',
]) {
  assert.ok(
    globals.includes(requiredImport),
    "Missing global CSS import: " + requiredImport
  );
}

const tokens = read("src/app/design-system.css");
for (const token of [
  "--system-background",
  "--system-foreground",
  "--system-primary",
  "--system-muted",
  "--system-muted-foreground",
  "--system-border",
  "--surface-page",
  "--surface-card",
  "--text-primary",
  "--border-default",
  "--control-height-sm",
  "--control-height-md",
  "--radius-control",
  "--radius-card",
  "--shadow-card",
]) {
  assert.match(tokens, new RegExp(token));
}

const globalThemeBlocks = Array.from(
  tokens.matchAll(/(?:^|\n)\s*(?::root|\.dark)\s*\{([\s\S]*?)\}/g),
  (match) => match[1]
).join("\n");
const globallyDeclaredTokenNames = Array.from(
  globalThemeBlocks.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim),
  (match) => match[1]
);
const forbiddenGlobalTokenNames = [
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--primary",
  "--primary-foreground",
  "--secondary",
  "--secondary-foreground",
  "--muted",
  "--muted-foreground",
  "--accent",
  "--accent-foreground",
  "--destructive",
  "--border",
  "--input",
  "--ring",
  "--radius",
];
for (const tokenName of forbiddenGlobalTokenNames) {
  assert.ok(
    !globallyDeclaredTokenNames.includes(tokenName),
    `Design system must not declare legacy global token ${tokenName} in :root or .dark; use --system-* instead.`
  );
}

assert.match(
  tokens,
  /\.lead-dashboard-stack\s*\{[\s\S]*?--muted:\s*var\(--command-muted,[\s\S]*?\}/,
  "Dashboard readable-text compatibility boundary is missing"
);

const componentFiles = [
  ...fs
    .readdirSync(path.join(root, "src/components/ui"))
    .filter((file) => file.endsWith(".tsx")),
  ...fs
    .readdirSync(path.join(root, "src/components/system"))
    .filter((file) => file.endsWith(".tsx") && !file.endsWith(".stories.tsx"))
    .map((file) => "../system/" + file),
];
const forbiddenGenericUtilities = [
  "bg-background",
  "text-foreground",
  "bg-card",
  "text-card-foreground",
  "bg-primary",
  "text-primary",
  "bg-secondary",
  "text-secondary",
  "bg-muted",
  "text-muted",
  "bg-accent",
  "text-accent",
  "bg-destructive",
  "text-destructive",
  "border-border",
  "border-input",
  "border-ring",
  "ring-ring",
];
for (const relativeFile of componentFiles) {
  const file = relativeFile.startsWith("../system/")
    ? "src/components/system/" + relativeFile.slice("../system/".length)
    : "src/components/ui/" + relativeFile;
  const source = read(file);
  assert.doesNotMatch(
    source,
    /#[0-9a-fA-F]{3,8}\b/,
    file + " contains raw hex colour"
  );
  for (const utility of forbiddenGenericUtilities) {
    assert.ok(
      !source.includes(utility),
      `${file} uses collision-prone utility ${utility}; use the system-* namespace.`
    );
  }
}

const confirmationDialog = read(
  "src/components/system/SystemConfirmationDialog.tsx"
);
const confirmationStory = read(
  "src/components/system/SystemConfirmationDialog.stories.tsx"
);
const creativeVisualTest = read("e2e/creative-production.spec.ts");
assert.match(confirmationDialog, /@base-ui\/react\/dialog/);
assert.match(confirmationDialog, /buttonVariants/);
assert.match(confirmationDialog, /Dialog\.Description/);
assert.match(confirmationStory, /OpenDanger/);
assert.match(confirmationStory, /IconTrigger/);
assert.match(
  creativeVisualTest,
  /creative-job-delete-confirmation-desktop\.png/
);
assert.match(
  creativeVisualTest,
  /creative-job-delete-confirmation-mobile\.png/
);
assert.match(read("AGENTS.md"), /Design Quality Gate/);
assert.match(read("docs/design-system/CHANGELOG.md"), /Foundation v1/);
assert.match(
  read("docs/design-system/CHANGELOG.md"),
  /Creative Job deletion confirmation/
);
console.log(
  "Design system contract verified: namespaced tokens, Base UI, Storybook, visual and accessibility gates are present without legacy global collisions."
);
