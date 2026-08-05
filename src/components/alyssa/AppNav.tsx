import { AppNavClient } from "@/components/alyssa/AppNavClient";
import { getLeadAuditNavigationSummary } from "@/lib/marketing/leadSheetAuditView";
import { getCurrentInternalAccess } from "@/lib/security/internalAccessServer";
import {
  hasWorkspaceModulePermission,
  normalizeWorkspaceRole,
} from "@/lib/security/workspacePermissions";
import type { InternalAccessContext } from "@/lib/security/internalAccess";

export async function AppNav({
  access: providedAccess,
  leadAuditAlertCount: providedLeadAuditAlertCount,
}: {
  access?: InternalAccessContext;
  leadAuditAlertCount?: number;
} = {}) {
  const access = providedAccess ?? (await getCurrentInternalAccess());
  const isMaster = access.accessLevel === "master";
  const canSeeLeadAudit =
    isMaster ||
    (access.source === "supabase_auth" &&
      hasWorkspaceModulePermission(
        {
          isMaster,
          workspaceRole: normalizeWorkspaceRole(access.workspaceRole),
          modulePermissions: access.modulePermissions ?? {},
        },
        "lead_audit"
      ));
  const leadAuditAlertCount =
    providedLeadAuditAlertCount ??
    (canSeeLeadAudit ? await getLeadAuditNavigationSummary(access) : 0);
  return (
    <AppNavClient
      access={access}
      leadAuditAlertCount={leadAuditAlertCount}
    />
  );
}
