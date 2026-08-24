import { expect, test } from "@playwright/test";
import { GOOGLE_SHEETS_LEAD_HEADERS } from "../src/lib/integrations/googleSheetsLeadSync";
import {
  isMetaLeadFormRawRow,
  normalizeMetaLeadFormRows,
} from "../src/lib/integrations/metaLeadFormSheetNormalizer";

const brands = [
  { id: "alyssa-brand", name: "Alyssa", slug: "alyssa" },
  { id: "am-brand", name: "AM", slug: "am" },
  { id: "ib-brand", name: "Ineffable Beauty", slug: "ineffable" },
  { id: "gos-brand", name: "GOS Beauty", slug: "gos-beauty" },
];

const brandAliases = {
  Alyssa: "alyssa",
  AM: "am",
  "Ineffable Beauty": "ineffable",
  "GOS Beauty": "gos-beauty",
  GOS: "gos-beauty",
};

const treatmentAliases = [
  {
    brand: "GOS Beauty",
    label: "GOS 激光脫毛",
    keywords: ["激光脫毛", "脫毛", "三波長", "兩年激脫"],
  },
];

test("Meta native Lead Form row is normalized into the Growth OS A:V contract", () => {
  const rawRow = [
    "l:1000000000000001",
    "2026-08-21T10:25:49-05:00",
    "ag:120000000000000001",
    "GOS_AI兩年脫毛menubar_demo",
    "as:120000000000000002",
    "GOS_interest_脫毛",
    "c:120000000000000003",
    "GOS_Website_completed registration_脫毛_demo",
    "f:1800000000000001",
    "Simple form setup demo",
    "false",
    "fb",
    "激光脫毛方案",
    "September",
    "Demo Lau",
    "p:+85261234567",
    "",
    "",
    "",
    "",
    "",
    "",
  ];

  expect(isMetaLeadFormRawRow(rawRow)).toBe(true);

  const result = normalizeMetaLeadFormRows({
    headers: [...GOOGLE_SHEETS_LEAD_HEADERS],
    rows: [rawRow],
    headerRow: 1,
    brands,
    brandAliases,
    treatmentAliases,
  });

  expect(result.rewrites).toHaveLength(1);
  expect(result.rewrites[0].rowNumber).toBe(2);
  expect(result.rows[0]).toHaveLength(22);
  expect(result.rows[0]).toEqual([
    "2026/8/21 下午 11:25:49",
    "待跟進",
    "GOS Beauty",
    "",
    "Demo Lau",
    "+85261234567",
    "",
    "Meta Lead Form · Simple form setup demo",
    "GOS 激光脫毛",
    "",
    "",
    "",
    "Meta Lead Form / Facebook",
    "GOS_Website_completed registration_脫毛_demo / GOS_AI兩年脫毛menubar_demo",
    "",
    "",
    "meta_lead:1000000000000001",
    "Meta 表單答案：激光脫毛方案｜September",
    "",
    "",
    "",
    "",
  ]);
});

test("normal operational rows are never rewritten as Meta raw leads", () => {
  const normalRow = [
    "2026/8/21 下午 11:25:49",
    "待跟進",
    "GOS Beauty",
    "",
    "Demo Lau",
    "+85261234567",
    "",
    "GOS Beauty 三波長激光脫毛 Wix Form",
    "GOS 激光脫毛",
    "",
    "",
    "",
    "直接 / 無追蹤",
    "未標記廣告系列 / 未標記素材",
    "",
    "",
    "lead-demo",
    "",
    "",
    "",
    "",
    "",
  ];

  expect(isMetaLeadFormRawRow(normalRow)).toBe(false);
  const result = normalizeMetaLeadFormRows({
    headers: [...GOOGLE_SHEETS_LEAD_HEADERS],
    rows: [normalRow],
    headerRow: 1,
    brands,
    brandAliases,
    treatmentAliases,
  });
  expect(result.rewrites).toHaveLength(0);
  expect(result.rows[0]).toEqual(normalRow);
});

test("normalizer refuses to rewrite when the destination header contract changed", () => {
  const rawRow = [
    "l:1000000000000001",
    "2026-08-21T10:25:49-05:00",
    "ag:120000000000000001",
    "GOS_demo",
    "as:120000000000000002",
    "GOS_demo",
    "c:120000000000000003",
    "GOS_脫毛_demo",
    "f:1800000000000001",
    "Simple form setup demo",
    "false",
    "fb",
    "激光脫毛方案",
    "September",
    "Demo Lau",
    "p:+85261234567",
  ];
  const changedHeaders = [...GOOGLE_SHEETS_LEAD_HEADERS];
  changedHeaders[5] = "Other Phone Header";

  const result = normalizeMetaLeadFormRows({
    headers: changedHeaders,
    rows: [rawRow],
    headerRow: 1,
    brands,
    brandAliases,
    treatmentAliases,
  });

  expect(result.rewrites).toHaveLength(0);
  expect(result.rows[0]).toEqual(rawRow);
});
