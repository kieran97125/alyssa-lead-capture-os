import type { AppointmentStatusSummary as Summary } from "@/lib/marketing/appointmentStatusSummary";
import { SystemDetails } from "./SystemDetails";

export function AppointmentStatusSummary({ summary }: { summary: Summary }) {
  return (
    <section aria-label="取消及改期" data-testid="appointment-status-summary" className="grid min-w-0 gap-3 text-system-foreground">
      <dl className="grid grid-cols-2 gap-3">
        {[["取消", summary.cancellations], ["改期", summary.reschedules]].map(([label, count]) => (
          <div key={label} className="rounded-[var(--radius-panel)] border border-system-border bg-system-card px-4 py-3">
            <dt className="text-sm font-semibold text-system-muted-foreground">{label}</dt>
            <dd className="mt-1 text-2xl font-black tabular-nums">{summary.available ? count : "—"}</dd>
          </div>
        ))}
      </dl>
      {!summary.available ? <p className="text-sm text-system-muted-foreground">跟 Lead Sheet 更新後顯示取消／改期。</p> :
        <SystemDetails title="取消／改期明細" className="min-w-0">
          <p className="mb-3 text-system-muted-foreground">按預約日期及目前到店狀態；重新確認預約後會返回待到店。</p>
          {summary.undated > 0 ? <p className="mb-3">另有 {summary.undated} 筆未填預約日期，未計入期間統計。</p> : null}
          {summary.rows.length === 0 ? <p>所選期間沒有取消或改期。</p> :
            <div role="region" aria-label="取消與改期分類明細" tabIndex={0}
              className="min-w-0 overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-system-ring">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">按 Account、品牌及療程列出取消及改期</caption>
                <thead><tr>{["Account", "品牌", "療程", "取消", "改期"].map(label => <th key={label} scope="col" className="whitespace-nowrap border-b border-system-border px-3 py-2 font-semibold">{label}</th>)}</tr></thead>
                <tbody>{summary.rows.map(row => <tr key={row.key}>
                  <td className="px-3 py-2">{row.account}</td><td className="px-3 py-2">{row.brand}</td><td className="px-3 py-2">{row.treatment}</td>
                  <td className="px-3 py-2 tabular-nums">{row.cancellations}</td><td className="px-3 py-2 tabular-nums">{row.reschedules}</td>
                </tr>)}</tbody>
              </table>
            </div>}
        </SystemDetails>}
    </section>
  );
}
