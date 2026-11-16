import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const [name, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844]] as const) {
  test(`lead delivery status ${name} exact summary, unavailable and keyboard states`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/e2e/lead-delivery", { waitUntil: "networkidle" });
    const panel = page.getByTestId("lead-delivery-status-panel");
    await expect(panel.getByTestId("lead-delivery-total")).toHaveText("1,289");
    await expect(panel.locator("dd")).toHaveText(["4", "3", "1,280", "0", "0", "2"]);
    await expect(panel).toHaveScreenshot(`lead-delivery-normal-${name}.png`);
    // The shared Base UI button renders an anchor with button semantics.
    const refresh = panel.getByRole("button", { name: "重新載入", exact: true });
    await expect(refresh).toHaveJSProperty("tagName", "A");
    await refresh.focus();
    await expect(refresh).toBeFocused();
    await expect(refresh).toHaveAttribute("href", "/system-audit");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const result = await new AxeBuilder({ page }).include('[data-testid="lead-delivery-status-panel"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(result.violations).toEqual([]);

    await page.goto("/e2e/lead-delivery?state=review", { waitUntil: "networkidle" });
    await expect(panel.getByRole("status")).toContainText("避免重複加入");
    await expect(panel).toHaveScreenshot(`lead-delivery-review-${name}.png`);
    const recheck = panel.getByRole("button", { name: "重新檢查同步", exact: true });
    await expect(recheck).toBeEnabled();
    await recheck.focus(); await page.keyboard.press("Enter");
    await expect(panel.getByTestId("lead-delivery-feedback")).toHaveText("已安排重新檢查 3 筆同步記錄。");
    await page.goto("/e2e/lead-delivery?state=member_required", { waitUntil: "networkidle" });
    await expect(panel.getByRole("button", { name: "重新檢查同步", exact: true })).toBeDisabled();
    await expect(panel.getByText(/目前登入方式未能記錄操作人/)).toBeVisible();
    await expect(panel.locator("form")).toHaveCount(0);
    await expect(panel).toHaveScreenshot(`lead-delivery-member-required-${name}.png`);
    await page.goto("/e2e/lead-delivery?state=unavailable", { waitUntil: "networkidle" });
    await expect(panel.getByRole("status")).toHaveText("暫時未能讀取同步紀錄，請重新載入。");
    await expect(panel.locator("dd")).toHaveCount(0);
    await expect(panel.getByTestId("lead-delivery-total")).toHaveCount(0);
    await expect(panel).toHaveScreenshot(`lead-delivery-unavailable-${name}.png`);
    await page.goto("/e2e/lead-delivery?state=empty", { waitUntil: "networkidle" });
    await expect(panel.getByRole("status")).toHaveText("暫時未有登記同步記錄。");
    await expect(panel.getByTestId("lead-delivery-total")).toHaveText("0");
  });
}
