import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// The regular app gate remains independent; this focused gate uses the actual
// component workshop and synthetic snapshots, never a production data source.
const workshop = process.env.STORYBOOK_BASE_URL;
test.skip(!workshop, "Start the component workshop for this focused availability gate");
for (const viewport of [{ name: "desktop", width: 1440, height: 1000 }, { name: "mobile", width: 390, height: 844 }]) {
  for (const state of ["unavailable", "verified-empty"]) {
    test(`Lead authority ${state} ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(`${workshop}/iframe.html?id=dashboard-lead-authority-availability--${state}&viewMode=story`);
      const panel = page.getByRole("region", { name: "Lead Dashboard", exact: true });
      await expect(panel).toBeVisible();
      if (state === "unavailable") {
        await expect(panel.getByRole("alert")).toContainText("暫時未能確認 Show／No Show");
        await expect(panel.locator(".lead-dashboard-metric")).toHaveCount(0);
        await expect(panel.locator("table")).toHaveCount(0);
        const retry = panel.getByRole("button", { name: "重新載入", exact: true });
        await expect(retry).toHaveAttribute("href", /accountId=gos-beauty/);
        await retry.focus(); await expect(retry).toBeFocused();
      } else {
        await expect(panel.locator(".lead-dashboard-metric")).toHaveCount(5);
        await expect(panel.getByRole("alert")).toHaveCount(0);
      }
      await expect(panel).toHaveScreenshot(`lead-authority-${state}-${viewport.name}.png`, { animations: "disabled" });
      expect((await new AxeBuilder({ page }).include('[aria-label="Lead Dashboard"]').withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
    });
  }
}
