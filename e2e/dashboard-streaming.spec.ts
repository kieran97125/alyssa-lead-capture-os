import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("pending data leaves mobile navigation open when notification counts arrive", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/e2e/dashboard-streaming", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "開啟主選單", exact: true }).click();
  await expect(page.locator(".command-sidebar")).toHaveClass(/is-open/);
  await expect(page.locator('.command-nav-item[href="/lead-audit"] .command-nav-badge')).toHaveText("3");
  await expect(page.locator(".command-sidebar")).toHaveClass(/is-open/);
  await expect(page.locator('.command-nav-item[href="/calendar"]')).toBeVisible();
  await page.locator(".command-menu-button").click();
  await expect(page.getByRole("button", { name: "開啟主選單", exact: true })).toBeVisible();
});

for (const viewport of [{ name: "desktop", width: 1440, height: 1000 }, { name: "mobile", width: 390, height: 844 }]) {
  test(`Dashboard availability ${viewport.name} visual and accessibility states`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/e2e/dashboard-streaming", { waitUntil: "domcontentloaded" });
    await expect(page.locator('.command-nav-item[href="/lead-audit"] .command-nav-badge')).toHaveText("3");
    await expect(page.getByRole("region", { name: "Lead、預約及到店" })).toHaveAttribute("aria-busy", "true");
    await expect(page.getByRole("region", { name: "廣告來源成效" })).toHaveAttribute("aria-busy", "false");
    await expect(page.getByRole("button", { name: "重新載入" })).toBeVisible();
    await expect(page).toHaveScreenshot(`dashboard-availability-${viewport.name}.png`, { fullPage: true, animations: "disabled" });
    const audit = await new AxeBuilder({ page }).include("[data-dashboard-state]").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(audit.violations).toEqual([]);
  });
}
