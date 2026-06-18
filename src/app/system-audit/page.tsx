import { AppNav } from "@/components/alyssa/AppNav";
import {
  getAdminBaseUrl,
  getPublicBaseUrl,
  getPublicLandingPageUrl,
} from "@/lib/data/appUrl";
import { alyssaDefaultForm } from "@/lib/data/alyssaConfig";
import { countBy, formatDateTime } from "@/lib/data/businessMetrics";
import { getFormByIdOrSlug } from "@/lib/data/formManagement";
import { getPublishedLandingPageBySlug } from "@/lib/data/landingPageStore";
import { getGoogleSheetsLeadSyncStatus } from "@/lib/integrations/googleSheetsLeadSync";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";

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

type CheckTone = "ready" | "missing" | "attention";

function envPresent(name: string) {
  return Boolean(process.env[name]?.trim());
}

function statusLabel(tone: CheckTone) {
  if (tone === "ready") return "已設定";
  if (tone === "missing") return "未設定";
  return "需要檢查";
}

async function getAuditSummary() {
  if (!hasSupabaseAdminEnv()) {
    return {
      status: "Supabase 未完整設定",
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
      status: "Supabase 查詢正常",
      latestLeadAt: latestLead.data?.[0]?.created_at ?? null,
      sourceSnapshots: snapshots.count ?? 0,
      leadEvents: events.count ?? 0,
      trackingStatus: countBy(tracking.data ?? [], "tracking_status"),
      error: null,
    };
  } catch (error) {
    return {
      status: "Supabase 已設定，但查詢失敗",
      latestLeadAt: null,
      sourceSnapshots: 0,
      leadEvents: 0,
      trackingStatus: [],
      error: error instanceof Error ? error.message : "unknown_query_error",
    };
  }
}

async function getReadinessChecks() {
  const mainForm = await getFormByIdOrSlug(alyssaDefaultForm.publicFormToken);
  const publicLp = await getPublishedLandingPageBySlug("alyssa-main-trial-offer");
  const sheetsStatus = getGoogleSheetsLeadSyncStatus();

  return [
    {
      label: "Supabase URL",
      detail: "NEXT_PUBLIC_SUPABASE_URL",
      tone: envPresent("NEXT_PUBLIC_SUPABASE_URL") ? "ready" : "missing",
    },
    {
      label: "Supabase anon key",
      detail: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      tone: envPresent("NEXT_PUBLIC_SUPABASE_ANON_KEY") ? "ready" : "missing",
    },
    {
      label: "Supabase service role key",
      detail: "server-side only",
      tone: envPresent("SUPABASE_SERVICE_ROLE_KEY") ? "ready" : "missing",
    },
    {
      label: "App URL",
      detail: "NEXT_PUBLIC_APP_URL",
      tone: envPresent("NEXT_PUBLIC_APP_URL") ? "ready" : "attention",
    },
    {
      label: "Public base URL",
      detail: getPublicBaseUrl(),
      tone: "ready",
    },
    {
      label: "Admin base URL",
      detail: getAdminBaseUrl(),
      tone: "ready",
    },
    {
      label: "Admin access",
      detail: "open internal backend",
      tone: "ready",
    },
    {
      label: "Google Sheets lead sync",
      detail: sheetsStatus.label,
      tone:
        sheetsStatus.status === "enabled"
          ? "ready"
          : sheetsStatus.status === "disabled"
            ? "attention"
            : "missing",
    },
    {
      label: "Main form token",
      detail: alyssaDefaultForm.publicFormToken,
      tone: mainForm.form ? "ready" : "missing",
    },
    {
      label: "Public form lookup",
      detail: mainForm.form ? "lookup ok" : "lookup failed",
      tone: mainForm.form ? "ready" : "missing",
    },
    {
      label: "Landing page route",
      detail: getPublicLandingPageUrl("alyssa-main-trial-offer"),
      tone: publicLp ? "ready" : "missing",
    },
  ] satisfies Array<{ label: string; detail: string; tone: CheckTone }>;
}

export default async function SystemAuditPage() {
  const [summary, readinessChecks] = await Promise.all([
    getAuditSummary(),
    getReadinessChecks(),
  ]);

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <section className="rounded-[28px] border border-[#ead9cf] bg-white/82 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.1)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
            System audit
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[#321428]">
            系統稽核
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
            技術檢查、來源追蹤分佈和 production trial readiness。
          </p>
          <p className="mt-4 rounded-2xl bg-[#fff6f0] px-4 py-3 text-sm font-bold text-[#5a2348]">
            {summary.status}
          </p>
          {summary.error && (
            <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              查詢錯誤：{summary.error}
            </p>
          )}
        </section>

        <section className="mt-6 rounded-[24px] border border-[#ead9cf] bg-white/82 p-5 shadow-sm">
          <h2 className="text-xl font-bold text-[#321428]">
            Production readiness
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {readinessChecks.map((item) => (
              <ReadinessCard key={item.label} {...item} />
            ))}
          </div>
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
                暫時未有 tracking_status 資料。
              </p>
            )}
          </div>
        </section>

        <section className="mt-6 rounded-[24px] border border-[#ead9cf] bg-white/82 p-5 shadow-sm">
          <h2 className="text-xl font-bold text-[#321428]">
            CRM outcome events pending
          </h2>
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

function ReadinessCard({
  label,
  detail,
  tone,
}: {
  label: string;
  detail: string;
  tone: CheckTone;
}) {
  return (
    <div className="rounded-2xl border border-[#ead9cf] bg-[#fff6f0] p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-bold text-[#321428]">{label}</p>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#5a2348]">
          {statusLabel(tone)}
        </span>
      </div>
      <p className="mt-2 break-words font-mono text-xs font-semibold text-[#7b5a6a]">
        {detail}
      </p>
    </div>
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
