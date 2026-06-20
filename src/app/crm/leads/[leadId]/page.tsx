import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { CrmStatusBadge } from "@/components/crm/CrmStatusBadge";
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
    <CrmShell>
      <div className="flex h-screen min-w-0 flex-col">
        <header className="shrink-0 border-b border-[#e5e7eb] bg-white px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <Link
                href="/crm"
                className="text-xs font-bold text-[#64748b] transition hover:text-[#111827]"
              >
                Back to Inbox
              </Link>
              <div className="mt-2 flex min-w-0 flex-wrap items-center gap-3">
                <h1 className="truncate text-xl font-bold text-[#111827]">
                  {leadCase.customerName}
                </h1>
                <CrmStatusBadge status={leadCase.status} label={leadCase.statusLabel} />
              </div>
              <p className="mt-1 truncate text-xs font-semibold text-[#64748b]">
                Phone-first identity: {leadCase.canonicalIdentity}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {leadCase.whatsappUrl ? (
                <a
                  href={leadCase.whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 whitespace-nowrap rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-3 text-xs font-black text-[#15803d] transition hover:bg-[#dcfce7]"
                >
                  <span className="self-center">WA</span>
                </a>
              ) : (
                <span className="inline-flex h-9 whitespace-nowrap rounded-lg border border-[#e5e7eb] bg-[#f8fafc] px-3 text-xs font-bold text-[#94a3b8]">
                  <span className="self-center">No WhatsApp</span>
                </span>
              )}
              <button
                type="button"
                disabled
                className="h-9 whitespace-nowrap rounded-lg bg-[#e5e7eb] px-3 text-xs font-bold text-[#94a3b8]"
              >
                Update status
              </button>
            </div>
          </div>
          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              CRM detail could not refresh all latest records.
            </p>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
            <div className="grid gap-4">
              <Panel title="Contact">
                <InfoLine label="Name" value={leadCase.customerName} />
                <InfoLine label="Phone" value={leadCase.phone} />
                <InfoLine label="Normalized" value={leadCase.normalizedPhone} />
                <InfoLine label="Brand" value={leadCase.brandName} />
                <InfoLine label="Assigned to" value={leadCase.assignedCsLabel} />
                <InfoLine label="Next follow-up" value={leadCase.nextFollowUpLabel} />
              </Panel>

              <Panel title="Treatment / Booking">
                <InfoLine label="Offer" value={leadCase.treatmentOffer} />
                <InfoLine label="Package" value={leadCase.packagePrice} />
                <InfoLine label="Branch" value={leadCase.branchName} />
                <InfoLine label="Appointment" value={leadCase.appointmentLabel} />
                <InfoLine label="Created" value={leadCase.createdLabel} />
                <InfoLine label="Last activity" value={leadCase.lastActivityLabel} />
              </Panel>
            </div>

            <div className="grid gap-4">
              <div className="grid gap-4 2xl:grid-cols-2">
                <Panel title="Source">
                  <InfoLine label="CRM source" value={leadCase.sourceLabel} />
                  <InfoLine label="Raw source type" value={leadCase.sourceTypeRaw} />
                  <InfoLine label="Landing page" value={leadCase.landingPageSlug || "-"} />
                  <InfoLine label="Page URL" value={leadCase.pageUrl || "-"} />
                  <InfoLine label="Campaign" value={leadCase.campaignLabel} />
                  <InfoLine label="Ad / Content" value={leadCase.adLabel} />
                </Panel>

                <Panel title="CTWA / WhatsApp Ad">
                  {hasCtwa ? (
                    <>
                      <InfoLine label="CTWA Source ID" value={leadCase.ctwa.ctwa_source_id || "-"} />
                      <InfoLine label="CTWA Source URL" value={leadCase.ctwa.ctwa_source_url || "-"} />
                      <InfoLine
                        label="Headline"
                        value={leadCase.ctwa.ctwa_referral_headline || "-"}
                      />
                      <InfoLine label="Body" value={leadCase.ctwa.ctwa_referral_body || "-"} />
                      <InfoLine label="Campaign ID" value={leadCase.ctwa.campaign_id || "-"} />
                      <InfoLine label="Ad Set ID" value={leadCase.ctwa.adset_id || "-"} />
                      <InfoLine label="Ad ID" value={leadCase.ctwa.ad_id || "-"} />
                      <InfoLine
                        label="Phone Number ID"
                        value={leadCase.ctwa.phone_number_id || "-"}
                      />
                    </>
                  ) : (
                    <p className="text-xs leading-5 text-[#64748b]">
                      No CTWA referral data yet. WhatsApp webhook/API can enrich this block later.
                    </p>
                  )}
                </Panel>
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                <Placeholder title="Timeline" body="Form submit, WhatsApp messages, bookings, and status changes will appear here later." />
                <Placeholder title="Notes" body="Internal notes are reserved for the CRM write phase." />
                <Placeholder title="Booking" body="Confirmation, reschedule, show, no-show, and paid outcomes will be CRM write actions later." />
                <Placeholder title="Quick Replies" body="Brand-approved replies will be selectable here later." />
                <Placeholder title="AI Reply Suggestions" body="AI suggestions will use brand knowledge and conversation context later." />
                <Placeholder title="Status Pipeline" body="new, contacting, booked, confirmed, showed, paid, no_show, lost, invalid." />
                <Placeholder title="Brand Knowledge" body="Treatment FAQ, policies, and brand information will support CS and AI responses." />
                <Placeholder title="Intent / Tagging" body="Inquiry intent, objections, budget, and treatment tags are reserved." />
                <Placeholder title="Next Best Action" body="Future CRM can recommend WhatsApp follow-up, booking confirmation, or payment reminders." />
              </div>
            </div>
          </div>
        </div>
      </div>
    </CrmShell>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[#e5e7eb] bg-white shadow-sm">
      <div className="border-b border-[#eef2f6] px-4 py-3">
        <h2 className="text-sm font-bold text-[#111827]">{title}</h2>
      </div>
      <div className="grid gap-2 p-4">{children}</div>
    </section>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-lg bg-[#f8fafc] px-3 py-2 sm:grid-cols-[130px_1fr]">
      <dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#64748b]">
        {label}
      </dt>
      <dd className="min-w-0 break-words text-xs font-semibold text-[#111827]">
        {value}
      </dd>
    </div>
  );
}

function Placeholder({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-xl border border-dashed border-[#cbd5e1] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-[#111827]">{title}</h2>
        <span className="rounded-full bg-[#f1f5f9] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#64748b]">
          Later
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-[#64748b]">{body}</p>
      <button
        type="button"
        disabled
        className="mt-3 h-8 whitespace-nowrap rounded-lg bg-[#e5e7eb] px-3 text-[11px] font-bold text-[#94a3b8]"
      >
        Coming soon
      </button>
    </section>
  );
}
