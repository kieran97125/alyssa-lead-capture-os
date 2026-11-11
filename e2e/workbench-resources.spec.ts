import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const viewport of [{ name: "desktop", width: 1440, height: 1000 }, { name: "mobile", width: 390, height: 844 }]) {
  test(`private resource library ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/e2e/workbench", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "系統與資源", exact: true }).click();
    const library = page.getByTestId("resource-library");
    await expect(library.getByText("肩頸護理｜拍攝 Brief", { exact: true })).toBeVisible();
    const audit = await new AxeBuilder({ page }).include('[data-testid="resource-library"]').withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(audit.violations).toEqual([]);
    await expect(library).toHaveScreenshot(`work-resource-library-${viewport.name}.png`, { animations: "disabled" });
    await library.getByLabel("搜尋工作檔案").fill("穴位");
    await expect(library.getByText("暫時冇符合條件嘅檔案")).toBeVisible();
    await library.getByLabel("搜尋工作檔案").fill("肩頸放鬆");
    await expect(library.getByText("肩頸護理｜拍攝 Brief", { exact: true })).toBeVisible();
    await expect(library.getByText("護理過程｜剪輯版本 02.mp4", { exact: true })).toHaveCount(0);
    await library.getByLabel("搜尋工作檔案").fill("");
    await library.getByLabel("檔案類型").selectOption("video");
    await expect(library.getByText("護理過程｜剪輯版本 02.mp4", { exact: true })).toBeVisible();
    await library.getByRole("button", { name: "由檔案建立 Job：護理過程｜剪輯版本 02.mp4", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("工作名稱", { exact: true })).toHaveValue("跟進：護理過程｜剪輯版本 02.mp4");
    await dialog.getByRole("button", { name: "儲存 Job", exact: true }).click();
    await page.getByRole("button", { name: "Job list", exact: true }).click();
    await expect(page.getByRole("button", { name: "編輯 Job：跟進：護理過程｜剪輯版本 02.mp4", exact: true })).toBeVisible();
  });
}
test("resource source add and pause preserve the original work graph", async ({ page }) => {
  await page.goto("/e2e/workbench", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "系統與資源", exact: true }).click();
  const library = page.getByTestId("resource-library");
  await library.getByRole("button", { name: "加入來源", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Google 資料夾／文件連結").fill("https://drive.google.com/drive/folders/synthetic-new-folder");
  await dialog.getByLabel("顯示名稱").fill("新素材來源");
  await dialog.getByRole("checkbox", { name: "Creative 製作", exact: true }).check();
  await dialog.getByRole("button", { name: "加入並收錄", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await library.getByText("來源與同步狀態", { exact: false }).click();
  await expect(library.getByText("新素材來源", { exact: true })).toBeVisible();
  const row = library.getByText("新素材來源", { exact: true }).locator("xpath=../..");
  await row.getByRole("button", { name: "停止收錄", exact: true }).click();
  await expect(row.getByText(/已停止收錄/)).toBeVisible();
  await page.getByRole("button", { name: "星球網絡", exact: true }).click();
  await expect(page.getByRole("button", { name: "3D 星際", exact: true })).toBeVisible();
});
