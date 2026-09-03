import { expect, test, type Page } from "@playwright/test";

async function openFixture(page: Page) {
  await page.goto("/e2e/creative-production", {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByRole("heading", { name: "設計工作" })).toBeVisible();
  await expect(page.getByTestId("creative-fixture-ready")).toHaveAttribute(
    "data-ready",
    "true"
  );
}

test("Creative Jobs production route evaluates without invalid server exports", async ({
  page,
}) => {
  const response = await page.goto("/creative-jobs", {
    waitUntil: "domcontentloaded",
  });
  expect(response?.status() ?? 500).toBeLessThan(500);
  await expect(page.locator("body")).not.toContainText(
    'A "use server" file can only export async functions'
  );
});

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
  await expect(list).toContainText("建立者：Kieran Kwok");
  const fitsWithoutHorizontalScroll = await list.evaluate(
    (element) => element.scrollWidth <= element.clientWidth
  );
  expect(fitsWithoutHorizontalScroll).toBe(true);
});

test("Creative Job list keeps compact desktop density and proportionate controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openFixture(page);

  const list = page.getByTestId("creative-job-list-fixture");
  const row = list.getByTestId("creative-job-row");
  await expect(row).toBeVisible();
  await expect(row).toContainText("建立者：Kieran Kwok");
  await row.scrollIntoViewIfNeeded();

  const rowBox = await row.boundingBox();
  expect(rowBox?.height ?? 999).toBeLessThanOrEqual(90);

  const labelFontSize = await list
    .getByTestId("creative-list-meta-label")
    .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(labelFontSize).toBeGreaterThanOrEqual(9);

  const createBox = await page.getByTestId("creative-job-create-trigger").boundingBox();
  expect(createBox?.height ?? 999).toBeLessThanOrEqual(34);

  const deleteBox = await list
    .getByTestId("creative-job-list-delete-button")
    .boundingBox();
  expect(deleteBox?.height ?? 999).toBeLessThanOrEqual(30);
  expect(deleteBox?.width ?? 999).toBeLessThanOrEqual(30);

  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await expect(list).toHaveScreenshot("creative-job-list-compact-desktop.png", {
    animations: "disabled",
    caret: "hide",
  });
});

test("new Creative Job opens in a focused dialog and keeps date guidance contextual", async ({
  page,
}) => {
  await openFixture(page);
  const trigger = page.getByTestId("creative-job-create-trigger");
  await expect(trigger).toBeVisible();
  await trigger.click();

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


test("Creative Job deletion uses an app-owned confirmation at list and detail placements", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1180, height: 900 });
  await openFixture(page);
  const studio = page.getByTestId("creative-rich-brief-fixture");
  await expect(
    studio.getByTestId("creative-job-delete-button")
  ).toBeVisible();
  await expect(page.getByTestId("creative-job-list-delete-button")).toBeVisible();

  await page.getByTestId("creative-job-list-delete-button").click();
  const dialog = page.getByTestId("creative-job-delete-confirmation");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", {
      name: "刪除「GOS KOL 脫毛廣告片」？",
    })
  ).toBeVisible();
  await expect(dialog).toContainText("系統 Audit 仍會保留操作記錄");
  await expect(dialog.getByRole("button", { name: "確認刪除" })).toBeVisible();
  await dialog.getByRole("button", { name: "取消" }).click();
  await expect(dialog).toBeHidden();
});

test("Creative Job delete confirmation desktop visual baseline", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openFixture(page);
  await page.getByTestId("creative-job-list-delete-button").click();
  await expect(page.getByTestId("creative-job-delete-confirmation")).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await expect(page).toHaveScreenshot(
    "creative-job-delete-confirmation-desktop.png",
    { animations: "disabled", caret: "hide" }
  );
});

test("Creative Job delete confirmation mobile visual baseline", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFixture(page);
  await page.getByTestId("creative-job-list-delete-button").click();
  await expect(page.getByTestId("creative-job-delete-confirmation")).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await expect(page).toHaveScreenshot(
    "creative-job-delete-confirmation-mobile.png",
    { animations: "disabled", caret: "hide" }
  );
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


test("Job setting draft stays stable through Brief interaction and save feedback", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openFixture(page);
  const studio = page.getByTestId("creative-rich-brief-fixture");
  const form = studio.getByTestId("creative-job-settings-form");
  const title = form.getByLabel("Job 名稱");
  await title.fill("GOS Inbox 好評合集｜新版設定");
  await form.getByLabel("優先處理").selectOption("urgent");

  const workspace = studio.getByTestId("creative-brief-workspace");
  await workspace.getByRole("button", { name: "粗體" }).click();
  await expect(title).toHaveValue("GOS Inbox 好評合集｜新版設定");
  await expect(form.getByLabel("優先處理")).toHaveValue("urgent");

  await form.getByRole("button", { name: "儲存 Job 設定" }).click();
  await expect(form.getByTestId("creative-job-settings-feedback")).toContainText(
    "畫面設定保持不變"
  );
  await expect(title).toHaveValue("GOS Inbox 好評合集｜新版設定");
  await expect(form.getByLabel("優先處理")).toHaveValue("urgent");
});

test("Brief workspace offers text colour, sticky tools and on-demand side sheets", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 560 });
  await openFixture(page);
  const studio = page.getByTestId("creative-rich-brief-fixture");
  const workspace = studio.getByTestId("creative-brief-workspace");
  const toolbar = workspace.getByTestId("creative-brief-toolbar");

  await expect(
    workspace.getByTestId("brief-text-color-control")
  ).toBeVisible();
  await expect(
    workspace.getByRole("button", { name: "還原文字顏色", exact: true })
  ).toBeVisible();
  await workspace.getByTestId("brief-text-color-control").fill("#a43b50");
  await expect(workspace.getByTestId("brief-text-color-control")).toHaveValue("#a43b50");

  const position = await toolbar.evaluate((element) => getComputedStyle(element).position);
  expect(position).toBe("sticky");
  await toolbar.scrollIntoViewIfNeeded();
  await toolbar.evaluate((element) => {
  const target =
    element.getBoundingClientRect().top + window.scrollY + 180;
  window.scrollTo(0, target);
});
await expect
  .poll(async () => (await toolbar.boundingBox())?.y ?? 999)
  .toBeLessThanOrEqual(2);

  await expect(studio.getByText("Job 素材庫", { exact: true })).toHaveCount(0);
  await expect(studio.getByText("留言／修改要求", { exact: true })).toHaveCount(0);
  await expect(workspace).toContainText("不會列入正式素材");

  await studio.getByTestId("creative-brief-version-trigger").click();
  const dialog = page.getByTestId("creative-brief-version-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Version 2");
  await dialog.getByRole("button", { name: "關閉版本紀錄" }).click();
  await expect(dialog).toBeHidden();
});


test("Designer handoff and discussion stay available on demand without a permanent rail", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await openFixture(page);
  const studio = page.getByTestId("creative-rich-brief-fixture");

  await expect(studio.getByText("Job 素材庫", { exact: true })).toHaveCount(0);
  await expect(studio.getByText("留言／修改要求", { exact: true })).toHaveCount(0);

  const trigger = studio.getByTestId("creative-collaboration-trigger");
  await expect(trigger).toBeVisible();
  await trigger.click();

  const dialog = page.getByTestId("creative-collaboration-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Brief Screenshot 只作解釋");
  await expect(dialog).toContainText("Final V1 Drive Link");
  await expect(dialog).not.toContainText("Brief Screenshot Only");
  await expect(dialog.getByText("加入 Google Drive／交付連結")).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await expect(dialog).toHaveScreenshot(
    "creative-collaboration-dialog-desktop.png",
    { animations: "disabled", caret: "hide" }
  );

  await dialog.getByTestId("creative-comments-tab").click();
  await expect(dialog.getByText("留言／修改要求", { exact: true })).toBeVisible();
  await expect(dialog).toContainText("已提交 Final V1");

  await dialog.getByRole("button", { name: "關閉交付與留言" }).click();
  await expect(dialog).toBeHidden();
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
