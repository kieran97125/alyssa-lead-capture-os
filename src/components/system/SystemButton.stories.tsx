import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Download, Plus } from "lucide-react";
import { SystemButton } from "@/components/system/SystemButton";

const meta = {
  title: "System/Controls/SystemButton",
  component: SystemButton,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: { children: "Primary action" },
} satisfies Meta<typeof SystemButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};
export const Compact: Story = {
  args: { density: "compact", children: "新增工作" },
  render: (args: Parameters<typeof SystemButton>[0]) => <SystemButton {...args}><Plus aria-hidden="true" />新增工作</SystemButton>,
};
export const Secondary: Story = {
  args: { variant: "secondary", children: "匯出報告" },
  render: (args: Parameters<typeof SystemButton>[0]) => <SystemButton {...args}><Download aria-hidden="true" />匯出報告</SystemButton>,
};
export const Outline: Story = { args: { variant: "outline", children: "編輯設定" } };
export const Disabled: Story = { args: { disabled: true, children: "處理中" } };
