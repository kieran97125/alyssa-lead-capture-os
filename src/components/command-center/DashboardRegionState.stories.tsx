import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DashboardRegionState } from "./DashboardRegionState";

const meta = {
  title: "Dashboard/Data availability",
  component: DashboardRegionState,
  parameters: { layout: "padded" },
  args: { title: "Lead、預約及到店" },
} satisfies Meta<typeof DashboardRegionState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {};
export const Unavailable: Story = { args: { failed: true } };
