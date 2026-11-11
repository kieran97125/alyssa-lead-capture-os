import { timingSafeEqual } from "node:crypto";
import { runResourceSync } from "@/lib/workbench/resourceSync";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: Request) {
  const configured = process.env.WORKBENCH_SYNC_SECRET || "", supplied = request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
  if (!configured || Buffer.byteLength(configured) !== Buffer.byteLength(supplied) || !timingSafeEqual(Buffer.from(configured), Buffer.from(supplied))) return Response.json({ ok: false }, { status: 401 });
  const owner = process.env.ALYSSA_WORKBENCH_OWNER_MEMBER_ID;
  if (!owner) return Response.json({ ok: false }, { status: 503 });
  try { const results = await runResourceSync(owner); return Response.json({ ok: true, processed: results.length }, { headers: { "cache-control": "no-store" } }); }
  catch { console.error("workbench_resources_scheduled_failed"); return Response.json({ ok: false }, { status: 503 }); }
}
