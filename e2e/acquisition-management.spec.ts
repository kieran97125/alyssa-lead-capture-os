import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Request as PlaywrightRequest } from "@playwright/test";
import { fixtureIds } from "../src/app/e2e/acquisition-management/fixtureData";

const fixtureUrl = "/e2e/acquisition-management";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function submittedActionField(request: PlaywrightRequest, field: string) {
  const body = await new globalThis.Request("https://fixture.invalid", {
    method: "POST", headers: { "content-type": request.headers()["content-type"] }, body: request.postData() ?? "",
  }).formData();
  // React prefixes nested FormData fields; the actual named field remains the suffix.
  const values = [...body.entries()].filter(([key]) => key === field || key.endsWith(`_${field}`)).map(([, value]) => String(value));
  expect(values).toHaveLength(1);
  return values[0];
}

async function openSettings(page: Page, purpose: "wix" | "landing_page", suffix = "") {
  await page.goto(`${fixtureUrl}${suffix}`, { waitUntil: "networkidle" });
  const form = page.getByTestId("acquisition-creation-form");
  await form.getByTestId(purpose === "wix" ? "acquisition-purpose-wix" : "acquisition-purpose-landing").click();
  await form.getByTestId("acquisition-next").click();
  await expect(form.getByTestId("acquisition-step")).toHaveAttribute("data-step", "2");
  return form;
}

test("one creation flow shows only the selected purpose and valid dependent choices", async ({ page }) => {
  await page.goto(fixtureUrl);
  const form = page.getByTestId("acquisition-creation-form");
  await expect(form.getByTestId("acquisition-next")).toBeDisabled();
  await expect(form.getByTestId("acquisition-purpose-wix")).toHaveAttribute("aria-pressed", "false");
  await expect(form.getByTestId("acquisition-purpose-landing")).toHaveAttribute("aria-pressed", "false");
  await form.getByTestId("acquisition-purpose-wix").click();
  await form.getByTestId("acquisition-next").click();
  await expect(form.getByLabel("網站網址", { exact: true })).toBeVisible();
  await expect(form.getByLabel("主要標題", { exact: true })).toHaveCount(0);
  await expect(form.getByLabel("頁面簡介", { exact: true })).toHaveCount(0);
  await expect(form.getByLabel("使用現有登記表格", { exact: true })).toHaveCount(0);
  await expect(form.getByLabel("額外允許網站", { exact: true })).toBeHidden();
  await expect(form.getByRole("option", { name: /已停用舊優惠/ })).toHaveCount(0);

  await form.getByLabel("療程", { exact: true }).selectOption(fixtureIds.body);
  await expect(form.getByLabel("優惠", { exact: true })).toHaveValue(fixtureIds.bodyOffer);
  await form.getByLabel("預設分店", { exact: true }).selectOption(fixtureIds.branchASecond);
  await form.getByLabel("管理名稱", { exact: true }).fill("我自己命名的推廣");
  await form.getByLabel("品牌", { exact: true }).selectOption(fixtureIds.brandB);
  await expect(form.getByLabel("療程", { exact: true })).toHaveValue(fixtureIds.treatmentB);
  await expect(form.getByLabel("優惠", { exact: true })).toHaveValue(fixtureIds.offerB);
  await expect(form.getByLabel("預設分店", { exact: true })).toHaveValue(fixtureIds.branchB);
  await expect(form.getByLabel("管理名稱", { exact: true })).toHaveValue("我自己命名的推廣");
  await expect(form.getByLabel("優惠", { exact: true }).locator(`option[value="${fixtureIds.faceOffer}"]`)).toHaveCount(0);
  await expect(form.getByLabel("優惠", { exact: true }).locator(`option[value="${fixtureIds.bodyOffer}"]`)).toHaveCount(0);
  await form.getByLabel("網站網址", { exact: true }).fill("https://example.test/november");
  await form.getByTestId("acquisition-next").click();
  await expect(form.getByTestId("acquisition-step")).toHaveAttribute("data-step", "3");
  await expect(form.getByTestId("acquisition-step")).toContainText("示例美容 B");
  await expect(form.getByTestId("acquisition-step")).toContainText("我自己命名的推廣");
  await form.getByTestId("acquisition-submit").click();
  const submitted = JSON.parse(await page.getByTestId("acquisition-submitted").innerText());
  expect(submitted).toMatchObject({
    campaignMode: "wix_form", brandId: fixtureIds.brandB, defaultTreatmentId: fixtureIds.treatmentB,
    defaultPackageId: fixtureIds.offerB, defaultBranchId: fixtureIds.branchB,
    formName: "我自己命名的推廣", placementKind: "wix", placementUrl: "https://example.test/november",
  });
  expect(submitted.requestId).toMatch(uuid);
  expect(submitted.packageIds).toEqual([fixtureIds.offerB]);
  expect(submitted.branchIds).toEqual([fixtureIds.branchB]);
  expect(submitted.heroTitle).toBe("");
});

test("LP reuse is scoped to active forms and clears a previous brand selection", async ({ page }) => {
  const form = await openSettings(page, "landing_page");
  await expect(form.getByLabel("主要標題", { exact: true })).toBeVisible();
  await expect(form.getByLabel("頁面簡介", { exact: true })).toBeVisible();
  await expect(form.getByLabel("網站網址", { exact: true })).toHaveCount(0);
  await form.getByLabel("使用現有登記表格", { exact: true }).check();
  const existing = form.getByLabel("現有登記表格", { exact: true });
  await expect(existing.getByRole("option", { name: "A 現有登記表", exact: true })).toHaveCount(1);
  await expect(existing.getByRole("option", { name: "A 已停用登記表", exact: true })).toHaveCount(0);
  await expect(existing.getByRole("option", { name: "B 現有登記表", exact: true })).toHaveCount(0);
  await existing.selectOption(fixtureIds.activeFormA);
  await form.getByLabel("品牌", { exact: true }).selectOption(fixtureIds.brandB);
  await expect(existing).toHaveValue("");
  await expect(existing.getByRole("option", { name: "A 現有登記表", exact: true })).toHaveCount(0);
  await existing.selectOption(fixtureIds.activeFormB);
  await form.getByLabel("管理名稱", { exact: true }).fill("11月塑形推廣");
  await form.getByLabel("主要標題", { exact: true }).fill("我新寫的廣告標題");
  await form.getByTestId("acquisition-next").click();
  await form.getByTestId("acquisition-submit").click();
  const submitted = JSON.parse(await page.getByTestId("acquisition-submitted").innerText());
  expect(submitted).toMatchObject({ campaignMode: "existing_form_landing_page", existingFormId: fixtureIds.activeFormB,
    brandId: fixtureIds.brandB, defaultTreatmentId: fixtureIds.treatmentB,
    defaultPackageId: fixtureIds.offerB, defaultBranchId: fixtureIds.branchB,
    heroTitle: "我新寫的廣告標題", placementKind: "landing_page" });
});

test("a new advertising page includes its new registration form without requiring Wix settings", async ({ page }) => {
  const form = await openSettings(page, "landing_page");
  await expect(form.getByLabel("使用現有登記表格", { exact: true })).not.toBeChecked();
  await expect(form.getByLabel("現有登記表格", { exact: true })).toHaveCount(0);
  await form.getByLabel("管理名稱", { exact: true }).fill("11月面部體驗推廣");
  await form.getByLabel("主要標題", { exact: true }).fill("為肌膚安排一次休息");
  await form.getByLabel("頁面簡介", { exact: true }).fill("登記後由同事安排合適時間。");
  await form.getByTestId("acquisition-next").click();
  await expect(form.getByTestId("acquisition-step")).toHaveAttribute("data-step", "3");
  await expect(form.getByTestId("acquisition-step")).toContainText("會先建立草稿");
  await form.getByTestId("acquisition-submit").click();
  const submitted = JSON.parse(await page.getByTestId("acquisition-submitted").innerText());
  expect(submitted).toMatchObject({ campaignMode: "new_landing_page", existingFormId: "",
    formName: "11月面部體驗推廣", pageTitle: "11月面部體驗推廣", placementKind: "landing_page",
    placementUrl: "", heroTitle: "為肌膚安排一次休息", heroSubtitle: "登記後由同事安排合適時間。" });
});

test("an incomplete Wix address keeps the operator beside the field that needs attention", async ({ page }) => {
  const form = await openSettings(page, "wix");
  await form.getByLabel("網站網址", { exact: true }).fill("example");
  await form.getByTestId("acquisition-next").click();
  await expect(form.getByTestId("acquisition-step")).toHaveAttribute("data-step", "2");
  await expect(form.getByLabel("網站網址", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await expect(form.getByText("請輸入完整網站網址，例如 https://example.com/offer。", { exact: true })).toBeVisible();
  await form.getByLabel("網站網址", { exact: true }).fill("https://example.test/corrected");
  await form.getByTestId("acquisition-next").click();
  await expect(form.getByTestId("acquisition-step")).toHaveAttribute("data-step", "3");
});

test("a failed save retains choices and retry identity while a pending save cannot be submitted twice", async ({ page }) => {
  const form = await openSettings(page, "wix", "?action=failure");
  await form.getByLabel("管理名稱", { exact: true }).fill("保留我的未完成設定");
  await form.getByLabel("網站網址", { exact: true }).fill("https://example.test/keep-me");
  await form.getByLabel("預設分店", { exact: true }).selectOption(fixtureIds.branchASecond);
  const requestId = await form.locator('input[name="requestId"]').inputValue();
  expect(requestId).toMatch(uuid);
  await form.getByTestId("acquisition-next").click();
  let submits = 0;
  page.on("request", request => { if (request.method() === "POST" && request.headers()["next-action"]) submits++; });
  const submit = form.getByTestId("acquisition-submit");
  await submit.focus(); await page.keyboard.press("Enter");
  await expect(submit).toBeDisabled();
  await page.keyboard.press("Enter");
  await expect(form.getByRole("alert")).toHaveText("暫時未能儲存，請再試一次。");
  await expect(submit).toBeEnabled();
  expect(submits).toBe(1);
  await expect(form.locator('input[name="requestId"]')).toHaveValue(requestId);
  await form.getByTestId("acquisition-back").click();
  await expect(form.getByLabel("管理名稱", { exact: true })).toHaveValue("保留我的未完成設定");
  await expect(form.getByLabel("網站網址", { exact: true })).toHaveValue("https://example.test/keep-me");
  await expect(form.getByLabel("預設分店", { exact: true })).toHaveValue(fixtureIds.branchASecond);
  await form.getByTestId("acquisition-next").click();
  await submit.click();
  await expect(submit).toBeDisabled();
  await expect(form.getByRole("alert")).toHaveText("暫時未能儲存，請再試一次。");
  await expect(submit).toBeEnabled();
  expect(submits).toBe(2);
  await expect(form.locator('input[name="requestId"]')).toHaveValue(requestId);
});

test("changing data after a failed creation rotates its request identity", async ({ page }) => {
  const form = await openSettings(page, "wix", "?action=failure");
  await form.getByLabel("網站網址", { exact: true }).fill("https://example.test/retry");
  await form.getByTestId("acquisition-next").click();
  const first = await form.locator('input[name="requestId"]').inputValue();
  await form.getByTestId("acquisition-submit").click();
  await expect(form.getByRole("alert")).toBeVisible();
  await form.getByTestId("acquisition-back").click();
  await form.getByLabel("管理名稱", { exact: true }).fill("另一個推廣內容");
  await form.getByTestId("acquisition-next").click();
  await form.getByTestId("acquisition-submit").click();
  await expect(form.getByRole("alert")).toBeVisible();
  await expect(form.getByTestId("acquisition-submit")).toBeEnabled();
  const second = await form.locator('input[name="requestId"]').inputValue();
  expect(second).toMatch(uuid); expect(second).not.toBe(first);
});

test("the LP editor retains a failed save, fences duplicate submits and rotates changed retry content", async ({ page }) => {
  await page.goto(`${fixtureUrl}?view=editor&action=failure`, { waitUntil: "networkidle" });
  const form = page.locator("#landing-page-editor-form");
  const title = form.getByLabel("主標題", { exact: true });
  await title.fill("我未完成的廣告內容");
  const requestId = await form.locator('input[name="requestId"]').inputValue();
  await expect(form.getByText("有未儲存的修改", { exact: true })).toBeVisible();
  const requests: PlaywrightRequest[] = [];
  page.on("request", request => { if (request.method() === "POST" && request.headers()["next-action"]) requests.push(request); });
  const save = form.getByRole("button", { name: "儲存草稿", exact: true });
  await save.focus(); await page.keyboard.press("Enter");
  await expect(save).toBeDisabled(); await page.keyboard.press("Enter");
  await expect(form.getByRole("alert")).toContainText("暫時未能完成儲存。");
  await expect(save).toBeEnabled();
  expect(requests).toHaveLength(1);
  await expect(title).toHaveValue("我未完成的廣告內容");
  await expect(form.locator('input[name="requestId"]')).toHaveValue(requestId);
  await save.click();
  await expect(save).toBeDisabled();
  await expect(save).toBeEnabled();
  expect(requests).toHaveLength(2);
  await expect(form.locator('input[name="requestId"]')).toHaveValue(requestId);
  await title.fill("另一段需要儲存的內容");
  await save.click();
  await expect(save).toBeDisabled();
  await expect(save).toBeEnabled();
  expect(requests).toHaveLength(3);
  expect(await submittedActionField(requests[0], "requestId")).toBe(requestId);
  expect(await submittedActionField(requests[1], "requestId")).toBe(requestId);
  const changed = await submittedActionField(requests[2], "requestId");
  expect(changed).toMatch(uuid); expect(changed).not.toBe(requestId);
  await expect(title).toHaveValue("另一段需要儲存的內容");
});

test("LP preview submits current content through the preview action", async ({ page }) => {
  await page.goto(`${fixtureUrl}?view=editor`, { waitUntil: "networkidle" });
  const form = page.locator("#landing-page-editor-form");
  await form.getByLabel("主標題", { exact: true }).fill("現在要預覽的內容");
  await form.getByRole("button", { name: "儲存並預覽", exact: true }).click();
  const submitted = JSON.parse(await page.getByTestId("acquisition-submitted").innerText());
  expect(submitted).toMatchObject({ actionName: "preview", editorIntent: "preview", heroTitle: "現在要預覽的內容", expectedRevision: "3" });
  expect(submitted.requestId).toMatch(uuid);
});

test("LP publishing requires explicit confirmation and cancellation keeps edits local", async ({ page }) => {
  await page.goto(`${fixtureUrl}?view=editor&published=1`, { waitUntil: "networkidle" });
  const form = page.locator("#landing-page-editor-form");
  await form.getByLabel("主標題", { exact: true }).fill("確認後才會公開的內容");
  let requests = 0;
  page.on("request", request => { if (request.method() === "POST" && request.headers()["next-action"]) requests++; });
  await form.getByRole("button", { name: "更新公開頁", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "更新客人看到的內容？", exact: true });
  await expect(dialog).toBeVisible(); expect(requests).toBe(0);
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(form.getByLabel("主標題", { exact: true })).toHaveValue("確認後才會公開的內容");
  expect(requests).toBe(0);
  await form.getByRole("button", { name: "更新公開頁", exact: true }).click();
  await dialog.getByRole("button", { name: "確認更新", exact: true }).click();
  const submitted = JSON.parse(await page.getByTestId("acquisition-submitted").innerText());
  expect(submitted).toMatchObject({ actionName: "publish", editorIntent: "publish", heroTitle: "確認後才會公開的內容" });
  expect(requests).toBe(1);
});

test("a disconnected or archived LP editor cannot dispatch changes", async ({ page }) => {
  await page.goto(`${fixtureUrl}?view=editor&disabled=1`, { waitUntil: "networkidle" });
  const form = page.locator("#landing-page-editor-form");
  await expect(form.getByLabel("主標題", { exact: true })).toBeDisabled();
  for (const name of ["儲存草稿", "儲存並預覽", "發布廣告頁"]) await expect(form.getByRole("button", { name, exact: true })).toBeDisabled();
  let requests = 0;
  page.on("request", request => { if (request.method() === "POST" && request.headers()["next-action"]) requests++; });
  await form.evaluate(element => element.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  await page.waitForTimeout(100);
  expect(requests).toBe(0);
});

test("an unexpected editor action failure preserves usable edits and unlocks retry", async ({ page }) => {
  await page.goto(`${fixtureUrl}?view=editor&action=throw`, { waitUntil: "networkidle" });
  const form = page.locator("#landing-page-editor-form");
  await form.getByLabel("主標題", { exact: true }).fill("錯誤後仍然保留的內容");
  const save = form.getByRole("button", { name: "儲存草稿", exact: true });
  await save.click();
  await expect(form.getByRole("alert")).toBeVisible();
  await expect(save).toBeEnabled();
  await expect(form.getByLabel("主標題", { exact: true })).toHaveValue("錯誤後仍然保留的內容");
  await save.click();
  await expect(save).toBeEnabled();
  await expect(form.getByRole("alert")).toBeVisible();
});

test("leaving an edited LP asks before discarding and cancellation keeps the current text", async ({ page }) => {
  await page.goto(`${fixtureUrl}?view=editor`, { waitUntil: "networkidle" });
  const title = page.locator("#landing-page-editor-form").getByLabel("主標題", { exact: true });
  await title.fill("離開前應該保留這段內容");
  const back = page.getByRole("link", { name: "返回推廣列表", exact: true });
  await back.click();
  const dialog = page.getByRole("dialog", { name: "離開並捨棄未儲存的修改？", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "繼續編輯", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(title).toHaveValue("離開前應該保留這段內容");
  await expect(page).toHaveURL(/view=editor/);
  await back.click();
  await dialog.getByRole("button", { name: "離開並捨棄修改", exact: true }).click();
  await expect(page).toHaveURL(/view=catalogue/);
});

test("form editing preserves naming and placement while an archived form stays an explicit separate operation", async ({ page }) => {
  await page.goto(`${fixtureUrl}?view=form-editor&archived=1`, { waitUntil: "networkidle" });
  const form = page.getByTestId("form-settings-card");
  await expect(form.getByText("這張表格已停用。儲存設定後仍會維持停用。", { exact: true })).toBeVisible();
  await expect(form.getByLabel("額外允許網站", { exact: true })).toBeHidden();
  await expect(form.locator('input[name="status"]')).toHaveCount(0);
  await form.getByLabel("管理名稱", { exact: true }).fill("停用中的11月推廣");
  await form.getByLabel("網站網址", { exact: true }).fill("https://example.test/new-placement");
  await form.getByRole("button", { name: "儲存設定", exact: true }).click();
  const submitted = JSON.parse(await page.getByTestId("acquisition-submitted").innerText());
  expect(submitted).toMatchObject({ actionName: "form-edit", formId: fixtureIds.stoppedFormA,
    formName: "停用中的11月推廣", placementUrl: "https://example.test/new-placement", expectedRevision: "1", status: "" });
});

test("a rejected registration setting update keeps the operator's modified fields", async ({ page }) => {
  await page.goto(`${fixtureUrl}?view=form-editor&action=failure`, { waitUntil: "networkidle" });
  const form = page.getByTestId("form-settings-card");
  await form.getByLabel("管理名稱", { exact: true }).fill("尚未成功儲存的名稱");
  await form.getByLabel("網站網址", { exact: true }).fill("https://example.test/retained");
  const save = form.getByRole("button", { name: "儲存設定", exact: true });
  await save.click();
  await expect(save).toBeDisabled();
  await expect(form.getByRole("alert")).toHaveText("暫時未能儲存，請再試一次。");
  await expect(save).toBeEnabled();
  await expect(form.getByLabel("管理名稱", { exact: true })).toHaveValue("尚未成功儲存的名稱");
  await expect(form.getByLabel("網站網址", { exact: true })).toHaveValue("https://example.test/retained");
  await expect(form.locator('input[name="expectedRevision"]')).toHaveValue("1");
});

for (const [name, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844]] as const) {
  test(`LP and registration editors remain compact and accessible on ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto(`${fixtureUrl}?view=editor`, { waitUntil: "networkidle" });
    await expect(page.getByTestId("acquisition-fixture")).toHaveScreenshot(`acquisition-lp-editor-${name}.png`, { animations: "disabled" });
    await expect(page.getByRole("button", { name: "儲存並預覽", exact: true })).toBeVisible();
    let result = await new AxeBuilder({ page }).include('[data-testid="acquisition-fixture"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(result.violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.goto(`${fixtureUrl}?view=form-editor`, { waitUntil: "networkidle" });
    const editor = page.getByTestId("form-settings-card");
    await expect(editor.getByLabel("額外允許網站", { exact: true })).toBeHidden();
    await expect(page.getByTestId("acquisition-fixture")).toHaveScreenshot(`acquisition-form-editor-${name}.png`, { animations: "disabled" });
    await editor.locator("summary").focus(); await page.keyboard.press("Enter");
    await expect(editor.getByLabel("額外允許網站", { exact: true })).toBeVisible();
    await page.keyboard.press("Space");
    await expect(editor.getByLabel("額外允許網站", { exact: true })).toBeHidden();
    result = await new AxeBuilder({ page }).include('[data-testid="form-settings-card"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(result.violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test(`guided creation stays readable and accessible on ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto(fixtureUrl, { waitUntil: "networkidle" });
    const fixture = page.getByTestId("acquisition-fixture");
    await expect(fixture).toHaveScreenshot(`acquisition-purpose-${name}.png`, { animations: "disabled" });
    await fixture.getByTestId("acquisition-purpose-wix").focus(); await page.keyboard.press("Enter");
    await fixture.getByTestId("acquisition-next").focus(); await page.keyboard.press("Enter");
    await expect(fixture.getByLabel("額外允許網站", { exact: true })).toBeHidden();
    await expect(fixture).toHaveScreenshot(`acquisition-wix-settings-${name}.png`, { animations: "disabled" });
    const details = fixture.locator("details").filter({ hasText: "進階設定" });
    await details.locator("summary").focus(); await page.keyboard.press("Enter");
    await expect(fixture.getByLabel("額外允許網站", { exact: true })).toBeVisible();
    await page.keyboard.press("Space");
    await expect(fixture.getByLabel("額外允許網站", { exact: true })).toBeHidden();
    const result = await new AxeBuilder({ page }).include('[data-testid="acquisition-fixture"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(result.violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test(`Wix installation on ${name} keeps code optional and copying does not assert connection`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", { configurable: true,
        value: { writeText: async (text: string) => { (window as Window & { copiedFixture?: string }).copiedFixture = text; } } });
    });
    await page.goto(`${fixtureUrl}?view=setup`, { waitUntil: "networkidle" });
    const panel = page.getByTestId("wix-setup-panel");
    await expect(panel.getByLabel("表格安裝碼", { exact: true })).toBeHidden();
    await expect(panel.getByLabel("來源設定程式碼", { exact: true })).toBeHidden();
    await expect(panel.getByText(/已連接|已安裝|同步成功/)).toHaveCount(0);
    await expect(panel).toHaveScreenshot(`acquisition-wix-install-${name}.png`, { animations: "disabled" });
    const copy = panel.getByRole("button", { name: "複製表格安裝碼", exact: true });
    await copy.focus(); await page.keyboard.press("Enter");
    await expect(panel.getByTestId("wix-copy-feedback")).toHaveText("已複製表格安裝碼。");
    expect(await page.evaluate(() => (window as Window & { copiedFixture?: string }).copiedFixture)).toContain("fixture-install-token");
    await expect(panel.getByText(/已連接|已安裝|同步成功/)).toHaveCount(0);
    await expect(panel.getByRole("button", { name: "預覽表格", exact: true })).toHaveAttribute("href", `/forms/${fixtureIds.activeFormA}/preview`);
    await panel.locator("summary").focus(); await page.keyboard.press("Enter");
    await expect(panel.getByLabel("表格安裝碼", { exact: true })).toBeVisible();
    const result = await new AxeBuilder({ page }).include('[data-testid="wix-setup-panel"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(result.violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test("saved draft uses the public renderer while preview remains inert", async ({ page }) => {
  await page.goto(fixtureUrl);
  await page.evaluate(() => localStorage.setItem("acquisition-preview-sentinel", "preserve"));
  const before = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])));
  const publicRequests: string[] = [];
  await page.route("**/api/public/**", route => { publicRequests.push(route.request().url()); return route.abort(); });
  const pixelRequests: string[] = [];
  await page.route(/(?:facebook\.com\/tr|connect\.facebook\.net)/, route => { pixelRequests.push(route.request().url()); return route.abort(); });
  await page.goto(`${fixtureUrl}?view=preview`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "尚未發布的草稿標題", exact: true })).toBeVisible();
  await expect(page.getByText("這是已儲存草稿的內容，公開頁尚未更新。", { exact: true }).first()).toBeVisible();
  const form = page.locator("form");
  await expect(form).toHaveCount(1);
  const controls = form.locator('input:not([type="hidden"]), select, textarea, button[type="submit"]');
  expect(await controls.count()).toBeGreaterThan(2);
  for (let index = 0; index < await controls.count(); index++) await expect(controls.nth(index)).toBeDisabled();
  await form.evaluate(element => element.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  await page.waitForTimeout(250);
  expect(publicRequests).toEqual([]); expect(pixelRequests).toEqual([]);
  await expect(page.locator('script[src*="connect.facebook.net"]')).toHaveCount(0);
  const after = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])));
  expect(after).toEqual(before);
});

test("shared form offer changes update operational pricing while saved authored copy stays fixed", async ({ page }) => {
  await page.goto(`${fixtureUrl}?view=shared-offer`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "尚未發布的草稿標題", exact: true })).toBeVisible();
  await expect(page.getByText("這是已儲存草稿的內容，公開頁尚未更新。", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("A 分店二 · 身體護理", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: /登記.*580.*優惠/ })).toBeVisible();
  await expect(page.locator("form")).toContainText("輕盈身體體驗");
  await expect(page.getByRole("heading", { name: /登記.*480.*優惠/ })).toHaveCount(0);
});

test("catalogue distinguishes unavailable observations from a verified empty history", async ({ page }) => {
  await page.goto(`${fixtureUrl}?view=catalogue`, { waitUntil: "networkidle" });
  const a = page.getByTestId("acquisition-form-row").filter({ hasText: "A 現有登記表" });
  const b = page.getByTestId("acquisition-form-row").filter({ hasText: "B 現有登記表" });
  await expect(a).toContainText("最近登記：暫未能確認");
  await expect(a).not.toContainText("未有紀錄");
  await expect(b).toContainText("最近登記：未有紀錄");
  await expect(b).toContainText("有同步記錄需要處理");
  await expect(page.getByText(/已連接|已安裝|同步成功/)).toHaveCount(0);
  await a.locator("summary").filter({ hasText: "更多" }).click();
  const duplicate = a.locator("form").filter({ has: page.getByRole("button", { name: "複製成新表格", exact: true }) });
  await expect(duplicate.locator('input[name="expectedRevision"]')).toHaveValue("1");
  expect(await duplicate.locator('input[name="requestId"]').inputValue()).toMatch(uuid);
  await page.goto(`${fixtureUrl}?view=catalogue&tab=pages&unavailable=1`);
  await expect(page.getByRole("alert")).toContainText("暫時未能讀取廣告頁");
  await expect(page.getByText("未有符合條件的廣告頁", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("landing-page-list")).toHaveCount(0);
});

test("both managed preview routes require normal internal authentication", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  for (const path of [`/forms/${fixtureIds.activeFormA}/preview`, "/landing-pages/a6000000-0000-4000-8000-000000000001/preview?version=3&revision=1"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await expect(page.getByTestId("login-screen")).toBeVisible();
    await expect(page.getByText("尚未發布的草稿標題", { exact: true })).toHaveCount(0);
  }
  await context.close();
});
