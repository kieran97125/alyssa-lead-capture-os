import { AppNavClient } from "@/components/alyssa/AppNavClient";
import { getLeadAuditNavigationSummary } from "@/lib/marketing/leadSheetAuditView";
import { getUnreadWorkNotificationCount } from "@/lib/marketing/workTasks";
import { getCurrentInternalAccess } from "@/lib/security/internalAccessServer";
import {
  hasWorkspaceModulePermission,
  normalizeWorkspaceRole,
} from "@/lib/security/workspacePermissions";
import type { InternalAccessContext } from "@/lib/security/internalAccess";

export async function AppNav({
  access: providedAccess,
  leadAuditAlertCount: providedLeadAuditAlertCount,
  workNotificationCount: providedWorkNotificationCount,
}: {
  access?: InternalAccessContext;
  leadAuditAlertCount?: number;
  workNotificationCount?: number;
} = {}) {
  const access = providedAccess ?? (await getCurrentInternalAccess());
  const isMaster = access.accessLevel === "master";
  const permissionContext = {
    isMaster,
    workspaceRole: normalizeWorkspaceRole(access.workspaceRole),
    modulePermissions: access.modulePermissions ?? {},
  };
  const canSeeLeadAudit =
    isMaster ||
    (access.source === "supabase_auth" &&
      hasWorkspaceModulePermission(permissionContext, "lead_audit"));
  const canSeeCalendar =
    isMaster ||
    access.source !== "supabase_auth" ||
    hasWorkspaceModulePermission(permissionContext, "calendar");
  const [leadAuditAlertCount, workNotificationCount] = await Promise.all([
    providedLeadAuditAlertCount ??
      (canSeeLeadAudit ? getLeadAuditNavigationSummary(access) : 0),
    providedWorkNotificationCount ??
      (canSeeCalendar ? getUnreadWorkNotificationCount() : 0),
  ]);
  return (
    <AppNavClient
      access={access}
      leadAuditAlertCount={leadAuditAlertCount}
      workNotificationCount={workNotificationCount}
    />
  );
}
