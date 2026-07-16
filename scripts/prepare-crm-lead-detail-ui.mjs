import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(repoRoot, "src/app/crm/leads/[leadId]/page.tsx");
let source = await readFile(target, "utf8");

const replacements = [
  [
`            <BookingSummaryPanel
              leadCase={leadCase}
              confirmedAppointmentLabel={confirmedAppointmentLabel}
              hasConfirmedBooking={hasConfirmedBooking}
            />
`,
`            <section className="rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#6366f1]">Customer workspace</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-bold text-[#334155]">
                    <span>{leadCase.phone}</span>
                    <span>{leadCase.treatmentOffer}</span>
                    <span>{leadCase.branchName}</span>
                    <span>偏好：{leadCase.appointmentLabel}</span>
                  </div>
                </div>
                <div className="grid gap-1 text-right text-xs font-bold text-[#64748b]">
                  <span>負責 CS：{leadCase.assignedCsLabel}</span>
                  <span>已確認：{confirmedAppointmentLabel}</span>
                </div>
              </div>
            </section>
`
  ],
  [
`                <ReplyComposer
                  quickReplies={crmSettings.quickReplyTemplates}
                  aiDrafts={aiReplyDrafts}
                  context={{
                    customerName: leadCase.customerName,
                    brandName: leadCase.brandName,
                    treatmentOffer: leadCase.treatmentOffer,
                    statusLabel: leadCase.statusLabel,
                    appointmentPreference: leadCase.appointmentLabel,
                    confirmedAppointment: confirmedAppointmentLabel,
                    latestContactNote,
                    whatsappUrl: leadCase.whatsappUrl,
                  }}
                />

`,
``
  ],
  [
`                <section id="timeline">
                  <TimelinePanel interactions={bundle.interactions} />
                </section>
`,
`                <details id="timeline" className="rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
                  <summary className="cursor-pointer text-sm font-black text-[#334155]">活動紀錄與表格提交</summary>
                  <div className="mt-3">
                    <TimelinePanel interactions={bundle.interactions} />
                  </div>
                </details>
`
  ],
  [
`                <Panel title="Customer">
                  <InfoLine label="Name" value={leadCase.customerName} />
                  <InfoLine label="Phone" value={leadCase.phone} />
                  <InfoLine label="Email" value={leadCase.email} />
                  <InfoLine label="Brand" value={leadCase.brandName} />
                  <InfoLine label="Assigned to" value={leadCase.assignedCsLabel} />
                </Panel>

`,
``
  ],
  [
`                  <InfoLine label="Room" value={bookingMeta.roomArrangement || "-"} />
`,
``
  ],
  [
`                  <ManualWhatsAppPanel leadCase={leadCase} />
`,
``
  ],
  [
`                className="inline-flex h-8 whitespace-nowrap rounded-md border border-[#bbf7d0] bg-[#f0fdf4] px-2.5 text-[10px] font-black text-[#15803d] transition hover:bg-[#dcfce7]"
              >
                <span className="self-center">WA</span>
`,
`                className="inline-flex h-9 items-center whitespace-nowrap rounded-lg border border-[#86efac] bg-[#16a34a] px-3 text-xs font-black text-white shadow-sm transition hover:bg-[#15803d]"
              >
                WhatsApp 客人
`
  ],
];

for (const [from, to] of replacements) {
  if (source.includes(to) && !from) continue;
  if (!source.includes(from)) {
    if (source.includes(to)) continue;
    throw new Error(`Lead detail source changed; missing verified block: ${from.slice(0, 80)}`);
  }
  source = source.replace(from, to);
}

await writeFile(target, source, "utf8");
console.log("Prepared streamlined CRM lead detail workspace.");
