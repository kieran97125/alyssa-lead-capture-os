import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AppNav } from "@/components/alyssa/AppNav";
import { MotionReveal } from "@/components/alyssa/MotionReveal";
import { getLeadRows } from "@/lib/data/businessMetrics";
import { toCrmLeadCase } from "@/lib/crm/leadOps";

export const dynamic = "force-dynamic";

export default async function CrmLeadDetailPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  const { leadId } = await params;
  const { leads, error } = await getLeadRows("month", 5000);
  const lead = leads.find((item) => item.id === leadId);

  if (!lead) notFound();

  const leadCase = toCrmLeadCase(lead);
  const hasCtwa = Object.values(leadCase.ctwa).some(Boolean);

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <MotionReveal>
          <section className="rounded-[28px] border border-[#ead9cf] bg-white/86 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.1)]">
            <Link
              href="/crm"
              className="text-sm font-bold text-[#9a5d76] transition hover:text-[#5a2348]"
            >
              ← 返回 CRM Inbox
            </Link>
            <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className="alyssa-kicker">LeadOps CRM Case</p>
                <h1 className="mt-2 text-3xl font-bold text-[#321428]">
                  {leadCase.customerName}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
                  Phone-first identity: {leadCase.canonicalIdentity}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {leadCase.whatsappUrl ? (
                  <a
                    href={leadCase.whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="alyssa-focus rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(228,111,100,0.24)] transition hover:-translate-y-0.5 hover:bg-[#d95f55]"
                  >
                    WhatsApp 跟進
                  </a>
                ) : (
                  <span className="rounded-full border border-[#ead9cf] bg-white px-5 py-3 text-sm font-bold text-[#9a5d76]">
                    未有 WhatsApp 電話
                  </span>
                )}
                <button
                  type="button"
                  disabled
                  className="rounded-full border border-[#ead9cf] bg-white/70 px-5 py-3 text-sm font-bold text-[#9a5d76]"
                >
                  更新狀態稍後加入
                </button>
              </div>
            </div>
            {error && (
              <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                CRM 詳情讀取時有部分資料未能更新。
              </p>
            )}
          </section>
        </MotionReveal>

        <section className="mt-6 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <MotionReveal delay={0.06}>
            <InfoCard title="Contact Summary">
              <InfoLine label="客人姓名" value={leadCase.customerName} />
              <InfoLine label="電話" value={leadCase.phone} />
              <InfoLine label="Normalized phone" value={leadCase.normalizedPhone} />
              <InfoLine label="品牌" value={leadCase.brandName} />
              <InfoLine label="狀態" value={leadCase.statusLabel} />
              <InfoLine label="CS 負責人" value={leadCase.assignedCsLabel} />
              <InfoLine label="下次跟進" value={leadCase.nextFollowUpLabel} />
            </InfoCard>
          </MotionReveal>

          <MotionReveal delay={0.1}>
            <InfoCard title="Lead Context">
              <InfoLine label="療程 / Offer" value={leadCase.treatmentOffer} />
              <InfoLine label="套餐 / 價錢" value={leadCase.packagePrice} />
              <InfoLine label="分店" value={leadCase.branchName} />
              <InfoLine label="預約日期時間" value={leadCase.appointmentLabel} />
              <InfoLine label="Created" value={leadCase.createdLabel} />
              <InfoLine label="Last activity" value={leadCase.lastActivityLabel} />
            </InfoCard>
          </MotionReveal>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-2">
          <MotionReveal delay={0.14}>
            <InfoCard title="Source Summary">
              <InfoLine label="CRM source type" value={leadCase.sourceLabel} />
              <InfoLine label="Raw source type" value={leadCase.sourceTypeRaw} />
              <InfoLine label="Landing page slug" value={leadCase.landingPageSlug || "—"} />
              <InfoLine label="Page URL" value={leadCase.pageUrl || "—"} />
              <InfoLine label="Campaign" value={leadCase.campaignLabel} />
              <InfoLine label="Ad / Content" value={leadCase.adLabel} />
            </InfoCard>
          </MotionReveal>

          <MotionReveal delay={0.18}>
            <InfoCard title="CTWA / WhatsApp Ad Context">
              {hasCtwa ? (
                <>
                  <InfoLine label="CTWA Source ID" value={leadCase.ctwa.ctwa_source_id || "—"} />
                  <InfoLine label="CTWA Source URL" value={leadCase.ctwa.ctwa_source_url || "—"} />
                  <InfoLine
                    label="Referral headline"
                    value={leadCase.ctwa.ctwa_referral_headline || "—"}
                  />
                  <InfoLine
                    label="Referral body"
                    value={leadCase.ctwa.ctwa_referral_body || "—"}
                  />
                  <InfoLine label="Campaign ID" value={leadCase.ctwa.campaign_id || "—"} />
                  <InfoLine label="Ad Set ID" value={leadCase.ctwa.adset_id || "—"} />
                  <InfoLine label="Ad ID" value={leadCase.ctwa.ad_id || "—"} />
                  <InfoLine
                    label="Phone Number ID"
                    value={leadCase.ctwa.phone_number_id || "—"}
                  />
                </>
              ) : (
                <p className="text-sm leading-6 text-[#6d4a5c]">
                  暫時未有 WhatsApp 廣告來源資料。日後 WhatsApp webhook/API 接入後會顯示更多廣告及對話來源。
                </p>
              )}
            </InfoCard>
          </MotionReveal>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-3">
          <Placeholder title="Timeline" body="日後會顯示表格提交、WhatsApp 訊息、預約及狀態變更。" />
          <Placeholder title="Notes" body="內部備註會於 CRM 寫入階段加入。" />
          <Placeholder title="Booking" body="預約確認、改期、到店及 no-show 會由 CRM 回寫。" />
          <Placeholder title="Quick Replies" body="品牌常用回覆會在此選擇，現階段未啟用。" />
          <Placeholder title="AI Reply Suggestions" body="日後根據品牌知識及對話內容提供建議回覆。" />
          <Placeholder title="Status Pipeline" body="new、contacting、booked、confirmed、showed、paid、no_show、lost、invalid。" />
          <Placeholder title="Brand Knowledge" body="品牌資料、療程 FAQ、注意事項會供 CS 及 AI 回覆使用。" />
          <Placeholder title="Intent / Tagging" body="日後可標記查詢意圖、預算、疑慮及療程興趣。" />
          <Placeholder title="Next Best Action" body="日後會建議下一步跟進，例如 WhatsApp、預約確認或付款提醒。" />
        </section>
      </div>
    </main>
  );
}

function InfoCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="alyssa-premium-card min-w-0 p-5">
      <h2 className="text-xl font-bold text-[#321428]">{title}</h2>
      <div className="mt-4 grid gap-3">{children}</div>
    </section>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-2xl bg-[#fff6f0] px-4 py-3 sm:grid-cols-[180px_1fr] sm:gap-4">
      <dt className="text-xs font-bold uppercase tracking-[0.14em] text-[#9a5d76]">
        {label}
      </dt>
      <dd className="min-w-0 break-words text-sm font-semibold text-[#5a2348]">
        {value}
      </dd>
    </div>
  );
}

function Placeholder({ title, body }: { title: string; body: string }) {
  return (
    <MotionReveal>
      <section className="alyssa-premium-card min-w-0 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-[#321428]">{title}</h2>
          <span className="rounded-full border border-[#ead9cf] bg-white px-3 py-1 text-xs font-bold text-[#9a5d76]">
            預留
          </span>
        </div>
        <p className="mt-3 text-sm leading-6 text-[#6d4a5c]">{body}</p>
        <button
          type="button"
          disabled
          className="mt-4 rounded-full border border-[#ead9cf] bg-white/70 px-4 py-2 text-xs font-bold text-[#9a5d76]"
        >
          功能稍後加入
        </button>
      </section>
    </MotionReveal>
  );
}
