import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const [name, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844]] as const) {
  test(`private work galaxy ${name} visual and accessibility`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/e2e/workbench", { waitUntil: "networkidle" });
    const desk = page.getByTestId("private-workbench");
    await expect(page.getByLabel("星球：我的 Alyssa", { exact: true })).toBeVisible();
    await expect.soft(desk).toHaveScreenshot(`private-work-galaxy-${name}.png`, { animations: "disabled" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await desk.getByRole("button", { name: "Job list", exact: true }).click();
    await expect(page.getByRole("button", { name: /跟進本周 Creative 素材/ }).first()).toBeVisible();
    const results = await new AxeBuilder({ page }).include('[data-testid="private-workbench"]').withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(results.violations).toEqual([]);
    await expect.soft(desk).toHaveScreenshot(`private-work-jobs-${name}.png`);
  });
}

test("jobs, nested checklist, cancellation, persistence and archive recovery", async ({ page }) => {
  await page.goto("/e2e/workbench", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Job list", exact: true }).click();
  await page.getByRole("button", { name: "編輯 Job：跟進本周 Creative 素材", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox", { name: "確認 Brief", exact: true }).check();
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await page.getByRole("button", { name: "編輯 Job：跟進本周 Creative 素材", exact: true }).click();
  await expect(dialog.getByRole("checkbox", { name: "確認 Brief", exact: true })).not.toBeChecked();
  await dialog.getByRole("checkbox", { name: "確認 Brief", exact: true }).check();
  await dialog.getByLabel("備註／跟進記錄", { exact: true }).fill("已確認交片安排");
  await dialog.getByRole("button", { name: "儲存 Job", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "已儲存" })).toBeVisible();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Job list", exact: true }).click();
  await page.getByRole("button", { name: "編輯 Job：跟進本周 Creative 素材", exact: true }).click();
  await expect(dialog.getByRole("checkbox", { name: "確認 Brief", exact: true })).toBeChecked();
  await expect(dialog.getByLabel("備註／跟進記錄", { exact: true })).toHaveValue("已確認交片安排");
  await dialog.getByRole("button", { name: "移至封存", exact: true }).click();
  await expect(page.getByRole("button", { name: "編輯 Job：跟進本周 Creative 素材", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "系統與資源", exact: true }).click();
  await page.getByRole("button", { name: "查看封存", exact: true }).click();
  await page.getByText("Job · 跟進本周 Creative 素材", { exact: true }).locator("..").getByRole("button", { name: "恢復" }).click();
  await page.getByRole("button", { name: "Job list", exact: true }).click();
  await expect(page.getByRole("button", { name: "編輯 Job：跟進本周 Creative 素材", exact: true })).toBeVisible();
});

test("create planet, edit relation, complete a job, undo and export desktop shortcut", async ({ page }) => {
  await page.goto("/e2e/workbench", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "新增星球", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("星球名稱", { exact: true }).fill("十一月拍攝計劃");
  await dialog.getByLabel("工作範圍／說明", { exact: true }).fill("先收集素材，再跟進剪片。");
  await dialog.getByRole("button", { name: "儲存星球", exact: true }).click();
  await expect(page.getByLabel("星球：十一月拍攝計劃", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "新增工作關係", exact: true }).click();
  await dialog.getByLabel("連到", { exact: true }).selectOption("creative");
  await dialog.getByLabel("關係名稱", { exact: true }).fill("需要剪輯素材");
  await dialog.getByRole("button", { name: "儲存關係", exact: true }).click();
  await expect(page.getByRole("complementary", { name: "星球詳情" }).getByText("需要剪輯素材", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "新增 Job", exact: true }).click();
  await dialog.getByLabel("工作名稱", { exact: true }).fill("確認拍攝日期");
  await dialog.getByRole("button", { name: "儲存 Job", exact: true }).click();
  await page.getByRole("checkbox", { name: "標記完成：確認拍攝日期", exact: true }).check();
  await expect(page.getByRole("checkbox", { name: "標記完成：確認拍攝日期", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "復原上一步", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "標記完成：確認拍攝日期", exact: true })).not.toBeChecked();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "桌面捷徑", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("Alyssa_Work_Galaxy.url");
});

test("anonymous and standard admin cannot reach private document APIs", async ({ request }) => {
  for (const path of ["/api/internal/workbench", "/api/internal/workbench/context", "/workbench"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect([303, 307, 403, 404]).toContain(response.status());
    expect(await response.text()).not.toContain('"schemaVersion":1');
  }
});
