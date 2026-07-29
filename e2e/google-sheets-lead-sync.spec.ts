import { expect, test } from "@playwright/test";
import {
  alignLeadRowToDestinationHeaders,
  buildGoogleSheetsLeadPayload,
  GOOGLE_SHEETS_LEAD_HEADERS,
  GOOGLE_SHEETS_LEAD_SCHEMA_VERSION,
} from "../src/lib/integrations/googleSheetsLeadSync";

test("LaunchHub lead payload matches the live Google Sheet A:V contract", () => {
  const previousSecret = process.env.GOOGLE_SHEETS_WEBHOOK_SECRET;
  process.env.GOOGLE_SHEETS_WEBHOOK_SECRET = "test-secret";

  try {
    const payload = buildGoogleSheetsLeadPayload({
      brandId: "brand-test-123",
      leadKey: "lead-test-123",
      createdAt: "2026-07-29T03:25:51.000Z",
      customerName: "Kieran Test",
      phone: "85265871236",
      email: null,
      brandName: "Alyssa",
      formName: "Facelift-yanyan-lead-form",
      treatmentName: "Facelift",
      packageName: "$988 Facelift",
      price: 988,
      branchName: "旺角分店【朗豪坊】",
      appointmentDate: "2026-07-29",
      appointmentTime: "12:00",
      pageUrl: "https://example.com/facelift",
      touch: {},
    });

    expect(payload.schemaVersion).toBe(GOOGLE_SHEETS_LEAD_SCHEMA_VERSION);
    expect(payload.headers).toEqual(GOOGLE_SHEETS_LEAD_HEADERS);
    expect(payload.rowValues).toEqual([
      "2026/7/29 上午 11:25:51",
      "待跟進",
      "Alyssa",
      "旺角分店【朗豪坊】",
      "Kieran Test",
      "85265871236",
      "",
      "Facelift-yanyan-lead-form",
      "$988 Facelift",
      "2026-07-29",
      "12:00",
      "",
      "直接 / 無追蹤",
      "未標記廣告系列 / 未標記素材",
      "https://example.com/facelift",
      "",
      "lead-test-123",
      "",
      "",
      "",
      "",
      "",
    ]);
    expect(payload.rowValues).toHaveLength(GOOGLE_SHEETS_LEAD_HEADERS.length);
    expect(
      Object.fromEntries(
        GOOGLE_SHEETS_LEAD_HEADERS.map((header, index) => [
          header,
          payload.rowValues[index],
        ])
      )
    ).toMatchObject({
      品牌: "Alyssa",
      分店: "旺角分店【朗豪坊】",
      客人姓名: "Kieran Test",
      電話: "85265871236",
      Email: "",
      "療程 / 優惠": "Facelift-yanyan-lead-form",
      療程項目: "$988 Facelift",
      確認到店日期: "",
      來源: "直接 / 無追蹤",
      lead_key: "lead-test-123",
    });
    expect(payload).not.toHaveProperty("csOwner");
  } finally {
    if (previousSecret === undefined) {
      delete process.env.GOOGLE_SHEETS_WEBHOOK_SECRET;
    } else {
      process.env.GOOGLE_SHEETS_WEBHOOK_SECRET = previousSecret;
    }
  }
});

test("native Sheets writer follows destination headers instead of fixed columns", () => {
  const payload = buildGoogleSheetsLeadPayload({
    brandId: "brand-test-123",
    leadKey: "lead-test-456",
    createdAt: "2026-07-29T03:25:51.000Z",
    customerName: "Header Mapping Test",
    phone: "85200000000",
    email: "mapping@example.com",
    brandName: "Ineffable Beauty",
    formName: "DEP Lead Form",
    treatmentName: "DEP",
    packageName: "$588 DEP Combo",
    price: 588,
    branchName: "銅鑼灣",
    appointmentDate: "2026-08-20",
    appointmentTime: "12:00",
    pageUrl: "https://example.com/dep",
    touch: {},
  });
  const destinationHeaders = [
    "Created At",
    "自訂欄位",
    "電話",
    "品牌",
    "療程／優惠",
    "療程項目",
    "客人姓名",
    "分店",
    "預約日期",
    "預約時間",
    "來源",
    "跟進狀態",
    "lead_key",
  ];

  expect(
    alignLeadRowToDestinationHeaders(destinationHeaders, payload)
  ).toEqual([
    "2026/7/29 上午 11:25:51",
    "",
    "85200000000",
    "Ineffable Beauty",
    "DEP Lead Form",
    "$588 DEP Combo",
    "Header Mapping Test",
    "銅鑼灣",
    "2026-08-20",
    "12:00",
    "直接 / 無追蹤",
    "待跟進",
    "lead-test-456",
  ]);
});

test("native Sheets writer stops safely when an operational header is missing", () => {
  const payload = buildGoogleSheetsLeadPayload({
    brandId: "brand-test-123",
    leadKey: "lead-test-789",
    createdAt: "2026-07-29T03:25:51.000Z",
    customerName: "Missing Header Test",
    phone: "85200000000",
    email: null,
    brandName: "Alyssa",
    formName: "Lead Form",
    treatmentName: "Facelift",
    packageName: "$988 Facelift",
    price: 988,
    branchName: "旺角",
    appointmentDate: "2026-08-20",
    appointmentTime: "12:00",
    pageUrl: "https://example.com",
    touch: {},
  });
  const headersWithoutPhone = GOOGLE_SHEETS_LEAD_HEADERS.filter(
    (header) => header !== "電話"
  );

  expect(() =>
    alignLeadRowToDestinationHeaders([...headersWithoutPhone], payload)
  ).toThrow("Google Sheet 缺少必要 header：電話");
});
