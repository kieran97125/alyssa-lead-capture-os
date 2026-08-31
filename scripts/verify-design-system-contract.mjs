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
  "src/components/system/DesignSystemSpecimen.tsx",
  "src/app/e2e/design-system/page.tsx",
  ".storybook/main.ts",
  ".storybook/preview.ts",
  "e2e/design-quality.spec.ts",
  "design/registry-allowlist.json",
  "docs/design-system/README.md",
  "docs/design-system/CHANGELOG.md",
  "docs/design-system/decisions/ADR-001-design-quality-foundation.md",
  "docs/design-system/rollback/2026-08-31-foundation-v1.md",
];
requiredFiles.forEach((file) => assert.ok(exists(file), "Missing design system file: " + file));

const config = JSON.parse(read("components.json"));
assert.equal(config.style, "base-nova");
assert.equal(config.tailwind.cssVariables, true);
assert.deepEqual(config.registries, {});
assert.equal(config.aliases.ui, "@/components/ui");

const pkg = JSON.parse(read("package.json"));
assert.ok(pkg.dependencies?.["@base-ui/react"], "Base UI dependency is missing");
assert.ok(pkg.devDependencies?.["@storybook/nextjs-vite"], "Storybook Next.js Vite is missing");
assert.ok(pkg.devDependencies?.["@storybook/addon-a11y"], "Storybook a11y addon is missing");
assert.ok(pkg.devDependencies?.["@axe-core/playwright"], "Playwright axe integration is missing");

const globals = read("src/app/globals.css");
for (const requiredImport of [
  '@import "tw-animate-css";',
  '@import "shadcn/tailwind.css";',
  '@import "./design-system.css";',
]) {
  assert.ok(globals.includes(requiredImport), "Missing global CSS import: " + requiredImport);
}

const tokens = read("src/app/design-system.css");
for (const token of [
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

const systemFiles = fs
  .readdirSync(path.join(root, "src/components/system"))
  .filter((file) => file.endsWith(".tsx") && !file.endsWith(".stories.tsx"));
for (const file of systemFiles) {
  const source = read("src/components/system/" + file);
  assert.doesNotMatch(source, /#[0-9a-fA-F]{3,8}/, file + " contains raw hex colour");
}

assert.match(read("AGENTS.md"), /Design Quality Gate/);
assert.match(read("docs/design-system/CHANGELOG.md"), /Foundation v1/);
console.log("Design system contract verified: Base UI, tokens, Storybook, visual and accessibility gates are present.");
