import { expect, test } from "@playwright/test";
import { getWorkspaceModuleForPath } from "../src/lib/security/workspacePermissions";

test("Weekly Tasks reuses Calendar module access", () => {
  expect(getWorkspaceModuleForPath("/tasks")).toBe("calendar");
  expect(getWorkspaceModuleForPath("/tasks?scope=mine")).toBe("calendar");
});

test("Marketing Calendar only exposes Idea, Scheduled and Published", async ({ page }) => {
  await page.goto("/calendar?month=2026-08");

  const statusSelect = page.getByTestId("calendar-status-select");
  await expect(statusSelect).toBeVisible();
  await expect(statusSelect.locator("option")).toHaveText([
    "Idea",
    "Scheduled",
    "Published",
  ]);
  await expect(page.getByText(/12:00 HKT/).first()).toBeVisible();
  await expect(page.getByText("成效時間線標記", { exact: true })).toBeVisible();
  await expect(page.getByText("同步建立工作事項", { exact: true })).toBeVisible();
});

test("Weekly work board exposes assignment, notifications and calendar linking", async ({ page }) => {
  await page.goto("/tasks");

  await expect(page.getByTestId("weekly-task-board")).toBeVisible();
  await expect(page.locator('[data-task-column="todo"]')).toBeVisible();
  await expect(page.locator('[data-task-column="in_progress"]')).toBeVisible();
  await expect(page.locator('[data-task-column="done"]')).toBeVisible();
  await expect(page.getByTestId("work-notification-center")).toBeVisible();
  await expect(page.getByText("新增／派工作", { exact: true })).toBeVisible();
  await expect(page.getByText(/只顯示擁有此品牌 Access/)).toBeVisible();
  await expect(page.getByText(/Performance Timeline/)).toBeVisible();
});

test("Dashboard trend consumes the connected operational event layer", async ({ page }) => {
  await page.goto("/dashboard");
  const trend = page.getByRole("img", { name: /橙色圓點代表已連結嘅成效事件/ }).first();
  await expect(trend).toBeVisible({ timeout: 15_000 });
});
