import { expect, test } from "@playwright/test";

test("Dashboard removes audit banner and both dashboards expose appointment statuses", async ({ page }) => {
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  await expect(page.locator(".lead-audit-alert-banner")).toHaveCount(0);
  await expect(page.getByTestId("appointment-status-summary")).toBeVisible();
  await expect(page.locator('.command-nav-item[href="/lead-audit"]')).toBeVisible();
  await page.goto("/performance/daily", { waitUntil: "networkidle" });
  await expect(page.getByTestId("appointment-status-summary")).toBeVisible();
  await page.goto("/performance", { waitUntil: "networkidle" });
  await expect(page.getByTestId("appointment-status-summary")).toBeVisible();
});
