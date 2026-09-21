import { test, expect } from "@playwright/test";
import { buildLeadSheetGroups, aggregateLeadSheetPerformance, type LeadSheetTreatmentAlias } from "../src/lib/marketing/googleSheetsMetricParser";
import { applyLeadFunnelEventLedger } from "../src/lib/marketing/leadFunnelEventLedger";
import { brandScopeOptions, brandsForScope } from "../src/lib/marketing/brandScope";

const brands = [
  { id: "skin-test", name: "Skin Light", slug: "skin-light" },
  { id: "ib-test", name: "Ineffable Beauty", slug: "ineffable" },
  { id: "gos-test", name: "GOS Beauty", slug: "gos-beauty" },
  { id: "a-test", name: "Alyssa", slug: "alyssa" },
  { id: "am-test", name: "AM", slug: "am" },
];
const brandAliases = { SkinLight: "skin-light", "Skin Light Beauty": "skin-light", GOS: "gos-beauty", "Alyssa Medical": "am" };
const headers = ["最後更新日期", "Created At", "跟進狀態", "品牌", "分店", "客人姓名", "電話", "Email", "療程 / 優惠", "療程項目", "預約日期", "預約時間", "確認到店日期", "來源", "Campaign / 廣告", "Page URL", "最後跟進時間", "lead_key", "CS Remark", "具體派畀邊間分店+邊一位同事", "Remark(後續跟進情況)", "Status", "Show up"];
const aliases: LeadSheetTreatmentAlias[] = [
  { brand: "Ineffable Beauty", label: "IB legacy", keywords: ["388", "DEP"] },
  { brand: "GOS Beauty", label: "GOS legacy", keywords: ["988", "脫毛"] },
  { brand: "AM", label: "AM legacy", keywords: ["julaine"] },
];
function row(input: { brand?: string; phone?: unknown; offer?: string; treatment?: string; status?: string } = {}) {
  const r: unknown[] = Array(23).fill("");
  r[0] = "2026-09-21 13:00:00"; r[1] = "2026-09-21 10:00:00";
  r[2] = input.status ?? "待跟進"; r[3] = input.brand ?? "Skin Light";
  r[6] = input.phone ?? 10000001; r[8] = input.offer ?? ""; r[9] = input.treatment ?? "";
  r[13] = "WhatsApp 廣告"; r[14] = "CTWA / 手動新增";
  return r;
}
function parse(rows: unknown[][], treatmentAliases = aliases, appsScriptContract = true) {
  return buildLeadSheetGroups({ headers, rows, brands, brandAliases, sourceBrandId: null, treatmentAliases, appsScriptContract, dedupeByIdentity: true });
}
const eventHeaders = ["Event ID", "Event At", "Event Date", "Event Type", "lead_key", "Brand", "Phone Last8", "Source Row"];
const ledger = { headers: eventHeaders, rows: [
  ["synthetic-l", "2026-09-21 10:00:00", "2026-09-21", "lead", "", "Skin Light", "10000001", 2],
  ["synthetic-b", "2026-09-22 11:00:00", "2026-09-22", "book", "", "Skin Light", "10000001", 2],
  ["synthetic-s", "2026-09-23 12:00:00", "2026-09-23", "show", "", "Skin Light", "10000001", 2],
] };

test("Skin Light is selectable without website or catalog entities", () => {
  expect(brandScopeOptions(brands)).toContainEqual({ value: "skin-test", label: "Skin Light" });
  expect(brandsForScope(brands, "skin-light")).toHaveLength(1);
  const p = parse([row()]);
  expect(p.diagnostics.unknownBrandRows).toBe(0); expect(p.groups[0].brandId).toBe("skin-test");
  expect(p.groups[0].sourceLabel).toBe("WhatsApp 廣告"); expect(p.groups[0].bookDate).toBeNull();
});
for (const offer of ["388", "DEP 988", "脫毛", "julaine"]) {
  test(`Skin Light explicit brand cannot be hijacked by ${offer}`, () => {
    const g = parse([row({ offer, treatment: "Owner-defined service" })]).groups[0];
    expect(g.brandId).toBe("skin-test"); expect(g.treatmentLabel).toBe("Owner-defined service");
  });
}
test("Owner can introduce a treatment through Sheet J without a website catalog", () => {
  const rows = [row({ treatment: "Service A" }), row({ phone: 10000002, treatment: "Service B" })];
  expect(parse(rows).groups.map(g => g.treatmentLabel)).toEqual(["Service A", "Service B"]);
  expect(parse(rows, aliases, false).groups.map(g => g.treatmentLabel)).toEqual(["Service A", "Service B"]);
});
test("Known brand spelling aliases map to the same canonical identity", () => {
  const p = parse([row({ brand: "SkinLight" }), row({ brand: "Skin Light Beauty", phone: "10000001" })]);
  expect(p.groups).toHaveLength(1); expect(p.groups[0].brandId).toBe("skin-test");
});
test("Shared phones are still separate across brands", () => {
  const p = parse([row(), row({ brand: "GOS", offer: "脫毛" })]);
  expect(p.groups).toHaveLength(2); expect(new Set(p.groups.map(g => g.brandId)).size).toBe(2);
});
test("New Skin Light aliases cannot reclassify an older brand", () => {
  const newAliases = [{ brand: "Skin Light", label: "Skin-only", keywords: ["388"] }, ...aliases];
  expect(parse([row({ brand: "Ineffable Beauty", offer: "388" })], newAliases).groups[0].brandId).toBe("ib-test");
});
test("Skin Light scoped rule remains usable", () => {
  const rules = [...aliases, { brand: "SkinLight", label: "Owner category", keywords: ["388"] }];
  const g = parse([row({ offer: "388" })], rules).groups[0];
  expect(g.brandId).toBe("skin-test"); expect(g.treatmentLabel).toBe("Owner category");
});
test("Existing legacy cross-brand migration stays unchanged", () => {
  expect(parse([row({ brand: "Alyssa", offer: "julaine" })]).groups[0].brandId).toBe("am-test");
});
test("Book and Show retain independent immutable dates for the new brand", () => {
  const groups = applyLeadFunnelEventLedger({ groups: parse([row({ status: "已到店", treatment: "Service A" })]).groups, brands, brandAliases, eventLedger: ledger });
  expect(groups[0].bookDate).toBe("2026-09-22"); expect(groups[0].showDate).toBe("2026-09-23");
});
test("Persisted reporting uses the same Skin Light identity and owner-defined label", () => {
  const p = aggregateLeadSheetPerformance({ headers, rows: [row({ status: "已到店", treatment: "Service A" })], brands, brandAliases, sourceBrandId: null, treatmentAliases: aliases, eventLedger: ledger, dailyThroughDate: "2026-09-30", activityThroughDate: "2026-09-30", pendingThroughDate: "2026-09-30" });
  expect(p.dailyMetrics.reduce((a,m) => a + m.leads, 0)).toBe(1);
  expect(p.dailyMetrics.reduce((a,m) => a + m.bookings, 0)).toBe(1);
  expect(p.dailyMetrics.reduce((a,m) => a + m.shows, 0)).toBe(1);
  expect(p.metricFacts.every(f => f.brandId === "skin-test" && f.treatmentLabel === "Service A")).toBe(true);
});
