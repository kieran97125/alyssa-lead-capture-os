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
