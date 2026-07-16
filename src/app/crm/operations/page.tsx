import Link from "next/link";
import { CrmShell } from "@/components/crm/CrmShell";
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import {
  createAutomationRuleAction,
  createPaymentRecordAction,
  createTagAction,
  updatePaymentStatusAction,
  updateTemplateMappingAction,
} from "./actions";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;
const PAYMENT_STATUSES = ["not_requested","pending","proof_submitted","verifying","paid","failed","expired","refunded","cancelled"];

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CrmOperationsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const feedback = one(query?.success) || one(query?.error) || "";
  const data = await loadOperationsData();

  return (
    <CrmShell active="operations">
      <main className="min-h-screen bg-[#f4f7fb]">
        <header className="border-b border-[#e5e7eb] bg-white px-4 py-3 lg:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#6366f1]">Lead-to-Revenue Operations</p>
              <h1 className="mt-1 text-xl font-black text-[#111827]">營運設定</h1>
              <p className="mt-1 text-[11px] font-semibold text-[#64748b]">Queue、Tags、Template、Automation、付款狀態及 SLA 集中設定。</p>
            </div>
            <div className="flex gap-2">
              <Link href="/crm?tab=leads" className="h-8 rounded-lg border border-[#cbd5e1] bg-white px-3 text-[11px] font-black leading-8 text-[#334155]">對話</Link>
              <Link href="/crm/whatsapp/templates" className="h-8 rounded-lg bg-[#111827] px-3 text-[11px] font-black leading-8 text-white">Templates</Link>
            </div>
          </div>
          {feedback ? <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">{feedback}</div> : null}
        </header>

        <section className="grid gap-2 border-b border-[#e5e7eb] bg-white p-3 sm:grid-cols-2 xl:grid-cols-4 lg:px-5">
          <MetricRow label="未分配" value={data.metrics.unassigned} note="需要指派 CS" tone="rose" />
          <MetricRow label="逾期跟進" value={data.metrics.overdue} note="已超過跟進時間" tone="amber" />
          <MetricRow label="待確認預約" value={data.metrics.waitingBooking} note="尚未正式 booked" tone="indigo" />
          <MetricRow label="待付款／核實" value={data.metrics.paymentQueue} note="PayMe / FPS 流程" tone="emerald" />
        </section>

        <section className="grid gap-3 p-3 lg:p-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="grid content-start gap-3">
            <CompactPanel title="Queue & SLA" subtitle="每日 CS 優先處理次序">
              <div className="overflow-hidden rounded-lg border border-[#e2e8f0]">
                {data.slaPolicies.map((policy) => (
                  <div key={String(policy.id)} className="grid grid-cols-[minmax(0,1fr)_80px_120px] items-center gap-2 border-b border-[#eef2f7] bg-white px-3 py-2 text-xs last:border-0">
                    <strong className="truncate text-[#111827]">{String(policy.label)}</strong>
                    <span className="text-[#64748b]">{String(policy.threshold_minutes)} 分鐘</span>
                    <span className="truncate text-right font-mono text-[10px] font-bold text-[#6366f1]">{String(policy.queue_key)}</span>
                  </div>
                ))}
              </div>
            </CompactPanel>

            <CompactPanel title="Automation Rules" subtitle="現階段 Simulation；接 API 後先切換 Live">
              <div className="overflow-hidden rounded-lg border border-[#e2e8f0]">
                {data.rules.map((rule) => (
                  <details key={String(rule.id)} className="border-b border-[#eef2f7] bg-white last:border-0">
                    <summary className="grid cursor-pointer grid-cols-[minmax(0,1fr)_120px_90px] items-center gap-2 px-3 py-2.5 text-xs">
                      <strong className="truncate text-[#111827]">{String(rule.rule_name)}</strong>
                      <span className="truncate font-mono text-[10px] text-[#64748b]">{String(rule.trigger_key)}</span>
                      <span className="rounded bg-indigo-50 px-2 py-1 text-center text-[9px] font-black text-indigo-700">{String(rule.mode).toUpperCase()}</span>
                    </summary>
                    <div className="grid gap-2 border-t border-[#eef2f7] bg-[#f8fafc] p-3 lg:grid-cols-2">
                      <CodeBox label="Conditions" value={rule.conditions_json} />
                      <CodeBox label="Actions" value={rule.actions_json} />
                    </div>
                  </details>
                ))}
              </div>
              <details className="mt-3 rounded-lg border border-dashed border-[#cbd5e1] bg-[#f8fafc]">
                <summary className="cursor-pointer px-3 py-2 text-xs font-black text-[#334155]">＋ 建立 Simulation Rule</summary>
                <form action={createAutomationRuleAction} className="grid gap-2 border-t border-[#e2e8f0] p-3 lg:grid-cols-2">
                  <input type="hidden" name="brand_slug" value="ineffable" />
                  <Field name="rule_name" label="名稱" placeholder="新 Lead 分配及加 Tag" />
                  <Field name="trigger_key" label="Trigger" placeholder="form_submitted" />
                  <TextArea name="conditions_json" label="Conditions JSON" defaultValue='{"brand":"ineffable"}' />
                  <TextArea name="actions_json" label="Actions JSON" defaultValue='[{"action":"add_tag","value":"new_customer"}]' />
                  <button className="h-9 rounded-lg bg-[#111827] px-3 text-xs font-black text-white lg:col-span-2">建立 Rule</button>
                </form>
              </details>
            </CompactPanel>

            <CompactPanel title="Template Mapping" subtitle="變數映射及 Meta 審批狀態">
              <div className="overflow-hidden rounded-lg border border-[#e2e8f0]">
                {data.templateMappings.map((mapping) => (
                  <details key={String(mapping.id)} className="border-b border-[#eef2f7] bg-white last:border-0">
                    <summary className="grid cursor-pointer grid-cols-[140px_minmax(0,1fr)_120px] items-center gap-2 px-3 py-2.5 text-xs">
                      <span className="truncate font-mono text-[10px] font-bold text-[#6366f1]">{String(mapping.mapping_key)}</span>
                      <strong className="truncate text-[#111827]">{String(mapping.template_name)}</strong>
                      <span className="text-right text-[10px] font-bold text-[#64748b]">{String(mapping.approval_status)}</span>
                    </summary>
                    <div className="border-t border-[#eef2f7] bg-[#f8fafc] p-3">
                      <p className="text-xs font-semibold text-[#334155]">{String(mapping.preview_body || "")}</p>
                      <form action={updateTemplateMappingAction} className="mt-3 flex gap-2">
                        <input type="hidden" name="id" value={String(mapping.id)} />
                        <select name="approval_status" defaultValue={String(mapping.approval_status)} className="h-8 rounded-lg border border-[#cbd5e1] bg-white px-2 text-xs font-bold text-[#334155]">
                          <option value="draft">Draft</option><option value="pending_meta">Pending Meta</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="paused">Paused</option>
                        </select>
                        <button className="h-8 rounded-lg bg-[#111827] px-3 text-xs font-black text-white">儲存</button>
                      </form>
                      <CodeBox label="Variable map" value={mapping.variable_map} />
                    </div>
                  </details>
                ))}
              </div>
            </CompactPanel>

            <CompactPanel title="Payment Queue" subtitle="Payment Asia 前沿用 PayMe / FPS 人手核實">
              <div className="overflow-hidden rounded-lg border border-[#e2e8f0]">
                {data.payments.length ? data.payments.map((payment) => (
                  <div key={String(payment.id)} className="grid grid-cols-[100px_minmax(0,1fr)_180px] items-center gap-2 border-b border-[#eef2f7] px-3 py-2 text-xs last:border-0">
                    <strong>HK${Number(payment.amount || 0).toLocaleString("en-HK")}</strong>
                    <span className="truncate text-[#64748b]">{String(payment.method || "未指定")} · {String(payment.external_reference || "無 reference")}</span>
                    <form action={updatePaymentStatusAction} className="flex gap-1">
                      <input type="hidden" name="id" value={String(payment.id)} />
                      <select name="status" defaultValue={String(payment.status)} className="h-8 min-w-0 flex-1 rounded-lg border border-[#cbd5e1] bg-white px-2 text-[10px] font-bold">
                        {PAYMENT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                      <button className="h-8 rounded-lg bg-[#111827] px-2 text-[10px] font-black text-white">更新</button>
                    </form>
                  </div>
                )) : <Empty text="暫時未有付款記錄" />}
              </div>
              <details className="mt-3 rounded-lg border border-dashed border-[#cbd5e1] bg-[#f8fafc]">
                <summary className="cursor-pointer px-3 py-2 text-xs font-black text-[#334155]">＋ 建立付款記錄</summary>
                <form action={createPaymentRecordAction} className="grid gap-2 border-t border-[#e2e8f0] p-3 md:grid-cols-2">
                  <input type="hidden" name="brand_slug" value="ineffable" />
                  <input type="hidden" name="payment_required" value="true" />
                  <Field name="source_lead_id" label="Lead ID（可留空）" placeholder="UUID" />
                  <Field name="amount" label="金額 HKD" placeholder="588" type="number" />
                  <Select name="payment_type" label="付款類型" options={["manual","full","deposit"]} />
                  <Select name="status" label="狀態" options={PAYMENT_STATUSES} />
                  <Select name="method" label="方法" options={["PayMe","FPS","Bank Transfer","Cash","Other"]} />
                  <Field name="external_reference" label="Reference" placeholder="交易編號" />
                  <Field name="due_at" label="付款期限" type="datetime-local" />
                  <Field name="note" label="備註" placeholder="CS 已發 PayMe code" />
                  <button className="h-9 rounded-lg bg-[#111827] px-3 text-xs font-black text-white md:col-span-2">建立付款記錄</button>
                </form>
              </details>
            </CompactPanel>
          </div>

          <aside className="grid content-start gap-3">
            <CompactPanel title="Customer 360" subtitle="聯絡人及重複客戶狀態">
              <div className="overflow-hidden rounded-lg border border-[#e2e8f0]">
                <SummaryLine label="CRM Contacts" value={data.contactCount} />
                <SummaryLine label="可能重複" value={data.duplicateCount} />
                <SummaryLine label="High / Urgent" value={data.highPriorityCount} />
                <SummaryLine label="未有負責人" value={data.metrics.unassigned} />
              </div>
            </CompactPanel>

            <CompactPanel title="Tags" subtitle="Queue、Automation 及日後 AI 共用">
              <div className="overflow-hidden rounded-lg border border-[#e2e8f0]">
                {data.tags.map((tag) => (
                  <div key={String(tag.id)} className="grid grid-cols-[minmax(0,1fr)_110px] items-center border-b border-[#eef2f7] px-3 py-2 text-xs last:border-0">
                    <strong className="truncate text-[#111827]">{String(tag.label)}</strong>
                    <span className="truncate text-right font-mono text-[10px] text-[#64748b]">{String(tag.tag_key)}</span>
                  </div>
                ))}
              </div>
              <details className="mt-3 rounded-lg border border-dashed border-[#cbd5e1] bg-[#f8fafc]">
                <summary className="cursor-pointer px-3 py-2 text-xs font-black text-[#334155]">＋ 新增 Tag</summary>
                <form action={createTagAction} className="grid gap-2 border-t border-[#e2e8f0] p-3">
                  <input type="hidden" name="brand_slug" value="ineffable" />
                  <Field name="label" label="名稱" placeholder="價錢考慮" />
                  <Field name="tag_key" label="Key" placeholder="price_concern" />
                  <Field name="description" label="用途" placeholder="客人考慮價錢" />
                  <button className="h-9 rounded-lg bg-[#111827] px-3 text-xs font-black text-white">儲存 Tag</button>
                </form>
              </details>
            </CompactPanel>

            <CompactPanel title="Booking State" subtitle="客人確認不等於正式預約">
              <ol className="overflow-hidden rounded-lg border border-[#e2e8f0]">
                {["已登記","聯絡中","客人確認資料","等待門店確認","正式預約","待付款","已付款","到店結果"].map((item, index) => (
                  <li key={item} className="grid grid-cols-[24px_1fr] items-center gap-2 border-b border-[#eef2f7] px-3 py-2 text-xs font-bold text-[#334155] last:border-0"><span className="text-[10px] font-black text-[#6366f1]">{index + 1}</span>{item}</li>
                ))}
              </ol>
            </CompactPanel>
          </aside>
        </section>
      </main>
    </CrmShell>
  );
}

async function loadOperationsData() {
  const empty = { metrics: { unassigned: 0, overdue: 0, waitingBooking: 0, paymentQueue: 0 }, rules: [] as Row[], tags: [] as Row[], payments: [] as Row[], templateMappings: [] as Row[], slaPolicies: [] as Row[], contactCount: 0, duplicateCount: 0, highPriorityCount: 0 };
  if (!hasSupabaseAdminEnv()) return empty;
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const [cases, contacts, rules, tags, payments, mappings, sla] = await Promise.all([
    supabase.from("crm_lead_cases").select("id,status,assigned_to,next_follow_up_at"),
    supabase.from("crm_contacts").select("id,assigned_to,priority,duplicate_review_status"),
    supabase.from("crm_automation_rules").select("*").eq("brand_slug", "ineffable").order("created_at", { ascending: false }),
    supabase.from("crm_tags").select("*").eq("brand_slug", "ineffable").eq("is_active", true).order("label"),
    supabase.from("crm_payment_records").select("*").eq("brand_slug", "ineffable").order("created_at", { ascending: false }).limit(20),
    supabase.from("crm_template_mappings").select("*").eq("brand_slug", "ineffable").order("mapping_key"),
    supabase.from("crm_sla_policies").select("*").eq("brand_slug", "ineffable").eq("enabled", true).order("threshold_minutes"),
  ]);
  const caseRows = (cases.data || []) as Row[];
  const contactRows = (contacts.data || []) as Row[];
  const paymentRows = (payments.data || []) as Row[];
  return {
    metrics: {
      unassigned: caseRows.filter((row) => !row.assigned_to).length,
      overdue: caseRows.filter((row) => row.next_follow_up_at && String(row.next_follow_up_at) < now).length,
      waitingBooking: caseRows.filter((row) => ["new","contacting"].includes(String(row.status))).length,
      paymentQueue: paymentRows.filter((row) => ["pending","proof_submitted","verifying"].includes(String(row.status))).length,
    },
    rules: (rules.data || []) as Row[], tags: (tags.data || []) as Row[], payments: paymentRows,
    templateMappings: (mappings.data || []) as Row[], slaPolicies: (sla.data || []) as Row[],
    contactCount: contactRows.length,
    duplicateCount: contactRows.filter((row) => row.duplicate_review_status === "possible_duplicate").length,
    highPriorityCount: contactRows.filter((row) => ["high","urgent"].includes(String(row.priority))).length,
  };
}

function MetricRow({ label, value, note, tone }: { label: string; value: number; note: string; tone: string }) {
  const tones: Record<string,string> = { rose:"border-rose-200 bg-rose-50 text-rose-700", amber:"border-amber-200 bg-amber-50 text-amber-700", indigo:"border-indigo-200 bg-indigo-50 text-indigo-700", emerald:"border-emerald-200 bg-emerald-50 text-emerald-700" };
  return <article className={`flex items-center justify-between rounded-lg border px-3 py-2.5 ${tones[tone]}`}><div className="min-w-0"><p className="truncate text-[11px] font-black">{label}</p><p className="truncate text-[10px] font-semibold opacity-80">{note}</p></div><strong className="ml-3 text-xl font-black">{value}</strong></article>;
}

function CompactPanel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return <section className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-sm"><div className="border-b border-[#eef2f7] px-3 py-2.5"><h2 className="text-sm font-black text-[#111827]">{title}</h2>{subtitle ? <p className="mt-0.5 text-[11px] font-semibold text-[#64748b]">{subtitle}</p> : null}</div><div className="p-3">{children}</div></section>;
}
function Field({ name, label, placeholder, type = "text" }: { name: string; label: string; placeholder?: string; type?: string }) { return <label className="grid gap-1 text-[11px] font-black text-[#475569]">{label}<input name={name} type={type} placeholder={placeholder} className="h-8 rounded-lg border border-[#cbd5e1] bg-white px-2.5 text-xs font-semibold text-[#111827] outline-none focus:border-[#6366f1]" /></label>; }
function TextArea({ name, label, defaultValue }: { name: string; label: string; defaultValue?: string }) { return <label className="grid gap-1 text-[11px] font-black text-[#475569]">{label}<textarea name={name} defaultValue={defaultValue} rows={3} className="rounded-lg border border-[#cbd5e1] bg-white px-2.5 py-2 font-mono text-[10px] text-[#111827] outline-none focus:border-[#6366f1]" /></label>; }
function Select({ name, label, options }: { name: string; label: string; options: string[] }) { return <label className="grid gap-1 text-[11px] font-black text-[#475569]">{label}<select name={name} className="h-8 rounded-lg border border-[#cbd5e1] bg-white px-2.5 text-xs font-semibold">{options.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>; }
function CodeBox({ label, value }: { label: string; value: unknown }) { return <div className="rounded-lg bg-[#0f172a] p-2.5"><p className="text-[9px] font-black uppercase text-[#93c5fd]">{label}</p><pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all text-[9px] leading-4 text-[#e2e8f0]">{JSON.stringify(value ?? {}, null, 2)}</pre></div>; }
function SummaryLine({ label, value }: { label: string; value: number }) { return <div className="flex items-center justify-between border-b border-[#eef2f7] px-3 py-2 text-xs last:border-0"><span className="font-bold text-[#64748b]">{label}</span><strong className="font-black text-[#111827]">{value}</strong></div>; }
function Empty({ text }: { text: string }) { return <div className="p-4 text-center text-xs font-semibold text-[#64748b]">{text}</div>; }
