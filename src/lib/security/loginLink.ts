import "server-only";
import { createHmac } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerAuthClient } from "@/lib/supabase/authServer";
import { getAuthConfirmUrl } from "@/lib/supabase/authConfig";

/** Invited identities only; identical responses prevent account enumeration. */
export async function requestReservedLoginLink(email: string, ip: string, next: string): Promise<void> {
  const secret = process.env.LAUNCHHUB_ADMIN_SESSION_SECRET?.trim();
  if (!secret) throw new Error("Login configuration unavailable.");
  const digest = (value: string) => createHmac("sha256", secret).update(value).digest("hex");
  const admin = createSupabaseAdminClient();
  const admission = await admin.rpc("claim_marketing_login_link", { p_email_hash: digest("email:" + email), p_ip_hash: digest("ip:" + ip) });
  if (admission.error) throw new Error("Login admission unavailable.");
  if (admission.data !== true) return;
  const [member, operator] = await Promise.all([
    admin.from("workspace_members").select("auth_user_id,status,workspace_id").ilike("email", email).in("status", ["active", "invited"]).maybeSingle(),
    admin.from("marketing_platform_operators").select("auth_user_id,status").eq("email", email).eq("status", "active").maybeSingle(),
  ]);
  if (member.error || operator.error) throw new Error("Login reservation unavailable.");
  let permittedMember = false;
  if (member.data) {
    const workspace = await admin.from("marketing_workspaces").select("status,is_legacy_customer").eq("id", member.data.workspace_id).maybeSingle();
    if (workspace.error) throw new Error("Workspace unavailable.");
    permittedMember = workspace.data?.status === "active" && workspace.data?.is_legacy_customer === true;
  }
  if (!permittedMember && !operator.data) return;
  const redirectTo = getAuthConfirmUrl(operator.data && !permittedMember ? "/platform" : next);
  const knownSubject = operator.data?.auth_user_id || member.data?.auth_user_id;
  if (!knownSubject) {
    const invitation = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (!invitation.error) return;
    if (!["email_exists", "user_already_exists"].includes(invitation.error.code ?? "")) throw new Error("Login invitation unavailable.");
  }
  const auth = await createSupabaseServerAuthClient();
  const result = await auth.authDeadline.run(() => auth.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: redirectTo } }));
  if (result.error) throw new Error("Login delivery unavailable.");
}
