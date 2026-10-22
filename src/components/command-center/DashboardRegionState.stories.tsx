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
export const AwaitingManualUpdate: Story = {
  args: { failed: true, message: "未有可用嘅已同步資料。請按「跟 Lead Sheet 更新」。" },
};
export const SourceReadTimeout: Story = {
  args: { failed: true, message: "已更新 0/1 個來源；Lead Sheet：Google Sheet 回應逾時，未發布新數據。" },
};
export const SourceIdentityPending: Story = {
  args: { failed: true, message: "已更新 0/1 個來源；Lead Sheet：預約身份登記未完成，未發布新數據。" },
};
