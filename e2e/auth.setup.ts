import { mkdir } from "node:fs/promises";
import { expect, test as setup } from "@playwright/test";

const authFile = "playwright/.auth/admin.json";

setup("authenticate once", async ({ page }) => {
  await page.goto("/login?next=/dashboard");

  const passwordInput = page.getByLabel("Password");
  if (!(await passwordInput.isVisible())) {
    await page
      .getByText(/切換期間管理員登入|緊急管理員登入/)
      .click();
  }
  if (await passwordInput.isVisible()) {
    const password =
      process.env.E2E_MASTER_PASSWORD || "playwright-ci-master-password";
    await passwordInput.fill(password);
    await page.getByRole("button", { name: "管理員登入" }).click();
  } else {
    throw new Error("Password fallback is unavailable in the E2E environment.");
  }

  await expect(page).toHaveURL(/\/dashboard(?:\?|$)/);
  await expect(page.getByTestId("login-screen")).toHaveCount(0);

  await mkdir("playwright/.auth", { recursive: true });
  await page.context().storageState({ path: authFile });
});
