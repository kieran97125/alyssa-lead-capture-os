import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

for (const [name, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844]] as const) {
  test(`appointment status summary ${name} visual and keyboard states`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/e2e/appointment-status", { waitUntil: "networkidle" });
    const summary = page.getByTestId("appointment-status-summary");
    await expect(summary.locator("dd")).toHaveText(["2", "1"]);
    await expect(summary).toHaveScreenshot(`appointment-status-${name}.png`);
    await summary.locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(summary.getByRole("table")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(summary).toHaveScreenshot(`appointment-status-expanded-${name}.png`);
    const result = await new AxeBuilder({ page }).include('[data-testid="appointment-status-summary"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(result.violations).toEqual([]);
    await page.keyboard.press("Space");
    await expect(summary.getByRole("table")).toBeHidden();
    await page.goto("/e2e/appointment-status?unavailable=1", { waitUntil: "networkidle" });
    await expect(page.getByTestId("appointment-status-summary").locator("dd")).toHaveText(["—", "—"]);
  });
}

for (const [name, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844]] as const) {
  test(`report descriptions remain compact on ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/e2e/report-details", { waitUntil: "networkidle" });
    const status = page.locator('details').filter({ hasText: "資料狀態" });
    await expect(status.locator("summary")).toHaveText("資料狀態 · 12 項待核對");
    await expect(status.locator("li").first()).not.toBeVisible();
    const bounds = await status.boundingBox();
    expect(bounds?.height).toBeLessThan(80);
    await expect(page.getByRole("heading", { name: "Lead／Book／Show" })).toBeInViewport();
    await expect(page).toHaveScreenshot(`report-details-${name}.png`, { fullPage: true });
    await status.locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(status.locator("li")).toHaveCount(12);
    await expect(status.locator("li").last()).toBeVisible();
    const result = await new AxeBuilder({ page })
      .include('[data-testid="report-details-fixture"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(result.violations).toEqual([]);
    await page.keyboard.press("Space");
    await expect(status.locator("li").first()).not.toBeVisible();
  });
}

test("daily report retains available KPIs and editable spend with optional explanations", async ({ page }) => {
  await page.goto("/performance/daily", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "每日總覽" })).toBeVisible();
  await expect(page.getByTestId("daily-spend-entry-mode-switch")).toBeVisible();
  const methodology = page.locator("details").filter({ hasText: "計算口徑與資料來源" });
  await expect(methodology.locator("summary")).toBeVisible();
  await expect(methodology.getByText(/CPL = 廣告費/)).not.toBeVisible();
  await methodology.locator("summary").click();
  await expect(methodology.getByText(/CPL = 廣告費/)).toBeVisible();
});

test("source, permission and fallback warnings remain visible beside collapsed diagnostics", async ({ page }) => {
  await page.goto("/e2e/report-details?critical=1", { waitUntil: "networkidle" });
  await expect(page.getByText("每日總覽暫時未能連接正式數據，請聯絡系統管理員。", { exact: true })).toBeVisible();
  await expect(page.getByText("你目前未獲分配任何品牌嘅療程成效權限。", { exact: true })).toBeVisible();
  await expect(page.getByText("正式數據庫未連接；目前顯示驗收用同期數據。", { exact: true })).toBeVisible();
  const status = page.locator("details").filter({ hasText: "資料狀態" });
  await expect(status.locator("li").first()).toBeHidden();
  await expect(status.locator("summary")).toHaveText("資料狀態 · 12 項待核對");
});

for (const [name, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844]] as const) {
  test(`settings keep management links prominent and configuration optional on ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/settings", { waitUntil: "networkidle" });
    await expect(page.getByTestId("settings-management-list").getByRole("link")).toHaveCount(8);
    await expect(page.getByLabel("Meta Pixel ID")).toBeHidden();
    await expect(page).toHaveScreenshot(`settings-overview-${name}.png`, { fullPage: true });
    const tracking = page.locator("summary").filter({ hasText: "追蹤設定 · Meta Pixel" });
    await tracking.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Meta Pixel ID")).toBeVisible();
    await expect(page.getByRole("button", { name: "儲存 Pixel", exact: true })).toBeVisible();
    await expect(tracking.locator("..")).toHaveScreenshot(`settings-tracking-expanded-${name}.png`);
    const result = await new AxeBuilder({ page }).include('[data-slot="system-details"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(result.violations).toEqual([]);
    await page.keyboard.press("Space");
    await expect(page.getByLabel("Meta Pixel ID")).toBeHidden();
  });
}

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
