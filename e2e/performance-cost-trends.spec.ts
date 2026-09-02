import { expect, test } from "@playwright/test";

test("Dashboard CPLead trend is visible and stable", async ({ page }) => {
  await page.goto("/dashboard");
  const card = page.locator(".lead-dashboard-trend-card");
  await card.getByRole("button", { name: "CPLead" }).click();
  await expect(card.getByRole("img", { name: /每個 Lead 成本單日走勢/ })).toBeVisible();
  await expect(card).toHaveScreenshot("dashboard-cplead-trend.png", { animations: "disabled" });
});

test("Treatment CPBook trend uses the brand-owned cost scope", async ({ page }) => {
  await page.goto("/performance");
  const card = page.locator(".treatment-trend-card");
  await card.getByRole("button", { name: "CPBook" }).click();
  await expect(card.getByRole("img", { name: /每個 Book 成本單日走勢/ })).toBeVisible();
  await expect(card.getByTestId("trend-cost-coverage")).toContainText("廣告費");
  await expect(card).toHaveScreenshot("treatment-cpbook-trend.png", { animations: "disabled" });
});

test("Treatment-filtered cost trend refuses to invent spend allocation", async ({ page }) => {
  await page.goto("/performance?treatment=%24988%20Facelift");
  const card = page.locator(".treatment-trend-card");
  await card.getByRole("button", { name: "CPShow" }).click();
  await expect(card.getByTestId("trend-cost-unavailable")).toContainText("成本未分配");
});
