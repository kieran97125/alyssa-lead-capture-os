import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";

const sourcePerformance = [
  "Leads by source_type",
  "UTM source / medium / campaign performance",
  "Click ID availability",
  "CTWA availability",
  "Organic / unknown source share",
  "Tracking status distribution",
  "UTM missing rate",
];

const outcomePerformance = [
  "Booking requested count",
  "Booking confirmed count",
  "Paid leads",
  "Booking-only leads",
  "Payment failed leads",
  "Revenue from paid leads",
  "Campaign-to-booking conversion",
];

const attributionAudit = [
  "Complete UTM",
  "Partial UTM",
  "Click ID only",
  "CTWA only",
  "No source signal",
  "Duplicate leads",
  "Source snapshot details",
  "Lead/contact event timeline",
];

const crmFeedback = [
  "booking_confirmed",
  "booking_rescheduled",
  "booking_cancelled",
  "crm_followup_started",
  "crm_followup_updated",
  "show_up",
  "no_show",
  "deal_paid",
  "deal_lost",
];

export default function DashboardPage() {
  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <section className="rounded-[28px] border border-[#ead9cf] bg-white/82 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.1)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
                Internal growth dashboard
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#321428]">
                Alyssa Lead Capture OS
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
                The dashboard is structured around the shared lead/source model:
                source snapshots explain where leads came from, while bookings,
                payments, and future CRM outcomes explain what happened next.
              </p>
            </div>
            <div className="rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-4 py-3 text-sm font-semibold text-[#5a2348]">
              Live data state: waiting for Supabase connection
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-4">
            <ReadinessCard label="Public form" value="Ready" />
            <ReadinessCard label="Source snapshots" value="Modeled" />
            <ReadinessCard label="Lead events" value="Modeled" />
            <ReadinessCard label="CRM feedback" value="Boundary ready" />
          </div>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-2">
          <DashboardPanel
            title="Source Performance"
            eyebrow="Attribution source"
            description="Where Alyssa leads came from, grouped by source type, UTM, click IDs, and CTWA evidence."
            items={sourcePerformance}
          />
          <DashboardPanel
            title="Lead Outcome Performance"
            eyebrow="Business result"
            description="Booking and payment outcomes that will join back to the original source snapshots."
            items={outcomePerformance}
          />
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <DashboardPanel
            title="Attribution Audit"
            eyebrow="Quality control"
            description="Operational checks for missing UTM, partial tracking, CTWA-only leads, duplicates, and event timelines."
            items={attributionAudit}
          />
          <section className="rounded-[24px] border border-[#ead9cf] bg-white/82 p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
              Future CRM feedback
            </p>
            <h2 className="mt-2 text-xl font-bold text-[#321428]">
              Outcome events reserved for the WhatsApp CRM
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">
              These are not fake metrics. They are the event names the separate CRM
              will write back so source performance can include confirmed appointments,
              show/no-show, paid deals, and losses.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {crmFeedback.map((eventName) => (
                <div
                  key={eventName}
                  className="rounded-2xl border border-[#ead9cf] bg-[#fff6f0] p-3 text-xs font-bold text-[#5a2348]"
                >
                  {eventName}
                </div>
              ))}
            </div>
          </section>
        </section>

        <section className="mt-6 rounded-[24px] border border-[#ead9cf] bg-[#fff6f0] p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
                Local verification
              </p>
              <h2 className="mt-2 text-xl font-bold text-[#321428]">
                Test attribution before connecting production data
              </h2>
            </div>
            <Link
              href="/embed-preview"
              className="rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white"
            >
              Open Embed Preview
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function ReadinessCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#ead9cf] bg-[#fff9f3] p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {label}
      </p>
      <p className="mt-2 text-lg font-bold text-[#321428]">{value}</p>
    </div>
  );
}

function DashboardPanel({
  title,
  eyebrow,
  description,
  items,
}: {
  title: string;
  eyebrow: string;
  description: string;
  items: string[];
}) {
  return (
    <section className="rounded-[24px] border border-[#ead9cf] bg-white/82 p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-xl font-bold text-[#321428]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">{description}</p>
      <div className="mt-4 divide-y divide-[#ead9cf]">
        {items.map((item) => (
          <div key={item} className="flex items-center justify-between gap-4 py-3">
            <span className="text-sm font-semibold text-[#5a2348]">{item}</span>
            <span className="rounded-full bg-[#fff6f0] px-3 py-1 text-xs font-bold text-[#9a5d76]">
              Pending live data
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
