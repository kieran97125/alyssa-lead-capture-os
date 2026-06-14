import type { ReactNode } from "react";

export function PagePurpose({
  eyebrow = "頁面用途",
  title,
  body,
  nextStep,
}: {
  eyebrow?: string;
  title: string;
  body: string;
  nextStep: string;
}) {
  return (
    <section className="alyssa-premium-card h-full min-w-0 p-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-xl font-bold text-[#321428]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">{body}</p>
      <p className="mt-3 rounded-2xl bg-[#fff6f0] px-4 py-3 text-sm font-bold text-[#5a2348]">
        下一步：{nextStep}
      </p>
    </section>
  );
}

export function HelpCard({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="h-full min-w-0 rounded-2xl border border-[#ead9cf] bg-[#fff6f0] p-4">
      <h3 className="text-sm font-bold text-[#321428]">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#6d4a5c]">{body}</p>
    </div>
  );
}

export function WorkflowStepper({
  steps,
  currentIndex = 0,
}: {
  steps: string[];
  currentIndex?: number;
}) {
  return (
    <section className="min-w-0 rounded-[22px] border border-[#ead9cf] bg-white/70 p-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        工作流程
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {steps.map((step, index) => {
          const isCurrent = index === currentIndex;
          const isDone = index < currentIndex;

          return (
            <div
              key={step}
              className={`min-w-0 rounded-2xl border px-4 py-3 ${
                isCurrent
                  ? "border-[#e46f64] bg-white text-[#321428] shadow-[0_12px_30px_rgba(228,111,100,0.14)]"
                  : isDone
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-[#ead9cf] bg-[#fff6f0] text-[#6d4a5c]"
              }`}
            >
              <p className="text-xs font-bold uppercase tracking-[0.12em]">
                Step {index + 1}
              </p>
              <p className="mt-1 text-sm font-bold leading-5">{step}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function StatusSummary({
  items,
}: {
  items: Array<{ label: string; value: string; tone?: "default" | "good" | "warn" }>;
}) {
  return (
    <section className="min-w-0 rounded-[22px] border border-[#ead9cf] bg-white/70 p-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5d76]">
        狀態摘要
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.label}
            className={`min-w-0 rounded-2xl p-4 ${
              item.tone === "good"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
                : item.tone === "warn"
                  ? "border border-amber-200 bg-amber-50 text-amber-900"
                  : "bg-[#fff6f0] text-[#5a2348]"
            }`}
          >
            <p className="text-xs font-bold uppercase tracking-[0.14em]">
              {item.label}
            </p>
            <p className="mt-2 break-words text-sm font-semibold">{item.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function InlineGuide({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#ead9cf] bg-white/78 px-4 py-3 text-sm font-semibold leading-6 text-[#5a2348]">
      {children}
    </div>
  );
}
