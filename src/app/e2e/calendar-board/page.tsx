import { notFound } from "next/navigation";
import { MarketingCalendarBoard } from "@/components/command-center/MarketingCalendarBoard";

export const dynamic = "force-dynamic";

export default function CalendarBoardFixturePage() {
  if (process.env.ALYSSA_E2E_FIXTURES !== "1") notFound();

  return (
    <main>
      <MarketingCalendarBoard
        initialItems={[
          {
            id: "10000000-0000-4000-8000-000000000001",
            brandId: "20000000-0000-4000-8000-000000000001",
            title: "DEP Reels 上線",
            itemType: "post",
            channel: "IG",
            status: "planned",
            scheduledDate: "2026-07-15",
            scheduledTime: null,
            assigneeEmail: null,
            notes: null,
            sortOrder: 0,
          },
        ]}
        brands={[
          {
            id: "20000000-0000-4000-8000-000000000001",
            name: "Alyssa",
            color: "#e46f64",
          },
        ]}
        year={2026}
        month={7}
        daysInMonth={31}
        today="2026-07-15"
      />
    </main>
  );
}
