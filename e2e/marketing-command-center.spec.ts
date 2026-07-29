import { expect, test } from "@playwright/test";
import {
  budgetPaceStatus,
  expectedAtPace,
  getHkMonthContext,
  kpiPaceStatus,
} from "../src/lib/marketing/pacing";
import {
  aggregateDailySpendRows,
  aggregateLeadFunnelColumns,
  parseGoogleSheetDate,
} from "../src/lib/marketing/googleSheetsMetricParser";
import {
  createSignedAdminSession,
  hasAdminPasswordGateConfig,
  verifyAdminPassword,
  verifySignedAdminSession,
} from "../src/lib/security/internalAccess";

test("Hong Kong month pacing uses completed days through yesterday", () => {
  const context = getHkMonthContext(
    new Date("2026-07-28T04:00:00.000Z")
  );

  expect(context.monthStart).toBe("2026-07-01");
  expect(context.today).toBe("2026-07-28");
  expect(context.throughDate).toBe("2026-07-27");
  expect(context.elapsedDays).toBe(27);
  expect(context.daysInMonth).toBe(31);
  expect(expectedAtPace(310, context.paceRatio)).toBe(270);
});

test("budget and KPI warnings only activate for configured targets", () => {
  expect(budgetPaceStatus(0, 0, 0, 27)).toBe("unconfigured");
  expect(budgetPaceStatus(125, 310, 100, 10)).toBe("critical");
  expect(budgetPaceStatus(55, 310, 100, 10)).toBe("under");
  expect(kpiPaceStatus(0, 0, 0)).toBe("unconfigured");
  expect(kpiPaceStatus(89, 100, 90)).toBe("watch");
  expect(kpiPaceStatus(60, 100, 90)).toBe("behind");
});

test("Google Sheets daily spend uses date column A and total spend column N", () => {
  expect(parseGoogleSheetDate(46204)).toBe("2026-07-01");
  const rows = [
    [46204, "", "", "", "", "", "", "", "", "", "", 100, 20, 120],
    [46205, "", "", "", "", "", "", "", "", "", "", 90, "", 90],
    [46231, "", "", "", "", "", "", "", "", "", "", 10, "", 10],
    ["", "Total", "", "", "", "", "", "", "", "", "", 200, 20, 220],
  ];
  expect(
    aggregateDailySpendRows({
      rows,
      brandId: "alyssa-brand",
      throughDate: "2026-07-27",
      dateIndex: 0,
      spendIndex: 13,
    })
  ).toEqual([
    {
      brandId: "alyssa-brand",
      date: "2026-07-01",
      spend: 120,
    },
    {
      brandId: "alyssa-brand",
      date: "2026-07-02",
      spend: 90,
    },
  ]);
});

test("Google Sheets funnel trims brand names and keeps Lead, Book and Show date ownership", () => {
  const metrics = aggregateLeadFunnelColumns({
    createdAtValues: [[46204.2], [46204.4], [46205.3]],
    followStatusValues: [["待跟進"], ["已預約"], ["已到店"]],
    brandValues: [["Alyssa "], ["Ineffable Beauty"], ["Alyssa"]],
    confirmationDateValues: [[], [], [46206]],
    brands: [
      { id: "alyssa-brand", name: "Alyssa", slug: "alyssa" },
      {
        id: "ib-brand",
        name: "Ineffable Beauty",
        slug: "ineffable-beauty",
      },
    ],
    sourceBrandId: null,
    throughDate: "2026-07-27",
  });

  expect(metrics).toEqual(
    expect.arrayContaining([
      {
        brandId: "alyssa-brand",
        date: "2026-07-01",
        leads: 1,
        bookings: 0,
        shows: 0,
      },
      {
        brandId: "ib-brand",
        date: "2026-07-01",
        leads: 1,
        bookings: 1,
        shows: 0,
      },
      {
        brandId: "alyssa-brand",
        date: "2026-07-02",
        leads: 1,
        bookings: 1,
        shows: 0,
      },
      {
        brandId: "alyssa-brand",
        date: "2026-07-03",
        leads: 0,
        bookings: 0,
        shows: 1,
      },
    ])
  );
});

test("temporary password gate signs distinct Admin and Master sessions", async () => {
  const previous = {
    admin: process.env.LAUNCHHUB_ADMIN_PASSWORD,
    master: process.env.LAUNCHHUB_MASTER_PASSWORD,
    secret: process.env.LAUNCHHUB_ADMIN_SESSION_SECRET,
  };
  process.env.LAUNCHHUB_ADMIN_PASSWORD = "test-admin-password";
  process.env.LAUNCHHUB_MASTER_PASSWORD = "test-master-password";
  process.env.LAUNCHHUB_ADMIN_SESSION_SECRET = "test-session-secret";

  try {
    expect(verifyAdminPassword("test-admin-password")).toBe("admin");
    expect(verifyAdminPassword("test-master-password")).toBe("master");
    expect(verifyAdminPassword("wrong")).toBeNull();
    delete process.env.LAUNCHHUB_ADMIN_PASSWORD;
    delete process.env.LAUNCHHUB_MASTER_PASSWORD;
    expect(hasAdminPasswordGateConfig()).toBe(true);

    const adminSession = await createSignedAdminSession("admin");
    expect(adminSession).not.toBeNull();
    const verifiedAdmin = await verifySignedAdminSession(adminSession);
    expect(verifiedAdmin.ok).toBe(true);
    expect(verifiedAdmin.accessLevel).toBe("admin");

    const masterSession = await createSignedAdminSession("master");
    expect(masterSession).not.toBeNull();
    const verifiedMaster = await verifySignedAdminSession(masterSession);
    expect(verifiedMaster.ok).toBe(true);
    expect(verifiedMaster.accessLevel).toBe("master");
  } finally {
    for (const [key, value] of [
      ["LAUNCHHUB_ADMIN_PASSWORD", previous.admin],
      ["LAUNCHHUB_MASTER_PASSWORD", previous.master],
      ["LAUNCHHUB_ADMIN_SESSION_SECRET", previous.secret],
    ] as const) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});

test("Command Center dashboard exposes budget, KPI and operational navigation", async ({
  page,
}) => {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", { name: "早晨，Kieran" })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "預算概覽" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "品牌 KPI 進度" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "重新整理數據" })
  ).toBeVisible();
  await expect(page.getByText(/最後更新：/)).toBeVisible();
  const navigation = page.getByRole("navigation", { name: "主要功能" });
  await expect(navigation.getByRole("link")).toHaveCount(9);
  await expect(navigation.getByRole("link", { name: "CRM" })).toBeVisible();
  await expect(
    navigation.getByRole("link", { name: "資料來源" })
  ).toBeVisible();
  await expect(page.getByTestId("login-screen")).toHaveCount(0);
});

test("Command Center feature pages render without migration-dependent crashes", async ({
  page,
}) => {
  for (const [path, heading] of [
    ["/kpis", "品牌 KPI 進度"],
    ["/calendar", "營銷日曆"],
    ["/data-sources", "資料來源"],
    ["/settings/planning", "月度 Budget／KPI 設定"],
    ["/settings/team", "成員及權限"],
  ]) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: heading, exact: true })
    ).toBeVisible();
    await expect(page.getByTestId("login-screen")).toHaveCount(0);
  }
});

test("Google Sheets connection is presented as OAuth rather than a service-account key", async ({
  page,
}) => {
  await page.goto("/data-sources", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("Google Sheets 一鍵連接")).toBeVisible();
  await expect(
    page.getByText(/毋須 Service Account 或 JSON Key|尚需完成一次 OAuth Client 部署設定/)
  ).toBeVisible();
  await expect(page.getByText(/Service Account Email|Private Key/)).toHaveCount(0);
});

test("protected Google Sheets POST uses a safe redirect and Master guidance renders", async ({
  page,
  context,
}) => {
  await page.goto("/logout");

  const response = await context.request.post("/data-sources", {
    data: "",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(303);
  const location = response.headers().location;
  expect(location).toMatch(/\/login\?next=%2Fdata-sources/);

  await page.goto(
    "/login?next=%2Fdata-sources&error=master_required"
  );
  await expect(page).toHaveURL(
    /\/login\?next=%2Fdata-sources&error=master_required/
  );
  await expect(
    page.getByText(/呢個頁面只限 Master Account/)
  ).toBeVisible();
});

test("mobile sidebar opens as a labelled navigation drawer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

  const menu = page.getByRole("button", { name: "開啟主選單" });
  await expect(menu).toBeVisible();
  await menu.click();
  await expect(page.getByRole("navigation", { name: "主要功能" })).toBeVisible();
  await expect(page.getByRole("link", { name: "營銷日曆" })).toBeVisible();
});
