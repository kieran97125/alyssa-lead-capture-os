import { notFound, redirect } from "next/navigation";
import { LeadDeliveryStatusPanel } from "@/components/capture/LeadDeliveryStatusPanel";
import type { LeadDeliveryCounts, LeadDeliverySummary } from "@/lib/capture/deliverySummary";

export const dynamic = "force-dynamic";

export default async function LeadDeliveryFixture({ searchParams }: { searchParams: Promise<{ state?: string; recheck?: string }> }) {
  if (process.env.ALYSSA_E2E_FIXTURES !== "1" && process.env.NODE_ENV === "production") notFound();
  const { state, recheck } = await searchParams;
  const counts: LeadDeliveryCounts = state === "empty"
    ? { pending: 0, retry: 0, processing: 0, delivered: 0, blocked: 0, uncertain: 0, skipped: 0 }
    : { pending: 4, retry: 2, processing: 1, delivered: 1280, blocked: state === "review" || state === "member_required" ? 2 : 0, uncertain: state === "review" || state === "member_required" ? 3 : 0, skipped: 2 };
  const summary: LeadDeliverySummary = state === "unavailable"
    ? { available: false, reason: "read_failed" }
    : { available: true, counts, total: Object.values(counts).reduce((sum, count) => sum + count, 0), checkedAt: "2026-11-16T03:00:00.000Z" };
  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold text-system-foreground">系統狀態</h1>
      <LeadDeliveryStatusPanel
        summary={summary}
        recoveryAccess={state === "member_required" ? { allowed: false, reason: "member_required" } : { allowed: true }}
        recheckAction={async () => {
          "use server";
          if (process.env.ALYSSA_E2E_FIXTURES !== "1" && process.env.NODE_ENV === "production") notFound();
          redirect("/e2e/lead-delivery?state=review&recheck=scheduled");
        }}
        feedback={recheck === "scheduled" ? { status: "scheduled", count: 3 } : undefined}
      />
    </main>
  );
}
