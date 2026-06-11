import { AppNav } from "@/components/alyssa/AppNav";

const sourceCards = [
  "reg_form_utm",
  "whatsapp_ctwa",
  "organic_unknown",
  "manual",
  "imported",
];

const auditViews = [
  "Complete UTM leads",
  "Partial UTM leads",
  "Click ID only",
  "CTWA source detected",
  "No source signal",
  "Duplicate leads",
  "Event timeline",
  "Source snapshot details",
];

export default function DashboardPage() {
  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
              Attribution dashboard
            </p>
            <h1 className="mt-2 text-3xl font-bold text-[#321428]">
              Source, booking, and revenue readiness
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
              This dashboard is wired around live source snapshots, leads, bookings,
              payments, and lead events. No fake performance numbers are shown before
              Supabase data is connected.
            </p>
          </div>
          <div className="rounded-2xl border border-[#ead9cf] bg-white/75 px-4 py-3 text-sm font-semibold text-[#5a2348]">
            Data state: waiting for connected Supabase rows
          </div>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {sourceCards.map((sourceType) => (
            <article key={sourceType} className="rounded-[24px] border border-[#ead9cf] bg-white/82 p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
                Source type
              </p>
              <h2 className="mt-3 text-lg font-bold text-[#321428]">{sourceType}</h2>
              <p className="mt-3 text-sm leading-6 text-[#7b5a6a]">
                Ready for live counts, conversion rate, booking outcome, and revenue joins.
              </p>
            </article>
          ))}
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_0.9fr]">
          <Panel title="Lead Source Performance">
            {[
              "Leads by UTM source / medium / campaign",
              "Click ID availability",
              "CTWA availability",
              "Organic / unknown share",
              "Tracking status distribution",
              "UTM missing rate",
            ].map((item) => (
              <Row key={item} label={item} value="Live query pending" />
            ))}
          </Panel>
          <Panel title="Business Performance">
            {[
              "Booking requested count",
              "Booking confirmed count",
              "Paid leads",
              "Booking-only leads",
              "Show / no-show placeholders",
              "Campaign-to-booking conversion",
            ].map((item) => (
              <Row key={item} label={item} value="Ready" />
            ))}
          </Panel>
        </section>

        <section className="mt-6 rounded-[24px] border border-[#ead9cf] bg-white/82 p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
            Attribution audit
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {auditViews.map((view) => (
              <div key={view} className="rounded-2xl bg-[#fff6f0] p-4 text-sm font-semibold text-[#5a2348]">
                {view}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[24px] border border-[#ead9cf] bg-white/82 p-5 shadow-sm">
      <h2 className="text-xl font-bold text-[#321428]">{title}</h2>
      <div className="mt-4 divide-y divide-[#ead9cf]">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 text-sm">
      <span className="font-semibold text-[#5a2348]">{label}</span>
      <span className="rounded-full bg-[#fff6f0] px-3 py-1 text-xs font-bold text-[#9a5d76]">
        {value}
      </span>
    </div>
  );
}
