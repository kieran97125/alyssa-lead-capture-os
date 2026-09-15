import { test } from "@playwright/test";
import assert from "node:assert/strict";
import { applyLeadFunnelEventLedger as apply } from "../src/lib/marketing/leadFunnelEventLedger";

type Group = Parameters<typeof apply>[0]["groups"][number];
const headers = ["Event ID", "Event At", "Event Date", "Event Type", "lead_key", "Brand", "Phone Last8", "Source Row"];
const brands = [{ id: "brand-a", name: "Example Beauty", slug: "example" }, { id: "brand-b", name: "Other Beauty", slug: "other" }];
const group = (overrides: Partial<Group> = {}): Group => ({ key: "brand-a|phone:00000001", brandId: "brand-a", currentStatus: "show", currentRowNumber: 2, bookDate: "2026-09-15", bookDateSource: "legacy_created_at", showDate: "2026-09-15", noShowDate: null, pendingRowNumber: null, usesEventLedger: false, ...overrides });
const event = (id: string, type: string, date: unknown, values: { at?: unknown; leadKey?: string; brand?: string; phone?: string; row?: unknown } = {}): unknown[] => [id, values.at ?? `${date} 10:00:00`, date, type, values.leadKey ?? "", values.brand ?? "Example Beauty", values.phone ?? "00000001", values.row ?? 2];
const result = (rows: unknown[][], g = group(), h = headers) => apply({ groups: [g], brands, eventLedger: { headers: h, rows } })[0];

test("ledger integrity: preserves original Book after later Show", () => {
  const g = result([event("l", "lead", "2026-09-01"), event("b", "book", "2026-09-03"), event("s", "show", "2026-09-08")]);
  assert.equal(g.bookDate, "2026-09-03"); assert.equal(g.showDate, "2026-09-08"); assert.equal(g.bookDateSource, "event_ledger");
});
test("ledger integrity: never invents missing Book from Show", () => assert.equal(result([event("s", "show", "2026-09-08")]).bookDate, null));
test("ledger integrity: earliest Book is retained across rebooking", () => assert.equal(result([event("b2", "book", "2026-09-10"), event("b1", "book", "2026-09-03")]).bookDate, "2026-09-03"));
test("ledger integrity: current booked status owns pending", () => {
  const g = result([event("b", "book", "2026-09-03"), event("n", "no_show", "2026-09-05")], group({ currentStatus: "booked" }));
  assert.equal(g.noShowDate, "2026-09-05"); assert.equal(g.pendingRowNumber, 2);
});
test("ledger integrity: absent and empty ledgers preserve legacy groups", () => { const g = group(); assert.equal(apply({ groups: [g], brands })[0], g); assert.equal(result([], g), g); });
test("ledger integrity: populated invalid schema fails visibly", () => assert.throws(() => result([["book"]], group(), []), /欄位不完整/));
test("ledger integrity: duplicate canonical headers rejected", () => assert.throws(() => result([event("b", "book", "2026-09-03")], group(), [...headers, "event_type"]), /重複欄位/));
test("ledger integrity: underscore header aliases supported", () => assert.equal(result([event("b", "book", "2026-09-03")], group(), headers.map(x => x.toLowerCase().replaceAll(" ", "_"))).bookDate, "2026-09-03"));
test("ledger integrity: huge serial number cannot throw RangeError", () => assert.equal(result([event("b", "book", 1e100, { at: "" })]).usesEventLedger, false));
test("ledger integrity: supported serial date boundaries", () => { assert.equal(result([event("b", "book", 36526, { at: "" })]).bookDate, "2000-01-01"); assert.equal(result([event("b", "book", 73415, { at: "" })]).bookDate, "2100-12-31"); });
test("ledger integrity: UTC instant uses HKT calendar day", () => assert.equal(result([event("b", "book", "", { at: "2026-09-02T18:00:00Z" })]).bookDate, "2026-09-03"));
test("ledger integrity: explicit Event Date takes precedence", () => assert.equal(result([event("b", "book", "2026-09-02", { at: "2026-09-02T18:00:00Z" })]).bookDate, "2026-09-02"));
test("ledger integrity: invalid calendar dates not normalized", () => { for (const v of ["2026-02-30", "2026-02-30T12:00:00Z", "1999-12-31", "2101-01-01"]) assert.equal(result([event("b", "book", v, { at: "" })]).usesEventLedger, false); });
test("ledger integrity: incomplete brand never claims another Lead", () => { const g = group(); assert.equal(result([event("b", "book", "2026-09-03", { brand: "" })], g), g); });
test("ledger integrity: shared phone stays brand-scoped", () => assert.equal(result([event("b", "book", "2026-09-03", { brand: "Other Beauty" })]).usesEventLedger, false));
test("ledger integrity: exact duplicate ID is idempotent", () => { const e = event("b", "book", "2026-09-03"); assert.equal(result([e, e]).bookDate, "2026-09-03"); });
test("ledger integrity: contradictory duplicate ID rejected without PII", () => assert.throws(() => result([event("b", "book", "2026-09-03"), event("b", "book", "2026-09-05")]), (e: unknown) => e instanceof Error && /矛盾/.test(e.message) && !e.message.includes("00000001")));
test("ledger integrity: malformed source row not truncated", () => assert.equal(result([event("b", "book", "2026-09-03", { phone: "", row: "2garbage" })], group({ key: "brand-a|row:2" })).usesEventLedger, false));
test("ledger integrity: lead_key fallback when phone absent", () => assert.equal(result([event("b", "book", "2026-09-03", { phone: "", leadKey: "synthetic-key" })], group({ key: "brand-a|lead:synthetic-key" })).bookDate, "2026-09-03"));
test("ledger integrity: nonmetric status audit rows excluded", () => { const g = group(); assert.equal(result([event("audit", "status_change", "2026-09-03")], g), g); });
test("ledger integrity: configured brand aliases resolve", () => {
  const g = apply({ groups: [group()], brands, brandAliases: { Alias: "example" }, eventLedger: { headers, rows: [event("b", "book", "2026-09-03", { brand: "Alias" })] } })[0];
  assert.equal(g.bookDate, "2026-09-03");
});
