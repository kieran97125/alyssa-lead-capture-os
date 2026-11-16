import { expect, test } from "@playwright/test";

test("the old Landing Page address opens the shared page list without a login or full-page loading regression", async ({
  page,
}) => {
  const startedAt = Date.now();
  await page.goto("/landing-pages", { waitUntil: "domcontentloaded" });

  const screen = page.getByTestId("acquisition-management-screen");
  await expect(screen).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId("landing-page-list")).toBeVisible();
  await expect(page.getByTestId("landing-page-row").first()).toBeVisible();
  await expect(page).toHaveURL(/\/campaigns\?.*tab=pages/);
  await expect(page.getByRole("heading", { name: "表格及廣告頁", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "推廣類型" }).getByRole("link", { name: "Landing Pages", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("login-screen")).toHaveCount(0);
  await expect(page.locator("main").filter({ hasText: /Loading|載入中/ })).toHaveCount(0);

  expect(Date.now() - startedAt).toBeLessThan(10_000);
});
