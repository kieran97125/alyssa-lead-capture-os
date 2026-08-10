import { expect, test } from "@playwright/test";
import {
  ALYSSA_ALL_BRAND_SCOPE,
  brandIdsForScope,
  brandMatchesScope,
  brandScopeOptions,
  brandsForScope,
} from "../src/lib/marketing/brandScope";

const brands = [
  { id: "alyssa", name: "Alyssa", slug: "alyssa" },
  { id: "am", name: "AM", slug: "am" },
  { id: "ib", name: "Ineffable Beauty", slug: "ineffable" },
  { id: "gos", name: "GOS Beauty", slug: "gos-beauty" },
  { id: "future", name: "Future Studio", slug: "future-studio" },
];

test("Alyssa All always combines every permitted non-GOS brand", () => {
  expect(brandIdsForScope(brands, ALYSSA_ALL_BRAND_SCOPE)).toEqual([
    "alyssa",
    "am",
    "ib",
    "future",
  ]);
  expect(
    brandsForScope(
      brands.filter((brand) => ["ib", "gos"].includes(brand.id)),
      ALYSSA_ALL_BRAND_SCOPE
    ).map((brand) => brand.id)
  ).toEqual(["ib"]);
  expect(
    brandMatchesScope(
      { id: "future", name: "Future Studio", slug: "future-studio" },
      ALYSSA_ALL_BRAND_SCOPE
    )
  ).toBe(true);
  expect(
    brandMatchesScope(
      { id: "gos", name: "GOS Beauty", slug: "gos-beauty" },
      ALYSSA_ALL_BRAND_SCOPE
    )
  ).toBe(false);
  expect(brandScopeOptions(brands)[0]).toEqual({
    value: ALYSSA_ALL_BRAND_SCOPE,
    label: "Alyssa All",
  });
});

test("reporting pages render Alyssa All totals without GOS rows", async ({
  page,
}) => {
  await page.goto(`/dashboard?brandId=${ALYSSA_ALL_BRAND_SCOPE}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator('select[name="brandId"]')).toHaveValue(
    ALYSSA_ALL_BRAND_SCOPE
  );
  const dashboardBrands = page.getByRole("region", { name: "品牌總結" });
  await expect(dashboardBrands).toBeVisible();
  await expect(dashboardBrands.getByText("Alyssa", { exact: true })).toBeVisible();
  await expect(
    dashboardBrands.getByText("Ineffable Beauty", { exact: true })
  ).toBeVisible();
  await expect(
    dashboardBrands.getByText("GOS Beauty", { exact: true })
  ).toHaveCount(0);

  await page.goto(
    `/performance/compare?brand=${ALYSSA_ALL_BRAND_SCOPE}&anchor_month=2026-08`,
    { waitUntil: "domcontentloaded" }
  );
  await expect(page.locator('select[name="brand"]')).toHaveValue(
    ALYSSA_ALL_BRAND_SCOPE
  );
  await expect(page.getByText(/正比較：Alyssa All/)).toBeVisible();
  const comparisonBrands = page.getByRole("region", { name: "品牌拆解" });
  await expect(comparisonBrands).toBeVisible();
  await expect(
    comparisonBrands.getByText("GOS Beauty", { exact: true })
  ).toHaveCount(0);

  await page.goto(
    `/performance/daily?brand=${ALYSSA_ALL_BRAND_SCOPE}&month=2026-08`,
    { waitUntil: "domcontentloaded" }
  );
  await expect(page.locator('select[name="brand"]').first()).toHaveValue(
    ALYSSA_ALL_BRAND_SCOPE
  );
  const dailyBrands = page.getByRole("region", {
    name: "品牌每日及累計",
  });
  await expect(dailyBrands).toBeVisible();
  await expect(
    dailyBrands.getByLabel("Alyssa All 品牌色", { exact: true })
  ).toBeVisible();
  await expect(
    dailyBrands.getByText("GOS Beauty", { exact: true })
  ).toHaveCount(0);
});

test("operational data pages expose the same Alyssa All scope", async ({
  page,
}) => {
  await page.goto(`/leads?brand=${ALYSSA_ALL_BRAND_SCOPE}&range=all`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator('select[name="brand"]')).toHaveValue(
    ALYSSA_ALL_BRAND_SCOPE
  );
  await expect(
    page.locator('select[name="brand"] option').filter({ hasText: "Alyssa All" })
  ).toHaveCount(1);

  await page.goto(
    `/crm?tab=reports&range=all&brand=${ALYSSA_ALL_BRAND_SCOPE}`,
    { waitUntil: "domcontentloaded" }
  );
  await expect(page.locator('select[name="brand"]')).toHaveValue(
    ALYSSA_ALL_BRAND_SCOPE
  );
  await expect(page.getByRole("button", { name: "更新報表" })).toBeVisible();
});
