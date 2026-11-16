import { expect, test } from "@playwright/test";

for (const [name, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844]] as const) {
  test(`retired Lead monitor bookmark returns to the protected dashboard on ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/lead-audit?review=open&severity=critical", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /Lead 變更監察/ })).toHaveCount(0);
    await expect(page.getByTestId("lead-audit-before-row")).toHaveCount(0);
    await expect(page.getByTestId("lead-audit-after-row")).toHaveCount(0);
    await expect(page.getByText("項 Lead 資料異常待核對")).toHaveCount(0);
  });
}
