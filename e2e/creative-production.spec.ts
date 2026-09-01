import { expect, test, type Page } from "@playwright/test";

async function openFixture(page: Page) {
  await page.goto("/e2e/creative-production", {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByRole("heading", { name: "設計工作" })).toBeVisible();
}

test("creative Job List keeps source, usage and media format separate without horizontal scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1180, height: 900 });
  await openFixture(page);
  const list = page.getByTestId("creative-job-list-fixture");
  await expect(list).toContainText("Source");
  await expect(list).toContainText("用途");
  await expect(list).toContainText("媒體格式");
  await expect(list).toContainText("Amber");
  await expect(list).toContainText("KOL 拍攝");
  await expect(list).toContainText("Meta AD");
  await expect(list).toContainText("Video");
  await expect(
    list.getByRole("button", { name: "刪除 GOS KOL 脫毛廣告片" })
  ).toBeVisible();
  const fitsWithoutHorizontalScroll = await list.evaluate(
    (element) => element.scrollWidth <= element.clientWidth
  );
  expect(fitsWithoutHorizontalScroll).toBe(true);
});

test("Creative Job dialog module loads without invalid use-server exports", async ({ page }) => {
  await openFixture(page);
  await expect(
    page.getByRole("button", { name: "新增設計 Job" })
  ).toBeVisible();
});

test("new Creative Job opens in a focused dialog and keeps date guidance contextual", async ({
  page,
}) => {
  await openFixture(page);
  await page.getByRole("button", { name: "新增設計 Job" }).click();

  const dialog = page.getByTestId("creative-job-create-dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "新增設計工作" })
  ).toBeVisible();
  await expect(dialog).toContainText("Start Day");
  await expect(dialog).toContainText("Due Day");
  await expect(dialog).toContainText("Publish Day");
  await expect(dialog).toContainText("決定 Job List 排序及開始提醒");
  await expect(dialog).toContainText("控制 24 小時提醒同逾期");
  await expect(dialog).toContainText("決定實際出街日期");

  await dialog.getByRole("button", { name: "關閉新增設計工作" }).click();
  await expect(dialog).toBeHidden();
});

test("desktop navigation can collapse to an icon rail and remembers the choice", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

  const sidebar = page.locator(".command-sidebar");
  const collapseButton = page.getByRole("button", { name: "縮小主選單" });
  await expect(collapseButton).toBeVisible();
  const expandedWidth = await sidebar.evaluate(
    (element) => element.getBoundingClientRect().width
  );

  await collapseButton.click();
  const expandButton = page.getByRole("button", { name: "展開主選單" });
  await expect(expandButton).toBeVisible();
  await expect
    .poll(() =>
      sidebar.evaluate((element) => element.getBoundingClientRect().width)
    )
    .toBeLessThan(expandedWidth - 100);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "展開主選單" })).toBeVisible();
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
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth
  );
  expect(noPageOverflow).toBe(true);
});
