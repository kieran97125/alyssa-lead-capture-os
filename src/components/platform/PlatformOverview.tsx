import { Building2, LockKeyhole, ShieldCheck } from "lucide-react";
import { SystemSubmitButton } from "@/components/system/SystemSubmitButton";
import { SystemDetails } from "@/components/system/SystemDetails";
import { PRODUCT } from "@/lib/product";
import type { PlatformOverview as Overview } from "@/lib/platform/workspaces";

const states: Record<string, string> = { active: "使用中", provisioning: "待開通", suspended: "已停用", archived: "已封存", planned: "已排期", in_progress: "處理中", blocked: "待接駁", verified: "已驗收" };
export function PlatformOverview({ data, canProvision = false, createAction, status, email }: {
  data: Overview; canProvision?: boolean; createAction?: (form: FormData) => Promise<void>; status?: string; email: string;
}) {
  return (
    <main className="min-h-screen bg-background text-foreground" data-testid="marketing-platform">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-3"><span className="command-brand-mark" aria-hidden="true">MO</span><div><p className="font-bold">{PRODUCT.name}</p><p className="text-xs text-muted-foreground">{PRODUCT.publisher} · 平台管理</p></div></div>
          <div className="flex items-center gap-4 text-sm"><span className="text-muted-foreground">{email}</span><a className="font-semibold text-primary hover:underline" href="/logout">登出</a></div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl space-y-7 px-6 py-8">
        <section className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Customer workspaces</p><h1 className="mt-2 text-3xl font-bold tracking-tight">客戶工作區</h1><p className="mt-2 text-sm text-muted-foreground">管理客戶開通及平台狀態。客戶資料留喺各自工作區。</p></div><span className="text-sm font-semibold text-muted-foreground">{data.workspaces.length} 個工作區</span></section>
        {status && <p role="status" className="rounded-[var(--radius-card)] border border-border bg-card p-4 text-sm">{status === "created" ? "工作區已建立，待完成開通驗收。" : status === "invalid" ? "請輸入工作區名稱及有效代號。" : "暫時未能建立工作區，請核對代號或稍後重試。"}</p>}
        <section className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-card" aria-label="工作區列表">
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground"><tr>{["客戶","方案","成員","品牌","狀態"].map(label => <th className="px-5 py-4 font-semibold" key={label}>{label}</th>)}</tr></thead><tbody className="divide-y divide-border">{data.workspaces.map(workspace => <tr key={workspace.id}><td className="px-5 py-5"><div className="flex items-center gap-3"><Building2 className="shrink-0 text-muted-foreground" size={18}/><div><p className="font-semibold">{workspace.name}</p><p className="mt-1 text-xs text-muted-foreground">{workspace.slug}</p></div></div></td><td className="px-5 py-5">{workspace.plan === "enterprise" ? "Enterprise" : workspace.plan}</td><td className="px-5 py-5 tabular-nums">{workspace.members}</td><td className="px-5 py-5 tabular-nums">{workspace.brands}</td><td className="px-5 py-5"><span className="inline-flex items-center gap-2 font-medium"><span className={`size-1.5 rounded-full ${workspace.status === "active" ? "bg-emerald-600" : "bg-muted-foreground"}`} />{states[workspace.status] ?? workspace.status}</span></td></tr>)}</tbody></table></div>
          {data.workspaces.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">未有客戶工作區。</p>}
        </section>
        {canProvision && <SystemDetails title="建立客戶工作區"><form action={createAction} className="grid gap-4 md:grid-cols-[1.3fr_1fr_auto]"><label className="grid gap-2 text-sm font-semibold">客戶名稱<input name="name" required maxLength={120} autoComplete="organization" className="h-10 rounded-[var(--radius-control)] border border-input bg-background px-3 font-normal" placeholder="公司或團隊名稱" /></label><label className="grid gap-2 text-sm font-semibold">工作區代號<input name="slug" required pattern="[a-z0-9][a-z0-9-]{1,62}" maxLength={63} className="h-10 rounded-[var(--radius-control)] border border-input bg-background px-3 font-normal" placeholder="company-name" /></label><SystemSubmitButton className="self-end" disabled={!createAction} pendingLabel="建立中…">建立工作區</SystemSubmitButton></form><p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><LockKeyhole size={14}/>完成開通驗收前，新工作區唔會開放客戶登入。</p></SystemDetails>}
        <section aria-labelledby="platform-readiness"><div className="mb-4 flex items-center gap-2"><ShieldCheck size={18} className="text-primary"/><h2 id="platform-readiness" className="text-lg font-bold">開通與接駁進度</h2></div><div className="grid gap-3 md:grid-cols-2">{data.cards.map(card => <article key={card.key} className="rounded-[var(--radius-card)] border border-border bg-card p-5"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{card.title}</h3><span className="whitespace-nowrap text-xs font-semibold text-muted-foreground">{states[card.state] ?? card.state}</span></div><p className="mt-2 text-sm leading-6 text-muted-foreground">{card.acceptance}</p></article>)}</div></section>
        <footer className="border-t border-border pt-5 text-xs text-muted-foreground">{PRODUCT.name} · {PRODUCT.publisherNameZh}</footer>
      </div>
    </main>
  );
}
