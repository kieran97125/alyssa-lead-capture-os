import { notFound } from "next/navigation";
import { LeadDashboardPanel } from "@/components/command-center/LeadDashboardPanel";
import { leadDashboardAvailabilityFixture } from "../../../../e2e/fixtures/lead-dashboard-availability";

export default async function LeadDashboardAvailabilityPage({ searchParams }: {
  searchParams: Promise<{ state?: string }>;
}) {
  if (process.env.ALYSSA_E2E_FIXTURES !== "1" && process.env.NODE_ENV === "production") notFound();
  const { state } = await searchParams;
  const snapshot = leadDashboardAvailabilityFixture(state !== "unavailable");
  if (state === "successful-with-audit-warnings") snapshot.sourceStatus = "warning";
  if (state === "previous-successful-update") {
    snapshot.sourceStatus = "error";
    snapshot.warnings = ["最近一次更新未成功；以下保留上次成功同步嘅資料。"];
  }
  return <main className="p-4">
    {snapshot.live ? snapshot.warnings.map((warning) =>
      <p key={warning} className="command-status-message is-error" role="status">{warning}</p>
    ) : null}
    <LeadDashboardPanel snapshot={snapshot} />
  </main>;
}
