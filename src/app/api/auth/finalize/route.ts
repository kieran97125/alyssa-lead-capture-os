import { NextResponse } from "next/server";
import { createSupabaseServerAuthClient } from "@/lib/supabase/authServer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { safeInternalNextPath } from "@/lib/supabase/authConfig";
import { getWorkspaceMemberAccess } from "@/lib/security/workspaceAuth";

export async function POST(request: Request) {
  try {
    const supabaseAuth = await createSupabaseServerAuthClient();
    const { data, error } = await supabaseAuth.auth.getUser();
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
      await supabaseAuth.auth.signOut();
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

    await Promise.all([
      admin
        .from("workspace_members")
        .update({
          last_sign_in_at: signedInAt,
          updated_at: signedInAt,
        })
        .eq("id", access.memberId),
      admin.from("marketing_command_center_audit").insert({
        actor_email: access.email,
        action: "workspace_member.signed_in",
        entity_type: "workspace_member",
        entity_id: access.memberId,
        after_json: {
          workspaceRole: access.workspaceRole,
          authProvider: "email_link",
        },
      }),
    ]);

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
