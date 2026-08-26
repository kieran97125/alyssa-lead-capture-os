import { expect, test } from "@playwright/test";
import {
  buildSourcePerformanceGroups,
  classifyFunnelSpendType,
} from "../src/lib/marketing/sourcePerformanceMath";

test("canonical Source classifier prefers explicit evidence over campaign naming", () => {
  expect(
    classifyFunnelSpendType({
      sourceLabel: "Meta Lead Form / Facebook",
      campaignLabel: "GOS_Website_completed registration_脫毛_@150",
    })
  ).toBe("meta_lead_form");
  expect(
    classifyFunnelSpendType({
      sourceLabel: "WhatsApp 廣告",
      campaignLabel: "CTWA / 手動新增",
    })
  ).toBe("meta_whatsapp");
  expect(
    classifyFunnelSpendType({
      sourceLabel: "meta / paid_social",
      campaignLabel: "DEP Conversion website",
    })
  ).toBe("meta_website_form");
  expect(
    classifyFunnelSpendType({
      sourceLabel: "Google Ads",
      campaignLabel: "Google Search Brand",
    })
  ).toBe("google_ads");
  expect(
    classifyFunnelSpendType({
      sourceLabel: "直接 / 無追蹤",
      campaignLabel: "未標記 Campaign",
    })
  ).toBe("legacy_unclassified");
});

test("Source Performance aggregates numerators before CPL and CPA", () => {
  const groups = buildSourcePerformanceGroups({
    brands: [{ id: "gos", name: "GOS Beauty", color: "#e79245" }],
    spendFacts: [
      { brandId: "gos", date: "2026-08-01", spendType: "meta_whatsapp", amount: 300 },
      { brandId: "gos", date: "2026-08-02", spendType: "meta_whatsapp", amount: 200 },
      { brandId: "gos", date: "2026-08-01", spendType: "meta_lead_form", amount: 500 },
    ],
    metricFacts: [
      {
        brandId: "gos",
        metricDate: "2026-08-01",
        metricKind: "lead",
        sourceLabel: "WhatsApp 廣告",
        campaignLabel: "CTWA",
        count: 5,
      },
      {
        brandId: "gos",
        metricDate: "2026-08-02",
        metricKind: "lead",
        sourceLabel: "WhatsApp 廣告",
        campaignLabel: "CTWA",
        count: 5,
      },
      {
        brandId: "gos",
        metricDate: "2026-08-01",
        metricKind: "book",
        sourceLabel: "WhatsApp 廣告",
        campaignLabel: "CTWA",
        count: 2,
      },
      {
        brandId: "gos",
        metricDate: "2026-08-01",
        metricKind: "show",
        sourceLabel: "WhatsApp 廣告",
        campaignLabel: "CTWA",
        count: 1,
      },
      {
        brandId: "gos",
        metricDate: "2026-08-01",
        metricKind: "lead",
        sourceLabel: "Facebook Lead Form",
        campaignLabel: "Lead-form",
        count: 20,
      },
    ],
  });

  const whatsapp = groups.overall.rows.find((row) => row.sourceKey === "meta_whatsapp");
  const leadForm = groups.overall.rows.find((row) => row.sourceKey === "meta_lead_form");
  expect(whatsapp?.metrics.spend).toBe(500);
  expect(whatsapp?.metrics.leads).toBe(10);
  expect(whatsapp?.metrics.cpl).toBe(50);
  expect(whatsapp?.metrics.costPerBooking).toBe(250);
  expect(whatsapp?.metrics.costPerShow).toBe(500);
  expect(whatsapp?.metrics.spendShare).toBe(0.5);
  expect(leadForm?.metrics.spendShare).toBe(0.5);
});

test("Dashboard and period comparison expose Source efficiency analysis", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByTestId("source-performance-panel")).toBeVisible();
  await expect(page.getByText("廣告費分佈與 Source 效率")).toBeVisible();
  await expect(page.getByText("CPBook", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("CPShow", { exact: true }).first()).toBeVisible();

  await page.goto("/performance/compare?months=2");
  await expect(page.getByTestId("source-comparison-panel")).toBeVisible();
  await expect(page.getByTestId("brand-source-comparison-table")).toBeVisible();
  await expect(page.getByText("Source 預算分佈與效率對比")).toBeVisible();
  await expect(page.getByText("各品牌 × Source", { exact: true })).toBeVisible();
  await expect(page.getByText("Spend Δ", { exact: true })).toBeVisible();
  await expect(page.getByText("CPShow Δ", { exact: true }).first()).toBeVisible();
});

test("Daily Overview supports both brand-first and source-first Spend entry", async ({ page }) => {
  await page.goto("/performance/daily?month=2026-08-01");

  const modeSwitch = page.getByTestId("daily-spend-entry-mode-switch");
  await expect(modeSwitch).toBeVisible();
  await expect(modeSwitch.getByRole("link", { name: "按品牌", exact: true })).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(modeSwitch.getByRole("link", { name: "按 Source", exact: true })).toBeVisible();

  const brandEditor = page.getByTestId("daily-brand-spend-editor");
  await expect(brandEditor).toBeVisible();
  await expect(brandEditor.getByText("按品牌一次過填晒每日廣告費")).toBeVisible();
  await expect(
    brandEditor
      .locator('[data-spend-source="meta_whatsapp"]')
      .getByText("Meta · WhatsApp", { exact: true })
  ).toBeVisible();
  await expect(
    brandEditor
      .locator('[data-spend-source="meta_lead_form"]')
      .getByText("Meta · Lead Form", { exact: true })
  ).toBeVisible();
  await expect(
    brandEditor
      .locator('[data-spend-source="meta_website_form"]')
      .getByText("Meta · Website Form", { exact: true })
  ).toBeVisible();
  await expect(
    brandEditor
      .locator('[data-spend-source="google_ads"]')
      .getByText("Google Ads", { exact: true })
  ).toBeVisible();
  await expect(brandEditor.locator('select[name="entry_brand"]')).toBeVisible();
  await expect(brandEditor.locator('input[name="amount:meta_whatsapp"]')).toBeVisible();
  await expect(brandEditor.locator('input[name="amount:meta_lead_form"]')).toBeVisible();
  await expect(brandEditor.locator('input[name="amount:meta_website_form"]')).toBeVisible();
  await expect(brandEditor.locator('input[name="amount:google_ads"]')).toBeVisible();
  await expect(page.getByTestId("daily-source-spend-editor")).toHaveCount(0);

  await modeSwitch.getByRole("link", { name: "按 Source", exact: true }).click();
  await expect(page).toHaveURL(/entry_mode=source/);

  const sourceEditor = page.getByTestId("daily-source-spend-editor");
  await expect(sourceEditor).toBeVisible();
  await expect(sourceEditor.getByText("按 Source 一次過填晒各品牌廣告費")).toBeVisible();
  await expect(page.getByTestId("daily-brand-spend-editor")).toHaveCount(0);
  await expect(
    page
      .getByTestId("daily-spend-entry-mode-switch")
      .getByRole("link", { name: "按 Source", exact: true })
  ).toHaveAttribute("aria-current", "page");

  const sourceSelect = sourceEditor.getByLabel("Source");
  await expect(sourceSelect).toHaveValue("meta_whatsapp");
  await expect(sourceSelect.locator("option")).toHaveText([
    "Meta · WhatsApp",
    "Meta · Lead Form",
    "Meta · Website Form",
    "Google Ads",
  ]);
  await expect(sourceEditor.locator('input[name^="amount:"]')).toHaveCount(4);

  await sourceSelect.selectOption("meta_lead_form");
  await sourceEditor.getByRole("button", { name: "載入 Source" }).click();
  await expect(page).toHaveURL(/entry_mode=source/);
  await expect(page).toHaveURL(/spend_type=meta_lead_form/);
  await expect(page.getByTestId("daily-source-spend-editor").getByLabel("Source")).toHaveValue(
    "meta_lead_form"
  );
});
