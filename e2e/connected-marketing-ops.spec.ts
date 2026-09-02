import { expect, test } from "@playwright/test";
import { getWorkspaceModuleForPath } from "../src/lib/security/workspacePermissions";
import {
  accumulatePerformanceTrendPoints,
  attachDailySpendToPerformanceTrendSeries,
  calculatePerformanceTrendPoint,
} from "../src/lib/marketing/performanceTrend";

test("cumulative trend recomputes aggregate-first cost and rates from daily facts", () => {
  const daily = [
    calculatePerformanceTrendPoint(
      {
        spend: 100,
        leads: 2,
        bookings: 1,
        shows: 0,
        noShows: 0,
        pendingShows: 1,
      },
      { day: 1, date: "2026-08-01", annotations: [] }
    ),
    calculatePerformanceTrendPoint(
      {
        spend: 50,
        leads: 0,
        bookings: 1,
        shows: 1,
        noShows: 0,
        pendingShows: 0,
      },
      { day: 2, date: "2026-08-02", annotations: [] }
    ),
  ];
  const cumulative = accumulatePerformanceTrendPoints(daily);
  expect(cumulative[1]).toMatchObject({
    spend: 150,
    leads: 2,
    bookings: 2,
    shows: 1,
    cpl: 75,
    costPerBooking: 75,
    costPerShow: 150,
    leadToBookRate: 1,
    bookToShowRate: 0.5,
    leadToShowRate: 0.5,
  });
  expect(daily[1].cpl).toBeNull();
});

test("cost trend attaches canonical daily spend and keeps missing days null", () => {
  const baseSeries = [
    {
      key: "brand-a",
      label: "Brand A",
      color: "#000000",
      brandId: "brand-a",
      points: [
        calculatePerformanceTrendPoint(
          { spend: 0, spendRecorded: false, leads: 2, bookings: 1, shows: 1, noShows: 0, pendingShows: 0 },
          { day: 1, date: "2026-08-01", annotations: [] }
        ),
        calculatePerformanceTrendPoint(
          { spend: 0, spendRecorded: false, leads: 1, bookings: 0, shows: 0, noShows: 0, pendingShows: 0 },
          { day: 2, date: "2026-08-02", annotations: [] }
        ),
      ],
    },
  ];
  const [series] = attachDailySpendToPerformanceTrendSeries({
    series: baseSeries,
    spendFacts: [{ brandId: "brand-a", spendDate: "2026-08-01", amount: 300 }],
  });
  expect(series.points[0]).toMatchObject({
    spendRecorded: true,
    cpl: 150,
    costPerBooking: 300,
    costPerShow: 300,
  });
  expect(series.points[1]).toMatchObject({
    spendRecorded: false,
    cpl: null,
    costPerBooking: null,
    costPerShow: null,
  });
});

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
  const enrollmentBody = await enrollmentResponse.json();
  expect(enrollmentBody).toMatchObject({ ready: false });
});

test("Dashboard trend switches between single-day and cumulative views", async ({ page }) => {
  await page.goto("/dashboard");
  const card = page.locator(".lead-dashboard-trend-card");
  const toggle = card.getByTestId("trend-mode-toggle");
  await expect(toggle).toBeVisible({ timeout: 15_000 });
  await expect(toggle.getByTestId("trend-mode-daily")).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(
    card.getByRole("img", { name: /Lead單日走勢；橙色圓點代表已連結嘅成效事件/ })
  ).toBeVisible();
  await expect(card.getByRole("button", { name: "CPLead" })).toBeVisible();
  await expect(card.getByRole("button", { name: "CPBook" })).toBeVisible();
  await expect(card.getByRole("button", { name: "CPShow" })).toBeVisible();
  await card.getByRole("button", { name: "CPLead" }).click();
  await expect(
    card.getByRole("img", { name: /每個 Lead 成本單日走勢/ })
  ).toBeVisible();
  await card.getByRole("button", { name: "Lead", exact: true }).click();

  await toggle.getByTestId("trend-mode-cumulative").click();
  await expect(
    card.getByRole("img", { name: /Lead累積走勢；橙色圓點代表已連結嘅成效事件/ })
  ).toBeVisible();
});

test("Treatment trend independently remembers its daily or cumulative view", async ({ page }) => {
  await page.goto("/performance");
  const card = page.locator(".treatment-trend-card");
  const toggle = card.getByTestId("trend-mode-toggle");
  await expect(toggle).toBeVisible({ timeout: 15_000 });
  await expect(toggle.getByTestId("trend-mode-daily")).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(card.getByRole("button", { name: "CPLead" })).toBeVisible();
  await card.getByRole("button", { name: "CPBook" }).click();
  await expect(
    card.getByRole("img", { name: /每個 Book 成本單日走勢/ })
  ).toBeVisible();
  await card.getByRole("button", { name: "Lead", exact: true }).click();
  await toggle.getByTestId("trend-mode-cumulative").click();
  await expect(
    card.getByRole("img", { name: /Lead累積走勢；橙色圓點代表已連結嘅成效事件/ })
  ).toBeVisible();
  await page.reload();
  await expect(
    card.getByTestId("trend-mode-cumulative")
  ).toHaveAttribute("aria-pressed", "true");
});

test("Period comparison keeps monthly events in both cumulative and single-day views", async ({ page }) => {
  await page.goto(
    "/performance/compare?month=2026-08&months=3&start_day=1&end_day=27"
  );

  const trendCard = page.locator(".period-trend-card");
  await expect(trendCard.getByRole("button", { name: "CPLead" })).toBeVisible();
  await expect(trendCard.getByRole("button", { name: "CPBook" })).toBeVisible();
  await expect(trendCard.getByRole("button", { name: "CPShow" })).toBeVisible();
  const toggle = trendCard.getByTestId("trend-mode-toggle");
  await expect(toggle).toBeVisible({ timeout: 15_000 });
  await expect(toggle.getByTestId("trend-mode-cumulative")).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  let chart = trendCard.getByRole("img", {
    name: /同期累積走勢；橙色圓點代表已連結嘅成效事件/,
  });
  await expect(chart).toBeVisible();

  let markers = chart.getByTestId("period-series-annotation");
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

  await toggle.getByTestId("trend-mode-daily").click();
  chart = trendCard.getByRole("img", {
    name: /同期單日走勢；橙色圓點代表已連結嘅成效事件/,
  });
  await expect(chart).toBeVisible();
  await expect(chart).toHaveAttribute("data-trend-mode", "daily");
  markers = chart.getByTestId("period-series-annotation");
  await expect(markers).not.toHaveCount(0);

  await page.reload();
  await expect(
    trendCard.getByTestId("trend-mode-daily")
  ).toHaveAttribute("aria-pressed", "true");
});
