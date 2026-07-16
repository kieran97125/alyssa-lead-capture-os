import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function patch(relativePath, replacements) {
  const target = path.join(repoRoot, relativePath);
  let source = await readFile(target, "utf8");
  for (const [from, to] of replacements) {
    if (!source.includes(from)) {
      if (!source.includes(to)) console.warn(`${relativePath}: skipped UI variant: ${from.slice(0, 80)}`);
      continue;
    }
    source = source.replace(from, to);
  }
  await writeFile(target, source, "utf8");
}

await patch("src/app/crm/page.tsx", [
  [
`const inboxSubTabs = [
  { label: "Chats / 對話", queue: "" },
  { label: "Bookings / 預約", queue: "booked" },
  { label: "Follow-up / 跟進", queue: "follow_up_today" },
  { label: "Completed / 已完成", queue: "showed" },
  { label: "All / 全部", queue: "" },
];`,
`const inboxSubTabs = [
  { label: "全部對話", queue: "" },
  { label: "待跟進", queue: "new" },
  { label: "今日跟進", queue: "follow_up_today" },
  { label: "已預約", queue: "booked" },
  { label: "已完成", queue: "showed" },
];`
  ],
  [`                        : "Inbox / 工作台"}`, `                        : "對話"}`],
  [`                       : "CS 每日跟進 Lead、手動開 WhatsApp、確認預約及更新狀態。"}`, `                       : "所有表格登記及 WhatsApp 對話集中於同一工作區處理。"}`],
  [`              <div className="mt-3 flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">\n                <nav className="flex gap-1 overflow-x-auto">`, `              <div className="mt-3 grid gap-2">\n                <nav className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-5">`],
  [`                        className={\`flex h-8 items-center whitespace-nowrap rounded-full border px-3 text-[12px] font-bold \${`, `                        className={\`flex h-8 items-center justify-center whitespace-nowrap rounded-lg border px-2 text-[11px] font-bold \${`],
  [`                <form className="flex min-w-0 flex-wrap items-center gap-1.5">`, `                <form className="grid min-w-0 grid-cols-[36px_minmax(92px,120px)_minmax(100px,140px)_minmax(180px,1fr)_minmax(130px,180px)_64px] gap-1.5">`],
  [`                    F\n                  </button>`, `                    ≡\n                  </button>`],
  [`                  <button\n                    type="button"\n                    className="h-8 rounded-md border border-[#dbe2ea] bg-white px-2.5 text-[12px] font-bold text-[#475569]"\n                    title="Columns"\n                  >\n                    Columns\n                  </button>`, `                  <button\n                    type="submit"\n                    className="h-8 rounded-md bg-[#111827] px-3 text-[11px] font-black text-white"\n                  >\n                    套用\n                  </button>`]
]);

await patch("src/app/crm/leads/[leadId]/page.tsx", [
  [`        <div className="min-h-0 flex-1 overflow-auto bg-[#f8fafc] p-3.5">\n          <div className="grid gap-3.5">`, `        <div className="min-h-0 flex-1 overflow-auto bg-[#f8fafc] p-3">\n          <div className="grid gap-3">`],
  [`            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">`, `            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">`],
  [`                <Panel title="Booking Details">\n                  <InfoLine label="Treatment / offer" value={leadCase.treatmentOffer} />\n                  <InfoLine label="Package" value={leadCase.packagePrice} />\n                  <InfoLine label="Branch" value={leadCase.branchName} />\n                  <InfoLine label="Preferred time" value={leadCase.appointmentLabel} />\n                  <InfoLine label="Confirmed time" value={confirmedAppointmentLabel} />\n                  <InfoLine label="Paid status" value={bookingMeta.paidStatusLabel} />\n                </Panel>\n\n`, ``],
  [`               <div className="grid gap-px bg-[#e8edf4] sm:grid-cols-2 xl:grid-cols-5">`, `               <div className="grid gap-px bg-[#e8edf4] sm:grid-cols-2 lg:grid-cols-5">`],
  [`                   <div key={label} className="bg-white px-4 py-3">`, `                   <div key={label} className="min-w-0 bg-white px-3 py-2.5">`],
  [`                     <p className="mt-1 text-sm font-black leading-5 text-[#1e293b]">{value}</p>`, `                     <p className="mt-1 truncate text-[12px] font-black leading-4 text-[#1e293b]" title={value}>{value}</p>`]
]);

await patch("src/app/crm/operations/page.tsx", [
  [`        <header className="border-b border-[#e5e7eb] bg-white px-5 py-5 lg:px-7">`, `        <header className="border-b border-[#e5e7eb] bg-white px-4 py-3 lg:px-5">`],
  [`               <h1 className="mt-1 text-2xl font-black text-[#111827]">營運控制中心</h1>`, `               <h1 className="mt-1 text-xl font-black text-[#111827]">營運設定</h1>`],
  [`                 未接 WhatsApp API 前先管理 Queue、Tags、Template Mapping、Automation Simulation、付款狀態及 SLA。`, `                 Queue、Tags、Template、Automation、付款狀態及 SLA 集中設定。`],
  [`         <section className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4 lg:p-7">`, `         <section className="grid gap-2 border-b border-[#e5e7eb] bg-white p-3 sm:grid-cols-2 xl:grid-cols-4 lg:px-5">`],
  [`         <section className="grid gap-5 px-5 pb-7 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,.7fr)] lg:px-7">`, `         <section className="grid gap-3 p-3 lg:p-5 xl:grid-cols-[minmax(0,1fr)_340px]">`],
  [`           <div className="grid gap-5">`, `           <div className="grid content-start gap-3">`],
  [`           <aside className="grid content-start gap-5">`, `           <aside className="grid content-start gap-3">`],
  [`               <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">`, `               <div className="overflow-hidden rounded-lg border border-[#e2e8f0]">`],
  [`                   <div key={String(policy.id)} className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">\n                     <p className="text-sm font-black text-[#111827]">{String(policy.label)}</p>\n                     <p className="mt-1 text-xs font-semibold text-[#64748b]">{String(policy.threshold_minutes)} 分鐘內處理</p>\n                     <p className="mt-3 text-[10px] font-black uppercase tracking-[0.14em] text-[#6366f1]">{String(policy.queue_key)}</p>\n                   </div>`, `                   <div key={String(policy.id)} className="grid grid-cols-[minmax(0,1fr)_90px_120px] items-center gap-2 border-b border-[#eef2f7] bg-white px-3 py-2 text-xs last:border-0">\n                     <p className="truncate font-black text-[#111827]">{String(policy.label)}</p>\n                     <p className="font-semibold text-[#64748b]">{String(policy.threshold_minutes)} 分鐘</p>\n                     <p className="truncate text-[10px] font-black uppercase text-[#6366f1]">{String(policy.queue_key)}</p>\n                   </div>`],
  [`                   <article key={String(rule.id)} className="rounded-xl border border-[#e2e8f0] bg-white p-4">`, `                   <article key={String(rule.id)} className="border-b border-[#e2e8f0] bg-white px-3 py-2.5 last:border-0">`],
  [`               <div className="flex flex-wrap gap-2">\n                 {data.tags.map((tag) => <span key={String(tag.id)} className="rounded-full border border-[#c7d2fe] bg-[#eef2ff] px-3 py-1.5 text-xs font-black text-[#4338ca]">{String(tag.label)}</span>)}\n               </div>`, `               <div className="overflow-hidden rounded-lg border border-[#e2e8f0]">\n                 {data.tags.map((tag) => <div key={String(tag.id)} className="grid grid-cols-[minmax(0,1fr)_110px] items-center border-b border-[#eef2f7] px-3 py-2 text-xs last:border-0"><strong className="truncate text-[#111827]">{String(tag.label)}</strong><span className="truncate text-right font-mono text-[10px] text-[#64748b]">{String(tag.tag_key)}</span></div>)}\n               </div>`],
  [`  return <article className={\`rounded-2xl border p-5 \${tones[tone]}\`}><p className="text-xs font-black uppercase tracking-[0.14em]">{label}</p><p className="mt-2 text-3xl font-black">{value}</p><p className="mt-1 text-xs font-semibold opacity-80">{note}</p></article>;`, `  return <article className={\`flex items-center justify-between rounded-lg border px-3 py-2.5 \${tones[tone]}\`}><div className="min-w-0"><p className="truncate text-[11px] font-black">{label}</p><p className="truncate text-[10px] font-semibold opacity-80">{note}</p></div><strong className="ml-3 text-xl font-black">{value}</strong></article>;`],
  [`  return <section className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm"><h2 className="text-base font-black text-[#111827]">{title}</h2>{subtitle ? <p className="mt-1 text-xs font-semibold leading-5 text-[#64748b]">{subtitle}</p> : null}<div className="mt-4">{children}</div></section>;`, `  return <section className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-sm"><div className="border-b border-[#eef2f7] px-3 py-2.5"><h2 className="text-sm font-black text-[#111827]">{title}</h2>{subtitle ? <p className="mt-0.5 text-[11px] font-semibold text-[#64748b]">{subtitle}</p> : null}</div><div className="p-3">{children}</div></section>;`]
]);

console.log("Prepared compact CRM conversation and operations UI.");
