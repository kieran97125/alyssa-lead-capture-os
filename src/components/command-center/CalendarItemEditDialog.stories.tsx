import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CalendarItemEditDialog } from "@/components/command-center/CalendarItemEditDialog";
import type { CalendarItemUpdateInput } from "@/lib/marketing/calendarEdit";
import type { CalendarItem } from "@/lib/marketing/commandCenter";

const item: CalendarItem = {
  id: "10000000-0000-4000-8000-000000000001",
  brandId: "20000000-0000-4000-8000-000000000001",
  treatmentId: null,
  treatmentLabel: null,
  title: "S-Lite Meta AD 上線",
  itemType: "ad",
  channel: "Meta",
  status: "scheduled",
  scheduledDate: "2026-09-08",
  scheduledTime: "12:00",
  assigneeEmail: "marketer@example.test",
  notes: "確認價錢、CTA 同 Safe Zone 後出街。",
  sortOrder: 0,
  showOnPerformanceTimeline: true,
  updatedAt: "2026-09-02T02:00:00.000Z",
};

const meta = {
  title: "Design System/Feature/Calendar Item Edit Dialog",
  component: CalendarItemEditDialog,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof CalendarItemEditDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  args: {
    item,
    brands: [
      {
        id: item.brandId,
        name: "Alyssa",
        color: "#5a2348",
      },
    ],
    treatments: [],
    defaultOpen: true,
    fixtureMode: true,
    saveAction: async (input: CalendarItemUpdateInput) => ({
      ok: true,
      message: "日曆事項已更新。",
      item: { ...item, ...input },
    }),
    onSaved: () => undefined,
  },
};
