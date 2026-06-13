import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";

const sourcePerformance = [
  "按 source_type 分析 leads",
  "UTM source / medium / campaign 成效",
  "Click ID 覆蓋率",
  "CTWA 資料覆蓋率",
  "Organic / unknown leads 比例",
  "tracking_status 分佈",
  "UTM 缺失率",
];

const outcomePerformance = [
  "已提交預約數",
  "已確認預約數",
  "已付款 leads",
  "只預約未付款 leads",
  "付款失敗 leads",
  "已付款收入",
  "Campaign 至預約轉化",
];

const attributionAudit = [
  "完整 UTM",
  "部分 UTM",
  "只有 Click ID",
  "只有 CTWA",
  "沒有來源訊號",
  "重複 leads",
  "source snapshot 詳情",
  "lead / contact event timeline",
];

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

const dataState = [
  ["目前資料", "本機 seed / local no-op"],
  ["Live Supabase", "尚未連接"],
  ["Dashboard 數字", "等待正式資料"],
  ["Production path", "API / schema 已預留"],
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
              資料狀態：本機預覽，等待連接 Supabase
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-4">
            <ReadinessCard label="Public form" value="production path ready" />
            <ReadinessCard label="Source snapshots" value="schema ready" />
            <ReadinessCard label="Lead events" value="schema ready" />
            <ReadinessCard label="CRM feedback" value="contract reserved" />
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
          <DashboardPanel
            title="來源成效"
            eyebrow="來源追蹤"
            description="按 source_type、UTM、click IDs 同 CTWA evidence 分析 Alyssa leads 從邊度嚟。"
            items={sourcePerformance}
          />
          <DashboardPanel
            title="預約 / 付款結果"
            eyebrow="業務結果"
            description="預約同付款結果會連返原本 source snapshot，用嚟判斷邊個 campaign 真正帶來結果。"
            items={outcomePerformance}
          />
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <DashboardPanel
            title="追蹤稽核"
            eyebrow="資料品質"
            description="檢查 UTM 缺失、部分追蹤、CTWA-only leads、重複 leads 同 event timeline。"
            items={attributionAudit}
          />
          <section className="rounded-[24px] border border-[#ead9cf] bg-white/82 p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
              CRM 回寫結果
            </p>
            <h2 className="mt-2 text-xl font-bold text-[#321428]">
              為 WhatsApp CRM 預留的 outcome events
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">
              這裡不是假數據，而是日後獨立 CRM 會寫回來的 event names。
              儀表板可以用這些 events 計算 confirmed appointments、show/no-show、
              paid deals 同 lost leads。
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
                本機測試
              </p>
              <h2 className="mt-2 text-xl font-bold text-[#321428]">
                先測試來源追蹤，再連接正式資料
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
              等待正式資料
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
