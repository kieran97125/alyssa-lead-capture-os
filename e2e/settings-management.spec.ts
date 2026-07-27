import { expect, test } from "@playwright/test";
import { getBrandPixelId } from "../src/lib/data/brandOperations";

test("new brands never inherit another brand's global Pixel fallback", () => {
  const previousPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  process.env.NEXT_PUBLIC_META_PIXEL_ID = "999999999999999";

  try {
    expect(getBrandPixelId("gos-beauty", null)).toBe("");
  } finally {
    if (previousPixelId === undefined) {
      delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
    } else {
      process.env.NEXT_PUBLIC_META_PIXEL_ID = previousPixelId;
    }
  }
});

test("LaunchHub keeps the primary navigation and settings overview compact", async ({
  page,
}) => {
  await page.goto("/settings", { waitUntil: "domcontentloaded" });

  const primaryNavLinks = page.locator("header").first().locator("nav a");
  await expect(primaryNavLinks).toHaveCount(6);
  await expect(page.getByLabel("管理品牌")).toBeVisible();
  await expect(page.getByLabel("Meta Pixel ID")).toBeVisible();
  await expect(page.getByTestId("settings-management-list").locator("a")).toHaveCount(
    6
  );
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
  await expect(treatmentRows.first().locator("summary")).toContainText("編輯");

  await page.goto("/settings/packages", {
    waitUntil: "domcontentloaded",
  });
  const packageRows = page
    .getByTestId("package-management-list")
    .locator(":scope > details");
  await expect(packageRows.first()).toBeVisible();
  await expect(packageRows.first().locator("summary")).toContainText("編輯");
});

test("form rows expose one primary action and keep utilities under More", async ({
  page,
}) => {
  await page.goto("/forms", { waitUntil: "domcontentloaded" });

  const firstRow = page
    .getByTestId("form-management-list")
    .locator("tbody tr")
    .first();
  await expect(firstRow.getByRole("link", { name: "編輯" })).toBeVisible();
  await expect(firstRow.getByText("更多", { exact: true })).toBeVisible();
  await expect(firstRow.getByRole("button", { name: "Copy Wix Embed" })).toBeHidden();
});
