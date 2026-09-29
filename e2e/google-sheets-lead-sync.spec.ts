import { expect, test } from "@playwright/test";
import {
  alignLeadRowToDestinationHeaders,
  buildGoogleSheetsLeadPayload,
  buildGoogleSheetsLegacyWebhookPayload,
  GOOGLE_SHEETS_LEAD_HEADERS,
  GOOGLE_SHEETS_LEAD_V5_HEADERS,
  GOOGLE_SHEETS_LEAD_SCHEMA_VERSION,
} from "../src/lib/integrations/googleSheetsLeadSync";

test("LaunchHub lead payload matches the CS-first v6 A:Y contract", () => {
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
      "2026-07-29",
      "2026-07-29",
      "待跟進",
      "",
      "Alyssa",
      "2026-07-29",
      "12:00",
      "",
      "Kieran Test",
      "85265871236",
      "Facelift",
      "$988 Facelift",
      "旺角分店【朗豪坊】",
      "",
      "未標記廣告系列 / 未標記素材",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);
    expect(payload.rowValues).toHaveLength(25);
    expect(
      Object.fromEntries(
        GOOGLE_SHEETS_LEAD_HEADERS.map((header, index) => [
          header,
          payload.rowValues[index],
        ])
      )
    ).toMatchObject({
      最後更新日期: "2026-07-29",
      "Created At": "2026-07-29",
      品牌: "Alyssa",
      CS同事名: "",
      分店: "旺角分店【朗豪坊】",
      客人姓名: "Kieran Test",
      電話: "85265871236",
      Email: "",
      "療程 / 優惠": "Facelift",
      療程項目: "$988 Facelift",
      確認到店日期: "",
      Account: "",
    });
    expect(payload.csOwner).toBe("");
    expect(payload.schemaVersion).toBe("lead.v6");
    expect(payload.headers.slice(0, 14)).toEqual([
      "最後更新日期", "Created At", "跟進狀態", "CS同事名", "品牌", "預約日期", "預約時間",
      "確認到店日期", "客人姓名", "電話", "療程 / 優惠", "療程項目", "分店", "Email",
    ]);
    expect(payload.headers.slice(14)).toEqual(GOOGLE_SHEETS_LEAD_V5_HEADERS.slice(14));
  } finally {
    if (previousSecret === undefined) {
      delete process.env.GOOGLE_SHEETS_WEBHOOK_SECRET;
    } else {
      process.env.GOOGLE_SHEETS_WEBHOOK_SECRET = previousSecret;
    }
  }
});

test("native Sheets writer follows Account-first destination headers instead of fixed columns", () => {
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
    "CS同事名",
    "療程／優惠",
    "療程項目",
    "客人姓名",
    "分店",
    "預約日期",
    "預約時間",
    "Campaign / 廣告",
    "跟進狀態",
    "Account",
  ];

  expect(
    alignLeadRowToDestinationHeaders(destinationHeaders, payload)
  ).toEqual([
    "2026-07-29",
    "",
    "85200000000",
    "Ineffable Beauty",
    "",
    "DEP",
    "$588 DEP Combo",
    "Header Mapping Test",
    "銅鑼灣",
    "2026-08-20",
    "12:00",
    "未標記廣告系列 / 未標記素材",
    "待跟進",
    "",
  ]);
});

test("canonical treatment wins over a stale copied form name", () => {
  const payload = buildGoogleSheetsLeadPayload({
    brandId: "brand-alyssa-test",
    leadKey: "lead-slimcut-regression",
    createdAt: "2026-09-15T02:22:33.000Z",
    customerName: "Regression Test",
    phone: "85200000002",
    email: null,
    brandName: "Alyssa",
    formName: "Alyssa Facelift Wix Form",
    treatmentName: "SlimCut",
    packageName: "網上登記優惠",
    price: 780,
    branchName: "旺角",
    appointmentDate: "2026-09-23",
    appointmentTime: "19:30",
    pageUrl: "https://example.com/slimcut",
    touch: {},
  });

  expect(payload.treatmentOffer).toBe("SlimCut");
  expect(payload.treatmentItem).toBe("$780 網上登記優惠");
  expect(
    payload.rowValues[GOOGLE_SHEETS_LEAD_HEADERS.indexOf("療程 / 優惠")]
  ).toBe("SlimCut");
  expect(payload.treatmentOffer).not.toContain("Facelift");
});

test("native Sheets writer stops safely when a required operational header is missing", () => {
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

test("Account-first destination requires the Account header", () => {
  const payload = buildGoogleSheetsLeadPayload({
    brandId: "brand-test-123",
    leadKey: "lead-test-account",
    createdAt: "2026-07-29T03:25:51.000Z",
    customerName: "Account Header Test",
    phone: "85200000001",
    email: null,
    brandName: "Alyssa",
    formName: "Lead Form",
    treatmentName: "Facelift",
    packageName: "$988 Facelift",
    price: 988,
    branchName: "旺角",
    appointmentDate: null,
    appointmentTime: null,
    pageUrl: "https://example.com",
    touch: {},
  });
  const withoutAccount = GOOGLE_SHEETS_LEAD_HEADERS.filter(
    (header) => header !== "Account"
  );

  expect(() =>
    alignLeadRowToDestinationHeaders([...withoutAccount], payload)
  ).toThrow("Google Sheet 缺少必要 header：Account");
});

function migrationPayload() {
  const payload = buildGoogleSheetsLeadPayload({
    brandId: "synthetic-brand", leadKey: "synthetic-migration", createdAt: "2026-09-29T04:00:00Z",
    customerName: "Synthetic Name", phone: "10000001", email: "synthetic@example.com",
    brandName: "GOS Beauty", formName: "Synthetic Form", treatmentName: "Synthetic Offer",
    packageName: "Synthetic Treatment", price: 100, branchName: "Synthetic Branch",
    appointmentDate: "2026-10-01", appointmentTime: "15:30", pageUrl: "https://example.com", touch: {},
  });
  // Give every moved field and the unchanged tail a recognizable value.
  const values = {
    CS同事名: "Synthetic Owner", 確認到店日期: "2026-10-02", Account: "GOS Beauty",
    "IG/FB Username": "synthetic-user", "Day 1": "2026-09-30", "Day 2": "2026-10-01", Promotion: "Synthetic Promotion",
  };
  for (const [header, value] of Object.entries(values)) {
    payload.rowValues[payload.headers.indexOf(header as typeof payload.headers[number])] = value;
  }
  return payload;
}

test("v6 deployment appends correct values to actual v5 and v6 headers without rewriting either layout", () => {
  const payload = migrationPayload();
  const original = JSON.stringify(payload);
  const expected = Object.fromEntries(payload.headers.map((header, index) => [header, payload.rowValues[index]]));
  for (const destination of [GOOGLE_SHEETS_LEAD_V5_HEADERS, GOOGLE_SHEETS_LEAD_HEADERS]) {
    const liveHeaders = [...destination];
    const unchangedHeaders = [...liveHeaders];
    const values = alignLeadRowToDestinationHeaders(liveHeaders, payload);
    expect(Object.fromEntries(liveHeaders.map((header, index) => [header, values[index]]))).toEqual(expected);
    expect(values.slice(14)).toEqual(payload.rowValues.slice(14));
    expect(liveHeaders).toEqual(unchangedHeaders);
  }
  const oldValues = alignLeadRowToDestinationHeaders([...GOOGLE_SHEETS_LEAD_V5_HEADERS], payload);
  expect(oldValues[3]).toBe("GOS Beauty");
  expect(oldValues[4]).toBe("Synthetic Owner");
  expect(oldValues[7]).toBe("10000001");
  expect(oldValues[13]).toBe("2026-10-02");
  expect(payload.rowValues[3]).toBe("Synthetic Owner");
  expect(payload.rowValues[4]).toBe("GOS Beauty");
  expect(payload.rowValues[7]).toBe("2026-10-02");
  expect(payload.rowValues[9]).toBe("10000001");
  expect(JSON.stringify(payload)).toBe(original);
});

test("external Apps Script fallback retains its existing v5 wire order during native v6 rollout", () => {
  const payload = migrationPayload();
  const original = JSON.stringify(payload);
  const legacy = buildGoogleSheetsLegacyWebhookPayload(payload);
  expect(legacy.schemaVersion).toBe("lead.v5");
  expect(legacy.headers).toEqual(GOOGLE_SHEETS_LEAD_V5_HEADERS);
  expect(legacy.rowValues).toEqual(alignLeadRowToDestinationHeaders([...GOOGLE_SHEETS_LEAD_V5_HEADERS], payload));
  expect(legacy.rowValues[7]).toBe("10000001");
  expect(legacy.rowValues[13]).toBe("2026-10-02");
  expect(JSON.stringify(payload)).toBe(original);
});
