import "server-only";

import { z } from "zod";
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";

export type FormActivitySummary = {
  available: boolean;
  lastRegistrationAt: string | null;
  lastDeliveryAt: string | null;
  pendingCount: number;
  blockedCount: number;
  uncertainCount: number;
};

const countSchema = z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)])
  .pipe(z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER));
const timestampSchema = z.string().datetime({ offset: true }).nullable();
const rowSchema = z.object({
  form_id: z.uuid(),
  last_registration_at: timestampSchema,
  last_delivery_at: timestampSchema,
  pending_count: countSchema,
  blocked_count: countSchema,
  uncertain_count: countSchema,
});

function unavailable(): FormActivitySummary {
  return { available: false, lastRegistrationAt: null, lastDeliveryAt: null, pendingCount: 0, blockedCount: 0, uncertainCount: 0 };
}

/** Server-only. Callers supply form IDs from their authorized, scoped catalogue. */
export async function getFormActivitySummaries(formIds: string[]): Promise<Map<string, FormActivitySummary>> {
  const ids = [...new Set(formIds.filter(id => z.uuid().safeParse(id).success))];
  const result = new Map(ids.map(id => [id, unavailable()]));
  if (!ids.length || !hasSupabaseAdminEnv()) return result;
  let client: ReturnType<typeof createSupabaseAdminClient>;
  try {
    client = createSupabaseAdminClient();
  } catch {
    return result;
  }
  // Each SQL result covers its complete bounded request and contains no customer fields.
  for (let start = 0; start < ids.length; start += 200) {
    const chunk = ids.slice(start, start + 200);
    try {
      const response = await client.rpc("get_managed_form_activity_v1", { p_form_ids: chunk });
      const rows = z.array(rowSchema).safeParse(response.data);
      if (response.error || !rows.success || rows.data.length !== chunk.length) continue;
      const byId = new Map(rows.data.map(row => [row.form_id, row]));
      if (byId.size !== chunk.length || chunk.some(id => !byId.has(id))) continue;
      for (const id of chunk) {
        const row = byId.get(id)!;
        result.set(id, { available: true, lastRegistrationAt: row.last_registration_at, lastDeliveryAt: row.last_delivery_at,
          pendingCount: row.pending_count, blockedCount: row.blocked_count, uncertainCount: row.uncertain_count });
      }
    } catch {
      // Unknown is distinct from a verified zero; optional observations never block editing.
    }
  }
  return result;
}
