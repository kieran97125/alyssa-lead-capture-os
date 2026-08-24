import { Suspense, type ReactNode } from "react";
import { DailyOverviewExcelExportButton } from "@/components/command-center/DailyOverviewExcelExportButton";

export default function DailyOverviewLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      {children}
      <Suspense fallback={null}>
        <DailyOverviewExcelExportButton />
      </Suspense>
    </>
  );
}
