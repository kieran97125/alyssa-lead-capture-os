import type { InternalAccessContext } from "@/lib/security/internalAccess";

// The legacy Master principal is the configured owner, not any admin. An
// email-authenticated owner must also match the configured, immutable member ID.
// Never infer this from full_name, email input, user_metadata or a client flag.
export function canUsePrivateWorkbench(access: InternalAccessContext, ownerMemberId: string | undefined) {
  if (!ownerMemberId || access.accessLevel !== "master") return false;
  if (access.source === "supabase_auth") return access.memberId === ownerMemberId;
  return access.source === "shared_password";
}
