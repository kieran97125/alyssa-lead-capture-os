import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createWorkbenchTemplate } from "../src/lib/workbench/model";

for (const [name, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844]] as const) {
  test(`private work galaxy ${name} visual and accessibility`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/e2e/workbench", { waitUntil: "networkidle" });
    const desk = page.getByTestId("private-workbench");
    await expect(page.getByTestId("work-galaxy")).toHaveAttribute("data-mode", "spatial");
    await expect(page.getByTestId("work-galaxy")).toHaveAttribute("data-ready", "true", { timeout: 20000 });
    await expect(page.getByLabel("星球：我的 Alyssa", { exact: true })).toBeVisible();
    const galaxyA11y = await new AxeBuilder({ page }).include('[data-testid="work-galaxy"]').withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(galaxyA11y.violations).toEqual([]);
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
  await page.getByRole("button", { name: "2D 編排", exact: true }).click();
  await page.getByRole("button", { name: "新增星球", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("星球名稱", { exact: true }).fill("十一月拍攝計劃");
  await dialog.getByLabel("工作範圍／說明", { exact: true }).fill("先收集素材，再跟進剪片。");
  await dialog.getByRole("button", { name: "儲存星球", exact: true }).click();
  await expect(page.getByLabel("星球：十一月拍攝計劃", { exact: true })).toBeVisible();
  const planet = page.getByLabel("星球：十一月拍攝計劃", { exact: true });
  const originalPosition = await planet.evaluate(element => (element as HTMLElement).style.transform);
  const box = await planet.boundingBox();
  if (!box) throw new Error("New planet is not positioned on the canvas");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * .2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height * .2 + 25, { steps: 6 });
  await page.mouse.up();
  await expect.poll(() => planet.evaluate(element => (element as HTMLElement).style.transform)).not.toBe(originalPosition);
  await expect(page.getByRole("status").filter({ hasText: "已儲存" })).toBeVisible();
  const movedPosition = await planet.evaluate(element => (element as HTMLElement).style.transform);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "2D 編排", exact: true }).click();
  await expect.poll(() => planet.evaluate(element => (element as HTMLElement).style.transform)).toBe(movedPosition);
  await planet.click();
  await page.getByRole("button", { name: "新增工作關係", exact: true }).click();
  await dialog.getByLabel("連到", { exact: true }).selectOption("creative");
  await dialog.getByLabel("關係名稱", { exact: true }).fill("需要剪輯素材");
  await dialog.getByRole("button", { name: "儲存關係", exact: true }).click();
  await expect(page.getByRole("complementary", { name: "星球詳情" }).getByText("需要剪輯素材", { exact: true })).toBeVisible();
  await page.getByTestId("workbench-jobs").getByRole("button", { name: "新增 Job", exact: true }).click();
  await dialog.getByLabel("工作名稱", { exact: true }).fill("確認拍攝日期");
  await dialog.getByRole("button", { name: "儲存 Job", exact: true }).click();
  // Completing an open-only row removes its checkbox immediately.
  await page.getByRole("checkbox", { name: "標記完成：確認拍攝日期", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "標記完成：確認拍攝日期", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "復原上一步", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "標記完成：確認拍攝日期", exact: true })).not.toBeChecked();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "桌面捷徑", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("Alyssa_Work_Galaxy.url");
});

test("3D positions, optional inspector and full-width focus remain usable", async ({ page }) => {
  await page.goto("/e2e/workbench?dense=1", { waitUntil: "networkidle" });
  const galaxy = page.getByTestId("work-galaxy");
  await expect(galaxy).toHaveAttribute("data-mode", "spatial");
  await expect(galaxy).toHaveAttribute("data-ready", "true", { timeout: 20000 });
  await expect(page.getByRole("complementary", { name: "星球詳情" })).toHaveCount(0);
  const wide = await galaxy.boundingBox(), desk = await page.getByTestId("private-workbench").boundingBox();
  expect(wide!.width).toBeGreaterThan(desk!.width * .97);
  const planet = page.getByRole("button", { name: "星球：Ineffable Beauty", exact: true });
  const before = await planet.getAttribute("data-world-position");
  await planet.press("ArrowRight");
  await expect(planet).not.toHaveAttribute("data-world-position", before!);
  await expect(page.getByRole("status").filter({ hasText: "已儲存" })).toBeVisible();
  let moved = await planet.getAttribute("data-world-position");
  const canvasBox = await page.getByTestId("spatial-scene").locator("canvas").boundingBox();
  const center = await planet.evaluate(element => ({ x: Number((element as HTMLElement).dataset.sphereX), y: Number((element as HTMLElement).dataset.sphereY) }));
  await page.mouse.move(canvasBox!.x + center.x, canvasBox!.y + center.y);
  await page.mouse.down();
  await page.mouse.move(canvasBox!.x + center.x + 60, canvasBox!.y + center.y + 25, { steps: 8 });
  await page.mouse.up();
  await expect(planet).not.toHaveAttribute("data-world-position", moved!);
  await expect(page.getByRole("status").filter({ hasText: "已儲存" })).toBeVisible();
  moved = await planet.getAttribute("data-world-position");
  await page.reload({ waitUntil: "networkidle" });
  await expect(galaxy).toHaveAttribute("data-ready", "true", { timeout: 20000 });
  await expect(planet).toHaveAttribute("data-world-position", moved!);
  await page.getByLabel("選擇工作星球", { exact: true }).selectOption("creative");
  await expect(page.getByRole("complementary", { name: "星球詳情" })).toBeVisible();
  await page.getByRole("button", { name: "關閉星球詳情", exact: true }).click();
  await page.getByRole("button", { name: "專注模式", exact: true }).click();
  const full = await galaxy.boundingBox(); const viewport = page.viewportSize()!;
  expect(full!.width).toBeGreaterThan(viewport.width - 25);
  expect(full!.height).toBeGreaterThan(viewport.height - 25);
  await expect.soft(galaxy).toHaveScreenshot("private-work-galaxy-focused.png", { animations: "disabled" });
  await page.keyboard.press("Shift+Tab");
  expect(await page.evaluate(() => !!document.activeElement?.closest('[data-testid="galaxy-workspace"]'))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "專注模式", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  await page.getByRole("button", { name: "整理星系", exact: true }).click();
  await expect(planet).toHaveAttribute("data-world-position", before!);
  await page.getByRole("button", { name: "復原上一步", exact: true }).click();
  await expect(planet).toHaveAttribute("data-world-position", moved!);
});

test("a device without WebGL keeps editable work and a clear fallback", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") return null;
      return (original as (...a: unknown[]) => RenderingContext | null).call(this, type, ...args);
    } as typeof original;
  });
  await page.goto("/e2e/workbench", { waitUntil: "networkidle" });
  await expect(page.getByTestId("work-galaxy")).toHaveAttribute("data-mode", "flat", { timeout: 20000 });
  await expect(page.getByRole("status").filter({ hasText: "此裝置未能開啟 3D" })).toBeVisible();
  await expect(page.getByLabel("星球：我的 Alyssa", { exact: true })).toBeVisible();
  await page.getByLabel("選擇工作星球", { exact: true }).selectOption("creative");
  await expect(page.getByRole("button", { name: "新增工作關係", exact: true })).toBeVisible();
});

test("queued and failed saves survive client navigation and recover without overwriting a newer revision", async ({ page }) => {
  let saved = { document: createWorkbenchTemplate(), revision: 1, updatedAt: "2026-11-10T01:00:00.000Z" };
  let failWrites = false; let writes = 0;
  await page.route("**/api/internal/workbench/context", route => route.fulfill({ status: 503, json: { message: "驗收資料來源未提供" } }));
  await page.route("**/api/internal/workbench", async route => {
    if (route.request().method() === "GET") { await route.fulfill({ json: saved }); return; }
    writes++;
    const input = route.request().postDataJSON();
    if (input.revision !== saved.revision) { await route.fulfill({ status: 409, json: { message: "另一個視窗已更新工作枱" } }); return; }
    if (failWrites) { await route.fulfill({ status: 503, json: { message: "模擬儲存失敗" } }); return; }
    saved = { document: input.document, revision: saved.revision + 1, updatedAt: new Date().toISOString() };
    await route.fulfill({ json: { revision: saved.revision, updatedAt: saved.updatedAt } });
  });
  await page.goto("/e2e/workbench?remote=1", { waitUntil: "networkidle" });
  await expect(page.getByLabel("星球：我的 Alyssa", { exact: true })).toBeVisible();
  // Hold the debounce so this proves recovery of a queued, never-sent change.
  await page.clock.install({ time: new Date("2026-11-10T02:00:00Z") });
  await page.clock.pauseAt(new Date("2026-11-10T02:00:01Z"));
  await page.getByTestId("workbench-jobs").getByRole("button", { name: "新增 Job", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("工作名稱", { exact: true }).fill("跨頁暫存驗收");
  await dialog.getByRole("button", { name: "儲存 Job", exact: true }).click();
  await page.getByRole("link", { name: "測試離開工作枱", exact: true }).click();
  await expect(page.getByRole("link", { name: "返回測試工作枱", exact: true })).toBeVisible();
  expect(writes).toBe(0);
  await page.getByRole("link", { name: "返回測試工作枱", exact: true }).click();
  await expect(page.getByRole("button", { name: "編輯 Job：跨頁暫存驗收", exact: true })).toBeVisible();
  await page.clock.resume();
  await expect.poll(() => saved.document.jobs[0]?.title).toBe("跨頁暫存驗收");
  await expect(page.getByRole("status").filter({ hasText: "已儲存" })).toBeVisible();

  failWrites = true;
  await page.getByRole("button", { name: "編輯 Job：跨頁暫存驗收", exact: true }).click();
  await dialog.getByLabel("備註／跟進記錄", { exact: true }).fill("失敗後仍保留嘅備註");
  await dialog.getByRole("button", { name: "儲存 Job", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "模擬儲存失敗" })).toBeVisible();
  await page.getByRole("link", { name: "測試離開工作枱", exact: true }).click();
  await page.getByRole("link", { name: "返回測試工作枱", exact: true }).click();
  await page.getByRole("button", { name: "編輯 Job：跨頁暫存驗收", exact: true }).click();
  await expect(dialog.getByLabel("備註／跟進記錄", { exact: true })).toHaveValue("失敗後仍保留嘅備註");
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "模擬儲存失敗" })).toBeVisible();
  failWrites = false;
  await page.getByRole("button", { name: "重試儲存", exact: true }).click();
  await expect.poll(() => saved.document.jobs[0]?.notes).toBe("失敗後仍保留嘅備註");
  await expect(page.getByRole("status").filter({ hasText: "已儲存" })).toBeVisible();

  failWrites = true;
  await page.getByRole("button", { name: "編輯 Job：跨頁暫存驗收", exact: true }).click();
  await dialog.getByLabel("備註／跟進記錄", { exact: true }).fill("需要核對嘅私人改動");
  await dialog.getByRole("button", { name: "儲存 Job", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "模擬儲存失敗" })).toBeVisible();
  await page.getByRole("link", { name: "測試離開工作枱", exact: true }).click();
  saved = { ...saved, revision: saved.revision + 1 };
  const writesBeforeRecovery = writes;
  await page.getByRole("link", { name: "返回測試工作枱", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "版本需要核對" })).toBeVisible();
  await page.getByRole("button", { name: "編輯 Job：跨頁暫存驗收", exact: true }).click();
  await expect(dialog.getByLabel("備註／跟進記錄", { exact: true })).toHaveValue("需要核對嘅私人改動");
  await dialog.getByLabel("備註／跟進記錄", { exact: true }).fill("核對期間嘅修訂仍然需要比較版本");
  await dialog.getByRole("button", { name: "儲存 Job", exact: true }).click();
  await page.getByRole("link", { name: "測試離開工作枱", exact: true }).click();
  await page.getByRole("link", { name: "返回測試工作枱", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "版本需要核對" })).toBeVisible();
  await page.getByRole("button", { name: "編輯 Job：跨頁暫存驗收", exact: true }).click();
  await expect(dialog.getByLabel("備註／跟進記錄", { exact: true })).toHaveValue("核對期間嘅修訂仍然需要比較版本");
  expect(writes).toBe(writesBeforeRecovery);
  expect(saved.document.jobs[0]?.notes).toBe("失敗後仍保留嘅備註");
});

test("anonymous and standard admin cannot reach private document APIs", async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  try {
    const denied = async () => {
      for (const path of ["/api/internal/workbench", "/api/internal/workbench/context", "/api/internal/workbench/resources", "/api/internal/workbench/resources?overview=1", "/api/internal/workbench/resources/thumbnail?file=synthetic-private-file", "/workbench"]) {
        const response = await context.request.get(path, { maxRedirects: 0 });
        expect([303, 307, 403, 404]).toContain(response.status());
        expect(await response.text()).not.toContain('"schemaVersion":1');
      }
      const write = await context.request.post("/api/internal/workbench/resources", { data: { action: "sync" }, maxRedirects: 0 });
      expect([303, 307, 403, 404]).toContain(write.status());
      expect((await context.request.post("/api/cron/workbench-resources")).status()).toBe(401);
    };
    await denied();
    const page = await context.newPage();
    await page.goto("/login?next=/dashboard");
    if (!await page.getByLabel("Password").isVisible()) await page.getByText(/切換期間管理員登入|緊急管理員登入/).click();
    await page.getByLabel("Password").fill(process.env.E2E_ADMIN_PASSWORD || "playwright-ci-password");
    await page.getByRole("button", { name: "管理員登入", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard(?:\?|$)/);
    await expect(page.getByRole("link", { name: "我的工作星圖", exact: true })).toHaveCount(0);
    await denied();
  } finally { await context.close(); }
});
