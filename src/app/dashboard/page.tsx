import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type DashboardStatus = "local_noop" | "connected" | "query_failed";

type CountItem = {
  label: string;
  count: number;
};

type DashboardSummary = {
  status: DashboardStatus;
  statusLabel: string;
  statusDescription: string;
  latestLeadAt: string | null;
  errorMessage: string | null;
  totals: {
    leads: number;
    contacts: number;
    sourceSnapshots: number;
    bookings: number;
    leadEvents: number;
  };
  leadsBySourceType: CountItem[];
  leadsByPaymentStatus: CountItem[];
  snapshotsByTrackingStatus: CountItem[];
};

const sourceTypes = [
  ["reg_form_utm", "表格提交並帶有 UTM / click ID / parent page 來源資料"],
  ["whatsapp_ctwa", "WhatsApp Click-to-Ads 或 referral metadata 來源"],
  ["organic_unknown", "未有可靠 UTM、click ID 或 CTWA 訊號"],
  ["manual", "日後由 CRM 同事手動建立"],
  ["imported", "由 spreadsheet 或舊系統匯入"],
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

const emptyTotals = {
  leads: 0,
  contacts: 0,
  sourceSnapshots: 0,
  bookings: 0,
  leadEvents: 0,
};

function countBy<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  const counts = new Map<string, number>();

  rows.forEach((row) => {
    const value = typeof row[key] === "string" && row[key] ? row[key] : "未設定";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });

  return Array.from(counts, ([label, count]) => ({ label, count })).sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label)
  );
}

async function countRows(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  table: string
) {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });

  if (error) throw error;
  return count ?? 0;
}

async function getDashboardSummary(): Promise<DashboardSummary> {
  if (!hasSupabaseAdminEnv()) {
    return {
      status: "local_noop",
      statusLabel: "本機模式：等待 Supabase",
      statusDescription:
        "目前未偵測到 Supabase server env vars，dashboard 只顯示 schema / API readiness，不顯示假數字。",
      latestLeadAt: null,
      errorMessage: null,
      totals: emptyTotals,
      leadsBySourceType: [],
      leadsByPaymentStatus: [],
      snapshotsByTrackingStatus: [],
    };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const [
      leads,
      contacts,
      sourceSnapshots,
      bookings,
      leadEvents,
      leadRowsResult,
      snapshotRowsResult,
    ] = await Promise.all([
      countRows(supabase, "leads"),
      countRows(supabase, "contacts"),
      countRows(supabase, "lead_source_snapshots"),
      countRows(supabase, "bookings"),
      countRows(supabase, "lead_events"),
      supabase
        .from("leads")
        .select("source_type,payment_status,created_at")
        .order("created_at", { ascending: false })
        .limit(5000),
      supabase
        .from("lead_source_snapshots")
        .select("tracking_status")
        .limit(5000),
    ]);

    if (leadRowsResult.error) throw leadRowsResult.error;
    if (snapshotRowsResult.error) throw snapshotRowsResult.error;

    const leadRows = leadRowsResult.data ?? [];
    const snapshotRows = snapshotRowsResult.data ?? [];

    return {
      status: "connected",
      statusLabel: "Supabase 已連接：live data-backed",
      statusDescription:
        "Dashboard 正在讀取 Supabase contacts、leads、source snapshots、bookings 同 lead events。以下數字來自實際資料表。",
      latestLeadAt: leadRows[0]?.created_at ?? null,
      errorMessage: null,
      totals: {
        leads,
        contacts,
        sourceSnapshots,
        bookings,
        leadEvents,
      },
      leadsBySourceType: countBy(leadRows, "source_type"),
      leadsByPaymentStatus: countBy(leadRows, "payment_status"),
      snapshotsByTrackingStatus: countBy(snapshotRows, "tracking_status"),
    };
  } catch (error) {
    return {
      status: "query_failed",
      statusLabel: "Supabase 已配置，但 dashboard query failed",
      statusDescription:
        "已偵測到 Supabase env vars，但 dashboard 讀取資料時失敗。請檢查 Vercel env、service role key、RLS / table 權限或 Supabase 連線狀態。",
      latestLeadAt: null,
      errorMessage: error instanceof Error ? error.message : "unknown_query_error",
      totals: emptyTotals,
      leadsBySourceType: [],
      leadsByPaymentStatus: [],
      snapshotsByTrackingStatus: [],
    };
  }
}

function formatDateTime(value: string | null) {
  if (!value) return "未有 lead";

  return new Intl.DateTimeFormat("zh-HK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Hong_Kong",
  }).format(new Date(value));
}

export default async function DashboardPage() {
  const summary = await getDashboardSummary();
  const dataState = [
    ["目前資料", summary.status === "connected" ? "Supabase live records" : "local_noop / no live data"],
    ["Live Supabase", summary.statusLabel],
    [
      "Dashboard 數字",
      summary.status === "connected" ? "實際資料表聚合" : "不顯示假數字",
    ],
    ["Latest lead", formatDateTime(summary.latestLeadAt)],
  ];

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <section className="rounded-[28px] border border-[#ead9cf] bg-white/82 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.1)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
                內部增長儀表板
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#321428]">
                Alyssa Lead Capture OS
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
                成效儀表板以 shared lead/source model 為核心：source snapshot
                負責解釋 lead 從邊度嚟，bookings、payments 同日後 CRM outcome
                則負責解釋之後發生咗咩結果。
              </p>
            </div>
            <div className="rounded-2xl border border-[#ead9cf] bg-[#fff6f0] px-4 py-3 text-sm font-semibold text-[#5a2348]">
              資料狀態：{summary.statusLabel}
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-4">
            <ReadinessCard label="Public form" value="production path ready" />
            <ReadinessCard label="Source snapshots" value="schema ready" />
            <ReadinessCard label="Lead events" value="schema ready" />
            <ReadinessCard label="CRM feedback" value="future CRM pending" />
          </div>
        </section>

        <section className="mt-6 rounded-[24px] border border-[#ead9cf] bg-[#fff6f0] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
            Data state
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {dataState.map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-white/80 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
                  {label}
                </p>
                <p className="mt-2 text-sm font-bold text-[#5a2348]">{value}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm leading-6 text-[#6d4a5c]">
            {summary.statusDescription}
          </p>
          {summary.errorMessage && (
            <p className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              Query error: {summary.errorMessage}
            </p>
          )}
        </section>

        <section className="mt-6 grid gap-3 md:grid-cols-5">
          <MetricCard label="Total leads" value={summary.totals.leads} />
          <MetricCard label="Contacts" value={summary.totals.contacts} />
          <MetricCard
            label="Source snapshots"
            value={summary.totals.sourceSnapshots}
          />
          <MetricCard label="Bookings" value={summary.totals.bookings} />
          <MetricCard label="Lead events" value={summary.totals.leadEvents} />
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-3">
          <CountPanel
            title="Leads by source_type"
            emptyText="未有 live leads"
            items={summary.leadsBySourceType}
          />
          <CountPanel
            title="Leads by payment_status"
            emptyText="未有 live leads"
            items={summary.leadsByPaymentStatus}
          />
          <CountPanel
            title="Snapshots by tracking_status"
            emptyText="未有 source snapshots"
            items={summary.snapshotsByTrackingStatus}
          />
        </section>

        <section className="mt-6 rounded-[24px] border border-[#ead9cf] bg-white/82 p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
            Source type 定義
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {sourceTypes.map(([sourceType, description]) => (
              <div key={sourceType} className="rounded-2xl bg-[#fff6f0] p-4">
                <p className="font-mono text-xs font-bold text-[#5a2348]">
                  {sourceType}
                </p>
                <p className="mt-2 text-xs leading-5 text-[#7b5a6a]">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-2">
          <ReadOnlyPanel
            title="來源成效"
            eyebrow="來源追蹤"
            description="按 source_type、UTM、click IDs 同 CTWA evidence 分析 Alyssa leads 從邊度嚟。"
            items={[
              "上方 source_type / tracking_status 聚合已讀 live Supabase 資料",
              "UTM、click ID、CTWA 細分會保留在 source snapshots / dashboard views",
              "Campaign-level conversion 會等待更多 live records 及 CRM outcome 回寫",
            ]}
            badge="live base ready"
          />
          <ReadOnlyPanel
            title="預約 / 付款結果"
            eyebrow="業務結果"
            description="booking_only 代表未開始 payment flow；price 仍然係所選 package display price。CRM outcome 未接入前，不展示假 conversion。"
            items={[
              "bookings 已計入 live Supabase total",
              "payment_status 已以 live leads 聚合顯示",
              "show / no-show / paid / lost conversion 等待 future CRM app 回寫",
            ]}
            badge="partial live"
          />
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <ReadOnlyPanel
            title="追蹤稽核"
            eyebrow="資料品質"
            description="檢查 UTM 缺失、部分追蹤、CTWA-only leads、重複 leads 同 event timeline。"
            items={[
              "tracking_status 聚合已讀 live source snapshots",
              "complete_utm / partial_utm / organic_unknown 等技術值保持原名",
              "詳細 audit trail 仍保留在 lead_events 同 source snapshots",
            ]}
            badge="live audit base"
          />
          <section className="rounded-[24px] border border-[#ead9cf] bg-white/82 p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
              CRM 回寫結果
            </p>
            <h2 className="mt-2 text-xl font-bold text-[#321428]">
              為 WhatsApp CRM 預留的 outcome events
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">
              這裡仍然等待未來獨立 WhatsApp CRM app 回寫 outcome events。
              現時 dashboard 只顯示 Lead Capture OS 已有的 live base records，
              不會假裝已經有 CRM follow-up、show/no-show 或 lost conversion。
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
                Live submit path
              </p>
              <h2 className="mt-2 text-xl font-bold text-[#321428]">
                本機同 Vercel production submit 已可寫入 Supabase
              </h2>
            </div>
            <Link
              href="/embed-preview"
              className="rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white"
            >
              開啟嵌入預覽
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

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#ead9cf] bg-white/82 p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold text-[#321428]">{value}</p>
    </div>
  );
}

function CountPanel({
  title,
  emptyText,
  items,
}: {
  title: string;
  emptyText: string;
  items: CountItem[];
}) {
  return (
    <section className="rounded-[24px] border border-[#ead9cf] bg-white/82 p-5 shadow-sm">
      <h2 className="text-lg font-bold text-[#321428]">{title}</h2>
      <div className="mt-4 divide-y divide-[#ead9cf]">
        {items.length > 0 ? (
          items.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between gap-4 py-3"
            >
              <span className="break-all font-mono text-xs font-bold text-[#5a2348]">
                {item.label}
              </span>
              <span className="rounded-full bg-[#fff6f0] px-3 py-1 text-sm font-bold text-[#9a5d76]">
                {item.count}
              </span>
            </div>
          ))
        ) : (
          <p className="text-sm font-semibold text-[#7b5a6a]">{emptyText}</p>
        )}
      </div>
    </section>
  );
}

function ReadOnlyPanel({
  title,
  eyebrow,
  description,
  items,
  badge,
}: {
  title: string;
  eyebrow: string;
  description: string;
  items: string[];
  badge: string;
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
              {badge}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
