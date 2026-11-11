import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "report-layout.spec.ts",
  timeout: 120_000,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "report-layout-results" }]],
  expect: { toMatchSnapshot: { threshold: 0.2, maxDiffPixelRatio: 0.01 } },
});
