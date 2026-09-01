import { expect, test, type Page } from "@playwright/test";

async function openFixture(page: Page) {
  await page.goto("/e2e/creative-production", {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByRole("heading", { name: "設計工作" })).toBeVisible();
}

test("creative Job List keeps source, usage and media format as separate columns", async ({
  page,
}) => {
  await openFixture(page);
  const list = page.getByTestId("creative-job-list-fixture");
  await expect(list).toContainText("Source");
  await expect(list).toContainText("用途");
  await expect(list).toContainText("媒體格式");
  await expect(list).toContainText("Amber");
  await expect(list).toContainText("KOL 拍攝");
  await expect(list).toContainText("Meta AD");
  await expect(list).toContainText("Video");
});

test("creative Job List fits the available width without horizontal scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openFixture(page);
  const list = page.getByTestId("creative-job-list-fixture");
  const widths = await list.evaluate((element) => ({
    client: element.clientWidth,
    scroll: element.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
});

test("new Job and operating guidance open as in-app sheets", async ({ page }) => {
  await openFixture(page);
  const originalUrl = page.url();

  await page.getByRole("button", { name: "新增設計 Job" }).click();
  const createDialog = page.getByRole("dialog", { name: "新增設計 Job" });
  await expect(createDialog).toBeVisible();
  await expect(createDialog.getByLabel("Job 名稱")).toBeVisible();
  await expect(createDialog.getByLabel("Designer")).toBeVisible();
  expect(page.url()).toBe(originalUrl);
  await createDialog
    .getByRole("button", { name: "關閉新增設計 Job" })
    .click();
  await expect(createDialog).toBeHidden();

  await page.getByRole("button", { name: "操作指引" }).click();
  const guideDialog = page.getByRole("dialog", {
    name: "設計工作指引",
  });
  await expect(guideDialog).toBeVisible();
  await expect(guideDialog).toContainText("Start Day");
  await expect(guideDialog).toContainText("Due Day");
  await expect(guideDialog).toContainText("Publish Day");
  await expect(
    guideDialog.getByTestId("desktop-notification-control")
  ).toBeVisible();
});

test("desktop primary navigation can collapse and restore", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem("alyssa-command-sidebar-collapsed");
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

  const sidebar = page.locator(".command-sidebar");
  const collapseButton = page.getByRole("button", {
    name: "收起主功能欄",
  });
  await expect(collapseButton).toBeVisible();
  await page.waitForFunction(() => {
    const element = document.querySelector(".command-sidebar");
    return element instanceof HTMLElement && element.clientWidth > 200;
  });
  const before = await sidebar.evaluate((element) => element.clientWidth);
  await collapseButton.click();
  await expect(page.locator("html")).toHaveClass(/command-sidebar-collapsed/);
  await expect(page.getByRole("button", { name: "展開主功能欄" })).toBeVisible();
  await page.waitForFunction(() => {
    const element = document.querySelector(".command-sidebar");
    return element instanceof HTMLElement && element.clientWidth < 100;
  });
  const after = await sidebar.evaluate((element) => element.clientWidth);
  expect(after).toBeLessThan(before);

  await page.getByRole("button", { name: "展開主功能欄" }).click();
  await expect(page.locator("html")).not.toHaveClass(/command-sidebar-collapsed/);
  await page.waitForFunction(() => {
    const element = document.querySelector(".command-sidebar");
    return element instanceof HTMLElement && element.clientWidth > 200;
  });
});

test("rich Brief supports long-form editing, headings and checklist content", async ({
  page,
}) => {
  await openFixture(page);
  const workspace = page.getByTestId("creative-brief-workspace");
  await expect(workspace).toBeVisible();
  const editor = workspace.locator(".ProseMirror");

  await expect(
    editor.getByRole("heading", { name: "Campaign 目的", exact: true })
  ).toBeVisible();
  await expect(editor.locator('ul[data-type="taskList"]')).toContainText(
    "標清價錢與 CTA"
  );
  await expect(workspace.getByRole("button", { name: "標題 2" })).toBeVisible();
  await expect(workspace.getByRole("button", { name: "Checklist" })).toBeVisible();
  await expect(workspace.getByRole("button", { name: "貼入圖片" })).toBeVisible();

  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type(
    "這是一段用來驗證長篇 Creative Brief 可以直接輸入、編輯及自動儲存的內容。"
  );
  await expect(editor).toContainText("長篇 Creative Brief");
  await expect(workspace).toContainText("已儲存");
});

test("creative workspace remains usable on mobile without horizontal page overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFixture(page);
  await expect(page.getByTestId("creative-rich-brief-fixture")).toBeVisible();
  const noPageOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
  );
  expect(noPageOverflow).toBe(true);
});
