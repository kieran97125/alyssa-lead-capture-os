import { expect, test } from "@playwright/test";

async function openFixture(page: Parameters<typeof test>[0] extends never ? never : any) {
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

test("rich Brief supports long-form editing, headings and checklist content", async ({
  page,
}) => {
  await openFixture(page);
  const workspace = page.getByTestId("creative-brief-workspace");
  await expect(workspace).toBeVisible();
  const editor = workspace.locator(".ProseMirror");
  await expect(editor).toContainText("Campaign 目的");
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type(
    "這是一段用來驗證長篇 Creative Brief 可以直接輸入、編輯及自動儲存的內容。"
  );
  await expect(editor).toContainText("長篇 Creative Brief");
  await workspace.getByRole("button", { name: "標題 2" }).click();
  await page.keyboard.type("畫面與 VO 要求");
  await expect(editor.locator("h2")).toContainText("畫面與 VO 要求");
  await workspace.getByRole("button", { name: "Checklist" }).click();
  await page.keyboard.type("價錢及 CTA 已核對");
  await expect(editor.locator('ul[data-type="taskList"]')).toContainText(
    "價錢及 CTA 已核對"
  );
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
