import { Suspense, type ReactNode } from "react";
import { RollingSevenDayComparison } from "@/components/command-center/RollingSevenDayComparison";

export default function PeriodComparisonLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        .rolling-compare-shell {
          padding-left: var(--command-sidebar-width);
          background: var(--command-page);
        }
        .rolling-compare-panel {
          width: min(100% - 2rem, 1500px);
          margin: 0 auto;
          padding: 1.25rem 0 0.1rem;
        }
        .rolling-compare-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1.25rem;
          border: 1px solid var(--command-border);
          border-radius: 1.05rem 1.05rem 0 0;
          background: linear-gradient(135deg, #fff, #fff8f6);
          padding: 1rem 1.1rem;
        }
        .rolling-compare-header p,
        .rolling-compare-header h2,
        .rolling-compare-header span {
          margin: 0;
        }
        .rolling-compare-header p {
          color: var(--command-accent-strong);
          font-size: 0.6rem;
          font-weight: 860;
          letter-spacing: 0.11em;
          text-transform: uppercase;
        }
        .rolling-compare-header h2 {
          margin-top: 0.2rem;
          color: var(--command-navy);
          font-size: 1.02rem;
          letter-spacing: -0.02em;
        }
        .rolling-compare-header > div:first-child > span {
          display: block;
          margin-top: 0.28rem;
          color: var(--command-muted);
          font-size: 0.66rem;
          font-weight: 650;
        }
        .rolling-period-pills {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 0.42rem;
        }
        .rolling-period-pills > span {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          border: 1px solid #e7d8d2;
          border-radius: 999px;
          background: #fff;
          padding: 0.42rem 0.62rem;
          color: var(--command-muted);
          font-size: 0.61rem;
          font-weight: 730;
          white-space: nowrap;
        }
        .rolling-period-pills > span.is-current {
          border-color: #d9b7c7;
          background: #fff6fa;
          color: var(--command-primary);
        }
        .rolling-period-pills > span.is-brand {
          background: var(--command-primary);
          color: #fff;
          border-color: var(--command-primary);
        }
        .rolling-period-pills strong { font-weight: 850; }
        .rolling-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.65rem;
          border-right: 1px solid var(--command-border);
          border-left: 1px solid var(--command-border);
          background: #fbf8f7;
          padding: 0.75rem;
        }
        .rolling-kpi-card {
          display: flex;
          min-width: 0;
          gap: 0.62rem;
          border: 1px solid #eee2dd;
          border-radius: 0.9rem;
          background: #fff;
          padding: 0.78rem;
        }
        .rolling-kpi-icon {
          display: grid;
          width: 2rem;
          height: 2rem;
          flex: 0 0 auto;
          place-items: center;
          border-radius: 0.66rem;
          background: var(--command-primary-soft);
          color: var(--command-primary);
        }
        .rolling-kpi-copy { min-width: 0; }
        .rolling-kpi-card p,
        .rolling-kpi-card strong,
        .rolling-kpi-card small { display: block; margin: 0; }
        .rolling-kpi-card p {
          color: var(--command-muted);
          font-size: 0.62rem;
          font-weight: 790;
        }
        .rolling-kpi-card strong {
          margin-top: 0.18rem;
          color: var(--command-navy);
          font-size: clamp(1.05rem, 1.5vw, 1.35rem);
          font-weight: 890;
          letter-spacing: -0.04em;
          white-space: nowrap;
        }
        .rolling-kpi-card small {
          margin-top: 0.2rem;
          color: var(--command-disabled);
          font-size: 0.55rem;
          font-weight: 650;
        }
        .rolling-change {
          display: inline-flex;
          width: fit-content;
          align-items: center;
          gap: 0.18rem;
          margin-top: 0.36rem;
          border-radius: 999px;
          padding: 0.22rem 0.4rem;
          font-size: 0.56rem;
          font-weight: 820;
        }
        .rolling-change small { margin: 0; font-size: inherit; color: inherit; opacity: 0.72; }
        .rolling-change.is-good { background: #eaf8f1; color: #147149; }
        .rolling-change.is-bad { background: #fff1ef; color: #b34d45; }
        .rolling-change.is-neutral { background: #f4f1ef; color: var(--command-muted); }
        .rolling-rate-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.65rem;
          border: 1px solid var(--command-border);
          border-top: 0;
          border-radius: 0 0 1.05rem 1.05rem;
          background: #fff;
          padding: 0.75rem;
        }
        .rolling-rate-grid article {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 0.15rem 0.7rem;
          align-items: center;
          border-radius: 0.75rem;
          background: #fbf7f5;
          padding: 0.65rem 0.72rem;
        }
        .rolling-rate-grid span { color: var(--command-muted); font-size: 0.62rem; font-weight: 780; }
        .rolling-rate-grid strong { color: var(--command-primary); font-size: 1rem; font-weight: 880; }
        .rolling-rate-grid > article > small { color: var(--command-disabled); font-size: 0.54rem; font-weight: 650; }
        .rolling-rate-grid .rolling-change { grid-column: 1 / -1; }
        .rolling-compare-loading {
          border: 1px solid var(--command-border);
          border-top: 0;
          border-radius: 0 0 1.05rem 1.05rem;
          background: #fff;
          padding: 1.2rem;
          color: var(--command-muted);
          font-size: 0.66rem;
          font-weight: 720;
        }

        /* Existing monthly comparison aftercare: keep money values readable. */
        .period-kpi-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
        }
        .period-kpi-card strong {
          overflow: visible !important;
          text-overflow: clip !important;
          white-space: nowrap !important;
          font-size: clamp(1.02rem, 1.45vw, 1.34rem) !important;
        }
        .period-change.is-neutral:not(:has(svg)) {
          display: none !important;
        }

        @media (max-width: 1180px) {
          .rolling-kpi-grid,
          .period-kpi-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
          .rolling-compare-header { flex-direction: column; }
          .rolling-period-pills { justify-content: flex-start; }
        }
        @media (max-width: 860px) {
          .rolling-kpi-grid,
          .period-kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .rolling-rate-grid { grid-template-columns: minmax(0, 1fr); }
        }
        @media (max-width: 720px) {
          .rolling-compare-shell { padding-left: 0; }
          .rolling-compare-panel { width: min(100% - 1rem, 1500px); padding-top: 0.65rem; }
          .rolling-kpi-grid,
          .period-kpi-grid { grid-template-columns: minmax(0, 1fr) !important; }
          .rolling-period-pills > span { white-space: normal; }
        }
      `}</style>
      <Suspense fallback={null}>
        <RollingSevenDayComparison />
      </Suspense>
      {children}
    </>
  );
}
