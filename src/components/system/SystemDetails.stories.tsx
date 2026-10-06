import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SystemDataStatus, SystemDetails } from "./SystemDetails";

const meta = {
  title: "System/Details",
  component: SystemDetails,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof SystemDetails>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Methodology: Story = {
  args: { title: "計算口徑", children: "Lead 按建立日期；Book 按更新日期；Show 按確認到店日期。" },
};
export const MultipleWarnings: Story = {
  args: Methodology.args,
  render: () => {
    const warnings = Array.from({ length: 6 }, (_, i) => [`品牌 ${i + 1} 廣告費尚未確認完整。`, `品牌 ${i + 1} Lead 資料更新未成功。`]).flat();
    return <SystemDataStatus warnings={warnings} collapsibleWarnings={warnings} />;
  },
};
export const EmptyStatus: Story = {
  args: Methodology.args,
  render: () => <SystemDataStatus warnings={[]} />,
};

export const SourceUnavailable: Story = {
  args: Methodology.args,
  render: () => <SystemDataStatus warnings={["正式數據庫未連接；目前顯示驗收用同期數據。"]} />,
};
