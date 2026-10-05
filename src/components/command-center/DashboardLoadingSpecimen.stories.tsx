import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DashboardLoadingSpecimen } from "./DashboardLoadingSpecimen";

const meta = {
  title: "Dashboard/Navigation while loading",
  component: DashboardLoadingSpecimen,
  parameters: { layout: "fullscreen", nextjs: { appDirectory: true, navigation: { pathname: "/dashboard" } } },
} satisfies Meta<typeof DashboardLoadingSpecimen>;

export default meta;
type Story = StoryObj<typeof meta>;
export const PendingAndUnavailable: Story = {};
