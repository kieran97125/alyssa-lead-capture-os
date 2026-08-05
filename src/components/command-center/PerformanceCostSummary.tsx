import type { ComponentType } from "react";
import {
  BadgeDollarSign,
  CalendarCheck2,
  CircleDollarSign,
  UserRoundCheck,
} from "lucide-react";
import { money } from "@/lib/data/businessMetrics";
import type { PerformanceCostSummary as PerformanceCostSummaryModel } from "@/lib/marketing/performanceCostMath";

type CostIcon = ComponentType<{ size?: number; strokeWidth?: number }>;

function costValue(value: number | null) {
  return value === null ? "—" : money(value);
}

function availabilityCopy(costs: PerformanceCostSummaryModel) {
  if (costs.availability === "unallocated") {
    return {
      label: "未分配到此篩選",
      detail:
        "目前廣告費只記錄到品牌層；選擇單一療程、來源或 Campaign 時不會推算成本。",
    };
  }
  if (costs.availability === "missing") {
    return {
      label: "未有廣告費紀錄",
      detail: "所選品牌及日期未有廣告費紀錄，成本暫不顯示。",
    };
  }
  if (costs.availability === "partial") {
    return {
      label: "部分品牌有紀錄",
      detail: `${costs.trackedBrandCount}/${costs.selectedBrandCount} 個品牌有廣告費；成本只按現有紀錄計算。`,
    };
  }
  return {
    label: "品牌級廣告費已對應",
    detail: `${costs.spendCoverageDays} 日有廣告費紀錄；先加總 Spend、Lead、Book、Show，再計算各成本。`,
  };
}

function CostCard({
  label,
  value,
  formula,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number | null;
  formula: string;
  icon: CostIcon;
  tone: "gold" | "plum" | "rose" | "blue";
}) {
  return (
    <article className={`performance-cost-card tone-${tone}`}>
      <span className="performance-cost-icon">
        <Icon size={18} />
      </span>
      <div>
        <p>{label}</p>
        <strong>{costValue(value)}</strong>
        <small>{formula}</small>
      </div>
    </article>
  );
}

export function PerformanceCostSummary({
  costs,
}: {
  costs: PerformanceCostSummaryModel;
}) {
  const copy = availabilityCopy(costs);
  return (
    <section
      className="command-surface performance-cost-summary"
      aria-label="廣告成本成效"
    >
      <header className="performance-cost-heading">
        <div>
          <p>Media efficiency</p>
          <h2>廣告成本成效</h2>
        </div>
        <span className={`is-${costs.availability}`}>{copy.label}</span>
      </header>
      <div className="performance-cost-grid">
        <CostCard
          label="廣告費"
          value={costs.spend}
          formula="系統廣告費帳簿"
          icon={CircleDollarSign}
          tone="gold"
        />
        <CostCard
          label="CPL"
          value={costs.cpl}
          formula="Spend ÷ Lead"
          icon={BadgeDollarSign}
          tone="plum"
        />
        <CostCard
          label="CPBook"
          value={costs.costPerBooking}
          formula="Spend ÷ Book"
          icon={UserRoundCheck}
          tone="rose"
        />
        <CostCard
          label="CPShow"
          value={costs.costPerShow}
          formula="Spend ÷ Show"
          icon={CalendarCheck2}
          tone="blue"
        />
      </div>
      <p className="performance-cost-note">{copy.detail}</p>
    </section>
  );
}
