import type { Meta, StoryObj } from "@storybook/react";
import { TreatmentPerformanceTrendChart } from "./TreatmentPerformanceTrendChart";
import { calculatePerformanceTrendPoint } from "@/lib/marketing/performanceTrend";

const funnelSeries = [
  {
    key: "treatment-a",
    label: "柔清舒敏護理",
    color: "#5A2348",
    brandId: "brand-a",
    points: [
      calculatePerformanceTrendPoint(
        { spend: 0, spendRecorded: false, leads: 8, bookings: 2, shows: 1, noShows: 0, pendingShows: 1 },
        { day: 1, date: "2026-08-01", annotations: [] }
      ),
      calculatePerformanceTrendPoint(
        { spend: 0, spendRecorded: false, leads: 5, bookings: 1, shows: 1, noShows: 0, pendingShows: 0 },
        { day: 2, date: "2026-08-02", annotations: [] }
      ),
    ],
  },
];

const costSeries = [
  {
    key: "brand-a-cost",
    label: "Ineffable Beauty",
    color: "#5A2348",
    brandId: "brand-a",
    points: [
      calculatePerformanceTrendPoint(
        { spend: 800, spendRecorded: true, leads: 8, bookings: 2, shows: 1, noShows: 0, pendingShows: 1 },
        { day: 1, date: "2026-08-01", annotations: [] }
      ),
      calculatePerformanceTrendPoint(
        { spend: 500, spendRecorded: true, leads: 5, bookings: 1, shows: 1, noShows: 0, pendingShows: 0 },
        { day: 2, date: "2026-08-02", annotations: [] }
      ),
    ],
  },
];

const meta = {
  title: "Command Center/Treatment Performance Trend Chart",
  component: TreatmentPerformanceTrendChart,
  parameters: { layout: "fullscreen" },
  args: {
    series: funnelSeries,
    costSeries,
    costAvailability: "available",
  },
} satisfies Meta<typeof TreatmentPerformanceTrendChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FunnelAndCostMetrics: Story = {};

export const CostUnallocated: Story = {
  args: {
    costSeries: [],
    costAvailability: "unallocated",
  },
};
