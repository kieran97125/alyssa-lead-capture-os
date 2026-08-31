import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function openSpecimen(page: Page) {
  await page.goto("/e2e/design-system", { waitUntil: "networkidle" });
  await expect(page.getByTestId("design-system-specimen")).toBeVisible();
}

test("design foundation desktop visual baseline", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openSpecimen(page);
  await expect(page).toHaveScreenshot("design-foundation-desktop.png", {
    fullPage: true,
    animations: "disabled",
  });
});

test("design foundation mobile visual baseline", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openSpecimen(page);
  await expect(page).toHaveScreenshot("design-foundation-mobile.png", {
    fullPage: true,
    animations: "disabled",
  });
});

test("design foundation has no automated WCAG A or AA violations", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openSpecimen(page);
  const result = await new AxeBuilder({ page })
    .include('[data-testid="design-system-specimen"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(result.violations).toEqual([]);
});
