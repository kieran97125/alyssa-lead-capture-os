import { AppNav } from "@/components/alyssa/AppNav";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";
import { countBy, formatDateTime } from "@/lib/data/businessMetrics";

export const dynamic = "force-dynamic";

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

async function getAuditSummary() {
  if (!hasSupabaseAdminEnv()) {
    return {
      status: "系統狀態：等待資料庫連接",
      latestLeadAt: null,
      sourceSnapshots: 0,
      leadEvents: 0,
      trackingStatus: [],
      error: null,
    };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const [snapshots, events, tracking, latestLead] = await Promise.all([
      supabase
        .from("lead_source_snapshots")
        .select("*", { count: "exact", head: true }),
      supabase.from("lead_events").select("*", { count: "exact", head: true }),
      supabase.from("lead_source_snapshots").select("tracking_status").limit(5000),
      supabase
        .from("leads")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    if (snapshots.error) throw snapshots.error;
    if (events.error) throw events.error;
    if (tracking.error) throw tracking.error;
    if (latestLead.error) throw latestLead.error;

    return {
      status: "系統狀態：資料庫已連接",
      latestLeadAt: latestLead.data?.[0]?.created_at ?? null,
      sourceSnapshots: snapshots.count ?? 0,
      leadEvents: events.count ?? 0,
      trackingStatus: countBy(tracking.data ?? [], "tracking_status"),
      error: null,
    };
  } catch (error) {
    return {
      status: "系統狀態：資料庫已設定，但讀取失敗",
      latestLeadAt: null,
      sourceSnapshots: 0,
      leadEvents: 0,
      trackingStatus: [],
      error: error instanceof Error ? error.message : "unknown_query_error",
    };
  }
}

export default async function SystemAuditPage() {
  const summary = await getAuditSummary();

  return (
    <main className="alyssa-shell">
      <AppNav showInternalWarning />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <section className="rounded-[28px] border border-[#ead9cf] bg-white/82 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.1)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
            System audit
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[#321428]">
            來源追蹤稽核
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
            呢頁保留技術 source / event / tracking 稽核資料，避免主 dashboard
            被 developer terminology 佔據。
          </p>
          <p className="mt-4 rounded-2xl bg-[#fff6f0] px-4 py-3 text-sm font-bold text-[#5a2348]">
            {summary.status}
          </p>
          {summary.error && (
            <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              資料讀取失敗：{summary.error}
            </p>
          )}
        </section>

        <section className="mt-6 grid gap-3 md:grid-cols-3">
          <AuditCard label="Source snapshots" value={summary.sourceSnapshots} />
          <AuditCard label="Lead events" value={summary.leadEvents} />
          <AuditCard
            label="Latest lead"
            value={formatDateTime(summary.latestLeadAt)}
          />
        </section>

        <section className="mt-6 rounded-[24px] border border-[#ead9cf] bg-white/82 p-5 shadow-sm">
          <h2 className="text-xl font-bold text-[#321428]">
            tracking_status distribution
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {summary.trackingStatus.length > 0 ? (
              summary.trackingStatus.map((item) => (
                <div key={item.label} className="rounded-2xl bg-[#fff6f0] p-4">
                  <p className="font-mono text-xs font-bold text-[#5a2348]">
                    {item.label}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-[#321428]">
                    {item.count}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm font-semibold text-[#7b5a6a]">
                未有 tracking_status 資料。
              </p>
            )}
          </div>
        </section>

        <section className="mt-6 rounded-[24px] border border-[#ead9cf] bg-white/82 p-5 shadow-sm">
          <h2 className="text-xl font-bold text-[#321428]">
            CRM outcome events pending
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">
            以下 event names 會由未來獨立 WhatsApp CRM app 回寫；目前只作 contract
            visibility，不代表已有 CRM outcome metrics。
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
      </div>
    </main>
  );
}

function AuditCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-[#ead9cf] bg-white/82 p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {label}
      </p>
      <p className="mt-2 text-xl font-bold text-[#321428]">{value}</p>
    </div>
  );
}
