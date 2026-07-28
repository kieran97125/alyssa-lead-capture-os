import Link from "next/link";
import { CircleDollarSign, Gauge, Settings2 } from "lucide-react";
import { AppNav } from "@/components/alyssa/AppNav";
import {
  PaceBar,
  PaceStatusBadge,
} from "@/components/command-center/PaceBar";
import { BrandMark } from "@/components/command-center/BrandMark";
import { money } from "@/lib/data/businessMetrics";
import {
  getCommandCenterSnapshot,
  type BrandCommandCenterRow,
  type MetricProgress,
} from "@/lib/marketing/commandCenter";

export const dynamic = "force-dynamic";

export default async function BrandKpisPage() {
  const snapshot = await getCommandCenterSnapshot();

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="command-page">
        <div className="command-page-inner">
          <header className="command-page-header">
            <div>
              <p className="command-page-kicker">Growth Intelligence</p>
              <h1 className="command-page-title">品牌 KPI 進度</h1>
              <p className="command-page-subtitle">
                {snapshot.month.label} · {snapshot.month.throughLabel}。每個指標同時顯示
                Actual、截至昨日應達值同全月目標。
              </p>
            </div>
            <Link href="/settings/planning" className="command-primary-button">
              <Settings2 size={16} />
              設定 Budget／KPI
            </Link>
          </header>

          {snapshot.dataWarnings.map((warning) => (
            <p key={warning} className="command-status-message">
              {warning}
            </p>
          ))}

          <section className="brand-kpi-board">
            {snapshot.brands.map((brand) => (
              <BrandKpiCard
                key={brand.id}
                brand={brand}
                paceRatio={snapshot.month.paceRatio}
                elapsedDays={snapshot.month.elapsedDays}
                daysInMonth={snapshot.month.daysInMonth}
              />
            ))}
          </section>
        </div>
      </div>
    </main>
  );
}

function BrandKpiCard({
  brand,
  paceRatio,
  elapsedDays,
  daysInMonth,
}: {
  brand: BrandCommandCenterRow;
  paceRatio: number;
  elapsedDays: number;
  daysInMonth: number;
}) {
  return (
    <article className="command-surface brand-kpi-card">
      <header className="brand-kpi-card-header">
        <div className="brand-kpi-identity">
          <BrandMark
            name={brand.name}
            color={brand.color}
            logoUrl={brand.logoUrl}
          />
          <div>
            <h2>{brand.name}</h2>
            <p>
              {elapsedDays}／{daysInMonth} 日 · {brand.connectedSourceCount} 個已連接來源
            </p>
          </div>
        </div>
        <span className="brand-kpi-color" style={{ background: brand.color }} />
      </header>

      <section className="brand-budget-detail">
        <div>
          <CircleDollarSign size={17} />
          <span>Budget</span>
        </div>
        <strong>{money(brand.spend)}</strong>
        <small>
          昨日應用 {money(brand.expectedSpend)} · 月度{" "}
          {money(brand.monthlyPlan.budget)}
        </small>
        <PaceBar
          progress={brand.spendProgress}
          paceRatio={paceRatio}
          status={brand.budgetStatus}
          color={brand.color}
          label={`${brand.name} Budget`}
        />
        <footer>
          <PaceStatusBadge status={brand.budgetStatus} />
          <span>月底推算 {money(brand.spendForecast)}</span>
        </footer>
      </section>

      <section className="brand-kpi-metrics">
        <MetricDetail label="Lead" metric={brand.leads} paceRatio={paceRatio} />
        <MetricDetail
          label="Book"
          metric={brand.bookings}
          paceRatio={paceRatio}
        />
        <MetricDetail label="Show" metric={brand.shows} paceRatio={paceRatio} />
        <MetricDetail
          label="Content"
          metric={brand.content}
          paceRatio={paceRatio}
        />
      </section>
    </article>
  );
}

function MetricDetail({
  label,
  metric,
  paceRatio,
}: {
  label: string;
  metric: MetricProgress;
  paceRatio: number;
}) {
  return (
    <article className="metric-detail-card">
      <header>
        <div>
          <Gauge size={15} />
          <span>{label}</span>
        </div>
        <PaceStatusBadge status={metric.status} />
      </header>
      <div className="metric-detail-values">
        <strong>{metric.actual}</strong>
        <span>/ {metric.target || "—"}</span>
      </div>
      <PaceBar
        progress={metric.progress}
        paceRatio={paceRatio}
        status={metric.status}
        label={`${label} KPI`}
      />
      <p>
        截至昨日應達 {Math.round(metric.expected)} · 差距{" "}
        {metric.target > 0
          ? `${metric.delta >= 0 ? "+" : ""}${Math.round(metric.delta)}`
          : "待設定"}
      </p>
    </article>
  );
}
