"use client";

import { FileSpreadsheet } from "lucide-react";
import { useSearchParams } from "next/navigation";

export function DailyOverviewExcelExportButton() {
  const searchParams = useSearchParams();
  const exportParams = new URLSearchParams();
  const month = searchParams.get("month")?.trim() || "";
  const brand = searchParams.get("brand")?.trim() || "";
  if (month) exportParams.set("month", month);
  if (brand) exportParams.set("brand", brand);
  const query = exportParams.toString();
  const href = `/api/internal/daily-overview/export${query ? `?${query}` : ""}`;

  return (
    <a
      data-testid="daily-overview-excel-export"
      href={href}
      className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full border border-[#5a2348] bg-[#5a2348] px-5 py-3 text-sm font-black text-white shadow-[0_14px_36px_rgba(90,35,72,0.24)] transition hover:-translate-y-0.5 hover:bg-[#4b1d3c] focus:outline-none focus:ring-2 focus:ring-[#c9828e] focus:ring-offset-2"
      aria-label="匯出目前每日總覽為 Excel"
    >
      <FileSpreadsheet size={17} />
      匯出 Excel
    </a>
  );
}
