import { after, NextResponse } from "next/server";
import { createSupabaseServerAuthClient } from "@/lib/supabase/authServer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { safeInternalNextPath } from "@/lib/supabase/authConfig";
import { getWorkspaceMemberAccess } from "@/lib/security/workspaceAuth";
import { isSupabaseUnavailableError, SUPABASE_REQUEST_TIMEOUT_MS } from "@/lib/supabase/requestDeadline";

export async function POST(request: Request) {
  try {
    const supabaseAuth = await createSupabaseServerAuthClient();
    const { data, error } = await supabaseAuth.authDeadline.run(() => supabaseAuth.auth.getUser());
    if (isSupabaseUnavailableError(error)) throw error;
    const user = data.user;
    const email = user?.email?.trim().toLowerCase() || "";

    if (error || !user?.id || !email) {
      return NextResponse.json(
        { ok: false, error: "invalid_session" },
        { status: 401 }
      );
    }

    const access = await getWorkspaceMemberAccess(
      {
        userId: user.id,
        email,
      },
      { activate: true }
    );
    if (!access) {
      await supabaseAuth.authDeadline.run(() => supabaseAuth.auth.signOut()).catch(() => {});
      return NextResponse.json(
        { ok: false, error: "not_invited" },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as { next?: unknown };
    const next = safeInternalNextPath(
      typeof body.next === "string" ? body.next : "/dashboard"
    );
    const admin = createSupabaseAdminClient();
    const signedInAt = new Date().toISOString();

    // Access has already been verified. Telemetry is best-effort and cannot
    // keep the browser on confirmation while the write provider is slow.
    after(async () => {
      const signal = AbortSignal.timeout(SUPABASE_REQUEST_TIMEOUT_MS);
      const results = await Promise.allSettled([
        admin
          .from("workspace_members")
          .update({
            last_sign_in_at: signedInAt,
            updated_at: signedInAt,
          })
          .eq("id", access.memberId)
          .abortSignal(signal),
        admin.from("marketing_command_center_audit").insert({
          actor_email: access.email,
          action: "workspace_member.signed_in",
          entity_type: "workspace_member",
          entity_id: access.memberId,
          after_json: {
            workspaceRole: access.workspaceRole,
            authProvider: "email_link",
          },
        }).abortSignal(signal),
      ]);
      if (results.some((result) => result.status === "rejected" || result.value.error)) {
        console.warn("workspace_sign_in_telemetry_unavailable");
      }
    });

    return NextResponse.json(
      { ok: true, redirectTo: next },
      {
        headers: {
          "cache-control": "no-store",
        },
      }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "auth_unavailable" },
      { status: 503 }
    );
  }
}
