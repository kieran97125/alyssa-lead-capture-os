import { expect, test } from "@playwright/test";

test("appointment outcome queues retain No Show, showed and cancelled records", async ({ page }) => {
  await page.goto("/e2e/crm-foundation?queue=no_show");
  const fixture = page.getByTestId("crm-foundation-fixture");
  await expect(fixture.getByTestId("fixture-result-count")).toHaveText("2");
  const rows = fixture.getByTestId("crm-inbox-row");
  await expect(rows).toHaveCount(2);
  await expect(rows.filter({ hasText: "TEST-NOSHOW-A" })).toHaveCount(1);
  await expect(rows.filter({ hasText: "TEST-NOSHOW-B" })).toHaveCount(1);
  await expect(rows.filter({ hasText: "TEST-BOOKED-A" })).toHaveCount(0);

  await fixture.getByLabel("品牌", { exact: true }).selectOption("fixture-a");
  await fixture.getByRole("button", { name: "套用篩選" }).click();
  await expect(page.getByTestId("fixture-result-count")).toHaveText("1");
  await expect(page.getByTestId("crm-inbox-row")).toContainText("TEST-NOSHOW-A");
  await expect(page.getByTestId("fixture-channel-status")).toHaveText("示例品牌 A · 待測試");

  for (const [queue, record] of [["showed", "SHOWED-A"], ["cancelled", "CANCELLED-A"]]) {
    await page.goto(`/e2e/crm-foundation?brand=fixture-a&queue=${queue}`);
    await expect(page.getByTestId("fixture-result-count")).toHaveText("1");
    await expect(page.getByTestId("crm-inbox-row")).toContainText(`TEST-${record}`);
  }

  await page.goto("/e2e/crm-foundation?brand=fixture-b&queue=booked");
  await expect(page.getByTestId("fixture-result-count")).toHaveText("0");
  await expect(page.getByTestId("crm-inbox-row")).toHaveCount(0);
  await expect(page.getByTestId("crm-inbox-table")).toContainText("目前沒有符合條件嘅 Lead。");
});

test("HKT midnight and brand readiness remain distinct from persisted settings", async ({ page }) => {
  await page.goto("/e2e/crm-foundation?brand=fixture-a&queue=today_bookings");
  await expect(page.getByTestId("fixture-hkt-day")).toHaveText("2026-11-16");
  await expect(page.getByTestId("fixture-result-count")).toHaveText("1");
  await expect(page.getByTestId("crm-inbox-row")).toContainText("TEST-BOOKED-A");
  await expect(page.getByTestId("crm-inbox-table").getByText("今日預約", { exact: true })).toBeVisible();
  await expect(page.getByTestId("fixture-channel-status")).toContainText("待測試");

  await page.goto("/e2e/crm-foundation?brand=fixture-b&queue=no_show");
  await expect(page.getByTestId("fixture-result-count")).toHaveText("1");
  await expect(page.getByTestId("crm-inbox-row")).toContainText("TEST-NOSHOW-B");
  await expect(page.getByTestId("fixture-channel-status")).toHaveText("示例品牌 B · 測試成功");

  await page.goto("/e2e/crm-foundation?brand=fixture-b&health=unavailable");
  await expect(page.getByTestId("fixture-channel-status")).toContainText("暫未能確認");
  await page.goto("/e2e/crm-foundation");
  await expect(page.getByTestId("fixture-channel-status")).toContainText("全部品牌 · 請先選擇品牌");
});

for (const [name, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844]] as const) {
  test(`No Show filtered result stays readable on ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/e2e/crm-foundation?brand=fixture-a&queue=no_show");
    await page.evaluate(async () => { await document.fonts.ready; });
    const fixture = page.getByTestId("crm-foundation-fixture");
    await expect(fixture.getByTestId("fixture-result-count")).toHaveText("1");
    await expect(fixture.getByTestId("crm-inbox-row")).toContainText("TEST-NOSHOW-A");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(fixture).toHaveScreenshot(`crm-foundation-noshow-${name}.png`, { animations: "disabled" });
  });
}
