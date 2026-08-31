import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function openSpecimen(page: Page) {
  await page.goto("/e2e/design-system", { waitUntil: "networkidle" });
  await expect(page.getByTestId("design-system-specimen")).toBeVisible();
}

function parseRgb(color: string) {
  const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  if (!channels || channels.length !== 3 || channels.some(Number.isNaN)) {
    throw new Error(`Unable to parse CSS colour: ${color}`);
  }
  return channels as [number, number, number];
}

function relativeLuminance(color: string) {
  const channels = parseRgb(color).map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastAgainstWhite(color: string) {
  const luminance = relativeLuminance(color);
  return 1.05 / (luminance + 0.05);
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

test("design tokens cannot wash out Dashboard labels and helper text", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  const globalMutedToken = await page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue("--muted")
      .trim()
  );
  expect(globalMutedToken).toBe("");

  const readableTextSelectors = [
    ".lead-dashboard-filter-panel > header small",
    ".lead-dashboard-filter-panel > header p",
    ".lead-dashboard-filter-form label > span",
    ".lead-dashboard-metric p",
    ".lead-dashboard-metric small",
  ];

  for (const selector of readableTextSelectors) {
    const text = page.locator(selector).first();
    await expect(text, `${selector} should remain visible`).toBeVisible();
    const color = await text.evaluate((element) => getComputedStyle(element).color);
    expect(
      contrastAgainstWhite(color),
      `${selector} resolved to ${color}, below WCAG AA contrast against its light card surface.`
    ).toBeGreaterThanOrEqual(4.5);
  }
});
