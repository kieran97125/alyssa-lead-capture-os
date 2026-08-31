import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TrendModeToggle } from "@/components/command-center/TrendModeToggle";
import type { PerformanceTrendMode } from "@/lib/marketing/performanceTrend";

const meta = {
  title: "System/Controls/TrendModeToggle",
  component: TrendModeToggle,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof TrendModeToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Interactive: Story = {
  args: { mode: "cumulative", onChange: () => undefined },
  render: () => {
    const [mode, setMode] = useState<PerformanceTrendMode>("cumulative");
    return <TrendModeToggle mode={mode} onChange={setMode} />;
  },
};

export const Compact: Story = {
  args: { mode: "daily", onChange: () => undefined, compact: true },
};
