"use client";

import { useEffect, useState } from "react";
import { AppNavNotifications, ApplyNavigationCounts } from "@/components/alyssa/AppNavNotifications";
import { DashboardRegionState } from "./DashboardRegionState";

const syntheticAccess = { source: "shared_password" as const, accessLevel: "master" as const };
const syntheticCounts = { leadAuditAlertCount: 3, workNotificationCount: 2, creativeNotificationCount: 1 };

function DelayedFixtureBadges() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 1500);
    return () => clearTimeout(timer);
  }, []);
  return ready ? <ApplyNavigationCounts counts={syntheticCounts} /> : null;
}

// Only exposed by the guarded E2E route and Storybook; no business data reads.
export function DashboardLoadingSpecimen() {
  return (
    <main className="alyssa-shell" data-testid="dashboard-availability-specimen">
      <AppNavNotifications access={syntheticAccess} initialCounts={{}}>
        <DelayedFixtureBadges />
      </AppNavNotifications>
      <div className="command-page">
        <div className="command-page-inner">
          <header className="command-page-header">
            <div>
              <p className="command-page-kicker">資料載入狀態驗收</p>
              <h1 className="command-page-title">Dashboard</h1>
              <p className="command-page-subtitle">獨立載入每個區域，保留可操作導覽。</p>
            </div>
          </header>
          <DashboardRegionState title="Lead、預約及到店" />
          <DashboardRegionState title="廣告來源成效" failed />
        </div>
      </div>
    </main>
  );
}
