import { expect, test } from "@playwright/test";

test("Demand Signals preview shows safe fixtures and honest trend state", async ({ page }) => {
  await page.goto("/growth-intelligence/demand-signals");

  await expect(page.getByRole("heading", { name: "Demand Signals", exact: true })).toBeVisible();
  await expect(page.getByTestId("demand-signals-preview-mode")).toBeVisible();
  await expect(page.getByText("跨來源去重", { exact: true })).toBeVisible();
  await expect(page.getByTestId("demand-signal-row")).toHaveCount(5);
  await expect(page.getByText("No prior baseline", { exact: true })).toBeVisible();
  await expect(page.getByText("Human review required", { exact: true })).toBeVisible();
  await expect(page.getByText("+100% vs prior", { exact: true })).toHaveCount(0);
});
