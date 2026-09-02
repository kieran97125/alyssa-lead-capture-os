import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function openCalendarEdit(page: Page) {
  await page.goto("/calendar", { waitUntil: "domcontentloaded" });
  const task = page
    .locator('[data-calendar-task-title="DEP Reels 上線"]')
    .first();
  await expect(task).toBeVisible();
  await task
    .getByRole("button", { name: "編輯事項：DEP Reels 上線" })
    .click();
  const dialog = page.getByTestId("calendar-edit-dialog");
  await expect(dialog).toBeVisible();
  return { task, dialog };
}

test("calendar item can be fully edited without leaving the calendar", async ({
  page,
}) => {
  const { dialog } = await openCalendarEdit(page);

  await dialog.getByLabel("事項名稱").fill("DEP Reels 更新版");
  await dialog.getByLabel("類型").selectOption("ad");
  await dialog.getByLabel("渠道").fill("Meta");
  await dialog.getByLabel("狀態").selectOption("scheduled");
  await dialog.getByLabel("負責人電郵（可選）").fill(
    "marketer@example.test"
  );
  await dialog.getByLabel("備註").fill("已更新素材、CTA 同出街安排。");
  await dialog.getByLabel("顯示喺成效時間線").uncheck();
  await dialog.getByTestId("calendar-edit-save").click();

  await expect(dialog).toHaveCount(0);
  await expect(
    page.locator('[data-calendar-task-title="DEP Reels 更新版"]')
  ).toBeVisible();
  await expect(page.getByText("日曆事項已更新。")).toBeVisible();
});

test("unrelated edits preserve an inactive treatment link", async ({ page }) => {
  const { dialog } = await openCalendarEdit(page);
  const treatment = dialog.getByLabel("影響療程（可選）");
  await expect(treatment).toHaveValue(
    "90000000-0000-4000-8000-000000000099"
  );
  await expect(
    treatment.locator('option[value="90000000-0000-4000-8000-000000000099"]')
  ).toContainText("歷史療程（目前已停用）");

  await dialog.getByLabel("事項名稱").fill("只改名稱並保留療程");
  await dialog.getByTestId("calendar-edit-save").click();
  await expect(dialog).toHaveCount(0);

  const updatedTask = page
    .locator('[data-calendar-task-title="只改名稱並保留療程"]')
    .first();
  await updatedTask
    .getByRole("button", { name: "編輯事項：只改名稱並保留療程" })
    .click();
  const reopened = page.getByTestId("calendar-edit-dialog");
  await expect(reopened.getByLabel("影響療程（可選）")).toHaveValue(
    "90000000-0000-4000-8000-000000000099"
  );
});

test("calendar edit dialog desktop visual baseline", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const { dialog } = await openCalendarEdit(page);
  await expect(dialog).toHaveScreenshot("calendar-edit-dialog-desktop.png", {
    animations: "disabled",
  });
});

test("calendar edit dialog mobile visual baseline", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { dialog } = await openCalendarEdit(page);
  await expect(dialog).toHaveScreenshot("calendar-edit-dialog-mobile.png", {
    animations: "disabled",
  });
});

test("calendar edit dialog has no automated WCAG A or AA violations", async ({
  page,
}) => {
  const { dialog } = await openCalendarEdit(page);
  const result = await new AxeBuilder({ page })
    .include('[data-testid="calendar-edit-dialog"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(result.violations).toEqual([]);
  await expect(dialog.getByRole("button", { name: "儲存修改" })).toBeVisible();
});
