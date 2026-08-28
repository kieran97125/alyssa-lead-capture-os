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
  await expect(page.getByText("Due／出街日期", { exact: true })).toBeVisible();
  await expect(page.locator('input[name="taskStartDate"]')).toBeVisible();
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
  await expect(page.getByText("Start Day", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Due／出街", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Priority", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("操作", { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId("work-notification-center")).toBeVisible();
  await expect(page.getByText("新增／派工作", { exact: true })).toBeVisible();
  await expect(page.getByText(/只顯示擁有此品牌 Access/)).toBeVisible();
  await expect(
    page.getByTestId("task-create-form").locator('input[name="startDate"]')
  ).toBeVisible();
  await expect(page.getByTestId("desktop-notification-control")).toBeVisible();

  const firstTask = page.locator("[data-task-id]").first();
  await expect(
    firstTask
      .getByTestId("task-assignee-form")
      .getByRole("button", { name: "派" })
  ).toBeVisible();
  await expect(
    firstTask
      .getByTestId("task-status-form")
      .getByRole("button", { name: "更新" })
  ).toBeVisible();
  await firstTask.locator("summary").first().click();
  const scheduleForm = firstTask.getByTestId("task-schedule-form");
  await expect(scheduleForm.locator('input[name="startDate"]')).toBeVisible();
  await expect(scheduleForm.locator('input[name="dueDate"]')).toBeVisible();
  await expect(
    scheduleForm.getByRole("button", { name: "更新日期" })
  ).toBeVisible();
  const deleteControl = firstTask.getByTestId("task-delete-control");
  await expect(deleteControl).toBeVisible();
  await deleteControl.locator("summary").click();
  await expect(
    deleteControl.getByRole("button", { name: "確認刪除" })
  ).toBeVisible();
  await expect(
    deleteControl.getByText(/唔會刪已連結嘅營銷日曆事項/)
  ).toBeVisible();
});

test("desktop notifications expose a Service Worker but only bind individual invited accounts", async ({ page }) => {
  const workerResponse = await page.request.get("/growth-os-sw.js");
  expect(workerResponse.ok()).toBe(true);
  const workerSource = await workerResponse.text();
  expect(workerSource).toContain('addEventListener("push"');
  expect(workerSource).toContain("showNotification");
  expect(workerSource).toContain('addEventListener("notificationclick"');

  const enrollmentResponse = await page.request.get("/api/notifications/push");
  expect(enrollmentResponse.status()).toBe(403);
  await expect(enrollmentResponse.json()).resolves.toMatchObject({ ready: false });
});

test("Dashboard trend consumes the connected operational event layer", async ({ page }) => {
  await page.goto("/dashboard");
  const trend = page
    .getByRole("img", { name: /橙色圓點代表已連結嘅成效事件/ })
    .first();
  await expect(trend).toBeVisible({ timeout: 15_000 });
});

test("Period comparison keeps each performance event on its own month series", async ({ page }) => {
  await page.goto(
    "/performance/compare?month=2026-08&months=3&start_day=1&end_day=27"
  );

  const chart = page
    .getByRole("img", {
      name: /同期累積走勢；橙色圓點代表已連結嘅成效事件/,
    })
    .first();
  await expect(chart).toBeVisible({ timeout: 15_000 });

  const markers = chart.getByTestId("period-series-annotation");
  await expect(markers).not.toHaveCount(0);
  const marker = markers.first();
  const seriesLabel = await marker.getAttribute("data-series-label");
  const eventDates =
    (await marker.getAttribute("data-event-dates"))
      ?.split(",")
      .filter(Boolean) ?? [];

  expect(seriesLabel).toBeTruthy();
  expect(eventDates.length).toBeGreaterThan(0);
  for (const eventDate of eventDates) {
    expect(seriesLabel).toContain(eventDate.slice(0, 4));
    expect(seriesLabel).toContain(`${Number(eventDate.slice(5, 7))}月`);
  }
});
