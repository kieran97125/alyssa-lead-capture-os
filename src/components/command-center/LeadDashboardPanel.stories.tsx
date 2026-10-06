import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LeadDashboardPanel } from "./LeadDashboardPanel";
import { leadDashboardAvailabilityFixture } from "../../../e2e/fixtures/lead-dashboard-availability";

const meta = {
  title: "Dashboard/Lead authority availability",
  component: LeadDashboardPanel,
  parameters: { layout: "padded", nextjs: { appDirectory: true, navigation: { pathname: "/dashboard" } } },
  args: { snapshot: leadDashboardAvailabilityFixture(false) },
} satisfies Meta<typeof LeadDashboardPanel>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Unavailable: Story = {};
export const VerifiedEmpty: Story = { args: { snapshot: leadDashboardAvailabilityFixture(true) } };
export const PreviousSuccessfulUpdate: Story = {
  render: ({ snapshot }) => <>
    {snapshot.warnings.map((warning) => <p key={warning} className="command-status-message is-error" role="status">{warning}</p>)}
    <LeadDashboardPanel snapshot={snapshot} />
  </>,
  args: {
    snapshot: {
      ...leadDashboardAvailabilityFixture(true),
      sourceStatus: "error",
      warnings: ["最近一次更新未成功；以下保留上次成功同步嘅資料。"],
    },
  },
};
