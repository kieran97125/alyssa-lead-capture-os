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

test("Growth OS keeps grouped navigation and settings overview compact", async ({
  page,
}) => {
  await page.goto("/settings", { waitUntil: "domcontentloaded" });

  const primaryNavLinks = page
    .getByRole("navigation", { name: "主要功能" })
    .getByRole("link");
  await expect(primaryNavLinks).toHaveCount(13);
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
  await expect(page.getByLabel("Meta Pixel ID")).toBeVisible();
  await expect(
    page.getByTestId("settings-management-list").locator("a")
  ).toHaveCount(8);
  await expect(page.getByRole("link", { name: /System Audit/ })).toBeHidden();
});

test("treatments and pricing use expandable management rows instead of cards", async ({
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
    .locator("tbody tr")
    .first();
  await expect(firstRow.getByRole("link", { name: "編輯" })).toBeVisible();
  await expect(firstRow.getByText("更多", { exact: true })).toBeVisible();
  await expect(firstRow.getByRole("button", { name: "Copy Wix Embed" })).toBeHidden();
});
