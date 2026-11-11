import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createWorkbenchTemplate } from "../src/lib/workbench/model";

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
  const row = library.locator("article").filter({ has: page.locator("strong").getByText("新素材來源", { exact: true }) });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "停止收錄", exact: true }).click();
  await expect(row.getByText(/已停止收錄/)).toBeVisible();
  await page.getByRole("button", { name: "星球網絡", exact: true }).click();
  await expect(page.getByRole("button", { name: "3D 星際", exact: true })).toBeVisible();
});

test("partial provider coverage stays visible and a failed read can retry into a folder", async ({ page }) => {
  await page.route("**/api/internal/workbench", route => route.fulfill({ json: { document: createWorkbenchTemplate(), revision: 1, updatedAt: "2026-11-11T03:00:00Z" } }));
  await page.route("**/api/internal/workbench/context", route => route.fulfill({ json: { performance: { available: false, accounts: [] }, creative: { available: false, jobs: [] }, tasks: { available: false, jobs: [] } } }));
  let failed = false;
  await page.route("**/api/internal/workbench/resources**", route => {
    const params = new URL(route.request().url()).searchParams;
    if (params.has("overview")) return route.fulfill({ json: { total: 2, indexed: 1, pending: 0, automatic: true, sources: [{ id: "11111111-1111-4111-8111-111111111111", label: "素材來源", kind: "folder", nodeIds: ["creative"], enabled: true, contentMode: "documents", status: "partial", lastError: "一個子資料夾未能存取", lastSyncedAt: "2026-11-11T03:00:00Z", fileCount: 2 }] } });
    if (!failed) { failed = true; return route.fulfill({ status: 503, json: { message: "索引暫時未能讀取" } }); }
    const child = params.has("folder");
    return route.fulfill({ json: { total: 1, page: 0, pageSize: 40, files: [{ id: child ? "synthetic-brief-file" : "synthetic-material-folder", name: child ? "資料夾內拍攝 Brief" : "已收錄素材資料夾", mimeType: child ? "application/vnd.google-apps.document" : "application/vnd.google-apps.folder", paths: ["素材/拍攝"], nodeIds: ["creative"], sourceIds: [], url: "/creative-jobs", modifiedAt: "2026-11-11T03:00:00Z", hasThumbnail: false, textState: "metadata", snippet: "" }] } });
  });
  await page.goto("/e2e/workbench?remote=1", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "系統與資源", exact: true }).click();
  const library = page.getByTestId("resource-library");
  await expect(library.getByText("1 個來源需要檢查", { exact: true })).toBeVisible();
  await expect(library.getByText("索引暫時未能讀取", { exact: true })).toBeVisible();
  await library.getByRole("button", { name: "重新讀取", exact: true }).click();
  await library.getByRole("button", { name: "已收錄素材資料夾", exact: true }).click();
  await expect(library.getByRole("navigation", { name: "檔案資料夾路徑" })).toBeVisible();
  await expect(library.getByRole("link", { name: "資料夾內拍攝 Brief", exact: true })).toBeVisible();
});
