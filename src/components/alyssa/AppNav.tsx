import { Suspense } from "react";
import { unstable_rethrow } from "next/navigation";
import { AppNavNotifications, ApplyNavigationCounts, type NavigationCounts } from "./AppNavNotifications";
import { getLeadAuditNavigationSummary } from "@/lib/marketing/leadSheetAuditView";
import { getUnreadWorkNotificationCount } from "@/lib/marketing/workTasks";
import { getUnreadCreativeNotificationCount } from "@/lib/creative/store";
import { getCurrentInternalAccess } from "@/lib/security/internalAccessServer";
import {
  hasWorkspaceModulePermission,
  normalizeWorkspaceRole,
} from "@/lib/security/workspacePermissions";
import type { InternalAccessContext } from "@/lib/security/internalAccess";

export async function AppNav({
  access: providedAccess,
  leadAuditAlertCount: providedLeadAuditAlertCount,
  leadAuditAlertPromise,
  workNotificationCount: providedWorkNotificationCount,
  creativeNotificationCount: providedCreativeNotificationCount,
}: {
  access?: InternalAccessContext;
  leadAuditAlertCount?: number;
  leadAuditAlertPromise?: Promise<number | null>;
  workNotificationCount?: number;
  creativeNotificationCount?: number;
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
  const canSeeCreative =
    isMaster ||
    access.source !== "supabase_auth" ||
    hasWorkspaceModulePermission(permissionContext, "creative_jobs");
  const initialCounts = {
    leadAuditAlertCount: canSeeLeadAudit ? providedLeadAuditAlertCount : undefined,
    workNotificationCount: canSeeCalendar ? providedWorkNotificationCount : undefined,
    creativeNotificationCount: canSeeCreative ? providedCreativeNotificationCount : undefined,
  };
  const counts = Promise.all([
    optionalCount(canSeeLeadAudit
      ? providedLeadAuditAlertCount ?? leadAuditAlertPromise ?? getLeadAuditNavigationSummary(access)
      : null),
    optionalCount(canSeeCalendar ? providedWorkNotificationCount ?? getUnreadWorkNotificationCount() : null),
    optionalCount(canSeeCreative ? providedCreativeNotificationCount ?? getUnreadCreativeNotificationCount() : null),
  ]).then(([leadAuditAlertCount, workNotificationCount, creativeNotificationCount]) => ({
    leadAuditAlertCount,
    workNotificationCount,
    creativeNotificationCount,
  }));
  return (
    <AppNavNotifications access={access} initialCounts={initialCounts}>
      <Suspense fallback={null}>
        <NavigationBadges counts={counts} />
      </Suspense>
    </AppNavNotifications>
  );
}

async function optionalCount(read: number | null | Promise<number | null>) {
  try {
    return (await read) ?? undefined;
  } catch (error) {
    unstable_rethrow(error);
    // Badge availability must not prevent navigation or imply a successful 0.
    return undefined;
  }
}

async function NavigationBadges({ counts }: { counts: Promise<NavigationCounts> }) {
  return <ApplyNavigationCounts counts={await counts} />;
}
