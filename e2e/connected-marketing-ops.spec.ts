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

test("Weekly work board uses a Monday-style list with assignment, status, calendar and delete controls", async ({ page }) => {
  await page.goto("/tasks");

  const board = page.getByTestId("weekly-task-board");
  await expect(board).toBeVisible();
  await expect(board).toHaveAttribute("data-layout", "list");
  await expect(page.locator('[data-task-column="todo"]')).toBeVisible();
  await expect(page.locator('[data-task-column="in_progress"]')).toBeVisible();
  await expect(page.locator('[data-task-column="done"]')).toBeVisible();
  await expect(page.getByText("工作事項", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("負責人", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("狀態", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("期限", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Priority", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("操作", { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId("work-notification-center")).toBeVisible();
  await expect(page.getByText("新增／派工作", { exact: true })).toBeVisible();
  await expect(page.getByText(/只顯示擁有此品牌 Access/)).toBeVisible();

  const firstTask = page.locator("[data-task-id]").first();
  await expect(firstTask.getByTestId("task-assignee-form").getByRole("button", { name: "派" })).toBeVisible();
  await expect(firstTask.getByTestId("task-status-form").getByRole("button", { name: "更新" })).toBeVisible();
  const deleteControl = firstTask.getByTestId("task-delete-control");
  await expect(deleteControl).toBeVisible();
  await deleteControl.locator("summary").click();
  await expect(deleteControl.getByRole("button", { name: "確認刪除" })).toBeVisible();
  await expect(deleteControl.getByText(/唔會刪已連結嘅營銷日曆事項/)).toBeVisible();
});

test("Dashboard trend consumes the connected operational event layer", async ({ page }) => {
  await page.goto("/dashboard");
  const trend = page.getByRole("img", { name: /橙色圓點代表已連結嘅成效事件/ }).first();
  await expect(trend).toBeVisible({ timeout: 15_000 });
});
