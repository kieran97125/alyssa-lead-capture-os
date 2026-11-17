import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PlatformOperatorAccess } from "@/lib/security/platformAccess";

export type PlatformWorkspace = { id: string; slug: string; name: string; status: string; plan: string; members: number; brands: number; isolation: string };
export type PlatformSystemCard = { key: string; title: string; state: string; acceptance: string };
export type PlatformOverview = { workspaces: PlatformWorkspace[]; cards: PlatformSystemCard[] };

export async function getPlatformOverview(access: PlatformOperatorAccess): Promise<PlatformOverview> {
  if (access.scope !== "platform") throw new Error("Platform access required.");
  const db = createSupabaseAdminClient();
  const [workspaces, members, brands, cards] = await Promise.all([
    db.from("marketing_workspaces").select("id,slug,display_name,status,plan_key,isolation_status").order("created_at"),
    db.from("workspace_members").select("workspace_id,status").in("status", ["active", "invited"]),
    db.from("brands").select("workspace_id"),
    db.from("marketing_system_cards").select("key,title,state,acceptance").order("key"),
  ]);
  if ([workspaces, members, brands, cards].some(result => result.error)) throw new Error("Platform overview unavailable.");
  return {
    workspaces: (workspaces.data ?? []).map(row => ({ id: String(row.id), slug: String(row.slug), name: String(row.display_name),
      status: String(row.status), plan: String(row.plan_key), isolation: String(row.isolation_status),
      members: (members.data ?? []).filter(member => member.workspace_id === row.id).length,
      brands: (brands.data ?? []).filter(brand => brand.workspace_id === row.id).length })),
    cards: (cards.data ?? []).map(row => ({ key: String(row.key), title: String(row.title), state: String(row.state), acceptance: String(row.acceptance) })),
  };
}
