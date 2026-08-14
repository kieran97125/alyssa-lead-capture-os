import { expect, test } from "@playwright/test";

function daysBetween(left: string, right: string) {
  return Math.round(
    (new Date(`${right}T00:00:00.000Z`).getTime() -
      new Date(`${left}T00:00:00.000Z`).getTime()) /
      86_400_000
  );
}

test("period comparison includes two adjacent complete seven-day windows", async ({
  page,
}) => {
  await page.goto("/performance/compare", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "近 7 日 vs 前 7 日" })).toBeVisible();
  await expect(page.getByText("最近 7 日", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("前 7 日", { exact: false }).first()).toBeVisible();

  const result = await page.evaluate(async () => {
    const response = await fetch("/api/internal/performance/rolling-comparison");
    return {
      status: response.status,
      body: await response.json(),
    };
  });
  expect(result.status).toBe(200);
  expect(result.body.ok).toBe(true);
  const current = result.body.snapshot.current;
  const previous = result.body.snapshot.previous;
  expect(current.days).toBe(7);
  expect(previous.days).toBe(7);
  expect(daysBetween(current.startDate, current.endDate)).toBe(6);
  expect(daysBetween(previous.startDate, previous.endDate)).toBe(6);
  expect(daysBetween(previous.endDate, current.startDate)).toBe(1);
});

test("comparison KPI cards keep long HKD values readable and remove empty comparison noise", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/performance/compare", { waitUntil: "domcontentloaded" });

  const monthlyGrid = page.locator(".period-kpi-grid");
  await expect(monthlyGrid).toBeVisible();
  const columns = await monthlyGrid.evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns.split(" ").length
  );
  expect(columns).toBeLessThanOrEqual(4);

  const monthlyValue = page.locator(".period-kpi-card strong").first();
  const style = await monthlyValue.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      overflow: computed.overflow,
      textOverflow: computed.textOverflow,
      whiteSpace: computed.whiteSpace,
    };
  });
  expect(style.overflow).toBe("visible");
  expect(style.textOverflow).toBe("clip");
  expect(style.whiteSpace).toBe("nowrap");

  await expect(page.getByText("未有可比基準", { exact: true }).first()).toBeHidden();
  await expect(page.getByText("與上月相若", { exact: true }).first()).toBeHidden();
});
