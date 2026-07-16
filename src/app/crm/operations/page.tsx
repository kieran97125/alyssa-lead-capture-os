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
        <header className="border-b border-[#e5e7eb] bg-white px-5 py-5 lg:px-7">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#6366f1]">Lead-to-Revenue Operations</p>
              <h1 className="mt-1 text-2xl font-black text-[#111827]">營運控制中心</h1>
              <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-[#64748b]">
                未接 WhatsApp API 前先管理 Queue、Tags、Template Mapping、Automation Simulation、付款狀態及 SLA。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/crm" className="rounded-xl border border-[#cbd5e1] bg-white px-4 py-2 text-xs font-black text-[#334155]">CRM 工作台</Link>
              <Link href="/crm/whatsapp/templates" className="rounded-xl bg-[#111827] px-4 py-2 text-xs font-black text-white">WhatsApp Templates</Link>
            </div>
          </div>
          {feedback ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{feedback}</div> : null}
        </header>

        <section className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4 lg:p-7">
          <MetricCard label="未分配個案" value={data.metrics.unassigned} note="需要指派 CS" tone="rose" />
          <MetricCard label="逾期跟進" value={data.metrics.overdue} note="next follow-up 已過期" tone="amber" />
          <MetricCard label="等待正式確認" value={data.metrics.waitingBooking} note="客人偏好時間未等於 booked" tone="indigo" />
          <MetricCard label="待付款／核實" value={data.metrics.paymentQueue} note="支援 PayMe / FPS 人手流程" tone="emerald" />
        </section>

        <section className="grid gap-5 px-5 pb-7 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,.7fr)] lg:px-7">
          <div className="grid gap-5">
            <Panel title="Queue & SLA" subtitle="每日 CS 應優先處理的工作佇列">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {data.slaPolicies.map((policy) => (
                  <div key={String(policy.id)} className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
                    <p className="text-sm font-black text-[#111827]">{String(policy.label)}</p>
                    <p className="mt-1 text-xs font-semibold text-[#64748b]">{String(policy.threshold_minutes)} 分鐘內處理</p>
                    <p className="mt-3 text-[10px] font-black uppercase tracking-[0.14em] text-[#6366f1]">{String(policy.queue_key)}</p>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Automation Rules Lite" subtitle="現階段只做 Simulation，接 API 後先切換 Live">
              <div className="grid gap-3">
                {data.rules.map((rule) => (
                  <article key={String(rule.id)} className="rounded-xl border border-[#e2e8f0] bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-black text-[#111827]">{String(rule.rule_name)}</h3>
                        <p className="mt-1 text-xs font-semibold text-[#64748b]">Trigger：{String(rule.trigger_key)}</p>
                      </div>
                      <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-black text-indigo-700">{String(rule.mode).toUpperCase()}</span>
                    </div>
                    <div className="mt-3 grid gap-2 lg:grid-cols-2">
                      <CodeBox label="Conditions" value={rule.conditions_json} />
                      <CodeBox label="Actions" value={rule.actions_json} />
                    </div>
                  </article>
                ))}
              </div>
              <form action={createAutomationRuleAction} className="mt-4 grid gap-3 rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-4 lg:grid-cols-2">
                <input type="hidden" name="brand_slug" value="ineffable" />
                <Field name="rule_name" label="Rule 名稱" placeholder="例如：新 Lead 分配及加 Tag" />
                <Field name="trigger_key" label="Trigger key" placeholder="form_submitted" />
                <TextArea name="conditions_json" label="Conditions JSON" defaultValue='{"brand":"ineffable"}' />
                <TextArea name="actions_json" label="Actions JSON" defaultValue='[{"action":"add_tag","value":"new_customer"}]' />
                <button className="rounded-xl bg-[#111827] px-4 py-3 text-sm font-black text-white lg:col-span-2">建立 Simulation Rule</button>
              </form>
            </Panel>

            <Panel title="Template Mapping Studio" subtitle="將 Template 變數綁定到 Lead／Booking 真實欄位">
              <div className="grid gap-3">
                {data.templateMappings.map((mapping) => (
                  <article key={String(mapping.id)} className="rounded-xl border border-[#e2e8f0] bg-white p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#6366f1]">{String(mapping.mapping_key)}</p>
                        <h3 className="mt-1 text-base font-black text-[#111827]">{String(mapping.template_name)}</h3>
                        <p className="mt-1 text-xs font-semibold text-[#64748b]">{String(mapping.use_case)}</p>
                      </div>
                      <form action={updateTemplateMappingAction} className="flex gap-2">
                        <input type="hidden" name="id" value={String(mapping.id)} />
                        <select name="approval_status" defaultValue={String(mapping.approval_status)} className="rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-xs font-bold text-[#334155]">
                          <option value="draft">Draft</option><option value="pending_meta">Pending Meta</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="paused">Paused</option>
                        </select>
                        <button className="rounded-lg bg-[#111827] px-3 py-2 text-xs font-black text-white">儲存</button>
                      </form>
                    </div>
                    <div className="mt-4 rounded-xl bg-[#f8fafc] p-4 text-sm font-semibold leading-6 text-[#334155]">{String(mapping.preview_body || "")}</div>
                    <CodeBox label="Variable map" value={mapping.variable_map} />
                  </article>
                ))}
              </div>
            </Panel>

            <Panel title="Manual Payment Queue" subtitle="Payment Asia 前先用同一資料層管理 PayMe / FPS / 截圖核實">
              <div className="grid gap-3">
                {data.payments.length ? data.payments.map((payment) => (
                  <article key={String(payment.id)} className="rounded-xl border border-[#e2e8f0] bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-[#111827]">HK${Number(payment.amount || 0).toLocaleString("en-HK")}</p>
                        <p className="mt-1 text-xs font-semibold text-[#64748b]">{String(payment.method || "未指定方法")} · {String(payment.external_reference || "無 reference")}</p>
                      </div>
                      <form action={updatePaymentStatusAction} className="flex gap-2">
                        <input type="hidden" name="id" value={String(payment.id)} />
                        <select name="status" defaultValue={String(payment.status)} className="rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-xs font-bold">
                          {PAYMENT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                        </select>
                        <button className="rounded-lg bg-[#111827] px-3 py-2 text-xs font-black text-white">更新</button>
                      </form>
                    </div>
                  </article>
                )) : <Empty text="暫時未有付款記錄；可先用下面表格建立人手付款項目。" />}
              </div>
              <form action={createPaymentRecordAction} className="mt-4 grid gap-3 rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-4 md:grid-cols-2">
                <input type="hidden" name="brand_slug" value="ineffable" />
                <input type="hidden" name="payment_required" value="true" />
                <Field name="source_lead_id" label="Lead ID（可留空）" placeholder="UUID" />
                <Field name="amount" label="金額 HKD" placeholder="588" type="number" />
                <Select name="payment_type" label="付款類型" options={["manual","full","deposit"]} />
                <Select name="status" label="狀態" options={PAYMENT_STATUSES} />
                <Select name="method" label="方法" options={["PayMe","FPS","Bank Transfer","Cash","Other"]} />
                <Field name="external_reference" label="Reference" placeholder="付款截圖／交易編號" />
                <Field name="due_at" label="付款期限" type="datetime-local" />
                <Field name="note" label="備註" placeholder="例如：CS 已發 PayMe code" />
                <button className="rounded-xl bg-[#111827] px-4 py-3 text-sm font-black text-white md:col-span-2">建立付款記錄</button>
              </form>
            </Panel>
          </div>

          <aside className="grid content-start gap-5">
            <Panel title="Customer 360 Foundations" subtitle="Contact 層統一管理標籤、負責人、優先度及重複客戶">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <SummaryLine label="CRM Contacts" value={data.contactCount} />
                <SummaryLine label="可能重複" value={data.duplicateCount} />
                <SummaryLine label="High / Urgent" value={data.highPriorityCount} />
                <SummaryLine label="未有負責人" value={data.metrics.unassigned} />
              </div>
              <p className="mt-4 rounded-xl bg-[#f8fafc] p-3 text-xs font-semibold leading-5 text-[#64748b]">
                同一電話的多次登記會保留每個 Lead、Booking、Payment 歷史；只顯示「可能重複」供人手 review，唔會靜默合併。
              </p>
            </Panel>

            <Panel title="Tags" subtitle="供 Queue、Automation、Broadcast 及日後 AI Context 共用">
              <div className="flex flex-wrap gap-2">
                {data.tags.map((tag) => <span key={String(tag.id)} className="rounded-full border border-[#c7d2fe] bg-[#eef2ff] px-3 py-1.5 text-xs font-black text-[#4338ca]">{String(tag.label)}</span>)}
              </div>
              <form action={createTagAction} className="mt-4 grid gap-3">
                <input type="hidden" name="brand_slug" value="ineffable" />
                <Field name="label" label="新 Tag" placeholder="例如：價錢考慮" />
                <Field name="tag_key" label="Key（可留空自動生成）" placeholder="price_concern" />
                <Field name="description" label="用途" placeholder="客人仍在考慮價錢" />
                <button className="rounded-xl bg-[#111827] px-4 py-3 text-sm font-black text-white">儲存 Tag</button>
              </form>
            </Panel>

            <Panel title="Booking State Machine" subtitle="避免客人確認、門店確認、付款狀態互相混淆">
              <ol className="grid gap-2">
                {["Registered 已登記","Contacting 聯絡中","Customer confirmed 客人確認資料","Waiting branch 等待門店確認","Booked 正式預約","Payment pending 待付款","Paid 已付款","Showed / No-show 到店結果"].map((item, index) => (
                  <li key={item} className="flex items-center gap-3 rounded-xl bg-[#f8fafc] px-3 py-2 text-xs font-bold text-[#334155]"><span className="grid h-6 w-6 place-items-center rounded-full bg-white text-[10px] font-black text-[#6366f1] shadow-sm">{index + 1}</span>{item}</li>
                ))}
              </ol>
            </Panel>
          </aside>
        </section>
      </main>
    </CrmShell>
  );
}

const PAYMENT_STATUSES = ["not_requested","pending","proof_submitted","verifying","paid","failed","expired","refunded","cancelled"];

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

function MetricCard({ label, value, note, tone }: { label: string; value: number; note: string; tone: string }) {
  const tones: Record<string,string> = { rose:"border-rose-200 bg-rose-50 text-rose-700", amber:"border-amber-200 bg-amber-50 text-amber-700", indigo:"border-indigo-200 bg-indigo-50 text-indigo-700", emerald:"border-emerald-200 bg-emerald-50 text-emerald-700" };
  return <article className={`rounded-2xl border p-5 ${tones[tone]}`}><p className="text-xs font-black uppercase tracking-[0.14em]">{label}</p><p className="mt-2 text-3xl font-black">{value}</p><p className="mt-1 text-xs font-semibold opacity-80">{note}</p></article>;
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm"><h2 className="text-base font-black text-[#111827]">{title}</h2>{subtitle ? <p className="mt-1 text-xs font-semibold leading-5 text-[#64748b]">{subtitle}</p> : null}<div className="mt-4">{children}</div></section>;
}
function Field({ name, label, placeholder, type = "text" }: { name: string; label: string; placeholder?: string; type?: string }) { return <label className="grid gap-1.5 text-xs font-black text-[#475569]">{label}<input name={name} type={type} placeholder={placeholder} className="rounded-xl border border-[#cbd5e1] bg-white px-3 py-2.5 text-sm font-semibold text-[#111827] outline-none focus:border-[#6366f1]" /></label>; }
function TextArea({ name, label, defaultValue }: { name: string; label: string; defaultValue?: string }) { return <label className="grid gap-1.5 text-xs font-black text-[#475569]">{label}<textarea name={name} defaultValue={defaultValue} rows={4} className="rounded-xl border border-[#cbd5e1] bg-white px-3 py-2.5 font-mono text-xs text-[#111827] outline-none focus:border-[#6366f1]" /></label>; }
function Select({ name, label, options }: { name: string; label: string; options: string[] }) { return <label className="grid gap-1.5 text-xs font-black text-[#475569]">{label}<select name={name} className="rounded-xl border border-[#cbd5e1] bg-white px-3 py-2.5 text-sm font-semibold">{options.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>; }
function CodeBox({ label, value }: { label: string; value: unknown }) { return <div className="mt-3 rounded-xl bg-[#0f172a] p-3"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#93c5fd]">{label}</p><pre className="mt-2 overflow-auto whitespace-pre-wrap break-all text-[10px] leading-5 text-[#e2e8f0]">{JSON.stringify(value ?? {}, null, 2)}</pre></div>; }
function SummaryLine({ label, value }: { label: string; value: number }) { return <div className="flex items-center justify-between rounded-xl bg-[#f8fafc] px-4 py-3"><span className="text-xs font-bold text-[#64748b]">{label}</span><strong className="text-lg font-black text-[#111827]">{value}</strong></div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-6 text-center text-sm font-semibold text-[#64748b]">{text}</div>; }
