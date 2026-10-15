import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getGoogleSheetsOAuthAccessToken } from "@/lib/integrations/googleSheetsOAuth";
import { leadAccountForSpendBrandId, leadAccountBrandLabel } from "@/lib/marketing/leadAccountScope";

export const REVENUE_SPEND_SHEET = "_revenue_spend";
export const REVENUE_SPEND_VERSION = "marketing-revenue-spend-v1";
export const REVENUE_SPEND_HEADERS = ["Spend Date", "Account", "Brand", "Ad Spend HKD"];
const MAX_ROWS = 50_000;
const PAGE = 1_000;
type Brand = { id: string; name: string; slug: string };
type Spend = { brand_id: string; spend_date: string; amount: number | string };

/** Publish aggregates only; never export ledger notes, operators or contacts. */
export function marketingSpendProjectionRows(brands: Brand[], entries: Spend[]) {
  const grouped = new Map<string, { day: number; account: string; brand: string; cents: number }>();
  for (const entry of entries) {
    const account = leadAccountForSpendBrandId(brands, entry.brand_id);
    const brand = brands.find(row => row.id === entry.brand_id);
    if (!account || !brand) continue;
    const parsed = Date.parse(`${entry.spend_date}T00:00:00Z`), amount = Number(entry.amount);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.spend_date) || !Number.isFinite(parsed) ||
        new Date(parsed).toISOString().slice(0, 10) !== entry.spend_date || !Number.isFinite(amount) || amount < 0) throw new Error("Invalid Spend projection input");
    const cents = Math.round(amount * 100);
    if (!Number.isSafeInteger(cents)) throw new Error("Invalid Spend projection amount");
    const label = leadAccountBrandLabel(account.id, brand), key = JSON.stringify([entry.spend_date, account.id, brand.id]);
    const row = grouped.get(key) ?? { day: parsed / 86_400_000 + 25569, account: account.label, brand: label, cents: 0 };
    row.cents += cents;
    if (!Number.isSafeInteger(row.cents)) throw new Error("Invalid Spend projection total");
    grouped.set(key, row);
  }
  return [...grouped.values()].sort((a, b) => a.day - b.day || a.account.localeCompare(b.account) || a.brand.localeCompare(b.brand))
    .map(row => [row.day, row.account, row.brand, row.cents / 100]);
}

/** Refresh only an explicitly installed projection in the managed workbook.
 * Independent from Lead audit/fact publication: an optional export outage must
 * never turn a completed Lead refresh or a committed Spend save into a failure.
 */
export async function refreshInstalledMarketingSpendProjections(): Promise<boolean> {
  const signal = AbortSignal.timeout(20_000);
  try {
    const supabase = createSupabaseAdminClient();
    const { data: sources, error: sourceError } = await supabase.from("marketing_data_sources")
      .select("configuration").eq("provider_key", "google_sheets")
      .eq("configuration->>sourceProfile", "alyssa_workspace_lead_funnel").neq("status", "paused").limit(50).abortSignal(signal);
    if (sourceError) throw sourceError;
    const ids = [...new Set((sources ?? []).map(source => source.configuration?.spreadsheetId)
      .filter((id): id is string => typeof id === "string" && /^[A-Za-z0-9_-]{20,}$/.test(id)))];
    if (!ids.length) return true;
    const token = await getGoogleSheetsOAuthAccessToken({ signal, recordHealth: false });
    const request = async (url: string, body?: object) => {
      const response = await fetch(url, { method: body ? "POST" : "GET", headers: {
        Authorization: `Bearer ${token}`, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}),
      }, ...(body ? { body: JSON.stringify(body) } : {}), cache: "no-store", signal });
      if (!response.ok) throw new Error("Spend projection provider unavailable");
      return response.json();
    };
    const targets: Array<{ base: string; sheetId: number; rows: number }> = [];
    for (const id of ids) {
      const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}`;
      const metadata = await request(`${base}?fields=sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))`);
      const sheet = metadata.sheets?.find((s: { properties: { title: string } }) => s.properties.title === REVENUE_SPEND_SHEET)?.properties;
      if (!sheet) continue;
      if (!Number.isSafeInteger(sheet.sheetId) || sheet.gridProperties.rowCount > MAX_ROWS || sheet.gridProperties.columnCount < 7) throw new Error("Invalid Spend projection grid");
      const header = await request(`${base}/values/${encodeURIComponent(`'${REVENUE_SPEND_SHEET}'!A1:G1`)}?valueRenderOption=UNFORMATTED_VALUE`);
      if (JSON.stringify(header.values?.[0]?.slice(0, 4)) !== JSON.stringify(REVENUE_SPEND_HEADERS) || header.values?.[0]?.[5] !== REVENUE_SPEND_VERSION) throw new Error("Unowned Spend projection destination");
      targets.push({ base, sheetId: sheet.sheetId, rows: sheet.gridProperties.rowCount });
    }
    if (!targets.length) return true;
    const { data: brands, error: brandError } = await supabase.from("brands").select("id,name,slug").abortSignal(signal);
    if (brandError) throw brandError;
    const entries: Spend[] = [];
    for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
      const { data, error } = await supabase.from("marketing_daily_spend_entries").select("brand_id,spend_date,amount")
        .order("spend_date").order("brand_id").order("id").range(offset, offset + PAGE - 1).abortSignal(signal);
      if (error) throw error;
      entries.push(...(data ?? []));
      if ((data?.length ?? 0) < PAGE) break;
      if (offset + PAGE === MAX_ROWS) throw new Error("Spend projection exceeds bounded capacity");
    }
    const rows = marketingSpendProjectionRows(brands ?? [], entries);
    if (rows.length + 1 > MAX_ROWS) throw new Error("Spend projection exceeds bounded capacity");
    const cells = [REVENUE_SPEND_HEADERS, ...rows].map(row => ({ values: row.map(value => ({ userEnteredValue:
      typeof value === "number" ? { numberValue: value } : { stringValue: value } })) }));
    for (const target of targets) {
      await request(`${target.base}:batchUpdate`, { requests: [
        ...(rows.length + 1 > target.rows ? [{ updateSheetProperties: { properties: { sheetId: target.sheetId, gridProperties: { rowCount: rows.length + 1 } }, fields: "gridProperties.rowCount" } }] : []),
        { repeatCell: { range: { sheetId: target.sheetId, startRowIndex: 1, endRowIndex: Math.max(target.rows, rows.length + 1), startColumnIndex: 0, endColumnIndex: 4 }, cell: {}, fields: "userEnteredValue" } },
        { updateCells: { start: { sheetId: target.sheetId, rowIndex: 0, columnIndex: 0 }, rows: cells, fields: "userEnteredValue" } },
        { updateCells: { start: { sheetId: target.sheetId, rowIndex: 1, columnIndex: 5 }, rows: [{ values: [{ userEnteredValue: { stringValue: new Date().toISOString() } }] }], fields: "userEnteredValue" } },
      ] });
    }
    return true;
  } catch {
    console.warn("marketing_revenue_spend_projection_unavailable");
    return false;
  }
}
