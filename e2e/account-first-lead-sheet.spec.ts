import { expect, test } from "@playwright/test";
import {
  buildLeadSheetGroups,
  type SheetBrandReference,
} from "../src/lib/marketing/googleSheetsMetricParser";
import { buildLeadDashboardModel } from "../src/lib/marketing/leadDashboardMath";

const brands: SheetBrandReference[] = [
  { id: "alyssa-db", name: "Alyssa", slug: "alyssa" },
  { id: "aesthetics-db", name: "Aesthetics", slug: "aesthetics" },
];

const aliases = {
  "Alyssa Aesthetics": "alyssa",
  "Aesthetics Medical": "aesthetics",
};

const headers = [
  "最後更新日期",
  "Created At",
  "跟進狀態",
  "品牌",
  "電話",
  "療程項目",
  "Account",
];

function row(input: {
  account: string;
  brand: string;
  phone: string;
  treatment: string;
}) {
  return [
    "2026-09-23",
    "2026-09-23",
    "待跟進",
    input.brand,
    input.phone,
    input.treatment,
    input.account,
  ];
}

test("same Alyssa DB brand and phone stay separated by Omni Account", () => {
  const parsed = buildLeadSheetGroups({
    headers,
    rows: [
      row({
        account: "Alyssa Main",
        brand: "Alyssa",
        phone: "60000001",
        treatment: "$780 SlimCut",
      }),
      row({
        account: "Alyssa Aesthetics",
        brand: "Alyssa Aesthetics",
        phone: "60000001",
        treatment: "$780 SlimCut",
      }),
      row({
        account: "Alyssa Aesthetics",
        brand: "Aesthetics Medical",
        phone: "60000002",
        treatment: "XEOMIN",
      }),
    ],
    brands,
    brandAliases: aliases,
    sourceBrandId: null,
    appsScriptContract: true,
    dedupeByIdentity: true,
  });

  expect(parsed.groups).toHaveLength(3);
  expect(parsed.groups.map((group) => group.accountLabel)).toEqual([
    "Alyssa Main",
    "Alyssa Aesthetics",
    "Alyssa Aesthetics",
  ]);
  expect(parsed.groups[1]).toMatchObject({
    brandId: "alyssa-db",
    brandLabel: "Alyssa Aesthetics",
  });
  expect(parsed.groups[2]).toMatchObject({
    brandId: "aesthetics-db",
    brandLabel: "Aesthetics Medical",
  });
  expect(new Set(parsed.groups.map((group) => group.key)).size).toBe(3);
});

test("Lead Dashboard exposes Account as first-level performance dimension", () => {
  const parsed = buildLeadSheetGroups({
    headers,
    rows: [
      row({
        account: "Alyssa Main",
        brand: "Alyssa",
        phone: "60000001",
        treatment: "$780 SlimCut",
      }),
      row({
        account: "Alyssa Aesthetics",
        brand: "Alyssa Aesthetics",
        phone: "60000002",
        treatment: "$988 Facelift",
      }),
      row({
        account: "Alyssa Aesthetics",
        brand: "Aesthetics Medical",
        phone: "60000003",
        treatment: "XEOMIN",
      }),
    ],
    brands,
    brandAliases: aliases,
    sourceBrandId: null,
    appsScriptContract: true,
    dedupeByIdentity: true,
  });

  const model = buildLeadDashboardModel({
    groups: parsed.groups,
    brands,
    filters: {
      startDate: "2026-09-23",
      endDate: "2026-09-23",
      accountId: "",
      brandId: "",
      treatment: "",
    },
  });

  expect(model.accountRows.map((row) => [row.accountLabel, row.leads])).toEqual(
    expect.arrayContaining([
      ["Alyssa Main", 1],
      ["Alyssa Aesthetics", 2],
    ])
  );
  expect(model.brandRows).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        accountLabel: "Alyssa Aesthetics",
        brandLabel: "Alyssa Aesthetics",
        leads: 1,
      }),
      expect.objectContaining({
        accountLabel: "Alyssa Aesthetics",
        brandLabel: "Aesthetics Medical",
        leads: 1,
      }),
    ])
  );
});
