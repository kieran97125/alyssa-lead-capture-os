import { notFound } from "next/navigation";
import { SystemDataStatus, SystemDetails } from "@/components/system/SystemDetails";

export default function ReportDetailsFixturePage() {
  if (process.env.ALYSSA_E2E_FIXTURES !== "1" && process.env.NODE_ENV === "production") notFound();
  const warnings = Array.from({ length: 6 }, (_, index) => [
    `品牌 ${index + 1} 廣告費已確認 0/5 日；其餘日期待確認。`,
    `品牌 ${index + 1} Lead 資料更新未成功。`,
  ]).flat();
  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4" data-testid="report-details-fixture">
      <h1 className="text-2xl font-bold text-system-foreground">每日總覽</h1>
      <SystemDataStatus warnings={warnings} />
      <section className="rounded-[var(--radius-card)] border border-system-border bg-system-card p-4 text-system-foreground" aria-label="成效摘要">
        <h2 className="font-semibold">Lead／Book／Show</h2>
        <p>144 ／ 29 ／ 11</p>
      </section>
      <SystemDetails title="計算口徑與資料來源">
        <p>Lead 按建立日期；Book 按更新日期；Show 按確認到店日期。同期間比率唔係固定 cohort。</p>
      </SystemDetails>
    </main>
  );
}
