import type { ReactNode } from "react";
import Link from "next/link";
import { AppNav } from "@/components/alyssa/AppNav";
import { MotionReveal } from "@/components/alyssa/MotionReveal";
import {
  buildPerformance,
  dateRangeOptions,
  getLeadRows,
  money,
  parseRange,
  percent,
  type PerformanceRow,
} from "@/lib/data/businessMetrics";

export const dynamic = "force-dynamic";

type PerformanceTableType = "brand" | "source" | "treatment" | "branch";

export default async function PerformancePage({
  searchParams,
}: {
  searchParams?: Promise<{ range?: string | string[] }>;
}) {
  const params = await searchParams;
  const activeRange = parseRange(params?.range);
  const { range, leads, error } = await getLeadRows(activeRange, 5000);
  const performance = buildPerformance(leads);

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <MotionReveal>
        <section className="rounded-[28px] border border-[#ead9cf] bg-white/82 p-6 shadow-[0_24px_70px_rgba(90,35,72,0.1)]">
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9a5d76]">
                Performance
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#321428]">
                成效分析
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d4a5c]">
                按品牌、來源、廣告系列、療程、套餐同分店，查看登記、預約同預計療程金額。
              </p>
            </div>
            <Link
              href="/leads"
              className="alyssa-focus rounded-full bg-[#e46f64] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(228,111,100,0.24)] transition hover:-translate-y-1 hover:bg-[#d95f55] hover:shadow-[0_18px_42px_rgba(228,111,100,0.32)] active:scale-[0.98]"
            >
              查看 Leads
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {dateRangeOptions.map((item) => (
              <Link
                key={item.key}
                href={`/performance?range=${item.key}`}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                  activeRange === item.key
                    ? "bg-[#5a2348] text-white"
                    : "border border-[#ead9cf] bg-white text-[#5a2348]"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <p className="mt-3 text-xs font-semibold text-[#7b5a6a]">
            目前期間：{range.label}
          </p>
          {error && (
            <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              資料暫時未能讀取，請稍後再試。
            </p>
          )}
        </section>
        </MotionReveal>

        <section className="mt-6 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <PerformanceTable
            title="品牌成效"
            columns={["品牌", "Leads", "預約", "已付款", "預計金額"]}
            rows={performance.brandPerformance}
            type="brand"
            delay={0.06}
          />
          <PerformanceTable
            title="來源 / 廣告系列成效"
            columns={[
              "來源",
              "廣告系列",
              "素材 / Content",
              "Leads",
              "預約",
              "已付款",
              "預計金額",
            ]}
            rows={performance.sourcePerformance}
            type="source"
            delay={0.13}
          />
        </section>

        <section className="mt-6 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <PerformanceTable
            title="療程 / 套餐成效"
            columns={["療程", "套餐", "價錢", "Leads", "預約", "已付款"]}
            rows={performance.treatmentPerformance}
            type="treatment"
            delay={0.08}
          />
          <PerformanceTable
            title="分店成效"
            columns={["分店", "Leads", "預約", "佔比"]}
            rows={performance.branchPerformance}
            type="branch"
            delay={0.15}
          />
        </section>
      </div>
    </main>
  );
}

function PerformanceTable({
  title,
  columns,
  rows,
  type,
  delay = 0,
}: {
  title: string;
  columns: string[];
  rows: PerformanceRow[];
  type: PerformanceTableType;
  delay?: number;
}) {
  return (
    <MotionReveal delay={delay}>
    <section className="alyssa-premium-card min-w-0 p-5">
      <h2 className="text-xl font-bold text-[#321428]">{title}</h2>
      <div className="mt-4 max-w-full overflow-x-auto">
        <table className="alyssa-table min-w-full text-left text-sm">
          <thead>
            <tr className="text-xs font-bold uppercase tracking-[0.12em] text-[#9a5d76]">
              {columns.map((column) => (
                <th key={column} className="border-b border-[#ead9cf] px-3 py-3">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <tr key={row.key} className="text-[#5a2348] transition hover:bg-[#fff6f0]/70">
                  {renderPerformanceCells(row, type)}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-6 text-center text-[#7b5a6a]"
                >
                  目前期間未有資料。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
    </MotionReveal>
  );
}

function Cell({ children }: { children: ReactNode }) {
  return <td className="border-b border-[#f1e3dc] px-3 py-3 align-top">{children}</td>;
}

function renderPerformanceCells(row: PerformanceRow, type: PerformanceTableType) {
  if (type === "source") {
    return (
      <>
        <Cell>{row.label}</Cell>
        <Cell>{row.meta?.[0] || "未標記"}</Cell>
        <Cell>{row.meta?.[1] || "未標記"}</Cell>
        <Cell>{row.leads}</Cell>
        <Cell>{row.bookings}</Cell>
        <Cell>{row.paid}</Cell>
        <Cell>{money(row.amount)}</Cell>
      </>
    );
  }

  if (type === "treatment") {
    return (
      <>
        <Cell>{row.label}</Cell>
        <Cell>{row.meta?.[0] || "未標記"}</Cell>
        <Cell>{row.meta?.[1] || "未標記"}</Cell>
        <Cell>{row.leads}</Cell>
        <Cell>{row.bookings}</Cell>
        <Cell>{row.paid}</Cell>
      </>
    );
  }

  if (type === "branch") {
    return (
      <>
        <Cell>{row.label}</Cell>
        <Cell>{row.leads}</Cell>
        <Cell>{row.bookings}</Cell>
        <Cell>{percent(row.share ?? 0)}</Cell>
      </>
    );
  }

  return (
    <>
      <Cell>{row.label}</Cell>
      <Cell>{row.leads}</Cell>
      <Cell>{row.bookings}</Cell>
      <Cell>{row.paid}</Cell>
      <Cell>{money(row.amount)}</Cell>
    </>
  );
}
