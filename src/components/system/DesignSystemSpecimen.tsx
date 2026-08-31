"use client";

import { useState } from "react";
import { CheckCircle2, Download, Plus, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendModeToggle } from "@/components/command-center/TrendModeToggle";
import { SystemButton } from "@/components/system/SystemButton";
import type { PerformanceTrendMode } from "@/lib/marketing/performanceTrend";

export function DesignSystemSpecimen() {
  const [mode, setMode] = useState<PerformanceTrendMode>("cumulative");

  return (
    <main
      data-testid="design-system-specimen"
      className="alyssa-design-system min-h-screen w-full bg-system-background px-5 py-8 text-system-foreground sm:px-8 lg:px-12"
    >
      <div className="mx-auto grid w-full max-w-6xl gap-6">
        <header className="flex flex-col gap-4 rounded-[var(--radius-panel)] border border-system-border bg-system-card p-6 shadow-[var(--shadow-card)] sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <Badge variant="secondary" className="mb-3">
              Design Quality Foundation v1
            </Badge>
            <h1 className="text-2xl font-black tracking-[-0.03em] sm:text-3xl">
              Alyssa Growth OS Design System
            </h1>
            <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-system-muted-foreground">
              共用 tokens、組件、視覺回歸同 accessibility gate，令每次 UI
              改動都有一致標準同可追溯證據。
            </p>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Foundation status">
            <Badge variant="outline">
              <CheckCircle2 aria-hidden="true" /> Base UI
            </Badge>
            <Badge variant="outline">
              <CheckCircle2 aria-hidden="true" /> Storybook
            </Badge>
            <Badge variant="outline">
              <CheckCircle2 aria-hidden="true" /> Visual Gate
            </Badge>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-[var(--radius-panel)] border border-system-border bg-system-card p-6 shadow-[var(--shadow-card)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-system-muted-foreground">
                  Controls
                </p>
                <h2 className="mt-1 text-lg font-black">Button hierarchy</h2>
              </div>
              <Badge>Approved primitive</Badge>
            </div>
            <Separator className="my-5" />
            <div className="flex flex-wrap items-center gap-3">
              <SystemButton density="compact">
                <Plus aria-hidden="true" /> 新增工作
              </SystemButton>
              <SystemButton variant="secondary">
                <Download aria-hidden="true" /> 匯出報告
              </SystemButton>
              <SystemButton variant="outline">編輯設定</SystemButton>
              <SystemButton variant="ghost">更多</SystemButton>
            </div>
            <div className="mt-6 rounded-[var(--radius-card)] border border-system-border bg-system-muted/55 p-4">
              <TrendModeToggle mode={mode} onChange={setMode} />
            </div>
          </article>

          <article className="rounded-[var(--radius-panel)] border border-system-border bg-system-card p-6 shadow-[var(--shadow-card)]">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-system-muted-foreground">
              Density
            </p>
            <h2 className="mt-1 text-lg font-black">
              Calm, compact, operational
            </h2>
            <p className="mt-2 text-sm font-medium leading-6 text-system-muted-foreground">
              內部系統以掃讀速度為先，控制項保持緊湊；需要確認或高風險操作先增加視覺重量。
            </p>
            <div className="mt-5 grid gap-3">
              <div className="rounded-[var(--radius-card)] border border-system-border bg-system-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold">本週內容排程</span>
                  <Badge variant="secondary">進行中</Badge>
                </div>
                <p className="mt-2 text-xs font-medium text-system-muted-foreground">
                  Start Day 決定工作週；Due Day 決定日曆與出街。
                </p>
              </div>
              <div className="rounded-[var(--radius-card)] border border-system-border bg-system-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold">同期對比</span>
                  <Badge variant="outline">已驗證</Badge>
                </div>
                <p className="mt-2 text-xs font-medium text-system-muted-foreground">
                  單日睇波動；累積睇 pace，比例按基礎數重新計算。
                </p>
              </div>
            </div>
          </article>
        </section>

        <section className="rounded-[var(--radius-panel)] border border-system-border bg-system-card p-6 shadow-[var(--shadow-card)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-system-muted-foreground">
                States
              </p>
              <h2 className="mt-1 text-lg font-black">
                Loading and system feedback
              </h2>
            </div>
            <SystemButton variant="outline" density="compact">
              <Sparkles aria-hidden="true" /> 檢查設計
            </SystemButton>
          </div>
          <Separator className="my-5" />
          <div className="grid gap-4 sm:grid-cols-3">
            {["Metric", "Table row", "Chart toolbar"].map((label) => (
              <div
                key={label}
                className="rounded-[var(--radius-card)] border border-system-border bg-system-background p-4"
              >
                <span className="text-xs font-bold text-system-muted-foreground">
                  {label}
                </span>
                <Skeleton className="mt-3 h-4 w-2/3" />
                <Skeleton className="mt-2 h-8 w-full" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
