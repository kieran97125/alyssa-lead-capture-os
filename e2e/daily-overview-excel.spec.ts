import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { buildDailyOverviewExcelWorkbook } from "../src/lib/marketing/dailyOverviewExcel";
import { deriveDailyMetrics } from "../src/lib/marketing/dailyOverviewMath";
import { emptySpendTypeAmounts } from "../src/lib/marketing/spendTypes";
import type { DailyOverviewBrandRow } from "../src/lib/marketing/dailyOverview";

function fixtureBrand(): DailyOverviewBrandRow {
  const spendByType = emptySpendTypeAmounts();
  spendByType.meta_whatsapp = 40;
  spendByType.meta_lead_form = 60;
  spendByType.meta_website_form = 30;
  spendByType.google_ads = 20;
  const daily = deriveDailyMetrics({
    spend: 150,
    leads: 5,
    bookings: 2,
    shows: 1,
  });
  return {
    id: "gos-brand",
    name: "GOS Beauty",
    slug: "gos-beauty",
    color: "#e79245",
    secondaryColor: "#fff4e8",
    leadTarget: 120,
    bookingTarget: 40,
    showTarget: 20,
    cells: [
      {
        date: "2026-08-01",
        day: 1,
        weekday: "週六",
        daily,
        cumulative: daily,
        spendByType: {
          daily: { ...spendByType },
          cumulative: { ...spendByType },
        },
        targetPace: { leads: 4, bookings: 2, shows: 1 },
        leadTargetAttainment: 1.25,
        bookingTargetAttainment: 1,
        showTargetAttainment: 1,
      },
    ],
    total: daily,
    spendCoverageDays: 1,
    expectedSpendDays: 1,
    funnelSourceStatus: "connected",
    latestFunnelSyncAt: "2026-08-02T01:00:00.000Z",
    warnings: [],
  };
}

test("Daily Overview Excel keeps the dashboard metric contract", () => {
  const brand = fixtureBrand();
  const workbook = buildDailyOverviewExcelWorkbook({
    monthStart: "2026-08-01",
    monthLabel: "2026年8月",
    throughDate: "2026-08-01",
    selectedBrandScope: "gos-beauty",
    reportBrands: [brand],
    allBrands: brand,
  });

  expect(workbook.filename).toBe(
    "Alyssa_Daily_Overview_2026-08_GOS_Beauty.xls"
  );
  expect(workbook.body).toContain('progid="Excel.Sheet"');
  expect(workbook.body).toContain('ss:Name="每日數據"');
  expect(workbook.body).toContain('ss:Name="月份摘要"');
  expect(workbook.body).toContain("Meta · WhatsApp");
  expect(workbook.body).toContain("Meta · Lead Form");
  expect(workbook.body).toContain("Meta · Website Form");
  expect(workbook.body).toContain("Google Ads");
  expect(workbook.body).toContain("GOS Beauty");
  expect(workbook.body).toContain("CPA · Book");
  expect(workbook.body).toContain("累計 CPA · Show");
  expect(workbook.body).toContain(">150<");
  expect(workbook.body).toContain(">5<");
  expect(workbook.body).toContain(">2<");
  expect(workbook.body).toContain(">1<");
});

test("Daily Overview exposes a working Excel download for the active filters", async ({
  page,
}) => {
  await page.goto("/performance/daily?month=2026-08-01");
  const exportButton = page.getByTestId("daily-overview-excel-export");
  await expect(exportButton).toBeVisible();
  await expect(exportButton).toHaveAttribute(
    "formaction",
    "/api/internal/reports/daily-overview/export"
  );

  const downloadPromise = page.waitForEvent("download");
  await exportButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(
    /^Alyssa_Daily_Overview_2026-08_.*\.xls$/
  );
  const path = await download.path();
  expect(path).not.toBeNull();
  const body = await readFile(path as string, "utf8");
  expect(body).toContain('progid="Excel.Sheet"');
  expect(body).toContain('ss:Name="每日數據"');
  expect(body).toContain('ss:Name="月份摘要"');
});
