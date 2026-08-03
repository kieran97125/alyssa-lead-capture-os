import { expect, test } from "@playwright/test";
import {
  budgetPaceStatus,
  expectedAtPace,
  getHkMonthContext,
  kpiPaceStatus,
} from "../src/lib/marketing/pacing";
import {
  aggregateDailySpendRows,
  aggregateLeadSheetPerformance,
  aggregateLeadFunnelColumns,
  normalizeLeadSheetStatus,
  parseGoogleSheetDate,
  resolveLeadSheetColumns,
} from "../src/lib/marketing/googleSheetsMetricParser";
import {
  isMetricFromActiveReportingVersion,
  matchReportingWorkbookTabs,
  normalizeReportingMonth,
  parseGoogleSpreadsheetId,
  resolveMonthlyOverviewColumns,
  shouldSyncReportingSource,
  validateReportingMonthDates,
} from "../src/lib/marketing/monthlyReportingWorkbooks";
import {
  aggregateComparisonRows,
  buildCumulativeComparisonTrend,
  calculateComparisonKpis,
  createComparisonPeriods,
  relativeComparisonChange,
} from "../src/lib/marketing/periodComparisonMath";
import {
  EDITABLE_SPEND_TYPES,
  isEditableSpendType,
  normalizeEditableSpendType,
} from "../src/lib/marketing/spendTypes";
import { deriveDailyMetrics } from "../src/lib/marketing/dailyOverviewMath";
import {
  createSignedAdminSession,
  hasAdminPasswordGateConfig,
  verifyAdminPassword,
  verifySignedAdminSession,
} from "../src/lib/security/internalAccess";
import {
  getWorkspaceRoleDefaultModules,
  hasWorkspaceBrandPermission,
  hasWorkspaceModulePermission,
  normalizeWorkspaceRole,
} from "../src/lib/security/workspacePermissions";
import { safeInternalNextPath } from "../src/lib/supabase/authConfig";

test("invite-only permissions honour explicit modules and brand scope", () => {
  const access = {
    isMaster: false,
    workspaceRole: normalizeWorkspaceRole("cs"),
    modulePermissions: {
      dashboard: true,
      crm: true,
      settings: false,
    },
  };

  expect(hasWorkspaceModulePermission(access, "crm")).toBe(true);
  expect(hasWorkspaceModulePermission(access, "settings")).toBe(false);
  expect(hasWorkspaceModulePermission(access, "calendar")).toBe(false);
  expect(
    hasWorkspaceBrandPermission(
      { isMaster: false, brandIds: ["ib-brand"] },
      "ib-brand"
    )
  ).toBe(true);
  expect(
    hasWorkspaceBrandPermission(
      { isMaster: false, brandIds: ["ib-brand"] },
      "alyssa-brand"
    )
  ).toBe(false);
  expect(getWorkspaceRoleDefaultModules("cs")).toEqual([
    "dashboard",
    "calendar",
    "leads",
    "crm",
  ]);
});

test("email login only redirects to safe internal paths", () => {
  expect(safeInternalNextPath("/crm?tab=leads")).toBe("/crm?tab=leads");
  expect(safeInternalNextPath("//malicious.example")).toBe("/dashboard");
  expect(safeInternalNextPath("https://malicious.example")).toBe("/dashboard");
  expect(safeInternalNextPath("/auth/confirm")).toBe("/dashboard");
});

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

test("daily Spend input requires one explicit platform and acquisition type", () => {
  expect(EDITABLE_SPEND_TYPES).toEqual([
    "meta_whatsapp",
    "meta_lead_form",
    "meta_website_form",
    "google_ads",
  ]);
  expect(isEditableSpendType("legacy_unclassified")).toBe(false);
  expect(normalizeEditableSpendType("meta_lead_form")).toBe(
    "meta_lead_form"
  );
  expect(normalizeEditableSpendType("unknown")).toBe("meta_whatsapp");
  expect(
    deriveDailyMetrics({
      spend: 100 + 200 + 300 + 400,
      leads: 20,
      bookings: 10,
      shows: 5,
    })
  ).toMatchObject({
    spend: 1000,
    cpl: 50,
    costPerBooking: 100,
    costPerShow: 200,
  });
});

test("budget and KPI warnings only activate for configured targets", () => {
  expect(budgetPaceStatus(0, 0, 0, 27)).toBe("unconfigured");
  expect(budgetPaceStatus(125, 310, 100, 10)).toBe("critical");
  expect(budgetPaceStatus(55, 310, 100, 10)).toBe("under");
  expect(kpiPaceStatus(0, 0, 0)).toBe("unconfigured");
  expect(kpiPaceStatus(89, 100, 90)).toBe("watch");
  expect(kpiPaceStatus(60, 100, 90)).toBe("behind");
});

test("legacy Google Sheets Spend parser stays deterministic for the one-time cutover", () => {
  expect(parseGoogleSheetDate(46204)).toBe("2026-07-01");
  expect(parseGoogleSheetDate(0)).toBeNull();
  expect(parseGoogleSheetDate(1)).toBeNull();
  expect(parseGoogleSheetDate("2026-02-31")).toBeNull();
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

test("monthly workbook links, headers and reporting dates are validated before registration", () => {
  const spreadsheetId = "1HqOt0TYM8dtOpb5RgChTIeFt4hqX_SBirPz29NMAbFE";
  expect(
    parseGoogleSpreadsheetId(
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit?gid=29793010#gid=29793010`
    )
  ).toBe(spreadsheetId);
  expect(
    parseGoogleSpreadsheetId(
      `https://docs.google.com.evil.test/spreadsheets/d/${spreadsheetId}/edit`
    )
  ).toBeNull();
  expect(normalizeReportingMonth("2026-08")).toBe("2026-08-01");
  expect(normalizeReportingMonth("2026-13")).toBeNull();

  const headers = [
    "Date",
    "weekday",
    "display date",
    "查詢#",
    "預約#",
    "BR",
    "到店#",
    "試做價#",
    "開單#",
    "實收金額#",
    "人均實收#",
    "廣告費meta$",
    "廣告費google$",
    "累計廣告費$",
  ];
  expect(resolveMonthlyOverviewColumns(headers)).toMatchObject({
    dateColumn: "A",
    spendColumn: "N",
    valid: true,
  });
  expect(
    validateReportingMonthDates({
      values: [46235, 46236, ""],
      reportingMonth: "2026-08-01",
      parseDate: parseGoogleSheetDate,
    })
  ).toMatchObject({ valid: true, matchingDateCount: 2 });
  expect(
    validateReportingMonthDates({
      values: [46204, 46235],
      reportingMonth: "2026-08-01",
      parseDate: parseGoogleSheetDate,
    })
  ).toMatchObject({ valid: false, matchingDateCount: 1 });
});

test("monthly workbook tabs map all four formal system brands", () => {
  const sheets = ["Alyssa", "IB", "GOS", "AM"].map((title, index) => ({
    sheetId: index + 1,
    title,
    hidden: false,
    rowCount: 100,
    columnCount: 66,
  }));
  const result = matchReportingWorkbookTabs({
    brands: [
      { id: "alyssa", name: "Alyssa", slug: "alyssa" },
      { id: "ib", name: "Ineffable Beauty", slug: "ineffable-beauty" },
      { id: "gos", name: "GOS Beauty", slug: "gos-beauty" },
      { id: "am", name: "AM", slug: "am" },
    ],
    sheets,
  });

  expect(result.mappings.map((mapping) => mapping.tabName)).toEqual([
    "Alyssa",
    "IB",
    "GOS",
    "AM",
  ]);
  expect(result.unmatchedTabs).toHaveLength(0);
  expect(result.unmatchedBrands).toHaveLength(0);
  expect(result.ambiguousBrands).toHaveLength(0);
});

test("period comparison clamps the same day window and calculates auditable CPL and CPA", () => {
  const periods = createComparisonPeriods({
    anchorMonth: "2026-08",
    monthCount: 3,
    startDay: 1,
    endDay: 31,
  });

  expect(periods).toEqual([
    expect.objectContaining({
      monthStart: "2026-08-01",
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      expectedDays: 31,
    }),
    expect.objectContaining({
      monthStart: "2026-07-01",
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      expectedDays: 31,
    }),
    expect.objectContaining({
      monthStart: "2026-06-01",
      startDate: "2026-06-01",
      endDate: "2026-06-30",
      expectedDays: 30,
    }),
  ]);

  expect(
    calculateComparisonKpis({
      spend: 1_200,
      leads: 60,
      bookings: 20,
      shows: 10,
    })
  ).toEqual({
    spend: 1_200,
    leads: 60,
    bookings: 20,
    shows: 10,
    cpl: 20,
    costPerBooking: 60,
    costPerShow: 120,
    leadToBookRate: 1 / 3,
    bookToShowRate: 0.5,
    leadToShowRate: 1 / 6,
  });
  expect(
    calculateComparisonKpis({ spend: 100, leads: 0, bookings: 0, shows: 0 })
  ).toMatchObject({
    cpl: null,
    costPerBooking: null,
    costPerShow: null,
    leadToBookRate: null,
    bookToShowRate: null,
    leadToShowRate: null,
  });
  expect(relativeComparisonChange(120, 100)).toBeCloseTo(0.2);
  expect(relativeComparisonChange(100, 0)).toBeNull();
});

test("period comparison aggregates numerators before rates and builds cumulative pace", () => {
  const rows = [
    {
      brandId: "alyssa",
      metricDate: "2026-08-01",
      spend: 100,
      leads: 10,
      bookings: 4,
      shows: 2,
    },
    {
      brandId: "am",
      metricDate: "2026-08-01",
      spend: 300,
      leads: 10,
      bookings: 6,
      shows: 3,
    },
    {
      brandId: "alyssa",
      metricDate: "2026-08-02",
      spend: 200,
      leads: 20,
      bookings: 10,
      shows: 5,
    },
  ];
  const totals = aggregateComparisonRows(rows);
  expect(totals).toMatchObject({
    spend: 600,
    leads: 40,
    bookings: 20,
    shows: 10,
    cpl: 15,
    costPerBooking: 30,
    costPerShow: 60,
  });

  const period = createComparisonPeriods({
    anchorMonth: "2026-08",
    monthCount: 2,
    startDay: 1,
    endDay: 2,
  })[0];
  const trend = buildCumulativeComparisonTrend({ period, rows });
  expect(trend).toHaveLength(2);
  expect(trend[0]).toMatchObject({ spend: 400, leads: 20, cpl: 20 });
  expect(trend[1]).toMatchObject({ spend: 600, leads: 40, cpl: 15 });
});

test("legacy workbook selection stays deterministic for cutover reconciliation", () => {
  expect(
    isMetricFromActiveReportingVersion({
      sourceReportingWorkbookId: null,
      workbookStatus: undefined,
      workbookReportingMonth: undefined,
      currentReportingMonth: "2026-08-01",
    })
  ).toBe(true);
  expect(
    isMetricFromActiveReportingVersion({
      sourceReportingWorkbookId: "august-old",
      workbookStatus: "superseded",
      workbookReportingMonth: "2026-08-01",
      currentReportingMonth: "2026-08-01",
    })
  ).toBe(false);
  expect(
    isMetricFromActiveReportingVersion({
      sourceReportingWorkbookId: "july-active",
      workbookStatus: "active",
      workbookReportingMonth: "2026-07-01",
      currentReportingMonth: "2026-08-01",
    })
  ).toBe(false);
  expect(
    isMetricFromActiveReportingVersion({
      sourceReportingWorkbookId: "august-active",
      workbookStatus: "active",
      workbookReportingMonth: "2026-08-01",
      currentReportingMonth: "2026-08-01",
    })
  ).toBe(true);
  expect(
    shouldSyncReportingSource({
      sourceReportingWorkbookId: null,
      activeCurrentWorkbookId: "august-active",
    })
  ).toBe(true);
  expect(
    shouldSyncReportingSource({
      sourceReportingWorkbookId: "july-active",
      activeCurrentWorkbookId: "august-active",
    })
  ).toBe(false);
});

test("Google Sheets funnel trims brand names and keeps Lead, Book and Show date ownership", () => {
  const metrics = aggregateLeadFunnelColumns({
    createdAtValues: [[46204.2], [46204.4], [46205.3], [46205.6]],
    followStatusValues: [["待跟進"], ["已預約"], ["已到店"], ["已預約"]],
    brandValues: [["Alyssa "], ["Ineffable Beauty"], ["Alyssa"], ["AM"]],
    confirmationDateValues: [[], [], [46206], []],
    brands: [
      { id: "alyssa-brand", name: "Alyssa", slug: "alyssa" },
      {
        id: "ib-brand",
        name: "Ineffable Beauty",
        slug: "ineffable-beauty",
      },
      { id: "am-brand", name: "AM", slug: "am" },
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
      {
        brandId: "am-brand",
        date: "2026-07-02",
        leads: 1,
        bookings: 1,
        shows: 0,
      },
    ])
  );
});

test("Lead Sheet treatment performance follows headers, event dates and anonymous dimensions", () => {
  const headers = [
    "品牌",
    "Campaign / 廣告",
    "Status",
    "Created At",
    "療程項目",
    "來源",
    "預約日期",
    "確認到店日期",
    "跟進狀態",
    "分店",
    "Show up",
    "客人姓名",
    "電話",
    "CS Remark",
  ];
  const columns = resolveLeadSheetColumns(headers);
  expect(columns.createdAt).toBe(3);
  expect(columns.treatment).toBe(4);
  expect(columns.confirmationDate).toBe(7);

  const result = aggregateLeadSheetPerformance({
    headers,
    rows: [
      [
        "Alyssa",
        "Facelift-yanyan-lead-form",
        "",
        46204.2,
        "$988 Facelift",
        "Facebook Lead Form",
        46210,
        "",
        "已預約",
        "尖沙咀",
        "",
        "私人姓名測試",
        "91234567",
        "唔應出現",
      ],
      [
        "Ineffable Beauty",
        "CTWA / 手動新增",
        "",
        46204.3,
        "$388 柔清舒敏針清",
        "WhatsApp 廣告",
        46205,
        "",
        "no show",
        "銅鑼灣",
        "",
        "另一姓名",
        "92345678",
        "敏感備註",
      ],
      [
        "Alyssa",
        "Facelift-yanyan-lead-form",
        "",
        46205.2,
        "$988 Facelift",
        "Facebook Lead Form",
        46206,
        46206,
        "已到店",
        "尖沙咀",
        "Show",
        "第三個姓名",
        "93456789",
        "跟進內容",
      ],
      [
        "未有品牌",
        "Unknown",
        "",
        46205.3,
        "其他",
        "未標記來源",
        "",
        "",
        "待跟進",
        "",
        "",
        "未知品牌客人",
        "94567890",
        "未知品牌備註",
      ],
    ],
    brands: [
      { id: "alyssa-brand", name: "Alyssa", slug: "alyssa" },
      {
        id: "ib-brand",
        name: "Ineffable Beauty",
        slug: "ineffable",
      },
    ],
    sourceBrandId: null,
    treatmentAliases: [
      {
        brand: "Ineffable Beauty",
        label: "$388 柔清舒敏護理",
        keywords: ["柔清", "針清"],
      },
    ],
    dailyThroughDate: "2026-07-27",
    activityThroughDate: "2026-07-27",
    pendingThroughDate: "2027-08-31",
  });

  expect(result.diagnostics).toMatchObject({
    sourceRows: 4,
    acceptedRows: 3,
    unknownBrandRows: 1,
    invalidCreatedDateRows: 0,
  });
  expect(result.metricFacts).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        brandId: "alyssa-brand",
        metricKind: "pending_show",
        metricDate: "2026-07-07",
        treatmentLabel: "$988 Facelift",
        count: 1,
      }),
      expect.objectContaining({
        brandId: "ib-brand",
        metricKind: "no_show",
        metricDate: "2026-07-02",
        treatmentLabel: "$388 柔清舒敏護理",
        count: 1,
      }),
      expect.objectContaining({
        brandId: "alyssa-brand",
        metricKind: "show",
        metricDate: "2026-07-03",
        count: 1,
      }),
    ])
  );
  const anonymousProjection = JSON.stringify(result.metricFacts);
  expect(anonymousProjection).not.toContain("私人姓名測試");
  expect(anonymousProjection).not.toContain("91234567");
  expect(anonymousProjection).not.toContain("唔應出現");
  expect(
    normalizeLeadSheetStatus({
      followStatus: "待跟進",
      status: "",
      showUp: "No Show",
    })
  ).toBe("no_show");
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
    page.getByRole("button", { name: "同步 CS Lead" })
  ).toBeVisible();
  await expect(page.getByText(/CS Lead 更新：/)).toBeVisible();
  const navigation = page.getByRole("navigation", { name: "主要功能" });
  await expect(navigation.getByRole("link")).toHaveCount(11);
  await expect(navigation.getByRole("link", { name: "CRM" })).toBeVisible();
  await expect(
    navigation.getByRole("link", { name: "資料來源" })
  ).toBeVisible();
  await expect(
    navigation.getByRole("link", { name: "療程成效" })
  ).toBeVisible();
  await expect(
    navigation.getByRole("link", { name: "每日 Overview" })
  ).toBeVisible();
  await expect(
    navigation.getByRole("link", { name: "同期對比" })
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
    ["/performance", "療程成效"],
    ["/performance/compare", "品牌同期對比"],
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

test("Master owns invitations and active member permissions from one page", async ({
  page,
}) => {
  await page.goto("/settings/team", { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", { name: "已啟用帳戶", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "待接受邀請", exact: true })
  ).toBeVisible();
  await expect(page.getByText("active.member@example.test")).toBeVisible();
  await expect(page.getByText("pending.member@example.test")).toBeVisible();

  const activeMember = page
    .locator(".member-card")
    .filter({ hasText: "active.member@example.test" });
  await expect(activeMember.getByText("已啟用", { exact: true })).toBeVisible();
  await expect(
    activeMember.getByRole("button", { name: "寄出新登入連結" })
  ).toBeVisible();
  await activeMember.getByText("更改權限", { exact: true }).click();
  await expect(
    activeMember.getByRole("button", { name: "儲存權限" })
  ).toBeVisible();
  await expect(activeMember.getByLabel("Workspace Role")).toHaveValue("cs");

  const pendingMember = page
    .locator(".member-card")
    .filter({ hasText: "pending.member@example.test" });
  await expect(
    pendingMember.getByRole("button", { name: "重發邀請" })
  ).toBeVisible();
});

test("login page cannot self-send an account email", async ({ page }) => {
  await page.goto("/logout");

  await expect(
    page.getByRole("heading", { name: "受邀帳戶登入" })
  ).toBeVisible();
  await expect(page.getByLabel("Company email")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "寄出登入連結" })
  ).toHaveCount(0);
  await expect(page.getByText(/安全登入連結只會由 Master/)).toBeVisible();
});

test("Treatment Performance is a Lead Sheet projection with explicit metric contracts", async ({
  page,
}) => {
  await page.goto("/performance", { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", { name: "療程成效", exact: true })
  ).toBeVisible();
  await expect(page.getByText("Alyssa Workspace Lead Funnel")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Lead → Book → Show" })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "療程表現" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "來源／Campaign 表現" })
  ).toBeVisible();
  await expect(page.getByText(/唔讀 mkt_dashboard 分頁/)).toBeVisible();
});

test("Period Comparison exposes same-window Spend, funnel, CPL and stage-specific CPA", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/performance/compare", { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", { name: "品牌同期對比", exact: true })
  ).toBeVisible();
  await expect(page.getByText("CPA · Book", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("CPA · Show", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("CPL", { exact: true }).first()).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "同期累積走勢", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "月份比較", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "品牌拆解", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "廣告費同期累積走勢", exact: true })
  ).toBeVisible();
  const showCostTrend = page.getByRole("button", {
    name: "CPA · Show",
    exact: true,
  });
  await showCostTrend.click();
  await expect(showCostTrend).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("img", {
      name: "每個 Show 成本同期累積走勢",
      exact: true,
    })
  ).toBeVisible();
  await expect(page.getByText(/同期營運比率/)).toBeVisible();
  await expect(page.getByText(/Daily Spend Ledger/)).toBeVisible();
  await expect(page.getByText(/Meta WhatsApp／Lead Form／Website Form、Google Ads/)).toBeVisible();
  await expect(page.getByText(/Alyssa、AM、IB、GOS/)).toBeVisible();
  await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test("Daily Overview records typed Meta Spend and shows daily plus cumulative KPIs", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/performance/daily", { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", { name: "每日 Overview", exact: true })
  ).toBeVisible();
  await expect(page.getByLabel("廣告費類型")).toHaveValue("meta_whatsapp");
  await expect(page.getByLabel("廣告費類型").locator("option")).toHaveText([
    "Meta · WhatsApp",
    "Meta · Lead Form",
    "Meta · Website Form",
    "Google Ads",
  ]);
  await expect(page.getByText("舊資料 · 未分類", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("總廣告費", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("CPL", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("CPA · Book", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("CPA · Show", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/CS Lead Sheet · Funnel/)).toBeVisible();
  await expect(page.getByText(/Internal Daily Spend · Spend/)).toBeVisible();

  await page.getByLabel("廣告費類型").selectOption("meta_lead_form");
  await page.getByRole("button", { name: "載入日期及類型" }).click();
  await expect(page).toHaveURL(/spend_type=meta_lead_form/);
  await expect(page.getByLabel(/Alyssa.*Meta · Lead Form 廣告費/)).toBeVisible();
  await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test("Google Sheets connection is presented as OAuth rather than a service-account key", async ({
  page,
}) => {
  await page.goto("/data-sources", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("Google Sheets 一鍵連接")).toBeVisible();
  await expect(
    page.getByText(
      /毋須 Service Account、JSON Key 或 Apps Script Web App|OAuth Client 部署設定未完成/
    )
  ).toBeVisible();
  await expect(page.getByText(/Service Account Email|Private Key/)).toHaveCount(0);
});

test("retired monthly Spend workbooks keep read-only historical links", async ({
  page,
}) => {
  await page.goto("/data-sources", { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", { name: "舊月份廣告費數據表", exact: true })
  ).toBeVisible();
  await expect(page.getByLabel("數據月份")).toHaveCount(0);
  await expect(page.getByLabel("Google Spreadsheet Link")).toHaveCount(0);
  await expect(page.getByText("August Overview_Alyssa_2026")).toBeVisible();
  await expect(page.getByText("July Overview_Alyssa_2026")).toBeVisible();
  await expect(
    page.getByRole("link", { name: /打開原始數據表/ })
  ).toHaveCount(2);
  await expect(page.getByText(/月份 Sheet 接駁已退役/)).toBeVisible();
  await expect(page.getByText(/廣告費改由系統 Daily Ledger/)).toBeVisible();
  await expect(page.getByRole("link", { name: "填寫每日廣告費" })).toBeVisible();
  await expect(page.getByText("系統帳簿", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /重新同步呢個月份/ })).toHaveCount(0);
});

test("incomplete Google OAuth setup names the blocker and every click returns feedback", async ({
  page,
}) => {
  await page.goto("/data-sources", { waitUntil: "domcontentloaded" });

  const missingConfiguration = page.getByTestId(
    "google-oauth-missing-configuration"
  );
  await expect(missingConfiguration).toBeVisible();
  await expect(
    missingConfiguration.getByText("Google OAuth Client ID")
  ).toBeVisible();

  await page.getByRole("button", { name: "檢查連接設定" }).click();
  await expect(page).toHaveURL(/command_status=error/);
  await expect(page.getByText(/Google OAuth 未可連接；尚欠：/)).toBeVisible();
});

test("password session is labelled as system access rather than a verified Google account", async ({
  page,
}) => {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("Master 系統身份")).toBeVisible();
  await expect(page.getByText("密碼權限 · 非 Google 帳戶")).toBeVisible();
  await expect(page.getByText("kieran.kwok@alyssa.hk")).toHaveCount(0);
});

test("protected Google Sheets POST uses a safe redirect and Master guidance renders", async ({
  page,
  context,
}) => {
  await page.goto("/logout");

  const response = await context.request.post(
    "/api/integrations/google-sheets/start",
    {
      data: "",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      maxRedirects: 0,
    }
  );
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
