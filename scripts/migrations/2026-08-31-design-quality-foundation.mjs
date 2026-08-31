#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const phase = process.argv[2] || "finalize";

function absolute(file) {
  return path.join(root, file);
}

function read(file) {
  return fs.readFileSync(absolute(file), "utf8");
}

function write(file, content) {
  fs.mkdirSync(path.dirname(absolute(file)), { recursive: true });
  fs.writeFileSync(absolute(file), content.endsWith("\n") ? content : `${content}\n`, "utf8");
}

function remove(file) {
  fs.rmSync(absolute(file), { recursive: true, force: true });
}

function ensureLine(file, line, afterLine = null) {
  let content = read(file);
  if (content.includes(line)) return;
  if (afterLine && content.includes(afterLine)) {
    content = content.replace(afterLine, `${afterLine}\n${line}`);
  } else {
    content = `${line}\n${content}`;
  }
  write(file, content);
}

function appendOnce(file, marker, block) {
  const content = read(file);
  if (content.includes(marker)) return;
  write(file, `${content.trimEnd()}\n\n${block.trim()}\n`);
}

function updatePackageScripts() {
  const file = "package.json";
  const pkg = JSON.parse(read(file));
  if (!pkg.scripts) pkg.scripts = {};
  if (!pkg.scripts.build.includes("verify:design-system-contract")) {
    pkg.scripts.build = pkg.scripts.build.replace(
      " && next build",
      " && npm run verify:design-system-contract && next build"
    );
  }
  Object.assign(pkg.scripts, {
    "verify:design-system-contract": "node scripts/verify-design-system-contract.mjs",
    storybook: "storybook dev -p 6006 --no-open",
    "build:storybook": "storybook build --quiet",
    "test:design": "playwright test e2e/design-quality.spec.ts",
    "test:design:update": "playwright test e2e/design-quality.spec.ts --update-snapshots",
    "design:ci": "npm run verify:design-system-contract && npm run build:storybook && npm run test:design",
  });
  write(file, `${JSON.stringify(pkg, null, 2)}\n`);
}

function prepare() {
  write(
    "components.json",
    `{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "base-nova",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/app/globals.css",
    "baseColor": "mauve",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "rtl": false,
  "menuColor": "default",
  "menuAccent": "subtle",
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "registries": {}
}`
  );

  write(
    "src/lib/utils.ts",
    `import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}`
  );

  ensureLine("src/app/globals.css", '@import "tw-animate-css";', '@import "tailwindcss";');
  ensureLine("src/app/globals.css", '@import "shadcn/tailwind.css";', '@import "tw-animate-css";');
  ensureLine("src/app/globals.css", '@import "./design-system.css";', '@import "shadcn/tailwind.css";');

  write(
    "src/app/design-system.css",
    `@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius-sm: calc(var(--radius) - 0.25rem);
  --radius-md: calc(var(--radius) - 0.125rem);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 0.25rem);
  --radius-2xl: calc(var(--radius) + 0.5rem);
}

:root {
  --background: #fbf7f5;
  --foreground: #321428;
  --card: #ffffff;
  --card-foreground: #321428;
  --popover: #ffffff;
  --popover-foreground: #321428;
  --primary: #5a2348;
  --primary-foreground: #ffffff;
  --secondary: #fff6f0;
  --secondary-foreground: #5a2348;
  --muted: #f7f1ef;
  --muted-foreground: #765f6d;
  --accent: #f8e8e2;
  --accent-foreground: #5a2348;
  --destructive: #b42318;
  --border: #ead9cf;
  --input: #dfcfc7;
  --ring: #9a5d76;
  --radius: 0.75rem;

  --surface-page: #fbf7f5;
  --surface-card: #ffffff;
  --surface-subtle: #fffaf7;
  --surface-elevated: #ffffff;
  --text-primary: #321428;
  --text-secondary: #6d4a5c;
  --text-muted: #806c77;
  --border-subtle: #efe4df;
  --border-default: #ead9cf;
  --border-strong: #d9c3ba;
  --control-height-sm: 2rem;
  --control-height-md: 2.5rem;
  --control-height-lg: 2.875rem;
  --radius-control: 0.625rem;
  --radius-card: 1rem;
  --radius-panel: 1.25rem;
  --shadow-control: 0 2px 8px rgba(90, 35, 72, 0.08);
  --shadow-card: 0 12px 34px rgba(90, 35, 72, 0.08);
  --shadow-overlay: 0 24px 70px rgba(50, 20, 40, 0.16);
}

.dark {
  --background: #24101d;
  --foreground: #fff8fb;
  --card: #311627;
  --card-foreground: #fff8fb;
  --popover: #311627;
  --popover-foreground: #fff8fb;
  --primary: #e7afc3;
  --primary-foreground: #321428;
  --secondary: #422036;
  --secondary-foreground: #fff8fb;
  --muted: #3a1b30;
  --muted-foreground: #d3b7c3;
  --accent: #4a2239;
  --accent-foreground: #fff8fb;
  --destructive: #ff8a80;
  --border: #5d344b;
  --input: #5d344b;
  --ring: #d29ab1;
}

@layer base {
  * {
    border-color: var(--border);
  }

  body {
    background: var(--background);
    color: var(--foreground);
  }
}`
  );
}

function finalize() {
  remove("src/stories");
  remove(".storybook/main.js");
  remove(".storybook/main.mjs");
  remove(".storybook/main.ts");
  remove(".storybook/preview.js");
  remove(".storybook/preview.ts");
  remove(".storybook/preview.tsx");

  write(
    ".storybook/main.ts",
    `import type { StorybookConfig } from "@storybook/nextjs-vite";

const config: StorybookConfig = {
  stories: [
    "../src/**/*.mdx",
    "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)",
  ],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],
  framework: {
    name: "@storybook/nextjs-vite",
    options: {},
  },
  staticDirs: ["../public"],
  docs: {
    autodocs: "tag",
  },
};

export default config;`
  );

  write(
    ".storybook/preview.ts",
    `import type { Preview } from "@storybook/nextjs-vite";
import "../src/app/globals.css";

const preview: Preview = {
  parameters: {
    layout: "centered",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: "Alyssa Page",
      values: [
        { name: "Alyssa Page", value: "#fbf7f5" },
        { name: "White", value: "#ffffff" },
      ],
    },
    a11y: {
      test: "error",
    },
  },
  tags: ["autodocs"],
};

export default preview;`
  );

  write(
    "src/components/system/SystemButton.tsx",
    `import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SystemButtonDensity = "compact" | "default" | "comfortable";

type SystemButtonProps = ComponentProps<typeof Button> & {
  density?: SystemButtonDensity;
};

const densityClasses: Record<SystemButtonDensity, string> = {
  compact: "h-8 gap-1.5 rounded-[var(--radius-control)] px-3 text-xs",
  default: "h-10 gap-2 rounded-[var(--radius-control)] px-4 text-sm",
  comfortable: "h-11 gap-2 rounded-[var(--radius-control)] px-5 text-sm",
};

export function SystemButton({
  density = "default",
  className,
  ...props
}: SystemButtonProps) {
  return (
    <Button
      data-slot="system-button"
      className={cn(densityClasses[density], className)}
      {...props}
    />
  );
}`
  );

  write(
    "src/components/system/DesignSystemSpecimen.tsx",
    `"use client";

import { useState } from "react";
import { CheckCircle2, Download, Plus, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendModeToggle } from "@/components/command-center/TrendModeToggle";
import { SystemButton } from "@/components/system/SystemButton";
import type { PerformanceTrendMode } from "@/lib/marketing/performanceTrend";

export function DesignSystemSpecimen() {
  const [mode, setMode] = useState<PerformanceTrendMode>("cumulative");

  return (
    <main
      data-testid="design-system-specimen"
      className="min-h-screen w-full bg-background px-5 py-8 text-foreground sm:px-8 lg:px-12"
    >
      <div className="mx-auto grid w-full max-w-6xl gap-6">
        <header className="flex flex-col gap-4 rounded-[var(--radius-panel)] border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <Badge variant="secondary" className="mb-3">Design Quality Foundation v1</Badge>
            <h1 className="text-2xl font-black tracking-[-0.03em] sm:text-3xl">
              Alyssa Growth OS Design System
            </h1>
            <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-muted-foreground">
              共用 tokens、組件、視覺回歸同 accessibility gate，令每次 UI 改動都有一致標準同可追溯證據。
            </p>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Foundation status">
            <Badge variant="outline"><CheckCircle2 aria-hidden="true" /> Base UI</Badge>
            <Badge variant="outline"><CheckCircle2 aria-hidden="true" /> Storybook</Badge>
            <Badge variant="outline"><CheckCircle2 aria-hidden="true" /> Visual Gate</Badge>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-[var(--radius-panel)] border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Controls</p>
                <h2 className="mt-1 text-lg font-black">Button hierarchy</h2>
              </div>
              <Badge>Approved primitive</Badge>
            </div>
            <Separator className="my-5" />
            <div className="flex flex-wrap items-center gap-3">
              <SystemButton density="compact"><Plus aria-hidden="true" /> 新增工作</SystemButton>
              <SystemButton variant="secondary"><Download aria-hidden="true" /> 匯出報告</SystemButton>
              <SystemButton variant="outline">編輯設定</SystemButton>
              <SystemButton variant="ghost">更多</SystemButton>
            </div>
            <div className="mt-6 rounded-[var(--radius-card)] border border-border bg-muted/55 p-4">
              <TrendModeToggle mode={mode} onChange={setMode} />
            </div>
          </article>

          <article className="rounded-[var(--radius-panel)] border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Density</p>
            <h2 className="mt-1 text-lg font-black">Calm, compact, operational</h2>
            <p className="mt-2 text-sm font-medium leading-6 text-muted-foreground">
              內部系統以掃讀速度為先，控制項保持緊湊；需要確認或高風險操作先增加視覺重量。
            </p>
            <div className="mt-5 grid gap-3">
              <div className="rounded-[var(--radius-card)] border border-border bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold">本週內容排程</span>
                  <Badge variant="secondary">進行中</Badge>
                </div>
                <p className="mt-2 text-xs font-medium text-muted-foreground">Start Day 決定工作週；Due Day 決定日曆與出街。</p>
              </div>
              <div className="rounded-[var(--radius-card)] border border-border bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold">同期對比</span>
                  <Badge variant="outline">已驗證</Badge>
                </div>
                <p className="mt-2 text-xs font-medium text-muted-foreground">單日睇波動；累積睇 pace，比例按基礎數重新計算。</p>
              </div>
            </div>
          </article>
        </section>

        <section className="rounded-[var(--radius-panel)] border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">States</p>
              <h2 className="mt-1 text-lg font-black">Loading and system feedback</h2>
            </div>
            <SystemButton variant="outline" density="compact"><Sparkles aria-hidden="true" /> 檢查設計</SystemButton>
          </div>
          <Separator className="my-5" />
          <div className="grid gap-4 sm:grid-cols-3">
            {["Metric", "Table row", "Chart toolbar"].map((label) => (
              <div key={label} className="rounded-[var(--radius-card)] border border-border bg-background p-4">
                <span className="text-xs font-bold text-muted-foreground">{label}</span>
                <Skeleton className="mt-3 h-4 w-2/3" />
                <Skeleton className="mt-2 h-8 w-full" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}`
  );

  write(
    "src/components/system/SystemButton.stories.tsx",
    `import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Download, Plus } from "lucide-react";
import { SystemButton } from "@/components/system/SystemButton";

const meta = {
  title: "System/Controls/SystemButton",
  component: SystemButton,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: { children: "Primary action" },
} satisfies Meta<typeof SystemButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};
export const Compact: Story = {
  args: { density: "compact", children: "新增工作" },
  render: (args) => <SystemButton {...args}><Plus aria-hidden="true" />新增工作</SystemButton>,
};
export const Secondary: Story = {
  args: { variant: "secondary", children: "匯出報告" },
  render: (args) => <SystemButton {...args}><Download aria-hidden="true" />匯出報告</SystemButton>,
};
export const Outline: Story = { args: { variant: "outline", children: "編輯設定" } };
export const Disabled: Story = { args: { disabled: true, children: "處理中" } };
`
  );

  write(
    "src/components/system/TrendModeToggle.stories.tsx",
    `import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TrendModeToggle } from "@/components/command-center/TrendModeToggle";
import type { PerformanceTrendMode } from "@/lib/marketing/performanceTrend";

const meta = {
  title: "System/Controls/TrendModeToggle",
  component: TrendModeToggle,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof TrendModeToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Interactive: Story = {
  args: { mode: "cumulative", onChange: () => undefined },
  render: () => {
    const [mode, setMode] = useState<PerformanceTrendMode>("cumulative");
    return <TrendModeToggle mode={mode} onChange={setMode} />;
  },
};

export const Compact: Story = {
  args: { mode: "daily", onChange: () => undefined, compact: true },
};
`
  );

  write(
    "src/components/system/DesignSystemSpecimen.stories.tsx",
    `import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DesignSystemSpecimen } from "@/components/system/DesignSystemSpecimen";

const meta = {
  title: "System/Foundation/Specimen",
  component: DesignSystemSpecimen,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
} satisfies Meta<typeof DesignSystemSpecimen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Foundation: Story = {};
`
  );

  write(
    "src/app/__design-system/page.tsx",
    `import { notFound } from "next/navigation";
import { DesignSystemSpecimen } from "@/components/system/DesignSystemSpecimen";

export default function DesignSystemFixturePage() {
  const fixtureEnabled = process.env.ALYSSA_E2E_FIXTURES === "1";
  const localDevelopment = process.env.NODE_ENV !== "production";
  if (!fixtureEnabled && !localDevelopment) notFound();
  return <DesignSystemSpecimen />;
}`
  );

  write(
    "e2e/design-quality.spec.ts",
    `import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

async function openSpecimen(page: Parameters<typeof test>[0] extends never ? never : any) {
  await page.goto("/__design-system", { waitUntil: "networkidle" });
  await expect(page.getByTestId("design-system-specimen")).toBeVisible();
}

test("design foundation desktop visual baseline", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openSpecimen(page);
  await expect(page).toHaveScreenshot("design-foundation-desktop.png", {
    fullPage: true,
    animations: "disabled",
  });
});

test("design foundation mobile visual baseline", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openSpecimen(page);
  await expect(page).toHaveScreenshot("design-foundation-mobile.png", {
    fullPage: true,
    animations: "disabled",
  });
});

test("design foundation has no automated WCAG A or AA violations", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openSpecimen(page);
  const result = await new AxeBuilder({ page })
    .include('[data-testid="design-system-specimen"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(result.violations).toEqual([]);
});
`
  );

  write(
    "scripts/verify-design-system-contract.mjs",
    `import assert from "node:assert/strict";
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
  ".storybook/main.ts",
  ".storybook/preview.ts",
  "e2e/design-quality.spec.ts",
  "design/registry-allowlist.json",
  "docs/design-system/README.md",
  "docs/design-system/CHANGELOG.md",
  "docs/design-system/decisions/ADR-001-design-quality-foundation.md",
  "docs/design-system/rollback/2026-08-31-foundation-v1.md",
];
requiredFiles.forEach((file) => assert.ok(exists(file), `Missing design system file: ${file}`));

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
  assert.match(globals, new RegExp(requiredImport.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
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
  const source = read(`src/components/system/${file}`);
  assert.doesNotMatch(source, /#[0-9a-fA-F]{3,8}\b/, `${file} contains raw hex colour`);
}

assert.match(read("AGENTS.md"), /Design Quality Gate/);
assert.match(read("docs/design-system/CHANGELOG.md"), /Foundation v1/);
console.log("Design system contract verified: Base UI, tokens, Storybook, visual and accessibility gates are present.");
`
  );

  write(
    ".github/workflows/design-quality.yml",
    `name: Design Quality Gate

on:
  pull_request:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

jobs:
  design-quality:
    runs-on: ubuntu-24.04
    timeout-minutes: 15
    env:
      CI: true
      E2E_ADMIN_PASSWORD: playwright-ci-password
      LAUNCHHUB_ADMIN_PASSWORD: playwright-ci-password
      LAUNCHHUB_ADMIN_SESSION_SECRET: playwright-ci-session-secret-at-least-32-characters
      NEXT_PUBLIC_SUPABASE_URL: ""
      SUPABASE_SERVICE_ROLE_KEY: ""

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Verify design system contract
        run: npm run verify:design-system-contract

      - name: Build component workshop
        run: npm run build:storybook

      - name: Install Chromium
        run: npx playwright install --with-deps chromium

      - name: Run visual and accessibility gate
        run: npm run test:design

      - name: Upload design report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: design-quality-report
          path: playwright-report/
          retention-days: 14

      - name: Upload visual diffs
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: design-quality-diffs
          path: test-results/
          retention-days: 14
`
  );

  write(
    "design/registry-allowlist.json",
    `{
  "$schema": "./registry-allowlist.schema.json",
  "policy": "deny-by-default",
  "approved": [
    {
      "id": "@shadcn",
      "source": "https://ui.shadcn.com",
      "scope": "official primitives only",
      "reviewRequiredPerInstall": true
    }
  ],
  "blockedUntilReviewed": [
    "community registries",
    "visual effect libraries",
    "dashboard block packs",
    "AI-generated remote registries"
  ]
}`
  );

  write(
    "design/registry-allowlist.schema.json",
    `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["policy", "approved", "blockedUntilReviewed"],
  "properties": {
    "policy": { "const": "deny-by-default" },
    "approved": { "type": "array" },
    "blockedUntilReviewed": { "type": "array" }
  }
}`
  );

  write(
    "docs/design-system/README.md",
    `# Alyssa Growth OS Design Quality Layer

## Purpose

This layer reduces subjective UI drift by making design decisions reusable, testable and reviewable. It does not replace product judgement; it creates constraints so every new screen begins from an approved foundation.

## Architecture

1. **Base UI** supplies accessible interaction primitives.
2. **shadcn/ui base-nova** places owned component source in this repository.
3. **Alyssa semantic tokens** define brand, density, radius, elevation and control hierarchy.
4. **System components** wrap primitives with Alyssa product rules.
5. **Storybook** exposes approved states in isolation.
6. **Playwright screenshots** detect visual drift in a fixed Linux environment.
7. **axe-core** blocks automatically detectable WCAG A/AA regressions.
8. **Agent rules and registry allowlist** prevent uncontrolled component imports.

## Commands

- npm run storybook
- npm run build:storybook
- npm run verify:design-system-contract
- npm run test:design
- npm run test:design:update
- npm run design:ci

## Adding a component

1. Confirm the product need and check existing System components.
2. Review official shadcn documentation and registry source.
3. Add only the required primitive with the shadcn CLI.
4. Wrap it under src/components/system when product-level defaults are needed.
5. Add stories for normal, compact, disabled, loading, empty and error states as relevant.
6. Add or update deterministic screenshots.
7. Run the design contract, Storybook build, visual test and axe test.
8. Record the decision in CHANGELOG.md and an ADR when the architecture changes.

## Current boundary

Foundation v1 does not rewrite legacy pages. New work should use the new layer; touched legacy surfaces should be migrated deliberately instead of through broad cosmetic replacements.
`
  );

  write(
    "docs/design-system/VISUAL_LANGUAGE.md",
    `# Visual Language

## Product character

Alyssa Growth OS should feel calm, precise and premium rather than decorative. It is an operational system: scan speed, hierarchy and confidence come before visual novelty.

## Density

- Compact controls for tables, toolbars and repeated actions.
- Default controls for forms and primary page actions.
- Comfortable controls only for onboarding, destructive confirmation or singular hero actions.
- A control must not become visually heavier than the data it controls.

## Geometry

- Control radius: --radius-control.
- Card radius: --radius-card.
- Panel radius: --radius-panel.
- Pills are reserved for status, filters and genuinely binary segmented controls.

## Elevation

- Most surfaces use borders, not shadows.
- --shadow-control is for selected or floating controls only.
- --shadow-card is for major cards, not every nested container.
- --shadow-overlay is reserved for dialogs and popovers.

## Colour

- Deep plum communicates primary action and active state.
- Rose and blush support hierarchy; they do not replace semantic status colours.
- Raw hexadecimal colours are forbidden in System components; use semantic tokens.
- Chart series colours remain data-specific and are governed separately.

## Motion

Use motion only for state transition, navigation continuity and feedback. Decorative looping animation is not part of the admin product language.
`
  );

  write(
    "docs/design-system/COMPONENT_RULES.md",
    `# Component Rules

## Ownership layers

- src/components/ui: generated or reviewed primitives. Avoid product-specific copy and business logic.
- src/components/system: Alyssa defaults, density, status language and composition.
- feature folders: business behavior assembled from System components.

## Mandatory rules

1. Search Storybook before creating a new control.
2. Do not create a second Button, Dialog, Toggle, Table or Empty State contract in a feature folder.
3. Do not install a third-party registry unless it is added to the allowlist after code, license and dependency review.
4. Do not use raw hex colours in System components.
5. Do not use arbitrary pixel values for recurring control height, radius or spacing.
6. Every shared component requires a story.
7. Every meaningful UI change requires visual evidence at desktop and mobile where relevant.
8. Accessibility automation must pass; manual keyboard and focus review remains required.
9. Loading, empty, error, disabled and permission-denied states are part of the component contract.
10. Product direction must stay Alyssa-specific; avoid generic dashboard blocks and chatbot-wrapper layouts.
`
  );

  write(
    "docs/design-system/UI_REVIEW_CHECKLIST.md",
    `# UI Review Checklist

## Hierarchy

- Is there one clear primary action?
- Are controls visually lighter than the content they control?
- Can the page be scanned without reading every helper sentence?

## Consistency

- Existing System component reused?
- Semantic token used for colour, radius, height and elevation?
- Toolbar, table and form density consistent with comparable screens?

## States

- Loading, empty, error, disabled and permission states covered where relevant?
- Long text, large numbers and narrow screens tested?
- Focus, keyboard order and visible labels checked?

## Evidence

- Story added or updated?
- Desktop and mobile visual diff reviewed?
- axe gate passed?
- Change log and rollback note updated?
- Product-learning classification completed?
`
  );

  write(
    "docs/design-system/REGISTRY_ALLOWLIST.md",
    `# Registry Policy

The default policy is deny-by-default.

Only the official shadcn registry is approved, and every install still requires source review. Community registries, visual-effect packs and dashboard blocks are not approved merely because they use the shadcn format.

Before approval, record:

- package and transitive dependencies;
- licence;
- maintenance activity;
- keyboard and accessibility behavior;
- code ownership and update path;
- bundle and runtime impact;
- whether the component preserves Alyssa product direction;
- removal and rollback procedure.

The machine-readable policy is design/registry-allowlist.json.
`
  );

  write(
    "docs/design-system/CHANGELOG.md",
    `# Design System Change Log

## 2026-08-31 — Foundation v1

Issue: #74

### Added

- shadcn/ui Base UI configuration using base-nova.
- Alyssa semantic design tokens and density contract.
- Initial official primitives: Button, Badge, Separator and Skeleton.
- SystemButton product wrapper.
- Storybook with Next.js Vite, docs and accessibility addon.
- Deterministic design specimen route restricted to development and E2E fixtures.
- Desktop and mobile Playwright screenshot baselines.
- axe-core WCAG A/AA automated gate.
- Design contract, registry allowlist, agent rules, ADR and rollback map.

### Unchanged

- Lead, Book, Show and attribution calculations.
- Calendar, Task, CRM, Spend and reporting business logic.
- Existing production page layouts except future deliberate migrations.

### Evidence

The release PR, merge commit, Vercel deployment and test run are appended after release.
`
  );

  write(
    "docs/design-system/decisions/ADR-001-design-quality-foundation.md",
    `# ADR-001: Design Quality Foundation

- Date: 2026-08-31
- Status: Accepted for Phase 1
- Issue: #74

## Context

The application already has a strong data and workflow architecture, but UI decisions are distributed across feature files and a large global stylesheet. This allows spacing, control size, radius and visual weight to drift even when functionality is correct.

## Decision

Adopt a layered foundation:

- Base UI for new accessible interaction primitives;
- shadcn/ui base-nova so component source remains owned by the repository;
- Alyssa semantic tokens rather than a generic shadcn theme;
- Storybook as the approved component workshop;
- Playwright visual baselines in a fixed Ubuntu environment;
- axe-core as an automated accessibility gate;
- deny-by-default registry policy;
- system wrappers for product-specific defaults.

## Why base-nova

Nova gives a compact structural baseline suitable for an operational admin product. Alyssa tokens replace its generic colour identity. Luma was not selected because its softer, more spacious geometry would increase the risk of oversized controls in dense workflows.

## Consequences

- New UI work has more setup evidence but less subjective drift.
- Legacy UI remains until touched; broad rewrites are explicitly avoided.
- Generated primitives are not the product API. System components own Alyssa defaults.
- Visual tests require stable Linux snapshots and deliberate approval when changed.
`
  );

  write(
    "docs/design-system/rollback/2026-08-31-foundation-v1.md",
    `# Foundation v1 Rollback Map

## Rollback unit

Revert the Foundation v1 merge commit. The release record must name the exact merge SHA.

## Files introduced

- components.json
- src/app/design-system.css
- src/components/ui/* initial primitives
- src/components/system/*
- .storybook/*
- e2e/design-quality.spec.ts and snapshots
- .github/workflows/design-quality.yml
- design/registry-allowlist*.json
- docs/design-system/*
- scripts/verify-design-system-contract.mjs
- scripts/migrations/2026-08-31-design-quality-foundation.mjs

## Existing files modified

- package.json and package-lock.json
- src/app/globals.css
- .gitignore
- AGENTS.md

## Data and runtime risk

No database migration, production row, authentication contract, Lead logic or API payload is changed. Rollback is code-only.

## Verification after rollback

1. npm ci
2. npm run build
3. npx playwright test e2e/connected-marketing-ops.spec.ts
4. confirm Production deployment points to the rollback commit
5. confirm no new runtime errors
`
  );

  write(
    "docs/product-learning/entries/2026-08-31-design-quality-foundation.md",
    `# Design Quality Foundation as a reusable Growth OS capability

- Date: 2026-08-31
- Source issue: Alyssa #74
- Classification: Core + Configurable + Alyssa-only styling

## Learning

A flagship operational product needs a design-quality architecture, not only a component library. The reusable Core is the layered contract: owned primitives, semantic tokens, isolated stories, deterministic visual evidence, accessibility automation, agent rules and rollback documentation.

## Core

- deny-by-default registry policy;
- primitive / system / feature ownership layers;
- Storybook build gate;
- fixed-environment Playwright visual regression;
- axe automation;
- change log, ADR and rollback map.

## Configurable

- component base and style;
- density scale;
- semantic token values;
- screenshot viewports and thresholds;
- required UI states.

## Alyssa-only

- plum, rose, blush and champagne brand values;
- Alyssa wording and examples;
- current admin navigation and business terminology.

## Guardrail

Do not copy Alyssa visual tokens into Growth OS Core. Export the architecture and configuration schema only.
`
  );

  updatePackageScripts();

  appendOnce(
    ".gitignore",
    "/storybook-static/",
    `# Storybook
/storybook-static/`
  );

  appendOnce(
    "AGENTS.md",
    "## Design Quality Gate",
    `## Design Quality Gate

For any shared UI, UX, layout or interaction change:

1. Read components.json and docs/design-system before coding.
2. Reuse src/components/system before creating feature-local controls.
3. Use only registries approved by design/registry-allowlist.json; the default is deny-by-default.
4. Do not introduce raw hex colours, recurring arbitrary control sizes or a second component contract inside System components.
5. Add or update Storybook stories for shared components and important states.
6. Add or update deterministic Playwright screenshots when the approved appearance changes.
7. Run npm run verify:design-system-contract, npm run build:storybook and npm run test:design.
8. Record the change, evidence and rollback path under docs/design-system.
9. Preserve Alyssa product direction; do not turn the system into a generic dashboard, generic task app or chatbot wrapper.
10. Treat automated accessibility as a floor. Keyboard, focus, hierarchy, density and human visual review remain mandatory.`
  );
}

function manifest() {
  const pkg = JSON.parse(read("package.json"));
  const pick = (name) => pkg.dependencies?.[name] || pkg.devDependencies?.[name] || null;
  const data = {
    generatedAt: new Date().toISOString(),
    issue: 74,
    foundation: {
      base: "base",
      style: "base-nova",
      tokens: "src/app/design-system.css",
      systemComponents: "src/components/system",
      storybook: ".storybook",
      visualTest: "e2e/design-quality.spec.ts",
      registryPolicy: "design/registry-allowlist.json",
    },
    packages: {
      "@base-ui/react": pick("@base-ui/react"),
      shadcn: pick("shadcn"),
      "tw-animate-css": pick("tw-animate-css"),
      "class-variance-authority": pick("class-variance-authority"),
      clsx: pick("clsx"),
      "tailwind-merge": pick("tailwind-merge"),
      storybook: pick("storybook"),
      "@storybook/nextjs-vite": pick("@storybook/nextjs-vite"),
      "@storybook/addon-docs": pick("@storybook/addon-docs"),
      "@storybook/addon-a11y": pick("@storybook/addon-a11y"),
      "@axe-core/playwright": pick("@axe-core/playwright"),
    },
    primitives: ["button", "badge", "separator", "skeleton"],
    rollback: "docs/design-system/rollback/2026-08-31-foundation-v1.md",
  };
  write("design/foundation-manifest.json", `${JSON.stringify(data, null, 2)}\n`);
}

if (phase === "prepare") prepare();
else if (phase === "finalize") finalize();
else if (phase === "manifest") manifest();
else throw new Error(`Unknown phase: ${phase}`);
