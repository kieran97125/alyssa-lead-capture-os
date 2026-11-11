import { getPrivateWorkbenchAccess } from "@/lib/workbench/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { driveToken, readDriveThumbnail } from "@/lib/workbench/drive";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const headers = { "cache-control": "private, no-store, max-age=0", "x-content-type-options": "nosniff" };
  try {
    const { allowed, ownerId } = await getPrivateWorkbenchAccess();
    if (!allowed || !ownerId) return new Response(null, { status: 403, headers });
    const id = new URL(request.url).searchParams.get("file") || "";
    if (!/^[A-Za-z0-9_-]{10,200}$/.test(id)) return new Response(null, { status: 400, headers });
    const db = createSupabaseAdminClient();
    const membership = await db.from("workbench_resource_mounts").select("file_id,workbench_resource_sources!inner(enabled)").eq("owner_member_id", ownerId).eq("file_id", id).eq("available", true).eq("workbench_resource_sources.enabled", true).limit(1);
    if (membership.error || !membership.data?.length) return new Response(null, { status: 404, headers });
    const thumbnail = await readDriveThumbnail(await driveToken(), id);
    if (!thumbnail) return new Response(null, { status: 404, headers });
    return new Response(thumbnail.bytes as BodyInit, { headers: { ...headers, "content-type": thumbnail.type } });
  } catch { return new Response(null, { status: 404, headers }); }
}
