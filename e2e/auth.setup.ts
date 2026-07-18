import { mkdir } from "node:fs/promises";
import { expect, test as setup } from "@playwright/test";

const authFile = "playwright/.auth/admin.json";

setup("authenticate once", async ({ page }) => {
  await page.goto("/login?next=/dashboard");

  const passwordInput = page.getByLabel("Password");
  if (await passwordInput.isVisible()) {
    const password = process.env.E2E_ADMIN_PASSWORD || "playwright-ci-password";
    await passwordInput.fill(password);
    await page.getByRole("button", { name: "Unlock Admin" }).click();
  } else {
    await page.getByRole("button", { name: "Continue to Admin" }).click();
  }

  await expect(page).toHaveURL(/\/dashboard(?:\?|$)/);
  await expect(page.getByTestId("login-screen")).toHaveCount(0);

  await mkdir("playwright/.auth", { recursive: true });
  await page.context().storageState({ path: authFile });
});
