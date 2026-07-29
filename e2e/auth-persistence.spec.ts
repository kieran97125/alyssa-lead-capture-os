import { expect, test, type Page } from "@playwright/test";

async function expectSessionToRemainAuthenticated(page: Page) {
  await expect(page.getByTestId("login-screen")).toHaveCount(0);
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
}

test("login survives refresh and navigation across Landing Pages and CRM", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expectSessionToRemainAuthenticated(page);

  await page.reload();
  await expectSessionToRemainAuthenticated(page);

  await page.goto("/landing-pages");
  await expect(page.getByTestId("landing-pages-screen")).toBeVisible();
  await expectSessionToRemainAuthenticated(page);

  await page.goto("/crm?tab=leads&range=all");
  await expect(page.getByTestId("crm-conversations-screen")).toBeVisible();
  await expectSessionToRemainAuthenticated(page);
});

test("sidebar exposes logout and clears the active session", async ({ page }) => {
  await page.goto("/dashboard");
  const logout = page.getByRole("link", { name: "登出 Alyssa Growth OS" });

  await expect(logout).toBeVisible();
  await expect(logout).toHaveAttribute("href", "/logout");
  await logout.click();

  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await expect(page.getByTestId("login-screen")).toBeVisible();
});
