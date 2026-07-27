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
`            <section className="overflow-hidden rounded-2xl border border-[#dbe4f0] bg-white shadow-sm">
              <div className="border-b border-[#eef2f7] bg-gradient-to-r from-[#f8f7ff] via-white to-[#f0fdf4] px-5 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6366f1]">Customer 360</p>
                    <h2 className="mt-1 text-lg font-black text-[#111827]">{leadCase.customerName}</h2>
                    <p className="mt-1 text-xs font-semibold text-[#64748b]">{leadCase.brandName} · {leadCase.treatmentOffer}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-black text-indigo-700">{leadCase.statusLabel}</span>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600">CS：{leadCase.assignedCsLabel}</span>
                  </div>
                </div>
              </div>
              <div className="grid gap-px bg-[#e8edf4] sm:grid-cols-2 xl:grid-cols-5">
                {[
                  ["電話 / WhatsApp", leadCase.phone],
                  ["療程 / Offer", leadCase.treatmentOffer],
                  ["分店", leadCase.branchName],
                  ["客人偏好", leadCase.appointmentLabel],
                  ["正式預約", confirmedAppointmentLabel],
                ].map(([label, value]) => (
                  <div key={label} className="bg-white px-4 py-3">
                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#94a3b8]">{label}</p>
                    <p className="mt-1 text-sm font-black leading-5 text-[#1e293b]">{value}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eef2f7] bg-[#fbfcfe] px-5 py-3">
                <p className="text-xs font-semibold text-[#64748b]">客人確認資料 ≠ 門店已確認預約；必須由 CS 完成 Confirm booking。</p>
                <a href="/crm/operations" className="text-xs font-black text-[#4f46e5] hover:text-[#3730a3]">查看營運狀態 →</a>
              </div>
            </section>
`
  ],
  [
`                <ConversationPanel
                  interactions={bundle.interactions}
                  leadCase={leadCase}
                  confirmedAppointmentLabel={confirmedAppointmentLabel}
                />

`,
``
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
`                <details id="timeline" className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
                  <summary className="cursor-pointer text-sm font-black text-[#334155]">活動紀錄、表格提交及系統事件</summary>
                  <p className="mt-1 text-xs font-semibold text-[#94a3b8]">日常操作毋須展開；需要追查紀錄時先查看。</p>
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
`                className="inline-flex h-9 items-center whitespace-nowrap rounded-xl border border-[#16a34a] bg-[#16a34a] px-4 text-xs font-black text-white shadow-sm transition hover:bg-[#15803d]"
              >
                WhatsApp 客人
`
  ],
  [
`            <div className="grid gap-3.5 xl:grid-cols-[minmax(0,1fr)_390px]">
`,
`            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
`
  ],
];

for (const [from, to] of replacements) {
  if (!source.includes(from)) {
    if (source.includes(to)) continue;
    throw new Error(`Lead detail source changed; missing verified block: ${from.slice(0, 100)}`);
  }
  source = source.replace(from, to);
}

await writeFile(target, source, "utf8");
console.log("Prepared polished CRM customer workspace.");
