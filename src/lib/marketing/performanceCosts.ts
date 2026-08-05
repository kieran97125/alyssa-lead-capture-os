import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { DailySpendFact } from "@/lib/marketing/performanceCostMath";

type DailySpendRow = {
  id: string;
  brand_id: string;
  spend_date: string;
  amount: number | string;
};

const PAGE_SIZE = 1000;

export async function fetchDailySpendFacts(input: {
  startDate: string;
  endDate: string;
  allowedBrandIds: string[] | null;
}): Promise<DailySpendFact[]> {
  if (input.allowedBrandIds !== null && input.allowedBrandIds.length === 0) {
    return [];
  }

  const supabase = createSupabaseAdminClient();
  const rows: DailySpendRow[] = [];
  for (let offset = 0; offset < 50_000; offset += PAGE_SIZE) {
    let query = supabase
      .from("marketing_daily_spend_entries")
      .select("id,brand_id,spend_date,amount")
      .gte("spend_date", input.startDate)
      .lte("spend_date", input.endDate)
      .order("spend_date", { ascending: true })
      .order("brand_id", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (input.allowedBrandIds !== null) {
      query = query.in("brand_id", input.allowedBrandIds);
    }
    const { data, error } = await query;
    if (error) throw error;
    const page = (data ?? []) as DailySpendRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return rows.map((row) => ({
    brandId: row.brand_id,
    spendDate: row.spend_date,
    amount: Number(row.amount) || 0,
  }));
}
