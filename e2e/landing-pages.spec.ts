import { expect, test } from "@playwright/test";

test("Landing Page list renders without a login or full-page loading regression", async ({
  page,
}) => {
  const startedAt = Date.now();
  await page.goto("/landing-pages", { waitUntil: "domcontentloaded" });

  const screen = page.getByTestId("landing-pages-screen");
  await expect(screen).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId("landing-page-list")).toBeVisible();
  await expect(page.getByTestId("landing-page-row").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Landing Page 列表" })).toBeVisible();
  await expect(page.getByTestId("login-screen")).toHaveCount(0);
  await expect(page.locator("main").filter({ hasText: /Loading|載入中/ })).toHaveCount(0);

  expect(Date.now() - startedAt).toBeLessThan(10_000);
});
