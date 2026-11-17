import { expect, test } from "@playwright/test";
import { resolveBrandPixelId } from "../src/lib/metaPixel/configuration";

test("new brands never inherit another brand's global Pixel fallback", () => {
  expect(
    resolveBrandPixelId({
      brandSlug: "gos-beauty",
      configuredPixelId: null,
      legacyPixelId: "999999999999999",
    })
  ).toBe("");
});

test("Marketing OS keeps grouped navigation and settings overview compact", async ({
  page,
}) => {
  await page.goto("/settings", { waitUntil: "domcontentloaded" });

  const primaryNavLinks = page
    .getByRole("navigation", { name: "主要功能" })
    .getByRole("link");
  await expect(primaryNavLinks).toHaveCount(14);
  const navigation = page.getByRole("navigation", { name: "主要功能" });
  await expect(navigation.getByRole("link", { name: "表格及廣告頁", exact: true })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Lead 變更監察", exact: true })).toHaveCount(0);
  await expect(
    page
      .getByRole("navigation", { name: "主要功能" })
      .getByRole("link", { name: "設計工作" })
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "主要功能" })
      .getByRole("link", { name: "每日總覽" })
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "主要功能" })
      .getByRole("link", { name: "同期對比" })
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "主要功能" })
      .getByRole("link", { name: "報告生成" })
  ).toBeVisible();
  await expect(page.getByLabel("管理品牌")).toBeVisible();
  await expect(page.getByLabel("Meta Pixel ID")).toBeHidden();
  await expect(page.getByRole("navigation", { name: "品牌設定", exact: true })).toHaveCount(0);
  await page.locator("summary").filter({ hasText: "追蹤設定 · Meta Pixel" }).click();
  await expect(page.getByLabel("Meta Pixel ID")).toBeVisible();
  await expect(page.getByLabel("嵌入表格發送 PageView")).toBeVisible();
  await expect(
    page.getByTestId("settings-management-list").locator("a")
  ).toHaveCount(8);
  await expect(page.getByRole("link", { name: /System Audit/ })).toBeHidden();
});

test("treatments, classification rules and pricing use expandable system management rows", async ({
  page,
}) => {
  await page.goto("/settings/treatments", {
    waitUntil: "domcontentloaded",
  });

  const treatmentRows = page
    .getByTestId("treatment-management-list")
    .locator(":scope > details");
  await expect(treatmentRows.first()).toBeVisible();
  await expect(
    treatmentRows.first().locator(":scope > summary")
  ).toContainText("編輯");

  await expect(page.getByTestId("treatment-mapping-manager")).toBeVisible();
  await expect(page.getByRole("button", { name: "重新套用分類" })).toBeHidden();
  await page.getByTestId("treatment-mapping-manager").locator(":scope > details > summary").click();
  await expect(page.getByTestId("treatment-mapping-manager")).toHaveAttribute("data-mapping-authority", "system");
  await expect(page.getByText(/Google Sheet.*歷史參考/)).toBeVisible();
  await expect(page.getByRole("button", { name: "重新套用分類" })).toBeVisible();
  const mappingRows = page
    .getByTestId("treatment-mapping-rule-list")
    .locator(":scope > details");
  if ((await mappingRows.count()) > 0) {
    await expect(mappingRows.first().locator(":scope > summary")).toContainText("編輯");
  }

  await page.goto("/settings/packages", {
    waitUntil: "domcontentloaded",
  });
  const packageRows = page
    .getByTestId("package-management-list")
    .locator(":scope > details");
  await expect(packageRows.first()).toBeVisible();
  await expect(
    packageRows.first().locator(":scope > summary")
  ).toContainText("編輯");
});

test("form rows expose one primary action and keep utilities under More", async ({
  page,
}) => {
  await page.goto("/forms?archive=all", { waitUntil: "domcontentloaded" });

  const firstRow = page
    .getByTestId("form-management-list")
    .getByTestId("acquisition-form-row")
    .first();
  const manage = firstRow.getByRole("button", { name: "管理", exact: true });
  await expect(manage).toBeVisible();
  await expect(firstRow.getByText("更多", { exact: true })).toBeVisible();
  await expect(firstRow.getByRole("link", { name: "查看登記", exact: true })).toBeHidden();
  await expect(firstRow.getByRole("button", { name: "複製成新表格", exact: true })).toBeHidden();
  await expect(firstRow.getByTestId("form-public-token")).toHaveCount(0);
  await firstRow.locator("summary").filter({ hasText: "更多" }).click();
  await expect(firstRow.getByRole("link", { name: "查看登記", exact: true })).toBeVisible();
  await expect(firstRow.getByRole("button", { name: "複製成新表格", exact: true })).toBeVisible();
  await manage.click();
  await expect(page.getByTestId("form-settings-card")).toBeVisible();
  const setup = page.getByTestId("wix-setup-panel");
  await expect(setup.getByRole("button", { name: "複製表格安裝碼", exact: true })).toBeVisible();
  await expect(setup.getByLabel("表格安裝碼", { exact: true })).toBeHidden();
  const technical = page.locator("details").filter({ hasText: "技術資料" });
  await expect(technical.getByText("表格識別碼", { exact: true })).toBeHidden();
  await technical.locator(":scope > summary").click();
  await expect(technical.getByText("表格識別碼", { exact: true })).toBeVisible();
  await expect(technical.getByRole("button", { name: "複製識別碼", exact: true })).toBeVisible();
  await expect(technical.locator("dd").first()).not.toBeEmpty();
});

test("source setup stays optional and retains canonical dataset and mapping values", async ({ page }) => {
  await page.goto("/data-sources", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "正式資料來源", exact: true })).toBeVisible();
  const setup = page.locator("details").filter({ has: page.locator("#add-source") });
  await expect(setup.locator(":scope > summary")).toBeVisible();
  await expect(setup.getByRole("button", { name: "建立 Draft", exact: true })).toBeHidden();
  await setup.locator(":scope > summary").click();
  await expect(setup.getByRole("button", { name: "建立 Draft", exact: true })).toBeVisible();
  await expect(setup.locator('input[name="dataset"]')).toHaveValue("lead_funnel");
  await expect(setup.locator('select[name="dataset"]')).toHaveCount(0);
  await setup.locator("summary").filter({ hasText: "進階欄位 Mapping" }).click();
  await expect(setup.getByLabel("最多讀取行數")).toHaveValue("5000");
  await expect(setup.getByLabel("Lead 表最後欄")).toHaveValue("V");
});
