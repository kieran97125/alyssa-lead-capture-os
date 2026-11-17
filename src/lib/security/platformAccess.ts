import "server-only";
import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerAuthClient } from "@/lib/supabase/authServer";
import { WorkspaceAccessUnavailableError } from "@/lib/security/workspaceAuth";
import type { VerifiedSupabaseIdentity } from "@/lib/supabase/authProxy";

export type PlatformOperatorAccess = {
  scope: "platform";
  id: string;
  userId: string;
  email: string;
  role: "owner" | "admin" | "support";
};

export async function getPlatformOperatorAccess(identity: VerifiedSupabaseIdentity): Promise<PlatformOperatorAccess | null> {
  const client = createSupabaseAdminClient();
  const { data, error } = await client.from("marketing_platform_operators")
    .select("id,auth_user_id,email,role,status").eq("email", identity.email).maybeSingle();
  if (error) throw new WorkspaceAccessUnavailableError();
  if (!data || data.status !== "active" || data.email !== identity.email ||
      data.auth_user_id && data.auth_user_id !== identity.userId ||
      !["owner", "admin", "support"].includes(data.role)) return null;
  if (!data.auth_user_id) {
    const binding = await client.rpc("bind_marketing_platform_operator", {
      p_operator_id: data.id, p_auth_user_id: identity.userId, p_email: identity.email,
    });
    if (binding.error) throw new WorkspaceAccessUnavailableError();
    if (binding.data !== true) return null;
  }
  // Reserved operator email alone is never a session; this is reached only
  // after Supabase verifies the subject and email in its signed claims.
  return { scope: "platform", id: String(data.id), userId: identity.userId,
    email: identity.email, role: data.role as PlatformOperatorAccess["role"] };
}

export const getCurrentPlatformOperator = cache(async (): Promise<PlatformOperatorAccess | null> => {
  try {
    const client = await createSupabaseServerAuthClient();
    const { data, error } = await client.authDeadline.run(() => client.auth.getClaims());
    if (error) return null;
    const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : "";
    const email = typeof data?.claims?.email === "string" ? data.claims.email.trim().toLowerCase() : "";
    if (!userId || !email) return null;
    return await getPlatformOperatorAccess({ userId, email });
  } catch {
    throw new WorkspaceAccessUnavailableError();
  }
});

export function canProvisionCustomers(access: PlatformOperatorAccess) {
  return access.role === "owner" || access.role === "admin";
}
