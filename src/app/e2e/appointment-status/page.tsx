import { notFound } from "next/navigation";
import { AppointmentStatusSummary } from "@/components/system/AppointmentStatusSummary";

export const dynamic = "force-dynamic";

export default async function AppointmentStatusFixture({ searchParams }: { searchParams: Promise<{ unavailable?: string }> }) {
  if (process.env.ALYSSA_E2E_FIXTURES !== "1" && process.env.NODE_ENV === "production") notFound();
  const available = (await searchParams).unavailable !== "1";
  return <main className="mx-auto max-w-5xl space-y-4 p-4">
    <h1 className="text-2xl font-bold text-system-foreground">預約狀態</h1>
    <AppointmentStatusSummary summary={{ available, cancellations: available ? 2 : 0, reschedules: available ? 1 : 0, undated: 0,
      rows: available ? [{ key: "example", account: "Example Account", brand: "Example Brand", treatment: "Example Treatment", cancellations: 2, reschedules: 1 }] : [] }} />
  </main>;
}
