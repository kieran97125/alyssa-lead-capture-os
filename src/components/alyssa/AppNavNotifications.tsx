"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { AppNavClient } from "./AppNavClient";
import type { InternalAccessContext } from "@/lib/security/internalAccess";

export type NavigationCounts = {
  leadAuditAlertCount?: number;
  workNotificationCount?: number;
  creativeNotificationCount?: number;
};

const NotificationContext = createContext<((counts: NavigationCounts) => void) | null>(null);

// Keep the interactive sidebar mounted while optional badges stream in. A
// Suspense fallback around the entire sidebar would reset its open/focus state.
export function AppNavNotifications({ access, initialCounts, children }: {
  access: InternalAccessContext;
  initialCounts: NavigationCounts;
  children: ReactNode;
}) {
  const [loadedCounts, setLoadedCounts] = useState<NavigationCounts>({});
  return (
    <NotificationContext.Provider value={setLoadedCounts}>
      <AppNavClient access={access} {...initialCounts} {...loadedCounts} />
      {children}
    </NotificationContext.Provider>
  );
}

export function ApplyNavigationCounts({ counts }: { counts: NavigationCounts }) {
  const setCounts = useContext(NotificationContext);
  useEffect(() => { setCounts?.(counts); }, [counts, setCounts]);
  return null;
}
